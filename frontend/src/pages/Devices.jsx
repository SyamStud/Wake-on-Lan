import React from 'react'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { useUi } from '../contexts/UiContext.jsx'
import { MonitorIcon } from '../icons.jsx'
import DeviceTable from '../components/DeviceTable.jsx'

export default function Devices() {
  const { devices } = useDevices()
  const { openDeviceModal } = useUi()

  return (
    <div className="scan-page">
      <div className="toolbar">
        <div className="toolbar-left">
          <h2 style={{ marginBottom: 10 }}>Device List</h2>
        </div>
        <div className="scan-actions">
          <button id="page-add-btn" className="btn-add-device" onClick={() => openDeviceModal()}>
            Add Device
          </button>
        </div>
      </div>

      <div className="table-section">
        <DeviceTable mode="list" />
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
  )
}
