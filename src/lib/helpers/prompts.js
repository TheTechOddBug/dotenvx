const { Enquirer } = require('@dotenvx/tooling')

const enquirer = new Enquirer()

function choicesForSelect (choices) {
  return choices.map(choice => {
    if (typeof choice === 'string') return choice

    return {
      name: choice.value,
      message: choice.name || choice.value
    }
  })
}

function enquirerOptions (context = {}) {
  const options = {
    // Enquirer names the render stream stdout; use stderr so stdout stays machine-readable.
    stdout: context.output || process.stderr
  }

  if (context.input) {
    options.stdin = context.input
  }

  return options
}

function clearLastLine (stream) {
  if (stream && typeof stream.moveCursor === 'function' && typeof stream.clearLine === 'function') {
    stream.moveCursor(0, -1)
    stream.clearLine(0)
    return
  }

  if (stream && typeof stream.write === 'function') {
    stream.write('\x1B[1A\x1B[2K')
  }
}

async function select ({ message, choices }, context) {
  const answer = await enquirer.prompt({
    type: 'select',
    name: 'value',
    message,
    choices: choicesForSelect(choices),
    ...enquirerOptions(context)
  })

  return answer.value
}

async function password ({ message, prefix, separator }, context) {
  const input = (context && context.input) || process.stdin
  const output = (context && context.output) || process.stderr

  return new Promise((resolve, reject) => {
    let value = ''
    const wasRaw = input.isRaw === true

    const cleanup = () => {
      input.removeListener('data', onData)
      if (typeof input.setRawMode === 'function' && !wasRaw) input.setRawMode(false)
      if (typeof input.pause === 'function') input.pause()
    }

    const finish = (error) => {
      cleanup()
      output.write('\n')
      clearLastLine(output)

      if (error) return reject(error)
      resolve(value)
    }

    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004') {
          const error = new Error('prompt cancelled')
          error.code = 'PROMPT_CANCELLED'
          return finish(error)
        }

        if (character === '\r' || character === '\n') return finish()

        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('')
          continue
        }

        if (character >= ' ') value += character
      }
    }

    output.write(`${prefix} ${message} ${separator} `)
    if (typeof input.setRawMode === 'function' && !wasRaw) input.setRawMode(true)
    input.on('data', onData)
    if (typeof input.resume === 'function') input.resume()
  })
}

module.exports = {
  password,
  select
}
