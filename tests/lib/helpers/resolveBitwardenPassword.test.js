const t = require('tap')
const proxyquire = require('proxyquire')

const ITEM_ID = '7ac9cae8-5067-4faf-b6ab-acfd00e2c328'

t.beforeEach(ct => {
  ct.context.originalSession = process.env.BW_SESSION
  process.env.BW_SESSION = 'test-session'
})

t.afterEach(ct => {
  if (ct.context.originalSession === undefined) {
    delete process.env.BW_SESSION
  } else {
    process.env.BW_SESSION = ct.context.originalSession
  }
})

t.test('resolves supported bw:// values asynchronously', async ct => {
  const calls = []
  const statuses = []
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: (command, args, options, callback) => {
        calls.push([command, args, options])
        callback(null, 'super-secret\n', '')
      },
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = {
    SECRET: `bw://${ITEM_ID}/password`,
    SECOND_SECRET: `bw://${ITEM_ID}/username`,
    PLAIN: 'value'
  }

  const result = await resolveBitwardenPassword(parsed, { onStatus: status => statuses.push(status) })

  ct.equal(parsed.SECRET, 'super-secret')
  ct.equal(parsed.SECOND_SECRET, 'super-secret')
  ct.equal(parsed.PLAIN, 'value')
  ct.equal(calls[0][0], 'bw')
  ct.same(calls[0][1], ['get', 'password', ITEM_ID])
  ct.same(calls[1][1], ['get', 'username', ITEM_ID])
  ct.same(statuses, ['awaiting bitwarden', 'injecting'])
  ct.same(result, { errors: [], unresolved: [] })
})

t.test('reuses the session within one env row and unlocks again for the next row', async ct => {
  delete process.env.BW_SESSION
  const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  const stderrTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
  Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
  const calls = []
  const spinnerCalls = []
  const statuses = []
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    './prompts': {
      password: async () => {
        ct.notMatch(statuses[statuses.length - 1] || '', /^awaiting bitwarden/, 'does not update status while prompting')
        return 'master-password'
      },
      '@noCallThru': true
    },
    './createSpinner': {
      pause: () => spinnerCalls.push('pause'),
      resume: () => spinnerCalls.push('resume'),
      '@noCallThru': true
    },
    child_process: {
      execFile: (command, args, options, callback) => {
        calls.push([command, args, options])
        if (args[0] === 'unlock') return callback(null, 'request-session\n', '')
        callback(null, `${args[1]}-value\n`, '')
      },
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = {
    PASSWORD: `bw://${ITEM_ID}/password`,
    URI: `bw://${ITEM_ID}/uri`
  }

  try {
    const result = await resolveBitwardenPassword(parsed, { onStatus: status => statuses.push(status) })
    const nextParsed = { USERNAME: `bw://${ITEM_ID}/username` }
    const nextResult = await resolveBitwardenPassword(nextParsed, { onStatus: status => statuses.push(status) })

    ct.same(parsed, { PASSWORD: 'password-value', URI: 'uri-value' })
    ct.same(nextParsed, { USERNAME: 'username-value' })
    ct.same(calls.map(call => call[1]), [
      ['unlock', '--passwordenv', 'DOTENVX_BITWARDEN_PASSWORD', '--raw'],
      ['get', 'password', ITEM_ID],
      ['get', 'uri', ITEM_ID],
      ['unlock', '--passwordenv', 'DOTENVX_BITWARDEN_PASSWORD', '--raw'],
      ['get', 'username', ITEM_ID]
    ])
    ct.same(spinnerCalls, ['pause', 'resume', 'pause', 'resume'])
    ct.same(statuses, [
      'awaiting bitwarden',
      'injecting',
      'awaiting bitwarden',
      'injecting'
    ])
    ct.equal(calls[0][2].env.DOTENVX_BITWARDEN_PASSWORD, 'master-password')
    ct.equal(calls[1][2].env.BW_SESSION, 'request-session')
    ct.equal(calls[2][2].env.BW_SESSION, 'request-session')
    ct.notOk(process.env.BW_SESSION, 'does not export the session globally')
    ct.same(result, { errors: [], unresolved: [] })
    ct.same(nextResult, { errors: [], unresolved: [] })
  } finally {
    if (stdinTTY) Object.defineProperty(process.stdin, 'isTTY', stdinTTY)
    else delete process.stdin.isTTY
    if (stderrTTY) Object.defineProperty(process.stderr, 'isTTY', stderrTTY)
    else delete process.stderr.isTTY
  }
})

t.test('resolves username, password, and uri synchronously without a shell', ct => {
  const calls = []
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: (command, args, options) => {
        calls.push([command, args, options])
        return `${args[1]}-value\n`
      }
    }
  })
  const parsed = {
    USERNAME: `bw://${ITEM_ID}/username`,
    PASSWORD: `bw://${ITEM_ID}/password`,
    URI: `bw://${ITEM_ID}/uri`
  }

  const result = resolveBitwardenPassword.sync(parsed)

  ct.same(parsed, {
    USERNAME: 'username-value',
    PASSWORD: 'password-value',
    URI: 'uri-value'
  })
  ct.same(calls.map(call => call[1]), [
    ['get', 'username', ITEM_ID],
    ['get', 'password', ITEM_ID],
    ['get', 'uri', ITEM_ID]
  ])
  ct.same(result, { errors: [], unresolved: [] })
  ct.end()
})

