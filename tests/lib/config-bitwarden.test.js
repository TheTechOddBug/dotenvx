const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenvx = require('../../src/lib/main')

t.test('config resolves bws:// values through the Bitwarden Secrets Manager CLI', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const bws = path.join(dir, process.platform === 'win32' ? 'bws.cmd' : 'bws')
  const originalPath = process.env.PATH

  fs.writeFileSync(envFile, 'SECRET=bws://2863ced6-eba1-48b4-b5c0-afa30104877a\nPLAIN=value\n')
  fs.writeFileSync(bws, process.platform === 'win32'
    ? '@echo off\r\necho {"value":"super-secret"}\r\n'
    : '#!/bin/sh\nprintf \'{"value":"super-secret"}\'\n')
  fs.chmodSync(bws, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true })

    ct.equal(result.parsed.SECRET, 'super-secret')
    ct.equal(processEnv.SECRET, 'super-secret')
    ct.equal(processEnv.PLAIN, 'value')
  } finally {
    process.env.PATH = originalPath
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config leaves bws:// values unresolved with noBitwarden', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const processEnv = {}

  fs.writeFileSync(envFile, 'SECRET=bws://secret-id\n')

  try {
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true, noBitwarden: true })

    ct.equal(result.parsed.SECRET, 'bws://secret-id')
    ct.equal(processEnv.SECRET, 'bws://secret-id')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config reports a failed bws:// value and still loads the rest of the file', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const bws = path.join(dir, process.platform === 'win32' ? 'bws.cmd' : 'bws')
  const originalPath = process.env.PATH

  fs.writeFileSync(envFile, 'API_KEY=bws://missing-secret\nPLAIN=value\n')
  fs.writeFileSync(bws, process.platform === 'win32' ? '@echo off\r\nexit /b 1\r\n' : '#!/bin/sh\nexit 1\n')
  fs.chmodSync(bws, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true })

    ct.equal(result.parsed.PLAIN, 'value')
    ct.notOk(result.parsed.API_KEY)
    ct.equal(processEnv.PLAIN, 'value')
    ct.notOk(processEnv.API_KEY)
    ct.equal(result.error.code, 'BITWARDEN_FAILED')
  } finally {
    process.env.PATH = originalPath
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})
