import test from 'node:test'
import assert from 'node:assert/strict'
import { createActions } from '../src/actions.js'

const device = {
  id: 1,
  name: 'PC Kamar',
  mac: 'AA:BB:CC:DD:EE:FF',
  broadcast: '192.168.1.255',
  wol_port: 9,
  ssh_host: '192.168.1.50',
  ssh_port: 22,
  ssh_user: 'user',
}

function makeActions(overrides = {}) {
  const store = {
    incWakeCount: () => {},
    ...overrides.store,
  }
  return createActions({ store, ...overrides })
}

test('wake mengirim magic packet dengan field device dan menambah wake count', async () => {
  let sent = null
  let count = 0
  const actions = makeActions({
    store: { incWakeCount: () => count++ },
    send: async (mac, broadcast, port) => {
      sent = { mac, broadcast, port }
      return { sent: 3, mac, broadcast, port }
    },
  })
  const result = await actions.wake(device)
  assert.deepEqual(sent, { mac: 'AA:BB:CC:DD:EE:FF', broadcast: '192.168.1.255', port: 9 })
  assert.equal(result.sent, 3)
  assert.equal(count, 1)
})

test('wake meneruskan error pengiriman dan tidak menambah count', async () => {
  let count = 0
  const actions = makeActions({
    store: { incWakeCount: () => count++ },
    send: async () => {
      throw new Error('broadcast gagal')
    },
  })
  await assert.rejects(() => actions.wake(device), /broadcast gagal/)
  assert.equal(count, 0)
})

test('shutdown menolak device tanpa konfigurasi SSH', async () => {
  const actions = makeActions()
  await assert.rejects(() => actions.shutdown({ ...device, ssh_host: null, ssh_user: null }), /SSH/)
  await assert.rejects(() => actions.shutdown({ ...device, ssh_host: '192.168.1.50', ssh_user: null }), /SSH/)
})

test('shutdown meneruskan device ke implementasi ssh', async () => {
  let received = null
  const actions = makeActions({
    shutdown: async (d) => {
      received = d
      return 'Perintah shutdown terkirim'
    },
  })
  const message = await actions.shutdown(device)
  assert.equal(message, 'Perintah shutdown terkirim')
  assert.equal(received, device)
})

test('shutdown meneruskan error dari implementasi ssh', async () => {
  const actions = makeActions({
    shutdown: async () => {
      throw new Error('gagal konek')
    },
  })
  await assert.rejects(() => actions.shutdown(device), /gagal konek/)
})

test('status memakai probe dengan host dan port device', async () => {
  let probed = null
  const actions = makeActions({
    probe: async (host, port) => {
      probed = { host, port }
      return true
    },
  })
  assert.equal(await actions.status(device), true)
  assert.deepEqual(probed, { host: '192.168.1.50', port: 22 })
})
