import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useToast } from './ToastContext.jsx'

const DevicesContext = createContext(null)

export function useDevices() {
  return useContext(DevicesContext)
}

export function DevicesProvider({ children }) {
  const [devices, setDevices] = useState([])
  const [statuses, setStatuses] = useState({})
  const [wakeCount, setWakeCount] = useState(0)
  const devicesRef = useRef([])
  devicesRef.current = devices
  const toast = useToast()

  const checkStatus = useCallback(async (device) => {
    try {
      const res = await api(`/api/devices/${device.id}/status`)
      setStatuses((s) => ({ ...s, [device.id]: res.online }))
    } catch {
      setStatuses((s) => ({ ...s, [device.id]: false }))
    }
  }, [])

  const reload = useCallback(async () => {
    const list = await api('/api/devices')
    setDevices(list)
    return list
  }, [])

  const reloadWakeCount = useCallback(async () => {
    try {
      const res = await api('/api/devices/wake-count')
      setWakeCount(res.count || 0)
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const [list] = await Promise.all([reload(), reloadWakeCount()])
        if (!cancelled && list) list.forEach((d) => checkStatus(d))
      } catch (err) {
        toast(err.message, 'error')
      }
    }
    boot()
    const interval = setInterval(() => {
      devicesRef.current.forEach((d) => checkStatus(d))
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [reload, reloadWakeCount, checkStatus, toast])

  const wakeDevice = useCallback(async (id) => {
    const res = await api(`/api/devices/${id}/wake`, { method: 'POST' })
    if (typeof res.wake_count === 'number') setWakeCount(res.wake_count)
    return res
  }, [])

  const shutdownDevice = useCallback(async (id) => {
    return api(`/api/devices/${id}/shutdown`, { method: 'POST' })
  }, [])

  const deleteDevice = useCallback(async (id) => {
    await api(`/api/devices/${id}`, { method: 'DELETE' })
    await reload()
  }, [reload])

  const saveDevice = useCallback(
    async (payload, id) => {
      if (id) {
        await api(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
      }
      await reload()
    },
    [reload],
  )

  const value = {
    devices,
    statuses,
    wakeCount,
    reload,
    checkStatus,
    wakeDevice,
    shutdownDevice,
    deleteDevice,
    saveDevice,
  }
  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>
}
