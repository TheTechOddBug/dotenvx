function normalizeDotenvConfigIgnore(
  /** @type {import('../main').DotenvConfigOptions} */ options
) {
  if (process.env.DOTENV_CONFIG_IGNORE) {
    const ignoreVariables = (process.env.DOTENV_CONFIG_IGNORE).split(',');
    options.ignore ??= []; // Retain ignore from explicit arguments
    options.ignore.push(...ignoreVariables)
  }

  return options
}

module.exports = normalizeDotenvConfigIgnore
