import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TONE_COLOR = {
  low: '#7ED9B4',
  medium: '#F0C36B',
  high: '#F0708F',
  critical: '#D62B63',
  brand: '#5B4BFF',
  soft: '#A9C4FF',
  success: '#7ED9B4',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function dotIcon(tone, text) {
  const color = TONE_COLOR[tone] || TONE_COLOR.brand;
  return L.divIcon({
    className: '',
    html: `<div class="map-marker" style="background:${color}">${escapeHtml(text ?? '')}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function youIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px">
      <div style="position:absolute;inset:0;border-radius:50%;background:#5B4BFF;border:3px solid #fff;box-shadow:0 0 0 3px rgba(91,75,255,.45);z-index:2"></div>
      <div style="position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(157,140,255,.65);animation:radarPulse 2.4s ease-out infinite"></div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Imperative Leaflet map. Markers and routes are re-rendered when their props
 * change; the map instance itself is created once per mount.
 */
export default function MapView({
  center = [12.9719, 77.5946],
  zoom = 15,
  markers = [],
  routes = [],
  you = null,
  height = 420,
  tall = false,
  onPick = null,
  interactive = true,
  className = '',
}) {
  const mapRef = React.useRef(null);
  const mapObj = React.useRef(null);
  const layerRef = React.useRef(null);
  const youRef = React.useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return undefined;
    const map = L.map(mapRef.current, {
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive ? 'center' : false,
      doubleClickZoom: interactive,
    }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapObj.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    if (onPick) {
      map.on('click', (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    return () => {
      map.remove();
      mapObj.current = null;
      layerRef.current = null;
      youRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapObj.current;
    if (!map) return;
    map.setView(center, zoom, { animate: false });
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    routes.forEach((route) => {
      if (!route?.latlngs?.length) return;
      L.polyline(
        route.latlngs.map((p) => [p.lat, p.lng]),
        {
          color: route.color || '#A9C4FF',
          weight: route.weight || 5,
          opacity: route.opacity ?? 0.85,
          dashArray: route.dashed ? '8 8' : undefined,
          lineCap: 'round',
        },
      )
        .addTo(group)
        .bindTooltip(escapeHtml(route.name || 'Route'), { sticky: true });
    });

    markers.forEach((m) => {
      if (!m || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;
      const marker = L.marker([m.lat, m.lng], {
        icon: dotIcon(m.tone, m.badge),
        keyboard: true,
        title: m.label,
      }).addTo(group);
      const popup = `
        <div style="min-width:180px">
          <strong style="font-family:Cormorant Garamond,serif;font-size:1.05rem">${escapeHtml(m.label)}</strong>
          ${m.meta ? `<div style="font-size:.76rem;opacity:.75;margin-top:3px">${escapeHtml(m.meta)}</div>` : ''}
          ${m.action ? `<div style="margin-top:8px;font-size:.74rem;color:#A9C4FF">${escapeHtml(m.action)}</div>` : ''}
        </div>`;
      marker.bindPopup(popup);
      marker.on('click', () => m.onClick?.());
    });

    if (you) {
      if (youRef.current) {
        youRef.current.setLatLng([you.lat, you.lng]);
      } else {
        youRef.current = L.marker([you.lat, you.lng], { icon: youIcon(), zIndexOffset: 1000 })
          .addTo(group)
          .bindPopup('<strong>You are here</strong><div style="font-size:.76rem;opacity:.75">Live position</div>');
      }
    }
  }, [markers, routes, you]);

  return (
    <div className={`map-wrap ${className}`}>
      <div ref={mapRef} className={`map ${tall ? 'map--tall' : ''}`} style={{ height }} role="application" aria-label="Map of hazards and accessible routes" />
      <div className="map__legend" aria-hidden="true">
        <span><i className="legend-dot" style={{ background: TONE_COLOR.low }} />Low</span>
        <span><i className="legend-dot" style={{ background: TONE_COLOR.medium }} />Medium</span>
        <span><i className="legend-dot" style={{ background: TONE_COLOR.high }} />High</span>
        <span><i className="legend-dot" style={{ background: TONE_COLOR.critical }} />Critical</span>
      </div>
    </div>
  );
}
