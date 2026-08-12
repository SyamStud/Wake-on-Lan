import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../src/db.js'
import { createActivityLog } from '../src/activity.js'
import { createDeviceStore } from '../src/device-store.js'
import { startStatusMonitor } from '../src/status-monitor.js'

test('activity log: log, list (terbaru dulu), count', () => {
  const db = openDatabase(':memory:')
  const activity = createActivityLog(db)
  activity.log('wake', { deviceId: 1, deviceName: 'PC A', detail: 'AA:BB via 192.168.1.255:9' })
  activity.log('login', { detail: 'IP 127.0.0.1' })
  activity.log('status_offline', { deviceId: 1, deviceName: 'PC A' })

  assert.equal(activity.count(), 3)
  const items = activity.list({ limit: 10, offset: 0 })
  assert.equal(items.length, 3)
  assert.equal(items[0].type, 'status_offline', 'urutan terbaru dulu')
  assert.equal(items[2].type, 'wake')
  assert.equal(items[0].device_name, 'PC A')
})

test('activity log: cleanup menghapus baris lama', () => {
  const db = openDatabase(':memory:')
  const activity = createActivityLog(db, 30)
  db.prepare(`INSERT INTO activity_log (type, ts) VALUES ('login', datetime('now', '-31 days'))`).run()
  db.prepare(`INSERT INTO activity_log (type, ts) VALUES ('login', datetime('now', '-1 days'))`).run()
  activity.cleanup()
  assert.equal(activity.count(), 1)
})

test('status history: recordStatus + getStatusHistory 24 jam', () => {
  const db = openDatabase(':memory:')
  const store = createDeviceStore(db)
  store.recordStatus(1, true)
  store.recordStatus(1, false)
  const samples = store.getStatusHistory(1, 24)
  assert.equal(samples.length, 2)
  assert.equal(samples[0].online, true)
  assert.equal(samples[1].online, false)
  assert.equal(store.getStatusHistory(999, 24).length, 0)
})

test('status history: agregasi per jam untuk rentang panjang', () => {
  const db = openDatabase(':memory:')
  const store = createDeviceStore(db)
  const insert = db.prepare(`INSERT INTO status_history (device_id, online, ts) VALUES (1, ?, datetime('now', ?))`)
  for (let i = 0; i < 3100; i++) {
    insert.run(i % 2, `-${i} minutes`)
  }
  const aggregated = store.getStatusHistory(1, 24 * 30)
  assert.ok(aggregated.length > 0, 'rentang panjang diagregasi')
  assert.ok('online_pct' in aggregated[0])
  assert.ok(aggregated.length < 3100, 'jumlah titik berkurang')
})

test('status monitor: merekam status dan log perubahan', async (t) => {
  const db = openDatabase(':memory:')
  const store = createDeviceStore(db)
  const device = store.create({
    name: 'PC Monitor',
    mac: 'AA:BB:CC:DD:EE:FF',
    broadcast: '192.168.1.255',
    ssh_host: '192.168.1.50',
    ssh_user: 'user',
    ssh_auth: 'password',
    ssh_password: 'x',
  })
  const events = []
  let state = false
  const monitor = startStatusMonitor({
    store,
    actions: { status: async () => state },
    log: (type, info) => events.push({ type, ...info }),
    intervalMs: 60 * 1000,
  })
  t.after(() => monitor.stop())

  await monitor.tick()
  await monitor.tick()
  assert.equal(events.length, 0, 'status stabil offline tidak menimbulkan event')

  state = true
  await monitor.tick()
  assert.deepEqual(events.map((e) => e.type), ['status_online'])

  await monitor.tick()
  assert.equal(events.length, 1, 'tidak ada event ganda saat status stabil')

  const samples = store.getStatusHistory(device.id, 24)
  assert.equal(samples.length, 5, 'initial tick + 4 tick manual direkam')
})
