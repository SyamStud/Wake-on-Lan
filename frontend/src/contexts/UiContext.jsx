import React, { createContext, useCallback, useContext, useState } from 'react'
import DeviceModal from '../components/DeviceModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const UiContext = createContext(null)

export function useUi() {
  return useContext(UiContext)
}

export function UiProvider({ children }) {
  const [deviceModal, setDeviceModal] = useState({ open: false, device: null })
  const [confirmState, setConfirmState] = useState(null)

  const openDeviceModal = useCallback((device = null) => setDeviceModal({ open: true, device }), [])
  const closeDeviceModal = useCallback(() => setDeviceModal((s) => ({ ...s, open: false })), [])

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setConfirmState({ ...opts, resolve })
      }),
    [],
  )

  return (
    <UiContext.Provider value={{ openDeviceModal, confirm }}>
      {children}
      <DeviceModal
        open={deviceModal.open}
        device={deviceModal.device}
        onClose={closeDeviceModal}
      />
      {confirmState && <ConfirmDialog state={confirmState} onDone={() => setConfirmState(null)} />}
    </UiContext.Provider>
  )
}
