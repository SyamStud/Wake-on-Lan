import { isValidMac } from './wol.js'

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isValidIpv4(ip) {
  if (!IPV4_RE.test(ip)) return false
  return ip.split('.').every((o) => Number(o) <= 255)
}

function validate(data, existing = null) {
  if (!data.name || !String(data.name).trim()) throw new ValidationError('Nama device wajib diisi')
  if (!data.mac) throw new ValidationError('MAC address wajib diisi')
  if (!isValidMac(data.mac)) throw new ValidationError('Format MAC tidak valid (contoh: AA:BB:CC:DD:EE:FF)')
  if (!data.broadcast) throw new ValidationError('Broadcast address wajib diisi')
  if (!isValidIpv4(data.broadcast)) throw new ValidationError('Broadcast address tidak valid (contoh: 192.168.1.255)')
  const wolPort = Number(data.wol_port ?? 9)
  if (!Number.isInteger(wolPort) || wolPort < 1 || wolPort > 65535) throw new ValidationError('Port WoL tidak valid')
  const sshPort = Number(data.ssh_port ?? 22)
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) throw new ValidationError('Port SSH tidak valid')
  if (data.ssh_host && data.ssh_user) {
    if (data.ssh_auth !== 'key' && data.ssh_auth !== 'password') throw new ValidationError('Metode auth SSH tidak valid')
    if (data.ssh_auth === 'key' && !data.ssh_key_path && !(existing && existing.ssh_key_path)) {
      throw new ValidationError('Path SSH key wajib diisi untuk auth key')
    }
    if (data.ssh_auth === 'password' && !data.ssh_password && !(existing && existing.ssh_password)) {
      throw new ValidationError('Password SSH wajib diisi untuk auth password')
    }
  }
  if (data.schedule_enabled) {
    if (!data.schedule_on || !TIME_RE.test(data.schedule_on)) throw new ValidationError('Jam nyala jadwal tidak valid (HH:MM)')
    if (!data.schedule_off || !TIME_RE.test(data.schedule_off)) throw new ValidationError('Jam mati jadwal tidak valid (HH:MM)')
  }
}

function mapFields(d) {
  const enabled = Number(d.schedule_enabled) === 1 || d.schedule_enabled === true
  return {
    name: String(d.name).trim(),
    mac: String(d.mac).trim().toUpperCase().replace(/-/g, ':'),
    broadcast: String(d.broadcast).trim(),
    wol_port: Number(d.wol_port) || 9,
    ssh_host: d.ssh_host ? String(d.ssh_host).trim() : null,
    ssh_port: Number(d.ssh_port) || 22,
    ssh_user: d.ssh_user ? String(d.ssh_user).trim() : null,
    ssh_auth: d.ssh_auth || 'key',
    ssh_key_path: d.ssh_key_path ? String(d.ssh_key_path).trim() : null,
    ssh_password: d.ssh_password ? String(d.ssh_password).trim() : null,
    notes: d.notes ? String(d.notes).trim() : null,
    schedule_enabled: enabled ? 1 : 0,
    schedule_on: enabled && d.schedule_on ? String(d.schedule_on).trim() : null,
    schedule_off: enabled && d.schedule_off ? String(d.schedule_off).trim() : null,
  }
}

