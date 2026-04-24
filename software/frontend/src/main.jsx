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
