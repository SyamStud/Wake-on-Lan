import React, { useMemo, useState } from 'react'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { ZapIcon, MonitorIcon } from '../icons.jsx'
import DeviceTable from '../components/DeviceTable.jsx'
import EkgCanvas from '../components/EkgCanvas.jsx'

export default function Dashboard() {
  const { devices, statuses, wakeCount } = useDevices()
  const [filter, setFilter] = useState('all')

  const stats = useMemo(() => {
    let online = 0
    let offline = 0
    let unknown = 0
    for (const d of devices) {
      const s = statuses[d.id]
      if (s === true) online++
      else if (s === false) offline++
      else unknown++
    }
    const total = devices.length
    const pctOn = total ? Math.round((online / total) * 100) : 0
    const pctOff = total ? Math.round((offline / total) * 100) : 0
    const pctUnk = total ? 100 - pctOn - pctOff : 0
    return { total, online, offline, unknown, pctOn, pctOff, pctUnk }
  }, [devices, statuses])

  const filtered = useMemo(() => {
    if (filter === 'online') return devices.filter((d) => statuses[d.id] === true)
    if (filter === 'offline') return devices.filter((d) => statuses[d.id] === false)
    return devices
  }, [devices, statuses, filter])

  const wakeMax = Math.max(wakeCount, 10)
  const wakePct = Math.min((wakeCount / wakeMax) * 100, 100)

  return (
    <div className="content-body">
      <div className="content-main">
        <div className="stats-row">
          <div className="stat-card card-coral">
            <div className="stat-card-head">
              <span className="stat-label">Total Devices</span>
            </div>
            <div className="stat-big-num">{stats.total}</div>
            <EkgCanvas />
            <div className="stat-breakdown">
              <div className="stat-pct">
                <i className="dot green"></i>
                <span>Online</span>
                <b>%{stats.pctOn}</b>
              </div>
              <div className="stat-pct">
                <i className="dot gray"></i>
                <span>Offline</span>
                <b>%{stats.pctOff}</b>
              </div>
            </div>
          </div>

          <div className="stat-card card-white">
            <div className="stat-card-head">
              <span className="stat-label">Wake Actions</span>
              <span className="panel-icon coral-bg">
                <ZapIcon />
              </span>
            </div>
            <div className="stat-big-num dark">{wakeCount}</div>
            <div className="wake-card-sub">Session</div>
            <div className="progress-track">
              <div className="progress-bar coral" style={{ width: `${wakePct}%` }}></div>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="table-tabs">
            <button
              className={`tab${filter === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Devices
            </button>
            <button
              className={`tab${filter === 'online' ? ' active' : ''}`}
              onClick={() => setFilter('online')}
            >
              Online
            </button>
            <button
              className={`tab${filter === 'offline' ? ' active' : ''}`}
              onClick={() => setFilter('offline')}
            >
              Offline
            </button>
          </div>
          <DeviceTable mode="dashboard" devices={filtered} />
          {devices.length === 0 && (
            <div className="empty">
              <MonitorIcon />
              <p>
                Belum ada device. Klik tombol <b>Add Device</b> untuk menambahkan PC pertama.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="right-panel">
        <div className="panel-card">
          <div className="panel-stat-row">
            <span className="panel-icon green-bg">
              <MonitorIcon />
            </span>
            <div className="panel-stat-text">
              <span className="panel-stat-label">Online Now</span>
              <span className="panel-stat-sub">Current</span>
            </div>
            <span className="panel-stat-num">{stats.online}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
