// Home page — landing screen shown at the root route ("/").
//
// Contains:
//   • Nav bar with the MotionWave wordmark and a live connection pill.
//   • Hero section with the logo, app name, tagline, and "Start Session" CTA.
//   • A decorative canvas that renders an animated sinusoidal wave — the same
//     geometry as the rehabilitation game but at low opacity and without any
//     interaction, giving the patient a preview of the exercise metaphor.

import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBackendConnection } from '../hooks/useBackendConnection'
import { Logo } from '../components/Logo'
import './Home.css'

// ConnectionPill — small badge in the nav bar showing the ESP32 link status.
// Maps the three WebSocket states to human-readable labels and CSS modifier classes.
function ConnectionPill({ status }) {
  return (
    <div className={`conn-pill conn-pill--${status}`}>
      <span className="conn-pill__dot" />
      <span className="conn-pill__label">
        {status === 'connected'    ? 'Connected'   :
         status === 'connecting'   ? 'Connecting…' :
                                     'No device'}
      </span>
    </div>
  )
}

export default function Home() {
  const navigate   = useNavigate()
  const decoRef    = useRef(null)
  const { status } = useBackendConnection()

  // ── Decorative background wave canvas ─────────────────────────────────────
  // Renders a slow-scrolling sinusoidal wave with two faint border lines —
  // the same corridor geometry used in the game — at reduced opacity so it
  // reads as decoration rather than an interactive element.
  //
  // Runs its own requestAnimationFrame loop independent of the game canvas,
  // started once on mount and cancelled on unmount.  No game logic is present.
  useEffect(() => {
    const canvas = decoRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    let offset = 0   // scroll accumulator, incremented each frame

    // HiDPI support: same pattern as RehabCanvas — scale backing buffer by dpr.
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
      // Skip rendering until the element has a layout box (e.g. on first paint).
      if (cssW === 0 || cssH === 0) { rafId = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, cssW, cssH)

      // Read the primary brand colour from CSS so the wave matches the theme.
      const style   = getComputedStyle(canvas)
      const primary = (style.getPropertyValue('--color-primary') || '#2563EB').trim()

      offset += 0.45   // slow scroll speed (vs. 1.8 × speed in the game)

      const amp  = cssH * 0.22   // amplitude: 22 % of canvas height
      const freq = 0.007         // spatial frequency (radians per CSS pixel)
      const gap  = 48            // half-width of the decorative corridor in CSS pixels

      const waveY     = (wx) => cssH / 2 + amp * Math.sin(wx * freq)
      const waveSlope = (wx) => amp * freq * Math.cos(wx * freq)

      // Draw the centre wave line at 15 % opacity.
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

      // Draw the two border lines at 8 % opacity.
      // The sign variable (+1 / -1) selects which side of the wave (top or bottom).
      // Each border point is offset `gap` pixels along the perpendicular normal:
      //   tangent = (1, slope); normal = (-slope, 1); unit normal = normal / |normal|
      // Multiplying by sign flips the normal to the opposite side.
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
        {/* Shows the ESP32 link state; does not block the user from starting */}
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

        {/* aria-hidden: the canvas is purely decorative and conveys no information */}
        <div className="home-deco" aria-hidden="true">
          <canvas ref={decoRef} className="home-deco__canvas" />
        </div>
      </div>
    </div>
  )
}
