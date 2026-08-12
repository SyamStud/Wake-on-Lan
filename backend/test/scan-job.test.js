import test from 'node:test'
import assert from 'node:assert/strict'
import { ScanJob, createScanRegistry, rangeHosts, computeBroadcast, prefixFromMask, isPrivate } from '../src/scan-job.js'

test('prefixFromMask menghitung prefix dari netmask', () => {
  assert.equal(prefixFromMask('255.255.255.0'), 24)
  assert.equal(prefixFromMask('255.255.0.0'), 16)
  assert.equal(prefixFromMask('255.255.255.128'), 25)
})

test('isPrivate mengenali rentang private', () => {
  assert.equal(isPrivate('10.0.0.5'), true)
  assert.equal(isPrivate('172.16.0.5'), true)
  assert.equal(isPrivate('172.31.255.5'), true)
  assert.equal(isPrivate('172.32.0.5'), false)
  assert.equal(isPrivate('192.168.1.5'), true)
  assert.equal(isPrivate('8.8.8.8'), false)
})

test('rangeHosts /24 menghasilkan 254 host', () => {
  const ips = rangeHosts('192.168.1.5', 24)
  assert.equal(ips.length, 254)
  assert.equal(ips[0], '192.168.1.1')
  assert.equal(ips[253], '192.168.1.254')
})

test('rangeHosts /30 menghasilkan 2 host', () => {
  assert.deepEqual(rangeHosts('192.168.1.1', 30), ['192.168.1.1', '192.168.1.2'])
})

test('rangeHosts menolak subnet terlalu besar', () => {
  assert.throws(() => rangeHosts('10.0.0.1', 8), /terlalu besar/)
})

test('computeBroadcast menghitung alamat broadcast', () => {
  assert.equal(computeBroadcast('192.168.1.5', 24), '192.168.1.255')
  assert.equal(computeBroadcast('192.168.1.5', 25), '192.168.1.127')
  assert.equal(computeBroadcast('10.0.0.1', 8), '10.255.255.255')
})

function liveProbe(liveIps) {
  return async (ip) => liveIps.includes(ip)
}

test('ScanJob menyelesaikan scan: state done, hasil lengkap, cache tersimpan', async () => {
  const saved = []
  const range = {
    address: '192.168.1.1',
    prefix: 24,
    broadcast: '192.168.1.255',
    ips: rangeHosts('192.168.1.1', 30),
  }
  const job = new ScanJob(range, {
    id: 'scan-test',
    probe: liveProbe(['192.168.1.1', '192.168.1.2']),
    arpReader: () => ({ '192.168.1.2': 'aa:bb:cc:dd:ee:ff' }),
    resolveHostname: async (ip) => (ip === '192.168.1.2' ? 'pc-kamar' : null),
    saveCache: (found, subnet, broadcast) => saved.push({ found, subnet, broadcast }),
  })
  await job.start()

  assert.equal(job.state, 'done')
  assert.equal(job.scanned, 2)
  assert.deepEqual(job.found, [
    { ip: '192.168.1.1', mac: null, hostname: null },
    { ip: '192.168.1.2', mac: 'aa:bb:cc:dd:ee:ff', hostname: 'pc-kamar' },
  ])
  assert.equal(saved.length, 1)
  assert.equal(saved[0].subnet, '192.168.1.1/24')
  assert.equal(saved[0].broadcast, '192.168.1.255')
})

test('ScanJob yang di-abort tidak menyimpan cache dan berstate aborted', async () => {
  let saved = false
  const job = new ScanJob(
    { address: '192.168.1.1', prefix: 24, broadcast: '192.168.1.255', ips: rangeHosts('192.168.1.1', 30) },
    {
      probe: liveProbe([]),
      saveCache: () => {
        saved = true
      },
    }
  )
  job.abort()
  await job.start()

  assert.equal(job.state, 'aborted')
  assert.equal(job.aborted, true)
  assert.equal(saved, false)
})

test('ScanJob start hanya sekali; start kedua diabaikan', async () => {
  const job = new ScanJob(
    { address: '192.168.1.1', prefix: 24, broadcast: '192.168.1.255', ips: rangeHosts('192.168.1.1', 30) },
    { probe: liveProbe([]) }
  )
  await job.start()
  await job.start()
  assert.equal(job.state, 'done')
})

test('registry membuat dan menyimpan job dengan id unik', async () => {
  const registry = createScanRegistry({ probe: liveProbe([]) })
  const range = { address: '192.168.1.1', prefix: 24, broadcast: '192.168.1.255', ips: rangeHosts('192.168.1.1', 30) }
  const job = registry.start(range)
  assert.match(job.id, /^scan-\d+$/)
  assert.equal(registry.get(job.id), job)
  assert.equal(registry.get('scan-999'), null)
})

test('isRunning benar selama probing/enriching', async () => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  const job = new ScanJob(
    { address: '192.168.1.1', prefix: 24, broadcast: '192.168.1.255', ips: rangeHosts('192.168.1.1', 30) },
    {
      probe: async () => {
        await gate
        return false
      },
    }
  )
  const started = job.start()
  assert.equal(job.state, 'running')
  assert.equal(job.isRunning(), true)
  release()
  await started
  assert.equal(job.state, 'done')
  assert.equal(job.isRunning(), false)
})
