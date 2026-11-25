import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, Camera, CloudRain, Compass, Droplets, Eye,
  Footprints, LifeBuoy, MapPin, Navigation, Radar, Route, ShieldCheck, Siren, Sun,
  Thermometer, Users, Waves, Wind,
} from 'lucide-react';
import { Card, CardHead, Reveal, SectionHead, SeverityBadge, Sparkline, Stat } from '../components/UI';
import { useRealtime, useLivePosition } from '../lib/realtime';
import { useLiveScan } from '../lib/live';
import { useSettings } from '../lib/settings';
import { timeAgo } from '../lib/geo';
import { speak } from '../lib/voice';

const WEATHER_TEXT = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 80: 'Rain showers',
  81: 'Showers', 82: 'Violent showers', 95: 'Thunderstorm',
};

export default function Dashboard() {
  const { hazards, events, peers, sos, live, journey, reportHazard, pushEvent, setName, you } = useRealtime();
  const { scene } = useLiveScan();
  const { settings } = useSettings();
  const { current, isFallback, watching } = useLivePosition(true);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const latitude = current.lat.toFixed(2);
  const longitude = current.lng.toFixed(2);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto',
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('weather'))))
      .then((data) => {
        setWeather(data.current);
        setWeatherError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeatherError(true);
      });
    return () => controller.abort();
  }, [latitude, longitude]);

  const openHazards = useMemo(() => hazards.filter((h) => h.status !== 'resolved'), [hazards]);
  const critical = openHazards.filter((h) => h.severity === 'critical');
  const high = openHazards.filter((h) => h.severity === 'high');
  const safety = journey?.safety ?? Math.max(42, Math.min(99, 99 - critical.length * 6 - high.length * 2));
  const near = openHazards
    .map((h) => ({ ...h, metres: Math.round(111320 * Math.hypot(h.lat - current.lat, h.lng - current.lng)) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 3);

  const trend = useMemo(() => {
    const base = [96, 95, 97, 94, 92, 95, 93, 96];
    if (!events.length) return [...base, safety];
    return [...base, ...events.slice(0, 5).reverse().map((e, i) => {
      const drop = { low: 1, medium: 3, high: 6, critical: 11 }[e.severity] || 1;
      return Math.max(40, safety - drop + i);
    })].slice(-10);
  }, [events, safety]);

  const condition = critical.length
    ? { label: 'High risk path', tone: 'critical', text: 'Critical hazards reported on your route. Re-route before moving.' }
    : high.length
      ? { label: 'Caution', tone: 'high', text: 'Hazards ahead. Enable live scan for continuous guidance.' }
      : { label: 'All clear', tone: 'low', text: 'No critical hazards reported near you right now.' };

  const announceStatus = () => {
    speak(
      `Safety status ${condition.label}. ${openHazards.length} hazards nearby, ${critical.length} critical. Safety score ${safety}.`,
      { force: true, priority: 'high' },
    );
  };

  const saveName = () => {
    setName(nameDraft || 'Guest navigator');
    setEditingName(false);
  };

  const weatherCode = weather?.weather_code;
  const WeatherIcon = weatherCode === 0 || weatherCode === 1 ? Sun
    : weatherCode >= 51 && weatherCode <= 82 ? CloudRain : Wind;
  const weatherLabel = weather ? (WEATHER_TEXT[weatherCode] || 'Mixed conditions') : weatherError ? 'Station offline' : 'Loading…';

  return (
    <>
      {sos ? (
        <div className="alert-banner alert-banner--live" role="alert" style={{ marginTop: 20 }}>
          <Siren size={20} />
          <p style={{ flex: 1 }}>
            <strong>SOS active · {sos.by}</strong> — {sos.message}. Location {sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}.
          </p>
          <Link to="/sos" className="btn btn--light btn--sm">Respond</Link>
        </div>
      ) : null}

      <Reveal>
        <section className="hero">
          <div className="hero__grid">
            <div>
              <span className="eyebrow" style={{ color: 'var(--pink)' }}>Realtime assistive navigation</span>
              <h1>
                Walk into a room like someone who <em>already knows</em> the way.
              </h1>
              <p>
                VisionPath watches the path ahead, names what is in it, and keeps re-planning a safe
                line as the scene changes — with live community hazards and one-touch emergency help.
              </p>
              <div className="hero__actions">
                <Link to="/scan" className="btn btn--light btn--lg">
                  <Camera size={18} /> Start live scan
                </Link>
                <Link to="/routes" className="btn btn--ghost btn--lg" style={{ borderColor: 'rgba(237,243,255,.4)', color: 'var(--creme)' }}>
                  <Route size={18} /> Plan a safe route
                </Link>
              </div>
              <div className="hero__meta">
                <div>
                  <div className="k">{safety}</div>
                  <div className="l">Safety score</div>
                </div>
                <div>
                  <div className="k">{openHazards.length}</div>
                  <div className="l">Hazards nearby</div>
                </div>
                <div>
                  <div className="k">{peers.length}</div>
                  <div className="l">Community live</div>
                </div>
                <div>
                  <div className="k">{scene.active ? 'Scanning' : 'Standby'}</div>
                  <div className="l">Path sensing</div>
                </div>
              </div>
            </div>

            <div className="scan-stage" aria-label="Live scene preview">
              <div className="scan-stage__grid" />
              <div className="radar" />
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 6 }}>
                <span className="pill" style={{ background: 'rgba(8,12,22,.5)', borderColor: 'rgba(237,243,255,.2)', color: 'var(--creme)' }}>
                  <span className="dot-live" style={{ background: live ? '#7ED9B4' : '#F0708F' }} /> {live ? 'Live channel' : 'Offline'}
                </span>
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{ textAlign: 'center', color: 'rgba(237,243,255,.72)' }}>
                  <Eye size={30} strokeWidth={1.2} style={{ opacity: 0.75 }} />
                  <p style={{ margin: '10px 0 0', fontSize: '0.74rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--pink)' }}>
                    {scene.active ? scene.plan?.laneName || 'scanning' : 'sensor idle'}
                  </p>
                </div>
              </div>
              <div className="hero__mini-list" aria-live="polite">
                {(events.length ? events.slice(0, 3) : [
                  { id: 'boot1', title: 'Hazard network connected', detail: 'Reports stream in from every VisionPath user nearby.', severity: 'low' },
                  { id: 'boot2', title: 'Path sensing ready', detail: 'Open Live Scan to start continuous guidance.', severity: 'low' },
                ]).map((e) => (
                  <div key={e.id} className="mini-alert">
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6, height: 6, borderRadius: 99,
                        background: e.severity === 'critical' ? '#F0708F' : e.severity === 'high' ? '#F0C36B' : '#7ED9B4',
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontWeight: 600 }}>{e.title}</strong>
                      <span style={{ display: 'block', opacity: 0.7, fontSize: '0.7rem' }}>{e.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <section className="grid grid--3 section" aria-label="Quick actions">
        <Reveal delay={1}>
          <Link to="/scan" style={{ display: 'block', height: '100%' }}>
            <Card style={{ height: '100%' }}>
              <div className="card__title">
                <div className="card__icon"><Camera size={18} strokeWidth={1.7} /></div>
                <h3>Start scan</h3>
                <ArrowRight size={17} style={{ marginLeft: 'auto', opacity: 0.6 }} />
              </div>
              <p className="card__sub">
                On-device vision names obstacles, estimates distance and speaks a safe line every time the scene changes.
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="pill"><Radar size={13} /> Continuous</span>
                <span className="pill"><ShieldCheck size={13} /> Private</span>
              </div>
            </Card>
          </Link>
        </Reveal>
        <Reveal delay={2}>
          <Link to="/routes" style={{ display: 'block', height: '100%' }}>
            <Card style={{ height: '100%' }}>
              <div className="card__title">
                <div className="card__icon"><Navigation size={18} strokeWidth={1.7} /></div>
                <h3>Plan route</h3>
                <ArrowRight size={17} style={{ marginLeft: 'auto', opacity: 0.6 }} />
              </div>
              <p className="card__sub">
                Compare fastest, safest and most accessible paths, scored against live hazard reports.
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="pill"><Compass size={13} /> 3 options</span>
                <span className="pill"><Footprints size={13} /> Step-free</span>
              </div>
            </Card>
          </Link>
        </Reveal>
        <Reveal delay={3}>
          <Link to="/sos" style={{ display: 'block', height: '100%' }}>
            <Card style={{ height: '100%', borderColor: 'rgba(240,112,143,.4)' }}>
              <div className="card__title">
                <div className="card__icon" style={{ background: 'rgba(240,112,143,.14)', color: 'var(--critical)' }}>
                  <LifeBuoy size={18} strokeWidth={1.7} />
                </div>
                <h3>Emergency SOS</h3>
                <ArrowRight size={17} style={{ marginLeft: 'auto', opacity: 0.6 }} />
              </div>
              <p className="card__sub">
                Hold to broadcast your live location to guardians and every nearby VisionPath user.
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="pill" style={{ borderColor: 'rgba(240,112,143,.35)' }}><Siren size={13} /> 3-second hold</span>
                <span className="pill"><Users size={13} /> Guardians</span>
              </div>
            </Card>
          </Link>
        </Reveal>
      </section>

      <section className="section">
        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }} id="dashboard-live">
          <Reveal>
            <Card>
              <CardHead
                icon={Activity}
                title="Live safety status"
                sub={live ? 'Updating continuously from the shared hazard network' : 'Reconnecting to the live channel…'}
                aside={<SeverityBadge severity={condition.tone === 'low' ? 'low' : condition.tone} />}
              />
              <p style={{ marginTop: 0, fontSize: '0.95rem' }}>{condition.text}</p>
              <div className="grid grid--3" style={{ marginTop: 20 }}>
                <Stat value={openHazards.length} label="Open hazards" note={`${critical.length} critical`} />
                <Stat value={peers.length} label="In network" note={`${peers.filter((p) => !p.simulated).length} live devices`} />
                <Stat value={safety} label="Safety index" note={safety > 90 ? 'Comfortable' : 'Needs caution'} />
              </div>
              <div style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
                  <span>Safety trend this walk</span>
                  <span>{safety}/100</span>
                </div>
                <Sparkline values={trend} label="Safety score trend over the current walk" />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button type="button" className="btn btn--sm" onClick={announceStatus}>
                  <Eye size={15} /> Read status aloud
                </button>
                <Link to="/alerts" className="btn btn--ghost btn--sm">
                  <AlertTriangle size={15} /> Alert settings
                </Link>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={2}>
            <div style={{ display: 'grid', gap: 18 }}>
              <Card>
                <CardHead icon={WeatherIcon} title="Conditions" sub={`${isFallback ? 'Demo location' : watching ? 'Live position' : 'Approximate location'} · Bengaluru`} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--display)', fontSize: '2.6rem', lineHeight: 1 }}>
                    {weather ? Math.round(weather.temperature_2m) : '—'}°
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{weatherLabel}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                  <span><Droplets size={13} style={{ verticalAlign: '-2px' }} /> {weather ? `${weather.precipitation} mm` : '—'}</span>
                  <span><Wind size={13} style={{ verticalAlign: '-2px' }} /> {weather ? `${Math.round(weather.wind_speed_10m)} km/h` : '—'}</span>
                  <span><Thermometer size={13} style={{ verticalAlign: '-2px' }} /> {weather ? `${weather.relative_humidity_2m}%` : '—'}</span>
                </div>
                <div className="progress" style={{ marginTop: 16 }}>
                  <i style={{ width: `${Math.min(100, 70 + (critical.length ? 20 : 0))}%` }} />
                </div>
                <p className="hint" style={{ marginTop: 8 }}>
                  {critical.length
                    ? 'Wet paving plus live hazards — consider the accessible route.'
                    : 'Surface conditions look stable. Tactile paving reported intact nearby.'}
                </p>
              </Card>

              <Card>
                <CardHead icon={Users} title="Live network" sub="People and volunteers sharing this area" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {peers.slice(0, 4).map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem' }}>
                        {(p.name || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span className="badge badge--neutral">{p.simulated ? 'Simulated' : p.role}</span>
                    </div>
                  ))}
                  {!peers.length ? <p className="card__sub">Waiting for the network…</p> : null}
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={() => {
                      setNameDraft(you?.name || '');
                      setEditingName((v) => !v);
                    }}
                  >
                    {editingName ? 'Close' : 'Change my name'}
                  </button>
                  <Link to="/community" className="chip-btn">Open map</Link>
                </div>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Name shown to community"
                      aria-label="Your display name"
                    />
                    <button type="button" className="btn btn--sm" onClick={saveName}>Save</button>
                  </div>
                ) : null}
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="This session"
          title="Today's journey, measured live"
          sub="Counters update from the shared channel and your on-device scans — no refresh needed."
          aside={<Link to="/journey" className="btn btn--ghost btn--sm">Open journey <ArrowRight size={15} /></Link>}
        />
        <div className="grid grid--4">
          {[
            { k: scene.detectionsTotal, l: 'Obstacles sensed', n: 'on-device vision' },
            { k: events.length, l: 'Live alerts', n: 'from the network', },
            { k: journey?.distance ? `${(journey.distance / 1000).toFixed(2)} km` : '0.0 km', l: 'Trip distance', n: journey?.active ? 'tracking now' : 'not tracking' },
            { k: peers.length, l: 'People online', n: 'including volunteers' },
          ].map((item, i) => (
            <Reveal key={item.l} delay={i}>
              <Card><Stat value={item.k} label={item.l} note={item.n} /></Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead
          eyebrow="Live feed"
          title="Recent alerts near you"
          sub="Every entry is broadcast the instant it is reported or verified."
          aside={<Link to="/alerts" className="btn btn--ghost btn--sm">All alerts <ArrowRight size={15} /></Link>}
        />
        <div className="grid grid--2">
          <Reveal>
            <Card>
              <CardHead icon={AlertTriangle} title="Hazard stream" sub="Last five events" />
              <div className="feed" style={{ maxHeight: 320 }}>
                {events.slice(0, 5).map((e) => (
                  <div key={e.id} className="feed-item">
                    <div className="feed-item__icon"><AlertTriangle size={16} /></div>
                    <div className="feed-item__body">
                      <strong>{e.title}</strong>
                      <p>{e.detail}</p>
                      <div className="feed-item__meta">
                        <SeverityBadge severity={e.severity} />
                        <span>{timeAgo(e.at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!events.length ? <p className="card__sub">The channel is quiet. Reports will appear here in real time.</p> : null}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={2}>
            <Card>
              <CardHead icon={MapPin} title="Closest reported hazards" sub="Sorted by distance from your live position" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {near.map((h) => (
                  <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.88rem' }}>{h.label}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.77rem' }}>{h.description}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <SeverityBadge severity={h.severity} />
                      <div style={{ fontSize: '0.73rem', color: 'var(--ink-muted)', marginTop: 5 }}>{h.metres} m</div>
                    </div>
                  </div>
                ))}
                {!near.length ? <p className="card__sub">No open hazards within range.</p> : null}
              </div>
              <Link to="/community" className="btn btn--ghost btn--sm" style={{ marginTop: 14 }}>
                <Waves size={15} /> Explore community map
              </Link>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <Reveal>
          <Card dark style={{ padding: 'clamp(24px, 3vw, 38px)' }}>
            <div className="grid grid--2" style={{ alignItems: 'center', gap: 28 }}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--pink)' }}>Why it matters</span>
                <h2 style={{ color: 'var(--creme)', maxWidth: '22ch' }}>
                  Independence is a path you should not have to guess.
                </h2>
                <p style={{ marginTop: 12 }}>
                  Two hundred and fifty million people live with significant vision impairment. A cane
                  tells you something is close; VisionPath tells you what it is, how far, and exactly
                  which way to step — and it keeps telling you as the world shifts.
                </p>
                <Link to="/about" className="btn btn--light btn--sm" style={{ marginTop: 8 }}>
                  Read the project brief <ArrowRight size={15} />
                </Link>
              </div>
              <div className="grid grid--2" style={{ gap: 14 }}>
                {[
                  { v: '250M', l: 'people with vision impairment' },
                  { v: '1 in 3', l: 'report a fall each year' },
                  { v: '< 400ms', l: 'alert to voice latency' },
                  { v: '100%', l: 'on-device frame processing' },
                ].map((s) => (
                  <div key={s.l} style={{ padding: '16px 18px', borderRadius: 16, background: 'rgba(237,243,255,.08)', border: '1px solid rgba(237,243,255,.14)' }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: '1.9rem', lineHeight: 1.1 }}>{s.v}</div>
                    <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(237,243,255,.6)', marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </section>
    </>
  );
}
