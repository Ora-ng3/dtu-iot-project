// Setup page — lets the patient configure a new session before starting.
//
// Fields:
//   • Session name — free-text label stored in SessionContext and shown in the HUD.
//   • Duration — minutes, selectable via preset pills (2 / 5 / 10 / 15 min) or
//     a custom number input (1–180 min).
//
// The page keeps its own local copies of name and duration so that backing out
// to Home without confirming does not mutate the shared SessionContext state.
// Only handleBegin writes to the context and navigates forward.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Logo } from '../components/Logo'
import './Setup.css'

const PRESETS = [2, 5, 10, 15]   // quick-select duration pills in minutes

export default function Setup() {
  const navigate = useNavigate()
  const { sessionName, setSessionName, duration, setDuration } = useSession()

  // Local shadow copies — not committed to context until "Begin Session".
  const [localName,  setLocalName]  = useState(sessionName)
  const [localDur,   setLocalDur]   = useState(duration)
  // customText is the raw string in the number input.  It is kept separate from
  // localDur so the user can type partial values (e.g. "1" while heading for "15")
  // without the numeric state being clamped or zeroed mid-keystroke.
  const [customText, setCustomText] = useState(String(duration))

  // handlePill — clicking a preset pill sets both the number and the text field
  // so they stay in sync and the active highlight applies correctly.
  const handlePill = (d) => {
    setLocalDur(d)
    setCustomText(String(d))
  }

  // handleCustom — the text field updates customText unconditionally (so the
  // user can type freely), but only updates the numeric localDur when the value
  // is a valid duration.  This prevents the "Begin Session" button from
  // flickering disabled/enabled while the user is still typing.
  const handleCustom = (e) => {
    const raw = e.target.value
    setCustomText(raw)
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 1 && n <= 180) setLocalDur(n)
  }

  // A preset pill is highlighted only when both the numeric value matches AND
  // the text field contains exactly that number as a string.  This prevents the
  // pill from staying highlighted after the user types a matching number
  // directly into the custom input while the source of truth is ambiguous.
  const isPreset = PRESETS.includes(localDur) && String(localDur) === customText
  const valid    = localDur >= 1 && localDur <= 180   // guard for the Begin button

  // handleBegin — commits local state to the shared context, then navigates.
  // Trims whitespace from the name and falls back to 'Session' if it is blank.
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

        {/* Session name field — maxLength prevents excessively long HUD labels */}
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
          {/* Preset pills for the most common session lengths */}
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
          {/* Custom duration: any integer from 1 to 180 minutes */}
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

        {/* Disabled until a valid duration is entered */}
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