export function createDeviceStore(db) {
  const byId = db.prepare('SELECT * FROM devices WHERE id = ?')
  const allByName = db.prepare('SELECT * FROM devices ORDER BY name COLLATE NOCASE')
  const scheduled = db.prepare('SELECT * FROM devices WHERE schedule_enabled = 1')
  const findMac = db.prepare('SELECT 1 FROM devices WHERE upper(mac) = ?')
  const findMacExcl = db.prepare('SELECT 1 FROM devices WHERE upper(mac) = ? AND id != ?')
  const insert = db.prepare(`
    INSERT INTO devices (name, mac, broadcast, wol_port, ssh_host, ssh_port, ssh_user, ssh_auth, ssh_key_path, ssh_password, notes, schedule_enabled, schedule_on, schedule_off)
    VALUES (@name, @mac, @broadcast, @wol_port, @ssh_host, @ssh_port, @ssh_user, @ssh_auth, @ssh_key_path, @ssh_password, @notes, @schedule_enabled, @schedule_on, @schedule_off)
  `)
  const update = db.prepare(`
    UPDATE devices SET
      name = @name, mac = @mac, broadcast = @broadcast, wol_port = @wol_port,
      ssh_host = @ssh_host, ssh_port = @ssh_port, ssh_user = @ssh_user,
      ssh_auth = @ssh_auth, ssh_key_path = @ssh_key_path, ssh_password = @ssh_password,
      notes = @notes, schedule_enabled = @schedule_enabled, schedule_on = @schedule_on, schedule_off = @schedule_off,
      updated_at = datetime('now')
    WHERE id = @id
  `)
  const remove = db.prepare('DELETE FROM devices WHERE id = ?')
  const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  const setSettingStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const insertStatus = db.prepare('INSERT INTO status_history (device_id, online) VALUES (@device_id, @online)')
  const selectStatus = db.prepare(`SELECT ts, online FROM status_history WHERE device_id = ? AND ts >= datetime('now', ?) ORDER BY ts ASC`)
  const cleanupStatus = db.prepare(`DELETE FROM status_history WHERE ts < datetime('now', ?)`)

  function getSetting(key) {
    const row = getSettingStmt.get(key)
    return row ? row.value : null
  }

  function setSetting(key, value) {
    setSettingStmt.run(key, value)
  }

  function macExists(mac, excludeId = null) {
    return excludeId ? !!findMacExcl.get(mac.toUpperCase(), excludeId) : !!findMac.get(mac.toUpperCase())
  }

  function getWakeCount() {
    return Number(getSetting('wake_count') || 0)
  }

  function stripSecrets(row) {
    if (!row) return row
    const { ssh_password, ...rest } = row
    return rest
  }

  return {
    list() {
      return allByName.all().map(stripSecrets)
    },

    getById(id) {
      return stripSecrets(byId.get(id) ?? null)
    },

    getByIdFull(id) {
      return byId.get(id) ?? null
    },

    listScheduled() {
      return scheduled.all()
    },

    create(data) {
      validate(data)
      if (macExists(data.mac)) throw new ValidationError('MAC address sudah terdaftar')
      const info = insert.run(mapFields(data))
      return byId.get(info.lastInsertRowid)
    },

    update(id, data) {
      const device = byId.get(id)
      if (!device) throw new NotFoundError('Device tidak ditemukan')
      validate(data, device)
      if (macExists(data.mac, id)) throw new ValidationError('MAC address sudah dipakai device lain')
      const fields = mapFields(data)
      if (!fields.ssh_password && device.ssh_password) {
        fields.ssh_password = device.ssh_password
      }
      if (!fields.ssh_key_path && device.ssh_key_path) {
        fields.ssh_key_path = device.ssh_key_path
      }
      update.run({ ...fields, id })
      return byId.get(id)
    },

    remove(id) {
      const info = remove.run(id)
      if (info.changes === 0) throw new NotFoundError('Device tidak ditemukan')
      return true
    },

    getSetting,
    setSetting,

    getWakeCount,

    incWakeCount() {
      setSetting('wake_count', String(getWakeCount() + 1))
    },

    getScanCache() {
      const raw = getSetting('scan_cache')
      if (!raw) return null
      try {
        const cache = JSON.parse(raw)
        return { subnet: cache.subnet, broadcast: cache.broadcast, found: cache.found || [], at: cache.at }
      } catch {
        return null
      }
    },

    saveScanCache(found, subnet, broadcast) {
      setSetting('scan_cache', JSON.stringify({ subnet, broadcast, found, at: Date.now() }))
    },

    recordStatus(deviceId, online) {
      insertStatus.run({ device_id: deviceId, online: online ? 1 : 0 })
    },

    getStatusHistory(deviceId, hours) {
      const rows = selectStatus.all(deviceId, `-${hours} hours`)
      if (rows.length <= 3000) {
        return rows.map((r) => ({ ts: r.ts, online: !!r.online }))
      }
      const buckets = new Map()
      for (const r of rows) {
        const hour = r.ts.slice(0, 13) + ':00:00'
        const b = buckets.get(hour) || { total: 0, on: 0 }
        b.total++
        if (r.online) b.on++
        buckets.set(hour, b)
      }
      return [...buckets].map(([ts, b]) => ({
        ts,
        online_pct: Math.round((b.on / b.total) * 100),
      }))
    },

    cleanupStatusHistory() {
      cleanupStatus.run('-30 days')
    },
  }
}
