import { Router } from 'express'
import { getScanRange, createScanRegistry } from '../scan-job.js'

export default function createScanRouter({ store }) {
  const router = Router()
  const registry = createScanRegistry({
    saveCache: (found, subnet, broadcast) => store.saveScanCache(found, subnet, broadcast),
  })

  router.get('/cache', (req, res) => {
    const cache = store.getScanCache()
    if (!cache) return res.json({ cached: false })
    res.json({ cached: true, ...cache })
  })

  router.post('/start', (req, res) => {
    let range
    try {
      range = getScanRange()
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }
    if (!range) return res.status(400).json({ error: 'Tidak ada interface jaringan yang cocok' })
    const job = registry.start(range)
    res.json({ scanId: job.id, subnet: `${range.address}/${range.prefix}` })
  })

  router.post('/stop', (req, res) => {
    const job = registry.get(req.query.scanId)
    if (job) job.abort()
    res.json({ ok: true })
  })

  router.get('/status', (req, res) => {
    const job = registry.get(req.query.scanId)
    if (!job) return res.status(404).json({ error: 'Scan tidak ditemukan' })
    res.json({
      running: job.isRunning(),
      aborted: job.aborted,
      scanned: job.scanned,
      total: job.total,
      broadcast: job.range.broadcast,
      found: job.found,
    })
  })

  return router
}
