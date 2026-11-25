/**
 * VisionPath realtime server.
 *
 * One shared, authoritative live model for every connected client:
 *  - hazard reports (create / upvote / verify / resolve) broadcast instantly
 *  - SOS broadcasts with live location and responder acknowledgements
 *  - live journeys, shareable to a guardian with a one-time code
 *  - pedestrian-crossing signal phases, ticked by the server clock
 *  - a simulated peer network so collaboration is visible on a single device
 *
 * Protocol is plain JSON over a single WebSocket at /ws.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const configuredPort = Number(process.env.VISIONPATH_WS_PORT);
const PORT = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 8787;
const CENTER = { lat: 12.9719, lng: 77.5946 }; // Bengaluru, Cubbon Park edge

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = (p = '') => p + crypto.randomBytes(5).toString('hex');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const HAZARD_TYPES = [
  { type: 'pole', label: 'Street pole', icon: 'pole' },
  { type: 'pothole', label: 'Pothole', icon: 'pothole' },
  { type: 'stairs', label: 'Broken steps', icon: 'stairs' },
  { type: 'vehicle', label: 'Parked vehicle', icon: 'vehicle' },
  { type: 'construction', label: 'Construction barrier', icon: 'barrier' },
  { type: 'crossing', label: 'Faulty crossing signal', icon: 'signal' },
  { type: 'surface', label: 'Uneven surface', icon: 'surface' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

function makeHazard(partial = {}) {
  const t = partial.typeMeta || pick(HAZARD_TYPES);
  return {
    id: partial.id || uid('hz_'),
    type: t.type,
    label: t.label,
    severity: partial.severity || pick(SEVERITIES),
    lat: partial.lat ?? CENTER.lat + rand(-0.006, 0.006),
    lng: partial.lng ?? CENTER.lng + rand(-0.006, 0.006),
    description: partial.description || 'Reported by a nearby pedestrian. Approach slowly.',
    reporter: partial.reporter || 'Anonymous',
    source: partial.source || 'community',
    photo: partial.photo || null,
    upvotes: partial.upvotes ?? Math.floor(rand(0, 12)),
    verifies: partial.verifies ?? Math.floor(rand(0, 5)),
    status: partial.status || 'open',
    createdAt: partial.createdAt || Date.now() - Math.floor(rand(1, 80) * 60000),
  };
}

const hazards = new Map();
[
  { typeMeta: HAZARD_TYPES[2], severity: 'high', lat: CENTER.lat + 0.0014, lng: CENTER.lng + 0.0009, reporter: 'Meera R.', upvotes: 14, verifies: 6, description: 'Three broken steps at the metro entrance, no handrail on the right.' },
  { typeMeta: HAZARD_TYPES[1], severity: 'critical', lat: CENTER.lat - 0.0008, lng: CENTER.lng + 0.0021, reporter: 'Arjun K.', upvotes: 21, verifies: 9, description: 'Deep pothole filled with rainwater, spans half the footpath.' },
  { typeMeta: HAZARD_TYPES[4], severity: 'medium', lat: CENTER.lat + 0.0022, lng: CENTER.lng - 0.0016, reporter: 'Nidhi S.', upvotes: 8, verifies: 3, description: 'Construction barrier across the walkway, narrow gap on the left.' },
  { typeMeta: HAZARD_TYPES[0], severity: 'medium', lat: CENTER.lat - 0.0021, lng: CENTER.lng - 0.0007, reporter: 'City access team', upvotes: 5, verifies: 2, description: 'Street pole with a knee-height guy wire crossing the path.' },
  { typeMeta: HAZARD_TYPES[5], severity: 'high', lat: CENTER.lat + 0.0005, lng: CENTER.lng + 0.0034, reporter: 'Riya M.', upvotes: 11, verifies: 4, description: 'Crossing beeper is silent, signal head dimmed.' },
  { typeMeta: HAZARD_TYPES[6], severity: 'low', lat: CENTER.lat - 0.0034, lng: CENTER.lng + 0.0012, reporter: 'Karthik V.', upvotes: 3, verifies: 1, description: 'Loose paving stones after the rain.' },
  { typeMeta: HAZARD_TYPES[3], severity: 'high', lat: CENTER.lat + 0.0031, lng: CENTER.lng + 0.0004, reporter: 'Sana P.', upvotes: 9, verifies: 5, description: 'Delivery van parked across the tactile paving.' },
].forEach((h) => {
  const hazard = makeHazard(h);
  hazards.set(hazard.id, hazard);
});

const clients = new Map(); // ws -> profile
const journeys = new Map(); // code -> journey
const messages = []; // contact form submissions
let sos = null;
let hazardSeq = 0;

/* ------------------------------------------------------------------ *
 * Simulated nearby pedestrians — makes the shared model feel alive.  *
 * Marked `simulated` so the UI labels it honestly.                   *
 * ------------------------------------------------------------------ */
