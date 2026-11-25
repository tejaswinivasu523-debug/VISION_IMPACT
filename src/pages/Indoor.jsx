import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility, ArrowRight, ArrowUpDown, Bath, Building2, Check, DoorOpen, Footprints, Mic, MicOff,
  MoveUp, Navigation, RotateCcw, TriangleAlert, Utensils,
} from 'lucide-react';
import { Card, CardHead, SectionHead } from '../components/UI';
import { useSettings } from '../lib/settings';
import { speak } from '../lib/voice';

/* ------------------------------------------------------------- floor graph */
const NODES = {
  entrance: { x: 40, y: 300, label: 'Main entrance', landmark: 'glass doors' },
  lobby: { x: 130, y: 300, label: 'Lobby', landmark: 'reception desk' },
  fountain: { x: 230, y: 300, label: 'Fountain atrium', landmark: 'circular bench' },
  junction: { x: 330, y: 300, label: 'Central junction', landmark: 'blue floor strip' },
  pharmacy: { x: 470, y: 300, label: 'Pharmacy counter', landmark: 'low counter' },
  exit: { x: 565, y: 300, label: 'East exit', landmark: 'ramp outside' },
  washroom: { x: 150, y: 190, label: 'Accessible washroom', landmark: 'tactile sign on the right' },
  northJunction: { x: 330, y: 190, label: 'North junction', landmark: 'lift sign overhead' },
  stairs: { x: 480, y: 190, label: 'Stairs to level 3', landmark: 'handrail on the left' },
  cafe: { x: 150, y: 410, label: 'Café seating', landmark: 'warm floor light' },
  southJunction: { x: 330, y: 410, label: 'South junction', landmark: 'planters' },
  lift: { x: 480, y: 410, label: 'Lift lobby', landmark: 'braille panel at 1.1 m' },
};

const EDGES = [
  ['entrance', 'lobby'], ['lobby', 'fountain'], ['fountain', 'junction'],
  ['junction', 'pharmacy'], ['pharmacy', 'exit'],
  ['washroom', 'northJunction'], ['northJunction', 'stairs'], ['northJunction', 'junction'],
  ['stairs', 'pharmacy'],
  ['cafe', 'southJunction'], ['southJunction', 'lift'], ['southJunction', 'junction'],
  ['lift', 'pharmacy'],
  ['washroom', 'lobby'], ['cafe', 'lobby'],
];

const DESTINATIONS = [
  { id: 'washroom', label: 'Accessible washroom', icon: Bath },
  { id: 'lift', label: 'Lift lobby', icon: MoveUp },
  { id: 'pharmacy', label: 'Pharmacy counter', icon: Accessibility },
  { id: 'cafe', label: 'Café seating', icon: Utensils },
  { id: 'stairs', label: 'Stairs to level 3', icon: ArrowUpDown },
  { id: 'exit', label: 'East exit', icon: DoorOpen },
];

const BLOCKAGES = [
  { id: 'north', label: 'North corridor closed', edges: [['washroom', 'northJunction'], ['northJunction', 'stairs']] },
  { id: 'liftLobby', label: 'Lift lobby obstructed', edges: [['southJunction', 'lift'], ['lift', 'pharmacy']] },
];

const dist = (a, b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y);
const edgeKey = (a, b) => [a, b].sort().join('|');

function shortestPath(start, goal, blockedEdges) {
  const adj = new Map();
  EDGES.forEach(([a, b]) => {
    if (blockedEdges.has(edgeKey(a, b))) return;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, dist(a, b)]);
    adj.get(b).push([a, dist(a, b)]);
  });
  const distances = new Map(Object.keys(NODES).map((id) => [id, Infinity]));
  const previous = new Map();
  distances.set(start, 0);
  const unvisited = new Set(Object.keys(NODES));
  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    unvisited.forEach((id) => {
      if (distances.get(id) < best) {
        best = distances.get(id);
        current = id;
      }
    });
    if (!current) break;
    unvisited.delete(current);
    if (current === goal) break;
    (adj.get(current) || []).forEach(([neighbour, weight]) => {
      if (!unvisited.has(neighbour)) return;
      const alt = distances.get(current) + weight;
      if (alt < distances.get(neighbour)) {
        distances.set(neighbour, alt);
        previous.set(neighbour, current);
      }
    });
  }
  if (distances.get(goal) === Infinity) return null;
  const path = [goal];
  let cursor = goal;
  while (previous.has(cursor)) {
    cursor = previous.get(cursor);
    path.unshift(cursor);
  }
  return path;
}

