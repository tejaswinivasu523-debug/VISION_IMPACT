import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bell, Brain, Camera, Cpu, Eye, Footprints, Globe2, Layers, MapPin,
  Mic, Navigation, Radio, Route as RouteIcon, ShieldCheck, Siren, Sparkles, Users,
} from 'lucide-react';
import { Card, Reveal, SectionHead, Stat } from '../components/UI';

const METRICS = [
  { value: '250M', label: 'With vision impairment', note: 'WHO estimate of significant sight loss worldwide' },
  { value: '1 in 3', label: 'Report a fall each year', note: 'Falls are the leading injury risk for this group' },
  { value: '220ms', label: 'Re-plan interval', note: 'Five lanes re-scored continuously while walking' },
  { value: '0', label: 'Frames uploaded', note: 'The camera pipeline runs entirely on device' },
];

const PILLARS = [
  {
    icon: Camera,
    title: 'Perception — on device',
    text: 'The camera is sampled into a 6 × 3 grid at 192 × 144. Edge energy is compared against a rolling per-cell baseline, so a static scene settles and only objects entering the walking corridor stand out.',
    tags: ['No upload', '6 × 3 grid', 'Edge energy'],
  },
  {
    icon: Brain,
    title: 'Guidance — always re-deciding',
    text: 'Five walking lanes are scored every frame. Risk combines severity, proximity and lateral overlap; cost adds travel and edge penalties. Hysteresis keeps the spoken advice stable instead of jittering.',
    tags: ['5 lanes', '42cm clearance', 'Hysteresis'],
  },
  {
    icon: Radio,
    title: 'Collaboration — one shared picture',
    text: 'Hazard reports, verifications, SOS and journeys live on an authoritative Node server and reach every connected client instantly over a single WebSocket.',
    tags: ['WebSocket', 'Server-authoritative', 'Under 1s'],
  },
];

const LOOP = [
  { n: '01', title: 'Sense', text: 'A frame is drawn to a canvas and read locally. No network, no model download.' },
  { n: '02', title: 'Detect', text: 'Cells whose edge energy jumps become detections with bearing, distance band, width and confidence.' },
  { n: '03', title: 'Plan', text: 'All five lanes are re-scored. The cheapest safe lane wins if it beats the current one by 0.12.' },
  { n: '04', title: 'Speak', text: 'The instruction is spoken with priority, drawn as a safe ribbon, and published to the floating panel.' },
];

const SCREENS = [
  { to: '/', icon: Eye, name: 'Dashboard', text: 'Live safety score, hazard count, community presence and the guidance panel.' },
  { to: '/scan', icon: Camera, name: 'Live Scan', text: 'Obstacle boxes, safe-path ribbon and spoken guidance every 220 ms.' },
  { to: '/alerts', icon: Bell, name: 'Alerts', text: 'Severity filters, persisted history and automatic voice announcements.' },
  { to: '/routes', icon: RouteIcon, name: 'Routes', text: 'Compare walking routes, choose one and broadcast the choice to peers.' },
  { to: '/report', icon: MapPin, name: 'Report', text: 'Type, severity and description — published to the map instantly.' },
  { to: '/community', icon: Users, name: 'Community', text: 'Hazard map with upvotes, verifications and resolutions.' },
  { to: '/sos', icon: Siren, name: 'SOS', text: 'Three-second hold, live location trail and responder acknowledgements.' },
  { to: '/indoor', icon: Layers, name: 'Indoor', text: 'Floor-plan navigation with turn-by-turn cues.' },
  { to: '/crossing', icon: Footprints, name: 'Crossing', text: 'Pedestrian signal countdown driven by the server clock and spoken aloud.' },
  { to: '/journey', icon: Navigation, name: 'Journey', text: 'Share code, live distance, safety score and alert trail.' },
  { to: '/guardian', icon: ShieldCheck, name: 'Guardian', text: 'Watch a journey by code: path, alerts and status in real time.' },
  { to: '/settings', icon: Sparkles, name: 'Settings', text: 'Voice, rate, pitch, language, sensitivity, contrast, motion and text scale.' },
];

