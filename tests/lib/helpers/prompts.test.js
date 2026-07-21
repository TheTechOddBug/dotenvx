const t = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const tooling = require('@dotenvx/tooling')
const { PassThrough } = require('stream')

t.test('select uses enquirer with normalized choices and IO context', async ct => {
  const prompt = sinon.stub().resolves({ value: 'file' })

  function EnquirerMock () {
    this.prompt = prompt
  }

  const prompts = proxyquire('../../../src/lib/helpers/prompts', {
    '@dotenvx/tooling': { ...tooling, Enquirer: EnquirerMock }
  })

  const input = {}
  const output = {}
  const value = await prompts.select({
    message: 'Choose private key storage',
    choices: [
      'raw',
      { name: '◫ File (.env.keys)', value: 'file' },
      { value: 'armored' }
    ]
  }, { input, output })

  ct.equal(value, 'file')
  ct.same(prompt.firstCall.args[0], {
    type: 'select',
    name: 'value',
    message: 'Choose private key storage',
    choices: [
      'raw',
      { name: 'file', message: '◫ File (.env.keys)' },
      { name: 'armored', message: 'armored' }
    ],
    stdin: input,
    stdout: output
  })

  ct.end()
})

t.test('select does not require IO context', async ct => {
  const prompt = sinon.stub().resolves({ value: 'armored' })

  function EnquirerMock () {
    this.prompt = prompt
  }

  const prompts = proxyquire('../../../src/lib/helpers/prompts', {
    '@dotenvx/tooling': { ...tooling, Enquirer: EnquirerMock }
  })

  const value = await prompts.select({
    message: 'Choose private key storage',
    choices: ['local']
  })

  ct.equal(value, 'armored')
  ct.same(prompt.firstCall.args[0], {
    type: 'select',
    name: 'value',
    message: 'Choose private key storage',
    choices: ['local'],
    stdout: process.stderr
  })

  ct.end()
})

t.test('password restores the terminal and rejects cleanly on ctrl-c', async ct => {
  const input = new PassThrough()
  const output = new PassThrough()
  const rawModes = []
  let rendered = ''
  input.isRaw = false
  input.setRawMode = mode => {
    rawModes.push(mode)
    input.isRaw = mode
  }
  output.on('data', chunk => { rendered += chunk.toString() })

  const prompts = require('../../../src/lib/helpers/prompts')
  const pending = prompts.password({
    message: 'Bitwarden master password',
    prefix: '◇',
    separator: '='
  }, { input, output })

  input.write('\u0003')

  await ct.rejects(pending, { code: 'PROMPT_CANCELLED' })
  ct.same(rawModes, [true, false])
  ct.equal(input.listenerCount('data'), 0)
  ct.match(rendered, /^◇ Bitwarden master password = /)
})
