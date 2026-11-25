import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity, ArrowRight, Clock, Eye, Link2, MapPin, Search, ShieldCheck, Siren, Users,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, SectionHead, SeverityBadge, Sparkline, Stat } from '../components/UI';
import { useRealtime } from '../lib/realtime';
import { formatDistance, formatDuration, timeAgo } from '../lib/geo';

export default function Guardian() {
  const { code: routeCode } = useParams();
  const { journey, send, live, sos, events } = useRealtime();
  const [input, setInput] = useState(routeCode || localStorage.getItem('visionpath:last-code') || '');
  const [requested, setRequested] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!routeCode) return;
    setInput(routeCode);
    setMissing(false);
  }, [routeCode]);

  useEffect(() => {
    if (!live) return;
    const code = (routeCode || requested || '').toUpperCase();
    if (!code) return;
    send({ type: 'journey:watch', code });
    setMissing(false);
  }, [live, routeCode, requested, send]);

  useEffect(() => {
    if (!journey) return;
    if (routeCode || requested) setMissing(false);
  }, [journey, routeCode, requested]);

  const watch = () => {
    const clean = input.trim().toUpperCase();
    if (!clean) return;
    setRequested(clean);
    send({ type: 'journey:watch', code: clean });
    localStorage.setItem('visionpath:last-code', clean);
    setTimeout(() => setMissing(!journey), 1600);
  };

  const pathPoints = (journey?.path || []).map((p) => ({ lat: p.lat, lng: p.lng }));
  const last = journey?.path?.[journey.path.length - 1];
  const durationMin = journey ? ((journey.endedAt || Date.now()) - journey.startedAt) / 60000 : 0;
  const tripEvents = events.filter((e) => ['hazard', 'update', 'sos', 'detect'].includes(e.kind)).slice(0, 6);

  return (
    <>
      <SectionHead
        eyebrow="Guardian view"
        title="Watch the walk, quietly, from anywhere"
        sub="Enter the trip code a traveller shared with you. Their position, safety trend and alerts arrive live — no app install required."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--neutral'}`}><span className="dot-live" /> {live ? 'Live link' : 'Reconnecting'}</span>}
      />

      {sos ? (
        <div className="alert-banner alert-banner--live" role="alert">
          <Siren size={20} />
          <p style={{ flex: 1 }}>
            <strong>SOS active · {sos.by}</strong> — {sos.message} · {sos.acks.length} responder(s) acknowledged.
          </p>
          <Link to="/sos" className="btn btn--light btn--sm">Live map</Link>
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {journey ? (
            <>
              <div className="grid grid--3">
                <Card><Stat value={formatDistance(journey.distance)} label="Walked" note={journey.active ? 'ongoing' : 'completed'} /></Card>
                <Card><Stat value={formatDuration(durationMin)} label="Elapsed" /></Card>
                <Card><Stat value={journey.safety} label="Safety score" note={journey.safety > 88 ? 'comfortable' : 'caution'} /></Card>
              </div>

              <Card>
                <CardHead
                  icon={MapPin}
                  title={journey.destination}
                  sub={`${journey.by} · ${journey.active ? 'walking now' : `ended ${timeAgo(journey.endedAt || Date.now())}`}`}
                  aside={<SeverityBadge severity={journey.active ? 'low' : 'medium'} />}
                />
                <MapView
                  center={last ? [last.lat, last.lng] : [12.9719, 77.5946]}
                  zoom={16}
                  height={360}
                  you={last ? { lat: last.lat, lng: last.lng } : null}
                  routes={pathPoints.length > 1 ? [{ latlngs: pathPoints, name: 'Live path', color: '#EDF3FF', weight: 5 }] : []}
                />
                <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                  <span><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {last ? `${last.lat.toFixed(5)}, ${last.lng.toFixed(5)}` : 'waiting for fix'}</span>
                  <span><Clock size={13} style={{ verticalAlign: '-2px' }} /> updated {last ? timeAgo(last.t) : '—'}</span>
                  <span><Activity size={13} style={{ verticalAlign: '-2px' }} /> {journey.path.length} fixes</span>
                </div>
              </Card>

              <Card>
                <CardHead icon={Activity} title="Safety this walk" sub="From the traveller's device" />
                <Sparkline values={[journey.safety, journey.safety - 1, journey.safety + 1, journey.safety]} label="Guardian safety trend" />
              </Card>

              <Card>
                <CardHead icon={Eye} title="Trip log" sub="Alerts shared with guardians" />
                <div className="timeline">
                  <div className="timeline__item is-success">
                    <div className="timeline__time">{new Date(journey.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <strong>Trip started</strong>
                    <p>{journey.destination}</p>
                  </div>
                  {(journey.alerts || []).map((a, i) => (
                    <div key={`${a.id}-${i}`} className={`timeline__item ${a.severity === 'critical' ? 'is-critical' : ''}`}>
                      <div className="timeline__time">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <strong>{a.title}</strong>
                      <p>{a.detail}</p>
                    </div>
                  ))}
                  {journey.alerts?.length ? null : <p className="card__sub">No alerts on this walk so far.</p>}
                </div>
              </Card>
            </>
          ) : (
            <Card style={{ maxWidth: 560 }}>
              <CardHead icon={Link2} title="Open a shared trip" sub="The code is six to eight characters" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  placeholder="e.g. VP-1A2B3C"
                  aria-label="Trip share code"
                  style={{ flex: 1, minWidth: 180, letterSpacing: '0.12em', fontFamily: 'var(--display)', fontSize: '1.1rem' }}
                />
                <button type="button" className="btn" onClick={watch}>
                  <Search size={15} /> Watch
                </button>
              </div>
              {missing ? (
                <p className="hint" style={{ color: 'var(--critical)' }}>
                  No live trip found for that code. Ask the traveller for a fresh link.
                </p>
              ) : (
                <p className="hint" style={{ marginTop: 10 }}>
                  Watching is read-only. Gestures and camera never leave the traveller's device.
                </p>
              )}
              <div style={{ marginTop: 16 }}>
                <Link to="/journey" className="btn btn--ghost btn--sm">
                  Start my own monitored walk <ArrowRight size={15} />
                </Link>
              </div>
            </Card>
          )}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={ShieldCheck} title="What this view does" sub="Trust by design" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.84rem' }}>
              <span>• Live location and walked path</span>
              <span>• Safety score and its trend</span>
              <span>• Alerts the traveller met</span>
              <span>• One-tap route to SOS</span>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Share links are ephemeral: they stop updating when the traveller ends the journey. No account is created.
            </p>
          </Card>

          <Card>
            <CardHead icon={Users} title="Recent network activity" sub="Across all connected users" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tripEvents.map((e) => (
                <div key={e.id} style={{ fontSize: '0.8rem', paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                  <strong style={{ display: 'block' }}>{e.title}</strong>
                  <span style={{ color: 'var(--ink-muted)' }}>{e.detail} · {timeAgo(e.at)}</span>
                </div>
              ))}
              {!tripEvents.length ? <p className="card__sub">No events yet.</p> : null}
            </div>
          </Card>

          <Card>
            <CardHead icon={Siren} title="If something is wrong" sub="Emergency path for guardians" />
            <p style={{ fontSize: '0.84rem' }}>
              Open the SOS page to see the traveller's live beacon, acknowledge it so they know someone is coming,
              and call their emergency contacts directly.
            </p>
            <Link to="/sos" className="btn btn--danger btn--sm">Open SOS response</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
