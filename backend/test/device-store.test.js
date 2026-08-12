import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../src/db.js'
import { createDeviceStore, ValidationError, NotFoundError } from '../src/device-store.js'

function makeStore() {
  return createDeviceStore(openDatabase(':memory:'))
}

function validDevice(overrides = {}) {
  return {
    name: 'PC Kamar',
    mac: 'aa:bb:cc:dd:ee:ff',
    broadcast: '192.168.1.255',
    wol_port: 9,
    ssh_host: '192.168.1.50',
    ssh_port: 22,
    ssh_user: 'user',
    ssh_auth: 'password',
    ssh_password: 'rahasia',
    ...overrides,
  }
}

test('create menormalkan data: trim nama, MAC huruf besar', () => {
  const store = makeStore()
  const device = store.create(validDevice({ name: '  PC Kamar  ', mac: 'aa-bb-cc-dd-ee-ff' }))
  assert.equal(device.name, 'PC Kamar')
  assert.equal(device.mac, 'AA:BB:CC:DD:EE:FF')
  assert.equal(device.broadcast, '192.168.1.255')
  assert.equal(device.wol_port, 9)
  assert.equal(device.ssh_port, 22)
})

test('create menolak MAC tidak valid', () => {
  const store = makeStore()
  assert.throws(() => store.create(validDevice({ mac: 'invalid' })), ValidationError)
  assert.throws(() => store.create(validDevice({ mac: '' })), ValidationError)
})

test('create menolak nama kosong dan broadcast kosong', () => {
  const store = makeStore()
  assert.throws(() => store.create(validDevice({ name: ' ' })), ValidationError)
  assert.throws(() => store.create(validDevice({ broadcast: '' })), ValidationError)
})

test('create menolak MAC duplikat (tidak peduli format/tanda)', () => {
  const store = makeStore()
  store.create(validDevice())
  assert.throws(() => store.create(validDevice({ name: 'PC Lain', mac: 'AA:BB:CC:DD:EE:FF' })), ValidationError)
})

test('create menolak port di luar rentang', () => {
  const store = makeStore()
  assert.throws(() => store.create(validDevice({ wol_port: 0 })), ValidationError)
  assert.throws(() => store.create(validDevice({ ssh_port: 70000 })), ValidationError)
})

test('create menolak jadwal tidak valid', () => {
  const store = makeStore()
  assert.throws(() => store.create(validDevice({ schedule_enabled: 1, schedule_on: '25:00', schedule_off: '22:00' })), ValidationError)
})

test('update mempertahankan ssh_password lama saat tidak diisi lagi', () => {
  const store = makeStore()
  const created = store.create(
    validDevice({ schedule_enabled: 1, schedule_on: '06:00', schedule_off: '22:00' }),
  )
  const updated = store.update(
    created.id,
    validDevice({ name: 'PC Rename', ssh_password: '', schedule_enabled: 1, schedule_on: '06:00', schedule_off: '22:00' }),
  )
  assert.equal(updated.name, 'PC Rename')
  const full = store.listScheduled().find((d) => d.id === created.id)
  assert.equal(full.ssh_password, 'rahasia')
})

test('list dan getById tidak membocorkan ssh_password', () => {
  const store = makeStore()
  const created = store.create(validDevice({ schedule_enabled: 1, schedule_on: '06:00', schedule_off: '22:00' }))
  for (const row of store.list()) {
    assert.equal('ssh_password' in row, false)
  }
  assert.equal('ssh_password' in store.getById(created.id), false)
  assert.equal(store.getById(created.id).name, 'PC Kamar')
})

test('create menolak broadcast yang bukan IPv4 valid', () => {
  const store = makeStore()
  assert.throws(() => store.create(validDevice({ broadcast: '999.999.999.999' })), ValidationError)
  assert.throws(() => store.create(validDevice({ broadcast: 'bukan-ip' })), ValidationError)
  assert.throws(() => store.create(validDevice({ broadcast: '192.168.1' })), ValidationError)
  assert.throws(() => store.create(validDevice({ broadcast: '256.1.1.1' })), ValidationError)
})

test('update menolak MAC yang dipakai device lain', () => {
  const store = makeStore()
  const a = store.create(validDevice({ name: 'A', mac: 'AA:BB:CC:DD:EE:01' }))
  store.create(validDevice({ name: 'B', mac: 'AA:BB:CC:DD:EE:02' }))
  assert.throws(() => store.update(a.id, validDevice({ mac: 'AA:BB:CC:DD:EE:02' })), ValidationError)
})

test('update/remove device yang tidak ada melempar NotFoundError', () => {
  const store = makeStore()
  assert.throws(() => store.update(999, validDevice()), NotFoundError)
  assert.throws(() => store.remove(999), NotFoundError)
})

test('remove menghapus device', () => {
  const store = makeStore()
  const device = store.create(validDevice())
  assert.equal(store.remove(device.id), true)
  assert.equal(store.getById(device.id), null)
})

test('listScheduled hanya mengembalikan device dengan jadwal aktif', () => {
  const store = makeStore()
  store.create(validDevice({ name: 'Tanpa Jadwal', schedule_enabled: 0 }))
  store.create(validDevice({ name: 'Dijadwalkan', mac: 'AA:BB:CC:DD:EE:0A', schedule_enabled: 1, schedule_on: '06:00', schedule_off: '22:00' }))
  const scheduled = store.listScheduled()
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].name, 'Dijadwalkan')
})

test('wake count bertambah lewat incWakeCount', () => {
  const store = makeStore()
  assert.equal(store.getWakeCount(), 0)
  store.incWakeCount()
  store.incWakeCount()
  store.incWakeCount()
  assert.equal(store.getWakeCount(), 3)
})

test('scan cache roundtrip', () => {
  const store = makeStore()
  assert.equal(store.getScanCache(), null)
  store.saveScanCache([{ ip: '192.168.1.5', mac: null, hostname: null }], '192.168.1.0/24', '192.168.1.255')
  const cache = store.getScanCache()
  assert.equal(cache.subnet, '192.168.1.0/24')
  assert.equal(cache.broadcast, '192.168.1.255')
  assert.equal(cache.found.length, 1)
})

test('getByIdFull mengembalikan baris lengkap termasuk ssh_password', () => {
  const store = makeStore()
  const created = store.create(validDevice())
  assert.equal(store.getByIdFull(created.id).ssh_password, 'rahasia')
  assert.equal(store.getByIdFull(created.id).name, 'PC Kamar')
  assert.equal(store.getByIdFull(999), null)
})

test('getById mengembalikan null untuk id yang tidak ada', () => {
  const store = makeStore()
  assert.equal(store.getById(42), null)
})
