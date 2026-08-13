import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RFB from '@novnc/novnc'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { ArrowLeftIcon, MonitorIcon } from '../icons.jsx'

const STATUS_LABEL = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  error: 'Gagal terhubung',
  closed: 'Sesi ditutup',
}

export default function Remote() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const port = searchParams.get('port') || '5900'
  const { devices } = useDevices()
  const device = devices.find((d) => String(d.id) === id)
  const screenRef = useRef(null)
  const rfbRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [password, setPassword] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [setup, setSetup] = useState({ running: false, output: '' })
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    const screen = screenRef.current
    if (!screen) return

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${location.host}/api/remote?deviceId=${id}&port=${port}`

    let rfb
    try {
      rfb = new RFB(screen, url, { credentials: { password } })
    } catch (err) {
      setStatus('error')
      toast(err.message, 'error')
      return
    }
    rfbRef.current = rfb
    rfb.scaleViewport = true
    rfb.resizeSession = false
    rfb.focusOnClick = true
    rfb.viewOnly = false

    const onConnect = () => setStatus('connected')
    const onDisconnect = (e) => {
      setStatus('closed')
      if (e.detail?.clean) toast('Sesi remote ditutup')
      else toast(e.detail?.message || 'Koneksi terputus', 'error')
    }
    const onCredentials = () => {
      setNeedPassword(true)
      setStatus('connecting')
    }
    const onSecurity = (e) => {
      setStatus('error')
      toast(e.detail?.reason || 'Autentikasi VNC gagal', 'error')
    }

    rfb.addEventListener('connect', onConnect)
    rfb.addEventListener('disconnect', onDisconnect)
    rfb.addEventListener('credentialsrequired', onCredentials)
    rfb.addEventListener('securityfailure', onSecurity)

    return () => {
      rfb.removeEventListener('connect', onConnect)
      rfb.removeEventListener('disconnect', onDisconnect)
      rfb.removeEventListener('credentialsrequired', onCredentials)
      rfb.removeEventListener('securityfailure', onSecurity)
      try {
        rfb.disconnect()
      } catch {}
      rfbRef.current = null
    }
  }, [id, port, attempt])

  const runSetup = async (mode) => {
    setSetup({ running: true, output: '' })
    try {
      const res = await api(`/api/devices/${id}/remote-setup`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      })
      setSetup({ running: false, output: res.output || '' })
      if (res.ok) {
        toast(mode === 'headless' ? 'Virtual desktop siap — menghubungkan…' : 'VNC berhasil diaktifkan — menghubungkan…')
        setPassword('')
        setAttempt((a) => a + 1)
      }
    } catch (err) {
      const output = err.output || ''
      setSetup({ running: false, output })
      toast(err.message, 'error')
    }
  }

  const submitPassword = (e) => {
    e.preventDefault()
    if (!password) return
    try {
      rfbRef.current?.sendCredentials({ password })
      setNeedPassword(false)
    } catch {}
  }

  return (
    <div className="remote-page">
      <div className="terminal-toolbar">
        <button className="icon-btn ghost" title="Kembali" aria-label="Kembali" onClick={() => navigate('/devices')}>
          <ArrowLeftIcon />
        </button>
        <span className="terminal-title">
          {device ? device.name : 'Remote'} <em>VNC :{port}</em>
        </span>
        <span className={`terminal-status ${status}`}>{STATUS_LABEL[status]}</span>
        <span className="terminal-spacer"></span>
        {status === 'connected' && (
          <button
            className="btn-cancel"
            onClick={() => {
              try {
                rfbRef.current?.sendCtrlAltDel()
              } catch {}
            }}
          >
            Ctrl+Alt+Del
          </button>
        )}
        <button
          className="btn-save"
          onClick={() => runSetup('normal')}
          disabled={setup.running}
          title="Instal & aktifkan x11vnc di target (untuk PC dengan monitor)"
        >
          {setup.running ? 'Menyiapkan…' : 'Aktifkan Remote'}
        </button>
        <button
          className="btn-cancel"
          onClick={() => runSetup('headless')}
          disabled={setup.running}
          title="Virtual desktop tanpa monitor (Xvfb + XFCE + x11vnc) — untuk PC headless atau layar hitam"
        >
          Mode Headless
        </button>
        <button className="btn-cancel terminal-close" onClick={() => navigate('/devices')}>
          Tutup
        </button>
      </div>

      {needPassword && (
        <form className="remote-password" onSubmit={submitPassword}>
          <MonitorIcon />
          <input
            type="password"
            placeholder="Password VNC"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-save">
            Masuk
          </button>
        </form>
      )}

      {setup.output && (
        <details className="remote-output">
          <summary>Lihat log setup ({setup.running ? 'berjalan…' : 'selesai'})</summary>
          <pre>{setup.output}</pre>
        </details>
      )}

      <div className="remote-screen" ref={screenRef}></div>
    </div>
  )
}
