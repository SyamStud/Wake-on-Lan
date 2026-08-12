import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from '../components/Toast.jsx'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState(null)
  const timer = useRef(null)
  const toast = useCallback((text, type = 'ok') => {
    clearTimeout(timer.current)
    setToastState({ text, type })
    timer.current = setTimeout(() => setToastState(null), 4000)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toastState && <Toast text={toastState.text} type={toastState.type} />}
    </ToastContext.Provider>
  )
}
