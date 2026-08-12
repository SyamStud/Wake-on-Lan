import { sendMagicPacket } from './wol.js'
import { shutdownViaSsh, checkOnline } from './ssh.js'

export function createActions({ store, send = sendMagicPacket, shutdown = shutdownViaSsh, probe = checkOnline, log = () => {} }) {
  return {
    async wake(device, opts = {}) {
      const result = await send(device.mac, device.broadcast, device.wol_port)
      store.incWakeCount()
      log(opts.scheduled ? 'schedule_wake' : 'wake', {
        deviceId: device.id,
        deviceName: device.name,
        detail: `${device.mac} via ${result.broadcast}:${result.port}`,
      })
      return result
    },

    async shutdown(device, opts = {}) {
      if (!device.ssh_host || !device.ssh_user) {
        throw new Error('Konfigurasi SSH device belum lengkap')
      }
      const message = await shutdown(device)
      log(opts.scheduled ? 'schedule_shutdown' : 'shutdown', {
        deviceId: device.id,
        deviceName: device.name,
        detail: message,
      })
      return message
    },

    async status(device) {
      return probe(device.ssh_host, device.ssh_port)
    },
  }
}