const CLIENT_EVENTS = ['hello', 'position', 'hazard:report', 'hazard:vote', 'sos:start', 'sos:update', 'sos:ack', 'sos:end', 'journey:start', 'journey:update', 'journey:end', 'journey:watch', 'route:select', 'ping'];
const SERVER_EVENTS = ['welcome', 'peers', 'hazard:new', 'hazard:created', 'hazard:update', 'sos', 'sos:end', 'signal', 'journey', 'journey:missing', 'route:selected', 'heartbeat', 'pong'];

const FLOWS = [
  {
    title: 'Community hazard',
    steps: ['Navigator reports type, severity and description.', 'Server stamps reporter, time and location.', 'hazard:new is broadcast to every client.', 'Map, feed, count and speech all update without a refresh.'],
  },
  {
    title: 'Emergency SOS',
    steps: ['Hold for three seconds to avoid accidental triggers.', 'Server stores one active incident and broadcasts it.', 'Location trail re-broadcast every 1.5 s.', 'Responders acknowledge; "I am safe" clears every screen.'],
  },
  {
    title: 'Journey + guardian',
    steps: ['Journey starts; the server issues an 8-character code.', 'Position, distance and safety score stream to the server.', 'A guardian opens /guardian/CODE and watches live.', 'Ending the journey freezes the guardian view with a summary.'],
  },
];

const PALETTE = [
  { name: 'Page base', hex: '#040814' },
  { name: 'Electric violet', hex: '#5B4BFF' },
  { name: 'Highlight violet', hex: '#7B5CFF' },
  { name: 'Neon cyan', hex: '#4FD8FF' },
  { name: 'Ice text', hex: '#EDF3FF' },
  { name: 'Muted', hex: '#8FA3C6' },
];

const DEMO = [
  ['0:00', 'Hook', 'A cane tells you something is there. VisionPath tells you what, how far and where to step.'],
  ['0:20', 'Live scan', 'Start the scan and let it speak. Point at the obstacle box and the safe ribbon.'],
  ['0:50', 'Re-route proof', 'Introduce an obstacle; the instruction changes because clearance dropped below 42 cm.'],
  ['1:20', 'Collaboration', 'Report a hazard in a second window. Watch it land on the first, spoken.'],
  ['1:50', 'SOS', 'Hold three seconds, acknowledge from the second window, then press "I am safe".'],
  ['2:20', 'Journey', 'Start a journey, read out the code, open the guardian view.'],
  ['2:45', 'Accessibility', 'Flip high contrast and text scale; show the text path with voice off.'],
];

const LIMITS = [
  'Heuristic vision, not a trained object recogniser — the interface is designed for a model to drop in.',
  'Distance is banded (≈1.3 / 2.8 / 4.8 m) because there is no depth sensor.',
  'Server state is in memory: one active SOS, no persistence, guest profiles only.',
  'Simulated peers are labelled as simulated rather than presented as real users.',
];

