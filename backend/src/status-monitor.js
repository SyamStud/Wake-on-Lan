const DEFAULT_INTERVAL_MS = 60 * 1000

export function startStatusMonitor({ store, actions, log, intervalMs = DEFAULT_INTERVAL_MS }) {
  const lastState = new Map()

  async function tick() {
    const devices = store.list()
    const results = await Promise.all(devices.map(async (device) => {
      let online = false
      try {
        online = await actions.status(device)
      } catch {}
      store.recordStatus(device.id, online)
      const prev = lastState.get(device.id)
      if (prev !== undefined && prev !== online) {
        log(online ? 'status_online' : 'status_offline', {
          deviceId: device.id,
          deviceName: device.name,
        })
      }
      lastState.set(device.id, online)
      return { device, online }
    }))
    return results
  }

  tick().catch((err) => console.error('[status] error:', err.message))
  const timer = setInterval(() => {
    tick().catch((err) => console.error('[status] error:', err.message))
  }, intervalMs)
  console.log(`[status] Monitor berjalan (cek tiap ${intervalMs / 1000}s)`)

  return { stop: () => clearInterval(timer), tick }
}
