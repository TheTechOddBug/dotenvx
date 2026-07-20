const t = require('tap')
const proxyquire = require('proxyquire')

t.test('resolves op:// values asynchronously', async ct => {
  const calls = []
  const statuses = []
  const resolveOnePassword = proxyquire('../../../src/lib/helpers/resolveOnePassword', {
    child_process: {
      execFile: (command, args, options, callback) => {
        calls.push([command, args, options])
        callback(null, 'super-secret', '')
      },
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = {
    SECRET: 'op://vault/item/password',
    SECOND_SECRET: 'op://vault/second/password',
    PLAIN: 'value'
  }

  const result = await resolveOnePassword(parsed, { onStatus: status => statuses.push(status) })

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.SECOND_SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.same(calls[0][0], 'op')
  ct.same(calls[0][1], ['read', 'op://vault/item/password', '--no-newline'])
  ct.same(calls[1][1], ['read', 'op://vault/second/password', '--no-newline'])
  ct.same(statuses, ['awaiting 1password', 'injecting'])
  ct.same(result, { errors: [], unresolved: [] })
})

t.test('resolves op:// values synchronously without a shell', ct => {
  const calls = []
  const resolveOnePassword = proxyquire('../../../src/lib/helpers/resolveOnePassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: (command, args, options) => {
        calls.push([command, args, options])
        return 'super-secret'
      }
    }
  })
  const parsed = { SECRET: 'op://vault/item/password; echo unsafe', PLAIN: 'value' }

  const result = resolveOnePassword.sync(parsed)

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.same(calls[0][0], 'op')
  ct.same(calls[0][1], ['read', 'op://vault/item/password; echo unsafe', '--no-newline'])
  ct.same(result, { errors: [], unresolved: [] })
  ct.end()
})

t.test('reports and omits a missing op CLI without exposing the reference', ct => {
  const resolveOnePassword = proxyquire('../../../src/lib/helpers/resolveOnePassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => {
        const error = new Error('spawn op ENOENT op://private/reference')
        error.code = 'ENOENT'
        throw error
      }
    }
  })

  const parsed = { DATABASE_PASSWORD: 'op://private/reference', PLAIN: 'value' }
  const result = resolveOnePassword.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.same(result.unresolved, ['DATABASE_PASSWORD'])
  ct.match(result.errors[0], {
    code: '1PASSWORD_FAILED',
    message: '[1PASSWORD_FAILED] 1Password CLI is not installed and could not resolve DATABASE_PASSWORD',
    help: 'fix: [https://www.1password.dev/cli/get-started]'
  })
  ct.end()
})
