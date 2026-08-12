import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const SESSION_COOKIE = 'wol_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const sessions = new Map()

const loginAttempts = new Map()
const MAX_ATTEMPTS = 10
const LOCK_MS = 15 * 60 * 1000

function lockState(ip) {
  const info = loginAttempts.get(ip)
  if (info) return info
  return { fails: 0, until: 0 }
}

export function initAuth(app, { secret, log = () => {}, apiKeyValidator = null }) {
  const sign = (value) => crypto.createHmac('sha256', secret).update(value).digest('base64url')
  const unsign = (value, signature) => {
    const expected = sign(value)
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return null
    return crypto.timingSafeEqual(a, b) ? value : null
  }

  const sessionFromCookie = (req) => {
    const cookie = req.headers.cookie
    if (!cookie) return null
    const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    if (!match) return null
    const [, raw = ''] = match.split('=')
    const [token, signature] = raw.split('.')
    if (!token || !signature) return null
    const unsigned = unsign(token, signature)
    if (!unsigned) return null
    const session = sessions.get(unsigned)
    if (session && session.expiresAt > Date.now()) {
      session.expiresAt = Date.now() + SESSION_TTL_MS
      return session
    }
    return null
  }

  const readSession = (req) => {
    const session = sessionFromCookie(req)
    if (session) return session
    if (apiKeyValidator) {
      const header = req.headers.authorization || ''
      const key = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-api-key']
      if (key && apiKeyValidator(key)) return { api: true }
    }
    return null
  }

  app.use((req, res, next) => {
    req.session = readSession(req)
    next()
  })

  app.post('/api/login', async (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown'
    const lock = lockState(ip)
    if (lock.until > Date.now()) {
      const minutes = Math.ceil((lock.until - Date.now()) / 60000)
      return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.` })
    }
    const { password } = req.body || {}
    if (!password) return res.status(400).json({ error: 'Password wajib diisi' })
    const hash = req.app.locals.passwordHash
    if (!hash) return res.status(500).json({ error: 'Password belum dikonfigurasi' })
    const ok = await bcrypt.compare(password, hash)
    if (!ok) {
      const fails = lock.fails + 1
      loginAttempts.set(ip, { fails, until: fails >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 })
      log('login_fail', { detail: `IP ${ip}` })
      return res.status(401).json({ error: 'Password salah' })
    }
    loginAttempts.delete(ip)
    log('login', { detail: `IP ${ip}` })
    const token = crypto.randomBytes(32).toString('hex')
    sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS })
    const signature = sign(token)
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}.${signature}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`)
    res.json({ ok: true })
  })

  app.post('/api/logout', (req, res) => {
    const cookie = req.headers.cookie
    if (cookie) {
      const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      if (match) {
        const token = match.split('=')[1].split('.')[0]
        sessions.delete(token)
      }
    }
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`)
    log('logout', {})
    res.json({ ok: true })
  })

  return {
    requireAuth: (req, res, next) => {
      if (req.session) return next()
      res.status(401).json({ error: 'Belum login' })
    },
    isAuthed: (req) => !!req.session,
    authenticateRequest: readSession,
  }
}

export function cleanupSessions() {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(token)
  }
}
