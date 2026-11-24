# GridGuard Mini (Full MERN + IoT)

Web-orchestrated tabletop microgrid dashboard with priority-based load shedding.

## Stack
- Client: React + Vite + React Router + Recharts + Socket.IO client
- Server: Node.js + Express + Socket.IO + Mongoose + MQTT + JWT auth
- IoT: ESP32 telemetry/command contract over MQTT (simulator included)

## Run
```powershell
cd "E:\PPS\React Js\GridGuard-Mini"
Copy-Item server\.env.example server\.env
npm run setup
npm run dev
```
- Web: http://localhost:5173
- API: http://localhost:5000
- Default admin: `admin@gridguard.local` / `admin123`

With no `MQTT_URL`, the server runs simulated ESP32 nodes so the full dashboard works immediately. Set `MQTT_URL` for real hardware.

## Implemented areas
Dashboard, Live Monitoring, Analytics, Logs/Events, Alerts, Load Management, Priority Management, Power Failure Simulator, IoT Devices, Settings/User roles, Profile/Auth, Socket.IO realtime updates, REST API, MongoDB/memory store fallback, ESP32 firmware reference.
