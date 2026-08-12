import fs from 'node:fs'
import { WebSocketServer } from 'ws'
import { Client } from 'ssh2'

const MAX_SESSIONS = 4
const IDLE_TIMEOUT_MS = 15 * 60 * 1000

export function attachTerminalServer({ server, store, authenticateRequest, clientClass = Client, log = () => {} }) {
  const wss = new WebSocketServer({ noServer: true })
  let active = 0

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== '/api/terminal') return

    const reject = (code, message) => {
      socket.write(`HTTP/1.1 ${code} ${message}\r\nConnection: close\r\n\r\n`)
      socket.destroy()
    }

    if (!authenticateRequest(req)) return reject(401, 'Unauthorized')
    const device = store.getByIdFull(Number(url.searchParams.get('deviceId')))
    if (!device || !device.ssh_host || !device.ssh_user) return reject(400, 'Bad Request')
    if (active >= MAX_SESSIONS) return reject(429, 'Too Many Requests')

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { device })
    })
  })

  wss.on('connection', (ws, req, { device }) => {
    active++
    let conn = null
    let stream = null
    let inputBuffer = []
    let idleTimer = null

    const send = (type, data) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, data }))
    }

    const resetIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        send('exit', { message: 'Sesi berakhir karena idle' })
        ws.close()
      }, IDLE_TIMEOUT_MS)
    }

    const cleanup = () => {
      clearTimeout(idleTimer)
      try { stream?.end() } catch {}
      try { conn?.end() } catch {}
      try { conn?.destroy() } catch {}
    }

    log('terminal_open', { deviceId: device.id, deviceName: device.name, detail: `${device.ssh_user}@${device.ssh_host}` })

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
        send('error', { message: `Tidak bisa membaca SSH key: ${err.message}` })
        cleanup()
        ws.close()
        return
      }
    } else {
      send('error', { message: 'Auth SSH tidak lengkap (perlu password atau key path)' })
      cleanup()
      ws.close()
      return
    }

    conn = new clientClass()
    conn.on('ready', () => {
      conn.shell({ term: 'xterm-256color' }, (err, shellStream) => {
        if (err) {
          send('error', { message: `Gagal membuka shell: ${err.message}` })
          ws.close()
          return
        }
        stream = shellStream
        stream.on('data', (d) => send('output', d.toString('utf8')))
        stream.stderr.on('data', (d) => send('output', d.toString('utf8')))
        stream.on('close', () => {
          send('exit', { message: 'Sesi SSH ditutup' })
          ws.close()
        })
        for (const chunk of inputBuffer) {
          try {
            stream.write(chunk)
          } catch {}
        }
        inputBuffer = []
        resetIdle()
      })
    })
    conn.on('error', (err) => {
      send('error', { message: err.message })
      ws.close()
    })

    ws.on('message', (raw) => {
      resetIdle()
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.type === 'input') {
        try {
          if (stream) stream.write(msg.data)
          else inputBuffer.push(msg.data)
        } catch (err) {
          console.error('[terminal] gagal tulis input:', err.message)
        }
      } else if (msg.type === 'resize' && stream) {
        try {
          stream.setWindow(msg.rows, msg.cols, (msg.rows || 24) * 8, (msg.cols || 80) * 8)
        } catch {}
      }
    })

    ws.on('close', () => {
      active = Math.max(0, active - 1)
      log('terminal_close', { deviceId: device.id, deviceName: device.name })
      cleanup()
    })
    ws.on('error', () => {})

    resetIdle()
    conn.connect(config)
  })

  return wss
}
