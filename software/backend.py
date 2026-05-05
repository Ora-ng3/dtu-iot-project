import asyncio
import json
import websockets

TCP_PORT = 5001
WS_PORT = 8765

latest_angle = "0"
latest_force = 0.0
clients = set()

# --- TCP SERVER (ESP8266 sends data here) ---
async def handle_tcp(reader, writer):
    global latest_angle, latest_force
    addr = writer.get_extra_info('peername')
    print(f"ESP8266 connected: {addr}")

    try:
        while True:
            data = await reader.readline()
            if not data:
                break

            text = data.decode().strip()
            if ',' in text:
                angle_text, force_text = text.split(',', 1)
                angle = float(angle_text)
                force = float(force_text)
            else:
                angle = float(text)
                force = 0.0

            latest_angle = str(angle)
            latest_force = force

            # --- check bounds for angle ---
            if angle < 100 or angle > 900:
                outsideBounds = 1
            else:
                outsideBounds = 0

            # --- send back to ESP32 ---
            writer.write((str(outsideBounds) + "\n").encode())
            await writer.drain()

            # --- send to browser ---
            payload = json.dumps({"angle": angle, "force": force})

            for ws in clients:
                await ws.send(payload)

    except Exception as e:
        print("TCP error:", e)

    print("ESP88266 disconnected")
    writer.close()


# --- WEBSOCKET SERVER (browser connects here) ---
async def handle_ws(websocket):
    clients.add(websocket)
    print("Browser connected")

    try:
        # send latest angle and force immediately
        await websocket.send(json.dumps({"angle": float(latest_angle), "force": latest_force}))

        async for _ in websocket:
            pass

    finally:
        clients.remove(websocket)
        print("Browser disconnected")


# --- SIMPLE HTTP SERVER (serves webpage) ---
# DELETE WHEN USING JS WEB SCRIPT
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


# --- MAIN ---
async def main():
    tcp_server = await asyncio.start_server(handle_tcp, "0.0.0.0", TCP_PORT)

    # http_server can be deleted, if js takes care of serving the webpage
    http_server = await asyncio.start_server(handle_http, "0.0.0.0", 8000) 
    
    ws_server = await websockets.serve(handle_ws, "0.0.0.0", WS_PORT)

    print("TCP server on port 5000 (ESP32)")
    print("WebSocket on port 8765")
    print("Website: http://localhost:8000")

    async with tcp_server, http_server, ws_server:
        await asyncio.gather(
            tcp_server.serve_forever(),
            http_server.serve_forever(),
            ws_server.wait_closed()
        )

asyncio.run(main())


