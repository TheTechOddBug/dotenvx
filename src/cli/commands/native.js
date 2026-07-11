function configureNativeCommand (native) {
  native
    .description('move private keys into your OS secret store (macOS and Windows supported)')
    .action(function () {
      this.help()
    })

  native
    .command('up')
    .description('store key in OS secret store')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(function (...args) {
      return require('./../actions/keychain/up').apply(this, args)
    })

  native
    .command('down')
    .description('move key from OS secret store to .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(function (...args) {
      return require('./../actions/keychain/down').apply(this, args)
    })

  native
    .command('push')
    .description('push key to OS secret store from .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(function (...args) {
      return require('./../actions/keychain/push').apply(this, args)
    })

  native
    .command('pull')
    .description('pull key from OS secret store into .env.keys')
    .option('-f, --env-file <path>', 'path to your env file')
    .option('-fk, --env-keys-file <path>', 'path to your .env.keys file', '.env.keys')
    .action(function (...args) {
      return require('./../actions/keychain/pull').apply(this, args)
    })

  return native
}

module.exports = configureNativeCommand
