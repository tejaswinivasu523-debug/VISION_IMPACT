import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Check, Clock, Copy, ExternalLink, MapPin, Navigation,
  Route, Share2, ShieldCheck, Square, Users,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, SectionHead, SeverityBadge, Sparkline, Stat, ToastStack } from '../components/UI';
import { useLivePosition, useRealtime } from '../lib/realtime';
import { formatDistance, formatDuration, timeAgo } from '../lib/geo';
import { speak } from '../lib/voice';

const DESTINATIONS = [
  'Community library, 2nd cross',
  'Metro station — west gate',
  'Cubbon Park east gate',
  'Accessible pharmacy',
];

export default function Journey() {
  const { journey, send, events, hazards, you, live, pushEvent } = useRealtime();
  const { current, isFallback } = useLivePosition(true);
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [alerts, setAlerts] = useState([]);
  const [series, setSeries] = useState([96]);
  const [toasts, setToasts] = useState([]);
  const seen = useRef(new Set());
  const mine = journey && you && journey.byId === you.id;
  const active = Boolean(journey?.active);

  const nearby = useMemo(() => hazards.filter((h) => h.status !== 'resolved' && Math.hypot(h.lat - current.lat, h.lng - current.lng) < 0.01), [hazards, current.lat, current.lng]);
  const safety = Math.max(40, Math.min(99, 99 - nearby.filter((h) => h.severity === 'critical').length * 7 - nearby.filter((h) => h.severity === 'high').length * 3));

  const toast = (text, tone = '') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  useEffect(() => {
    if (!mine) return undefined;
    const timer = setInterval(() => {
      send({
        type: 'journey:update',
        code: journey.code,
        lat: current.lat,
        lng: current.lng,
        safety,
        alerts,
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [mine, journey?.code, current.lat, current.lng, safety, alerts, send]);

  useEffect(() => {
    setSeries((prev) => [...prev, safety].slice(-16));
  }, [safety]);

  useEffect(() => {
    if (!mine || !active) return;
    const latest = events[0];
    if (!latest || seen.current.has(latest.id)) return;
    seen.current.add(latest.id);
    if (!['hazard', 'update', 'sos', 'detect'].includes(latest.kind)) return;
    setAlerts((prev) => [
      ...prev.slice(-20),
      { id: latest.id, at: latest.at, title: latest.title, detail: latest.detail, severity: latest.severity },
    ]);
  }, [events, mine, active]);

  const startJourney = () => {
    send({ type: 'journey:start', destination });
    setAlerts([]);
    setSeries([96]);
    seen.current.clear();
    speak(`Journey started to ${destination}. Live trip sharing is ready.`, { force: true, priority: 'high' });
    pushEvent({ kind: 'system', severity: 'low', title: 'Journey started', detail: `Tracking your walk to ${destination}.` });
    toast('Journey started. Share the code with a guardian.', 'success');
  };

  const endJourney = () => {
    send({ type: 'journey:end', code: journey.code });
    speak('Journey ended. Your guardian can still see the summary.', { force: true, priority: 'high' });
    toast('Journey ended.', 'success');
  };

  const shareLink = journey?.code && typeof window !== 'undefined'
    ? `${window.location.origin}/guardian/${journey.code}`
    : '';

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast('Guardian link copied — it stays live while you walk.', 'success');
      localStorage.setItem('visionpath:last-code', journey.code);
    } catch {
      toast('Copy failed. The code is shown above.', 'critical');
    }
  };

  const durationMin = journey ? (Date.now() - journey.startedAt) / 60000 : 0;
  const pathPoints = (journey?.path || []).map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <>
      <SectionHead
        eyebrow="Journey monitoring"
        title="A walk someone else can watch over"
        sub="Share a live trip with a guardian: distance, safety trend and every alert update on their screen as it happens."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--neutral'}`}><span className="dot-live" /> {live ? 'Trip sync live' : 'Reconnecting'}</span>}
      />

      {!journey ? (
        <Card style={{ maxWidth: 640 }}>
          <CardHead icon={Navigation} title="Start a monitored journey" sub="Tracking begins from your live position" />
          <div className="field">
            <label htmlFor="journey-destination">Destination</label>
            <select id="journey-destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
              {DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <p className="hint" style={{ marginBottom: 16 }}>
            Your position updates every four seconds. Nothing is recorded after you end the journey.
          </p>
          <button type="button" className="btn" onClick={startJourney}>
            <Activity size={16} /> Start journey
          </button>
        </Card>
      ) : (
        <>
          <div className="grid grid--4 section">
            <Card><Stat value={formatDistance(journey.distance)} label="Distance walked" note={journey.active ? 'live from GPS' : 'final'} /></Card>
            <Card><Stat value={formatDuration(durationMin)} label="Elapsed" note={journey.active ? 'ticking now' : 'completed'} /></Card>
            <Card><Stat value={journey.alerts.length} label="Alerts met" note="on this trip" /></Card>
            <Card><Stat value={journey.safety} label="Safety score" note={journey.safety > 88 ? 'comfortable' : 'caution'} /></Card>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <Card>
                <CardHead
                  icon={Route}
                  title={journey.destination}
                  sub={`${journey.by} · started ${timeAgo(journey.startedAt)} · ${journey.active ? 'walking now' : 'complete'}`}
                  aside={<SeverityBadge severity={journey.safety > 88 ? 'low' : journey.safety > 72 ? 'medium' : 'high'} />}
                />
                <MapView
                  center={[current.lat, current.lng]}
                  zoom={16}
                  height={340}
                  you={{ lat: current.lat, lng: current.lng }}
                  routes={pathPoints.length > 1 ? [{ latlngs: pathPoints, name: 'Walked path', color: '#EDF3FF', weight: 5 }] : []}
                  markers={nearby.map((h) => ({ lat: h.lat, lng: h.lng, tone: h.severity, badge: '!', label: h.label, meta: h.description }))}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                  <span><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {isFallback ? 'Demo position' : 'Live GPS'}</span>
                  <span><Users size={13} style={{ verticalAlign: '-2px' }} /> {journey.path.length} position fixes</span>
                  <span><Clock size={13} style={{ verticalAlign: '-2px' }} /> updates every 4 s</span>
                </div>
              </Card>

              <Card>
                <CardHead icon={Activity} title="Path safety" sub="How the walk has felt, alert by alert" />
                <Sparkline values={series.length > 1 ? series : [safety, safety]} height={110} label="Safety score during this journey" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 6 }}>
                  <span>Start</span>
                  <span>Now · {safety}/100</span>
                </div>
              </Card>

              <Card>
                <CardHead icon={Activity} title="Trip timeline" sub="Alerts encountered while walking" />
                <div className="timeline">
                  <div className="timeline__item is-success">
                    <div className="timeline__time">{new Date(journey.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <strong>Journey started</strong>
                    <p>Destination: {journey.destination}</p>
                  </div>
                  {alerts.map((a) => (
                    <div key={a.id} className={`timeline__item ${a.severity === 'critical' ? 'is-critical' : a.severity === 'low' ? 'is-success' : ''}`}>
                      <div className="timeline__time">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <strong>{a.title}</strong>
                      <p>{a.detail}</p>
                    </div>
                  ))}
                  {journey.active ? (
                    <div className="timeline__item">
                      <div className="timeline__time">Now</div>
                      <strong>Walking · {formatDistance(journey.distance)} covered</strong>
                      <p>{nearby.length} open hazards within 1 km.</p>
                    </div>
                  ) : (
                    <div className="timeline__item is-success">
                      <div className="timeline__time">End</div>
                      <strong>Journey complete</strong>
                      <p>{formatDistance(journey.distance)} in {formatDuration(durationMin)}.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <Card>
                <CardHead icon={Share2} title="Share live trip with a guardian" sub="One code, no account needed" />
                <div style={{ padding: '16px 18px', borderRadius: 16, background: 'rgba(157,140,255,.32)', border: '1px dashed var(--line-strong)', textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: '0.64rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Trip code</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: '2rem', letterSpacing: '0.14em' }}>{journey.code}</div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" className="btn btn--sm" onClick={copyShare}>
                    <Copy size={15} /> Copy guardian link
                  </button>
                  <Link to={`/guardian/${journey.code}`} className="btn btn--ghost btn--sm">
                    <ExternalLink size={15} /> Open guardian view
                  </Link>
                </div>
                <p className="hint" style={{ marginTop: 12 }}>
                  The link stays live while the trip runs and shows position fixes, safety trend and every alert.
                </p>
                {journey.active ? (
                  <button type="button" className="btn btn--danger btn--sm btn--block" style={{ marginTop: 10 }} onClick={endJourney}>
                    <Square size={14} /> End journey
                  </button>
                ) : (
                  <button type="button" className="btn btn--sm btn--block" style={{ marginTop: 10 }} onClick={startJourney}>
                    <Check size={14} /> Start a new journey
                  </button>
                )}
              </Card>

              <Card>
                <CardHead icon={ShieldCheck} title="Guardian visibility" sub="What the other person sees" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '0.83rem' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Check size={14} color="var(--success)" /> Live position map</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Check size={14} color="var(--success)" /> Safety score &amp; trend</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Check size={14} color="var(--success)" /> Alert timeline</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Check size={14} color="var(--success)" /> Distance and elapsed time</span>
                </div>
                <p className="hint" style={{ marginTop: 12 }}>
                  Only what you see here is shared. Camera frames never leave your device.
                </p>
              </Card>

              <Card>
                <CardHead icon={Navigation} title="Walking with guidance" sub="Keep the loop closed" />
                <p style={{ fontSize: '0.84rem' }}>
                  Keep Live Scan open while you walk: obstacles are announced continuously and re-routing happens
                  as the scene changes.
                </p>
                <Link to="/scan" className="btn btn--ghost btn--sm">
                  Open live scan <ArrowRight size={15} />
                </Link>
              </Card>
            </div>
          </div>
        </>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  );
}
