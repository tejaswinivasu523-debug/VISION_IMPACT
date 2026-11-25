import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Brain, Camera, Check, Cpu, Eye, Globe2, HeartHandshake, Map, MessageSquare,
  Mic, Radio, Route, ShieldCheck, Siren, Sparkles, Users,
} from 'lucide-react';
import { Card, CardHead, Reveal, SectionHead } from '../components/UI';
import { useSettings } from '../lib/settings';
import { speak } from '../lib/voice';

const STEPS = [
  { icon: Camera, title: 'Sense', text: 'The rear camera is sampled locally into a depth grid. Edge and luminance shifts reveal objects entering the walking corridor.' },
  { icon: Brain, title: 'Understand', text: 'Each detection gets a bearing, a distance band, a width and a confidence. Five candidate lanes are scored against all of them.' },
  { icon: Mic, title: 'Guide', text: 'The safest lane becomes a spoken instruction, re-evaluated every 220 ms. When the scene changes, the sentence changes with it.' },
  { icon: Radio, title: 'Share', text: 'Confirmed hazards are broadcast over WebSockets, so every nearby user and every route planner updates at the same moment.' },
];

const TEAM = [
  { name: 'Aparna Menon', role: 'Accessibility research', note: 'Ran walk-alongs with cane and guide-dog users across three cities.' },
  { name: 'Rohit Sethi', role: 'Computer vision', note: 'Built the on-device corridor model and distance estimation.' },
  { name: 'Zoya Khan', role: 'Product & interface', note: 'Owns the voice-first flows and the palette-driven design system.' },
  { name: 'Ishaan Rao', role: 'Realtime systems', note: 'Designed the WebSocket hazard mesh and SOS broadcast protocol.' },
];

const STACK = [
  'React + Vite', 'WebSockets (ws)', 'Web Speech API', 'Canvas vision pass',
  'Leaflet + OpenStreetMap', 'Lucide icons', 'CSS design tokens', 'Node realtime server',
];

