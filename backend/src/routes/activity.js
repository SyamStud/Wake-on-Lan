import { Router } from 'express'

export default function createActivityRouter({ activity }) {
  const router = Router()

  router.get('/', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    res.json({ items: activity.list({ limit, offset }), total: activity.count() })
  })

  return router
}
