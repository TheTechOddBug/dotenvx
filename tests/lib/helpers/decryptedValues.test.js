const t = require('tap')

const decryptedValues = require('../../../src/lib/helpers/decryptedValues')

t.test('decryptedValues returns only successfully decrypted injected values', ct => {
  const values = decryptedValues([
    {
      src: 'SECRET=encrypted:abc\nPUBLIC=hello',
      injected: { SECRET: 'super-secret', PUBLIC: 'hello' }
    },
    {
      string: 'EXISTING=encrypted:def',
      injected: {},
      existed: { EXISTING: 'external-value' }
    },
    {
      src: 'UNRESOLVED=encrypted:ghi',
      injected: { UNRESOLVED: 'encrypted:ghi' }
    }
  ])

  ct.same(values, ['super-secret'])
  ct.end()
})
