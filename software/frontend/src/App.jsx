import { useState, useCallback } from 'react'
import './App.css'
import RehabCanvas from './components/RehabCanvas'
import { useBackendConnection } from './hooks/useBackendConnection'

const MAX_ANGLE = 30

const CONN_LABELS = {
  connected:    'Backend',
  connecting:   'Connecting…',
  disconnected: 'No Backend',
}

function App() {
  const [manualAngle, setManualAngle] = useState(0)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [amplitude,   setAmplitude]   = useState(0.26)
  const [speed,       setSpeed]       = useState(1.5)
  const [score,       setScore]       = useState(0)

  const { angle: backendAngle, force, status } = useBackendConnection()
  const connected = status === 'connected'

  // When the backend is live use its value (clamped to the valid range).
  // Fall back to the manual slider so the app is always testable without hardware.
  const angle = connected && backendAngle !== null
    ? Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, backendAngle))
    : manualAngle

  const handleScore = useCallback(() => setScore(s => s + 1), [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-dot" />
          <h1>Ankle Rehabilitation Interface</h1>
        </div>
        <div className="header-right">
          <div className={`conn-indicator conn-${status}`}>
            <div className="conn-dot" />
            <span className="conn-label">{CONN_LABELS[status]}</span>
          </div>
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(p => !p)}
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="canvas-area">
          <RehabCanvas
            angle={angle}
            isPlaying={isPlaying}
            amplitude={amplitude}
            speed={speed}
            onScore={handleScore}
          />
        </div>

        {/* ── Angle + force + score panel ── */}
        <aside className="panel">
          <div className="panel-section">
            <span className="panel-label">Angle</span>
            <div className="panel-value-row">
              <span className="panel-value">{angle >= 0 ? '+' : ''}{angle.toFixed(1)}</span>
              <span className="panel-unit">deg</span>
            </div>
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <span className="panel-label">Force</span>
            <div className="panel-value-row">
              <span className="panel-value panel-value--sm">
                {connected && force !== null ? force.toFixed(1) : '—'}
              </span>
              {connected && force !== null && <span className="panel-unit">N</span>}
            </div>
          </div>

          <div className="panel-divider" />

          <div className="panel-section panel-slider-section">
            <span className="slider-bound">+{MAX_ANGLE}°</span>
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
            <span className="slider-bound">−{MAX_ANGLE}°</span>
            {connected
              ? <span className="slider-source">from backend</span>
              : <span className="slider-source slider-source--manual">manual</span>
            }
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <span className="panel-label">Score</span>
            <div className="panel-value-row">
              <span className="panel-value panel-value--score">{score}</span>
            </div>
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <span className="panel-label">Status</span>
            <span className={`status-badge ${isPlaying ? 'status-active' : 'status-idle'}`}>
              {isPlaying ? 'Active' : 'Idle'}
            </span>
          </div>
        </aside>

        {/* ── Wave shape panel ── */}
        <aside className="panel wave-panel">
          <div className="panel-section">
            <span className="panel-label">Wave Shape</span>
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <span className="panel-label">Amplitude</span>
            <div className="panel-value-row">
              <span className="panel-value panel-value--sm">{Math.round(amplitude * 100)}</span>
              <span className="panel-unit">%</span>
            </div>
            <input
              type="range"
              min={0.08}
              max={0.42}
              step={0.01}
              value={amplitude}
              onChange={e => setAmplitude(Number(e.target.value))}
              className="wave-slider"
            />
            <div className="wave-slider-labels">
              <span>Flat</span>
              <span>Steep</span>
            </div>
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <span className="panel-label">Speed</span>
            <div className="panel-value-row">
              <span className="panel-value panel-value--sm">{speed.toFixed(1)}</span>
              <span className="panel-unit">×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="wave-slider"
            />
            <div className="wave-slider-labels">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>

          <div className="panel-divider" />

          <div className="panel-section">
            <button
              className="reset-btn"
              onClick={() => { setAmplitude(0.26); setSpeed(1.5) }}
            >
              Reset
            </button>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
