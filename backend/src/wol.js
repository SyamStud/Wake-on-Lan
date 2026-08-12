import dgram from 'node:dgram'

export function buildMagicPacket(mac) {
  const macHex = mac.replace(/[^0-9a-fA-F]/g, '')
  if (macHex.length !== 12) {
    throw new Error(`MAC tidak valid: ${mac}`)
  }
  const macBytes = Buffer.from(macHex, 'hex')
  const packet = Buffer.alloc(6 + 16 * 6)
  packet.fill(0xff, 0, 6)
  for (let i = 0; i < 16; i++) {
    macBytes.copy(packet, 6 + i * 6)
  }
  return packet
}

export function isValidMac(mac) {
  return /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(mac)
}

export function sendMagicPacket(mac, broadcast, port, retries = 3) {
  const packet = buildMagicPacket(mac)
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4')
    socket.on('error', (err) => {
      socket.close()
      reject(err)
    })
    socket.bind(() => {
      socket.setBroadcast(true)
      let sent = 0
      const send = () => {
        socket.send(packet, 0, packet.length, port, broadcast, (err) => {
          if (err) {
            socket.close()
            return reject(err)
          }
          sent++
          if (sent >= retries) {
            socket.close()
            resolve({ sent, mac, broadcast, port })
          } else {
            setTimeout(send, 100)
          }
        })
      }
      send()
    })
  })
}
