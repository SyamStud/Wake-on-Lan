import { Router } from 'express'
import { ValidationError, NotFoundError } from '../device-store.js'
import { setupVncOnTarget } from '../remote-setup.js'

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
}

export default function createDevicesRouter({ store, actions, log = () => {} }) {
  const router = Router()

  router.get('/', (req, res) => {
    res.json(store.list())
  })

  router.get('/:id/status', async (req, res) => {
    const device = store.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device tidak ditemukan' })
    const online = await actions.status(device)
    res.json({ online })
  })

  router.get('/:id/history', (req, res) => {
    const device = store.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device tidak ditemukan' })
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 30)
    res.json({ samples: store.getStatusHistory(device.id, hours) })
  })

  router.post('/', wrap(async (req, res) => {
    const device = store.create(req.body || {})
    log('device_added', { deviceId: device.id, deviceName: device.name })
    res.status(201).json(device)
  }))

  router.put('/:id', wrap(async (req, res) => {
    const device = store.update(req.params.id, req.body || {})
    log('device_updated', { deviceId: device.id, deviceName: device.name })
    res.json(device)
  }))

  router.delete('/:id', wrap(async (req, res) => {
    const device = store.getByIdFull(req.params.id)
    store.remove(req.params.id)
    log('device_deleted', { deviceId: device.id, deviceName: device?.name })
    res.json({ ok: true })
  }))

  router.post('/:id/remote-setup', wrap(async (req, res) => {
    const device = store.getByIdFull(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device tidak ditemukan' })
    const headless = (req.body || {}).mode === 'headless'
    const result = await setupVncOnTarget(device, { headless })
    log('remote_setup', {
      deviceId: device.id,
      deviceName: device.name,
      detail: headless
        ? result.ok
          ? 'Virtual desktop (headless) berhasil diaktifkan'
          : 'Setup headless gagal'
        : result.ok
          ? 'VNC berhasil diaktifkan'
          : 'Setup VNC gagal',
    })
    if (!result.ok) {
      return res.status(500).json({ error: 'Setup VNC gagal', output: result.output })
    }
    res.json({ ok: true, output: result.output })
  }))

  router.post('/:id/wake', wrap(async (req, res) => {
    const device = store.getById(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device tidak ditemukan' })
    const result = await actions.wake(device)
    res.json({
      ok: true,
      message: `Magic packet terkirim ke ${device.mac} via ${result.broadcast}:${result.port}`,
      wake_count: store.getWakeCount(),
    })
  }))

  router.post('/:id/shutdown', wrap(async (req, res) => {
    const device = store.getByIdFull(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device tidak ditemukan' })
    const message = await actions.shutdown(device)
    res.json({ ok: true, message })
  }))

  return router
}
