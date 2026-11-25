import React, { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';

/* Reveal on scroll ------------------------------------------------------- */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`reveal ${delay ? `reveal--d${delay}` : ''} ${seen ? 'in' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

/* Card ------------------------------------------------------------------ */
export function Card({ children, className = '', dark = false, hover = true, as: Tag = 'section', ...rest }) {
  return (
    <Tag
      className={`card ${dark ? 'card--dark' : ''} ${hover ? 'card--hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHead({ icon: Icon, title, sub, aside }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      {Icon ? (
        <div className="card__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.7} />
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>{title}</h3>
        {sub ? <p className="card__sub">{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/* Section heading ------------------------------------------------------- */
export function SectionHead({ eyebrow, title, sub, aside }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/* Buttons --------------------------------------------------------------- */
export function Button({
  children, variant = 'primary', size = '', className = '', as: Tag = 'button', onClick, ...rest
}) {
  const cls = [
    'btn',
    variant === 'ghost' ? 'btn--ghost' : '',
    variant === 'light' ? 'btn--light' : '',
    variant === 'danger' ? 'btn--danger' : '',
    size === 'sm' ? 'btn--sm' : '',
    size === 'lg' ? 'btn--lg' : '',
    size === 'icon' ? 'btn--icon' : '',
    className,
  ].filter(Boolean).join(' ');

  function handleClick(event) {
    const btn = event.currentTarget;
    if (getComputedStyle(document.documentElement).getPropertyValue('--reduced') !== '1') {
      const rect = btn.getBoundingClientRect();
      const span = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      span.className = 'ripple';
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${event.clientX - rect.left - size / 2}px`;
      span.style.top = `${event.clientY - rect.top - size / 2}px`;
      btn.appendChild(span);
      setTimeout(() => span.remove(), 700);
    }
    onClick?.(event);
  }

  return (
    <Tag className={cls} onClick={handleClick} {...rest}>
      {children}
    </Tag>
  );
}

/* Badges ---------------------------------------------------------------- */
const TONE_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export function SeverityBadge({ severity }) {
  const tone = TONE_LABEL[severity] ? severity : 'low';
  return (
    <span className={`badge badge--${tone}`}>
      <span aria-hidden="true">{tone === 'critical' ? '▲' : tone === 'high' ? '◆' : tone === 'medium' ? '●' : '■'}</span>
      {TONE_LABEL[tone]}
    </span>
  );
}

export function Pill({ children, className = '' }) {
  return <span className={`pill ${className}`}>{children}</span>;
}

/* Stats ----------------------------------------------------------------- */
export function Stat({ value, label, note }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
      {note ? <span className="stat__note">{note}</span> : null}
    </div>
  );
}

/* Switch ---------------------------------------------------------------- */
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

/* Slider ---------------------------------------------------------------- */
export function Slider({ value, min, max, step = 0.05, onChange, label, suffix = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span style={{ minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>
        {Number(value).toFixed(step < 0.1 ? 2 : 1)}{suffix}
      </span>
    </div>
  );
}

/* Sparkline ------------------------------------------------------------- */
export function Sparkline({ values = [], height = 96, label = 'Safety trend' }) {
  const width = 320;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * step, height - ((v - min) / span) * (height - 12) - 6]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A9C4FF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#A9C4FF" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path className="area" d={area} />
      <path className="line" d={line} />
      {pts.length ? <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" /> : null}
    </svg>
  );
}

/* Empty state ----------------------------------------------------------- */
export function Empty({ text, icon: Icon = Inbox }) {
  return (
    <div className="empty" style={{ textAlign: 'center', padding: '34px 16px', color: 'var(--ink-muted)' }}>
      <Icon size={26} strokeWidth={1.4} style={{ marginBottom: 10, opacity: 0.6 }} />
      <p style={{ margin: 0, fontSize: '0.85rem' }}>{text}</p>
    </div>
  );
}

/* Toast ----------------------------------------------------------------- */
export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ? `toast--${t.tone}` : ''}`} onClick={() => onDismiss(t.id)}>
          <span aria-hidden="true">{t.tone === 'critical' ? '▲' : t.tone === 'success' ? '✓' : '•'}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
