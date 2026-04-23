import { useEffect, useRef } from 'react'
import './RehabCanvas.css'

const CIRCLE_RADIUS = 24
const CIRCLE_X_FRAC = 0.80
const SCROLL_SPEED  = 1.8
const MAX_ANGLE     = 30
const COLL_RADIUS   = 11
const COLL_COUNT    = 14
const COLL_SPACING  = 0.10

function RehabCanvas({ angle = 0, isPlaying = false, amplitude = 0.26, speed = 1.5, onScore }) {
  const canvasRef       = useRef(null)
  const offsetRef       = useRef(0)
  const angleRef        = useRef(angle)
  const isPlayingRef    = useRef(isPlaying)
  const amplitudeRef    = useRef(amplitude)
  const speedRef        = useRef(speed)
  const onScoreRef      = useRef(onScore)
  const collectiblesRef = useRef([])
  const nextIdRef       = useRef(0)

  useEffect(() => { angleRef.current     = angle },     [angle])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { amplitudeRef.current = amplitude }, [amplitude])
  useEffect(() => { speedRef.current     = speed },     [speed])
  useEffect(() => { onScoreRef.current   = onScore },   [onScore])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(canvas.offsetWidth  * dpr)
      canvas.height = Math.round(canvas.offsetHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(syncSize)
    observer.observe(canvas)
    syncSize()

    const cssW0 = canvas.offsetWidth
    collectiblesRef.current = Array.from({ length: COLL_COUNT }, (_, i) => ({
      id: nextIdRef.current++,
      u:  cssW0 * 0.08 + i * cssW0 * COLL_SPACING,
    }))

    const refillCollectibles = (cssW, offset) => {
      collectiblesRef.current = collectiblesRef.current.filter(
        c => (c.u - offset) > -(COLL_RADIUS * 3),
      )
      while (collectiblesRef.current.length < COLL_COUNT) {
        const maxU = collectiblesRef.current.reduce(
          (m, c) => Math.max(m, c.u),
          offset + cssW * 0.5,
        )
        collectiblesRef.current.push({
          id: nextIdRef.current++,
          u:  maxU + cssW * COLL_SPACING + Math.random() * 35,
        })
      }
    }

    const drawGem = (x, y, t) => {
      const pulse = 0.88 + 0.12 * Math.sin(t / 320 + x * 0.012)
      const R = COLL_RADIUS * pulse

      ctx.shadowColor = 'rgba(255, 185, 0, 0.55)'
      ctx.shadowBlur  = 14

      const g = ctx.createRadialGradient(x - R * 0.28, y - R * 0.30, 0, x, y, R)
      g.addColorStop(0,   '#fff8cc')
      g.addColorStop(0.4, '#ffd166')
      g.addColorStop(1,   '#e09000')
      ctx.beginPath()
      ctx.arc(x, y, R, 0, 2 * Math.PI)
      ctx.fillStyle = g
      ctx.fill()

      ctx.shadowBlur  = 0
      ctx.strokeStyle = 'rgba(180, 110, 0, 0.35)'
      ctx.lineWidth   = 1
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(x - R * 0.25, y - R * 0.28, R * 0.22, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.50)'
      ctx.fill()
    }

    const drawCircle = (cx, cy) => {
      const R = CIRCLE_RADIUS

      ctx.shadowColor   = 'rgba(180, 20, 30, 0.35)'
      ctx.shadowBlur    = 14
      ctx.shadowOffsetY = 3

      const sphere = ctx.createRadialGradient(
        cx - R * 0.30, cy - R * 0.34, R * 0.04,
        cx + R * 0.05, cy + R * 0.05, R * 1.05,
      )
      sphere.addColorStop(0,    '#ff8f8f')
      sphere.addColorStop(0.35, '#e63946')
      sphere.addColorStop(0.75, '#c1121f')
      sphere.addColorStop(1,    '#7b0008')

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = sphere
      ctx.fill()

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

      ctx.strokeStyle = 'rgba(80, 0, 0, 0.30)'
      ctx.lineWidth   = 1
      ctx.stroke()

      const spec = ctx.createRadialGradient(
        cx - R * 0.28, cy - R * 0.32, 0,
        cx - R * 0.22, cy - R * 0.26, R * 0.42,
      )
      spec.addColorStop(0,   'rgba(255,255,255,0.72)')
      spec.addColorStop(0.5, 'rgba(255,255,255,0.20)')
      spec.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = spec
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx - R * 0.26, cy - R * 0.30, R * 0.10, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fill()
    }

    const draw = () => {
      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      ctx.clearRect(0, 0, cssW, cssH)

      const offset = offsetRef.current
      const amp    = amplitudeRef.current
      const now    = performance.now()

      // ── YOUR WAVE DRAWING CODE GOES HERE ──────────────────────────────
      // Available: ctx, cssW, cssH, offset (scroll position), amp, now
      // ─────────────────────────────────────────────────────────────────
      const waveAmp  = cssH * amp
      const waveFreq = 0.008

      const waveY = (worldX) =>
        cssH / 2 + waveAmp * Math.sin(worldX * waveFreq)

      const WAVE_STROKE = 5


      const BORDER_GAP = 38  // desired perpendicular distance from centre line to each border

      // Cap the gap to 90% of the tightest radius of curvature (at the peaks).
      // Below that threshold the inner offset curve self-intersects, forming a cusp.
      const Rmin = waveAmp > 0 ? 1 / (waveAmp * waveFreq * waveFreq) : Infinity
      const gap  = Math.min(BORDER_GAP, Rmin * 0.9)

      // Slope of the wave at worldX — needed to compute the perpendicular direction
      const waveSlope = (worldX) => waveAmp * waveFreq * Math.cos(worldX * waveFreq)

      // Centre line
      ctx.beginPath()
      for (let sx = 0; sx <= cssW; sx += 2) {
        const wy = waveY(sx + offset)
        sx === 0 ? ctx.moveTo(sx, wy) : ctx.lineTo(sx, wy)
      }
      ctx.strokeStyle = 'rgba(79, 110, 247, 0.95)'
      ctx.lineWidth   = WAVE_STROKE
      ctx.lineJoin    = 'round'
      ctx.lineCap     = 'round'
      ctx.stroke()

      // Top border — offset perpendicular to the wave
      ctx.beginPath()
      for (let sx = 0; sx <= cssW; sx += 2) {
        const worldX = sx + offset
        const wy = waveY(worldX)
        const m  = waveSlope(worldX)
        const L  = Math.sqrt(1 + m * m)
        sx === 0
          ? ctx.moveTo(sx + m * gap / L, wy - gap / L)
          : ctx.lineTo(sx + m * gap / L, wy - gap / L)
      }
      ctx.strokeStyle = 'rgba(79, 110, 247, 0.50)'
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // Bottom border — offset perpendicular to the wave
      ctx.beginPath()
      for (let sx = 0; sx <= cssW; sx += 2) {
        const worldX = sx + offset
        const wy = waveY(worldX)
        const m  = waveSlope(worldX)
        const L  = Math.sqrt(1 + m * m)
        sx === 0
          ? ctx.moveTo(sx - m * gap / L, wy + gap / L)
          : ctx.lineTo(sx - m * gap / L, wy + gap / L)
      }
      ctx.strokeStyle = 'rgba(79, 110, 247, 0.50)'
      ctx.lineWidth   = 1.5
      ctx.stroke()
      // ── Collectibles ──────────────────────────────────────────────────
      refillCollectibles(cssW, offset)

      const circleX      = cssW * CIRCLE_X_FRAC
      const circleY      = cssH / 2 - (angleRef.current / MAX_ANGLE) * cssH * amp
      const collideDist2 = (CIRCLE_RADIUS + COLL_RADIUS) ** 2

      collectiblesRef.current = collectiblesRef.current.filter(coll => {
        const collX = coll.u - offset
        const collY = waveY(coll.u)  // TODO: replace with your wave's y at coll.u

        if (isPlayingRef.current) {
          const dx = circleX - collX
          const dy = circleY - collY
          if (dx * dx + dy * dy < collideDist2) {
            onScoreRef.current?.()
            return false
          }
        }

        if (collX > -COLL_RADIUS * 2 && collX < cssW + COLL_RADIUS * 2) {
          drawGem(collX, collY, now)
        }
        return true
      })

      // ── Edge walls ────────────────────────────────────────────────────
      const WALL_W = 18
      const wGL = ctx.createLinearGradient(0, 0, WALL_W, 0)
      wGL.addColorStop(0,    '#ffffff')
      wGL.addColorStop(0.55, '#ffffff')
      wGL.addColorStop(1,    'rgba(255,255,255,0)')
      ctx.fillStyle = wGL
      ctx.fillRect(0, 0, WALL_W, cssH)

      const wGR = ctx.createLinearGradient(cssW - WALL_W, 0, cssW, 0)
      wGR.addColorStop(0,    'rgba(255,255,255,0)')
      wGR.addColorStop(0.45, '#ffffff')
      wGR.addColorStop(1,    '#ffffff')
      ctx.fillStyle = wGR
      ctx.fillRect(cssW - WALL_W, 0, WALL_W, cssH)

      ctx.strokeStyle = 'rgba(79, 110, 247, 0.35)'
      ctx.lineWidth   = 1.5
      ctx.lineCap     = 'square'
      ctx.beginPath(); ctx.moveTo(1,      0); ctx.lineTo(1,      cssH); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cssW-1, 0); ctx.lineTo(cssW-1, cssH); ctx.stroke()

      // ── Circle (always on top) ────────────────────────────────────────
      drawCircle(circleX, circleY)
    }

    let rafId
    const tick = () => {
      if (isPlayingRef.current) offsetRef.current += SCROLL_SPEED * speedRef.current
      draw()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [])

  return <canvas ref={canvasRef} className="rehab-canvas" />
}

export default RehabCanvas
