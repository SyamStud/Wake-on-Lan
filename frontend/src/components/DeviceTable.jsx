import React from 'react'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { useUi } from '../contexts/UiContext.jsx'
import { EditSmallIcon, SshIcon } from '../icons.jsx'
import DeviceMenu from './DeviceMenu.jsx'

export function Badge({ online }) {
  if (online === true) return <span className="pill online"><i></i>Online</span>
  if (online === false) return <span className="pill offline"><i></i>Offline</span>
  return <span className="pill unknown"><i></i>…</span>
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #6E9CFF, #A8C8FF)',
  'linear-gradient(135deg, #7B8CFF, #B3BCFF)',
  'linear-gradient(135deg, #FFB347, #FFD580)',
  'linear-gradient(135deg, #4ECDC4, #7EDDD6)',
  'linear-gradient(135deg, #C77DFF, #DAA6FF)',
  'linear-gradient(135deg, #FF6B9D, #FF9EC6)',
  'linear-gradient(135deg, #45B7D1, #7DD3E8)',
  'linear-gradient(135deg, #96CEB4, #B5DFC9)',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function DeviceTable({ mode, devices: propDevices }) {
  const { devices: allDevices, statuses, wakeDevice, shutdownDevice, deleteDevice, checkStatus } = useDevices()
  const list = propDevices || allDevices
  const toast = useToast()
  const { confirm, openDeviceModal } = useUi()

  const onWake = async (device) => {
    const ok = await confirm({
      title: 'Nyalakan PC',
      message: `Kirim magic packet Wake-on-LAN ke "${device.name}"?`,
      confirmText: 'Nyalakan',
    })
    if (!ok) return
    try {
      const res = await wakeDevice(device.id)
      toast(res.message)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const onShutdown = async (device) => {
    const ok = await confirm({
      title: 'Matikan PC',
      message: `PC "${device.name}" akan dimatikan sekarang. Lanjutkan?`,
      confirmText: 'Matikan',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await shutdownDevice(device.id)
      toast(res.message)
      setTimeout(() => checkStatus(device), 8000)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const onDelete = async (device) => {
    const ok = await confirm({
      title: 'Hapus Device',
      message: `Device "${device.name}" akan dihapus permanen. Lanjutkan?`,
      confirmText: 'Hapus',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteDevice(device.id)
      toast('Device dihapus')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (mode === 'list') {
    return (
      <div className="table-scroll">
        <table id="device-table" className="scan-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Nama</th>
              <th>MAC Address</th>
              <th>Broadcast</th>
              <th>Status</th>
              <th>SSH</th>
              <th>Jadwal</th>
            </tr>
          </thead>
          <tbody id="device-rows">
          {list.map((d) => {
            const initial = (d.name || '?').trim().charAt(0).toUpperCase()
            return (
              <tr className="device-table-row" data-id={d.id} key={d.id}>
                <td className="device-actions-cell">
                  <DeviceMenu
                    device={d}
                    onWake={() => onWake(d)}
                    onShutdown={() => onShutdown(d)}
                    onEdit={() => openDeviceModal(d)}
                    onDelete={() => onDelete(d)}
                  />
                </td>
                <td>
                  <div className="device-info table-info">
                    <span className="device-avatar" style={{ background: getAvatarColor(d.name || '') }}>
                      {initial}
                    </span>
                    <div className="device-text">
                      <h4>{d.name}</h4>
                    </div>
                  </div>
                </td>
                <td>{d.mac ? <span className="scan-mac">{d.mac}</span> : '—'}</td>
                <td>{d.broadcast}</td>
                <td>
                  <span className="device-status">
                    <Badge online={statuses[d.id]} />
                  </span>
                </td>
                <td className="device-ssh">
                  {d.ssh_host ? `${d.ssh_user || 'user'}@${d.ssh_host}` : '—'}
                </td>
                <td>
                  {d.schedule_enabled && d.schedule_on && d.schedule_off ? (
                    <span className="schedule-badge">
                      {d.schedule_on} – {d.schedule_off}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        </table>
      </div>
    )
  }

  return (
    <div id="device-rows-dashboard" className="device-table">
      {list.map((d) => {
        const initial = (d.name || '?').trim().charAt(0).toUpperCase()
        return (
          <div className="device-row" data-id={d.id} key={d.id}>
            <div className="device-info">
              <span className="device-avatar" style={{ background: getAvatarColor(d.name || '') }}>
                {initial}
              </span>
              <div className="device-text">
                <h4>{d.name}</h4>
                <p>{d.mac}</p>
              </div>
              <button className="edit-link-btn" title="Edit" onClick={() => openDeviceModal(d)}>
                <EditSmallIcon />
              </button>
            </div>
            <div className="device-network">{d.broadcast}</div>
            <div className="device-status">
              <Badge online={statuses[d.id]} />
            </div>
            <div className="device-ssh">
              {d.ssh_host ? (
                <>
                  <SshIcon /> <span>{d.ssh_user || 'user'}</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="device-actions-cell">
              <DeviceMenu
                device={d}
                onWake={() => onWake(d)}
                onShutdown={() => onShutdown(d)}
                onEdit={() => openDeviceModal(d)}
                onDelete={() => onDelete(d)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
