import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { HistoryIcon } from '../icons.jsx'

const PAGE_SIZE = 50

const TYPE_META = {
  wake: { label: 'Wake', group: 'ok' },
  schedule_wake: { label: 'Wake (Jadwal)', group: 'ok' },
  shutdown: { label: 'Shutdown', group: 'danger' },
  schedule_shutdown: { label: 'Shutdown (Jadwal)', group: 'danger' },
  login: { label: 'Login', group: 'info' },
  login_fail: { label: 'Login Gagal', group: 'danger' },
  logout: { label: 'Logout', group: 'neutral' },
  device_added: { label: 'Device Ditambah', group: 'info' },
  device_updated: { label: 'Device Diubah', group: 'neutral' },
  device_deleted: { label: 'Device Dihapus', group: 'danger' },
  terminal_open: { label: 'Terminal Dibuka', group: 'info' },
  terminal_close: { label: 'Terminal Ditutup', group: 'neutral' },
  remote_open: { label: 'Remote Dibuka', group: 'info' },
  remote_close: { label: 'Remote Ditutup', group: 'neutral' },
  status_online: { label: 'Device Online', group: 'ok' },
  status_offline: { label: 'Device Offline', group: 'danger' },
}

function typeMeta(type) {
  return TYPE_META[type] || { label: type, group: 'neutral' }
}

function formatTime(ts) {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Activity() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const offsetRef = useRef(0)

  const load = async (append) => {
    setLoading(true)
    try {
      const res = await api(`/api/activity?limit=${PAGE_SIZE}&offset=${append ? offsetRef.current : 0}`)
      setItems(append ? (prev) => [...prev, ...res.items] : res.items)
      setTotal(res.total)
      if (append) offsetRef.current += res.items.length
      else offsetRef.current = res.items.length
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load(false)
    const timer = setInterval(() => load(false), 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="content-body">
      <div className="content-main">
        <div className="table-section">
          <div className="activity-head">
            <h2>Riwayat Aktivitas</h2>
            <span className="activity-total">{total} event</span>
          </div>
          <div className="table-scroll">
            <table className="scan-table activity-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Tipe</th>
                  <th>Device</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const meta = typeMeta(row.type)
                  return (
                    <tr key={row.id}>
                      <td className="activity-time">{formatTime(row.ts)}</td>
                      <td>
                        <span className={`act-badge ${meta.group}`}>{meta.label}</span>
                      </td>
                      <td>{row.device_name || '—'}</td>
                      <td className="activity-detail">{row.detail || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {items.length === 0 && !loading && (
              <div className="empty">
                <HistoryIcon />
                <p>Belum ada aktivitas tercatat.</p>
              </div>
            )}
          </div>
          {items.length < total && (
            <div className="activity-foot">
              <button className="btn-cancel" onClick={() => load(true)} disabled={loading}>
                {loading ? 'Memuat…' : `Muat lebih (${items.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
