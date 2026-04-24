import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBackendConnection } from '../hooks/useBackendConnection'
import { Logo } from '../components/Logo'
import './Home.css'

function ConnectionPill({ status }) {
  return (
    <div className={`conn-pill conn-pill--${status}`}>
      <span className="conn-pill__dot" />
      <span className="conn-pill__label">
        {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'No device'}
      </span>
    </div>
  )
}

export default function Home() {
  const navigate   = useNavigate()
  const decoRef    = useRef(null)
  const { status } = useBackendConnection()

  useEffect(() => {
    const canvas = decoRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    let offset = 0

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(canvas.offsetWidth  * dpr)
      canvas.height = Math.round(canvas.offsetHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(syncSize)
    observer.observe(canvas)
    syncSize()

    const draw = () => {
      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      if (cssW === 0 || cssH === 0) { rafId = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, cssW, cssH)

      const style   = getComputedStyle(canvas)
      const primary = (style.getPropertyValue('--color-primary') || '#2563EB').trim()

      offset += 0.45

      const amp  = cssH * 0.22
      const freq = 0.007
      const gap  = 48

      const waveY     = (wx) => cssH / 2 + amp * Math.sin(wx * freq)
      const waveSlope = (wx) => amp * freq * Math.cos(wx * freq)

      ctx.globalAlpha = 0.15
      ctx.beginPath()
      for (let sx = 0; sx <= cssW; sx += 2) {
        const wy = waveY(sx + offset)
        sx === 0 ? ctx.moveTo(sx, wy) : ctx.lineTo(sx, wy)
      }
      ctx.strokeStyle = primary
      ctx.lineWidth   = 2
      ctx.lineJoin    = 'round'
      ctx.stroke()

      ctx.globalAlpha = 0.08
      ctx.lineWidth   = 1

      for (const sign of [1, -1]) {
        ctx.beginPath()
        for (let sx = 0; sx <= cssW; sx += 2) {
          const wx = sx + offset
          const wy = waveY(wx)
          const m  = waveSlope(wx)
          const L  = Math.sqrt(1 + m * m)
          const px = sx + sign * m * gap / L
          const py = wy - sign * gap / L
          sx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.strokeStyle = primary
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => { observer.disconnect(); cancelAnimationFrame(rafId) }
  }, [])

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav__brand">
          <Logo size={26} />
          <span className="home-nav__wordmark">MotionWave</span>
        </div>
        <ConnectionPill status={status} />
      </nav>

      <div className="home-body">
        <section className="hero">
          <Logo size={80} className="hero__logo" />
          <h1 className="hero__title">MotionWave</h1>
          <span className="hero__sub">Ankle Rehabilitation</span>
          <button className="cta-btn" onClick={() => navigate('/setup')}>
            Start Session →
          </button>
        </section>

        <div className="home-deco" aria-hidden="true">
          <canvas ref={decoRef} className="home-deco__canvas" />
        </div>
      </div>

    </div>
  )
}
