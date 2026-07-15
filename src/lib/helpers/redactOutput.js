const redact = require('./redact')

const FLUSH_TIMEOUT_MS = 100

function normalizedValues (values) {
  return [...new Set((values || [])
    .filter(value => value !== undefined && value !== null && `${value}`.length > 0)
    .map(value => `${value}`))]
    .sort((a, b) => b.length - a.length)
}

function redactOutput (value, sensitiveValues) {
  const values = normalizedValues(sensitiveValues)
  if (values.length < 1 || value === undefined || value === null) return value

  if (Array.isArray(value)) {
    return value.map(item => redactOutput(item, values))
  }

  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = redactOutput(item, values)
    }
    return result
  }

  if (typeof value !== 'string') return value

  let result = value
  for (const sensitiveValue of values) {
    result = result.split(sensitiveValue).join(redact(sensitiveValue))
  }
  return result
}

function partialMatchLength (value, sensitiveValues) {
  let longest = 0

  for (const sensitiveValue of sensitiveValues) {
    const maxLength = Math.min(value.length, sensitiveValue.length - 1)
    for (let length = maxLength; length > longest; length--) {
      if (sensitiveValue.startsWith(value.slice(-length))) {
        longest = length
        break
      }
    }
  }

  return longest
}

function safeBoundary (value, boundary, sensitiveValues) {
  let result = boundary
  let changed = true

  while (changed) {
    changed = false
    for (const sensitiveValue of sensitiveValues) {
      let index = value.indexOf(sensitiveValue)
      while (index !== -1) {
        const end = index + sensitiveValue.length
        if (index < result && end > result) {
          result = index
          changed = true
        }
        index = value.indexOf(sensitiveValue, index + 1)
      }
    }
  }

  return result
}

function createRedactedStreamWriter (stream, sensitiveValues) {
  const values = normalizedValues(sensitiveValues)
  let pending = ''
  let flushTimeout

  const clearFlushTimeout = () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout)
      flushTimeout = undefined
    }
  }

  const flush = () => {
    clearFlushTimeout()
    if (!pending) return
    stream.write(redactOutput(pending, values))
    pending = ''
  }

  const write = (chunk) => {
    clearFlushTimeout()
    pending += chunk.toString()

    const holdbackLength = partialMatchLength(pending, values)
    let boundary = pending.length - holdbackLength
    boundary = safeBoundary(pending, boundary, values)

    const output = pending.slice(0, boundary)
    pending = pending.slice(boundary)

    if (output) stream.write(redactOutput(output, values))
    if (pending) {
      flushTimeout = setTimeout(flush, FLUSH_TIMEOUT_MS)
      if (typeof flushTimeout.unref === 'function') flushTimeout.unref()
    }
  }

  return { write, flush }
}

module.exports = {
  redactOutput,
  createRedactedStreamWriter
}
