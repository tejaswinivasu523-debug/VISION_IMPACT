import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Car, Check, Clock, Footprints, Mic, MicOff, Signal, TrafficCone, Volume2,
} from 'lucide-react';
import { Card, CardHead, SectionHead } from '../components/UI';
import { useRealtime } from '../lib/realtime';
import { useSettings } from '../lib/settings';
import { speak } from '../lib/voice';

const CROSSING_SECONDS = 9;

export default function Crossing() {
  const { signals, live, pushEvent } = useRealtime();
  const { settings, update } = useSettings();
  const [selectedId, setSelectedId] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const prevPhase = useRef('');
  const spokenSecond = useRef(0);

  const signal = signals.find((s) => s.id === selectedId) || signals[0];

  useEffect(() => {
    if (!selectedId && signals.length) setSelectedId(signals[0].id);
  }, [signals, selectedId]);

  /* Voice: announce turning green, count down the last seconds, warn on red. */
  useEffect(() => {
    if (!signal || !settings.voice) return;
    if (signal.phase !== prevPhase.current) {
      prevPhase.current = signal.phase;
      spokenSecond.current = 0;
      if (signal.phase === 'green') {
        speak(`Green signal. Safe to cross now. You have ${signal.remaining} seconds.`, { force: true, priority: 'critical' });
      } else {
        speak(`Red signal. Please wait. ${signal.remaining} seconds until green.`, { force: true, priority: 'high' });
      }
    }
    if (signal.phase === 'green' && signal.remaining <= 5 && signal.remaining !== spokenSecond.current) {
      spokenSecond.current = signal.remaining;
      speak(`${signal.remaining} seconds left to cross.`, { force: true, priority: 'critical' });
    }
  }, [signal?.phase, signal?.remaining, settings.voice]);

  /* Nearby-vehicle sensor: geometry-driven warnings, clearly labelled simulated. */
  useEffect(() => {
    const timer = setInterval(() => {
      setVehicle((prev) => {
        if (prev) return null;
        if (Math.random() > 0.55) {
          const side = Math.random() > 0.5 ? 'left' : 'right';
          const next = { side, metres: 8 + Math.round(Math.random() * 14), at: Date.now() };
          if (settings.voice) {
            speak(`Vehicle approaching from your ${side}, ${next.metres} metres. Wait.`, { priority: 'high', force: true });
          }
          return next;
        }
        return prev;
      });
    }, 9000);
    return () => clearInterval(timer);
  }, [settings.voice]);

  const phaseColor = signal?.phase === 'green' ? '#7ED9B4' : '#F0708F';
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const total = signal ? (signal.phase === 'green' ? Math.max(1, signal.greenLen) : Math.max(30, signal.remaining)) : 1;
  const progress = signal ? Math.min(1, signal.remaining / total) : 0;

  const announce = () => {
    if (!signal) return;
    speak(
      signal.phase === 'green'
        ? `Green. Safe to cross. ${signal.remaining} seconds remaining.`
        : `Red. Please wait. ${signal.remaining} seconds until green.`,
      { force: true, priority: 'critical' },
    );
  };

  return (
    <>
      <SectionHead
        eyebrow="Crossing assistant"
        title="Cross on the signal, not on a guess"
        sub="The crossing's phase is broadcast by the VisionPath network every second — the same countdown reaches your voice and every nearby user."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--critical'}`}><span className="dot-live" /> {live ? 'Signal live' : 'Signal offline'}</span>}
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <div className="field">
              <label htmlFor="crossing-select">Choose a crossing</label>
              <select id="crossing-select" value={signal?.id || ''} onChange={(e) => setSelectedId(e.target.value)}>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                {!signals.length ? <option value="">Waiting for the live signal feed…</option> : null}
              </select>
            </div>

            <div className={`signal-lamp ${signal?.phase === 'green' ? 'is-green' : 'is-red'}`}>
              {signal?.phase === 'green' ? <Check size={28} /> : <Clock size={26} />}
            </div>

            <div className="crossing-ring">
              <svg viewBox="0 0 176 176" aria-hidden="true">
                <circle cx="88" cy="88" r={radius} fill="none" stroke="rgba(143,163,198,.1)" strokeWidth="11" />
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="none"
                  stroke={phaseColor}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * circumference} ${circumference}`}
                  style={{ transition: 'stroke-dasharray .4s linear, stroke .4s' }}
                />
              </svg>
              <div className="crossing-ring__center">
                <div>
                  <div className="crossing-ring__value" style={{ color: phaseColor }}>
                    {signal ? signal.remaining : '—'}
                  </div>
                  <div className="crossing-ring__label">{signal?.phase === 'green' ? 'cross now' : 'until green'}</div>
                </div>
              </div>
            </div>

            <div aria-live="assertive" style={{ textAlign: 'center', margin: '16px auto 0', maxWidth: 340 }}>
              <strong style={{ display: 'block', fontSize: '1rem' }}>
                {!signal
                  ? 'Waiting for signal data'
                  : signal.phase === 'green'
                    ? (signal.remaining >= CROSSING_SECONDS ? 'Safe to cross — start now' : 'Hurry — green is ending')
                    : 'Wait — do not start crossing'}
              </strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.83rem' }}>
                {signal
                  ? signal.phase === 'green'
                    ? `${signal.remaining} seconds of green remain. You need about ${CROSSING_SECONDS} seconds to cross comfortably.`
                    : `The vehicle phase is active. Green arrives in ${signal.remaining} seconds.`
                  : 'The VisionPath signal channel will populate here automatically.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--sm" onClick={announce}><Volume2 size={15} /> Read signal aloud</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ voice: !settings.voice })}>
                {settings.voice ? <Mic size={15} /> : <MicOff size={15} />} Voice {settings.voice ? 'on' : 'off'}
              </button>
            </div>
          </Card>

          {vehicle ? (
            <div className="alert-banner" role="alert" style={{ marginBottom: 0 }}>
              <Car size={20} />
              <p style={{ flex: 1 }}>
                <strong>Vehicle approaching from your {vehicle.side}</strong> — about {vehicle.metres} metres.
                Stay on the kerb until the signal is green.
              </p>
              <button type="button" className="chip-btn" onClick={() => setVehicle(null)}>Dismiss</button>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Signal} title="Crossing status" sub="Synchronised from the roadside signal network" />
            <div className="grid grid--2" style={{ gap: 12 }}>
              {signals.map((s) => (
                <div key={s.id} style={{ padding: 14, borderRadius: 14, border: '1px solid var(--line)', background: s.id === signal?.id ? '#0A1128' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.83rem' }}>{s.name}</strong>
                    <span className={`badge ${s.phase === 'green' ? 'badge--low' : 'badge--critical'}`}>{s.phase}</span>
                  </div>
                  <div className={`signal-lamp ${s.phase === 'green' ? 'is-green' : 'is-red'}`} style={{ width: 38, height: 38, margin: '12px 0 8px', borderWidth: 3 }}>
                    {s.phase === 'green' ? <Check size={17} /> : <Clock size={16} />}
                  </div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', lineHeight: 1 }}>{s.remaining}s</div>
                  <button
                    type="button"
                    className="chip-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => setSelectedId(s.id)}
                  >
                    {s.id === signal?.id ? 'Selected' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Signal phases are ticked by the VisionPath server clock, so every connected device sees the same countdown.
            </p>
          </Card>

          <Card>
            <CardHead icon={Footprints} title="How to cross safely" sub="Voice-guided sequence" />
            <div className="timeline">
              <div className="timeline__item">
                <div className="timeline__time">Approach</div>
                <strong>Find the tactile edge</strong>
                <p>Guidance says "kerb ahead" and stops you half a metre from the road.</p>
              </div>
              <div className="timeline__item">
                <div className="timeline__time">Wait</div>
                <strong>Hold position while red</strong>
                <p>Vehicle warnings interrupt any other speech immediately.</p>
              </div>
              <div className="timeline__item is-success">
                <div className="timeline__time">Cross</div>
                <strong>Green confirmed, countdown begins</strong>
                <p>You hear the remaining seconds until the phase ends.</p>
              </div>
              <div className="timeline__item">
                <div className="timeline__time">Finish</div>
                <strong>Re-scan on the far kerb</strong>
                <p>Live scan resumes automatically to catch anything new.</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead icon={TrafficCone} title="Crossing reports nearby" sub="Community maintained" />
            <p style={{ fontSize: '0.85rem' }}>
              Missing beepers, dim signals and blocked tactile paving are reported by the community and spoken on approach.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/report" className="btn btn--ghost btn--sm">Report a crossing fault</Link>
              <Link to="/alerts" className="btn btn--ghost btn--sm">Alert settings</Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="alert-banner" style={{ marginTop: 24 }} role="note">
        <AlertTriangle size={18} />
        <p style={{ flex: 1 }}>
          Always confirm with your cane, guide dog or a person beside you. Signals and sensors can fail;
          VisionPath is an assistant, never a replacement for your own judgement.
        </p>
      </div>
    </>
  );
}
