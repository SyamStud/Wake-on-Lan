import { Router } from 'express'
import { ValidationError, NotFoundError } from '../device-store.js'

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message })
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
}

export default function createDevicesRouter({ store, actions }) {
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

  router.post('/', wrap(async (req, res) => {
    const device = store.create(req.body || {})
    res.status(201).json(device)
  }))

  router.put('/:id', wrap(async (req, res) => {
    const device = store.update(req.params.id, req.body || {})
    res.json(device)
  }))

  router.delete('/:id', wrap(async (req, res) => {
    store.remove(req.params.id)
    res.json({ ok: true })
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
