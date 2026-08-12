import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { createApp, ensurePasswordHash } from './app.js'
import { cleanupSessions } from './auth.js'
import { startScheduler } from './scheduler.js'
import { startStatusMonitor } from './status-monitor.js'
import { createActivityLog } from './activity.js'
import { attachTerminalServer } from './terminal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m || m[2] === '') continue
    const [, key, value] = m
    if (process.env[key] === undefined) {
      process.env[key] = value.replace(/^["']|["']$/g, '')
    }
  }
}

loadEnv()

const PORT = Number(process.env.PORT) || 3000
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')

const activity = createActivityLog(db)
const { app, store, actions, auth } = createApp({
  sessionSecret: SESSION_SECRET,
  log: activity.log,
  activity,
})
await ensurePasswordHash(app, process.env.APP_PASSWORD)

const cleanupTimer = setInterval(cleanupSessions, 60 * 60 * 1000)
const stopScheduler = startScheduler({ store, actions })
const stopStatusMonitor = startStatusMonitor({ store, actions, log: activity.log }).stop
const cleanupDataTimer = setInterval(() => {
  activity.cleanup()
  store.cleanupStatusHistory()
}, 24 * 60 * 60 * 1000)

const server = app.listen(PORT, () => {
  console.log(`Wake on LAN server berjalan di http://localhost:${PORT}`)
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  LAN: http://${addr.address}:${PORT}`)
      }
    }
  }
})

attachTerminalServer({
  server,
  store,
  authenticateRequest: auth.authenticateRequest,
  log: activity.log,
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[server] ${signal} diterima, menutup dengan bersih...`)
  clearInterval(cleanupTimer)
  clearInterval(cleanupDataTimer)
  stopScheduler()
  stopStatusMonitor()
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
