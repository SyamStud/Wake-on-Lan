import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocket } from 'ws'
import { attachTerminalServer } from '../src/terminal.js'

class FakeStream {
  constructor() {
    this.writes = []
    this.resize = null
    this.dataListeners = []
    this.closeListeners = []
    this.stderr = { on: () => {} }
    this.ended = false
  }
  on(ev, cb) {
    if (ev === 'data') this.dataListeners.push(cb)
    if (ev === 'close') this.closeListeners.push(cb)
  }
  write(d) {
    this.writes.push(d)
  }
  setWindow(rows, cols) {
    this.resize = { rows, cols }
  }
  end() {
    this.ended = true
  }
  emit(ev, d) {
    if (ev === 'data') this.dataListeners.forEach((cb) => cb(d))
    if (ev === 'close') this.closeListeners.forEach((cb) => cb())
  }
}

class FakeClient {
  static instances = []
  constructor() {
    this.listeners = {}
    this.stream = null
    this.ended = false
    this.destroyed = false
    this.config = null
    FakeClient.instances.push(this)
  }
  on(ev, cb) {
    this.listeners[ev] = cb
  }
  connect(config) {
    this.config = config
  }
  shell(opts, cb) {
    this.stream = new FakeStream()
    cb(null, this.stream)
  }
  end() {
    this.ended = true
  }
  destroy() {
    this.destroyed = true
  }
  emit(ev, ...args) {
    this.listeners[ev]?.(...args)
  }
}

const device = {
  id: 1,
  name: 'PC Test',
  ssh_host: '192.168.1.50',
  ssh_port: 22,
  ssh_user: 'user',
  ssh_auth: 'password',
  ssh_password: 'rahasia',
}

function setup() {
  FakeClient.instances = []
  const store = { getByIdFull: (id) => (id === 1 ? device : null) }
  const server = http.createServer((req, res) => {
    res.writeHead(200)
    res.end('ok')
  })
  attachTerminalServer({ server, store, authenticateRequest: () => ({}), clientClass: FakeClient })
  return new Promise((resolve) => {
    server.listen(0, () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function connect(port, deviceId = 1) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/terminal?deviceId=${deviceId}`)
}

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout menunggu pesan')), 3000)
    ws.once('message', (raw) => {
      clearTimeout(timer)
      resolve(JSON.parse(raw.toString()))
    })
  })
}

test('terminal: tanpa sesi -> ditolak 401', async (t) => {
  const store = { getByIdFull: () => device }
  const srv = http.createServer((req, res) => res.end('x'))
  attachTerminalServer({ server: srv, store, authenticateRequest: () => null, clientClass: FakeClient })
  await new Promise((r) => srv.listen(0, r))
  t.after(() => srv.close())
  const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/api/terminal?deviceId=1`)
  await new Promise((resolve) => {
    ws.on('unexpected-response', (req2, res2) => {
      assert.equal(res2.statusCode, 401)
      resolve()
    })
    ws.on('open', () => resolve(assert.fail('harusnya ditolak')))
    ws.on('error', () => {})
  })
  ws.terminate()
})

test('terminal: alur output + input + resize + exit', async (t) => {
  const { server, port } = await setup()
  t.after(() => server.close())
  const ws = connect(port)
  t.after(() => ws.terminate())

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  const client = FakeClient.instances[0]
  assert.equal(client.config.username, 'user')
  assert.equal(client.config.password, 'rahasia')

  ws.send(JSON.stringify({ type: 'input', data: 'ls\r' }))
  ws.send(JSON.stringify({ type: 'resize', rows: 30, cols: 100 }))
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(client.stream, null, 'shell belum dibuka saat pesan tiba')

  client.emit('ready')
  const shellStream = client.stream
  assert.ok(shellStream, 'shell dibuka')
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(shellStream.writes, ['ls\r'], 'input sebelum ready di-buffer dan dikirim setelah shell terbuka')
  assert.equal(shellStream.resize, null, 'resize sebelum shell siap diabaikan')

  ws.send(JSON.stringify({ type: 'resize', rows: 30, cols: 100 }))
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(shellStream.resize, { rows: 30, cols: 100 })

  const exitPromise = nextMessage(ws)
  client.stream.emit('close')
  const exit = await exitPromise
  assert.equal(exit.type, 'exit')
})

test('terminal: device tanpa SSH -> ditolak 400', async (t) => {
  const { server, port } = await setup()
  t.after(() => server.close())
  const ws = connect(port, 999)
  await new Promise((resolve) => {
    ws.on('unexpected-response', (req2, res2) => {
      assert.equal(res2.statusCode, 400)
      resolve()
    })
    ws.on('error', () => {})
    ws.on('open', () => resolve(assert.fail('harusnya ditolak')))
  })
  ws.terminate()
})

test('terminal: error koneksi ssh -> dikirim ke klien', async (t) => {
  const { server, port } = await setup()
  t.after(() => server.close())
  const ws = connect(port)
  t.after(() => ws.terminate())
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })
  FakeClient.instances[0].emit('error', new Error('ECONNREFUSED'))
  const msg = await nextMessage(ws)
  assert.equal(msg.type, 'error')
  assert.match(msg.data.message, /ECONNREFUSED/)
})
