const { encrypted, scan } = require('@dotenvx/primitives')

function decryptedValues (processedEnvs) {
  const result = new Set()

  for (const processedEnv of processedEnvs || []) {
    const src = processedEnv.src || processedEnv.string
    if (!src) continue

    let rawParsed
    try {
      rawParsed = scan(src).parsed
    } catch (error) {
      continue
    }

    for (const [key, rawValues] of Object.entries(rawParsed || {})) {
      const rawValue = rawValues[rawValues.length - 1]
      const injectedValue = (processedEnv.injected || {})[key]

      if (!encrypted(rawValue)) continue
      if (injectedValue === undefined || injectedValue === null || injectedValue === '') continue
      if (encrypted(injectedValue)) continue

      result.add(`${injectedValue}`)
    }
  }

  return [...result]
}

module.exports = decryptedValues
