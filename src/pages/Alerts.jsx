import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bell, BellOff, History, Mic, MicOff, Radio, ShieldAlert, Trash2, Volume2,
} from 'lucide-react';
import { Card, CardHead, SectionHead, SeverityBadge, Slider } from '../components/UI';
import { useRealtime } from '../lib/realtime';
import { useLocalState, useSettings } from '../lib/settings';
import { clockTime, timeAgo } from '../lib/geo';
import { speak } from '../lib/voice';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

export default function Alerts() {
  const { events, hazards, live, clearEvents } = useRealtime();
  const { settings, update } = useSettings();
  const [history, setHistory] = useLocalState('alert-history', []);
  const [filter, setFilter] = useState('all');
  const [minimised, setMinimised] = useState(false);
  const seen = useRef(new Set());
  const lastAnnounced = useRef(null);

  /* Persist every live event once so the alert history survives reloads. */
  useEffect(() => {
    const fresh = events.filter((e) => !seen.current.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => seen.current.add(e.id));
    setHistory((prev) => [...fresh.map((e) => ({
      id: e.id, at: e.at, title: e.title, detail: e.detail, severity: e.severity, kind: e.kind,
    })), ...prev].slice(0, 60));
  }, [events, setHistory]);

  /* Announce high-severity events as they arrive. */
  useEffect(() => {
    const latest = events[0];
    if (!latest || latest.id === lastAnnounced.current) return;
    lastAnnounced.current = latest.id;
    if (!settings.voice || !settings.autoSpeakAlerts) return;
    if (!['hazard', 'update'].includes(latest.kind)) return;
    if (!['high', 'critical'].includes(latest.severity)) return;
    speak(`${latest.severity === 'critical' ? 'Critical alert. ' : ''}${latest.title}. ${latest.detail}`, {
      priority: latest.severity === 'critical' ? 'critical' : 'high',
    });
  }, [events, settings.voice, settings.autoSpeakAlerts]);

  const filtered = useMemo(
    () => history.filter((h) => filter === 'all' || h.severity === filter),
    [history, filter],
  );

  const openHazards = hazards.filter((h) => h.status !== 'resolved');
  const counts = {
    critical: openHazards.filter((h) => h.severity === 'critical').length,
    high: openHazards.filter((h) => h.severity === 'high').length,
    medium: openHazards.filter((h) => h.severity === 'medium').length,
    low: openHazards.filter((h) => h.severity === 'low').length,
  };

  const announce = (text) => speak(text, { force: true, priority: 'high' });

  return (
    <>
      <SectionHead
        eyebrow="Obstacle alerts"
        title="Every hazard, the moment it is known"
        sub="Live community reports and your own detections arrive here instantly, with voice output shaped to your settings."
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ voice: !settings.voice })}>
              {settings.voice ? <Mic size={15} /> : <MicOff size={15} />} Voice {settings.voice ? 'on' : 'off'}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMinimised((v) => !v)}>
              {minimised ? <Bell size={15} /> : <BellOff size={15} />} {minimised ? 'Resume feed' : 'Pause feed'}
            </button>
          </div>
        }
      />

      <div className="grid grid--4 section" aria-label="Alert summary">
        {[
          { k: 'critical', label: 'Critical', note: 'stop and re-route' },
          { k: 'high', label: 'High', note: 'speak immediately' },
          { k: 'medium', label: 'Medium', note: 'plan around' },
          { k: 'low', label: 'Low', note: 'log only' },
        ].map((item) => (
          <Card key={item.k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat">
                <span className="stat__value">{counts[item.k]}</span>
                <span className="stat__label">{item.label}</span>
                <span className="stat__note">{item.note}</span>
              </div>
              <SeverityBadge severity={item.k} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <Card>
          <CardHead
            icon={Radio}
            title="Live alert feed"
            sub={live ? 'Streaming from the shared hazard channel' : 'Reconnecting — buffered events will appear shortly'}
            aside={<span className={`badge ${live ? 'badge--live' : 'badge--critical'}`}><span className="dot-live" /> {live ? 'Live' : 'Offline'}</span>}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip-btn ${filter === f.id ? 'is-on' : ''}`}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="feed" style={{ maxHeight: 520 }}>
            {filtered.map((e) => (
              <div key={e.id} className="feed-item">
                <div className="feed-item__icon" style={e.severity === 'critical' ? { background: 'rgba(240,112,143,.14)', color: 'var(--critical)' } : undefined}>
                  <AlertTriangle size={16} />
                </div>
                <div className="feed-item__body">
                  <strong>{e.title}</strong>
                  <p>{e.detail}</p>
                  <div className="feed-item__meta">
                    <SeverityBadge severity={e.severity} />
                    <span>{clockTime(e.at)}</span>
                    <span>· {timeAgo(e.at)}</span>
                    <button
                      type="button"
                      className="chip-btn"
                      style={{ marginLeft: 'auto', minHeight: 28, padding: '3px 9px' }}
                      onClick={() => announce(`${e.title}. ${e.detail}`)}
                    >
                      <Volume2 size={12} /> Replay
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!filtered.length ? (
              <p className="card__sub" style={{ padding: '18px 4px' }}>
                No alerts match this filter yet. New reports appear automatically.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => announce('Pole ahead, two metres. Move slightly left.')}
            >
              <Volume2 size={14} /> Test announcement
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setHistory([]);
                seen.current.clear();
                clearEvents();
              }}
            >
              <Trash2 size={14} /> Clear history
            </button>
            <Link to="/scan" className="btn btn--sm">Open live scan</Link>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Volume2} title="Voice output" sub="Applies immediately to all announcements" />
            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div>
                <h4>Spoken alerts</h4>
                <p>Read hazard alerts out loud as they arrive.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.voice}
                aria-label="Spoken alerts"
                className="switch"
                onClick={() => update({ voice: !settings.voice })}
              />
            </div>
            <div className="setting-row">
              <div>
                <h4>Auto-announce high severity</h4>
                <p>Critical and high alerts interrupt whatever is being spoken.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoSpeakAlerts}
                aria-label="Auto announce high severity alerts"
                className="switch"
                onClick={() => update({ autoSpeakAlerts: !settings.autoSpeakAlerts })}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <label htmlFor="alert-volume">Volume</label>
              <Slider
                label="Alert volume"
                value={settings.volume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => update({ volume: v })}
                suffix=""
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label htmlFor="alert-rate">Speech speed</label>
              <Slider
                label="Speech rate"
                value={settings.rate}
                min={0.6}
                max={1.8}
                step={0.05}
                onChange={(v) => update({ rate: v })}
                suffix="×"
              />
            </div>
            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label htmlFor="alert-lang">Language</label>
              <select id="alert-lang" value={settings.lang} onChange={(e) => update({ lang: e.target.value })}>
                <option value="en-IN">English (India)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                <option value="ta-IN">தமிழ் (Tamil)</option>
              </select>
            </div>
          </Card>

          <Card>
            <CardHead icon={ShieldAlert} title="Alert sensitivity" sub="How eagerly the scanner speaks up" />
            <div className="seg" role="group" aria-label="Alert sensitivity">
              {['gentle', 'balanced', 'high'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={settings.sensitivity === level ? 'active' : ''}
                  onClick={() => update({ sensitivity: level })}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              {settings.sensitivity === 'gentle'
                ? 'Only clear, close objects are announced — best in quiet, familiar spaces.'
                : settings.sensitivity === 'high'
                  ? 'Maximum awareness: smallest changes in the corridor trigger guidance.'
                  : 'Recommended balance of early warning and comfort.'}
            </p>
          </Card>

          <Card>
            <CardHead icon={History} title="Recent reports on the map" sub={`${openHazards.length} still open`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openHazards.slice(0, 5).map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem' }}>
                  <span style={{ flex: 1 }}>{h.label}</span>
                  <SeverityBadge severity={h.severity} />
                </div>
              ))}
              {!openHazards.length ? <p className="card__sub">No open hazards right now.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
