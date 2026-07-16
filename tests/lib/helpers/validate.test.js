const t = require('tap')

const validate = require('../../../src/lib/helpers/validate')

t.test('validate accepts an empty example', t => {
  t.same(validate({}, {}), {
    valid: true,
    errors: []
  })
  t.end()
})

t.test('validate accepts required keys that exist', t => {
  t.same(validate({ HELLO: '' }, { HELLO: 'World' }), {
    valid: true,
    errors: []
  })
  t.end()
})

t.test('validate rejects required keys with empty values', t => {
  t.same(validate({ HELLO: '' }, { HELLO: '' }), {
    valid: false,
    errors: [{
      code: 'MISSING_REQUIRED',
      keys: ['HELLO'],
      message: 'missing required (HELLO)'
    }]
  })
  t.end()
})

t.test('validate rejects required keys with whitespace-only values', t => {
  t.same(validate({ HELLO: '' }, { HELLO: ' \t' }), {
    valid: false,
    errors: [{
      code: 'MISSING_REQUIRED',
      keys: ['HELLO'],
      message: 'missing required (HELLO)'
    }]
  })
  t.end()
})

t.test('validate collects all missing required keys', t => {
  t.same(validate({ HELLO: '', DATABASE_URL: '', API_KEY: '' }, { HELLO: 'World' }), {
    valid: false,
    errors: [
      {
        code: 'MISSING_REQUIRED',
        keys: ['DATABASE_URL', 'API_KEY'],
        message: 'missing required (DATABASE_URL, API_KEY)'
      }
    ]
  })
  t.end()
})

t.test('validate accepts keys marked optional by an inline comment', t => {
  const example = {
    REQUIRED: '',
    OPTIONAL_EMPTY: '',
    OPTIONAL_VALUE: 'fallback',
    OPTIONAL_UPPERCASE: ''
  }
  const comments = {
    REQUIRED: [undefined],
    OPTIONAL_EMPTY: ['optional'],
    OPTIONAL_VALUE: ['this is optional here'],
    OPTIONAL_UPPERCASE: ['OPTIONAL']
  }

  t.same(validate(example, {}, { comments }), {
    valid: false,
    errors: [{
      code: 'MISSING_REQUIRED',
      keys: ['REQUIRED'],
      message: 'missing required (REQUIRED)'
    }]
  })
  t.end()
})

t.test('validate accepts a key if any duplicate occurrence is optional', t => {
  const example = { OPTIONAL: ['', ''] }
  const comments = { OPTIONAL: [undefined, 'optional'] }

  t.same(validate(example, {}, { comments }), {
    valid: true,
    errors: []
  })
  t.end()
})
