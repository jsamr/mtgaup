const fetch = require('node-fetch').default
const commander = require('commander')
const util = require('util')
const { writeFile } = require('fs')
const path = require('path')
const writeFilePromise = util.promisify(writeFile)
const exec = util.promisify(require('child_process').exec)

const program = new commander.Command()
program.version('0.0.1')
  .option('-I, --info', 'just show available executables.')
  .option('-D, --download', 'just download executable.')
  .option('-p, --patch', 'prefer MSP patch to MSI install, if available (default).')
  .option('-i, --install', 'prefer MSI install to MSP patch, if available.')
  .option('-d, --download-folder <folder>', 'specify where you wish to download binaries. Defaults to CWD.')

const MTGA_WINE_PREFIX = 'MTGA_WINE_PREFIX'
const MTGA_WINE_BINARY = 'MTGA_WINE_BINARY'
const forumPostURL = 'https://mtgarena-api.community.gl/forums/articles/58489?logView=0'
const mtgaWinePrefix = process.env[MTGA_WINE_PREFIX]
const mtgaWineBinary = process.env[MTGA_WINE_BINARY]

program.parse(process.argv)

const userPrefersNone = !program.patch && !program.install

if (!mtgaWinePrefix) {
  console.warn("You must provide " + MTGA_WINE_PREFIX + " environment variable.")
  process.exit(1)
}

if (!mtgaWineBinary) {
  console.warn("You must provide " + MTGA_WINE_BINARY + " environment variable.")
  process.exit(1)
}


if (userPrefersNone) {
  console.info("You didn't provide any option. Defaulting to patch, if available.")
}

const patchFileRegex = /a href=["'](https:\/\/[^\s"'<>]+\.msp)["']/g
const installFileRegex = /a href=["'](https:\/\/[^\s"'<>]+\.msi)["']/g

function getFileNameFromURI(uri) {
  return uri.substring(uri.lastIndexOf('/')+1)
}

async function fetchExecutables() {
  let patch = null
  let installer = null
  const resp = await fetch(forumPostURL)
  if (resp.ok) {
    const body = await resp.json()
    const text = body.article.content.text
    if (text) {
        const patchResult = new RegExp(patchFileRegex).exec(text)
        if (patchResult && patchResult.length > 1) {
            patch = patchResult[1]
        }
        const installerResult = new RegExp(installFileRegex).exec(text)
        if (installerResult && installerResult.length > 1) {
            installer = installerResult[1]
        }
    }
  }
  return {
      patch,
      installer
  }
}

function getDownloadFilePath(uri) {
  const fileName = getFileNameFromURI(uri)
  const installDir = program.downloadFolder || process.cwd()
  return path.resolve(installDir, fileName)
}

async function downloadFromURI(uri, downloadFilePath) {
  const x = await fetch(uri)
  const buffer = await  x.arrayBuffer()
  await writeFilePromise(downloadFilePath, Buffer.from(buffer))
  console.info(`Download of ${downloadFilePath} finished.`)
}

async function runInWine(downloadFilePath, flag) {
  const command = `${mtgaWineBinary} msiexec /${flag} "${downloadFilePath}`
  await exec(`export WINEPREFIX="${mtgaWinePrefix}"; ${command}"`)
  console.info(`Run command ${command} finished.`)
}

async function run() {
    const executables = await fetchExecutables()
    const shouldRunPatch = executables.patch && (userPrefersNone || program.patch)
    const onlyInfo =  program.info
    const onlyDownload = program.download
    const shouldDownload = onlyDownload || !onlyInfo
    const shouldInstall = shouldDownload && !onlyDownload && !onlyInfo
    if (shouldRunPatch) {
      console.info(`Found patch executable ${executables.patch}`)
      const uri = executables.patch
      const downloadFilePath = getDownloadFilePath(uri)
      shouldDownload && await downloadFromURI(uri, downloadFilePath)
      shouldInstall && await runInWine(downloadFilePath, 'p')
    } else if (executables.installer) {
      console.info(`Found installer executable ${executables.installer}`)
      const uri = executables.installer
      const downloadFilePath = getDownloadFilePath(uri)
      shouldDownload && await downloadFromURI(uri, downloadFilePath)
      shouldInstall && await runInWine(downloadFilePath, 'i')
    } else {
      console.warn("Couldn't find any binary.")
      process.exit(1)
    }
}


run()