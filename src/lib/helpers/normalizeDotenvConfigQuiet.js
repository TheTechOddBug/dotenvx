function normalizeDotenvConfigQuiet(
  /** @type {import('../main').DotenvConfigOptions} */ options
) {
  if (process.env.DOTENV_CONFIG_QUIET === 'true') {
    options.quiet = true
  }

  return options
}

module.exports = normalizeDotenvConfigQuiet