const peersSim = [
  { id: 'peer_asha', name: 'Asha (walker)', lat: CENTER.lat + 0.001, lng: CENTER.lng - 0.001, angle: 0.4, role: 'peer' },
  { id: 'peer_dev', name: 'Dev (walker)', lat: CENTER.lat - 0.001, lng: CENTER.lng + 0.0014, angle: 2.4, role: 'peer' },
  { id: 'peer_lea', name: 'Lea (volunteer)', lat: CENTER.lat + 0.002, lng: CENTER.lng + 0.0018, angle: 4.1, role: 'volunteer' },
];

function stepSimulatedPeers() {
  for (const p of peersSim) {
    p.angle += rand(-0.12, 0.12);
    p.lat = clamp(p.lat + Math.cos(p.angle) * 0.00016, CENTER.lat - 0.006, CENTER.lat + 0.006);
    p.lng = clamp(p.lng + Math.sin(p.angle) * 0.00016, CENTER.lng - 0.006, CENTER.lng + 0.006);
    // Occasionally confirm a hazard — visible as live community verification.
    if (Math.random() < 0.02) {
      const list = [...hazards.values()].filter((h) => h.status !== 'resolved');
      if (list.length) {
        const h = pick(list);
        h.verifies += 1;
        broadcast({ type: 'hazard:update', hazard: h, reason: `${p.name} verified this hazard` });
      }
    }
    // Occasionally a new report enters the shared map.
    if (Math.random() < 0.006 && hazards.size < 70) {
      const h = makeHazard({
        source: 'peer',
        reporter: p.name,
        lat: p.lat + rand(-0.0004, 0.0004),
        lng: p.lng + rand(-0.0004, 0.0004),
      });
      hazards.set(h.id, h);
      hazardSeq += 1;
      broadcast({ type: 'hazard:new', hazard: h, reason: `${p.name} reported ${h.label.toLowerCase()}` });
    }
  }
}

const crossings = [
  { id: 'cross-main', name: 'Cubbon Road crossing', cycle: 26, greenStart: 12, greenLen: 10 },
  { id: 'cross-park', name: 'Park gate crossing', cycle: 32, greenStart: 16, greenLen: 9 },
];

function signalState() {
  const t = Math.floor(Date.now() / 1000);
  return crossings.map((c) => {
    const pos = t % c.cycle;
    const green = pos >= c.greenStart && pos < c.greenStart + c.greenLen;
    const remaining = green
      ? c.greenStart + c.greenLen - pos
      : pos < c.greenStart
        ? c.greenStart - pos
        : c.cycle - pos + c.greenStart;
    return { id: c.id, name: c.name, phase: green ? 'green' : 'red', remaining, greenLen: c.greenLen };
  });
}

