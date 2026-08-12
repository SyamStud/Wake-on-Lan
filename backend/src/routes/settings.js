import { Router } from 'express'

export default function createSettingsRouter({ apiKey }) {
  const router = Router()

  router.get('/api-key', (req, res) => {
    res.json({ active: apiKey.isActive() })
  })

  router.post('/api-key', (req, res) => {
    res.status(201).json({ apiKey: apiKey.generate() })
  })

  router.delete('/api-key', (req, res) => {
    apiKey.revoke()
    res.json({ ok: true })
  })

  return router
}
