const t = require('tap')
const { PassThrough } = require('stream')

const { redactOutput, createRedactedStreamWriter } = require('../../../src/lib/helpers/redactOutput')

t.test('redactOutput replaces sensitive values in strings, arrays, and plain objects', ct => {
  const sensitiveValues = ['super-secret', 'secret']

  ct.equal(redactOutput('value=super-secret', sensitiveValues), 'value=[REDACTED]')
  ct.same(redactOutput(['secret', { nested: 'super-secret' }], sensitiveValues), ['[REDACTED]', { nested: '[REDACTED]' }])
  ct.equal(redactOutput('public-value', sensitiveValues), 'public-value')

  ct.end()
})

t.test('createRedactedStreamWriter redacts values split across chunks', ct => {
  const output = new PassThrough()
  let written = ''
  output.on('data', chunk => {
    written += chunk.toString()
  })

  const writer = createRedactedStreamWriter(output, ['super-secret'])
  writer.write('value=super-')
  writer.write('secret\n')
  writer.flush()

  ct.equal(written, 'value=[REDACTED]\n')
  ct.end()
})

t.test('createRedactedStreamWriter passes through unrelated output immediately', ct => {
  const output = new PassThrough()
  let written = ''
  output.on('data', chunk => {
    written += chunk.toString()
  })

  const writer = createRedactedStreamWriter(output, ['super-secret'])
  writer.write('prompt> ')

  ct.equal(written, 'prompt> ')
  writer.flush()
  ct.end()
})
