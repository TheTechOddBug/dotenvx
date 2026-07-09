const t = require('tap')
const sinon = require('sinon')
const childProcess = require('child_process')

const { logger } = require('../../../src/shared/logger')

const executeDynamic = require('../../../src/lib/helpers/executeDynamic')

const program = {
  outputHelp: sinon.stub()
}

function hasValidBoxShape (output) {
  const lines = output.split('\n')
  if (lines.length < 3) return false

  const top = lines[0]
  const bottom = lines[lines.length - 1]
  if (!/^ _+$/.test(top)) return false
  if (!/^\|_+\|$/.test(bottom)) return false

  const body = lines.slice(1, -1)
  return body.every((line) => line.startsWith('|') && line.endsWith('|'))
}

function assertArmorBanner (ct, output) {
  ct.match(output, /Install one/i, 'shows install-one heading')
  ct.match(output, /\[curl -sfS https:\/\/dotenvx.sh\/armor \| sh\]/, 'uses armor curl install command')
  ct.match(output, /\[npm i @dotenvx\/dotenvx-armor --save\]/, 'uses npm install command')
  ct.match(output, /Then/i, 'shows then heading')
  ct.match(output, /\[dotenvx armor up\]/, 'uses armor up command')
  ct.match(output, /\(sign in when prompted\)/, 'notes sign-in prompt')
  ct.ok(hasValidBoxShape(output), 'banner box shape is valid')
}

t.beforeEach(() => {
  sinon.restore()
})

t.test('executeDynamic - no command', ct => {
  const processExitStub = sinon.stub(process, 'exit')

  executeDynamic(program, undefined, [])

  ct.ok(program.outputHelp.called, 'program help is shown')
  ct.ok(processExitStub.calledWith(1), 'process.exit should be called with code 1')

  ct.end()
})

t.test('executeDynamic - other command missing', ct => {
  const spawnSyncStub = sinon.stub(childProcess, 'spawnSync')
  const mockResult = {
    status: 1,
    error: new Error('Mock Error')
  }
  spawnSyncStub.returns(mockResult)
  const processExitStub = sinon.stub(process, 'exit')
  const loggerInfoStub = sinon.stub(logger, 'info')

  executeDynamic(program, 'other', ['other'])

  ct.ok(spawnSyncStub.calledWith('dotenvx-other', [], sinon.match.object), 'tries matching dynamic binary')
  ct.ok(loggerInfoStub.calledWith('error: unknown command \'other\''), 'info')
  ct.ok(processExitStub.calledWith(1), 'process.exit should be called with code 1')

  ct.end()
})

t.test('executeDynamic - pro found', ct => {
  const spawnSyncStub = sinon.stub(childProcess, 'spawnSync')
  const mockResult = {
    status: 0
  }
  spawnSyncStub.returns(mockResult)
  const processExitStub = sinon.stub(process, 'exit')

  executeDynamic(program, 'pro', ['pro'])

  ct.ok(spawnSyncStub.calledWith('dotenvx-pro', [], sinon.match.object), 'tries matching dynamic binary')
  ct.ok(processExitStub.notCalled, 'process.exit should not be called')

  ct.end()
})

t.test('executeDynamic - armor found', ct => {
  const spawnSyncStub = sinon.stub(childProcess, 'spawnSync')
  const mockResult = {
    status: 0
  }
  spawnSyncStub.returns(mockResult)
  const processExitStub = sinon.stub(process, 'exit')

  executeDynamic(program, 'armor', ['armor', 'up'])

  ct.ok(spawnSyncStub.calledWith('dotenvx-armor', ['up'], sinon.match.object), 'spawnSync proxies to dotenvx-armor up')
  ct.ok(processExitStub.notCalled, 'process.exit should not be called')

  ct.end()
})

t.test('executeDynamic - armor command missing', ct => {
  const spawnSyncStub = sinon.stub(childProcess, 'spawnSync')
  const mockResult = {
    status: 1,
    error: new Error('Mock Error')
  }
  spawnSyncStub.returns(mockResult)
  const processExitStub = sinon.stub(process, 'exit')
  const consoleLogStub = sinon.stub(console, 'log')

  executeDynamic(program, 'armor', ['armor'])

  ct.ok(spawnSyncStub.calledWith('dotenvx-armor', [], sinon.match.object), 'tries dotenvx-armor')
  ct.ok(consoleLogStub.called, 'console.log')
  assertArmorBanner(ct, consoleLogStub.firstCall.args[0])
  ct.ok(processExitStub.calledWith(1), 'process.exit should be called with code 1')

  ct.end()
})
