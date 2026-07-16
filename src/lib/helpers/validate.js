function optionalKeys (comments) {
  const keys = new Set()

  for (const [key, values] of Object.entries(comments)) {
    if (values.some(comment => comment && /\boptional\b/i.test(comment))) {
      keys.add(key)
    }
  }

  return keys
}

function validate (example = {}, env = {}, options = {}) {
  const errors = []
  const missingRequired = []
  const optional = optionalKeys(options.comments || {})

  for (const key of Object.keys(example)) {
    const value = env[key]
    const missing = !Object.prototype.hasOwnProperty.call(env, key) || value.trim() === ''
    if (!optional.has(key) && missing) {
      missingRequired.push(key)
    }
  }

  if (missingRequired.length > 0) {
    errors.push({
      code: 'MISSING_REQUIRED',
      keys: missingRequired,
      message: `missing required (${missingRequired.join(', ')})`
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

module.exports = validate
