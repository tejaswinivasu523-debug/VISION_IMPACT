/** Geo helpers, route synthesis and distance maths. */

export const DEMO_ORIGIN = { lat: 12.9719, lng: 77.5946 };

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '—';
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} m`;
}

export function offsetPoint(point, northMeters, eastMeters) {
  return {
    lat: point.lat + northMeters / 111320,
    lng: point.lng + eastMeters / (111320 * Math.cos(toRad(point.lat))),
  };
}

function segDistance(p, a, b) {
  // equirectangular projection is accurate enough at footpath scale
  const x = p.lng * Math.cos(toRad(p.lat));
  const ax = a.lng * Math.cos(toRad(a.lat));
  const bx = b.lng * Math.cos(toRad(b.lat));
  const vx = bx - ax;
  const vy = b.lat - a.lat;
  const wx = x - ax;
  const wy = p.lat - a.lat;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len));
  const dx = wx - vx * t;
  const dy = wy - vy * t;
  return Math.sqrt(dx * dx + dy * dy) * 111320;
}

export function distanceToPath(point, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    best = Math.min(best, segDistance(point, path[i - 1], path[i]));
  }
  return best;
}

function curve(a, b, bend, steps = 22) {
  const points = [];
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const control = { lat: mid.lat + dx * bend * 0.6, lng: mid.lng - dy * bend * 1.6 };
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * control.lng + t ** 2 * b.lng;
    const y = (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * control.lat + t ** 2 * b.lat;
    points.push({ lat: y, lng: x });
  }
  return points;
}

/** Nudge points away from hazards so the "safest" line is visibly different. */
function avoidHazards(points, hazards, strength = 0.00018) {
  return points.map((p, index) => {
    if (index === 0 || index === points.length - 1) return p;
    let shiftLat = 0;
    let shiftLng = 0;
    for (const h of hazards) {
      if (h.status === 'resolved') continue;
      const d = haversine(p, h);
      if (d > 70) continue;
      const weight = (1 - d / 70) * strength;
      const dLat = p.lat - h.lat;
      const dLng = p.lng - h.lng;
      const len = Math.hypot(dLat, dLng) || 1e-9;
      shiftLat += (dLat / len) * weight;
      shiftLng += (dLng / len) * weight;
    }
    return { lat: p.lat + shiftLat, lng: p.lng + shiftLng };
  });
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversine(points[i - 1], points[i]);
  return total;
}

export function buildRoutes(origin, destination, hazards = []) {
  const open = hazards.filter((h) => h.status !== 'resolved');

  const base = curve(origin, destination, 0.12);
  const safe = avoidHazards(curve(origin, destination, -0.24), open, 0.00026);
  const accessible = avoidHazards(curve(origin, destination, 0.3), open, 0.00014);

  const make = (id, name, description, points, opts) => {
    const distance = pathLength(points);
    const nearby = open.filter((h) => distanceToPath(h, points) < 32);
    const penalty = nearby.reduce(
      (sum, h) => sum + ({ low: 2, medium: 5, high: 9, critical: 14 }[h.severity] || 4),
      0,
    );
    const surface = Math.round(opts.surface - Math.min(12, nearby.length * 1.5));
    const safety = Math.max(48, Math.min(99, Math.round(opts.safetyBase - penalty)));
    const pace = opts.pace; // metres per minute, blind-safe walking pace
    return {
      id,
      name,
      description,
      latlngs: points,
      distance,
      duration: distance / pace,
      obstacleCount: nearby.length,
      crossings: opts.crossings,
      surface,
      safety,
      pace,
      hazards: nearby,
      recommended: false,
    };
  };

  const routes = [
    make('fastest', 'Fastest', 'Direct line. Shortest walk, busier junctions.', base, {
      pace: 74, crossings: 4, surface: 78, safetyBase: 97,
    }),
    make('safest', 'Safest', 'Detours around live hazards and busy kerbs.', safe, {
      pace: 68, crossings: 2, surface: 90, safetyBase: 99,
    }),
    make('accessible', 'Most accessible', 'Level paving, tactile edges, two signal crossings.', accessible, {
      pace: 64, crossings: 2, surface: 95, safetyBase: 98,
    }),
  ];
  const best = routes.reduce((a, b) => (b.safety > a.safety ? b : a), routes[0]);
  best.recommended = true;
  return routes;
}

export const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

export function severityTone(severity) {
  return ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'low';
}

export function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export function clockTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}
