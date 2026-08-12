import React, { useEffect, useRef, useState } from 'react'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useUi } from '../contexts/UiContext.jsx'
import { CheckIcon, DotsIcon, EditIcon, PlusIcon, TrashIcon, XIcon, ZapIcon, PowerIcon } from '../icons.jsx'

export default function DeviceModal({ open, device, onClose }) {
  const dlgRef = useRef(null)
  const { saveDevice } = useDevices()
  const toast = useToast()

  const [form, setForm] = useState({
    name: '',
    mac: '',
    broadcast: '255.255.255.255',
    wol_port: 9,
    ssh_host: '',
    ssh_port: 22,
    ssh_user: '',
    ssh_auth: 'password',
    ssh_key_path: '',
    ssh_password: '',
    schedule_enabled: false,
    schedule_on: '08:00',
    schedule_off: '22:00',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        name: device ? device.name : '',
        mac: device ? device.mac : '',
        broadcast: device ? device.broadcast : '255.255.255.255',
        wol_port: device ? device.wol_port : 9,
        ssh_host: device ? (device.ssh_host || '') : '',
        ssh_port: device ? device.ssh_port : 22,
        ssh_user: device ? (device.ssh_user || '') : '',
        ssh_auth: device ? device.ssh_auth : 'password',
        ssh_key_path: device ? (device.ssh_key_path || '') : '',
        ssh_password: '',
        schedule_enabled: device ? !!device.schedule_enabled : false,
        schedule_on: device ? (device.schedule_on || '08:00') : '08:00',
        schedule_off: device ? (device.schedule_off || '22:00') : '22:00',
      })
      setError('')
      const dlg = dlgRef.current
      if (dlg && !dlg.open) dlg.showModal()
    } else {
      const dlg = dlgRef.current
      if (dlg && dlg.open) dlg.close()
    }
  }, [open, device])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await saveDevice(
        {
          name: form.name,
          mac: form.mac,
          broadcast: form.broadcast,
          wol_port: Number(form.wol_port),
          ssh_host: form.ssh_host || null,
          ssh_port: Number(form.ssh_port),
          ssh_user: form.ssh_user || null,
          ssh_auth: form.ssh_auth,
          ssh_key_path: form.ssh_key_path || null,
          ssh_password: form.ssh_password || null,
          schedule_enabled: form.schedule_enabled,
          schedule_on: form.schedule_on || null,
          schedule_off: form.schedule_off || null,
        },
        device ? device.id : null,
      )
      toast(device ? 'Device diperbarui' : 'Device ditambahkan')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog ref={dlgRef} id="device-modal" className="modal">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div className="modal-head">
          <h2>{device ? 'Edit Device' : 'Tambah Device'}</h2>
          <button type="button" className="icon-btn ghost" title="Tutup" aria-label="Tutup" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className="modal-body">
          <div className="section">
            <p className="section-title">Device</p>
            <div className="grid-2">
              <label className="grow">
                Nama *
                <input type="text" required placeholder="cth: PC Kamar" value={form.name} onChange={set('name')} />
              </label>
              <label>
                MAC Address *
                <input
                  type="text"
                  required
                  placeholder="AA:BB:CC:DD:EE:FF"
                  pattern="([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}"
                  value={form.mac}
                  onChange={set('mac')}
                />
              </label>
            </div>
            <div className="grid-2">
              <label className="grow">
                Broadcast *
                <input type="text" required placeholder="192.168.1.255" value={form.broadcast} onChange={set('broadcast')} />
              </label>
              <label>
                Port WoL
                <input type="number" min="1" max="65535" value={form.wol_port} onChange={set('wol_port')} />
              </label>
            </div>
          </div>
          <div className="section">
            <p className="section-title">SSH</p>
            <div className="grid-2">
              <label className="grow">
                Host / IP
                <input type="text" placeholder="192.168.1.50" value={form.ssh_host} onChange={set('ssh_host')} />
              </label>
              <label>
                Port
                <input type="number" min="1" max="65535" value={form.ssh_port} onChange={set('ssh_port')} />
              </label>
            </div>
            <div className="grid-2">
              <label className="grow">
                Username
                <input type="text" placeholder="cth: lenovo" value={form.ssh_user} onChange={set('ssh_user')} />
              </label>
              <label>
                Metode Auth
                <select value={form.ssh_auth} onChange={set('ssh_auth')}>
                  <option value="key">SSH Key</option>
                  <option value="password">Password</option>
                </select>
              </label>
            </div>
            {form.ssh_auth === 'key' ? (
              <label>
                Path Key
                <input type="text" placeholder="/home/user/.ssh/id_ed25519" value={form.ssh_key_path} onChange={set('ssh_key_path')} />
              </label>
            ) : (
              <label>
                Password SSH
                <input type="password" autoComplete="new-password" value={form.ssh_password} onChange={set('ssh_password')} />
              </label>
            )}
          </div>
          <div className="section">
            <p className="section-title">Jadwal Nyalakan / Matikan</p>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={form.schedule_enabled}
                onChange={(e) => setForm((f) => ({ ...f, schedule_enabled: e.target.checked }))}
              />
              <span>Aktifkan jadwal otomatis</span>
            </label>
            <div className="grid-2">
              <label>
                Nyalakan jam
                <input type="time" value={form.schedule_on} onChange={set('schedule_on')} disabled={!form.schedule_enabled} />
              </label>
              <label>
                Matikan jam
                <input type="time" value={form.schedule_off} onChange={set('schedule_off')} disabled={!form.schedule_enabled} />
              </label>
            </div>
            <p className="schedule-hint">
              Otomatis kirim magic packet jam nyala, dan shutdown via SSH jam mati (bisa lintas tengah malam).
            </p>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-save" disabled={saving}>
            Simpan
          </button>
        </div>
      </form>
    </dialog>
  )
}
