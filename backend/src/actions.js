import { sendMagicPacket } from './wol.js'
import { shutdownViaSsh, checkOnline } from './ssh.js'

export function createActions({ store, send = sendMagicPacket, shutdown = shutdownViaSsh, probe = checkOnline }) {
  return {
    async wake(device) {
      const result = await send(device.mac, device.broadcast, device.wol_port)
      store.incWakeCount()
      return result
    },

    async shutdown(device) {
      if (!device.ssh_host || !device.ssh_user) {
        throw new Error('Konfigurasi SSH device belum lengkap')
      }
      return shutdown(device)
    },

    async status(device) {
      return probe(device.ssh_host, device.ssh_port)
    },
  }
}
