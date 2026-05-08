// Session page — the live rehabilitation exercise screen.
//
// Layout
// ──────
//   ┌─ HUD (session name, countdown timer, mode toggle, play/pause, exit) ─┐
//   │  RehabCanvas  │  Sensor panel  │  Wave shape panel                    │
//   └──────────────────────────────────────────────────────────────────────-┘
//   [Results overlay — rendered on top when the session ends, canvas stays mounted]
//
// Sensor angle source
// ───────────────────
// When the ESP32 backend is connected, the angle comes from useBackendConnection
// and is clamped to ±MAX_ANGLE degrees.  When there is no backend, the manual
// slider in the sensor panel acts as a stand-in so the UI is always testable
// without hardware.
//
// Accuracy tracking
// ─────────────────
// A 1 Hz timer samples the current feedback state while the game is playing.
// Only 'bad' (fully outside the corridor) counts as an error; 'warn' (near the
// edge) is treated as acceptable.  The final accuracy % is: good_ticks / total_ticks.
//
// Session history
// ───────────────
// When the session ends the result is appended to 'mw_history' in localStorage
// so a future history/progress view can display it without a server.

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useBackendConnection } from '../hooks/useBackendConnection'
import RehabCanvas from '../components/RehabCanvas'
import './Session.css'

const MAX_ANGLE = 30   // degrees — matches the constant in RehabCanvas

// Maps feedback states to CSS colour variables for the live sensor readouts.
const FB_COLOR = {
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad:  'var(--color-bad)',
}

