# Bridge between the ESP32 IoT sensor and the React frontend.
#
# Architecture overview
# ─────────────────────
#   ESP32 ──TCP:5001──► handle_tcp ──broadcast──► WebSocket clients (browsers)
#                            │
#                            └── replies "outsideBounds\n" back to ESP32
#                                so the hardware can fire a local buzzer/LED
#                                without a browser round-trip.
#
# Three async servers run concurrently inside a single asyncio event loop:
#   • TCP server   (port 5001) — receives raw sensor lines from the ESP32
#   • WebSocket server (port 8765) — streams JSON readings to the browser UI
#   • HTTP server  (port 8000) — minimal debug page


import asyncio
import json
import websockets

TCP_PORT = 5001
WS_PORT  = 8765

# ── Shared in-memory state ───────────────────────────────────────────────────
# latest_angle / latest_force hold the most recent sensor reading.
# They are written exclusively by handle_tcp and read by handle_ws so that
# a freshly connected browser gets an immediate value instead of waiting for
# the next ESP32 tick (which could be several hundred milliseconds away).
latest_angle = "0"
latest_force = 0.0

# All currently open WebSocket connections. Every time handle_tcp receives a
# new sensor reading it broadcasts to every entry in this set.
clients = set()


# ── TCP SERVER ───────────────────────────────────────────────────────────────
# The ESP32 opens a persistent TCP connection to this handler on boot and
# sends one line per sensor reading.  The handler replies immediately with a
# single-byte out-of-bounds flag so the ESP32 can react without the browser.
async def handle_tcp(reader, writer):
    global latest_angle, latest_force
    addr = writer.get_extra_info('peername')
    print(f"ESP32 connected: {addr}")

    try:
        while True:
            # readline() blocks until '\n' is received or the connection drops.
            # Returning b'' means the peer closed the connection cleanly.
            data = await reader.readline()
            if not data:
                break

            # The ESP32 sends lines in one of two formats:
            #   "<angle>,<force>\n"  — potentiometer + force sensor both wired
            #   "<angle>\n"          — force sensor absent (testing / early HW)
            # Splitting on the first comma only prevents issues if force ever
            # contains a decimal point that could be misread as a delimiter.
            text = data.decode().strip()
            if ',' in text:
                angle_text, force_text = text.split(',', 1)
                angle = float(angle_text)
                force = float(force_text)
            else:
                angle = float(text)
                force = 0.0

            # Update shared state so new WebSocket clients see the latest value.
            latest_angle = str(angle)
            latest_force = force

            # The potentiometer on the hardware produces ADC values in roughly
            # 100–900 for the safe mechanical range of the ankle brace.
            # Values outside that window mean the joint is at an unsafe extreme;
            # the ESP32 uses this flag to trigger a local buzzer immediately,
            # faster than waiting for the browser to process and respond.
            if angle < 100 or angle > 900:
                outsideBounds = 1
            else:
                outsideBounds = 0

            # Send the flag back over the same TCP connection.
            # drain() ensures the kernel buffer is flushed before we loop.
            writer.write((str(outsideBounds) + "\n").encode())
            await writer.drain()

            # Broadcast the reading as JSON to every connected browser.
            # Iteration over a plain set is fine here because no awaits happen
            # inside the loop, so the set cannot be mutated mid-iteration.
            payload = json.dumps({"angle": angle, "force": force})
            for ws in clients:
                await ws.send(payload)

    except Exception as e:
        print("TCP error:", e)

    print("ESP32 disconnected")
    writer.close()


# ── WEBSOCKET SERVER ─────────────────────────────────────────────────────────
# Each browser tab opens one WebSocket connection here.  The connection lives
# for the duration of the session; the server pushes readings as they arrive
# from the ESP32.  The browser never sends messages back.
async def handle_ws(websocket):
    clients.add(websocket)
    print("Browser connected")

    try:
        # Push the cached reading immediately so the UI shows a value right away
        # rather than showing "—" until the next ESP32 tick arrives.
        await websocket.send(json.dumps({"angle": float(latest_angle), "force": latest_force}))

        # Iterate over incoming messages only to keep the connection alive and
        # detect when the browser closes the tab.  No messages are expected.
        async for _ in websocket:
            pass

    finally:
        # Remove the client regardless of whether the disconnect was clean or
        # caused by a network error, so it is never written to after closing.
        clients.remove(websocket)
        print("Browser disconnected")


# ── HTTP SERVER (debug / legacy) ─────────────────────────────────────────────
# A minimal single-page HTML response that shows the live angle value.
# This was used before the React frontend existed.  It can be removed once
# the Vite dev server or the built dist/ folder is used for the UI instead.
async def handle_http(reader, writer):
    html = f"""\
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
<head>
  <title>ESP32 Sensor</title>
</head>
<body>
  <h1>Sensor angle:</h1>
  <h2 id="angle">0</h2>

  <script>
    const ws = new WebSocket("ws://localhost:{WS_PORT}");

    ws.onmessage = (event) => {{
      document.getElementById("angle").innerText = event.data;
    }};
  </script>
</body>
</html>
"""
    writer.write(html.encode())
    await writer.drain()
    writer.close()


# ── MAIN ─────────────────────────────────────────────────────────────────────
# Start all three servers and run them concurrently inside one event loop.
# asyncio.gather keeps all three alive; if any server raises, the exception
# propagates and the process exits (intentional — no partial-running state).
async def main():
    # "0.0.0.0" means listen on all network interfaces so the ESP32 can reach
    # the server over the local Wi-Fi network, not just localhost.
    tcp_server  = await asyncio.start_server(handle_tcp,  "0.0.0.0", TCP_PORT)
    http_server = await asyncio.start_server(handle_http, "0.0.0.0", 8000)
    ws_server   = await websockets.serve(handle_ws, "0.0.0.0", WS_PORT)

    print(f"TCP server on port {TCP_PORT} (ESP32)")
    print(f"WebSocket on port  {WS_PORT}  (browser)")
    print("Debug page: http://localhost:8000")

    # The context manager closes all servers on exit; gather runs them forever.
    async with tcp_server, http_server, ws_server:
        await asyncio.gather(
            tcp_server.serve_forever(),
            http_server.serve_forever(),
            ws_server.wait_closed(),   # websockets uses wait_closed, not serve_forever
        )

asyncio.run(main())