export default function Brief() {
  return (
    <>
      <Reveal>
        <section className="hero">
          <span className="eyebrow" style={{ color: 'var(--pink)' }}>Project brief · expo</span>
          <h1 style={{ maxWidth: '26ch' }}>
            Independence isn&apos;t knowing the way. It&apos;s <em>not having to guess</em>.
          </h1>
          <p style={{ maxWidth: '62ch' }}>
            VisionPath is a realtime assistive navigation system for blind and low-vision people. The camera
            reads the next few metres on device, a five-lane planner keeps choosing the safest line, the
            instruction is spoken, and hazards reported by anyone nearby reach everyone in under a second.
          </p>
          <div className="hero__actions">
            <Link to="/scan" className="btn btn--light"><Camera size={17} /> Try the live scanner</Link>
            <Link to="/community" className="btn btn--ghost"><Globe2 size={17} /> See the shared map</Link>
          </div>
          <div className="hero__meta">
            <div><div className="k">13</div><div className="l">Live screens</div></div>
            <div><div className="k">5</div><div className="l">Path lanes</div></div>
            <div><div className="k">&lt;1s</div><div className="l">Hazard broadcast</div></div>
            <div><div className="k">100%</div><div className="l">On-device vision</div></div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="The gap"
            title="A cane reacts at contact. A map stops at the street."
            sub="Neither tells you what is in the next three metres, how wide it is, or whether the line you are about to walk is still clear. That is the layer VisionPath adds."
          />
          <div className="grid grid--4">
            {METRICS.map((m) => (
              <Card key={m.label}>
                <Stat value={m.value} label={m.label} note={m.note} />
              </Card>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="Concept"
            title="Three systems, one continuous loop"
            sub="Perception answers what is there. Guidance answers where to step. Collaboration answers what other people already know."
          />
          <div className="grid grid--3">
            {PILLARS.map((p) => (
              <Card key={p.title}>
                <CardHead icon={p.icon} title={p.title} />
                <p style={{ fontSize: '0.86rem' }}>{p.text}</p>
                <div className="brief-tags">
                  {p.tags.map((t) => <span key={t} className="pill">{t}</span>)}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="How it works"
            title="The loop, every 220 milliseconds"
            sub="No recorded route and no fixed clip. The scene is re-scored continuously, which is why guidance keeps correcting itself as the world changes."
          />
          <div className="grid grid--4">
            {LOOP.map((step) => (
              <Card key={step.n}>
                <span className="brief-step-n">{step.n}</span>
                <h3 style={{ margin: '8px 0 6px', fontSize: '1.05rem' }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>{step.text}</p>
              </Card>
            ))}
          </div>
          <Card className="brief-equation">
            <code>risk = severity × (1 − distance/6.5)^1.4 × (0.45 + overlap) × 1.5</code>
            <code>cost = risk + 0.42 × Δlane + 0.06 × |offset|</code>
            <code>switch lane only if cost improves by &gt; 0.12</code>
          </Card>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="Feature tour"
            title="Thirteen screens, all wired to live state"
            sub="Every screen reads from the same shared stores — scanner state, settings and the realtime channel."
          />
          <div className="grid grid--3">
            {SCREENS.map((s) => (
              <Link key={s.to} to={s.to} className="card card--hover brief-screen">
                <span className="card__icon" aria-hidden="true"><s.icon size={18} strokeWidth={1.7} /></span>
                <span>
                  <strong style={{ display: 'block', fontSize: '0.92rem' }}>{s.name}</strong>
                  <span style={{ fontSize: '0.79rem', color: 'var(--ink-soft)' }}>{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="Architecture"
            title="A thin client that thinks, a server that remembers"
            sub="Perception, planning and speech run in the browser. The Node process is the single source of truth for everything shared."
          />
          <div className="brief-arch">
            <Card>
              <h3>Browser · React + Vite</h3>
              <ul className="brief-list">
                <li><b>Pages</b> — 13 routes via React Router, lazy loaded</li>
                <li><b>vision.js</b> — canvas detector + deterministic fallback simulator</li>
                <li><b>guidance.js</b> — five-lane planner, instruction wording, safe ribbon</li>
                <li><b>voice.js</b> — speech synthesis with priority and de-duplication</li>
                <li><b>realtime.jsx</b> — one WebSocket, reconnect, shared store</li>
                <li><b>Leaflet</b> — hazard and peer map</li>
              </ul>
            </Card>
            <div className="brief-wire" aria-hidden="true">
              <span>JSON over WebSocket</span>
              <ArrowRight size={18} />
            </div>
            <Card>
              <h3>Server · Node + ws</h3>
              <ul className="brief-list">
                <li><b>hazards</b> — seeded map + live reports, capped at 90</li>
                <li><b>clients</b> — profiles and positions</li>
                <li><b>sos</b> — active incident, acknowledgements, location trail</li>
                <li><b>journeys</b> — code → path, haversine distance, safety</li>
                <li><b>crossings</b> — 26 s / 32 s cycles from the server clock</li>
                <li><b>timers</b> — signals 1 s, peers 1.5 s, heartbeat 15 s</li>
              </ul>
            </Card>
          </div>
          <div className="brief-events">
            <div>
              <span className="brief-label">Client → server</span>
              <div className="brief-codes">{CLIENT_EVENTS.map((e) => <code key={e}>{e}</code>)}</div>
            </div>
            <div>
              <span className="brief-label">Server → clients</span>
              <div className="brief-codes">{SERVER_EVENTS.map((e) => <code key={e}>{e}</code>)}</div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="Realtime flows"
            title="What actually happens when you press the button"
            sub="Everything below was verified against the running app, not sketched on a whiteboard."
          />
          <div className="grid grid--3">
            {FLOWS.map((f) => (
              <Card key={f.title}>
                <h3>{f.title}</h3>
                <ol className="brief-ordered">
                  {f.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead
            eyebrow="Design"
            title="Glass that stays readable over a machine-vision backdrop"
            sub="A single digital-eye artwork carries the theme. Every surface holding text is frosted: a white sheen over a navy film, blurred, with a one-pixel light rim."
          />
          <div className="grid grid--2">
            <Card>
              <h3>Palette</h3>
              <div className="brief-swatches">
                {PALETTE.map((c) => (
                  <div key={c.hex} className="swatch">
                    <i style={{ background: c.hex }} aria-hidden="true" />
                    <strong>{c.name}</strong>
                    <span>{c.hex}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3>Accessibility, built in</h3>
              <ul className="brief-list">
                <li>Ears-first: every decision has a spoken form with priority levels</li>
                <li>Speech rate, pitch, language, volume and mute controls</li>
                <li>High contrast mode removes blur and uses pure black and white</li>
                <li>Text scale, reduced motion and colour-blind safe semantics</li>
                <li>Severity is shape + word, never colour alone</li>
                <li>Skip link, landmarks, live regions, visible focus rings</li>
              </ul>
            </Card>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead eyebrow="Demo" title="Three minutes, seven beats" sub="Works with a camera or without one — the simulator drives the same planner and voice." />
          <Card>
            <ol className="brief-timeline">
              {DEMO.map(([time, title, text]) => (
                <li key={time}>
                  <span className="brief-time">{time}</span>
                  <span><strong>{title}</strong> — {text}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <SectionHead eyebrow="Honestly" title="Limits and the next version" sub="Say these before a judge finds them." />
          <div className="grid grid--2">
            <Card>
              <h3>Known limits</h3>
              <ul className="brief-list">
                {LIMITS.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </Card>
            <Card>
              <h3>Next</h3>
              <ul className="brief-list">
                <li>Swap the heuristic detector for an on-device model behind the same interface</li>
                <li>Depth from LiDAR or stereo for metric distance</li>
                <li>Offline-first PWA with queued reports and cached tiles</li>
                <li>Braille and bone-conduction output; more languages</li>
                <li>Persistence and city-scale fan-out for hazards and journeys</li>
              </ul>
            </Card>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="section">
          <Card dark>
            <span className="eyebrow">Try it</span>
            <h2 style={{ maxWidth: '30ch' }}>The best explanation is the live run.</h2>
            <p style={{ maxWidth: '58ch' }}>
              Start the scanner and walk the corridor. Report something in a second window and watch it appear.
              Hold SOS and acknowledge it from a guardian view.
            </p>
            <div className="hero__actions">
              <Link to="/scan" className="btn btn--light"><Camera size={17} /> Live scan</Link>
              <Link to="/sos" className="btn btn--danger"><Siren size={17} /> SOS</Link>
              <Link to="/journey" className="btn btn--ghost"><ActivityIcon /> Journey</Link>
            </div>
          </Card>
        </section>
      </Reveal>
    </>
  );
}

function ActivityIcon() {
  return <Mic size={17} />;
}
