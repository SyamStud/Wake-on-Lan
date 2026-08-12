import fs from 'node:fs'
import { WebSocketServer } from 'ws'
import { Client } from 'ssh2'

const MAX_SESSIONS = 4
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export function attachRemoteServer({ server, store, authenticateRequest, clientClass = Client, log = () => {} }) {
  const wss = new WebSocketServer({ noServer: true })
  let active = 0

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== '/api/remote') return

    const reject = (code, message) => {
      socket.write(`HTTP/1.1 ${code} ${message}\r\nConnection: close\r\n\r\n`)
      socket.destroy()
    }

    if (!authenticateRequest(req)) return reject(401, 'Unauthorized')
    const device = store.getByIdFull(Number(url.searchParams.get('deviceId')))
    if (!device || !device.ssh_host || !device.ssh_user) return reject(400, 'Bad Request')
    const rawPort = url.searchParams.get('port')
    const port = rawPort === null ? 5900 : Number(rawPort)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return reject(400, 'Bad Request')
    if (active >= MAX_SESSIONS) return reject(429, 'Too Many Requests')

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { device, port })
    })
  })

  wss.on('connection', (ws, req, { device, port }) => {
    active++
    let conn = null
    let chan = null
    let idleTimer = null

    const send = (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data)
    }

    const resetIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => ws.close(), IDLE_TIMEOUT_MS)
    }

    const cleanup = () => {
      clearTimeout(idleTimer)
      try { chan?.end() } catch {}
      try { chan?.close() } catch {}
      try { conn?.end() } catch {}
      try { conn?.destroy() } catch {}
    }

    log('remote_open', { deviceId: device.id, deviceName: device.name, detail: `${device.ssh_host}:${port}` })

    const config = {
      host: device.ssh_host,
      port: device.ssh_port || 22,
      username: device.ssh_user,
      readyTimeout: 10000,
    }
    if (device.ssh_auth === 'password' && device.ssh_password) {
      config.password = device.ssh_password
    } else if (device.ssh_key_path) {
      try {
        config.privateKey = fs.readFileSync(device.ssh_key_path)
      } catch (err) {
        send(JSON.stringify({ type: 'error', data: { message: `Tidak bisa membaca SSH key: ${err.message}` } }))
        cleanup()
        ws.close()
        return
      }
    } else {
      send(JSON.stringify({ type: 'error', data: { message: 'Auth SSH tidak lengkap (perlu password atau key path)' } }))
      cleanup()
      ws.close()
      return
    }

    conn = new clientClass()
    conn.on('ready', () => {
      conn.forwardOut('127.0.0.1', port, '127.0.0.1', port, (err, channel) => {
        if (err) {
          send(JSON.stringify({ type: 'error', data: { message: `Gagal membuka tunnel ke port ${port}: ${err.message}` } }))
          ws.close()
          return
        }
        chan = channel
        channel.on('data', (d) => {
          resetIdle()
          send(Buffer.from(d))
        })
        channel.on('close', () => ws.close())
        channel.on('error', () => {})
        resetIdle()
      })
    })
    conn.on('error', (err) => {
      send(JSON.stringify({ type: 'error', data: { message: err.message } }))
      ws.close()
    })

    ws.on('message', (raw) => {
      resetIdle()
      if (!chan) return
      try {
        chan.write(raw)
      } catch {}
    })

    ws.on('close', () => {
      active = Math.max(0, active - 1)
      log('remote_close', { deviceId: device.id, deviceName: device.name })
      cleanup()
    })
    ws.on('error', () => {})

    resetIdle()
    conn.connect(config)
  })

  return wss
}
