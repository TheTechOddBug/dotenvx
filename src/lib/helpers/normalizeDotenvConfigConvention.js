function normalizeDotenvConfigConvention(
  /** @type {import('../main').DotenvConfigOptions} */ options
) {
  if (!options.convention && process.env.DOTENV_CONFIG_CONVENTION) {
    options.convention = process.env.DOTENV_CONFIG_CONVENTION
  }

  return options
}

module.exports = normalizeDotenvConfigConvention
