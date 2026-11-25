import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, Clock, LifeBuoy, MapPin, Phone, Plus, Send, ShieldCheck, Siren, Trash2, Users,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, SectionHead, SeverityBadge, ToastStack } from '../components/UI';
import { useLivePosition, useRealtime } from '../lib/realtime';
import { useLocalState, useSettings } from '../lib/settings';
import { speak } from '../lib/voice';
import { clockTime, timeAgo } from '../lib/geo';

const HOLD_MS = 3000;

export default function Sos() {
  const { sos, send, live, pushEvent, you, hazards } = useRealtime();
  const { current, isFallback } = useLivePosition(true);
  const { settings } = useSettings();
  const [contacts, setContacts] = useLocalState('contacts', [
    { id: 'c1', name: 'Amma', relation: 'Mother', phone: '+91 98450 11223' },
    { id: 'c2', name: 'Ravi', relation: 'Brother', phone: '+91 99001 45872' },
  ]);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState({ name: '', relation: '', phone: '' });
  const [toasts, setToasts] = useState([]);
  const [shareGuardian, setShareGuardian] = useState(false);
  const holdTimer = useRef(null);
  const updateTimer = useRef(null);
  const startedAt = useRef(0);
  const mine = sos && you && sos.byId === you.id;

  const toast = useCallback((text, tone = '') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4800);
  }, []);

  const trigger = useCallback(() => {
    const payload = {
      lat: current.lat,
      lng: current.lng,
      message: 'Needs immediate assistance — VisionPath SOS activated.',
      contacts: contacts.map((c) => c.name),
    };
    send({ type: 'sos:start', payload });
    setProgress(1);
    speak(
      'SOS sent. Your live location is being shared with your guardians and every VisionPath user nearby. Help is on the way.',
      { force: true, priority: 'critical' },
    );
    pushEvent({
      kind: 'sos',
      severity: 'critical',
      title: 'SOS broadcast sent',
      detail: 'Live location shared with guardians and the nearby network.',
    });
    toast('SOS broadcast to guardians and the nearby network.', 'critical');
  }, [contacts, current.lat, current.lng, pushEvent, send, toast]);

  const startHold = () => {
    if (sos) return;
    setHolding(true);
    startedAt.current = Date.now();
    clearInterval(holdTimer.current);
    holdTimer.current = setInterval(() => {
      const pct = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(holdTimer.current);
        setHolding(false);
        trigger();
      }
    }, 40);
  };

  const cancelHold = () => {
    clearInterval(holdTimer.current);
    if (progress < 1) {
      setHolding(false);
      setProgress(0);
    }
  };

  /* keep broadcasting live location while my SOS is active */
  useEffect(() => {
    if (!mine) {
      clearInterval(updateTimer.current);
      return undefined;
    }
    updateTimer.current = setInterval(() => {
      send({ type: 'sos:update', lat: current.lat, lng: current.lng });
    }, 5000);
    return () => clearInterval(updateTimer.current);
  }, [mine, current.lat, current.lng, send]);

  useEffect(() => () => {
    clearInterval(holdTimer.current);
    clearInterval(updateTimer.current);
  }, []);

  useEffect(() => {
    if (progress === 0) return;
    const t = setTimeout(() => setProgress(0), 900);
    return () => clearTimeout(t);
  }, [progress]);

  const endSos = () => {
    send({ type: 'sos:end' });
    setProgress(0);
    speak('SOS closed. Glad you are safe.', { force: true, priority: 'high' });
    toast('SOS closed. Guardians have been told you are safe.', 'success');
  };

  const ack = () => {
    if (!sos) return;
    send({ type: 'sos:ack', id: sos.id });
    speak('Acknowledgement sent. Stay on the line.', { force: true });
    toast('Acknowledgement sent to the person in need.', 'success');
  };

  const addContact = (e) => {
    e.preventDefault();
    if (!draft.name || !draft.phone) return;
    setContacts((prev) => [...prev, { id: `c${Date.now()}`, ...draft }]);
    setDraft({ name: '', relation: '', phone: '' });
    toast('Emergency contact saved.', 'success');
  };

  const zoom = sos ? 17 : 16;
  const center = sos ? [sos.lat, sos.lng] : [current.lat, current.lng];

  return (
    <>
      <SectionHead
        eyebrow="Emergency SOS"
        title="Help, in one held press"
        sub="A three-second hold broadcasts your live location to guardians and to every VisionPath responder nearby — no dialling, no menus."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--critical'}`}><span className="dot-live" /> {live ? 'Realtime channel live' : 'Reconnecting'}</span>}
      />

      {sos ? (
        <div className="alert-banner alert-banner--live" role="alert">
          <Siren size={22} />
          <p style={{ flex: 1, margin: 0 }}>
            <strong>Active SOS · {sos.by}</strong> — {sos.message}
            <br />
            <span style={{ opacity: 0.9, fontSize: '0.8rem' }}>
              Broadcast {timeAgo(sos.createdAt)} · {sos.acks.length} responder{sos.acks.length === 1 ? '' : 's'} acknowledged ·{' '}
              {sos.contactsNotified?.length || 0} guardians notified
            </span>
          </p>
          {mine ? (
            <button type="button" className="btn btn--light btn--sm" onClick={endSos}>
              <Check size={15} /> I am safe
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--light btn--sm" onClick={ack}>
                <Check size={15} /> I am responding
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="sos-stage">
          <span className="badge" style={{ background: 'rgba(237,243,255,.14)', color: 'var(--creme)', borderColor: 'rgba(237,243,255,.3)', marginBottom: 18 }}>
            <ShieldCheck size={12} /> {isFallback ? 'Demo location' : 'Live GPS'}
          </span>
          <h2 style={{ color: 'var(--creme)', fontSize: 'clamp(1.8rem,3vw,2.5rem)' }}>
            {sos ? 'Your beacon is live' : 'Hold to call for help'}
          </h2>
          <p style={{ color: 'rgba(237,243,255,.78)', maxWidth: '34ch', margin: '8px auto 22px' }}>
            {sos
              ? 'Keep this page open. Your location updates every five seconds until you close the SOS.'
              : 'Press and hold the button for three seconds. Release early to cancel — nothing is sent by accident.'}
          </p>

          <button
            type="button"
            className={`sos-btn ${holding ? 'is-holding' : ''} ${sos ? 'is-active' : ''}`}
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!sos && !holding) startHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') cancelHold();
            }}
            aria-label={sos ? 'SOS is active' : 'Hold for three seconds to send an SOS'}
            aria-pressed={Boolean(sos)}
          >
            <svg className="sos-btn__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="46"
                strokeDasharray={`${progress * 289.03} 289.03`}
                opacity={progress ? 1 : 0}
              />
            </svg>
            {sos ? <LifeBuoy size={44} strokeWidth={1.4} /> : <Siren size={44} strokeWidth={1.4} />}
            <span className="sos-btn__text">{sos ? 'ACTIVE' : holding ? `${Math.ceil((1 - progress) * 3)}` : 'SOS'}</span>
            <span className="sos-btn__hint">{sos ? 'Tap below when safe' : 'Press & hold'}</span>
          </button>

          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {sos ? (
              mine ? (
                <button type="button" className="btn btn--light btn--sm" onClick={endSos}>
                  <Check size={15} /> I am safe — close SOS
                </button>
              ) : (
                <button type="button" className="btn btn--light btn--sm" onClick={ack}>
                  <Check size={15} /> Acknowledge
                </button>
              )
            ) : (
              <span className="pill" style={{ background: 'rgba(237,243,255,.1)', color: 'var(--creme)', borderColor: 'rgba(237,243,255,.24)' }}>
                <Clock size={13} /> {HOLD_MS / 1000}s hold prevents accidental alerts
              </span>
            )}
          </div>

          <p style={{ marginTop: 16, fontSize: '0.72rem', color: 'rgba(237,243,255,.55)' }}>
            Location {current.lat.toFixed(5)}, {current.lng.toFixed(5)} · accuracy {isFallback ? 'approximate' : `${Math.round(current.accuracy || 0)} m`}
          </p>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead
              icon={MapPin}
              title={sos ? 'Live SOS location' : 'Your live position'}
              sub={sos ? 'Shared with responders, refreshed every 5 seconds' : 'Used the moment an SOS is sent'}
              aside={sos ? <SeverityBadge severity="critical" /> : null}
            />
            <MapView
              center={center}
              zoom={zoom}
              height={280}
              you={{ lat: current.lat, lng: current.lng }}
              markers={[
                ...(sos ? [{ lat: sos.lat, lng: sos.lng, tone: 'critical', badge: 'SOS', label: `SOS — ${sos.by}`, meta: `${sos.message} · ${timeAgo(sos.createdAt)}` }] : []),
                ...(sos?.updates || []).slice(-20).map((u, i) => ({
                  lat: u.lat, lng: u.lng, tone: 'brand', badge: '·', label: 'Earlier position', meta: `${i + 1} of ${sos.updates.length}`,
                })),
                ...hazards.filter((h) => h.status !== 'resolved').slice(0, 6).map((h) => ({
                  lat: h.lat, lng: h.lng, tone: h.severity, badge: '!', label: h.label, meta: timeAgo(h.createdAt),
                })),
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.76rem', color: 'var(--ink-muted)', flexWrap: 'wrap', gap: 8 }}>
              <span><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {center[0].toFixed(4)}, {center[1].toFixed(4)}</span>
              <button
                type="button"
                className="chip-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `https://www.openstreetmap.org/?mlat=${center[0]}&mlon=${center[1]}#map=18/${center[0]}/${center[1]}`,
                  );
                  toast('Location link copied.', 'success');
                }}
              >
                Copy location link
              </button>
            </div>
          </Card>

          <Card>
            <CardHead icon={Users} title="Emergency contacts" sub="Notified the instant you send an SOS" />
            <div role="list">
              {contacts.map((c) => (
                <div key={c.id} className="contact-row" role="listitem">
                  <span className="avatar" aria-hidden="true">{c.name.slice(0, 2).toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.88rem' }}>{c.name}</strong>
                    <p style={{ margin: 0, fontSize: '0.76rem' }}>{c.relation} · {c.phone}</p>
                  </div>
                  <a className="chip-btn" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Call ${c.name}`}>
                    <Phone size={13} /> Call
                  </a>
                  <a className="chip-btn" href={`sms:${c.phone.replace(/\s/g, '')}?&body=${encodeURIComponent(`VisionPath SOS: I need help at ${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}`)}`} aria-label={`Message ${c.name}`}>
                    <Send size={13} /> SMS
                  </a>
                  <button
                    type="button"
                    className="chip-btn"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => setContacts((prev) => prev.filter((x) => x.id !== c.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={addContact} style={{ marginTop: 16 }}>
              <div className="field-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label htmlFor="contact-name">Name</label>
                  <input id="contact-name" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Meera" />
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label htmlFor="contact-phone">Phone</label>
                  <input id="contact-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 …" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="contact-relation">Relationship</label>
                <input id="contact-relation" type="text" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} placeholder="Sister, neighbour, volunteer" />
              </div>
              <button type="submit" className="btn btn--ghost btn--sm"><Plus size={14} /> Add contact</button>
            </form>

            <div className="setting-row" style={{ marginTop: 8 }}>
              <div>
                <h4>Notify guardian on SOS</h4>
                <p>Shares your live position until you close the alert.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={shareGuardian}
                aria-label="Notify guardian on SOS"
                className="switch"
                onClick={() => setShareGuardian((v) => !v)}
              />
            </div>
          </Card>

          {sos ? (
            <Card>
              <CardHead icon={Clock} title="Responder log" sub="Acknowledgements arrive live" />
              <div className="timeline">
                <div className="timeline__item is-critical">
                  <div className="timeline__time">{clockTime(sos.createdAt)}</div>
                  <strong>SOS broadcast by {sos.by}</strong>
                  <p>{sos.message}</p>
                </div>
                {sos.acks.map((a) => (
                  <div key={a.id} className="timeline__item is-success">
                    <div className="timeline__time">{clockTime(a.at)}</div>
                    <strong>{a.name} is responding</strong>
                    <p>Location acknowledged · en route</p>
                  </div>
                ))}
                {sos.updates.slice(-1).map((u) => (
                  <div key={u.t} className="timeline__item">
                    <div className="timeline__time">{clockTime(u.t)}</div>
                    <strong>Location refreshed</strong>
                    <p>{u.lat.toFixed(5)}, {u.lng.toFixed(5)}</p>
                  </div>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                Guardian notifications are simulated in this build; real calls and SMS open your device dialler from the contacts above.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  );
}
