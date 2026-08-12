import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, PowerIcon } from '../icons.jsx'
import EkgCanvas from '../components/EkgCanvas.jsx'

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
      onSuccess()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-brand">
        <div className="login-brand-top">
          <div className="sidebar-logo">
            <PowerIcon />
          </div>
          <span className="login-brand-name">Wake on LAN</span>
        </div>

        <p className="login-brand-tagline">
          Nyalakan &amp; matikan PC di jaringanmu, dari browser mana pun.
        </p>

        <div className="login-mock-card">
          <div className="mock-head">
            <span>Total Devices</span>
          </div>
          <div className="mock-num">01</div>
          <EkgCanvas />
          <div className="mock-row">
            <span className="stat-pct">
              <i className="dot green"></i>
              <span>Online</span>
              <b>%100</b>
            </span>
            <span className="stat-pct">
              <i className="dot gray"></i>
              <span>Offline</span>
              <b>%0</b>
            </span>
          </div>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-panel" onSubmit={submit}>
          <div className="login-panel-icon">
            <PowerIcon strokeWidth={2.2} />
          </div>
          <h1>Masuk</h1>
          <p className="login-panel-sub">Masukkan password admin untuk mengelola device.</p>

          <div className="field">
            <LockIcon className="field-icon" />
            <input
              type={show ? 'text' : 'password'}
              placeholder="Password admin"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn toggle-pass"
              title="Tampilkan password"
              aria-label="Tampilkan password"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-login" title="Masuk" aria-label="Masuk">
            Masuk
            <ArrowRightIcon />
          </button>
        </form>
      </main>
    </div>
  )
}
