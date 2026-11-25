import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Camera, Check, ImagePlus, MapPin, MessageSquarePlus, Send, X,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Card, CardHead, SectionHead, SeverityBadge, ToastStack } from '../components/UI';
import { useLivePosition, useRealtime } from '../lib/realtime';
import { useSettings } from '../lib/settings';
import { timeAgo } from '../lib/geo';
import { speak } from '../lib/voice';

const TYPES = [
  { id: 'pole', label: 'Pole / bollard', hint: 'Street furniture inside the walking line' },
  { id: 'pothole', label: 'Pothole', hint: 'Broken or sunken paving' },
  { id: 'stairs', label: 'Steps / stairs', hint: 'Missing handrail, broken edge' },
  { id: 'vehicle', label: 'Parked vehicle', hint: 'Blocking tactile paving or ramp' },
  { id: 'construction', label: 'Construction barrier', hint: 'Works, scaffolding, open trench' },
  { id: 'crossing', label: 'Crossing fault', hint: 'Silent beeper, dim signal' },
  { id: 'surface', label: 'Uneven surface', hint: 'Loose stones, water, slippery edge' },
];

async function downscale(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const max = 640;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.62);
}

export default function Report() {
  const { reportHazard, hazards, live } = useRealtime();
  const { current, isFallback } = useLivePosition(true);
  const { settings } = useSettings();
  const fileRef = useRef(null);

  const [type, setType] = useState('pothole');
  const [severity, setSeverity] = useState('high');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [pin, setPin] = useState({ lat: current.lat, lng: current.lng });
  const [pinMoved, setPinMoved] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [sending, setSending] = useState(false);

  const meta = TYPES.find((t) => t.id === type);

  const toast = (text, tone = '') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  const onPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', 'critical');
      return;
    }
    try {
      const small = await downscale(file);
      setPhoto(small);
    } catch {
      toast('That image could not be read.', 'critical');
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!description.trim()) {
      toast('Add a short description so others know what to expect.', 'critical');
      speak('Add a short description before submitting.');
      return;
    }
    setSending(true);
    reportHazard({
      type,
      severity,
      lat: pin.lat,
      lng: pin.lng,
      description: description.trim(),
      photo,
    });
    speak(
      `${meta.label} reported. Thank you. Nearby users have been alerted, and the community map is updated.`,
      { force: true, priority: 'high' },
    );
    toast('Report broadcast to everyone nearby.', 'success');
    setDescription('');
    setPhoto(null);
    setSending(false);
    setPinMoved(false);
  };

  const recent = hazards.slice(0, 6);

  return (
    <>
      <SectionHead
        eyebrow="Hazard reporting"
        title="Your report goes live in under a second"
        sub="Pin it, describe it, add a photo if you can. Everyone nearby receives it instantly, and route planners re-score around it."
        aside={<span className={`badge ${live ? 'badge--live' : 'badge--neutral'}`}><span className="dot-live" /> {live ? 'Broadcasting live' : 'Queued'}</span>}
      />

      <div className="grid" style={{ gridTemplateColumns: '1.15fr 1fr', alignItems: 'start' }}>
        <Card>
          <CardHead icon={MessageSquarePlus} title="New hazard report" sub="Required fields are marked in the labels" />
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="hazard-type">Hazard type</label>
              <select id="hazard-type" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <p className="hint">{meta.hint}</p>
            </div>

            <div className="field">
              <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 7 }}>
                Severity
              </span>
              <div className="seg" role="group" aria-label="Hazard severity">
                {['low', 'medium', 'high', 'critical'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={severity === level ? 'active' : ''}
                    onClick={() => setSeverity(level)}
                    aria-pressed={severity === level}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="hazard-desc">Description</label>
              <textarea
                id="hazard-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Deep pothole across half the footpath, water filled. Safer to pass on the right near the wall."
                maxLength={400}
                required
              />
              <p className="hint">{description.length}/400 · Describe the approach, not just the object.</p>
            </div>

            <div className="field">
              <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 7 }}>
                Photo (optional)
              </span>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} id="hazard-photo" />
              {photo ? (
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <img src={photo} alt="Preview of the hazard you are reporting" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="chip-btn"
                    style={{ position: 'absolute', top: 10, right: 10, background: 'var(--creme)', color: '#131A3C', borderColor: 'transparent' }}
                    aria-label="Remove photo"
                  >
                    <X size={13} /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ width: '100%' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={16} /> Attach a photo
                </button>
              )}
              <p className="hint">Photos are downscaled in the browser before sharing.</p>
            </div>

            <div className="field">
              <label htmlFor="hazard-location">Location</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="pill"><MapPin size={13} /> {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    setPin({ lat: current.lat, lng: current.lng });
                    setPinMoved(false);
                    toast('Using your live position.', 'success');
                  }}
                >
                  <MapPin size={13} /> Use my position
                </button>
                <span className="hint" style={{ margin: 0 }}>
                  {isFallback ? 'Demo position — tap the map to place the pin.' : pinMoved ? 'Pin placed manually on the map.' : 'Live GPS position.'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="submit" className="btn" disabled={sending}>
                <Send size={16} /> {sending ? 'Broadcasting…' : 'Broadcast report'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => speak('Report form. Choose a hazard type, describe it, and broadcast.')}
              >
                Read form help
              </button>
            </div>
          </form>
        </Card>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card style={{ padding: 10 }}>
            <MapView
              center={[pin.lat, pin.lng]}
              zoom={16}
              height={300}
              onPick={(coords) => {
                setPin(coords);
                setPinMoved(true);
              }}
              markers={[
                { lat: pin.lat, lng: pin.lng, tone: 'brand', badge: '!', label: 'Your report location', meta: 'Tap the map to move this pin' },
                ...hazards.slice(0, 10).map((h) => ({ lat: h.lat, lng: h.lng, tone: h.severity, badge: '·', label: h.label, meta: h.description })),
              ]}
              you={{ lat: current.lat, lng: current.lng }}
            />
            <p className="hint" style={{ padding: '10px 6px 4px' }}>
              Tap anywhere on the map to place the hazard precisely. Existing community reports are shown for context.
            </p>
          </Card>

          <Card>
            <CardHead icon={Check} title="Just reported" sub="Live from the shared channel" aside={<span className="badge badge--live"><span className="dot-live" /> Live</span>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((h) => (
                <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.86rem' }}>{h.label}</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem' }}>{h.description}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{h.reporter} · {timeAgo(h.createdAt)}</span>
                  </div>
                  <SeverityBadge severity={h.severity} />
                </div>
              ))}
            </div>
            <Link to="/community" className="btn btn--ghost btn--sm" style={{ marginTop: 14 }}>
              <AlertTriangle size={14} /> See everything on the map
            </Link>
          </Card>

          <Card>
            <CardHead icon={Camera} title="Report with your voice" sub="Hands full? Use the scan page or browser dictation" />
            <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>
              Voice dictation is available in the description field through your device keyboard. On the scan page,
              high-risk detections can be auto-shared with the community.
            </p>
            <Link to="/scan" className="btn btn--ghost btn--sm">Open live scan</Link>
          </Card>
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </>
  );
}