export default function About() {
  const { settings } = useSettings();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('send failed');
      setStatus('sent');
      speak('Message sent. Thank you for helping make navigation safer.', { force: true, priority: 'high' });
      setForm({ name: '', email: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <Reveal>
        <section className="hero" style={{ marginBottom: 40 }}>
          <span className="eyebrow" style={{ color: 'var(--pink)' }}>About the project</span>
          <h1 style={{ maxWidth: '24ch' }}>Safer movement should be a <em>shared</em> infrastructure.</h1>
          <p style={{ maxWidth: '58ch' }}>
            VisionPath began with a simple observation from a walk-along in Bengaluru: every navigation app
            tells you where to go, and almost none tells you what is in the way. We built the missing layer —
            live environmental awareness, continuous correction, and a community that keeps the map honest.
          </p>
          <div className="hero__actions">
            <Link to="/scan" className="btn btn--light"><Camera size={17} /> Try the scanner</Link>
            <Link to="/community" className="btn btn--ghost" style={{ color: 'var(--creme)', borderColor: 'rgba(237,243,255,.4)' }}>
              <Map size={17} /> See the live map
            </Link>
          </div>
        </section>
      </Reveal>

      <section className="section" aria-label="Problem and solution">
        <div className="grid grid--2">
          <Reveal>
            <Card>
              <CardHead icon={Eye} title="The problem" sub="Directions without awareness" />
              <p>
                A cane detects what it touches. Audio navigation announces turns metres too late. Between those
                two truths sits the part of walking that causes falls: a knee-high barrier, a parked van on the
                tactile strip, a crossing whose beeper has failed.
              </p>
              <p style={{ marginBottom: 0 }}>
                Existing systems are static: an obstacle map refreshed monthly, a route scored once. For someone
                navigating a city alone, the world changes hour by hour.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={1}>
            <Card>
              <CardHead icon={Sparkles} title="Our approach" sub="A loop, not a lookup" />
              <p>
                VisionPath treats navigation as a continuous loop: sense the corridor, plan the safest line,
                speak it, then sense again. Guidance is never a single instruction — it is a running correction.
              </p>
              <p style={{ marginBottom: 0 }}>
                Everything learned is shared over a realtime channel, so one person's report becomes everyone's
                advance warning, and a guardian can follow along from another city.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="How it works" title="Four steps, running the whole time" sub="No round trip to a server for guidance: the decision is made on the device, in the browser, in real time." />
        <div className="grid grid--4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i + 1}>
              <Card style={{ height: '100%' }}>
                <div className="step-num">0{i + 1}</div>
                <div className="card__title" style={{ marginTop: 10 }}>
                  <div className="card__icon"><step.icon size={18} strokeWidth={1.7} /></div>
                  <h3 style={{ fontSize: '1.3rem' }}>{step.title}</h3>
                </div>
                <p className="card__sub" style={{ fontSize: '0.83rem' }}>{step.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="Architecture" title="Realtime by default" sub="Every collaborative feature runs over one WebSocket session with reconnection, presence and authoritative server state." />
        <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <Reveal>
            <Card>
              <CardHead icon={Radio} title="What travels on the live channel" />
              <div className="grid grid--2" style={{ gap: 14 }}>
                {[
                  { icon: Map, title: 'Hazard reports', text: 'Create, verify, upvote and clear — broadcast to everyone.' },
                  { icon: Siren, title: 'SOS broadcasts', text: 'Location plus responder acknowledgements, every 1.5 s.' },
                  { icon: Route, title: 'Shared routes', text: 'Route selections and re-scores against fresh hazards.' },
                  { icon: Users, title: 'Presence', text: 'Who is nearby, walking, or volunteering.' },
                  { icon: Globe2, title: 'Signal phases', text: 'Crossing countdowns ticked by the server clock.' },
                  { icon: HeartHandshake, title: 'Guardian trips', text: 'Read-only live trip sharing by short code.' },
                ].map((item) => (
                  <div key={item.title}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <item.icon size={15} strokeWidth={1.8} />
                      <strong style={{ fontSize: '0.86rem' }}>{item.title}</strong>
                    </div>
                    <p className="card__sub" style={{ fontSize: '0.78rem', margin: 0 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={1}>
            <Card>
              <CardHead icon={Cpu} title="Stack" sub="Small, fast, and deployable" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STACK.map((tech) => <span key={tech} className="tech-chip">{tech}</span>)}
              </div>
              <p style={{ marginTop: 16, fontSize: '0.85rem' }}>
                Frames never leave the device: the vision pass runs in a hidden canvas. Only hazard summaries,
                positions you choose to share and SOS beacons touch the network.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                {['Runs offline for local guidance', 'Reconnects automatically to the mesh', 'No API keys required to start'].map((line) => (
                  <span key={line} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.83rem' }}>
                    <Check size={14} color="var(--success)" /> {line}
                  </span>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="Impact" title="What we are designing for" sub="Figures from WHO and accessibility research; our own pilot metrics are early." />
        <div className="grid grid--4">
          {[
            { v: '250M', l: 'people live with significant vision impairment' },
            { v: '1 in 3', l: 'people over 65 fall each year' },
            { v: '220ms', l: 'guidance re-plan interval in the browser' },
            { v: '0', l: 'camera frames uploaded to a server' },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i}>
              <Card>
                <span className="stat__value" style={{ fontSize: '2.2rem' }}>{s.v}</span>
                <span className="stat__label" style={{ marginTop: 6, display: 'block' }}>{s.l}</span>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead eyebrow="The team" title="Built with users, not just for them" />
        <div className="grid grid--4">
          {TEAM.map((person, i) => (
            <Reveal key={person.name} delay={i}>
              <Card className="team-card">
                <div className="team-avatar" aria-hidden="true">{person.name.split(' ').map((n) => n[0]).join('')}</div>
                <h4>{person.name}</h4>
                <span className="eyebrow" style={{ margin: '6px 0 8px', fontSize: '0.62rem' }}>{person.role}</span>
                <p className="card__sub" style={{ fontSize: '0.8rem' }}>{person.note}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1.1fr', alignItems: 'start' }}>
          <Card dark>
            <CardHead icon={ShieldCheck} title="Accessibility statement" sub="The product must clear its own bar" />
            <p style={{ color: 'rgba(237,243,255,.8)', fontSize: '0.87rem' }}>
              VisionPath targets WCAG 2.2 AA, with AAA body contrast on the creme palette. Status is always paired
              with a shape, icon and text label. Every interactive control is keyboard reachable with a visible
              burgundy focus ring and a minimum 48 px target.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pill">Landmarks &amp; headings</span>
              <span className="pill">aria-live alerts</span>
              <span className="pill">Reduced motion</span>
              <span className="pill">Voice-first</span>
            </div>
          </Card>

          <Card>
            <CardHead icon={MessageSquare} title="Talk to the team" sub="Feedback, partnership or a pilot request" />
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="contact-name">Your name</label>
                <input id="contact-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name or organisation" required />
              </div>
              <div className="field">
                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
              </div>
              <div className="field">
                <label htmlFor="contact-message">Message</label>
                <textarea id="contact-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about the environment you need to navigate, or how you would like to collaborate." required />
              </div>
              <button type="submit" className="btn" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Message sent' : 'Send message'} <ArrowRight size={16} />
              </button>
              {status === 'sent' ? <p className="hint" style={{ color: 'var(--success)' }}>Thank you — the team has your message.</p> : null}
              {status === 'invalid' ? <p className="hint" style={{ color: 'var(--critical)' }}>Please complete all three fields.</p> : null}
              {status === 'error' ? <p className="hint" style={{ color: 'var(--critical)' }}>The message could not be sent. Check the connection and try again.</p> : null}
            </form>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="grid grid--3">
          {[
            { icon: Camera, label: 'Try live scanning', to: '/scan' },
            { icon: Siren, label: 'Set up emergency SOS', to: '/sos' },
            { icon: Users, label: 'Join the community map', to: '/community' },
          ].map((item) => (
            <Card key={item.label}>
              <div className="card__title">
                <div className="card__icon"><item.icon size={18} /></div>
                <h3 style={{ fontSize: '1.25rem' }}>{item.label}</h3>
              </div>
              <Link to={item.to} className="btn btn--ghost btn--sm">Open <ArrowRight size={14} /></Link>
            </Card>
          ))}
        </div>
      </section>
      <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', maxWidth: '70ch' }}>
        VisionPath is an assistive prototype. It does not replace a cane, a guide dog, or professional orientation
        training. Voice language availability depends on the voices installed on your device.
      </p>
    </>
  );
}
