import { createContext, useContext, useState } from 'react'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionName, setSessionName] = useState('')
  const [duration,    setDuration]    = useState(5)
  const [mode,        setMode]        = useState('angle')

  return (
    <SessionContext.Provider value={{ sessionName, setSessionName, duration, setDuration, mode, setMode }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
