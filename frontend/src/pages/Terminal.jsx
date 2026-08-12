import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useDevices } from '../contexts/DevicesContext.jsx'
import { ArrowLeftIcon } from '../icons.jsx'

const STATUS_LABEL = {
  connecting: 'Menghubungkan…',
  connected: 'Terhubung',
  error: 'Gagal terhubung',
  closed: 'Sesi ditutup',
}

export default function TerminalPage() {
  const { id } = useParams()
  const { devices } = useDevices()
  const device = devices.find((d) => String(d.id) === id)
  const containerRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const navigate = useNavigate()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
      scrollback: 5000,
      theme: {
        background: '#16161f',
        foreground: '#e2e8f0',
        cursor: '#4B6BFB',
        selectionBackground: 'rgba(75, 107, 251, .35)',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    term.focus()
    setTimeout(() => fit.fit(), 100)

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${location.host}/api/terminal?deviceId=${id}`)

    ws.onopen = () => {
      setStatus('connected')
      term.writeln('\x1b[32mTerhubung. Ketik "exit" atau tutup tab untuk keluar.\x1b[0m\r\n')
      sendResize()
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'output') term.write(msg.data)
      else if (msg.type === 'error') {
        setStatus('error')
        term.writeln(`\x1b[31m${msg.data?.message || 'Error'}\x1b[0m\r\n`)
      } else if (msg.type === 'exit') {
        setStatus('closed')
        term.writeln(`\x1b[33m${msg.data?.message || 'Sesi ditutup'}\x1b[0m\r\n`)
      }
    }
    ws.onclose = () => setStatus((s) => (s === 'error' ? s : 'closed'))

    function sendResize() {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
    const onData = (d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: d }))
    }
    const onResize = () => {
      fit.fit()
      sendResize()
    }
    const onDblClick = () => sendResize()

    term.onData(onData)
    window.addEventListener('resize', onResize)
    document.addEventListener('dblclick', onDblClick)

    return () => {
      ws.close()
      term.dispose()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('dblclick', onDblClick)
    }
  }, [id])

  return (
    <div className="terminal-page">
      <div className="terminal-toolbar">
        <button className="icon-btn ghost" title="Kembali" aria-label="Kembali" onClick={() => navigate('/devices')}>
          <ArrowLeftIcon />
        </button>
        <span className="terminal-title">
          {device ? device.name : 'Terminal'} <em>SSH</em>
        </span>
        <span className={`terminal-status ${status}`}>{STATUS_LABEL[status]}</span>
        <span className="terminal-spacer"></span>
        <button className="btn-cancel terminal-close" onClick={() => navigate('/devices')}>
          Tutup
        </button>
      </div>
      <div className="terminal-wrap" ref={containerRef}></div>
    </div>
  )
}
