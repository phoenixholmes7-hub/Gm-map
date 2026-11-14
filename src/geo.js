// Small geodesy helpers. Coordinates are [lng, lat] in degrees, distances in metres.

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversine(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial compass bearing from a to b, 0..360 (0 = north, 90 = east). */
export function bearing(a, b) {
  const p1 = rad(a[1]);
  const p2 = rad(b[1]);
  const dl = rad(b[0] - a[0]);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached by travelling `dist` metres from `p` on compass bearing `brg`. */
export function destination(p, brg, dist) {
  const d = dist / R;
  const b = rad(brg);
  const p1 = rad(p[1]);
  const l1 = rad(p[0]);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 =
    l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((deg(l2) + 540) % 360) - 180, deg(p2)];
}

/** Signed smallest difference b - a in degrees, -180..180. */
export function angleDiff(a, b) {
  return ((b - a + 540) % 360) - 180;
}

export function lerpAngle(a, b, t) {
  return (a + angleDiff(a, b) * t + 360) % 360;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Cumulative distance along a polyline; result[i] is the distance from the start to vertex i. */
export function cumulative(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversine(coords[i - 1], coords[i]);
  return cum;
}

/** Closest point to p on segment a-b (flat-earth approximation, fine at street scale). */
export function nearestOnSegment(p, a, b) {
  const k = Math.cos(rad(p[1]));
  const ax = (a[0] - p[0]) * k;
  const ay = a[1] - p[1];
  const bx = (b[0] - p[0]) * k;
  const by = b[1] - p[1];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, dist: haversine(p, point) };
}

/** Closest point on a polyline, searching segments [from, to] inclusive. */
export function nearestOnLine(coords, p, from = 0, to = coords.length - 2) {
  let best = null;
  const lo = Math.max(0, from);
  const hi = Math.min(coords.length - 2, to);
  for (let i = lo; i <= hi; i++) {
    const n = nearestOnSegment(p, coords[i], coords[i + 1]);
    if (!best || n.dist < best.dist) best = { index: i, t: n.t, point: n.point, dist: n.dist };
  }
  return best;
}

/** Point `d` metres along a polyline, with the segment index and its bearing. */
export function pointAlong(coords, cum, d) {
  const total = cum[cum.length - 1];
  const dist = Math.max(0, Math.min(total, d));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dist) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const t = seg > 0 ? (dist - cum[lo]) / seg : 0;
  const a = coords[lo];
  const b = coords[hi];
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    index: lo,
    bearing: bearing(a, b),
  };
}

export function bounds(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [[w, s], [e, n]];
}

// ---- formatting ---------------------------------------------------------------------------

const MI = 1609.344;
const FT = 0.3048;

/** Distance as a short display pair, e.g. { value: "0.4", unit: "mi" }. */
export function formatDistance(m, units = 'metric') {
  if (units === 'imperial') {
    const mi = m / MI;
    if (mi < 0.1) return { value: String(Math.max(50, Math.round(m / FT / 50) * 50)), unit: 'ft' };
    return { value: mi < 10 ? mi.toFixed(1) : String(Math.round(mi)), unit: 'mi' };
  }
  if (m < 1000) {
    const step = m < 100 ? 10 : 50;
    return { value: String(Math.max(step, Math.round(m / step) * step)), unit: 'm' };
  }
  const km = m / 1000;
  return { value: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'km' };
}

const SPOKEN = { ft: 'feet', mi: 'miles', m: 'meters', km: 'kilometers' };

export function spokenDistance(m, units = 'metric') {
  const { value, unit } = formatDistance(m, units);
  const word = value === '1' || value === '1.0' ? SPOKEN[unit].replace(/s$/, '') : SPOKEN[unit];
  return `${value.replace(/\.0$/, '')} ${word}`;
}

export function formatDuration(s) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Speed in m/s to a whole number in the display unit. */
export function formatSpeed(mps, units = 'metric') {
  const v = (mps || 0) * (units === 'imperial' ? 2.236936 : 3.6);
  return Math.round(v);
}
