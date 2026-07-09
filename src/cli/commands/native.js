function configureNativeCommand (native) {
  native
    .description('move private keys into your OS secret store (macOS Keychain supported)')
    .action(function () {
      this.help()
    })

  const upAction = require('./../actions/keychain/up')
  native
    .command('up')
    .description('store key in OS secret store')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(upAction)

  const downAction = require('./../actions/keychain/down')
  native
    .command('down')
    .description('move key from OS secret store to .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(downAction)

  const pushAction = require('./../actions/keychain/push')
  native
    .command('push')
    .description('push key to OS secret store from .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(pushAction)

  const pullAction = require('./../actions/keychain/pull')
  native
    .command('pull')
    .description('pull key from OS secret store into .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(pullAction)

  return native
}

module.exports = configureNativeCommand
