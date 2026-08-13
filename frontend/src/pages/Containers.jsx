import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { api } from '../api.js'
import { ArrowLeftIcon, ContainerIcon, RefreshIcon, PlayIcon, StopIcon } from '../icons.jsx'

const RUNNING_STATES = new Set(['running'])

function StatePill({ state }) {
  if (state === 'running') return <span className="pill online"><i></i>Running</span>
  if (state === 'exited') return <span className="pill offline"><i></i>Exited</span>
  return <span className="pill unknown"><i></i>{state || '—'}</span>
}

export default function Containers() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { devices } = useDevices()
  const toast = useToast()
  const device = devices.find((d) => String(d.id) === String(id))
  const [containers, setContainers] = useState(null)
  const [busy, setBusy] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true)
      try {
        const res = await api(`/api/devices/${id}/containers`)
        setContainers(res.containers || [])
      } catch (err) {
        if (!silent) toast(err.message, 'error')
        setContainers((c) => c ?? [])
      } finally {
        setRefreshing(false)
      }
    },
    [id, toast],
  )

  useEffect(() => {
    load()
  }, [load])

  const act = async (name, action) => {
    setBusy(`${name}:${action}`)
    try {
      const res = await api(`/api/devices/${id}/containers/${encodeURIComponent(name)}/${action}`, {
        method: 'POST',
      })
      toast(res.message)
      await load(true)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="scan-page">
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="icon-btn ghost" title="Kembali" aria-label="Kembali" onClick={() => navigate('/devices')}>
            <ArrowLeftIcon />
          </button>
          <h2 style={{ marginBottom: 10 }}>Container — {device ? device.name : '…'}</h2>
        </div>
        <div className="scan-actions">
          <button className="btn-add-device" onClick={() => load()} disabled={refreshing}>
            Refresh
          </button>
        </div>
      </div>

      <div className="table-section">
        {containers === null ? (
          <div className="empty">
            <ContainerIcon />
            <p>Memuat daftar container…</p>
          </div>
        ) : containers.length === 0 ? (
          <div className="empty">
            <ContainerIcon />
            <p>Tidak ada container di device ini.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table id="container-table" className="scan-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Image</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th>Ports</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const running = RUNNING_STATES.has(c.state)
                  return (
                    <tr key={c.id || c.name} data-name={c.name}>
                      <td className="container-name">{c.name}</td>
                      <td className="container-image">{c.image}</td>
                      <td><StatePill state={c.state} /></td>
                      <td className="muted">{c.status}</td>
                      <td className="muted container-ports">{c.ports}</td>
                      <td>
                        <div className="container-actions">
                          {running ? (
                            <button
                              className="icon-btn"
                              title="Stop"
                              aria-label={`Stop ${c.name}`}
                              disabled={busy === `${c.name}:stop`}
                              onClick={() => act(c.name, 'stop')}
                            >
                              <StopIcon />
                            </button>
                          ) : (
                            <button
                              className="icon-btn"
                              title="Start"
                              aria-label={`Start ${c.name}`}
                              disabled={busy === `${c.name}:start`}
                              onClick={() => act(c.name, 'start')}
                            >
                              <PlayIcon />
                            </button>
                          )}
                          <button
                            className="icon-btn"
                            title="Restart"
                            aria-label={`Restart ${c.name}`}
                            disabled={busy === `${c.name}:restart`}
                            onClick={() => act(c.name, 'restart')}
                          >
                            <RefreshIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
