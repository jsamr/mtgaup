const fetch = require('node-fetch').default
const commander = require('commander')
const util = require('util')
const { writeFile } = require('fs')
const path = require('path')
const writeFilePromise = util.promisify(writeFile)
const spawn = require('child_process').spawn

const versionEndpoint = 'https://mtgarena.downloads.wizards.com/Live/Windows32/version'
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

  1. Fetch a WOTC endpoint containing URLs pointing to latest msp (or msi) binaries.
  2. Download, given user provided options, the preferred binary.
  3. Install the chosen binary with \`wine msiexec'.

${envInfo}

ONLINE RESOURCES
  Wiki:        https://github.com/jsamr/mtgaup/wiki
  Bug Reports: https://github.com/jsamr/mtgaup/issues`

const program = new commander.Command()
program.version('1.2.2')
  .usage(description)
  .option('-I, --info', 'scrap binaries available for download')
  .option('-E, --env-info', 'print environment variables information')
  .option('-D, --download', 'scrap binaries and download the preferred one')
  .option('-p, --patch', 'prefer MSP patch to MSI install, if available (default)')
  .option('-i, --install', 'prefer MSI install to MSP patch, if available')
  .option('-d, --download-folder <folder>', 'specify where you wish to download binaries. Defaults to CWD')

program.parse(process.argv)

const userPrefersNone = !program.patch && !program.install

function getFileNameFromURI(uri) {
  return uri.substring(uri.lastIndexOf('/') + 1)
}

async function fetchVersionInfo() {
  let patch = null
  let installer = null
  const resp = await fetch(versionEndpoint)
  if (resp.ok) {
    const body = await resp.json()
    patch = body.CurrentPatchURL
    installer = body.CurrentInstallerURL
  } else {
    console.warn(`Network error. Couldn't fetch ${versionEndpoint}. HTTP Code ${resp.status}.`)
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
  console.info(`Download of ${downloadFilePath} completed.`)
}

async function runInWine(downloadFilePath, flag) {
  const command = `${mtgaWineBinary} msiexec /${flag} "${downloadFilePath}"`
  const options = {
    env: {
      ...process.env,
      WINEPREFIX: mtgaWinePrefix
    },
    stdio: 'inherit',
    detached: true,
    shell: true
  }
  try {
    await new Promise((res, rej) => {
      const child = spawn(command, options)
      child.on('close', function(exitCode) {
        exitCode === 0 ? res() : rej()
      })
    })
  } catch (e) {
    console.error(`${command} exited with a non-0 status`)
    process.exit(1)
  }

  console.info(`Run command ${command} completed.`)
}

function makeRunAssertions() {
  if (!mtgaWinePrefix) {
    console.error(`You must provide ${MTGA_WINE_PREFIX} environment variable.${setupHelp}`)
    process.exit(1)
  }
  if (!mtgaWineBinary) {
    console.error(`You must provide ${MTGA_WINE_BINARY} environment variable.${setupHelp}`)
    process.exit(1)
  } 
  if (userPrefersNone) {
    console.info("Defaulting to patch binary, if available.")
  }
}

async function run() {
    makeRunAssertions()
    const binaries = await fetchVersionInfo()
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
      console.warn("Couldn't find any binary. Exiting.")
      process.exit(1)
    }
}

if (program.envInfo) {
  console.info(envInfo)
  process.exit(0)
}

run().catch(function (e) {
  console.error(e.message)
  process.exit(1)
})