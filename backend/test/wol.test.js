import test from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import os from 'node:os'
import { buildMagicPacket, isValidMac, sendMagicPacket } from '../src/wol.js'

test('buildMagicPacket menghasilkan 102 byte dengan prefix 6x FF', () => {
  const mac = 'AA:BB:CC:DD:EE:FF'
  const packet = buildMagicPacket(mac)
  assert.equal(packet.length, 102)
  assert.deepEqual(packet.subarray(0, 6), Buffer.alloc(6, 0xff))
})

test('buildMagicPacket mengulang MAC 16 kali', () => {
  const mac = '01:23:45:67:89:AB'
  const packet = buildMagicPacket(mac)
  const macBytes = Buffer.from('0123456789AB', 'hex')
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(packet.subarray(6 + i * 6, 6 + (i + 1) * 6), macBytes)
  }
})

test('buildMagicPacket menolak MAC tidak valid', () => {
  assert.throws(() => buildMagicPacket('invalid'))
  assert.throws(() => buildMagicPacket('AA:BB:CC:DD:EE'))
})

test('isValidMac menerima format standar', () => {
  assert.equal(isValidMac('AA:BB:CC:DD:EE:FF'), true)
  assert.equal(isValidMac('aa-bb-cc-dd-ee-ff'), true)
  assert.equal(isValidMac('AA:BB:CC:DD:EE:F'), false)
  assert.equal(isValidMac('AA:BB:CC:DD:EE:GG'), false)
  assert.equal(isValidMac(''), false)
})

function findBroadcast() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && a.netmask === '255.255.255.0') {
        const p = a.address.split('.').map(Number)
        return `${p[0]}.${p[1]}.${p[2]}.255`
      }
    }
  }
  return null
}

test('sendMagicPacket benar-benar mengirim paket broadcast (integration)', async (t) => {
  const bcast = findBroadcast()
  if (!bcast) {
    t.skip('tidak ada interface dengan netmask /24')
    return
  }
  const port = 20000 + Math.floor(Math.random() * 1000)
  const listener = dgram.createSocket('udp4')
  const got = new Promise((resolve) => listener.on('message', (msg) => resolve(msg)))
  await new Promise((resolve) => listener.bind(port, '0.0.0.0', resolve))
  try {
    const result = await sendMagicPacket('AA:BB:CC:DD:EE:FF', bcast, port, 2)
    assert.equal(result.sent, 2)
    const msg = await Promise.race([
      got,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: paket tidak tertangkap')), 3000)),
    ])
    assert.equal(msg.length, 102)
    assert.deepEqual(msg.subarray(0, 6), Buffer.alloc(6, 0xff))
  } finally {
    listener.close()
  }
})
