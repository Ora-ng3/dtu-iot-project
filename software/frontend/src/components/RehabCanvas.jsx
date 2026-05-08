// RehabCanvas — canvas-based rehabilitation mini-game.
//
// Concept
// ───────
// A sinusoidal wave scrolls continuously from right to left.  The patient's
// ball is positioned vertically according to the live ankle-angle reading (or
// a manual slider when no hardware is connected).  The goal is to keep the
// ball inside the corridor that surrounds the wave.
//
// Rendering pipeline (called every animation frame via requestAnimationFrame):
//   1. Compute wave geometry for the current scroll offset.
//   2. Draw corridor fill + centre line + border lines, tinted by feedback state.
//   3. Draw collectible stars (gems) that sit on the wave; remove any the
//      ball touches and call onScore().
//   4. Draw fade gradients at the left/right edges to mask clipping.
//   5. Compute ball Y from the smoothed sensor angle, check corridor distance,
//      emit onFeedback() when the state (good / warn / bad) changes.
//   6. Draw the ball with an optional error glow.
//
// Refs over state
// ───────────────
// Every prop and piece of mutable animation state is stored in a ref rather
// than React state.  This lets the requestAnimationFrame callback always read
// the latest value without being torn down and re-created on every render —
// which would restart the animation and cause a visible flicker.

import { useEffect, useRef } from 'react'
import './RehabCanvas.css'

// ── Constants ────────────────────────────────────────────────────────────────
const CIRCLE_RADIUS = 24      // ball radius in CSS pixels
const CIRCLE_X_FRAC = 0.80   // ball is fixed at 80 % of canvas width from the left
const SCROLL_SPEED  = 1.8    // pixels-per-frame the wave scrolls at speed multiplier 1×
const MAX_ANGLE     = 30     // sensor degrees that map to the full wave amplitude
const COLL_RADIUS   = 11     // collectible star radius in CSS pixels
const COLL_COUNT    = 14     // how many stars are kept alive in the pool at any time
const COLL_SPACING  = 0.10   // distance between stars as a fraction of canvas width

