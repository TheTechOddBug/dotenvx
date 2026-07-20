const { execFile, execFileSync } = require('child_process')
const Errors = require('./errors')
const prompts = require('./prompts')
const createSpinner = require('./createSpinner')

const FIELDS = new Set(['username', 'password', 'uri'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function execFileAsync (command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) return reject(error)
      resolve(stdout)
    })
  })
}

function isSecretReference (value) {
  return typeof value === 'string' && value.startsWith('bw://')
}

function parseSecretReference (value) {
  const [itemId, field, ...extra] = value.slice('bw://'.length).split('/')

  if (!UUID.test(itemId) || !field || extra.length > 0) {
    throw new Error('invalid Bitwarden Password Manager reference')
  }

  if (!FIELDS.has(field)) {
    throw new Error(`unsupported Bitwarden Password Manager field ${field}`)
  }

  return { itemId, field }
}

async function session (options) {
  if (options.session) return options.session

  if (process.stdin.isTTY && process.stderr.isTTY) {
    createSpinner.pause()
    const password = await prompts.password({
      message: 'Bitwarden master password',
      prefix: '◇',
      separator: '='
    }, {
      input: process.stdin,
      output: process.stderr
    })
    createSpinner.resume()
    const passwordEnv = 'DOTENVX_BITWARDEN_PASSWORD'
    options.session = secretValue(await execFileAsync('bw', ['unlock', '--passwordenv', passwordEnv, '--raw'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, [passwordEnv]: password }
    }))
    return options.session
  }

  if (!options.session) {
    const error = new Error('Bitwarden Password Manager requires an unlocked BW_SESSION')
    error.code = 'BW_SESSION_MISSING'
    throw error
  }
}

function resolutionError (key, error) {
  let message
  if (error && error.code === 'ENOENT') {
    message = `Bitwarden Password Manager CLI is not installed and could not resolve ${key}`
  } else if (error && error.code === 'BW_SESSION_MISSING') {
    message = `Bitwarden Password Manager is locked and could not resolve ${key}; run 'export BW_SESSION="$(bw unlock --raw)"'`
  } else if (error && error.message && error.message.startsWith('unsupported Bitwarden Password Manager field')) {
    message = `${error.message} for ${key}`
  } else if (error && error.message === 'invalid Bitwarden Password Manager reference') {
    message = `invalid Bitwarden Password Manager reference for ${key}`
  } else {
    message = `Bitwarden Password Manager CLI failed to resolve ${key}`
  }

  return new Errors({
    message,
    help: 'fix: [https://bitwarden.com/help/cli/]'
  }).bitwardenFailed()
}

function secretValue (stdout) {
  return stdout.replace(/\r?\n$/, '')
}

async function resolveBitwardenPassword (parsed, options = {}) {
  const errors = []
  const unresolved = []
  options.session = options.session || process.env.BW_SESSION

  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      const { itemId, field } = parseSecretReference(value)
      const bwSession = await session(options)
      const stdout = await execFileAsync('bw', ['get', field, itemId], {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, BW_SESSION: bwSession }
      })
      parsed[key] = secretValue(stdout)
    } catch (error) {
      errors.push(resolutionError(key, error))
      unresolved.push(key)
      delete parsed[key]
    }
  }

  return { errors, unresolved }
}

function resolveBitwardenPasswordSync (parsed) {
  const errors = []
  const unresolved = []

  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      const { itemId, field } = parseSecretReference(value)
      if (!process.env.BW_SESSION) {
        const error = new Error('Bitwarden Password Manager requires an unlocked BW_SESSION')
        error.code = 'BW_SESSION_MISSING'
        throw error
      }
      const stdout = execFileSync('bw', ['get', field, itemId], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      parsed[key] = secretValue(stdout)
    } catch (error) {
      errors.push(resolutionError(key, error))
      unresolved.push(key)
      delete parsed[key]
    }
  }

  return { errors, unresolved }
}

module.exports = resolveBitwardenPassword
module.exports.sync = resolveBitwardenPasswordSync