// fmt — formats a number of seconds as MM:SS (e.g. 125 → "02:05").
function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Session() {
  const navigate = useNavigate()
  const { sessionName, duration, mode, setMode } = useSession()
  const { angle: backendAngle, force, status } = useBackendConnection()

  const connected = status === 'connected'

  // ── State ────────────────────────────────────────────────────────────────
  const [manualAngle, setManualAngle] = useState(0)     // used only when no backend
  const [amplitude,   setAmplitude]   = useState(0.26)  // wave amplitude fraction (0–1)
  const [speed,       setSpeed]       = useState(1.5)   // wave scroll speed multiplier
  const [score,       setScore]       = useState(0)     // gem collection count
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [timeLeft,    setTimeLeft]    = useState(duration * 60)  // seconds remaining
  const [showResults, setShowResults] = useState(false) // whether results overlay is visible
  const [feedback,    setFeedback]    = useState('good')  // current corridor feedback state

  // feedbackRef mirrors `feedback` so the accuracy timer can read the latest
  // value without being listed as a dependency (which would reset the timer).
  const feedbackRef      = useRef('good')
  const accuracyGoodRef  = useRef(0)   // ticks where feedback was not 'bad'
  const accuracyTotalRef = useRef(0)   // total ticks elapsed

  useEffect(() => { feedbackRef.current = feedback }, [feedback])

  // Effective angle: clamped live value when connected, manual slider otherwise.
  const angle = connected && backendAngle !== null
    ? Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, backendAngle))
    : manualAngle

  // Stable callbacks passed to RehabCanvas — memoised so they don't cause the
  // canvas to see a new prop reference on every parent re-render.
  const handleScore    = useCallback(() => setScore(s => s + 1), [])
  const handleFeedback = useCallback((f) => setFeedback(f), [])

  // ── Countdown timer ───────────────────────────────────────────────────────
  // Runs once per second while the game is playing and time remains.
  // Each tick also samples accuracy: if feedback is not 'bad' the tick is
  // counted as "good".  This runs in a chained setTimeout (not setInterval)
  // so it stays in sync with the React state update cycle.
  useEffect(() => {
    if (!isPlaying || showResults) return
    if (timeLeft <= 0) { setIsPlaying(false); setShowResults(true); return }
    const t = setTimeout(() => {
      setTimeLeft(s => s - 1)
      accuracyTotalRef.current += 1
      if (feedbackRef.current !== 'bad') accuracyGoodRef.current += 1
    }, 1000)
    return () => clearTimeout(t)
  }, [isPlaying, timeLeft, showResults])

  // ── Session persistence ───────────────────────────────────────────────────
  // Fires once when showResults becomes true (i.e. the session has just ended).
  // Appends the result to the 'mw_history' localStorage key.
  // Falls back to a fresh single-entry array if the stored data is missing or
  // cannot be parsed (e.g. corrupted by a previous crash or browser quirk).
  useEffect(() => {
    if (!showResults) return
    const elapsed = duration * 60 - timeLeft
    const pct = accuracyTotalRef.current > 0
      ? Math.round(accuracyGoodRef.current / accuracyTotalRef.current * 100)
      : 100   // if no ticks were recorded (session ended immediately), treat as perfect
    try {
      const raw = localStorage.getItem('mw_history')
      const parsed = JSON.parse(raw)
      const existing = Array.isArray(parsed) ? parsed : []
      existing.push({
        date: new Date().toISOString(),
        sessionName: sessionName || 'Session',
        duration: fmt(elapsed),
        score,
        accuracy: pct,
        mode,
      })
      localStorage.setItem('mw_history', JSON.stringify(existing))
    } catch {
      // If JSON.parse or setItem throws, start a fresh history with just this entry.
      localStorage.setItem('mw_history', JSON.stringify([{
        date: new Date().toISOString(),
        sessionName: sessionName || 'Session',
        duration: fmt(elapsed),
        score,
        accuracy: pct,
        mode,
      }]))
    }
  }, [showResults]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: intentionally omitting other deps — this effect is a "fire once on
  // session end" side effect; stale closures are acceptable here.

  // handleExit — lets the patient end the session manually before the timer expires.
  const handleExit = () => { setIsPlaying(false); setShowResults(true) }

  // Derived values for the results overlay.
  const elapsed       = duration * 60 - timeLeft
  const accuracy      = accuracyTotalRef.current > 0
    ? Math.round(accuracyGoodRef.current / accuracyTotalRef.current * 100)
    : 100
  // Colour-code the accuracy percentage: green ≥ 70 %, amber ≥ 40 %, red below.
  const accuracyColor = accuracy >= 70 ? 'var(--color-good)'
                      : accuracy >= 40 ? 'var(--color-warn)'
                      :                  'var(--color-bad)'

  return (
    <div className="session">
      {/* ── HUD ─────────────────────────────────────────────── */}
      <header className="session-hud">
        <span className="hud-name">{sessionName || 'Session'}</span>
        {/* Timer turns red when ≤ 30 s remain to prompt the patient */}
        <span className={`hud-timer${timeLeft <= 30 ? ' hud-timer--critical' : ''}`}>
          {fmt(timeLeft)}
        </span>
        <div className="hud-right">
          {/* Mode toggle: switches the canvas between angle-driven and force-driven ball */}
          <div className="hud-mode-toggle">
            <button className={`hud-mode-btn${mode === 'angle' ? ' active' : ''}`} onClick={() => setMode('angle')}>
              Angle
            </button>
            <button className={`hud-mode-btn${mode === 'force' ? ' active' : ''}`} onClick={() => setMode('force')}>
              Force
            </button>
          </div>

          <button
            className={`hud-play-btn${!isPlaying ? ' hud-play-btn--paused' : ''}`}
            onClick={() => setIsPlaying(p => !p)}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <button className="hud-exit-btn" onClick={handleExit} title="End session">✕</button>
        </div>
      </header>

      {/* ── Main: canvas + two side panels ──────────────────── */}
      <div className="session-main">
        <div className="session-canvas-area">
          <RehabCanvas
            angle={angle}
            isPlaying={isPlaying}
            amplitude={amplitude}
            speed={speed}
            onScore={handleScore}
            onFeedback={handleFeedback}
            mode={mode}
          />
        </div>

        {/* Panel 1 — live sensor readouts + fallback manual angle slider */}
        <aside className="sp">
          <div className="sp-section">
            <span className="sp-label">Angle</span>
            <div className="sp-value-row">
              {/* Angle value is colour-coded by the current corridor feedback state */}
              <span
                className="sp-value"
                style={{ color: FB_COLOR[feedback], transition: 'color 0.25s' }}
              >
                {angle >= 0 ? '+' : ''}{angle.toFixed(1)}
              </span>
              <span className="sp-unit">deg</span>
            </div>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <span className="sp-label">Force</span>
            <div className="sp-value-row">
              <span
                className="sp-value sp-value--sm"
                style={{ color: FB_COLOR[feedback], transition: 'color 0.25s' }}
              >
                {connected && force !== null ? force.toFixed(1) : '—'}
              </span>
              {connected && force !== null && <span className="sp-unit">N</span>}
            </div>
          </div>
          <div className="sp-divider" />

          {/* Manual slider: disabled when the backend is connected so it can't
              fight the live sensor data; active for testing without hardware. */}
          <div className="sp-section sp-slider-section">
            <span className="sp-bound">+{MAX_ANGLE}°</span>
            <input
              type="range"
              min={-MAX_ANGLE}
              max={MAX_ANGLE}
              step={0.5}
              value={angle}
              onChange={e => !connected && setManualAngle(Number(e.target.value))}
              disabled={connected}
              className={`angle-slider${connected ? ' angle-slider--disabled' : ''}`}
            />
            <span className="sp-bound">−{MAX_ANGLE}°</span>
            <span className={`sp-source${!connected ? ' sp-source--manual' : ''}`}>
              {connected ? 'from sensor' : 'manual'}
            </span>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <span className="sp-label">Score</span>
            <div className="sp-value-row">
              <span className="sp-value sp-value--score">{score}</span>
            </div>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <span className="sp-label">Status</span>
            <span className={`sp-badge${isPlaying ? ' sp-badge--active' : ''}`}>
              {isPlaying ? 'Active' : 'Idle'}
            </span>
          </div>
        </aside>

        {/* Panel 2 — wave shape controls (amplitude + speed) */}
        <aside className="sp">
          <div className="sp-section">
            <span className="sp-label">Wave Shape</span>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <span className="sp-label">Amplitude</span>
            <div className="sp-value-row">
              <span className="sp-value sp-value--sm">{Math.round(amplitude * 100)}</span>
              <span className="sp-unit">%</span>
            </div>
            {/* Amplitude range: 0.08 (almost flat) to 0.42 (fills most of canvas height) */}
            <input
              type="range" min={0.08} max={0.42} step={0.01}
              value={amplitude}
              onChange={e => setAmplitude(Number(e.target.value))}
              className="wave-slider"
            />
            <div className="wave-slider-labels"><span>Flat</span><span>Steep</span></div>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <span className="sp-label">Speed</span>
            <div className="sp-value-row">
              <span className="sp-value sp-value--sm">{speed.toFixed(1)}</span>
              <span className="sp-unit">×</span>
            </div>
            {/* Speed multiplier applied to SCROLL_SPEED in RehabCanvas */}
            <input
              type="range" min={0.5} max={3.0} step={0.1}
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="wave-slider"
            />
            <div className="wave-slider-labels"><span>Slow</span><span>Fast</span></div>
          </div>
          <div className="sp-divider" />

          <div className="sp-section">
            <button className="sp-reset-btn" onClick={() => { setAmplitude(0.26); setSpeed(1.5) }}>
              Reset
            </button>
          </div>
        </aside>
      </div>

      {/* ── Results overlay ───────────────────────────────────────────────────
          Rendered on top of the session layout when showResults is true.
          The canvas beneath stays mounted (not unmounted) so the wave
          continues to animate in the background behind the card. */}
      {showResults && (
        <div className="results-overlay">
          <div className="results-card">
            <p className="results-eyebrow">Session complete</p>
            <p className="results-name">{sessionName || 'Session'}</p>
            <p className="results-duration">{fmt(elapsed)} elapsed</p>

            <div className="results-grid">
              <div className="results-stat">
                <span className="results-stat__value">{score}</span>
                <span className="results-stat__label">Gems</span>
              </div>
              <div className="results-stat">
                <span className="results-stat__value" style={{ color: accuracyColor }}>{accuracy}%</span>
                <span className="results-stat__label">Accuracy</span>
              </div>
              <div className="results-stat">
                <span className="results-stat__value">{fmt(elapsed)}</span>
                <span className="results-stat__label">Duration</span>
              </div>
            </div>

            <div className="results-actions">
              <button className="results-btn results-btn--primary" onClick={() => navigate('/setup')}>
                New session
              </button>
              <button className="results-btn results-btn--secondary" onClick={() => navigate('/')}>
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
