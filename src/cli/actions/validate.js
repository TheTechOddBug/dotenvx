const { logger } = require('./../../shared/logger')

const envsResolver = require('./../../lib/resolvers/envs')
const catchAndLog = require('./../../lib/helpers/catchAndLog')
const createSpinner = require('../../lib/helpers/createSpinner')
const Session = require('../../db/session')
const normalizeDotenvConfigQuiet = require('../../lib/helpers/normalizeDotenvConfigQuiet')
const normalizeDotenvConfigConvention = require('../../lib/helpers/normalizeDotenvConfigConvention')
const buildCommandEnvs = require('../../lib/helpers/buildCommandEnvs')
const resolveEnvKeysFile = require('../../lib/helpers/resolveEnvKeysFile')
const validateEnvExample = require('../../lib/helpers/validateEnvExample')

const { determine } = require('./../../lib/helpers/envResolution')

async function validate () {
  const options = normalizeDotenvConfigConvention(normalizeDotenvConfigQuiet(this.opts()))
  const spinnerOptions = typeof this.optsWithGlobals === 'function' ? this.optsWithGlobals() : options
  const spinner = await createSpinner({ ...spinnerOptions, ...options, text: 'validating' })
  const ignore = options.ignore || []
  const validateEnv = { ...process.env }
  let errorCount = 0

  logger.debug(`options: ${JSON.stringify(options)}`)

  try {
    let envs = buildCommandEnvs(this.envs, options.convention)
    envs = determine(envs, process.env)

    const sesh = new Session()
    const noArmor = options.armor === false || (!options.token && (await sesh.noArmor()))
    const noKeychain = options.native === false || options.noNative === true

    const { processedEnvs } = await envsResolver({
      envs,
      overload: options.overload,
      processEnv: validateEnv,
      envKeysFile: resolveEnvKeysFile(options.envKeysFile),
      noArmor,
      noKeychain,
      no1Password: options['1password'] === false || options.no1Password === true,
      noBitwarden: options.bitwarden === false || options.noBitwarden === true,
      token: options.token,
      onStatus: (text) => {
        if (spinner && text) {
          spinner.text = text
        }
      }
    })

    for (const processedEnv of processedEnvs) {
      for (const error of processedEnv.errors || []) {
        if (ignore.includes(error.code)) {
          logger.verbose(`ignored: ${error.message}`)
          continue
        }

        errorCount += 1
        logger.error(error.messageWithHelp || error.message)
      }
    }

    const validationError = validateEnvExample(validateEnv)
    if (validationError) {
      if (ignore.includes(validationError.code)) {
        logger.verbose(`ignored: ${validationError.message}`)
      } else {
        errorCount += 1
        logger.error(validationError.messageWithHelp || validationError.message)
      }
    }

    if (spinner) spinner.stop()

    if (errorCount > 0) {
      process.exit(1)
    } else {
      logger.success('▣ validated')
    }
  } catch (error) {
    if (spinner) spinner.stop()
    catchAndLog(error)
    process.exit(1)
  }
}

module.exports = validate
