import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpDown, Building2, Footprints, MapPin, Navigation, Route, Search, ShieldCheck,
  TrafficCone, Waves,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, SectionHead, SeverityBadge } from '../components/UI';
import { useLivePosition, useRealtime } from '../lib/realtime';
import { useSettings } from '../lib/settings';
import { buildRoutes, formatDistance, formatDuration, offsetPoint } from '../lib/geo';
import { speak } from '../lib/voice';

const LANDMARKS = [
  { id: 'library', name: 'Community library', area: '2nd cross, near the park', lat: 12.9725, lng: 77.5968 },
  { id: 'metro', name: 'Metro station — west gate', area: 'Lift access, tactile path', lat: 12.9708, lng: 77.5929 },
  { id: 'park', name: 'Cubbon Park east gate', area: 'Level entry, benches every 20 m', lat: 12.9732, lng: 77.5981 },
  { id: 'pharmacy', name: 'Accessible pharmacy', area: 'Ramp on the north side', lat: 12.9701, lng: 77.5962 },
];

const ROUTE_STYLE = {
  fastest: { color: '#A9C4FF', label: 'Fastest' },
  safest: { color: '#EDF3FF', label: 'Safest' },
  accessible: { color: '#7ED9B4', label: 'Most accessible' },
};

export default function RoutesPage() {
  const { hazards, send, pushEvent, live } = useRealtime();
  const { current, isFallback } = useLivePosition(true);
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [destination, setDestination] = useState(LANDMARKS[0]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('safest');
  const [starting, setStarting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const origin = useMemo(() => ({ lat: current.lat, lng: current.lng }), [current.lat, current.lng]);

  const routes = useMemo(
    () => buildRoutes(origin, destination, hazards),
    [origin.lat, origin.lng, destination.lat, destination.lng, hazards],
  );

  const selected = routes.find((r) => r.id === selectedId) || routes[0];

  useEffect(() => {
    if (!routes.some((r) => r.id === selectedId)) setSelectedId(routes.find((r) => r.recommended)?.id || 'safest');
  }, [routes, selectedId]);

  const suggestions = LANDMARKS.filter((l) =>
    `${l.name} ${l.area}`.toLowerCase().includes(query.toLowerCase()),
  );

  const chooseRoute = (route, announce = true) => {
    setSelectedId(route.id);
    send({ type: 'route:select', route: { id: route.id, name: route.name, safety: route.safety } });
    if (announce && settings.voice) {
      speak(
        `${route.name} route. ${formatDistance(route.distance)}, about ${formatDuration(route.duration)}. ` +
        `Safety score ${route.safety}. ${route.obstacleCount} hazards on this line, ${route.crossings} crossings.`,
        { force: true, priority: 'high' },
      );
    }
  };

  const startWalk = () => {
    setStarting(true);
    send({ type: 'journey:start', destination: `${destination.name}, ${destination.area}` });
    pushEvent({
      kind: 'route',
      severity: 'low',
      title: `${selected.name} route started`,
      detail: `Guidance to ${destination.name} · ${formatDistance(selected.distance)}`,
    });
    speak(`Guided walk started on the ${selected.name.toLowerCase()} route.`, { force: true, priority: 'high' });
    setTimeout(() => navigate('/journey'), 350);
  };

  const mapMarkers = [
    { lat: destination.lat, lng: destination.lng, tone: 'brand', badge: '★', label: destination.name, meta: destination.area },
    ...hazards
      .filter((h) => h.status !== 'resolved')
      .map((h) => ({
        lat: h.lat, lng: h.lng, tone: h.severity, badge: '!',
        label: h.label, meta: `${h.description} · ${h.verifies} verifications`,
      })),
  ];

  const mapRoutes = routes.map((r) => ({
    latlngs: r.latlngs,
    name: r.name,
    color: ROUTE_STYLE[r.id].color,
    weight: r.id === selectedId ? 7 : 4,
    opacity: r.id === selectedId ? 0.95 : 0.4,
    dashed: r.id !== selectedId,
  }));

  return (
    <>
      <SectionHead
        eyebrow="Smart routes"
        title="A path scored against the world as it is now"
        sub="Fastest, safest and most accessible options re-score live as hazards are reported or cleared around you."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--neutral'}`}><span className="dot-live" /> {hazards.filter((h) => h.status !== 'resolved').length} live hazards</span>}
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Navigation} title="Where are you going?" sub={isFallback ? 'Using the demo neighbourhood' : 'From your live position'} />
            <div style={{ position: 'relative' }}>
              <label htmlFor="destination-search" className="sr-only">Search destinations</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: 16, opacity: 0.5 }} aria-hidden="true" />
                <input
                  id="destination-search"
                  type="search"
                  placeholder="Search a landmark, station or address"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  style={{ paddingLeft: 40 }}
                  aria-autocomplete="list"
                  aria-controls="destination-suggestions"
                />
              </div>
              {suggestOpen && suggestions.length ? (
                <div id="destination-suggestions" role="listbox" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {suggestions.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="option"
                      aria-selected={destination.id === l.id}
                      className="chip-btn"
                      style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 46, padding: '8px 12px' }}
                      onClick={() => {
                        setDestination(l);
                        setQuery('');
                        setSuggestOpen(false);
                        speak(`Destination set to ${l.name}.`);
                      }}
                    >
                      <Building2 size={14} /> <span style={{ flex: 1 }}>{l.name}<span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.6 }}>{l.area}</span></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="pill"><MapPin size={13} /> {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}</span>
              <span className="pill"><Footprints size={13} /> Walking pace {selected.pace} m/min</span>
            </div>
          </Card>

          <div className="route-panel">
            {routes.map((route) => {
              const style = ROUTE_STYLE[route.id];
              const active = route.id === selectedId;
              return (
                <button
                  key={route.id}
                  type="button"
                  className={`route-option ${active ? 'is-active' : ''}`}
                  onClick={() => chooseRoute(route)}
                  aria-pressed={active}
                >
                  <div className="route-option__top">
                    <div>
                      <h4 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: style.color, display: 'inline-block' }} aria-hidden="true" />
                        {route.name}
                        {route.recommended ? <span className="badge badge--low">Recommended</span> : null}
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '0.79rem' }}>{route.description}</p>
                    </div>
                    <span className="route-option__time">{formatDuration(route.duration)}</span>
                  </div>
                  <div className="route-option__stats">
                    <span><b>{formatDistance(route.distance)}</b> distance</span>
                    <span><b>{route.obstacleCount}</b> hazards</span>
                    <span><b>{route.crossings}</b> crossings</span>
                    <span><b>{route.surface}</b> surface</span>
                  </div>
                  <div className="score-bar" aria-hidden="true">
                    <i style={{ width: `${route.safety}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                    <span>Safety score</span>
                    <strong style={{ color: 'var(--ink)' }}>{route.safety}/100</strong>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={startWalk} disabled={starting}>
              {starting ? 'Starting…' : 'Start guided walk'} <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => speak(`Repeating. ${selected.name} route. ${selected.description}`, { force: true, priority: 'high' })}
            >
              <Waves size={16} /> Repeat route aloud
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card style={{ padding: 10 }}>
            <MapView
              center={[origin.lat, origin.lng]}
              zoom={15}
              tall
              height={430}
              routes={mapRoutes}
              markers={mapMarkers}
              you={{ lat: origin.lat, lng: origin.lng }}
            />
          </Card>

          <Card>
            <CardHead
              icon={ShieldCheck}
              title={`${selected.name} route, step by step`}
              sub={`${formatDistance(selected.distance)} · ${formatDuration(selected.duration)} · ${selected.hazards.length} live hazards nearby`}
              aside={<SeverityBadge severity={selected.safety > 88 ? 'low' : selected.safety > 72 ? 'medium' : 'high'} />}
            />
            <div className="timeline">
              <div className="timeline__item is-success">
                <div className="timeline__time">Start</div>
                <strong>Leave from your current position</strong>
                <p>Guidance begins with a corridor scan and a spoken confirmation.</p>
              </div>
              {selected.crossings > 0 ? (
                <div className="timeline__item">
                  <div className="timeline__time">Crossing</div>
                  <strong>{selected.crossings} signal-controlled crossings</strong>
                  <p>Crossing assistant will take over, announcing when it is safe.</p>
                </div>
              ) : null}
              {selected.hazards.slice(0, 3).map((h) => (
                <div key={h.id} className={`timeline__item ${h.severity === 'critical' ? 'is-critical' : ''}`}>
                  <div className="timeline__time">{h.label}</div>
                  <strong>{h.description}</strong>
                  <p>
                    Reported by {h.reporter} · {h.verifies} verifications.{' '}
                    {selected.name === 'Safest' ? 'Path detours around it.' : 'You will be guided around it on approach.'}
                  </p>
                </div>
              ))}
              <div className="timeline__item is-success">
                <div className="timeline__time">Arrive</div>
                <strong>{destination.name}</strong>
                <p>{destination.area}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
              <span><Footprints size={13} style={{ verticalAlign: '-2px' }} /> Step-free available</span>
              <span><ArrowUpDown size={13} style={{ verticalAlign: '-2px' }} /> {selected.id === 'accessible' ? 'No stairs' : '1 stair section'}</span>
              <span><TrafficCone size={13} style={{ verticalAlign: '-2px' }} /> {selected.obstacleCount} reported obstacles</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
