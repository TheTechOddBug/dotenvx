const t = require('tap')

const redact = require('../../../src/lib/helpers/redact')

t.test('redact replaces strings of any length', ct => {
  ct.equal(redact('a'), '[REDACTED]')
  ct.equal(redact('super-secret-value'), '[REDACTED]')
  ct.equal(redact(''), '')

  ct.end()
})
