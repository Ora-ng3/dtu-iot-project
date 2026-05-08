// SessionContext — shared configuration for the current rehabilitation session.
//
// Stores three pieces of state that need to survive the Setup → Session
// navigation without being serialised to a URL or re-fetched from a server:
//
//   sessionName  — free-text label shown in the HUD (default: "")
//   duration     — session length in minutes (default: 5)
//   mode         — which sensor drives the ball:
//                    'angle' — ankle angle from the potentiometer (degrees)
//                    'force' — push force from the force sensor (Newtons)
//
// useSession() is a convenience wrapper around useContext so consumers don't
// need to import SessionContext directly.

import { createContext, useContext, useState } from 'react'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionName, setSessionName] = useState('')
  const [duration,    setDuration]    = useState(5)       // minutes
  const [mode,        setMode]        = useState('angle') // 'angle' | 'force'

  return (
    <SessionContext.Provider value={{ sessionName, setSessionName, duration, setDuration, mode, setMode }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
