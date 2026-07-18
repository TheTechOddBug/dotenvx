const t = require('tap')
const proxyquire = require('proxyquire')

t.test('resolves bws:// values asynchronously', async ct => {
  const calls = []
  const resolveBitwardenSecrets = proxyquire('../../../src/lib/helpers/resolveBitwardenSecrets', {
    child_process: {
      execFile: (command, args, options, callback) => {
        calls.push([command, args, options])
        callback(null, JSON.stringify({ value: 'super-secret' }), '')
      },
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = { SECRET: 'bws://2863ced6-eba1-48b4-b5c0-afa30104877a', PLAIN: 'value' }

  const result = await resolveBitwardenSecrets(parsed)

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.equal(calls[0][0], 'bws')
  ct.same(calls[0][1], ['secret', 'get', '2863ced6-eba1-48b4-b5c0-afa30104877a'])
  ct.same(result, { errors: [], unresolved: [] })
})

t.test('resolves bws:// values synchronously without a shell', ct => {
  const calls = []
  const resolveBitwardenSecrets = proxyquire('../../../src/lib/helpers/resolveBitwardenSecrets', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: (command, args, options) => {
        calls.push([command, args, options])
        return JSON.stringify({ value: 'super-secret' })
      }
    }
  })
  const parsed = { SECRET: 'bws://secret-id; echo unsafe', PLAIN: 'value' }

  const result = resolveBitwardenSecrets.sync(parsed)

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.equal(calls[0][0], 'bws')
  ct.same(calls[0][1], ['secret', 'get', 'secret-id; echo unsafe'])
  ct.same(result, { errors: [], unresolved: [] })
  ct.end()
})

t.test('reports and omits a missing bws CLI without exposing the reference', ct => {
  const resolveBitwardenSecrets = proxyquire('../../../src/lib/helpers/resolveBitwardenSecrets', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => {
        const error = new Error('spawn bws ENOENT bws://private/reference')
        error.code = 'ENOENT'
        throw error
      }
    }
  })

  const parsed = { DATABASE_PASSWORD: 'bws://private/reference', PLAIN: 'value' }
  const result = resolveBitwardenSecrets.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.same(result.unresolved, ['DATABASE_PASSWORD'])
  ct.match(result.errors[0], {
    code: 'BITWARDEN_FAILED',
    message: '[BITWARDEN_FAILED] Bitwarden Secrets Manager CLI is not installed and could not resolve DATABASE_PASSWORD',
    help: 'fix: [https://bitwarden.com/help/secrets-manager-cli/]'
  })
  ct.end()
})

t.test('reports and omits an invalid bws response', ct => {
  const resolveBitwardenSecrets = proxyquire('../../../src/lib/helpers/resolveBitwardenSecrets', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => JSON.stringify({ id: 'secret-id' })
    }
  })

  const parsed = { API_KEY: 'bws://secret-id', PLAIN: 'value' }
  const result = resolveBitwardenSecrets.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.equal(result.errors[0].code, 'BITWARDEN_FAILED')
  ct.end()
})
