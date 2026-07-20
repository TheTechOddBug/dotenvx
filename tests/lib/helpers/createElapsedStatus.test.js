const t = require('tap')
const sinon = require('sinon')
const createElapsedStatus = require('../../../src/lib/helpers/createElapsedStatus')

t.test('reports elapsed seconds until stopped', ct => {
  const clock = sinon.useFakeTimers()
  const statuses = []

  try {
    const stop = createElapsedStatus(status => statuses.push(status), 'awaiting 1password')
    clock.tick(2500)
    stop()
    clock.tick(1000)

    ct.same(statuses, [
      'awaiting 1password',
      'awaiting 1password (1s)',
      'awaiting 1password (2s)'
    ])
  } finally {
    clock.restore()
  }

  ct.end()
})
