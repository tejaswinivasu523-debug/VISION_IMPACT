import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, Bell, BookOpen, Camera, ChevronLeft, ChevronRight,
  Eye, Footprints, Home, LifeBuoy, Map as MapIcon, MapPin, Menu, Mic, MicOff,
  Navigation, Radar, Settings as SettingsIcon, ShieldCheck, Siren, Sparkles, Users, X,
} from 'lucide-react';
import { useRealtime } from '../lib/realtime';
import { useSettings } from '../lib/settings';
import { useLiveScan } from '../lib/live';
import { speak } from '../lib/voice';
import { timeAgo } from '../lib/geo';

export function Cursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf;
    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const target = e.target;
      const active = target?.closest?.('a, button, input, select, textarea, [role="button"], [role="switch"]');
      ring.current?.classList.toggle('is-active', Boolean(active));
    };
    const tick = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}

/* ================================================================ navbar */
const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/scan', label: 'Live Scan' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/routes', label: 'Routes' },
  { to: '/community', label: 'Community' },
];

const MORE_NAV = [
  { to: '/report', label: 'Report a hazard', icon: AlertTriangle },
  { to: '/indoor', label: 'Indoor navigation', icon: Navigation },
  { to: '/crossing', label: 'Crossing assistant', icon: Footprints },
  { to: '/journey', label: 'Journey monitoring', icon: Activity },
  { to: '/settings', label: 'Accessibility', icon: SettingsIcon },
  { to: '/about', label: 'About VisionPath', icon: BookOpen },
];

