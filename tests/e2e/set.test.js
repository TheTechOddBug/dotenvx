const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { which } = require('@dotenvx/tooling')
const { execSync } = require('child_process')

let tempDir = ''
const osTempDir = fs.realpathSync(os.tmpdir())
const originalDir = process.cwd()

const node = path.resolve(which.sync('node'))
const dotenvx = `${node} ${path.join(originalDir, 'src/cli/dotenvx.js')}`

function stripArmorStatus (output) {
  return output
    .split('\n')
    .filter(line => !line.match(/^\[dotenvx@.+\] ⛨ (armor): (on|off)$/))
    .join('\n')
}

function execShell (commands) {
  const output = execSync(commands, {
    encoding: 'utf8',
    shell: true
  }).trim()

  return stripArmorStatus(output)
}

function execShellFailure (commands) {
  try {
    execShell(commands)
  } catch (error) {
    return {
      status: error.status,
      stdout: stripArmorStatus(error.stdout.toString().trim()),
      stderr: error.stderr.toString()
    }
  }
}

t.beforeEach((ct) => {
  process.env = {}
  process.env.DOTENVX_NO_ARMOR = 'true'

  tempDir = fs.mkdtempSync(path.join(osTempDir, 'dotenvx-test-'))
  process.chdir(tempDir)
})

t.afterEach((ct) => {
  process.chdir(originalDir)
})

t.test('#set - multiple env keys files updates existing encrypted env file', ct => {
  execShell(`
    echo "HELLO=local" > .env.local
    echo "HI=production" > .env.production
  `)

  execShell(`${dotenvx} encrypt -f .env.local -fk .env.local.keys`)
  execShell(`${dotenvx} encrypt -f .env.production -fk .env.production.keys`)

  const output = execShell(`${dotenvx} set HELLO updated -f .env.local -fk .env.production.keys -fk .env.local.keys`)

  ct.equal(output, '◈ encrypted HELLO (.env.local)')
  ct.equal(execShell(`${dotenvx} get HELLO -f .env.local -fk .env.production.keys -fk .env.local.keys`), 'updated')

  ct.end()
})

t.test('#set - multiple env keys files errors when creating a private key', ct => {
  const result = execShellFailure(`${dotenvx} set HELLO World -f .env -fk .env.local.keys -fk .env.production.keys`)

  ct.equal(result.status, 1)
  ct.equal(result.stdout, '')
  ct.match(result.stderr, /\[MULTIPLE_ENV_KEYS_FILES\] cannot create a new private key with multiple -fk values/)
  ct.notOk(fs.existsSync(path.join(tempDir, '.env')), 'does not write env file')
  ct.notOk(fs.existsSync(path.join(tempDir, '.env.local.keys')), 'does not write first env keys file')
  ct.notOk(fs.existsSync(path.join(tempDir, '.env.production.keys')), 'does not write second env keys file')

  ct.end()
})
