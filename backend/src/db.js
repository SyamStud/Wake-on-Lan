import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mac TEXT NOT NULL,
      broadcast TEXT NOT NULL DEFAULT '255.255.255.255',
      wol_port INTEGER NOT NULL DEFAULT 9,
      ssh_host TEXT,
      ssh_port INTEGER NOT NULL DEFAULT 22,
      ssh_user TEXT,
      ssh_auth TEXT NOT NULL DEFAULT 'key',
      ssh_key_path TEXT,
      ssh_password TEXT,
      notes TEXT,
      schedule_enabled INTEGER NOT NULL DEFAULT 0,
      schedule_on TEXT,
      schedule_off TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      device_id INTEGER,
      device_name TEXT,
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      online INTEGER NOT NULL,
      ts TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const cols = db.prepare(`PRAGMA table_info(devices)`).all().map(c => c.name)
  if (!cols.includes('schedule_enabled')) {
    db.exec(`ALTER TABLE devices ADD COLUMN schedule_enabled INTEGER NOT NULL DEFAULT 0`)
  }
  if (!cols.includes('schedule_on')) {
    db.exec(`ALTER TABLE devices ADD COLUMN schedule_on TEXT`)
  }
  if (!cols.includes('schedule_off')) {
    db.exec(`ALTER TABLE devices ADD COLUMN schedule_off TEXT`)
  }
}

export function openDatabase(filename) {
  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  initSchema(db)
  return db
}

export function createAppDatabase() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dataDir = path.join(__dirname, '..', 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  return openDatabase(path.join(dataDir, 'wol.db'))
}

export const db = createAppDatabase()