/* ------------------------------------------------------------------ */

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      clients: clients.size,
      hazards: hazards.size,
      sos: Boolean(sos),
      uptime: Math.round(process.uptime()),
    }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/contact') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 20000) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        if (!body.name || !body.email || !body.message) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'name, email and message are required' }));
          return;
        }
        const message = {
          id: uid('msg_'),
          name: String(body.name).slice(0, 120),
          email: String(body.email).slice(0, 160),
          message: String(body.message).slice(0, 4000),
          at: Date.now(),
        };
        messages.push(message);
        console.log(`Contact message ${message.id} from ${message.email}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: message.id }));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

function peerList() {
  const live = [...clients.values()].map((c) => ({
    id: c.id, name: c.name, role: c.role, lat: c.lat, lng: c.lng, simulated: false, self: false,
  }));
  const sim = peersSim.map((p) => ({ ...p, simulated: true, self: false }));
  return [...live, ...sim];
}

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of clients.keys()) {
    if (ws !== except && ws.readyState === 1) ws.send(data);
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function publicHazards() {
  return [...hazards.values()].sort((a, b) => b.createdAt - a.createdAt);
}

wss.on('connection', (ws) => {
  const profile = {
    id: uid('cl_'),
    name: 'Guest navigator',
    role: 'navigator',
    lat: CENTER.lat,
    lng: CENTER.lng,
    joinedAt: Date.now(),
  };
  clients.set(ws, profile);

  send(ws, {
    type: 'welcome',
    you: profile,
    peers: peerList(),
    hazards: publicHazards(),
    sos,
    signals: signalState(),
  });
  broadcast({ type: 'peers', peers: peerList() }, ws);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'hello': {
        if (typeof msg.name === 'string' && msg.name.trim()) profile.name = msg.name.trim().slice(0, 40);
        if (typeof msg.role === 'string') profile.role = msg.role.slice(0, 20);
        broadcast({ type: 'peers', peers: peerList() });
        break;
      }
      case 'position': {
        if (Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
          profile.lat = msg.lat;
          profile.lng = msg.lng;
          broadcast({ type: 'peers', peers: peerList() }, ws);
        }
        break;
      }
      case 'hazard:report': {
        const input = msg.hazard || {};
        const meta = HAZARD_TYPES.find((t) => t.type === input.type) || HAZARD_TYPES[0];
        const hazard = makeHazard({
          typeMeta: meta,
          lat: Number.isFinite(input.lat) ? input.lat : profile.lat,
          lng: Number.isFinite(input.lng) ? input.lng : profile.lng,
          severity: SEVERITIES.includes(input.severity) ? input.severity : 'medium',
          description: String(input.description || '').slice(0, 400) || 'Reported live from VisionPath.',
          reporter: profile.name,
          photo: typeof input.photo === 'string' && input.photo.length < 900000 ? input.photo : null,
          upvotes: 0,
          verifies: 1,
          source: 'community',
        });
        hazards.set(hazard.id, hazard);
        hazardSeq += 1;
        if (hazards.size > 90) {
          const oldest = [...hazards.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
          hazards.delete(oldest.id);
        }
        broadcast({ type: 'hazard:new', hazard, reason: `${profile.name} reported ${hazard.label.toLowerCase()}` });
        send(ws, { type: 'hazard:created', hazard });
        break;
      }
      case 'hazard:vote': {
        const h = hazards.get(msg.id);
        if (!h) break;
        if (msg.kind === 'upvote') h.upvotes += 1;
        else if (msg.kind === 'verify') h.verifies += 1;
        else if (msg.kind === 'resolve') {
          h.status = 'resolved';
          h.verifies += 1;
        }
        broadcast({ type: 'hazard:update', hazard: h, reason: `${profile.name} ${msg.kind === 'resolve' ? 'cleared' : msg.kind === 'verify' ? 'verified' : 'upvoted'} ${h.label.toLowerCase()}` });
        break;
      }
      case 'sos:start': {
        const payload = msg.payload || {};
        sos = {
          id: uid('sos_'),
          by: profile.name,
          byId: profile.id,
          message: String(payload.message || 'Needs immediate assistance').slice(0, 200),
          lat: Number.isFinite(payload.lat) ? payload.lat : profile.lat,
          lng: Number.isFinite(payload.lng) ? payload.lng : profile.lng,
          createdAt: Date.now(),
          acks: [],
          updates: [],
          contactsNotified: Array.isArray(payload.contacts) ? payload.contacts.slice(0, 6) : [],
        };
        broadcast({ type: 'sos', sos });
        break;
      }
      case 'sos:update': {
        if (!sos) break;
        if (Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
          sos.lat = msg.lat;
          sos.lng = msg.lng;
          sos.updates.push({ lat: msg.lat, lng: msg.lng, t: Date.now() });
          if (sos.updates.length > 60) sos.updates.shift();
        }
        broadcast({ type: 'sos', sos });
        break;
      }
      case 'sos:ack': {
        if (!sos) break;
        if (!sos.acks.some((a) => a.id === msg.id)) {
          sos.acks.push({ id: String(msg.id || 'ack'), name: profile.name, at: Date.now() });
        }
        broadcast({ type: 'sos', sos });
        break;
      }
      case 'sos:end': {
        if (!sos) break;
        const ended = { ...sos, endedAt: Date.now() };
        broadcast({ type: 'sos:end', sos: ended });
        sos = null;
        break;
      }
      case 'journey:start': {
        const code = uid('vp_').slice(0, 8).toUpperCase();
        const journey = {
          code,
          by: profile.name,
          byId: profile.id,
          active: true,
          startedAt: Date.now(),
          endedAt: null,
          path: [{ lat: profile.lat, lng: profile.lng, t: Date.now() }],
          alerts: [],
          distance: 0,
          safety: 96,
          destination: String(msg.destination || 'Community library, 2nd cross').slice(0, 80),
          guardian: null,
        };
        journeys.set(code, journey);
        send(ws, { type: 'journey', journey, self: true });
        break;
      }
      case 'journey:update': {
        const code = msg.code;
        const j = journeys.get(code);
        if (!j || !j.active) break;
        if (Number.isFinite(msg.lat) && Number.isFinite(msg.lng)) {
          const last = j.path[j.path.length - 1];
          if (last) {
            const d = haversine(last.lat, last.lng, msg.lat, msg.lng);
            if (d < 800) j.distance += d;
          }
          j.path.push({ lat: msg.lat, lng: msg.lng, t: Date.now() });
          if (j.path.length > 400) j.path.shift();
        }
        if (Array.isArray(msg.alerts)) {
          j.alerts = msg.alerts.slice(-25);
        }
        if (Number.isFinite(msg.safety)) j.safety = Math.round(msg.safety);
        broadcast({ type: 'journey', journey: j });
        break;
      }
      case 'journey:end': {
        const j = journeys.get(msg.code);
        if (!j) break;
        j.active = false;
        j.endedAt = Date.now();
        broadcast({ type: 'journey', journey: j });
        break;
      }
      case 'journey:watch': {
        const j = journeys.get(String(msg.code || '').toUpperCase());
        if (j) send(ws, { type: 'journey', journey: j, watching: true });
        else send(ws, { type: 'journey:missing', code: msg.code });
        break;
      }
      case 'route:select': {
        broadcast({
          type: 'route:selected',
          by: profile.name,
          route: msg.route,
        });
        break;
      }
      case 'ping':
        send(ws, { type: 'pong', t: Date.now() });
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type: 'peers', peers: peerList() });
  });
  ws.on('error', () => {
    clients.delete(ws);
  });
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Server clock: crossing phases every second, simulated peers four times a second.
setInterval(() => {
  broadcast({ type: 'signal', signals: signalState() });
}, 1000);

setInterval(() => {
  stepSimulatedPeers();
  broadcast({ type: 'peers', peers: peerList() });
  if (sos) {
    broadcast({ type: 'sos', sos });
  }
}, 1500);

setInterval(() => {
  if (hazardSeq >= 0) {
    broadcast({ type: 'heartbeat', at: Date.now(), clients: clients.size });
  }
}, 15000);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`VisionPath realtime server listening on http://127.0.0.1:${PORT}/ws`);
});
