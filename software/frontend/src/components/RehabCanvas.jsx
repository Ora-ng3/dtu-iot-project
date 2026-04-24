import { useEffect, useRef } from 'react'
import './RehabCanvas.css'

const CIRCLE_RADIUS = 24
const CIRCLE_X_FRAC = 0.80
const SCROLL_SPEED  = 1.8
const MAX_ANGLE     = 30
const COLL_RADIUS   = 11
const COLL_COUNT    = 14
const COLL_SPACING  = 0.10

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function RehabCanvas({
  angle = 0, isPlaying = false, amplitude = 0.26,
  speed = 1.5, onScore, onFeedback, mode = 'angle',
}) {
  const canvasRef         = useRef(null)
  const offsetRef         = useRef(0)
  const angleRef          = useRef(angle)
  const isPlayingRef      = useRef(isPlaying)
  const amplitudeRef      = useRef(amplitude)
  const speedRef          = useRef(speed)
  const onScoreRef        = useRef(onScore)
  const onFeedbackRef     = useRef(onFeedback)
  const collectiblesRef   = useRef([])
  const nextIdRef         = useRef(0)
  const modeRef           = useRef(mode)
  const smoothedAngleRef  = useRef(0)
  const smoothedForceRef  = useRef(0)

  useEffect(() => { angleRef.current     = angle },       [angle])
  useEffect(() => { isPlayingRef.current = isPlaying },   [isPlaying])
  useEffect(() => { amplitudeRef.current = amplitude },   [amplitude])
  useEffect(() => { speedRef.current     = speed },       [speed])
  useEffect(() => { onScoreRef.current   = onScore },     [onScore])
  useEffect(() => { onFeedbackRef.current = onFeedback }, [onFeedback])
  useEffect(() => { modeRef.current      = mode },        [mode])

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

    // 5-pointed star collectible
    const drawGem = (x, y, t, gemColor) => {
      const pulse  = 0.88 + 0.12 * Math.sin(t / 320 + x * 0.012)
      const outerR = COLL_RADIUS * pulse
      const innerR = outerR * 0.40
      const NPTS   = 5
      const step   = Math.PI / NPTS

      ctx.shadowColor = gemColor
      ctx.shadowBlur  = 18

      ctx.beginPath()
      for (let i = 0; i < NPTS * 2; i++) {
        const r  = i % 2 === 0 ? outerR : innerR
        const a  = i * step - Math.PI / 2   // first point straight up
        i === 0
          ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
          : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
      }
      ctx.closePath()

      const g = ctx.createRadialGradient(x - outerR * 0.2, y - outerR * 0.25, 0, x, y, outerR)
      g.addColorStop(0,    '#fffde0')
      g.addColorStop(0.35, gemColor)
      g.addColorStop(1,    hexToRgba(gemColor, 0.65))
      ctx.fillStyle = g
      ctx.fill()

      ctx.shadowBlur  = 0
      ctx.strokeStyle = hexToRgba(gemColor, 0.45)
      ctx.lineWidth   = 0.8
      ctx.stroke()

      // Specular dot near upper tip
      ctx.beginPath()
      ctx.arc(x - outerR * 0.15, y - outerR * 0.38, outerR * 0.18, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.fill()
    }

    // Plain solid ball — no ring
    const drawBall = (cx, cy, ballColor) => {
      const R = CIRCLE_RADIUS

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = ballColor
      ctx.fill()

      // Thin dark rim so the ball reads clearly on a dark bg
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // Subtle specular catch-light
      ctx.beginPath()
      ctx.arc(cx - R * 0.28, cy - R * 0.30, R * 0.24, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.20)'
      ctx.fill()
    }

    // Tracks last feedback state so we only call the prop on transitions
    let lastFeedback = null

    const draw = () => {
      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      ctx.clearRect(0, 0, cssW, cssH)

      const style       = getComputedStyle(canvas)
      const currentMode = modeRef.current

      const waveColor = (style.getPropertyValue(
        currentMode === 'force' ? '--color-wave-force' : '--color-wave-angle',
      ) || '#2563EB').trim()

      const ballColor = (style.getPropertyValue(
        currentMode === 'force' ? '--color-ball-force' : '--color-ball-angle',
      ) || '#2563EB').trim()

      const gemColor  = (style.getPropertyValue('--color-gem')  || '#FCD34D').trim()
      const bgColor   = (style.getPropertyValue('--color-bg')   || '#F5F7FA').trim()
      const badColor  = (style.getPropertyValue('--color-bad')  || '#EF4444').trim()
      const warnColor = (style.getPropertyValue('--color-warn') || '#F59E0B').trim()

      const offset  = offsetRef.current
      const amp     = amplitudeRef.current
      const now     = performance.now()

      const waveAmp  = cssH * amp
      const waveFreq = 0.008

      const waveY     = (worldX) => cssH / 2 + waveAmp * Math.sin(worldX * waveFreq)
      const waveSlope = (worldX) => waveAmp * waveFreq * Math.cos(worldX * waveFreq)

      const BORDER_GAP = 38
      const Rmin = waveAmp > 0 ? 1 / (waveAmp * waveFreq * waveFreq) : Infinity
      const gap  = Math.min(BORDER_GAP, Rmin * 0.9)

      // Use last-frame feedback to tint the corridor (1-frame lag is imperceptible)
      const corridorColor = (lastFeedback === 'bad'  && isPlayingRef.current) ? badColor
                          : (lastFeedback === 'warn' && isPlayingRef.current) ? warnColor
                          : waveColor

      // Precompute border points once per frame
      const topPts = []
      const botPts = []
      for (let sx = 0; sx <= cssW; sx += 2) {
        const wx = sx + offset
        const wy = waveY(wx)
        const m  = waveSlope(wx)
        const L  = Math.sqrt(1 + m * m)
        topPts.push([sx + m * gap / L, wy - gap / L])
        botPts.push([sx - m * gap / L, wy + gap / L])
      }

      // Corridor fill — stronger tint when off-path
      const fillAlpha = lastFeedback === 'bad' ? 0.10 : lastFeedback === 'warn' ? 0.07 : 0.04
      ctx.beginPath()
      ctx.moveTo(topPts[0][0], topPts[0][1])
      for (let i = 1; i < topPts.length; i++) ctx.lineTo(topPts[i][0], topPts[i][1])
      for (let i = botPts.length - 1; i >= 0; i--) ctx.lineTo(botPts[i][0], botPts[i][1])
      ctx.closePath()
      ctx.fillStyle = hexToRgba(corridorColor, fillAlpha)
      ctx.fill()

      // Centre line — 3px solid
      ctx.beginPath()
      for (let sx = 0; sx <= cssW; sx += 2) {
        const wy = waveY(sx + offset)
        sx === 0 ? ctx.moveTo(sx, wy) : ctx.lineTo(sx, wy)
      }
      ctx.strokeStyle = corridorColor
      ctx.lineWidth   = 3
      ctx.lineJoin    = 'round'
      ctx.lineCap     = 'round'
      ctx.setLineDash([])
      ctx.stroke()

      // Border lines — solid, 45% opacity when off-path, 30% otherwise
      const borderAlpha = (lastFeedback !== 'good' && isPlayingRef.current) ? 0.45 : 0.30
      ctx.strokeStyle = hexToRgba(corridorColor, borderAlpha)
      ctx.lineWidth   = lastFeedback === 'bad' ? 2 : 1
      ctx.lineCap     = 'round'

      ctx.beginPath()
      ctx.moveTo(topPts[0][0], topPts[0][1])
      for (let i = 1; i < topPts.length; i++) ctx.lineTo(topPts[i][0], topPts[i][1])
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(botPts[0][0], botPts[0][1])
      for (let i = 1; i < botPts.length; i++) ctx.lineTo(botPts[i][0], botPts[i][1])
      ctx.stroke()

      // Collectible stars
      refillCollectibles(cssW, offset)

      const circleX      = cssW * CIRCLE_X_FRAC
      const smoothed     = currentMode === 'force' ? smoothedForceRef.current : smoothedAngleRef.current
      const circleY      = cssH / 2 - (smoothed / MAX_ANGLE) * cssH * amp
      const collideDist2 = (CIRCLE_RADIUS + COLL_RADIUS) ** 2

      collectiblesRef.current = collectiblesRef.current.filter(coll => {
        const collX = coll.u - offset
        const collY = waveY(coll.u)

        if (isPlayingRef.current) {
          const dx = circleX - collX
          const dy = circleY - collY
          if (dx * dx + dy * dy < collideDist2) {
            onScoreRef.current?.()
            return false
          }
        }

        if (collX > -COLL_RADIUS * 2 && collX < cssW + COLL_RADIUS * 2) {
          drawGem(collX, collY, now, gemColor)
        }
        return true
      })

      // Edge walls — bg-colour gradient so they blend into the page
      const WALL_W = 18
      const wGL = ctx.createLinearGradient(0, 0, WALL_W, 0)
      wGL.addColorStop(0,    bgColor)
      wGL.addColorStop(0.55, bgColor)
      wGL.addColorStop(1,    hexToRgba(bgColor, 0))
      ctx.fillStyle = wGL
      ctx.fillRect(0, 0, WALL_W, cssH)

      const wGR = ctx.createLinearGradient(cssW - WALL_W, 0, cssW, 0)
      wGR.addColorStop(0,    hexToRgba(bgColor, 0))
      wGR.addColorStop(0.45, bgColor)
      wGR.addColorStop(1,    bgColor)
      ctx.fillStyle = wGR
      ctx.fillRect(cssW - WALL_W, 0, WALL_W, cssH)

      // Determine feedback from ball's perpendicular distance to corridor
      const vertDist = Math.abs(circleY - waveY(circleX + offset))
      const feedback = vertDist < gap * 0.65 ? 'good'
                     : vertDist < gap        ? 'warn'
                     :                         'bad'

      // Fire callback only when feedback state transitions
      if (feedback !== lastFeedback) {
        lastFeedback = feedback
        onFeedbackRef.current?.(feedback)
      }

      // Glow around the ball when off-path
      if (isPlayingRef.current && feedback !== 'good') {
        ctx.shadowColor = feedback === 'bad' ? badColor : warnColor
        ctx.shadowBlur  = feedback === 'bad' ? 32 : 16
      }
      drawBall(circleX, circleY, ballColor)
      ctx.shadowBlur  = 0
      ctx.shadowColor = 'transparent'
    }

    let rafId
    const tick = () => {
      smoothedAngleRef.current += 0.18 * (angleRef.current - smoothedAngleRef.current)
      smoothedForceRef.current += 0.18 * (angleRef.current - smoothedForceRef.current)
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
