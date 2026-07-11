const t = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const helperPath = '../../../src/lib/helpers/windowsCredentialManager'

t.afterEach(() => {
  sinon.restore()
})

t.test('writes a generic credential through encoded PowerShell with the secret on stdin', t => {
  const execFileSync = sinon.stub().returns('')
  const credentialManager = proxyquire(helperPath, {
    child_process: { execFileSync }
  })

  credentialManager.addGenericPassword('public-key', 'private-key-that-must-not-be-an-argument')

  const [command, args, options] = execFileSync.firstCall.args
  t.equal(command, 'powershell.exe')
  t.same(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand'])
  t.notMatch(args.join(' '), /private-key-that-must-not-be-an-argument/)
  t.match(Buffer.from(args[3], 'base64').toString('utf16le'), /CredWriteW/)
  t.same(JSON.parse(options.input), {
    action: 'write',
    target: 'dotenvx:public-key',
    username: 'public-key',
    secret: 'private-key-that-must-not-be-an-argument'
  })
  t.equal(options.windowsHide, true)
  t.end()
})

t.test('reads a generic credential through encoded PowerShell', t => {
  const execFileSync = sinon.stub().returns('private-key\n')
  const credentialManager = proxyquire(helperPath, {
    child_process: { execFileSync }
  })

  t.equal(credentialManager.findGenericPassword('public-key'), 'private-key')
  t.same(JSON.parse(execFileSync.firstCall.args[2].input), {
    action: 'read',
    target: 'dotenvx:public-key'
  })
  t.end()
})

t.test('sanitizes failed PowerShell writes', t => {
  const privateKey = 'private-key-that-must-not-leak'
  const execFileSync = sinon.stub().throws(new Error(`PowerShell failed with ${privateKey}`))
  const credentialManager = proxyquire(helperPath, {
    child_process: { execFileSync }
  })

  const error = t.throws(() => credentialManager.addGenericPassword('public-key', privateKey), /failed to save private key to Windows Credential Manager/)

  t.notMatch(error.message, privateKey)
  t.end()
})
