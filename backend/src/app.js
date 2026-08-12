import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import express from 'express'
import bcrypt from 'bcryptjs'
import { db } from './db.js'
import { createDeviceStore } from './device-store.js'
import { createActions } from './actions.js'
import { initAuth } from './auth.js'
import createDevicesRouter from './routes/devices.js'
import createScanRouter from './routes/scan.js'
import createActivityRouter from './routes/activity.js'
import createSettingsRouter from './routes/settings.js'
import { createActivityLog } from './activity.js'
import { createApiKeyManager } from './api-key.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp({ sessionSecret, log = () => {}, activity = null }) {
  const store = createDeviceStore(db)
  const actions = createActions({ store, log })
  const apiKey = createApiKeyManager(store)

  const app = express()
  app.locals.store = store
  app.use(express.json())

  const distDir = path.join(__dirname, '..', 'public', 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
  }

  const auth = initAuth(app, { secret: sessionSecret, log, apiKeyValidator: apiKey.validate })

  app.use('/api/devices', auth.requireAuth, createDevicesRouter({ store, actions, log }))
  app.use('/api/scan', auth.requireAuth, createScanRouter({ store }))
  if (activity) {
    app.use('/api/activity', auth.requireAuth, createActivityRouter({ activity }))
  }
  app.use('/api/settings', auth.requireAuth, createSettingsRouter({ apiKey }))

  app.get('/api/devices/wake-count', auth.requireAuth, (req, res) => {
    res.json({ count: store.getWakeCount() })
  })

  app.get('/api/me', (req, res) => {
    res.json({ authed: !!req.session })
  })

  if (fs.existsSync(distDir)) {
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Tidak ditemukan' })
  })

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON tidak valid' })
    }
    console.error(err)
    res.status(500).json({ error: 'Terjadi kesalahan server' })
  })

  return { app, store, actions, auth }
}

export async function ensurePasswordHash(app, envPassword) {
  const store = app.locals.store
  if (envPassword) {
    const hash = await bcrypt.hash(envPassword, 10)
    store.setSetting('password_hash', hash)
    app.locals.passwordHash = hash
    return
  }
  let hash = store.getSetting('password_hash')
  if (!hash) {
    const password = crypto.randomBytes(6).toString('base64url')
    console.log('==============================================')
    console.log(`  Password admin: ${password}`)
    console.log('  (set APP_PASSWORD di .env untuk password tetap)')
    console.log('==============================================')
    hash = await bcrypt.hash(password, 10)
    store.setSetting('password_hash', hash)
  }
  app.locals.passwordHash = hash
}
