import React, { useEffect, useRef } from 'react'
import { api } from '../api.js'

export default function StatusSparkline({ deviceId }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let timer = null

    const draw = (samples) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = canvas.clientWidth || 96
      const h = canvas.clientHeight || 22
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const n = samples.length
      if (n === 0) {
        ctx.fillStyle = '#e2e8f0'
        ctx.fillRect(0, 0, w, h)
        return
      }
      const barW = Math.max(1, w / n)
      for (let i = 0; i < n; i++) {
        const s = samples[i]
        const online = typeof s.online_pct === 'number' ? s.online_pct >= 50 : s.online
        ctx.fillStyle = online ? '#4ade80' : '#e2e8f0'
        ctx.fillRect(i * barW, 0, barW + 0.5, h)
      }
      const last = samples[n - 1]
      const lastOnline = typeof last.online_pct === 'number' ? last.online_pct >= 50 : last.online
      ctx.fillStyle = lastOnline ? '#16a34a' : '#cbd5e1'
      ctx.fillRect(w - barW, 0, barW, h)
    }

    const load = async () => {
      try {
        const res = await api(`/api/devices/${deviceId}/history?hours=24`)
        if (!cancelled) draw(res.samples || [])
      } catch {}
    }
    load()
    timer = setInterval(load, 60000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [deviceId])

  return (
    <div className="status-sparkline" title="Status 24 jam terakhir (hijau = online)">
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}
