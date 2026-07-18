const { execFile, execFileSync } = require('child_process')
const Errors = require('./errors')

function execFileAsync (command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) return reject(error)
      resolve(stdout)
    })
  })
}

function isSecretReference (value) {
  return typeof value === 'string' && value.startsWith('bws://')
}

function secretId (value) {
  return value.slice('bws://'.length)
}

function secretValue (stdout) {
  const secret = JSON.parse(stdout)
  if (typeof secret.value !== 'string') throw new Error('Bitwarden Secrets Manager response did not contain a value')
  return secret.value
}

function resolutionError (key, error) {
  const message = error && error.code === 'ENOENT'
    ? `Bitwarden Secrets Manager CLI is not installed and could not resolve ${key}`
    : `Bitwarden Secrets Manager CLI failed to resolve ${key}`

  return new Errors({ message }).bitwardenFailed()
}

async function resolveBitwardenSecrets (parsed) {
  const errors = []
  const unresolved = []

  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      const stdout = await execFileAsync('bws', ['secret', 'get', secretId(value)], {
        encoding: 'utf8',
        windowsHide: true
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

function resolveBitwardenSecretsSync (parsed) {
  const errors = []
  const unresolved = []

  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      const stdout = execFileSync('bws', ['secret', 'get', secretId(value)], {
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

module.exports = resolveBitwardenSecrets
module.exports.sync = resolveBitwardenSecretsSync
