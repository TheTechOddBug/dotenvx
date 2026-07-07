const Session = require('./../../db/session')

const armorProvider = require('./armor/index')
const keychainProvider = require('./keychain/index')

function syncArmorProvider (publicKeyHex) {
  const { createSyncFn } = require('synckit')
  const runProviderSync = createSyncFn(require.resolve('./worker.js'))
  return runProviderSync(require.resolve('./armor/index'), publicKeyHex)
}

function hasKey (keyring, publicKeyHex) {
  return keyring && keyring[publicKeyHex]
}

function composeProviders (providerFns) {
  return async function provider (publicKeyHex) {
    for (const providerFn of providerFns) {
      const keyring = await providerFn(publicKeyHex)
      if (hasKey(keyring, publicKeyHex)) return keyring
    }

    return {}
  }
}

function composeProvidersSync (providerFns) {
  return function providerSync (publicKeyHex) {
    for (const providerFn of providerFns) {
      const keyring = providerFn(publicKeyHex)
      if (hasKey(keyring, publicKeyHex)) return keyring
    }

    return {}
  }
}

function armorProviderForOptions (options) {
  return (publicKeyHex) => armorProvider(publicKeyHex, {
    onStatus: options.onStatus,
    token: options.token,
    command: options.command
  })
}

function useKeychain (options) {
  return options.noKeychain !== true && options.keychain !== false
}

async function providers (options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'provider')) {
    return options.provider
  }

  if (options.noArmor || options.armor === false) {
    return useKeychain(options) ? keychainProvider : null
  }

  const sesh = new Session()
  const noArmor = !options.token && await sesh.noArmor()
  if (noArmor) return useKeychain(options) ? keychainProvider : null

  const providerFns = [
    armorProviderForOptions(options)
  ]

  if (useKeychain(options)) providerFns.unshift(keychainProvider)

  return composeProviders(providerFns)
}

providers.sync = function providersSync (options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'provider')) {
    return options.provider
  }

  if (options.noArmor || options.armor === false) {
    return useKeychain(options) ? keychainProvider : null
  }

  const sesh = new Session()
  const noArmor = !options.token && sesh.noArmorSync()
  if (noArmor) return useKeychain(options) ? keychainProvider : null

  const providerFns = [
    syncArmorProvider
  ]

  if (useKeychain(options)) providerFns.unshift(keychainProvider)

  return composeProvidersSync(providerFns)
}

module.exports = providers
