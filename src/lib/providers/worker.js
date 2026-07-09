const { runAsWorker } = require('@dotenvx/tooling')

runAsWorker(async (providerPath, publicKeyHex) => {
  const provider = require(providerPath)
  return provider(publicKeyHex)
})
