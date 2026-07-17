const t = require('tap')
const proxyquire = require('proxyquire')

t.test('resolves op:// values asynchronously', async ct => {
  const calls = []
  const resolveOnePassword = proxyquire('../../../src/lib/helpers/resolveOnePassword', {
    child_process: {
      execFile: (command, args, options, callback) => {
        calls.push([command, args, options])
        callback(null, 'super-secret', '')
      },
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = { SECRET: 'op://vault/item/password', PLAIN: 'value' }

  await resolveOnePassword(parsed)

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.same(calls[0][0], 'op')
  ct.same(calls[0][1], ['read', 'op://vault/item/password', '--no-newline'])
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

  resolveOnePassword.sync(parsed)

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.same(calls[0][0], 'op')
  ct.same(calls[0][1], ['read', 'op://vault/item/password; echo unsafe', '--no-newline'])
  ct.end()
})

t.test('reports a missing op CLI without exposing the reference', ct => {
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

  ct.throws(() => resolveOnePassword.sync({ DATABASE_PASSWORD: 'op://private/reference' }), {
    code: 'ONEPASSWORD_RESOLUTION_FAILED',
    message: 'could not resolve DATABASE_PASSWORD: 1Password CLI (op) not found'
  })
  ct.end()
})
