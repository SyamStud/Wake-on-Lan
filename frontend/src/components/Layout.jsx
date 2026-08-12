import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useUi } from '../contexts/UiContext.jsx'
import { DashGridIcon, ListIcon, LogoutIcon, PowerIcon, WifiIcon } from '../icons.jsx'

export default function Layout({ onLogout }) {
  const navigate = useNavigate()
  const { confirm } = useUi()

  const logout = async () => {
    const ok = await confirm({
      title: 'Keluar',
      message: 'Yakin ingin keluar dari sesi ini?',
      confirmText: 'Keluar',
      danger: true,
    })
    if (!ok) return
    await api('/api/logout', { method: 'POST' }).catch(() => {})
    onLogout()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }) => `sidebar-btn${isActive ? ' active' : ''}`

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <PowerIcon />
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={navClass} title="Dashboard" aria-label="Dashboard">
            <DashGridIcon />
            <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/devices" className={navClass} title="Device List" aria-label="Device List">
            <ListIcon />
            <span className="nav-label">Devices</span>
          </NavLink>
          <NavLink to="/scan" className={navClass} title="Scan" aria-label="Scan">
            <WifiIcon />
            <span className="nav-label">Scan</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button id="logout-btn" className="sidebar-btn" title="Keluar" aria-label="Keluar" onClick={logout}>
            <LogoutIcon />
            <span className="nav-label">Keluar</span>
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="app-header">
          <h1 className="page-title">Wake on LAN</h1>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
