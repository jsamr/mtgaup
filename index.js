const fetch = require('node-fetch').default
const commander = require('commander')
const util = require('util')
const { writeFile } = require('fs')
const path = require('path')
const writeFilePromise = util.promisify(writeFile)
const exec = util.promisify(require('child_process').exec)


const forumPostURL = 'https://mtgarena-api.community.gl/forums/articles/58489?logView=0'
const MTGA_WINE_PREFIX = 'MTGA_WINE_PREFIX'
const MTGA_WINE_BINARY = 'MTGA_WINE_BINARY'
const mtgaWinePrefix = process.env[MTGA_WINE_PREFIX]
const mtgaWineBinary = process.env[MTGA_WINE_BINARY]
const setupHelp = '\nFIND OUT HOW: https://github.com/jsamr/mtgaup/wiki/Setup'

const envInfo = `ENVIRONMENT VARIABLES
${mtgaWinePrefix ? `  MTGA_WINE_PREFIX is set to "${mtgaWinePrefix}"` : `WARNING: you must set ${MTGA_WINE_PREFIX}`}
${mtgaWineBinary ? `  MTGA_WINE_BINARY is set to "${mtgaWineBinary}"` : `WARNING: you must set ${MTGA_WINE_BINARY}`}${!mtgaWineBinary && !mtgaWinePrefix ? setupHelp : ''}`

const description = `
This program, when called with no argument, will do the following:

  1. Scrap the content of a community forum post containing URLs pointing to msp (or msi) binaries.
  2. Download, given user provided options, the preferred binary.
  3. Install the chosen binary with \`wine msiexec'.

${envInfo}

ONLINE RESOURCES
  Wiki:        https://github.com/jsamr/mtgaup/wiki
  Bug Reports: https://github.com/jsamr/mtgaup/issues`

const program = new commander.Command()
program.version('1.2.0')
  .usage(description)
  .option('-I, --info', 'scrap binaries available for download')
  .option('-E, --env-info', 'print environment variables information')
  .option('-D, --download', 'scrap binaries and download the preferred one')
  .option('-p, --patch', 'prefer MSP patch to MSI install, if available (default)')
  .option('-i, --install', 'prefer MSI install to MSP patch, if available')
  .option('-d, --download-folder <folder>', 'specify where you wish to download binaries. Defaults to CWD')

program.parse(process.argv)

const userPrefersNone = !program.patch && !program.install

if (!mtgaWinePrefix) {
  console.error(`You must provide ${MTGA_WINE_PREFIX} environment variable.${setupHelp}`)
  process.exit(1)
}

if (!mtgaWineBinary) {
  console.error(`You must provide ${MTGA_WINE_BINARY} environment variable.${setupHelp}`)
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

async function fetchBinaries() {
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
  const command = `${mtgaWineBinary} msiexec /${flag} "${downloadFilePath}"`
  await exec(command, {
    env: {
      ...process.env,
      WINEPREFIX: mtgaWinePrefix
    }
  })
  console.info(`Run command ${command} finished.`)
}

async function run() {
    const binaries = await fetchBinaries()
    const shouldRunPatch = binaries.patch && (userPrefersNone || program.patch)
    const onlyInfo =  program.info
    const onlyDownload = program.download
    const shouldDownload = onlyDownload || !onlyInfo
    const shouldInstall = shouldDownload && !onlyDownload && !onlyInfo
    if (shouldRunPatch) {
      console.info(`Found patch binary ${binaries.patch}`)
      const uri = binaries.patch
      const downloadFilePath = getDownloadFilePath(uri)
      shouldDownload && await downloadFromURI(uri, downloadFilePath)
      shouldInstall && await runInWine(downloadFilePath, 'p')
    } else if (binaries.installer) {
      console.info(`Found installer binary ${binaries.installer}`)
      const uri = binaries.installer
      const downloadFilePath = getDownloadFilePath(uri)
      shouldDownload && await downloadFromURI(uri, downloadFilePath)
      shouldInstall && await runInWine(downloadFilePath, 'i')
    } else {
      console.warn("Couldn't find any binary.")
      process.exit(1)
    }
}

if (program.envInfo) {
  console.info(envInfo)
  process.exit(0)
}

run()