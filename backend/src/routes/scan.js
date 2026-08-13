import { Router } from 'express'
import { getScanRange, createScanRegistry, rangeHosts, computeBroadcast } from '../scan-job.js'

function parseSubnet(input) {
  const m = String(input || '').match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (!m) return null
  const ip = m[1]
  const prefix = Number(m[2])
  if (ip.split('.').some((o) => Number(o) > 255)) return null
  if (prefix < 8 || prefix > 30) return null
  return { address: ip, prefix, broadcast: computeBroadcast(ip, prefix), ips: rangeHosts(ip, prefix) }
}

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
    const subnetParam = req.query.subnet
    let range
    if (subnetParam) {
      try {
        range = parseSubnet(subnetParam)
      } catch (err) {
        return res.status(400).json({ error: err.message })
      }
      if (!range) {
        return res.status(400).json({ error: 'Subnet tidak valid (contoh: 192.168.1.0/24)' })
      }
    } else {
      try {
        range = getScanRange()
      } catch (err) {
        return res.status(400).json({ error: err.message })
      }
      if (!range) return res.status(400).json({ error: 'Tidak ada interface jaringan yang cocok' })
    }
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
