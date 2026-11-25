import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, CameraOff, Eye, Mic, MicOff,
  Play, Radar, Share2, Square, Waves, Zap,
} from 'lucide-react';
import { Card, CardHead, SectionHead, SeverityBadge } from '../components/UI';
import { useRealtime } from '../lib/realtime';
import { useLiveScan } from '../lib/live';
import { useSettings } from '../lib/settings';
import { planPath } from '../lib/guidance';
import { createDetector, createSimulator, startCamera, stopCamera } from '../lib/vision';
import { speak, stopSpeaking } from '../lib/voice';

const TYPE_BY_LABEL = {
  Pole: 'pole', Person: 'pole', Vehicle: 'vehicle', Pothole: 'pothole',
  Barrier: 'construction', Bin: 'construction', Bollard: 'pole', Stairs: 'stairs',
};

function laneIndex(laneId) {
  return ['far-left', 'left', 'centre', 'right', 'far-right'].indexOf(laneId);
}

export default function LiveScan() {
  const { reportHazard, pushEvent, live } = useRealtime();
  const { pushFrame, update, scene } = useLiveScan();
  const { settings, update: updateSettings } = useSettings();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const simRef = useRef(null);
  const prevOffset = useRef(0);
  const lastSpoken = useRef(0);
  const lastKey = useRef('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [mode, setMode] = useState('idle');
  const [camState, setCamState] = useState('off');
  const [mirrored, setMirrored] = useState(false);
  const [obstacles, setObstacles] = useState([]);
  const [plan, setPlan] = useState(null);
  const [log, setLog] = useState([]);
  const [autoShare, setAutoShare] = useState(true);
  const [fps, setFps] = useState(0);
  const [notice, setNotice] = useState('');

  const stop = useCallback(() => {
    setMode('idle');
    setCamState('off');
    setObstacles([]);
    setPlan(null);
    prevOffset.current = 0;
    lastKey.current = '';
    stopCamera(videoRef.current);
    stopSpeaking();
    setFps(0);
    update({ active: false, mode: 'idle', camera: 'off', obstacles: [], plan: null });
  }, [update]);

  const startCameraMode = useCallback(async () => {
    setCamState('starting');
    setNotice('');
    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setCamState('on');
      setMode('camera');
      update({ active: true, mode: 'camera', camera: 'on' });
      speak('Camera live. Scanning your path continuously.');
    } catch (err) {
      setCamState('denied');
      setMode('simulation');
      setNotice('Camera unavailable, so VisionPath is running a live corridor simulation instead.');
      update({ active: true, mode: 'simulation', camera: 'denied' });
      speak('Camera not available. Running live simulation so you can still hear guidance.');
    }
  }, [update]);

  const startSimulation = useCallback(() => {
    stopCamera(videoRef.current);
    setCamState('off');
    setMode('simulation');
    setNotice('Simulation active — obstacles move through the corridor and guidance re-plans in real time.');
    update({ active: true, mode: 'simulation', camera: 'off' });
    speak('Live corridor simulation running.');
  }, [update]);

  /* ---- the realtime loop: detect, plan, speak, auto-share ---------------- */
  useEffect(() => {
    if (mode === 'idle') return undefined;
    if (!detectorRef.current) detectorRef.current = createDetector();
    if (!simRef.current) simRef.current = createSimulator();

    let frames = 0;
    let lastShareAt = 0;
    const startedAt = performance.now();

    const timer = setInterval(() => {
      const isCamera = mode === 'camera';
      const nextObstacles = isCamera
        ? detectorRef.current.analyse(videoRef.current, { sensitivity: settingsRef.current.sensitivity })
        : simRef.current.step(0.22);

      const previous = prevOffset.current;
      const nextPlan = planPath(nextObstacles, previous, { previousLaneOffset: previous });
      prevOffset.current = nextPlan.offset;

      setObstacles(nextObstacles);
      setPlan(nextPlan);
      pushFrame(nextObstacles, previous);

      frames += 1;
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed > 1) setFps(Math.round(frames / elapsed));

      const key = `${nextPlan.urgency}|${nextPlan.laneId}|${nextPlan.nearest?.id ?? 'none'}`;
      const now = Date.now();
      if (key !== lastKey.current) {
        lastKey.current = key;
        setLog((prev) => [
          { id: `${now}-${Math.random().toString(36).slice(2, 6)}`, at: now, text: nextPlan.speech, urgency: nextPlan.urgency },
          ...prev,
        ].slice(0, 9));
        if (settingsRef.current.voice) {
          speak(nextPlan.speech, { priority: nextPlan.urgency === 'stop' ? 'critical' : 'high' });
        }
        lastSpoken.current = now;
      } else if (nextPlan.nearest && now - lastSpoken.current > 6000) {
        if (settingsRef.current.voice) speak(nextPlan.speech, { priority: 'high' });
        lastSpoken.current = now;
      }

      if (autoShare && nextPlan.nearest && nextPlan.nearest.distance < 2.4
        && ['critical', 'high'].includes(nextPlan.nearest.severity) && now - lastShareAt > 25000) {
        lastShareAt = now;
        const hazard = {
          type: TYPE_BY_LABEL[nextPlan.nearest.label] || 'construction',
          severity: nextPlan.nearest.severity,
          lat: 12.9719 + (Math.random() - 0.5) * 0.0012,
          lng: 77.5946 + (Math.random() - 0.5) * 0.0012,
          description: `Detected live by VisionPath scan: ${nextPlan.nearest.label.toLowerCase()} about ${nextPlan.nearest.distance} m ahead.`,
        };
        reportHazard(hazard);
        pushEvent({
          kind: 'detect',
          severity: nextPlan.nearest.severity,
          title: `${nextPlan.nearest.label} shared with the community`,
          detail: 'Your scan contributed a new hazard to the live map.',
        });
      }
    }, 220);

    return () => clearInterval(timer);
  }, [mode, autoShare, pushFrame, reportHazard, pushEvent]);

  useEffect(() => () => {
    stopCamera(videoRef.current);
    stopSpeaking();
  }, []);

  const toggleVoice = () => {
    updateSettings({ voice: !settings.voice });
    if (!settings.voice) speak('Voice guidance on.', { force: true, priority: 'high' });
  };

  const nearest = plan?.nearest;
  const lane = laneIndex(plan?.laneId);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
        <Link to="/" className="chip-btn"><ArrowLeft size={14} /> Dashboard</Link>
        <span className={`badge ${mode === 'idle' ? 'badge--neutral' : 'badge--live'}`}>
          <span className="dot-live" /> {mode === 'idle' ? 'Sensor idle' : mode === 'camera' ? 'Camera live' : 'Simulation live'}
        </span>
        <span className="badge badge--neutral"><Zap size={11} /> {fps || 0} passes/sec</span>
        {autoShare ? <span className="badge badge--low"><Share2 size={11} /> Community sharing</span> : null}
      </div>

      <SectionHead
        eyebrow="Live camera scanning"
        title="The path, described continuously"
        sub="Objects are found on-device, the safest lane is recomputed every frame, and guidance keeps correcting itself as things move."
        aside={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn--sm ${settings.voice ? 'btn--ghost' : 'btn--ghost'}`} onClick={toggleVoice}>
              {settings.voice ? <Mic size={15} /> : <MicOff size={15} />} Voice {settings.voice ? 'on' : 'off'}
            </button>
            {mode === 'idle' ? (
              <button type="button" className="btn btn--sm" onClick={startCameraMode}>
                <Camera size={15} /> Enable camera
              </button>
            ) : (
              <button type="button" className="btn btn--danger btn--sm" onClick={stop}>
                <Square size={14} /> Stop scan
              </button>
            )}
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div className={`cam ${mirrored ? 'is-mirrored' : ''}`}>
            <video ref={videoRef} playsInline muted autoPlay aria-label="Live camera feed for obstacle detection" />
            {mode !== 'camera' ? (
              <div className="cam__empty">
                <div>
                  <Eye size={28} strokeWidth={1.2} style={{ opacity: 0.7 }} />
                  <p style={{ margin: '10px 0 12px', color: 'rgba(237,243,255,.8)', fontSize: '0.85rem' }}>
                    {mode === 'idle'
                      ? 'Camera is off. Turn it on for real obstacle detection, or run the live corridor simulation.'
                      : 'Simulated corridor running — guidance below is live.'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn--light btn--sm" onClick={startCameraMode}>
                      <Camera size={15} /> Use camera
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--creme)', borderColor: 'rgba(237,243,255,.35)' }} onClick={startSimulation}>
                      <Play size={15} /> Simulate corridor
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <span className="cam__badge">
              <span className="rec" /> {mode === 'camera' ? 'Live vision' : mode === 'simulation' ? 'Simulation' : 'Standby'}
            </span>

            {/* detection + safe-path overlay */}
            <svg className="cam__overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="weaveGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#EDF3FF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#A9C4FF" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="laneGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#7ED9B4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#7ED9B4" stopOpacity="0" />
                </linearGradient>
              </defs>

              {mode !== 'idle' && plan ? (
                <>
                  <polygon
                    points={plan.weave.map((p) => `${p.x * 100},${p.y * 100}`).join(' ') + ` ${plan.weave[4].x * 100 + 9},${0} ${plan.weave[4].x * 100 - 9},${0} ${plan.weave[0].x * 100 + 13},${100} ${plan.weave[0].x * 100 - 13},${100}`}
                    fill="url(#laneGrad)"
                  />
                  <polyline
                    points={plan.weave.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                    fill="none"
                    stroke="url(#weaveGrad)"
                    strokeWidth="1.1"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                  {obstacles.map((o) => {
                    const x = Math.max(1, Math.min(88, o.box.x * 100 + 2));
                    const y = Math.max(2, Math.min(78, o.box.y * 100 + 4));
                    const w = Math.max(12, Math.min(32, o.box.w * 100 + 6));
                    const h = Math.max(14, Math.min(30, o.box.h * 100 + 6));
                    const color = o.severity === 'critical' ? '#F0708F'
                      : o.severity === 'high' ? '#F0C36B'
                        : o.severity === 'medium' ? '#A9C4FF' : '#4ade80';
                    return (
                      <g key={o.id}>
                        <rect x={x} y={y} width={w} height={h} rx="1.6" fill="rgba(8,12,22,.18)" stroke={color} strokeWidth="0.8" />
                        <rect x={x} y={y - 4.4} width={Math.max(18, o.label.length * 2.9 + 12)} height="4.4" rx="1" fill="rgba(8,12,22,.72)" />
                        <text x={x + 1.6} y={y - 1.1} fill={color} fontSize="2.5" fontWeight="600" letterSpacing="0.2">
                          {o.label} · {o.distance.toFixed(1)}m
                        </text>
                      </g>
                    );
                  })}
                  <line x1="0" y1="42" x2="100" y2="42" stroke="rgba(237,243,255,.16)" strokeWidth="0.3" />
                  <text x="2" y="41" fill="rgba(237,243,255,.5)" fontSize="2.2">HORIZON · 5 m</text>
                </>
              ) : null}
            </svg>

            {mode !== 'idle' ? (
              <div className="cam__hud">
                <div className={`guidance ${plan?.urgency === 'stop' ? 'is-stop' : ''}`} aria-live="polite">
                  <span className="label">{plan?.urgency === 'stop' ? 'Stop now' : 'Guidance'}</span>
                  <p>{plan?.instruction || 'Scanning…'}</p>
                </div>
                <div className="distance-chip">
                  <strong>{nearest ? nearest.distance.toFixed(1) : '—'}</strong>
                  <span>metres</span>
                </div>
              </div>
            ) : null}
          </div>

          {notice ? (
            <div className="alert-banner" role="status">
              <AlertTriangle size={17} />
              <p style={{ flex: 1 }}>{notice}</p>
            </div>
          ) : null}

          <Card>
            <CardHead
              icon={Radar}
              title="Safe corridor"
              sub="Five candidate lanes scored against everything currently detected"
              aside={<SeverityBadge severity={plan?.urgency === 'stop' ? 'critical' : plan?.urgency === 'caution' ? 'high' : 'low'} />}
            />
            <div className="lane-viz" style={{ marginBottom: 14 }}>
              {['far left', 'left', 'centre', 'right', 'far right'].map((name, i) => (
                <div key={name} style={{ flex: 1, textAlign: 'center' }}>
                  <div className={`lane-viz__lane ${i === lane ? 'is-safe' : ''}`} />
                  <span style={{ fontSize: '0.6rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Chosen line:</strong> {plan?.laneName || 'waiting'}
              {plan ? (
                <span className="badge badge--neutral">
                  path cost {plan.cost.toFixed(2)} · risk {plan.risk.toFixed(2)}
                </span>
              ) : null}
            </p>
            <p className="card__sub">
              Re-planned {scene.detectionsTotal ? `${scene.detectionsTotal}` : '0'} new detections this session. Guidance
              re-evaluates every 220 ms and speaks as soon as the safe line changes.
            </p>
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <CardHead icon={Eye} title="Detected now" sub={`${obstacles.length} object${obstacles.length === 1 ? '' : 's'} in the corridor`} />
            <div className="detect-list">
              {obstacles
                .slice()
                .sort((a, b) => a.distance - b.distance)
                .map((o) => (
                  <div key={o.id} className={`detect-row sev-${o.severity}`}>
                    <span className="detect-row__bar" aria-hidden="true" />
                    <div className="detect-row__main">
                      <strong>{o.label}</strong>
                      <span>
                        {o.distance.toFixed(1)} m · {o.bearing < -0.15 ? 'left' : o.bearing > 0.15 ? 'right' : 'centre'} ·{' '}
                        {Math.round(o.confidence * 100)}% confidence
                      </span>
                    </div>
                    <SeverityBadge severity={o.severity} />
                  </div>
                ))}
              {!obstacles.length ? (
                <p className="card__sub">
                  {mode === 'idle'
                    ? 'Start a scan to populate live detections.'
                    : 'Corridor clear. Nothing detected in the next five metres.'}
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHead icon={Waves} title="Guidance controls" sub="Applies to this scan immediately" />
            <div className="field">
              <label htmlFor="scan-sensitivity">Detection sensitivity</label>
              <select
                id="scan-sensitivity"
                value={settings.sensitivity}
                onChange={(e) => updateSettings({ sensitivity: e.target.value })}
              >
                <option value="gentle">Gentle — fewer alerts</option>
                <option value="balanced">Balanced — recommended</option>
                <option value="high">High — catch everything</option>
              </select>
            </div>
            <div className="setting-row" style={{ paddingTop: 4 }}>
              <div>
                <h4>Share detections with community</h4>
                <p>High-risk finds are broadcast to nearby users automatically.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoShare}
                aria-label="Share detections with community"
                className="switch"
                onClick={() => setAutoShare((v) => !v)}
              />
            </div>
            <div className="setting-row">
              <div>
                <h4>Mirror front camera</h4>
                <p>Useful when the phone faces you rather than the path.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mirrored}
                aria-label="Mirror camera preview"
                className="switch"
                onClick={() => setMirrored((v) => !v)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={startSimulation}>
                <Play size={14} /> Simulate
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={startCameraMode}>
                <Camera size={14} /> Camera
              </button>
              {mode !== 'idle' ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={stop}>
                  <CameraOff size={14} /> Stop
                </button>
              ) : null}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Frames are processed in this tab only. Nothing is uploaded; only hazard summaries you choose to share are broadcast.
            </p>
          </Card>

          <Card>
            <CardHead icon={ArrowRight} title="Guidance log" sub="Every re-route is spoken and recorded" />
            <div className="timeline">
              {log.map((entry) => (
                <div key={entry.id} className={`timeline__item ${entry.urgency === 'stop' ? 'is-critical' : entry.urgency === 'clear' ? 'is-success' : ''}`}>
                  <div className="timeline__time">
                    {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>{entry.text}</p>
                </div>
              ))}
              {!log.length ? <p className="card__sub">No guidance yet — start a scan.</p> : null}
            </div>
          </Card>

          {!live ? (
            <div className="alert-banner" role="status">
              <AlertTriangle size={17} />
              <p style={{ flex: 1 }}>Reconnecting to the community channel. Local guidance keeps working.</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
