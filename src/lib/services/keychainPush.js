const { execFileSync } = require('child_process')

const keynames = require('../conventions/keynames')
const readEnvKey = require('../helpers/readEnvKey')
const armoredKeyDisplay = require('../helpers/armoredKeyDisplay')
const windowsCredentialManager = require('../helpers/windowsCredentialManager')

const SECURITY_BIN = '/usr/bin/security'
const SERVICE = 'dotenvx'

function addGenericPassword (publicKey, label, privateKey) {
  if (process.platform === 'win32') {
    windowsCredentialManager.addGenericPassword(publicKey, privateKey)
    return
  }

  try {
    execFileSync(SECURITY_BIN, ['add-generic-password', '-U', '-s', SERVICE, '-a', publicKey, '-l', label, '-w', privateKey], { stdio: 'ignore' })
  } catch {
    throw new Error('failed to save private key to macOS Keychain')
  }
}

function findGenericPassword (publicKey) {
  if (process.platform === 'win32') {
    return windowsCredentialManager.findGenericPassword(publicKey)
  }

  return execFileSync(SECURITY_BIN, ['find-generic-password', '-s', SERVICE, '-a', publicKey, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

class KeychainPush {
  constructor (envFile = '.env', envKeysFile = '.env.keys') {
    this.envFile = envFile
    this.envKeysFile = envKeysFile
  }

  run () {
    const envFile = this.envFile
    const envKeysFile = this.envKeysFile

    const {
      publicKeyName,
      privateKeyName
    } = keynames(envFile)

    const publicKey = readEnvKey(publicKeyName, envFile, { strict: true, ignore: ['MISSING_PRIVATE_KEY'] })
    const privateKey = readEnvKey(privateKeyName, envKeysFile, { strict: true })
    const label = `dotenvx (${armoredKeyDisplay(publicKey)})`

    try {
      const existingPrivateKey = findGenericPassword(publicKey)

      if (existingPrivateKey === privateKey) {
        return {
          changed: false,
          label,
          privateKeyName,
          privateKeyValue: privateKey,
          publicKeyValue: publicKey
        }
      }
    } catch {}

    addGenericPassword(publicKey, label, privateKey)

    return {
      changed: true,
      label,
      privateKeyName,
      privateKeyValue: privateKey,
      publicKeyValue: publicKey
    }
  }
}

module.exports = KeychainPush
