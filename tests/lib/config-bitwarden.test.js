const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenvx = require('../../src/lib/main')

const ITEM_ID = '7ac9cae8-5067-4faf-b6ab-acfd00e2c328'

t.test('config resolves bw:// values through the Bitwarden Password Manager CLI', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const bw = path.join(dir, process.platform === 'win32' ? 'bw.cmd' : 'bw')
  const originalPath = process.env.PATH
  const originalSession = process.env.BW_SESSION

  fs.writeFileSync(envFile, `PASSWORD=bw://${ITEM_ID}/password\nPLAIN=value\n`)
  fs.writeFileSync(bw, process.platform === 'win32'
    ? '@echo off\r\necho super-secret\r\n'
    : '#!/bin/sh\nprintf \'super-secret\\n\'\n')
  fs.chmodSync(bw, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`
  process.env.BW_SESSION = 'test-session'

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true })

    ct.equal(result.parsed.PASSWORD, 'super-secret')
    ct.equal(processEnv.PASSWORD, 'super-secret')
    ct.equal(processEnv.PLAIN, 'value')
  } finally {
    process.env.PATH = originalPath
    if (originalSession === undefined) delete process.env.BW_SESSION
    else process.env.BW_SESSION = originalSession
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config preserves spaces in a quoted human-readable Bitwarden item name', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const bw = path.join(dir, process.platform === 'win32' ? 'bw.cmd' : 'bw')
  const originalPath = process.env.PATH
  const originalSession = process.env.BW_SESSION

  fs.writeFileSync(envFile, 'PASSWORD="bw://My GitHub Account/password"\n')
  fs.writeFileSync(bw, process.platform === 'win32'
    ? '@echo off\r\nif not "%~3"=="My GitHub Account" exit /b 1\r\necho super-secret\r\n'
    : '#!/bin/sh\n[ "$3" = "My GitHub Account" ] || exit 1\nprintf \'super-secret\\n\'\n')
  fs.chmodSync(bw, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`
  process.env.BW_SESSION = 'test-session'

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true })

    ct.equal(result.parsed.PASSWORD, 'super-secret')
    ct.equal(processEnv.PASSWORD, 'super-secret')
  } finally {
    process.env.PATH = originalPath
    if (originalSession === undefined) delete process.env.BW_SESSION
    else process.env.BW_SESSION = originalSession
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config leaves bw:// values unresolved with noBitwarden', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const processEnv = {}

  fs.writeFileSync(envFile, `PASSWORD=bw://${ITEM_ID}/password\n`)

  try {
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true, noBitwarden: true })

    ct.equal(result.parsed.PASSWORD, `bw://${ITEM_ID}/password`)
    ct.equal(processEnv.PASSWORD, `bw://${ITEM_ID}/password`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config leaves bw:// values unresolved with DOTENVX_NO_BITWARDEN', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const processEnv = {}
  const original = process.env.DOTENVX_NO_BITWARDEN

  fs.writeFileSync(envFile, `PASSWORD=bw://${ITEM_ID}/password\n`)
  process.env.DOTENVX_NO_BITWARDEN = 'true'

  try {
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true, strict: true })

    ct.equal(result.parsed.PASSWORD, `bw://${ITEM_ID}/password`)
    ct.equal(processEnv.PASSWORD, `bw://${ITEM_ID}/password`)
  } finally {
    if (original === undefined) delete process.env.DOTENVX_NO_BITWARDEN
    else process.env.DOTENVX_NO_BITWARDEN = original
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config reports a failed bw:// value and still loads the rest of the file', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-bitwarden-'))
  const envFile = path.join(dir, '.env')
  const bw = path.join(dir, process.platform === 'win32' ? 'bw.cmd' : 'bw')
  const originalPath = process.env.PATH
  const originalSession = process.env.BW_SESSION

  fs.writeFileSync(envFile, `API_KEY=bw://${ITEM_ID}/password\nPLAIN=value\n`)
  fs.writeFileSync(bw, process.platform === 'win32' ? '@echo off\r\nexit /b 1\r\n' : '#!/bin/sh\nexit 1\n')
  fs.chmodSync(bw, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`
  process.env.BW_SESSION = 'test-session'

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true })

    ct.equal(result.parsed.PLAIN, 'value')
    ct.equal(result.parsed.API_KEY, `bw://${ITEM_ID}/password`)
    ct.equal(processEnv.PLAIN, 'value')
    ct.equal(processEnv.API_KEY, `bw://${ITEM_ID}/password`)
    ct.equal(result.error.code, 'BITWARDEN_FAILED')
  } finally {
    process.env.PATH = originalPath
    if (originalSession === undefined) delete process.env.BW_SESSION
    else process.env.BW_SESSION = originalSession
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})
