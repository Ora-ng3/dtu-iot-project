import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Logo } from '../components/Logo'
import './Setup.css'

const PRESETS = [2, 5, 10, 15]

export default function Setup() {
  const navigate = useNavigate()
  const { sessionName, setSessionName, duration, setDuration } = useSession()

  const [localName,  setLocalName]  = useState(sessionName)
  const [localDur,   setLocalDur]   = useState(duration)
  const [customText, setCustomText] = useState(String(duration))

  const handlePill = (d) => {
    setLocalDur(d)
    setCustomText(String(d))
  }

  const handleCustom = (e) => {
    const raw = e.target.value
    setCustomText(raw)
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 1 && n <= 180) setLocalDur(n)
  }

  const isPreset = PRESETS.includes(localDur) && String(localDur) === customText
  const valid    = localDur >= 1 && localDur <= 180

  const handleBegin = () => {
    if (!valid) return
    setSessionName(localName.trim() || 'Session')
    setDuration(localDur)
    navigate('/session')
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <button className="setup-back" onClick={() => navigate('/')}>← Home</button>

        <div className="setup-brand">
          <Logo size={36} />
          <h1 className="setup-title">New Session</h1>
        </div>

        <label className="setup-field">
          <span className="setup-field__label">Session name</span>
          <input
            className="setup-input"
            type="text"
            placeholder="e.g. Morning mobility"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            maxLength={48}
          />
        </label>

        <div className="setup-field">
          <span className="setup-field__label">Duration</span>
          <div className="setup-pills">
            {PRESETS.map(d => (
              <button
                key={d}
                className={`setup-pill${isPreset && localDur === d ? ' setup-pill--active' : ''}`}
                onClick={() => handlePill(d)}
              >
                {d} min
              </button>
            ))}
          </div>
          <div className="setup-custom-row">
            <span className="setup-custom-label">Custom</span>
            <input
              className="setup-input setup-input--num"
              type="number"
              min={1}
              max={180}
              value={customText}
              onChange={handleCustom}
              placeholder="–"
            />
            <span className="setup-custom-unit">min</span>
          </div>
        </div>

        <button
          className="cta-btn cta-btn--full"
          onClick={handleBegin}
          disabled={!valid}
        >
          Begin Session →
        </button>
      </div>
    </div>
  )
}
