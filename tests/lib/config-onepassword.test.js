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
