const { execFile, execFileSync } = require('child_process')

function execFileAsync (command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout) => {
      if (error) return reject(error)
      resolve(stdout)
    })
  })
}

function isSecretReference (value) {
  return typeof value === 'string' && value.startsWith('op://')
}

function resolutionError (key, error) {
  const message = error && error.code === 'ENOENT'
    ? '1Password CLI (op) not found'
    : '1Password CLI could not read the secret reference'

  const resolvedError = new Error(`could not resolve ${key}: ${message}`)
  resolvedError.code = 'ONEPASSWORD_RESOLUTION_FAILED'
  return resolvedError
}

async function resolveOnePassword (parsed) {
  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      const stdout = await execFileAsync('op', ['read', value, '--no-newline'], {
        encoding: 'utf8',
        windowsHide: true
      })
      parsed[key] = stdout
    } catch (error) {
      throw resolutionError(key, error)
    }
  }

  return parsed
}

function resolveOnePasswordSync (parsed) {
  for (const [key, value] of Object.entries(parsed)) {
    if (!isSecretReference(value)) continue

    try {
      parsed[key] = execFileSync('op', ['read', value, '--no-newline'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      throw resolutionError(key, error)
    }
  }

  return parsed
}

module.exports = resolveOnePassword
module.exports.sync = resolveOnePasswordSync
