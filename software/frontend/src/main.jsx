// Application entry point.
//
// Route structure:
//   /          → Home      (landing page with animated wave + connection status)
//   /setup     → Setup     (configure session name, duration, and mode)
//   /session   → Session   (live rehabilitation canvas with sensor readouts)
//
// SessionProvider wraps all routes so session configuration (name, duration,
// mode) is available to both Setup (where it is written) and Session (where
// it is read) without prop-drilling through the router.
//
// StrictMode is enabled for development — it double-invokes effects to expose
// missing cleanup functions.  The useBackendConnection hook's mountedRef and
// socket duplicate guard are specifically designed to tolerate this.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { SessionProvider } from './context/SessionContext'
import Home    from './pages/Home'
import Setup   from './pages/Setup'
import Session from './pages/Session'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/"        element={<Home />}    />
          <Route path="/setup"   element={<Setup />}   />
          <Route path="/session" element={<Session />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
