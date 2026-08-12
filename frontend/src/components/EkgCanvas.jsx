import React, { useEffect, useRef } from 'react'

export default function EkgCanvas() {
  const canvasRef = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || started.current) return
    started.current = true
    const ctx = canvas.getContext('2d')

    let w = 0
    let h = 0
    const resize = () => {
      w = canvas.clientWidth || 0
      h = canvas.clientHeight || 0
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const gauss = (t, mu, sig) => Math.exp(-((t - mu) ** 2) / (2 * sig * sig))
    const beat = (t) =>
      0.18 * gauss(t, 0.12, 0.025) +
      -0.12 * gauss(t, 0.33, 0.015) +
      1.0 * gauss(t, 0.38, 0.012) +
      -0.22 * gauss(t, 0.43, 0.015) +
      0.32 * gauss(t, 0.66, 0.04)

    const SPEED = 130
    const BEAT_PERIOD = 1.4
    let phase = 0
    let x = 0
    let last = performance.now()
    const samples = []
    let raf = 0

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (w > 0 && !document.hidden) {
        x += SPEED * dt
        phase = (phase + dt / BEAT_PERIOD) % 1
        const y = h / 2 - beat(phase) * h * 0.38
        samples.push({ x, y })

        const minX = x - w - 40
        while (samples.length && samples[0].x < minX) samples.shift()

        ctx.clearRect(0, 0, w, h)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        for (let i = 1; i < samples.length; i++) {
          const a = samples[i - 1]
          const b = samples[i]
          const screenA = a.x - (x - w)
          const screenB = b.x - (x - w)
          if (screenB < 0) continue
          const t = Math.min(1, Math.max(0, screenB / w))
          ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * t})`
          ctx.lineWidth = t > 0.8 ? 2.4 : 1.8
          ctx.beginPath()
          ctx.moveTo(screenA, a.y)
          ctx.lineTo(screenB, b.y)
          ctx.stroke()
        }

        const head = samples[samples.length - 1]
        if (head) {
          const sx = head.x - (x - w)
          const grad = ctx.createRadialGradient(sx, head.y, 0, sx, head.y, 10)
          grad.addColorStop(0, 'rgba(255,255,255,0.95)')
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(sx, head.y, 10, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="ekg-wrap">
      <canvas id="ekg-canvas" ref={canvasRef}></canvas>
    </div>
  )
}