export function Navbar() {
  const { live, peers, sos, status } = useRealtime();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const nearby = peers.filter((p) => p.simulated || !p.self).length;

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link to="/" className="brand" aria-label="VisionPath home">
          <span className="brand__mark" aria-hidden="true">
            <Eye size={21} strokeWidth={1.6} />
          </span>
          <span>
            <span className="brand__name">VisionPath</span>
            <span className="brand__tag" style={{ display: 'block' }}>Navigate with confidence</span>
          </span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav__link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__right">
          <span
            className={`conn ${live ? 'is-live' : status === 'connecting' ? '' : 'is-down'}`}
            role="status"
            aria-live="polite"
          >
            <span className="conn__dot" aria-hidden="true" />
            <span className="label">{live ? 'Live' : status === 'connecting' ? 'Linking' : 'Reconnecting'}</span>
            <span aria-hidden="true" style={{ opacity: 0.65 }}>·</span>
            <span className="label">{nearby} nearby</span>
          </span>

          <div className="nav__more" ref={menuRef}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-expanded={open}
              aria-haspopup="true"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={16} /> : <Menu size={16} />} <span className="label">Menu</span>
            </button>
            {open ? (
              <div className="menu" role="menu">
                {MORE_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className={({ isActive }) => `menu__item ${isActive ? 'active' : ''}`}
                  >
                    <item.icon size={16} strokeWidth={1.7} /> {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>

          <Link to="/sos" className={`btn btn--sm ${sos ? 'btn--danger' : ''}`} aria-label="Open emergency SOS">
            <Siren size={16} /> SOS
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ==================================================== floating live panel */
export function FloatingDock() {
  const { plan, scene } = useLiveScan();
  const { hazards, peers, sos, events, live, status, journey } = useRealtime();
  const { settings, update } = useSettings();
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('visionpath:dock');
    if (stored) return stored === 'collapsed';
    // On phones keep the panel as a small bubble so it never covers the page.
    return window.innerWidth < 720;
  });

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('visionpath:dock', v ? 'expanded' : 'collapsed');
      return !v;
    });
  };

  const openHazards = hazards.filter((h) => h.status !== 'resolved');
  const criticalCount = openHazards.filter((h) => h.severity === 'critical').length;
  const safety = journey?.safety ?? Math.max(45, 98 - criticalCount * 7 - openHazards.filter((h) => h.severity === 'high').length * 3);
  const guidance = sos
    ? `Emergency active. ${sos.by} needs help near ${sos.lat.toFixed(4)}, ${sos.lng.toFixed(4)}.`
    : plan?.instruction
      || (scene.active
        ? 'Scanning your path… hold steady.'
        : 'Ready when you are. Start a live scan to begin guidance.');
  const urgent = Boolean(sos) || plan?.urgency === 'stop';

  const toggleVoice = () => {
    update({ voice: !settings.voice });
    if (!settings.voice) speak('Voice guidance on.', { force: true, priority: 'high' });
  };

  return (
    <aside
      className={`dock ${collapsed ? 'dock--collapsed' : ''} ${live ? '' : 'is-down'}`}
      aria-label="Live guidance panel"
    >
      <div className="dock__head">
        <span className="dock__pulse" aria-hidden="true" style={sos ? { background: '#F0708F' } : undefined} />
        {!collapsed ? <span className="dock__title">{sos ? 'Emergency live' : 'Live guidance'}</span> : null}
        <button
          type="button"
          className="dock__collapse"
          onClick={toggle}
          aria-label={collapsed ? 'Expand live guidance panel' : 'Collapse live guidance panel'}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      <div className="dock__body">
        <div className={`dock__guidance ${urgent ? 'is-alert' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="k">{sos ? 'Emergency broadcast' : 'Guiding you now'}</span>
          <p>{guidance}</p>
        </div>

        <div className="dock__stats">
          <div className="dock__stat">
            <strong>{openHazards.length}</strong>
            <span>Hazards</span>
          </div>
          <div className="dock__stat">
            <strong>{safety}</strong>
            <span>Safety</span>
          </div>
          <div className="dock__stat">
            <strong>{peers.length}</strong>
            <span>Nearby</span>
          </div>
        </div>

        {sos ? (
          <div className="dock__feed-item sev-critical" style={{ marginBottom: 8 }}>
            <Siren size={14} aria-hidden="true" />
            <span>
              <b>SOS from {sos.by}</b>
              <br />
              {sos.acks.length} responder{sos.acks.length === 1 ? '' : 's'} acknowledged ·{' '}
              {new Date(sos.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : null}

        <div className="dock__feed" aria-live="polite">
          {events.slice(0, 3).map((e) => (
            <div key={e.id} className={`dock__feed-item sev-${e.severity || 'low'}`}>
              <span style={{ flex: 1 }}>
                <b>{e.title}</b>
                <br />
                {e.detail}
              </span>
            </div>
          ))}
          {!events.length ? (
            <div className="dock__feed-item">
              <Radar size={14} aria-hidden="true" />
              <span>Realtime channel connected. Community reports appear here the moment they land.</span>
            </div>
          ) : null}
        </div>

        <div className="dock__actions">
          <Link to="/sos" className="dock__sos">
            <LifeBuoy size={15} /> SOS
          </Link>
          <Link to={scene.active ? '/scan' : '/scan'} className="dock__link">
            <Camera size={15} /> {scene.active ? 'Scan view' : 'Start scan'}
          </Link>
          <button
            type="button"
            className="dock__link"
            style={{ flex: '0 0 46px', padding: 0 }}
            onClick={toggleVoice}
            aria-label={settings.voice ? 'Mute voice guidance' : 'Unmute voice guidance'}
            title={settings.voice ? 'Mute voice' : 'Unmute voice'}
          >
            {settings.voice ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
        </div>

        <p style={{ margin: '10px 0 0', fontSize: '0.66rem', color: 'rgba(237,243,255,.5)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={`dot-live`} style={{ background: live ? '#7ED9B4' : '#F0708F' }} aria-hidden="true" />
          {live ? `Synced ${timeAgo(Date.now() - 1)} · ${status}` : 'Reconnecting to live channel…'}
        </p>
      </div>
    </aside>
  );
}

/* =============================================================== tab bar */
export function TabBar() {
  const items = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/scan', label: 'Scan', icon: Camera },
    { to: '/community', label: 'Map', icon: MapPin },
    { to: '/routes', label: 'Routes', icon: Navigation },
    { to: '/sos', label: 'SOS', icon: Siren },
  ];
  return (
    <nav className="tabbar" aria-label="Mobile navigation">
      <div className="tabbar__inner">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <item.icon size={19} strokeWidth={1.8} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ================================================================= footer */
export function Footer() {
  const { live, peers } = useRealtime();
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <div className="brand" style={{ marginBottom: 12 }}>
            <span className="brand__mark" aria-hidden="true"><Eye size={20} strokeWidth={1.6} /></span>
            <span className="brand__name" style={{ color: 'var(--creme)' }}>VisionPath</span>
          </div>
          <p style={{ maxWidth: '36ch' }}>
            A realtime navigation companion for blind and low-vision people — obstacle awareness,
            continuous safe-path guidance and community-verified hazard data.
          </p>
          <span className="pill" style={{ marginTop: 6 }}>
            <span className="dot-live" style={{ background: live ? '#7ED9B4' : '#F0708F' }} /> {live ? 'Live channel active' : 'Offline'} · {peers.length} in the network
          </span>
        </div>
        <div>
          <h4>Navigate</h4>
          <Link to="/scan">Live scanning</Link>
          <Link to="/routes">Smart routes</Link>
          <Link to="/indoor">Indoor navigation</Link>
          <Link to="/crossing">Crossing assistant</Link>
          <Link to="/journey">Journey monitoring</Link>
        </div>
        <div>
          <h4>Community</h4>
          <Link to="/report">Report a hazard</Link>
          <Link to="/community">Community map</Link>
          <Link to="/alerts">Alert settings</Link>
          <Link to="/guardian">Guardian view</Link>
          <Link to="/sos">Emergency SOS</Link>
        </div>
        <div>
          <h4>Product</h4>
          <Link to="/about">About the project</Link>
          <Link to="/settings">Accessibility</Link>
          <Link to="/about">Technology</Link>
          <Link to="/about">Contact the team</Link>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} VisionPath · Assistive technology, built accessible first.</span>
        <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span><ShieldCheck size={13} style={{ verticalAlign: '-2px' }} /> Frames never leave your device</span>
          <span><Users size={13} style={{ verticalAlign: '-2px' }} /> Community network</span>
          <span><Sparkles size={13} style={{ verticalAlign: '-2px' }} /> WCAG AA+</span>
        </span>
      </div>
    </footer>
  );
}

/* tiny helper used by other pages for consistent CTA rows */
export function InlineLink({ to, children }) {
  return (
    <Link to={to} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#E4EDFF' }}>
      {children} <ArrowRight size={15} />
    </Link>
  );
}

export { Bell as BellIcon };
