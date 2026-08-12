import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { useUi } from '../contexts/UiContext.jsx'
import { CopyIcon, MoonIcon, SunIcon } from '../icons.jsx'

export default function Settings() {
  const { confirm, theme, toggleTheme } = useUi()
  const toast = useToast()
  const [active, setActive] = useState(false)
  const [newKey, setNewKey] = useState(null)

  const load = async () => {
    try {
      const res = await api('/api/settings/api-key')
      setActive(!!res.active)
    } catch {}
  }

  useEffect(() => {
    load()
  }, [])

  const generate = async () => {
    const ok = await confirm({
      title: 'Buat API Key Baru',
      message: 'Key lama akan langsung dinonaktifkan. Lanjutkan?',
      confirmText: 'Buat Key',
    })
    if (!ok) return
    try {
      const res = await api('/api/settings/api-key', { method: 'POST' })
      setNewKey(res.apiKey)
      setActive(true)
      toast('API key baru dibuat')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const revoke = async () => {
    const ok = await confirm({
      title: 'Cabut API Key',
      message: 'Semua automation yang memakai key ini akan berhenti berfungsi. Lanjutkan?',
      confirmText: 'Cabut',
      danger: true,
    })
    if (!ok) return
    try {
      await api('/api/settings/api-key', { method: 'DELETE' })
      setActive(false)
      setNewKey(null)
      toast('API key dicabut')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(newKey)
      toast('API key disalin ke clipboard')
    } catch {
      toast('Gagal menyalin — salin manual', 'error')
    }
  }

  return (
    <div className="content-body">
      <div className="content-main settings-main">
        <div className="table-section settings-card">
          <div className="settings-head">
            <h2>API Key</h2>
            <span className={`act-badge ${active ? 'ok' : 'neutral'}`}>
              {active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="settings-desc">
            Akses API tanpa login browser — untuk automation (cron, script, Home Assistant).
            Kirim key sebagai header <code>Authorization: Bearer &lt;key&gt;</code> atau{' '}
            <code>X-API-Key: &lt;key&gt;</code>.
          </p>

          {newKey && (
            <div className="api-key-box">
              <code className="api-key-value">{newKey}</code>
              <button className="icon-btn ghost" title="Salin" aria-label="Salin" onClick={copy}>
                <CopyIcon />
              </button>
              <p className="api-key-warn">
                ⚠️ Salin sekarang — key tidak bisa ditampilkan lagi setelah halaman ini ditutup.
              </p>
            </div>
          )}

          <div className="settings-actions">
            {!active && (
              <button className="btn-save" onClick={generate}>
                Buat API Key
              </button>
            )}
            {active && !newKey && (
              <button className="btn-save" onClick={generate}>
                Buat Key Baru
              </button>
            )}
            {active && (
              <button className="btn-danger" onClick={revoke}>
                Cabut Key
              </button>
            )}
          </div>
        </div>

        <div className="table-section settings-card">
          <div className="settings-head">
            <h2>Tampilan</h2>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-icon">
                {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
              </span>
              <div>
                <span className="settings-row-label">Mode Gelap</span>
                <span className="settings-row-sub">
                  {theme === 'dark' ? 'Aktif — tema gelap dipakai' : 'Nonaktif — tema terang dipakai'}
                </span>
              </div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
              <span className="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
