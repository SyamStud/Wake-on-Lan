import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api } from './api.js'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { DevicesProvider } from './contexts/DevicesContext.jsx'
import { UiProvider } from './contexts/UiContext.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Devices from './pages/Devices.jsx'
import Login from './pages/Login.jsx'
import Scan from './pages/Scan.jsx'
import TerminalPage from './pages/Terminal.jsx'
import Remote from './pages/Remote.jsx'
import Containers from './pages/Containers.jsx'
import Activity from './pages/Activity.jsx'
import Settings from './pages/Settings.jsx'

function RequireAuth({ authed }) {
  if (!authed) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api('/api/me')
      .then((m) => setAuthed(!!m.authed))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null

  return (
    <ToastProvider>
      {authed ? (
        <DevicesProvider>
          <UiProvider>
            <Routes>
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route element={<RequireAuth authed={authed} />}>
                <Route element={<Layout onLogout={() => setAuthed(false)} />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/scan" element={<Scan />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/terminal/:id" element={<TerminalPage />} />
                  <Route path="/remote/:id" element={<Remote />} />
                  <Route path="/containers/:id" element={<Containers />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </UiProvider>
        </DevicesProvider>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onSuccess={() => setAuthed(true)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </ToastProvider>
  )
}
