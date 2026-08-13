import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { DotsIcon, EditIcon, MonitorIcon, PowerIcon, TerminalIcon, TrashIcon, ZapIcon, ContainerIcon } from '../icons.jsx'

export default function DeviceMenu({ device, onWake, onShutdown, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const menuRef = useRef(null)
  const btnRectRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !menu || !btnRectRef.current) return
    const rect = btnRectRef.current
    const menuW = menu.offsetWidth || 180
    const menuH = menu.offsetHeight
    menu.style.position = 'fixed'
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 8))}px`
    const maxBottom = window.innerHeight - 16
    if (rect.bottom + 6 + menuH > maxBottom) {
      menu.style.top = `${Math.max(8, rect.top - menuH - 6)}px`
    } else {
      menu.style.top = `${rect.bottom + 6}px`
    }
  }, [open])

  const toggle = (e) => {
    const willOpen = !open
    if (willOpen) btnRectRef.current = e.currentTarget.getBoundingClientRect()
    setOpen(!open)
  }

  const act = (fn) => (e) => {
    e.stopPropagation()
    setOpen(false)
    fn()
  }

  return (
    <div className="device-actions-cell" ref={wrapRef}>
      <button className="row-menu-btn" title="Menu" aria-label="Menu" onClick={toggle}>
        <DotsIcon />
      </button>
      {open &&
        createPortal(
          <div className="row-menu-dropdown" ref={menuRef}>
            <button className="menu-item wake-item" onClick={act(onWake)}>
              <ZapIcon /> <span>Wake</span>
            </button>
            {device.ssh_host && device.ssh_user && (
              <>
                <button className="menu-item shutdown-item" onClick={act(onShutdown)}>
                  <PowerIcon /> <span>Shutdown</span>
                </button>
                <button
                  className="menu-item"
                  onClick={act(() => navigate(`/terminal/${device.id}`))}
                >
                  <TerminalIcon /> <span>Terminal</span>
                </button>
                <button
                  className="menu-item"
                  onClick={act(() => navigate(`/remote/${device.id}?port=5900`))}
                >
                  <MonitorIcon /> <span>Remote</span>
                </button>
                <button
                  className="menu-item"
                  onClick={act(() => navigate(`/containers/${device.id}`))}
                >
                  <ContainerIcon /> <span>Container</span>
                </button>
              </>
            )}
            <div className="menu-divider"></div>
            <button className="menu-item" onClick={act(onEdit)}>
              <EditIcon /> <span>Edit</span>
            </button>
            <button className="menu-item danger-text" onClick={act(onDelete)}>
              <TrashIcon /> <span>Hapus</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
