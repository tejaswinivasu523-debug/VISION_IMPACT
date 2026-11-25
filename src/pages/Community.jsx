import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp, Check, CheckCheck, Filter, MapPin, MessageSquarePlus, Radio, ThumbsUp, Users,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, Empty, SectionHead, SeverityBadge } from '../components/UI';
import { useLivePosition, useRealtime } from '../lib/realtime';
import { timeAgo } from '../lib/geo';

const TYPES = [
  { id: 'all', label: 'All types' },
  { id: 'pole', label: 'Poles & bollards' },
  { id: 'pothole', label: 'Potholes' },
  { id: 'stairs', label: 'Steps & stairs' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'construction', label: 'Construction' },
  { id: 'crossing', label: 'Crossing faults' },
  { id: 'surface', label: 'Uneven surface' },
];

export default function Community() {
  const { hazards, hazards: all, peers, live, vote } = useRealtime();
  const { current } = useLivePosition(true);
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('open');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => all.filter((h) => {
    if (status === 'open' && h.status === 'resolved') return false;
    if (status === 'resolved' && h.status !== 'resolved') return false;
    if (severity !== 'all' && h.severity !== severity) return false;
    if (type !== 'all' && h.type !== type) return false;
    return true;
  }), [all, severity, type, status]);

  /* lightweight client-side clustering, no extra dependency */
  const clusters = useMemo(() => {
    const buckets = new Map();
    filtered.forEach((h) => {
      const key = `${h.lat.toFixed(3)}:${h.lng.toFixed(3)}`;
      const bucket = buckets.get(key) || { lat: 0, lng: 0, items: [] };
      bucket.lat += h.lat;
      bucket.lng += h.lng;
      bucket.items.push(h);
      buckets.set(key, bucket);
    });
    return [...buckets.values()].map((b) => ({
      lat: b.lat / b.items.length,
      lng: b.lng / b.items.length,
      items: b.items.sort((x, y) => y.createdAt - x.createdAt),
    }));
  }, [filtered]);

  const selectedList = selectedId ? filtered.filter((h) => h.id === selectedId) : [];
  const selected = selectedList[0] || filtered[0] || null;

  const markers = clusters.map((c) => {
    const worst = c.items.slice().sort((a, b) => ['low', 'medium', 'high', 'critical'].indexOf(b.severity) - ['low', 'medium', 'high', 'critical'].indexOf(a.severity))[0];
    return {
      lat: c.lat,
      lng: c.lng,
      tone: worst.severity,
      badge: c.items.length > 1 ? String(c.items.length) : '!',
      label: c.items.length > 1 ? `${c.items.length} hazards in this spot` : worst.label,
      meta: c.items.length > 1
        ? c.items.map((i) => i.label).slice(0, 3).join(', ')
        : `${worst.description} · ${worst.verifies} verifications`,
      onClick: () => setSelectedId(worst.id),
    };
  });

  const totals = {
    open: hazards.filter((h) => h.status !== 'resolved').length,
    critical: hazards.filter((h) => h.severity === 'critical' && h.status !== 'resolved').length,
    verified: hazards.reduce((sum, h) => sum + h.verifies, 0),
    reporters: new Set(hazards.map((h) => h.reporter)).size,
  };

  return (
    <>
      <SectionHead
        eyebrow="Community map"
        title="Hazards the whole neighbourhood can see"
        sub="Every marker is a real broadcast from a nearby VisionPath user. Verifying one instantly updates everyone else's route."
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/report" className="btn btn--sm"><MessageSquarePlus size={15} /> Report a hazard</Link>
            <span className={`badge ${live ? 'badge--live' : 'badge--neutral'}`}><Radio size={11} /> {live ? 'Streaming' : 'Reconnecting'}</span>
          </div>
        }
      />

      <div className="grid grid--4 section" aria-label="Community statistics">
        {[
          { k: totals.open, l: 'Open hazards' },
          { k: totals.critical, l: 'Critical now' },
          { k: totals.verified, l: 'Verifications' },
          { k: totals.reporters, l: 'Reporters' },
        ].map((s) => (
          <Card key={s.l}>
            <span className="stat__value">{s.k}</span>
            <span className="stat__label">{s.l}</span>
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ padding: 10 }}>
            <MapView
              center={[current.lat, current.lng]}
              zoom={15}
              tall
              height={480}
              markers={markers}
              you={{ lat: current.lat, lng: current.lng }}
            />
          </Card>

          <Card>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <Filter size={15} aria-hidden="true" style={{ opacity: 0.6 }} />
              {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
                <button key={s} type="button" className={`chip-btn ${severity === s ? 'is-on' : ''}`} onClick={() => setSeverity(s)} aria-pressed={severity === s}>
                  {s === 'all' ? 'All severity' : s}
                </button>
              ))}
              <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px' }} aria-hidden="true" />
              {['open', 'resolved', 'all'].map((s) => (
                <button key={s} type="button" className={`chip-btn ${status === s ? 'is-on' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
                  {s}
                </button>
              ))}
              <select
                aria-label="Filter by hazard type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ maxWidth: 200, marginLeft: 'auto' }}
              >
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="feed" style={{ maxHeight: 400 }}>
              {filtered.slice(0, 12).map((h) => (
                <div key={h.id} className="feed-item" style={selected?.id === h.id ? { borderColor: 'var(--accent)', background: 'rgba(157,140,255,.08)' } : undefined}>
                  <div className="feed-item__icon"><MapPin size={16} /></div>
                  <div className="feed-item__body">
                    <strong>{h.label}</strong>
                    <p>{h.description}</p>
                    <div className="feed-item__meta">
                      <SeverityBadge severity={h.severity} />
                      <span>{h.reporter}</span>
                      <span>· {timeAgo(h.createdAt)}</span>
                      {h.status === 'resolved' ? <span className="badge badge--low"><Check size={11} /> cleared</span> : null}
                      <button type="button" className="chip-btn" style={{ marginLeft: 'auto', minHeight: 30 }} onClick={() => setSelectedId(h.id)}>
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!filtered.length ? <Empty text="No hazards match these filters. Try widening them." /> : null}
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={MapPin} title={selected ? selected.label : 'Select a hazard'} sub={selected ? `${selected.verifies} people verified · ${selected.upvotes} upvotes` : 'Tap a marker or a row to inspect'} />
            {selected ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <SeverityBadge severity={selected.severity} />
                  {selected.status === 'resolved' ? <span className="badge badge--low"><Check size={11} /> Cleared</span> : <span className="badge badge--live"><span className="dot-live" /> Active</span>}
                  <span className="badge badge--neutral">{selected.source === 'peer' ? 'Nearby walker' : 'Community'}</span>
                </div>
                {selected.photo ? (
                  <img src={selected.photo} alt={`Photo submitted with ${selected.label.toLowerCase()} report`} style={{ borderRadius: 14, marginBottom: 12, maxHeight: 190, objectFit: 'cover', width: '100%' }} />
                ) : null}
                <p style={{ fontSize: '0.88rem' }}>{selected.description}</p>
                <p className="card__sub">
                  Reported by {selected.reporter} · {timeAgo(selected.createdAt)} · {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => vote(selected.id, 'verify')}>
                    <CheckCheck size={14} /> Verify ({selected.verifies})
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => vote(selected.id, 'upvote')}>
                    <ThumbsUp size={14} /> Upvote ({selected.upvotes})
                  </button>
                  {selected.status !== 'resolved' ? (
                    <button type="button" className="btn btn--sm" onClick={() => vote(selected.id, 'resolve')}>
                      <Check size={14} /> Mark cleared
                    </button>
                  ) : null}
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  Votes and new reports are broadcast to every connected user immediately.
                </p>
              </>
            ) : <Empty text="Nothing selected yet." icon={MapPin} />}
          </Card>

          <Card>
            <CardHead icon={Users} title="Live network" sub={`${peers.filter((p) => !p.simulated).length} devices · ${peers.filter((p) => p.simulated).length} simulated walkers`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {peers.map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.82rem' }}>
                  <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.68rem' }}>{(p.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className="badge badge--neutral">{p.simulated ? 'Sim' : p.role}</span>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Simulated walkers keep the shared model moving so you can see collaboration working on one device.
            </p>
          </Card>

          <Card>
            <CardHead icon={ArrowUp} title="Top hazard types" sub="What the community reports most" />
            {Object.entries(
              hazards.reduce((acc, h) => {
                acc[h.label] = (acc[h.label] || 0) + 1;
                return acc;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([label, count]) => {
                const pct = Math.round((count / Math.max(1, hazards.length)) * 100);
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                      <span>{label}</span>
                      <span style={{ color: 'var(--ink-muted)' }}>{count}</span>
                    </div>
                    <div className="progress"><i style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
          </Card>
        </div>
      </div>
    </>
  );
}
