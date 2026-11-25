# VisionPath

A realtime AI navigation companion for blind and low-vision people. VisionPath senses the
walking corridor from the device camera, keeps re-planning a safe line as the scene changes,
speaks the correction, and shares hazards with everyone nearby over WebSockets.

This is not a mock: guidance, community reports, SOS broadcasts, crossing signals and guardian
trip sharing all run on a live server session.

## Run it

```bash
npm install
npm run dev
```

- Web app: http://127.0.0.1:5173
- Realtime server: ws://127.0.0.1:8787/ws (proxied through Vite at `/ws`)

`npm run dev` starts both the Node WebSocket server and Vite together.

## Features

| Page | What is live |
| --- | --- |
| Dashboard | Safety status, weather (Open-Meteo), community presence, closest hazards, session counters |
| Live Scan | Webcam capture, on-device obstacle detection, safe-lane planner (220 ms), spoken guidance, auto-shared hazards |
| Obstacle Alerts | Broadcast alert feed, voice output controls, persisted history, severity filters |
| Smart Routes | Fastest / safest / accessible routes re-scored against live hazards, route sharing |
| Hazard Reporting | Form with map pin, downscaled photo, instant broadcast to all clients |
| Community Map | Clustered markers, upvote / verify / clear, live peer list |
| SOS | Hold-to-send beacon, live location updates, responder acknowledgements, real `tel:`/`sms:` links |
| Indoor Navigation | Floor plan with shortest-path routing that recalculates around reported obstructions |
| Crossing Assistant | Server-ticked signal phases, spoken countdowns, vehicle-approach warnings |
| Journey Monitoring | Live trip tracking, alert timeline, safety trend, guardian share code |
| Guardian View | Read-only live trip by code, position, safety and alerts |
| Accessibility | Voice rate/pitch/volume/language, contrast, text scale, motion, colour-blind mode, haptics |
| About | Mission, architecture, team, working contact form (`POST /api/contact`) |

## Realtime protocol

A single JSON WebSocket at `/ws`. Server state is authoritative and broadcast to every client.

Client → server: `hello`, `position`, `hazard:report`, `hazard:vote`, `sos:start`, `sos:update`,
`sos:ack`, `sos:end`, `journey:start`, `journey:update`, `journey:end`, `journey:watch`,
`route:select`, `ping`.

Server → client: `welcome`, `peers`, `hazard:new`, `hazard:update`, `hazard:created`, `sos`,
`sos:end`, `signal`, `journey`, `journey:missing`, `route:selected`, `heartbeat`.

The server also runs a small labelled simulated peer network and a signal clock so collaboration
and crossing countdowns are visible on a single device.

## Obstacle detection

`src/lib/vision.js` samples the camera into a 6 × 3 grid, compares local edge energy against a
rolling per-cell baseline, and emits detections with bearing, distance band, width and confidence.
`src/lib/guidance.js` scores five lanes against those detections and produces the instruction and
the safe-path ribbon. When no camera is available, a deterministic corridor simulation runs the
same pipeline. Frames never leave the device.

## Structure

```
server/index.js        WebSocket + HTTP server (hazards, SOS, journeys, signals)
src/lib/realtime.jsx   Socket client, shared live store, geolocation
src/lib/vision.js      Camera capture and on-device detection
src/lib/guidance.js    Path planning and spoken instruction generation
src/lib/voice.js       Speech synthesis queue
src/lib/settings.jsx   Accessibility settings, persisted
src/components/        Chrome (navbar, floating live panel), map, UI kit
src/pages/             Thirteen screens
```

## Notes

- Camera and microphone APIs require a secure context (`localhost`/`127.0.0.1` or HTTPS).
- Voice languages depend on voices installed on the device.
- VisionPath is an assistant: it does not replace a cane, guide dog or orientation training.