// ── Helpers ───────────────────────────────────────────────────────────────────
// Converts a CSS hex colour + alpha to an rgba() string so we can apply
// opacity to theme colours without touching globalAlpha (which affects everything).
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Component ─────────────────────────────────────────────────────────────────
function RehabCanvas({
  angle = 0,        // current ankle angle in degrees (negative = plantar, positive = dorsi)
  isPlaying = false,
  amplitude = 0.26, // wave amplitude as a fraction of canvas height
  speed = 1.5,      // scroll speed multiplier
  onScore,          // () => void — called when the ball collides with a star
  onFeedback,       // (feedback: 'good'|'warn'|'bad') => void — called on state change
  mode = 'angle',   // 'angle' | 'force' — determines which sensor drives the ball Y
}) {
  const canvasRef = useRef(null)

  // Scroll accumulator — incremented every frame while isPlaying is true.
  const offsetRef = useRef(0)

  // Latest prop values, mirrored from React state so the animation loop can
  // read them without causing a re-render or restarting the loop.
  const angleRef      = useRef(angle)
  const isPlayingRef  = useRef(isPlaying)
  const amplitudeRef  = useRef(amplitude)
  const speedRef      = useRef(speed)
  const onScoreRef    = useRef(onScore)
  const onFeedbackRef = useRef(onFeedback)
  const modeRef       = useRef(mode)

  // Collectible pool: each entry is { id, u } where u is the "world X"
  // coordinate (absolute, not screen-relative) of that star.
  const collectiblesRef = useRef([])
  const nextIdRef       = useRef(0)   // monotonic ID to key React reconciliation

  // Smoothed values — updated each frame with an exponential moving average
  // to prevent the ball from snapping on abrupt sensor changes.
  const smoothedAngleRef = useRef(0)
  const smoothedForceRef = useRef(0)

  // Keep refs in sync with props via lightweight single-dep effects.
  // This is the standard pattern for "stable ref + reactive value."
  useEffect(() => { angleRef.current      = angle },     [angle])
  useEffect(() => { isPlayingRef.current  = isPlaying }, [isPlaying])
  useEffect(() => { amplitudeRef.current  = amplitude }, [amplitude])
  useEffect(() => { speedRef.current      = speed },     [speed])
  useEffect(() => { onScoreRef.current    = onScore },   [onScore])
  useEffect(() => { onFeedbackRef.current = onFeedback }, [onFeedback])
  useEffect(() => { modeRef.current       = mode },      [mode])

  // ── Main animation effect (runs once on mount, cleans up on unmount) ────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // ── HiDPI / Retina support ───────────────────────────────────────────────
    // The canvas backing buffer is sized at physical pixels (cssSize × dpr) but
    // then scaled back down via ctx.setTransform so all drawing code uses CSS
    // pixels.  This avoids blurry rendering on high-density screens without
    // requiring any changes to the drawing logic.
    // A ResizeObserver re-runs syncSize whenever the element's layout box
    // changes (e.g. window resize, panel toggle).
    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = Math.round(canvas.offsetWidth  * dpr)
      canvas.height = Math.round(canvas.offsetHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(syncSize)
    observer.observe(canvas)
    syncSize()

    // ── Collectible pool initialisation ─────────────────────────────────────
    // Seed the pool with COLL_COUNT stars spread across the visible canvas so
    // the player sees collectibles immediately on first play rather than waiting
    // for the first batch to scroll in from the right edge.
    const cssW0 = canvas.offsetWidth
    collectiblesRef.current = Array.from({ length: COLL_COUNT }, (_, i) => ({
      id: nextIdRef.current++,
      u:  cssW0 * 0.08 + i * cssW0 * COLL_SPACING,
    }))

    // refillCollectibles — called every frame to maintain the pool size.
    // Stars that have scrolled off the left edge (more than 3 radii past it)
    // are culled, then new ones are appended beyond the rightmost existing star
    // with a small random jitter so the spacing isn't perfectly uniform.
    const refillCollectibles = (cssW, offset) => {
      collectiblesRef.current = collectiblesRef.current.filter(
        c => (c.u - offset) > -(COLL_RADIUS * 3),
      )
      while (collectiblesRef.current.length < COLL_COUNT) {
        const maxU = collectiblesRef.current.reduce(
          (m, c) => Math.max(m, c.u),
          offset + cssW * 0.5,   // fallback if the pool is somehow empty
        )
        collectiblesRef.current.push({
          id: nextIdRef.current++,
          u:  maxU + cssW * COLL_SPACING + Math.random() * 35,
        })
      }
    }

    // ── drawGem — 5-pointed star with glow, radial gradient, and specular dot ──
    // The star pulses slightly over time (±12 % radius) using a sine function
    // whose phase is offset by the star's X position so adjacent stars don't
    // pulse in unison.
    const drawGem = (x, y, t, gemColor) => {
      const pulse  = 0.88 + 0.12 * Math.sin(t / 320 + x * 0.012)
      const outerR = COLL_RADIUS * pulse
      const innerR = outerR * 0.40   // inner radius at 40 % of outer = classic star ratio
      const NPTS   = 5
      const step   = Math.PI / NPTS  // angle between consecutive outer/inner points

      // Glow halo drawn via shadowBlur before the fill.
      ctx.shadowColor = gemColor
      ctx.shadowBlur  = 18

      // Build the star path by alternating outer and inner vertices.
      // Subtract π/2 so the first point points straight up.
      ctx.beginPath()
      for (let i = 0; i < NPTS * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR
        const a = i * step - Math.PI / 2
        i === 0
          ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
          : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a))
      }
      ctx.closePath()

      // Radial gradient: bright centre fading to a semi-transparent rim.
      const g = ctx.createRadialGradient(x - outerR * 0.2, y - outerR * 0.25, 0, x, y, outerR)
      g.addColorStop(0,    '#fffde0')               // near-white highlight
      g.addColorStop(0.35, gemColor)
      g.addColorStop(1,    hexToRgba(gemColor, 0.65))
      ctx.fillStyle = g
      ctx.fill()

      ctx.shadowBlur  = 0
      ctx.strokeStyle = hexToRgba(gemColor, 0.45)
      ctx.lineWidth   = 0.8
      ctx.stroke()

      // Small specular dot offset toward the upper-left to simulate a light source.
      ctx.beginPath()
      ctx.arc(x - outerR * 0.15, y - outerR * 0.38, outerR * 0.18, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.fill()
    }

    // ── drawBall — solid circle with rim shadow and specular highlight ────────
    const drawBall = (cx, cy, ballColor) => {
      const R = CIRCLE_RADIUS

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, 2 * Math.PI)
      ctx.fillStyle = ballColor
      ctx.fill()

      // Dark rim makes the ball readable against both light and dark corridor colours.
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth   = 1.5
      ctx.stroke()

      // Specular catch-light: small circle offset toward the upper-left.
      ctx.beginPath()
      ctx.arc(cx - R * 0.28, cy - R * 0.30, R * 0.24, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.20)'
      ctx.fill()
    }

    // Tracks last emitted feedback so onFeedback is only called on transitions,
    // not every frame (which would flood the parent with redundant updates).
    let lastFeedback = null

    // ── draw — the per-frame rendering function ───────────────────────────────
    const draw = () => {
      const cssW = canvas.offsetWidth
      const cssH = canvas.offsetHeight
      ctx.clearRect(0, 0, cssW, cssH)

      // Read theme colours from CSS custom properties so the canvas respects
      // the active design token set without hard-coding hex values here.
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

      const offset = offsetRef.current
      const amp    = amplitudeRef.current
      const now    = performance.now()   // used by drawGem for the pulse animation

      // Wave geometry: y = H/2 + A·sin(freq·worldX)
      // waveSlope is the derivative: used to compute perpendicular normals for
      // the corridor border lines.
      const waveAmp  = cssH * amp
      const waveFreq = 0.008

      const waveY     = (worldX) => cssH / 2 + waveAmp * Math.sin(worldX * waveFreq)
      const waveSlope = (worldX) => waveAmp * waveFreq * Math.cos(worldX * waveFreq)

      // ── Corridor gap (perpendicular half-width) ────────────────────────────
      // The corridor border lines are offset perpendicularly to the wave tangent.
      // At tight bends (high amplitude, low frequency) the curvature radius
      // Rmin = 1 / (A·f²) can be smaller than BORDER_GAP, which would cause
      // the inner border to self-intersect.  Capping gap to 90 % of Rmin prevents
      // that visual artefact.
      const BORDER_GAP = 38
      const Rmin = waveAmp > 0 ? 1 / (waveAmp * waveFreq * waveFreq) : Infinity
      const gap  = Math.min(BORDER_GAP, Rmin * 0.9)

      // Use the previous frame's feedback to colour the corridor.
      // The 1-frame lag is imperceptible but avoids computing feedback twice per frame.
      const corridorColor = (lastFeedback === 'bad'  && isPlayingRef.current) ? badColor
                          : (lastFeedback === 'warn' && isPlayingRef.current) ? warnColor
                          : waveColor

      // ── Precompute corridor border points ─────────────────────────────────
      // For each screen X, compute the wave point and offset ±gap pixels along
      // the perpendicular unit normal: n = (-slope, 1) / |(-slope, 1)|.
      // Every 2 CSS pixels is fine-grained enough to look smooth.
      const topPts = []
      const botPts = []
      for (let sx = 0; sx <= cssW; sx += 2) {
        const wx = sx + offset
        const wy = waveY(wx)
        const m  = waveSlope(wx)
        const L  = Math.sqrt(1 + m * m)   // length of tangent vector (1, m)
        topPts.push([sx + m * gap / L, wy - gap / L])
        botPts.push([sx - m * gap / L, wy + gap / L])
      }

      // ── Corridor fill ──────────────────────────────────────────────────────
      // A subtle tinted fill between the borders; alpha increases when off-path
      // to give a stronger visual cue that the ball is outside the corridor.
      const fillAlpha = lastFeedback === 'bad' ? 0.10 : lastFeedback === 'warn' ? 0.07 : 0.04
      ctx.beginPath()
      ctx.moveTo(topPts[0][0], topPts[0][1])
      for (let i = 1; i < topPts.length; i++) ctx.lineTo(topPts[i][0], topPts[i][1])
      for (let i = botPts.length - 1; i >= 0; i--) ctx.lineTo(botPts[i][0], botPts[i][1])
      ctx.closePath()
      ctx.fillStyle = hexToRgba(corridorColor, fillAlpha)
      ctx.fill()

      // ── Centre wave line (3 px solid) ─────────────────────────────────────
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

      // ── Border lines ──────────────────────────────────────────────────────
      // Slightly thicker and more opaque when the ball is off-path to reinforce
      // the "danger zone" visual.
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

      // ── Collectible stars ─────────────────────────────────────────────────
      refillCollectibles(cssW, offset)

      // Ball position: horizontally fixed, vertically driven by the sensor.
      // Mapping: ±MAX_ANGLE° → ±waveAmp px from canvas centre-line.
      // Negated because CSS Y increases downward (positive angle = dorsiflexion = up).
      const circleX      = cssW * CIRCLE_X_FRAC
      const smoothed     = currentMode === 'force' ? smoothedForceRef.current : smoothedAngleRef.current
      const circleY      = cssH / 2 - (smoothed / MAX_ANGLE) * cssH * amp
      const collideDist2 = (CIRCLE_RADIUS + COLL_RADIUS) ** 2   // squared to avoid sqrt

      // Iterate collectibles: check collision, draw if on screen, cull if off screen.
      collectiblesRef.current = collectiblesRef.current.filter(coll => {
        const collX = coll.u - offset   // world → screen X
        const collY = waveY(coll.u)     // star Y follows the wave centre

        // Collision detection: squared-distance check is cheaper than sqrt.
        // Only active during play so the ball can't accidentally scoop stars
        // while the game is paused.
        if (isPlayingRef.current) {
          const dx = circleX - collX
          const dy = circleY - collY
          if (dx * dx + dy * dy < collideDist2) {
            onScoreRef.current?.()
            return false   // remove from pool
          }
        }

        // Draw only stars within (or just outside) the visible viewport to
        // avoid wasting GPU time on invisible geometry.
        if (collX > -COLL_RADIUS * 2 && collX < cssW + COLL_RADIUS * 2) {
          drawGem(collX, collY, now, gemColor)
        }
        return true
      })

      // ── Edge fade gradients ───────────────────────────────────────────────
      // Narrow gradient strips at the left and right edges blend the wave into
      // the page background so the scrolling cut-off looks intentional rather
      // than abrupt.
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

      // ── Feedback classification ───────────────────────────────────────────
      // Measure the ball's vertical distance from the wave centre and classify:
      //   good — inside the inner 65 % of the corridor half-width
      //   warn — between 65 % and 100 % (near the edge)
      //   bad  — outside the corridor entirely
      // Using vertical distance (not true perpendicular) is an intentional
      // simplification: it's cheaper and the difference is unnoticeable at
      // the wave frequencies used here.
      const vertDist = Math.abs(circleY - waveY(circleX + offset))
      const feedback = vertDist < gap * 0.65 ? 'good'
                     : vertDist < gap        ? 'warn'
                     :                         'bad'

      // Only notify the parent when the feedback state changes (not every frame).
      if (feedback !== lastFeedback) {
        lastFeedback = feedback
        onFeedbackRef.current?.(feedback)
      }

      // ── Ball ──────────────────────────────────────────────────────────────
      // Add an error glow around the ball when it is outside or near the edge
      // of the corridor, then draw the ball on top.
      if (isPlayingRef.current && feedback !== 'good') {
        ctx.shadowColor = feedback === 'bad' ? badColor : warnColor
        ctx.shadowBlur  = feedback === 'bad' ? 32 : 16
      }
      drawBall(circleX, circleY, ballColor)
      // Reset shadow so it doesn't bleed into subsequent draw calls.
      ctx.shadowBlur  = 0
      ctx.shadowColor = 'transparent'
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    // tick() runs every display frame (~60 fps).
    //   • Applies exponential smoothing (α = 0.18) to the angle so the ball
    //     glides smoothly instead of jumping on abrupt sensor changes.
    //     Lower α → smoother motion, higher lag.  0.18 is a good balance at 60 fps.
    //   • Advances the scroll offset only while the game is playing.
    let rafId
    const tick = () => {
      smoothedAngleRef.current += 0.18 * (angleRef.current - smoothedAngleRef.current)
      smoothedForceRef.current += 0.18 * (angleRef.current - smoothedForceRef.current)
      if (isPlayingRef.current) offsetRef.current += SCROLL_SPEED * speedRef.current
      draw()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Cleanup: stop the animation loop and the resize observer when the
    // component unmounts (e.g. navigating away from the session page).
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [])   // empty dep array — the loop is started once and relies on refs for live values

  return <canvas ref={canvasRef} className="rehab-canvas" />
}

export default RehabCanvas
