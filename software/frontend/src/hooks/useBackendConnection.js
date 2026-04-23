import { useState, useEffect, useRef, useCallback } from 'react'

// ── Backend WebSocket URL ────────────────────────────────────────────────────
// Change WS_URL to match your Python backend address, or set VITE_WS_URL in a
// .env file at the project root (e.g. VITE_WS_URL=ws://192.168.1.10:8765).
//
// Expected message format from the Python backend (JSON, once per reading):
//   { "angle": <number, degrees>, "force": <number, Newtons> }
//
// Example Python snippet:
//   import asyncio, json, websockets
//   async def handler(ws):
//       while True:
//           angle, force = read_sensors()
//           await ws.send(json.dumps({"angle": angle, "force": force}))
//           await asyncio.sleep(0.02)   # ~50 Hz
//   asyncio.run(websockets.serve(handler, "localhost", 8765))
// ────────────────────────────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8765'
const RECONNECT_DELAY_MS = 3000

export function useBackendConnection() {
  const [angle,  setAngle]  = useState(null)
  const [force,  setForce]  = useState(null)
  const [status, setStatus] = useState('disconnected') // 'connecting' | 'connected' | 'disconnected'

  const wsRef           = useRef(null)
  const reconnectTimer  = useRef(null)
  const mountedRef      = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    // Don't open a second socket if one is already live
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
        if (typeof data.angle === 'number') setAngle(data.angle)
        if (typeof data.force === 'number') setForce(data.force)
      } catch {
        // ignore non-JSON or malformed messages
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setStatus('disconnected')
      setAngle(null)
      setForce(null)
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => {
      // onerror is always followed by onclose — reconnect is handled there
      ws.close()
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { angle, force, status }
}