function heading(from, to) {
  const a = NODES[from];
  const b = NODES[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

function stepsFromPath(path) {
  return path.slice(1).map((node, index) => {
    const prev = path[Math.max(0, index - 1)];
    const from = path[Math.max(0, index)];
    const direction = heading(from, node);
    const metres = Math.max(3, Math.round(dist(from, node) / 7));
    const previousDirection = index > 0 ? heading(prev, from) : null;
    let turn = '';
    if (previousDirection) {
      const order = ['north', 'east', 'south', 'west'];
      const diff = (order.indexOf(direction) - order.indexOf(previousDirection) + 4) % 4;
      turn = diff === 1 ? 'Turn right, then ' : diff === 3 ? 'Turn left, then ' : 'Continue straight, ';
    }
    return {
      id: node,
      text: `${turn}walk ${metres} steps to the ${NODES[node].label}. Landmark: ${NODES[node].landmark}.`,
      short: NODES[node].label,
      direction,
    };
  });
}

const VENUES = ['City Care Hospital · Level 2', 'Meridian Mall · Upper ground', 'Campus library · First floor'];

export default function Indoor() {
  const { settings, update } = useSettings();
  const [destination, setDestination] = useState('washroom');
  const [blocked, setBlocked] = useState([]);
  const [venue, setVenue] = useState(VENUES[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const [guiding, setGuiding] = useState(false);
  const timerRef = useRef(null);

  const blockedSet = useMemo(() => {
    const set = new Set();
    blocked.forEach((id) => BLOCKAGES.find((b) => b.id === id)?.edges.forEach(([a, b]) => set.add(edgeKey(a, b))));
    return set;
  }, [blocked]);

  const path = useMemo(() => shortestPath('entrance', destination, blockedSet), [destination, blockedSet]);
  const steps = useMemo(() => (path ? stepsFromPath(path) : []), [path]);
  const totalMetres = useMemo(
    () => (path ? path.slice(1).reduce((sum, node, i) => sum + dist(path[i], node), 0) : 0),
    [path],
  );

  useEffect(() => {
    setStepIndex(0);
    setGuiding(false);
    clearInterval(timerRef.current);
  }, [destination, blocked]);

  useEffect(() => {
    if (!guiding || !steps.length) return undefined;
    const advance = () => {
      setStepIndex((prev) => {
        if (prev >= steps.length - 1) {
          setGuiding(false);
          if (settings.voice) speak('You have arrived. Guidance complete.', { force: true, priority: 'high' });
          return prev;
        }
        const next = prev + 1;
        if (settings.voice) {
          speak(`${next === 1 ? 'Starting guidance. ' : ''}${steps[next].text}`, { force: true, priority: 'high' });
        }
        return next;
      });
    };
    timerRef.current = setInterval(advance, 4200);
    return () => clearInterval(timerRef.current);
  }, [guiding, steps, settings.voice]);

  const startGuidance = () => {
    if (!steps.length) return;
    setGuiding(true);
    setStepIndex(0);
    if (settings.voice) speak(`Indoor guidance started. ${steps[0].text}`, { force: true, priority: 'high' });
  };

  const toggleBlock = (id) => {
    setBlocked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (settings.voice) {
        speak(next.includes(id) ? 'Obstruction recorded. Recalculating your indoor route now.' : 'Obstruction cleared. Route recalculated.');
      }
      return next;
    });
  };

  const polyline = path ? path.map((id) => `${NODES[id].x},${NODES[id].y}`).join(' ') : '';

  return (
    <>
      <SectionHead
        eyebrow="Indoor navigation"
        title="Floor plans that re-route around what is in the way"
        sub="Indoor guidance follows corridors, calls out landmarks and recalculates the instant an obstruction is reported — narrated step by step."
        aside={
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ voice: !settings.voice })}>
            {settings.voice ? <Mic size={15} /> : <MicOff size={15} />} Voice {settings.voice ? 'on' : 'off'}
          </button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.35rem' }}>{venue}</h3>
                <p className="card__sub">Entrance → {DESTINATIONS.find((d) => d.id === destination)?.label} · {Math.round(totalMetres / 7)} steps</p>
              </div>
              <span className={`badge ${path ? 'badge--low' : 'badge--critical'}`}>
                {path ? 'Route available' : 'No clear route'}
              </span>
            </div>

            <div className="floorplan">
              <svg viewBox="0 0 620 520" role="img" aria-label={`Floor plan showing a route from the entrance to the ${DESTINATIONS.find((d) => d.id === destination)?.label}`}>
                <rect x="0" y="0" width="620" height="520" fill="#070D20" />

                {/* corridor bands */}
                <rect x="24" y="284" width="568" height="34" fill="#0F1730" />
                <rect x="113" y="172" width="26" height="256" fill="#0F1730" />
                <rect x="317" y="172" width="26" height="256" fill="#0F1730" />
                <rect x="465" y="172" width="28" height="256" fill="#0F1730" />
                <rect x="126" y="174" width="368" height="30" fill="#0F1730" />
                <rect x="126" y="394" width="368" height="30" fill="#0F1730" />

                {/* rooms */}
                <g fill="#0A1128" stroke="#A9C4FF" strokeWidth="1.4">
                  <rect x="36" y="52" width="200" height="100" rx="9" />
                  <rect x="252" y="52" width="180" height="100" rx="9" />
                  <rect x="448" y="52" width="136" height="100" rx="9" />
                  <rect x="36" y="368" width="200" height="110" rx="9" opacity="0.75" />
                  <rect x="448" y="368" width="136" height="110" rx="9" opacity="0.75" />
                  <rect x="252" y="442" width="180" height="42" rx="9" opacity="0.5" />
                </g>
                <g fill="#EDF3FF" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600" opacity="0.72">
                  <text x="50" y="78">ACCESSIBLE WASHROOMS</text>
                  <text x="266" y="78">NURSING STATION</text>
                  <text x="462" y="78">STAIRS · LEVEL 3</text>
                  <text x="50" y="394">CAFÉ SEATING</text>
                  <text x="462" y="394">LIFTS</text>
                  <text x="266" y="470">PHARMACY QUEUE</text>
                </g>

                {/* landmarks */}
                <g fill="#A9C4FF">
                  <circle cx="230" cy="301" r="9" />
                  <circle cx="565" cy="300" r="7" />
                </g>
                <text x="216" y="330" fontSize="9" fill="#EDF3FF" opacity="0.6" fontFamily="Inter, sans-serif">fountain</text>

                {/* route */}
                {path ? (
                  <>
                    <polyline points={polyline} fill="none" stroke="#EDF3FF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.16" />
                    <polyline points={polyline} fill="none" stroke="#EDF3FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 7">
                      <animate attributeName="stroke-dashoffset" from="34" to="0" dur="1.2s" repeatCount="indefinite" />
                    </polyline>
                  </>
                ) : null}

                {/* nodes */}
                {Object.entries(NODES).map(([id, node]) => {
                  const onPath = path?.includes(id);
                  const isTarget = id === destination;
                  return (
                    <g key={id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isTarget ? 10 : onPath ? 6.5 : 4.5}
                        fill={isTarget ? '#F0708F' : onPath ? '#EDF3FF' : '#93A6C9'}
                        stroke="#0A1128"
                        strokeWidth="2"
                      />
                      {isTarget ? (
                        <text x={node.x} y={node.y - 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#EDF3FF" fontFamily="Inter, sans-serif">
                          YOU ARE GOING HERE
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {/* blocked corridors */}
                {blockedSet.has(edgeKey('washroom', 'northJunction')) ? (
                  <g>
                    <line x1="270" y1="176" x2="290" y2="202" stroke="#F0708F" strokeWidth="4" strokeLinecap="round" />
                    <line x1="290" y1="176" x2="270" y2="202" stroke="#F0708F" strokeWidth="4" strokeLinecap="round" />
                  </g>
                ) : null}
                {blockedSet.has(edgeKey('southJunction', 'lift')) ? (
                  <g>
                    <line x1="392" y1="396" x2="412" y2="422" stroke="#F0708F" strokeWidth="4" strokeLinecap="round" />
                    <line x1="412" y1="396" x2="392" y2="422" stroke="#F0708F" strokeWidth="4" strokeLinecap="round" />
                  </g>
                ) : null}
              </svg>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {BLOCKAGES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`chip-btn ${blocked.includes(b.id) ? 'is-on' : ''}`}
                  onClick={() => toggleBlock(b.id)}
                  aria-pressed={blocked.includes(b.id)}
                >
                  <TriangleAlert size={13} /> {b.label}
                </button>
              ))}
              <button type="button" className="chip-btn" onClick={() => setBlocked([])} disabled={!blocked.length}>
                <RotateCcw size={13} /> Clear obstructions
              </button>
            </div>
            {!path ? (
              <p className="hint" style={{ color: 'var(--critical)' }}>
                All routes to this destination are blocked. Ask a staff member for assistance — the guidance system
                will not invent a path through an obstruction.
              </p>
            ) : null}
          </Card>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="venue-select">Venue</label>
            <select id="venue-select" value={venue} onChange={(e) => setVenue(e.target.value)}>
              {VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Navigation} title="Choose a destination" sub="Corridors, lifts and washrooms only" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DESTINATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip-btn ${destination === d.id ? 'is-on' : ''}`}
                  onClick={() => {
                    setDestination(d.id);
                    if (settings.voice) speak(`Destination ${d.label}.`);
                  }}
                  style={{ justifyContent: 'flex-start', minHeight: 44, padding: '8px 12px' }}
                  aria-pressed={destination === d.id}
                >
                  <d.icon size={14} /> {d.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead
              icon={Footprints}
              title="Step-by-step guidance"
              sub={path ? `${steps.length} steps · ${Math.round(totalMetres / 7)} paces · about ${Math.max(1, Math.round(totalMetres / 60))} min` : 'Waiting for a route'}
              aside={<button type="button" className="btn btn--sm" onClick={startGuidance} disabled={!path}>{guiding ? 'Guiding…' : 'Start'}</button>}
            />
            {steps.map((step, i) => (
              <div key={step.id} className={`indoor-step ${i === stepIndex ? 'is-now' : ''} ${i < stepIndex ? 'is-done' : ''}`}>
                <span className="indoor-step__n">{i < stepIndex ? <Check size={13} /> : i + 1}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.86rem', display: 'block' }}>{step.short}</strong>
                  <span style={{ fontSize: '0.77rem', color: i === stepIndex ? 'var(--ink-soft)' : 'var(--ink-muted)' }}>{step.text}</span>
                </div>
                <span className="badge badge--neutral">{step.direction}</span>
              </div>
            ))}
            {!steps.length ? <p className="card__sub">No route available through the current obstructions.</p> : null}
            <p className="hint">
              Guidance advances automatically and is spoken aloud. Obstructions immediately recalculate the route.
            </p>
          </Card>

          <Card>
            <CardHead icon={Building2} title="Nearby facilities" sub="Along the current route" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.83rem' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Bath size={14} /> Accessible washroom · 32 m</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MoveUp size={14} /> Lift with braille panel · 48 m</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ArrowRight size={14} /> Staff assistance desk · lobby</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
