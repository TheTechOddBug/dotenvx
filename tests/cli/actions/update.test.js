const t = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

t.beforeEach(() => {
  sinon.restore()
  delete process.pkg
})

t.afterEach(() => {
  delete process.pkg
})

t.test('update runs the installer when packaged as a binary', ct => {
  const execSync = sinon.stub()
  process.pkg = {}
  const update = proxyquire('../../../src/cli/actions/update', {
    child_process: { execSync }
  })

  update()

  ct.ok(execSync.calledOnceWithExactly('curl -sfS https://dotenvx.sh | sh', { stdio: 'inherit' }))
  ct.end()
})

t.test('update prints manual npm commands when run through node', ct => {
  const execSync = sinon.stub()
  const consoleLog = sinon.stub(console, 'log')
  const update = proxyquire('../../../src/cli/actions/update', {
    child_process: { execSync }
  })

  update()

  ct.equal(execSync.callCount, 0)
  ct.ok(consoleLog.calledWith('global: npm install -g @dotenvx/dotenvx@latest'))
  ct.ok(consoleLog.calledWith('local:  npm install @dotenvx/dotenvx@latest --save'))
  ct.end()
})
