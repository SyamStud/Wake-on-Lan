import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocket } from 'ws'
import { attachRemoteServer } from '../src/remote.js'

class FakeChannel {
  constructor() {
    this.writes = []
    this.dataListeners = []
    this.closeListeners = []
  }
  on(ev, cb) {
    if (ev === 'data') this.dataListeners.push(cb)
    if (ev === 'close') this.closeListeners.push(cb)
  }
  write(d) {
    this.writes.push(Buffer.from(d))
  }
  end() {}
  close() {}
  emit(ev, d) {
    if (ev === 'data') this.dataListeners.forEach((cb) => cb(d))
    if (ev === 'close') this.closeListeners.forEach((cb) => cb())
  }
}

class FakeClient {
  static instances = []
  constructor() {
    this.listeners = {}
    this.channel = null
    this.config = null
    FakeClient.instances.push(this)
  }
  on(ev, cb) {
    this.listeners[ev] = cb
  }
  connect(config) {
    this.config = config
  }
  forwardOut(srcIp, srcPort, dstIp, dstPort, cb) {
    this.forward = { srcIp, srcPort, dstIp, dstPort }
    this.channel = new FakeChannel()
    cb(null, this.channel)
  }
  end() {}
  destroy() {}
  emit(ev, ...args) {
    this.listeners[ev]?.(...args)
  }
}

const device = {
  id: 1,
  name: 'PC Remote',
  ssh_host: '192.168.1.50',
  ssh_port: 22,
  ssh_user: 'user',
  ssh_auth: 'password',
  ssh_password: 'rahasia',
}

function setup() {
  FakeClient.instances = []
  const server = http.createServer((req, res) => res.end('ok'))
  attachRemoteServer({
    server,
    store: { getByIdFull: (id) => (id === 1 ? device : null) },
    authenticateRequest: () => ({}),
    clientClass: FakeClient,
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }))
  })
}

function connect(port, deviceId = 1, remotePort = 5900) {
  return new WebSocket(`ws://127.0.0.1:${port}/api/remote?deviceId=${deviceId}&port=${remotePort}`)
}

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout menunggu pesan')), 3000)
    ws.once('message', (raw) => {
      clearTimeout(timer)
      resolve(raw)
    })
  })
}

test('remote: alur binary echo melalui tunnel SSH', async (t) => {
  const { server, port } = await setup()
  t.after(() => server.close())
  const ws = connect(port)
  t.after(() => ws.terminate())
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  const client = FakeClient.instances[0]
  client.emit('ready')
  assert.deepEqual(client.forward, { srcIp: '127.0.0.1', srcPort: 5900, dstIp: '127.0.0.1', dstPort: 5900 })
  assert.equal(client.config.username, 'user')
  assert.equal(client.config.password, 'rahasia')

  const chan = client.channel
  assert.ok(chan, 'tunnel dibuka')

  const reply = nextMessage(ws)
  chan.emit('data', Buffer.from([0x52, 0x46, 0x42, 0x20])) // 'RFB '
  const got = await reply
  assert.deepEqual(Buffer.from(got), Buffer.from([0x52, 0x46, 0x42, 0x20]), 'data dari channel diteruskan ke ws')

  ws.send(Buffer.from('PING_BINARY'))
  await new Promise((r) => setTimeout(r, 30))
  assert.deepEqual(chan.writes[0].toString(), 'PING_BINARY', 'data ws diteruskan ke channel')

  const exit = new Promise((resolve) => ws.on('close', resolve))
  chan.emit('close')
  await exit
})

test('remote: tanpa sesi -> 401, port tidak valid -> 400', async (t) => {
  const srv = http.createServer((req, res) => res.end('x'))
  attachRemoteServer({ server: srv, store: { getByIdFull: () => device }, authenticateRequest: () => null, clientClass: FakeClient })
  await new Promise((r) => srv.listen(0, r))
  t.after(() => srv.close())
  const port = srv.address().port

  const ws1 = new WebSocket(`ws://127.0.0.1:${port}/api/remote?deviceId=1`)
  await new Promise((resolve) => {
    ws1.on('unexpected-response', (req2, res2) => {
      assert.equal(res2.statusCode, 401)
      resolve()
    })
    ws1.on('error', () => {})
    ws1.on('open', () => resolve(assert.fail('harusnya ditolak')))
  })
  ws1.terminate()

  const srv2 = http.createServer((req, res) => res.end('x'))
  attachRemoteServer({ server: srv2, store: { getByIdFull: () => device }, authenticateRequest: () => ({}), clientClass: FakeClient })
  await new Promise((r) => srv2.listen(0, r))
  t.after(() => srv2.close())
  const ws2 = new WebSocket(`ws://127.0.0.1:${srv2.address().port}/api/remote?deviceId=1&port=0`)
  await new Promise((resolve) => {
    ws2.on('unexpected-response', (req2, res2) => {
      assert.equal(res2.statusCode, 400)
      resolve()
    })
    ws2.on('error', () => {})
    ws2.on('open', () => resolve(assert.fail('harusnya ditolak')))
  })
  ws2.terminate()
})

test('remote: error koneksi ssh -> dikirim ke klien', async (t) => {
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
  const parsed = JSON.parse(msg.toString())
  assert.equal(parsed.type, 'error')
  assert.match(parsed.data.message, /ECONNREFUSED/)
})