t.test('rejects unsupported fields before calling bw', ct => {
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = { TOTP: `bw://${ITEM_ID}/totp`, PLAIN: 'value' }

  const result = resolveBitwardenPassword.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.match(result.errors[0], {
    code: 'BITWARDEN_FAILED',
    message: '[BITWARDEN_FAILED] unsupported Bitwarden Password Manager field totp for TOTP'
  })
  ct.end()
})

t.test('requires an exact item UUID before calling bw', ct => {
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = { PASSWORD: 'bw://GitHub/password', PLAIN: 'value' }

  const result = resolveBitwardenPassword.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.match(result.errors[0], {
    code: 'BITWARDEN_FAILED',
    message: '[BITWARDEN_FAILED] invalid Bitwarden Password Manager reference for PASSWORD'
  })
  ct.end()
})

t.test('reports and omits a missing bw CLI without exposing the reference', ct => {
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => {
        const error = new Error('spawn bw ENOENT private-reference')
        error.code = 'ENOENT'
        throw error
      }
    }
  })
  const parsed = { PASSWORD: `bw://${ITEM_ID}/password`, PLAIN: 'value' }

  const result = resolveBitwardenPassword.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.match(result.errors[0], {
    code: 'BITWARDEN_FAILED',
    message: '[BITWARDEN_FAILED] Bitwarden Password Manager CLI is not installed and could not resolve PASSWORD',
    help: 'fix: [https://bitwarden.com/help/cli/]'
  })
  ct.end()
})

t.test('fails immediately when BW_SESSION is missing instead of prompting', ct => {
  delete process.env.BW_SESSION
  const resolveBitwardenPassword = proxyquire('../../../src/lib/helpers/resolveBitwardenPassword', {
    child_process: {
      execFile: () => ct.fail('should not call execFile'),
      execFileSync: () => ct.fail('should not call execFileSync')
    }
  })
  const parsed = { API_KEY: `bw://${ITEM_ID}/password`, PLAIN: 'value' }

  const result = resolveBitwardenPassword.sync(parsed)

  ct.same(parsed, { PLAIN: 'value' })
  ct.match(result.errors[0], {
    code: 'BITWARDEN_FAILED',
    message: '[BITWARDEN_FAILED] Bitwarden Password Manager is locked and could not resolve API_KEY; run \'export BW_SESSION="$(bw unlock --raw)"\''
  })
  ct.end()
})
