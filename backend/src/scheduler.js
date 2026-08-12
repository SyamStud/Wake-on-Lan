const CHECK_INTERVAL_MS = 30 * 1000

function toMinutes(t) {
  if (!t || typeof t !== 'string') return null
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function inWindow(nowMin, onMin, offMin) {
  if (onMin === null || offMin === null) return false
  if (onMin === offMin) return false
  if (onMin < offMin) return nowMin >= onMin && nowMin < offMin
  return nowMin >= onMin || nowMin < offMin
}

export function startScheduler({ store, actions }) {
  const lastState = new Map()

  async function runOnce() {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const devices = store.listScheduled()

    for (const device of devices) {
      const onMin = toMinutes(device.schedule_on)
      const offMin = toMinutes(device.schedule_off)
      const desired = inWindow(nowMin, onMin, offMin)

      let prev = lastState.get(device.id)
      if (prev === undefined) {
        prev = desired
        lastState.set(device.id, prev)
        continue
      }

      if (desired === prev) continue

      lastState.set(device.id, desired)
      const stamp = now.toISOString()
      if (desired) {
        try {
          await actions.wake(device)
          console.log(`[jadwal] ${stamp} Nyalakan otomatis: ${device.name} (${device.mac})`)
        } catch (err) {
          console.error(`[jadwal] ${stamp} Gagal nyalakan ${device.name}: ${err.message}`)
        }
      } else {
        try {
          await actions.shutdown(device)
          console.log(`[jadwal] ${stamp} Matikan otomatis: ${device.name} (${device.ssh_user}@${device.ssh_host})`)
        } catch (err) {
          console.error(`[jadwal] ${stamp} Gagal matikan ${device.name}: ${err.message}`)
        }
      }
    }
  }

  runOnce().catch(() => {})
  const timer = setInterval(() => {
    runOnce().catch((err) => console.error('[jadwal] error:', err.message))
  }, CHECK_INTERVAL_MS)
  console.log(`[jadwal] Scheduler berjalan (cek tiap ${CHECK_INTERVAL_MS / 1000}s)`)

  return () => clearInterval(timer)
}
