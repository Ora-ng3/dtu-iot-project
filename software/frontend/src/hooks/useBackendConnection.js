// useBackendConnection — React hook that manages the WebSocket connection to
// the Python backend.
//
// Responsibilities:
//   • Open a WebSocket to the backend on mount and expose angle, force, status.
//   • Automatically reconnect every RECONNECT_DELAY_MS after a drop.
//   • Expose `status` ('connecting' | 'connected' | 'disconnected') so the UI
//     can show a connection indicator and fall back to the manual slider.
//   • Clean up the socket and any pending reconnect timer on unmount.
//
// Configuration:
//   Set VITE_WS_URL in a .env file at the project root to point at a non-local
//   backend, e.g.:
//     VITE_WS_URL=ws://192.168.1.42:8765
//   Without that variable the hook defaults to ws://localhost:8765.
//
// Expected server message format (JSON, one object per sensor reading):
//   { "angle": <number, degrees>, "force": <number, Newtons> }

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL             = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8765'
const RECONNECT_DELAY_MS = 3000   // wait 3 s before each reconnect attempt

export function useBackendConnection() {
  // angle and force are null when disconnected so the UI can distinguish
  // "no hardware" from a genuine zero reading.
  const [angle,  setAngle]  = useState(null)
  const [force,  setForce]  = useState(null)
  const [status, setStatus] = useState('disconnected')  // 'connecting' | 'connected' | 'disconnected'

  const wsRef          = useRef(null)   // the live WebSocket instance
  const reconnectTimer = useRef(null)   // handle for the setTimeout reconnect

  // mountedRef: set to false in the cleanup function so that no state setter
  // fires after the component that called this hook has unmounted.
  // Without this guard, navigating away while a reconnect timer is pending
  // would trigger "Can't perform a React state update on an unmounted component".
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    // Guard: if a socket is already open (or connecting), don't create a second
    // one.  This can happen when React StrictMode double-invokes effects in dev,
    // or when onclose fires before the previous reconnect timer is cancelled.
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return

    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setStatus('connected')
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        // Only update state for fields that are actually present and numeric.
        // This makes the hook resilient to partial or extended server payloads.
        if (typeof data.angle === 'number') setAngle(data.angle)
        if (typeof data.force === 'number') setForce(data.force)
      } catch {
        // Silently ignore non-JSON frames (e.g. ping frames from some proxies).
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setStatus('disconnected')
      // Clear stale readings so the UI shows "—" rather than the last known
      // value, which could be seconds or minutes old.
      setAngle(null)
      setForce(null)
      // Schedule a reconnect.  The timer handle is stored so it can be cancelled
      // in the cleanup function if the component unmounts before it fires.
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => {
      // The WebSocket spec guarantees that onerror is always followed by onclose,
      // so we don't need to schedule a reconnect here — onclose handles it.
      // Calling ws.close() explicitly moves the socket to CLOSED immediately so
      // the readyState guard at the top of connect() works correctly.
      ws.close()
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      // Prevent any pending callbacks from updating state after unmount.
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { angle, force, status }
}
