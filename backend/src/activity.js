const MAX_AGE_DAYS = 30

export function createActivityLog(db, maxAgeDays = MAX_AGE_DAYS) {
  const insert = db.prepare(`
    INSERT INTO activity_log (type, device_id, device_name, detail)
    VALUES (@type, @device_id, @device_name, @detail)
  `)
  const list = db.prepare(`SELECT * FROM activity_log ORDER BY id DESC LIMIT @limit OFFSET @offset`)
  const count = db.prepare(`SELECT COUNT(*) AS c FROM activity_log`)
  const cleanup = db.prepare(`DELETE FROM activity_log WHERE ts < datetime('now', ?)`)

  return {
    log(type, { deviceId = null, deviceName = null, detail = null } = {}) {
      insert.run({ type, device_id: deviceId, device_name: deviceName, detail })
    },

    list({ limit = 100, offset = 0 } = {}) {
      return list.all({ limit, offset })
    },

    count() {
      return count.get().c
    },

    cleanup() {
      cleanup.run(`-${maxAgeDays} days`)
    },
  }
}
