import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import DeviceModal from '../components/DeviceModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const UiContext = createContext(null)

export function useUi() {
  return useContext(UiContext)
}

export function UiProvider({ children }) {
  const [deviceModal, setDeviceModal] = useState({ open: false, device: null })
  const [confirmState, setConfirmState] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('wol_theme') || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('wol_theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

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
    <UiContext.Provider value={{ openDeviceModal, confirm, theme, toggleTheme }}>
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
