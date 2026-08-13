import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useUi } from '../contexts/UiContext.jsx'
import { CheckIcon, PlusIcon, WifiIcon } from '../icons.jsx'

function formatAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  return new Date(ts).toLocaleString('id-ID')
}

export default function Scan() {
  const { devices, reload } = useDevices()
  const toast = useToast()
  const { confirm } = useUi()

  const [running, setRunning] = useState(false)
  const [found, setFound] = useState([])
  const [statusText, setStatusText] = useState('Memulai scan...')
  const [progress, setProgress] = useState(0)
  const [cacheNote, setCacheNote] = useState('')
  const [subnet, setSubnet] = useState('')
  const scanIdRef = useRef(null)
  const pollTimerRef = useRef(null)

  const renderResults = useCallback(
    (list) => {
      setFound(list)
    },
    [],
  )

  const loadCache = useCallback(async () => {
    try {
      const res = await api('/api/scan/cache')
      if (res.cached && res.found && res.found.length) {
        renderResults(res.found)
        setCacheNote(`Dari cache · ${formatAgo(res.at)}`)
      }
    } catch {}
  }, [renderResults])

  useEffect(() => {
    loadCache()
    return () => clearTimeout(pollTimerRef.current)
  }, [loadCache])

  const poll = useCallback(async () => {
    try {
      const res = await api(`/api/scan/status?scanId=${scanIdRef.current}`)
      const pct = res.total ? Math.round((res.scanned / res.total) * 100) : 0
      setProgress(pct)
      setStatusText(
        res.running
          ? `Menscan ${res.scanned}/${res.total} host...`
          : res.aborted
            ? `Scan dihentikan — ${res.found.length} perangkat ditemukan`
            : `Scan selesai — ${res.found.length} perangkat ditemukan`,
      )
      renderResults(res.found)
      if (res.running) {
        pollTimerRef.current = setTimeout(poll, 700)
      } else {
        setRunning(false)
      }
    } catch (err) {
      setRunning(false)
      toast(err.message, 'error')
    }
  }, [renderResults, toast])

  const startScan = async () => {
    try {
      const q = subnet.trim() ? `?subnet=${encodeURIComponent(subnet.trim())}` : ''
      const res = await api(`/api/scan/start${q}`, { method: 'POST' })
      scanIdRef.current = res.scanId
      setFound([])
      setCacheNote('')
      setProgress(0)
      setStatusText('Memulai scan...')
      setRunning(true)
      poll()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const stopScan = async () => {
    await api(`/api/scan/stop?scanId=${scanIdRef.current}`, { method: 'POST' }).catch(() => {})
    setStatusText('Menghentikan scan...')
  }

  const addDevice = async (d) => {
    const name = d.hostname || d.ip
    const ok = await confirm({
      title: 'Tambah ke Device',
      message: `Tambah "${name}" (${d.mac}) ke daftar device?`,
      confirmText: 'Add',
    })
    if (!ok) return
    try {
      await api('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          name,
          mac: d.mac,
          broadcast: d.ip,
          wol_port: 9,
          ssh_host: null,
          ssh_port: 22,
          ssh_user: null,
          ssh_auth: 'key',
          ssh_key_path: null,
          ssh_password: null,
          schedule_enabled: false,
          schedule_on: null,
          schedule_off: null,
        }),
      })
      toast(`"${name}" ditambahkan ke device`)
      await reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const exists = (mac) => devices.some((x) => (x.mac || '').toLowerCase() === (mac || '').toLowerCase())

  return (
    <div className="scan-page">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 style={{ marginBottom: 10 }}>Network Scan</h2>
        </div>
        <div className="scan-actions">
          <input
            className="scan-subnet-input"
            placeholder="Subnet (cth: 192.168.1.0/24) — kosongkan = auto"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            disabled={running}
          />
          <button id="scan-start" className="btn-add-device" onClick={startScan}>
            Scan
          </button>
          {cacheNote && <span className="scan-cache-note">{cacheNote}</span>}
        </div>
      </div>

      <div className="table-section">
        <div className="table-scroll">
          <table id="scan-table" className="scan-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Hostname</th>
              </tr>
            </thead>
            <tbody id="scan-results">
            {found.map((d, i) => {
              const added = exists(d.mac)
              return (
                <tr key={`${d.ip}-${i}`}>
                  <td>
                    {d.mac ? (
                      <button
                        className="scan-add-btn"
                        disabled={added}
                        onClick={() => addDevice(d)}
                      >
                        {added ? <CheckIcon /> : <PlusIcon />}
                        <span>{added ? 'Added' : 'Add'}</span>
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{d.ip}</td>
                  <td>{d.mac ? <span className="scan-mac">{d.mac}</span> : '—'}</td>
                  <td>{d.hostname || '—'}</td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </div>

        {running && found.length === 0 && (
          <div className="table-scroll">
            <div className="scan-skeleton">
              {[...Array(6)].map((_, i) => (
                <div className="skeleton-row" key={i}>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!running && found.length === 0 && (
          <div className="empty">
            <WifiIcon />
            <p>
              Tekan tombol <b>Scan</b> untuk mendeteksi perangkat di jaringan yang sama.
            </p>
          </div>
        )}
      </div>

      {running && (
        <div className="scan-overlay">
          <div className="scan-popup">
            <div className="spinner"></div>
            <p>{statusText}</p>
            <div className="progress-track">
              <div className="progress-bar coral" style={{ width: `${progress}%` }}></div>
            </div>
            <button type="button" className="btn-danger" onClick={stopScan}>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
