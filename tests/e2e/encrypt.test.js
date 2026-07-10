const t = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { which } = require('@dotenvx/tooling')
const { dotenv } = require('@dotenvx/tooling')
const { execSync } = require('child_process')

let tempDir = ''
const osTempDir = fs.realpathSync(os.tmpdir())
const originalDir = process.cwd()

const node = path.resolve(which.sync('node')) // /opt/homebrew/node
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
  // important, clear process.env before each test
  process.env = {}
  process.env.DOTENVX_NO_ARMOR = 'true'

  tempDir = fs.mkdtempSync(path.join(osTempDir, 'dotenvx-test-'))

  // go to tempDir
  process.chdir(tempDir)
})

t.afterEach((ct) => {
  // cleanup
  process.chdir(originalDir)
})

t.test('#encrypt', ct => {
  execShell(`
    echo "HELLO=World" > .env
  `)

  const output = execShell(`${dotenvx} encrypt`)

  ct.equal(output, '◈ encrypted (.env)')

  ct.end()
})

t.test('#get - multiple env keys files', ct => {
  execShell(`
    echo "HELLO=World" > .env.local
    echo "HI=there" > .env.production
  `)

  const localOutput = execShell(`${dotenvx} encrypt -f .env.local -fk .env.local.keys`)
  const productionOutput = execShell(`${dotenvx} encrypt -f .env.production -fk .env.production.keys`)

  ct.equal(localOutput, '◈ encrypted (.env.local)')
  ct.equal(productionOutput, '◈ encrypted (.env.production)')
  ct.ok(fs.existsSync(path.join(tempDir, '.env.local.keys')), 'writes first env keys file')
  ct.ok(fs.existsSync(path.join(tempDir, '.env.production.keys')), 'writes second env keys file')
  ct.equal(execShell(`${dotenvx} get HELLO -f .env.local -fk .env.production.keys -f .env.production -fk .env.local.keys`), 'World')
  ct.equal(execShell(`${dotenvx} get HI -f .env.local -fk .env.production.keys -f .env.production -fk .env.local.keys`), 'there')

  ct.end()
})

t.test('#encrypt - multiple env keys files with existing public key', ct => {
  execShell(`
    echo "HELLO=World" > .env.local
  `)

  ct.equal(execShell(`${dotenvx} encrypt -f .env.local -fk .env.local.keys`), '◈ encrypted (.env.local)')

  fs.appendFileSync(path.join(tempDir, '.env.local'), '\nHI=there\n')

  ct.equal(execShell(`${dotenvx} encrypt -f .env.local -fk .env.production.keys -fk .env.local.keys`), '◈ encrypted (.env.local)')
  ct.equal(execShell(`${dotenvx} get HI -f .env.local -fk .env.production.keys -fk .env.local.keys`), 'there')

  ct.end()
})

t.test('#encrypt - multiple env keys files errors when creating a private key', ct => {
  execShell(`
    echo "HELLO=World" > .env
  `)

  const result = execShellFailure(`${dotenvx} encrypt -f .env -fk .env.local.keys -fk .env.production.keys`)

  ct.equal(result.status, 1)
  ct.equal(result.stdout, '')
  ct.match(result.stderr, /\[MULTIPLE_ENV_KEYS_FILES\] cannot create a new private key with multiple -fk values/)
  ct.notOk(fs.existsSync(path.join(tempDir, '.env.local.keys')), 'does not write first env keys file')
  ct.notOk(fs.existsSync(path.join(tempDir, '.env.production.keys')), 'does not write second env keys file')

  ct.end()
})

t.test('#encrypt -k', ct => {
  ct.plan(7)

  execShell(`
    echo "HELLO=World\nHI=thar" > .env
  `)

  const output = execShell(`${dotenvx} encrypt -k HI`)

  const parsedEnvKeys = dotenv.parse(fs.readFileSync(path.join(tempDir, '.env.keys')))
  const DOTENV_PRIVATE_KEY = parsedEnvKeys.DOTENV_PRIVATE_KEY

  ct.equal(output, '◈ encrypted (.env)')

  execShell('rm .env.keys')

  const helloResult = execShellFailure(`${dotenvx} get HELLO`)
  ct.equal(helloResult.status, 1, 'get exits when another key cannot be decrypted')
  ct.equal(helloResult.stdout, 'World') // unencrypted still
  ct.match(helloResult.stderr, /DECRYPTION_FAILED/)

  const hiResult = execShellFailure(`${dotenvx} get HI`)
  ct.equal(hiResult.status, 1, 'get exits when requested encrypted key cannot be decrypted')
  ct.match(hiResult.stdout, /^encrypted:/, 'HI should be encrypted')

  process.env.DOTENV_PRIVATE_KEY = DOTENV_PRIVATE_KEY
  ct.equal(execShell(`${dotenvx} get HI`), 'thar')

  ct.end()
})
