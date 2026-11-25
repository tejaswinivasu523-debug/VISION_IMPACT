import React, { useState } from 'react';
import {
  Accessibility, Check, Eye, Gauge, Keyboard, Mic2, MonitorSmartphone, RotateCcw,
  SlidersHorizontal, Vibrate, Volume2,
} from 'lucide-react';
import { Card, CardHead, SectionHead, Slider, Switch } from '../components/UI';
import { useSettings } from '../lib/settings';
import { useRealtime } from '../lib/realtime';

export default function SettingsPage() {
  const { settings, update, reset, testVoice, voiceName } = useSettings();
  const { you, setName, live } = useRealtime();
  const [nameDraft, setNameDraft] = useState(you?.name || '');

  const support = [
    { label: 'Speech synthesis', ok: typeof window !== 'undefined' && 'speechSynthesis' in window },
    { label: 'Camera capture', ok: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) },
    { label: 'Geolocation', ok: typeof navigator !== 'undefined' && Boolean(navigator.geolocation) },
    { label: 'Haptic vibration', ok: typeof navigator !== 'undefined' && Boolean(navigator.vibrate) },
    { label: 'Realtime channel', ok: live },
  ];

  return (
    <>
      <SectionHead
        eyebrow="Accessibility settings"
        title="Shaped to your eyes, ears and hands"
        sub="Every change applies immediately across the scanner, alerts, SOS and indoor guidance — and is remembered on this device."
        aside={<button type="button" className="btn btn--ghost btn--sm" onClick={reset}><RotateCcw size={15} /> Reset defaults</button>}
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Volume2} title="Voice" sub="Text-to-speech used by every guidance surface" />
            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div>
                <h4>Voice guidance</h4>
                <p>Speak obstacles, re-routes and confirmations aloud.</p>
              </div>
              <Switch checked={settings.voice} onChange={(v) => update({ voice: v })} label="Voice guidance" />
            </div>
            <div className="setting-row">
              <div>
                <h4>Announce high-severity alerts automatically</h4>
                <p>Interrupts other speech for critical hazards.</p>
              </div>
              <Switch checked={settings.autoSpeakAlerts} onChange={(v) => update({ autoSpeakAlerts: v })} label="Auto announce high severity alerts" />
            </div>

            <div style={{ marginTop: 18 }}>
              <label>Speech rate</label>
              <Slider label="Speech rate" value={settings.rate} min={0.6} max={1.8} step={0.05} onChange={(v) => update({ rate: v })} suffix="×" />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Pitch</label>
              <Slider label="Speech pitch" value={settings.pitch} min={0.6} max={1.6} step={0.05} onChange={(v) => update({ pitch: v })} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Volume</label>
              <Slider label="Speech volume" value={settings.volume} min={0} max={1} step={0.05} onChange={(v) => update({ volume: v })} />
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <label htmlFor="settings-language">Language</label>
              <select id="settings-language" value={settings.lang} onChange={(e) => update({ lang: e.target.value })}>
                <option value="en-IN">English (India)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                <option value="ta-IN">தமிழ் (Tamil)</option>
                <option value="mr-IN">मराठी (Marathi)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn btn--sm" onClick={testVoice}><Mic2 size={15} /> Test voice</button>
              <span className="hint" style={{ margin: 0 }}>
                Voice in use: {voiceName || 'system default'}
              </span>
            </div>
          </Card>

          <Card>
            <CardHead icon={Eye} title="Display" sub="Contrast, size and colour handling" />
            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div>
                <h4>High contrast</h4>
                <p>Pure burgundy on creme, decorative gradients removed.</p>
              </div>
              <Switch checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} label="High contrast mode" />
            </div>
            <div className="setting-row">
              <div>
                <h4>Colour-blind friendly statuses</h4>
                <p>Adds shapes and letters so severity is never colour-only.</p>
              </div>
              <Switch checked={settings.colourBlind} onChange={(v) => update({ colourBlind: v })} label="Colour-blind friendly mode" />
            </div>
            <div className="setting-row">
              <div>
                <h4>Reduced motion</h4>
                <p>Stops drifting gradients, radar pulses and transitions.</p>
              </div>
              <Switch checked={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} label="Reduced motion" />
            </div>
            <div style={{ marginTop: 16 }}>
              <label>Text size</label>
              <Slider
                label="Text size"
                value={settings.textScale}
                min={0.9}
                max={1.45}
                step={0.05}
                onChange={(v) => update({ textScale: v })}
                suffix="×"
              />
              <p className="hint">Scales the entire interface, not just body copy.</p>
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Gauge} title="Guidance behaviour" sub="How eagerly the assistant speaks" />
            <div className="seg" role="group" aria-label="Alert sensitivity">
              {['gentle', 'balanced', 'high'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={settings.sensitivity === level ? 'active' : ''}
                  onClick={() => update({ sensitivity: level })}
                  aria-pressed={settings.sensitivity === level}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              {settings.sensitivity === 'gentle'
                ? 'Only close, clearly identified obstacles are announced.'
                : settings.sensitivity === 'high'
                  ? 'The scan reacts to the smallest corridor change, with more frequent reminders.'
                  : 'Recommended: warns early without overwhelming you.'}
            </p>
            <div className="setting-row" style={{ marginTop: 6 }}>
              <div>
                <h4>Haptic feedback</h4>
                <p>Vibrates on critical alerts and SOS confirmations.</p>
              </div>
              <Switch checked={settings.haptics} onChange={(v) => update({ haptics: v })} label="Haptic feedback" />
            </div>
          </Card>

          <Card>
            <CardHead icon={Accessibility} title="Profile" sub="The name other walkers and guardians see" />
            <div className="field">
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={you?.name || 'Guest navigator'}
              />
            </div>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setName(nameDraft || 'Guest navigator')}
            >
              <Check size={15} /> Save name
            </button>
            <p className="hint" style={{ marginTop: 10 }}>Stored on this device and sent only to the live channel.</p>
          </Card>

          <Card>
            <CardHead icon={MonitorSmartphone} title="Device support" sub="Checked in this browser right now" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {support.map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                  <span>{s.label}</span>
                  <span className={`badge ${s.ok ? 'badge--low' : 'badge--high'}`}>{s.ok ? 'Available' : 'Unavailable'}</span>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Camera access requires permission and a secure context (https or localhost).
            </p>
          </Card>

          <Card>
            <CardHead icon={Keyboard} title="Keyboard shortcuts" sub="Everything works without a pointer" />
            <table className="table">
              <thead>
                <tr><th scope="col">Keys</th><th scope="col">Action</th></tr>
              </thead>
              <tbody>
                {[
                  ['Alt + 1', 'Dashboard'],
                  ['Alt + 2', 'Live scan'],
                  ['Alt + 3', 'Alerts'],
                  ['Alt + 4', 'Routes'],
                  ['Alt + 5', 'Community map'],
                  ['Alt + 6', 'SOS'],
                  ['Alt + 7', 'Journey'],
                  ['Alt + 8', 'Settings'],
                  ['Space', 'Hold-to-send SOS'],
                  ['Tab / Shift + Tab', 'Move through every control'],
                ].map(([keys, action]) => (
                  <tr key={keys}><td><kbd style={{ fontFamily: 'var(--sans)', fontSize: '0.78rem', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'rgba(157,140,255,.35)' }}>{keys}</kbd></td><td>{action}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card dark>
            <CardHead icon={SlidersHorizontal} title="Designed to standards" sub="Not an afterthought" />
            <p style={{ color: 'rgba(237,243,255,.78)', fontSize: '0.85rem' }}>
              Semantic landmarks, ARIA live regions for every alert, visible burgundy focus rings, 48 px minimum
              touch targets and AA+ contrast on the strict palette.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pill">WCAG AA+</span>
              <span className="pill">Screen-reader ready</span>
              <span className="pill">Keyboard first</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
