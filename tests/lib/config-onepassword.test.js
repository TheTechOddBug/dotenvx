const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenvx = require('../../src/lib/main')

t.test('config resolves op:// values through the 1Password CLI', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-onepassword-'))
  const envFile = path.join(dir, '.env')
  const op = path.join(dir, process.platform === 'win32' ? 'op.cmd' : 'op')
  const originalPath = process.env.PATH

  fs.writeFileSync(envFile, 'SECRET=op://vault/item/password\nPLAIN=value\n')
  fs.writeFileSync(op, process.platform === 'win32'
    ? '@echo off\r\n<nul set /p =super-secret\r\n'
    : '#!/bin/sh\nprintf super-secret\n')
  fs.chmodSync(op, 0o755)
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

t.test('config leaves op:// values unresolved with no1Password', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-onepassword-'))
  const envFile = path.join(dir, '.env')
  const processEnv = {}

  fs.writeFileSync(envFile, 'SECRET=op://vault/item/password\n')

  try {
    const result = dotenvx.config({
      path: envFile,
      processEnv,
      quiet: true,
      strict: true,
      no1Password: true
    })

    ct.equal(result.parsed.SECRET, 'op://vault/item/password')
    ct.equal(processEnv.SECRET, 'op://vault/item/password')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})

t.test('config reports a failed op:// value and still loads the rest of the file', ct => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotenvx-onepassword-'))
  const envFile = path.join(dir, '.env')
  const op = path.join(dir, process.platform === 'win32' ? 'op.cmd' : 'op')
  const originalPath = process.env.PATH

  fs.writeFileSync(envFile, 'API_KEY=op://vault/missing/password\nPLAIN=value\n')
  fs.writeFileSync(op, process.platform === 'win32'
    ? '@echo off\r\nexit /b 1\r\n'
    : '#!/bin/sh\nexit 1\n')
  fs.chmodSync(op, 0o755)
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`

  try {
    const processEnv = {}
    const result = dotenvx.config({ path: envFile, processEnv, quiet: true })

    ct.equal(result.parsed.PLAIN, 'value')
    ct.notOk(result.parsed.API_KEY)
    ct.equal(processEnv.PLAIN, 'value')
    ct.notOk(processEnv.API_KEY)
    ct.equal(result.error.code, '1PASSWORD_FAILED')
  } finally {
    process.env.PATH = originalPath
    fs.rmSync(dir, { recursive: true, force: true })
  }
  ct.end()
})
