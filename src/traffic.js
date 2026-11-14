// Ambient drivers: a few computer-controlled cars that wander the streets around you for
// atmosphere, like other players on a game map. They are decoration only. Nothing here is
// real traffic, and no data about anyone is sent or received.

import { haversine, bearing, cumulative, pointAlong, angleDiff } from './geo.js';

const ROAD_LAYERS = ['road-minor', 'road-mid', 'road-major'];
const COLORS = ['#4fc3f7', '#ff8a65', '#81c784', '#ba68c8', '#fff176', '#f06292', '#4dd0e1'];
const FIRST = ['Turbo', 'Night', 'Lucky', 'Ghost', 'Rapid', 'Dusty', 'Chrome', 'Rogue', 'Vapor', 'Solar', 'Midnight', 'Copper'];
const SECOND = ['Fox', 'Rider', 'Wolf', 'Drift', 'Hawk', 'Comet', 'Bandit', 'Pilot', 'Nomad', 'Racer', 'Otter', 'Falcon'];

const MAX_ALIVE = 3;
const MIN_ZOOM = 13.5;
const JOIN_M = 14; // road pieces whose ends are this close count as connected

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.random() * (b - a);

/** Flatten rendered road features into plain polylines with a length and a road class. */
export function collectLines(features, limit = 500) {
  const lines = [];
  for (const f of features) {
    const g = f.geometry;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const coords of parts) {
      if (coords.length < 2) continue;
      const length = cumulative(coords).at(-1);
      if (length >= 25) lines.push({ coords, length, cls: f.properties?.class || 'minor' });
    }
  }
  // Dense cities return thousands of pieces; a random sample is plenty to drive on.
  while (lines.length > limit) lines.splice(Math.floor(Math.random() * lines.length), 1);
  return lines;
}

/**
 * Stitch a drivable path out of road pieces: start somewhere, then keep hopping to a piece
 * that begins where the last one ended, preferring the gentlest turn.
 */
export function buildPath(lines, { target = 1200, random = Math.random, canStart = () => true } = {}) {
  if (!lines.length) return null;
  const long = lines.filter((l) => l.length >= 80);
  const preferred = long.filter(canStart);
  const starts = preferred.length ? preferred : long;
  const first = (starts.length ? starts : lines)[Math.floor(random() * (starts.length || lines.length))];
  const used = new Set([first]);
  let coords = random() < 0.5 ? first.coords.slice() : first.coords.slice().reverse();
  let total = first.length;
  const cls = first.cls;

  while (total < target) {
    const end = coords.at(-1);
    const heading = bearing(coords.at(-2), end);
    let best = null;
    for (const line of lines) {
      if (used.has(line)) continue;
      for (const flip of [false, true]) {
        const a = flip ? line.coords.at(-1) : line.coords[0];
        if (haversine(end, a) > JOIN_M) continue;
        const b = flip ? line.coords.at(-2) : line.coords[1];
        const turn = Math.abs(angleDiff(heading, bearing(a, b)));
        if (turn < 115 && (!best || turn < best.turn)) best = { line, flip, turn };
      }
    }
    if (!best) break;
    used.add(best.line);
    const next = best.flip ? best.line.coords.slice().reverse() : best.line.coords;
    coords = coords.concat(next.slice(1));
    total += best.line.length;
  }
  return total >= 120 ? { coords, cum: cumulative(coords), length: total, cls } : null;
}

const cruise = (cls) => (cls === 'primary' || cls === 'trunk' ? between(12, 17) : cls === 'secondary' || cls === 'tertiary' ? between(9, 14) : between(6, 10));

export class AmbientDrivers {
  #map;
  #Marker;
  #getPlayer;
  #drivers = [];
  #enabled = true;
  #nextSpawn = 0;
  #last = 0;

  constructor(map, Marker, { getPlayer }) {
    this.#map = map;
    this.#Marker = Marker;
    this.#getPlayer = getPlayer;
  }

  get count() {
    return this.#drivers.length;
  }

  setEnabled(on) {
    this.#enabled = !!on;
    if (!on) this.clear();
  }

  clear() {
    for (const d of this.#drivers) d.marker.remove();
    this.#drivers = [];
  }

  /** Put one driver on the map right away (also used by the automated checks). */
  spawn() {
    const map = this.#map;
    if (!this.#enabled || map.getZoom() < MIN_ZOOM || !map.isStyleLoaded()) return false;
    const layers = ROAD_LAYERS.filter((id) => map.getLayer(id));
    if (!layers.length) return false;
    // Start on a road that is actually on screen so the new car is seen arriving.
    const box = map.getContainer();
    const onScreen = (line) => line.coords.some((c) => {
      const p = map.project(c);
      return p.x > 0 && p.y > 0 && p.x < box.clientWidth && p.y < box.clientHeight;
    });
    const path = buildPath(collectLines(map.queryRenderedFeatures({ layers })), { canStart: onScreen });
    if (!path) return false;
    const player = this.#getPlayer();
    if (player && haversine(player, path.coords[0]) < 60) return false;

    const el = document.createElement('div');
    el.className = 'driver';
    el.style.setProperty('--c', pick(COLORS));
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20.5 21 12 16.5 3.5 21z"/></svg><span></span>';
    el.querySelector('span').textContent = `${pick(FIRST)}${pick(SECOND)}${Math.floor(between(10, 99))}`;
    const marker = new this.#Marker({ element: el }).setLngLat(path.coords[0]).addTo(map);
    requestAnimationFrame(() => el.classList.add('on'));
    this.#drivers.push({ el, arrow: el.firstChild, marker, path, along: 0, speed: cruise(path.cls), heading: bearing(path.coords[0], path.coords[1]), born: performance.now(), offSince: 0, leaving: false });
    return true;
  }

  #retire(d) {
    if (d.leaving) return;
    d.leaving = true;
    d.el.classList.remove('on');
    setTimeout(() => {
      d.marker.remove();
      this.#drivers = this.#drivers.filter((x) => x !== d);
    }, 700);
  }

  /** Advance every driver; call once per animation frame. */
  tick(now) {
    const dt = Math.min(0.25, (now - (this.#last || now)) / 1000);
    this.#last = now;
    if (!this.#enabled) return;
    const map = this.#map;

    if (now >= this.#nextSpawn && this.#drivers.length < MAX_ALIVE) {
      // "Every once in a while": a new car somewhere between 10 and 40 seconds apart.
      this.#nextSpawn = now + between(10000, 40000);
      this.spawn();
    }

    const box = map.getContainer();
    const mapBearing = map.getBearing();
    for (const d of this.#drivers) {
      if (d.leaving) continue;
      d.along += d.speed * dt;
      if (d.along >= d.path.length || now - d.born > 150000 || map.getZoom() < MIN_ZOOM - 1) {
        this.#retire(d);
        continue;
      }
      const at = pointAlong(d.path.coords, d.path.cum, d.along);
      d.heading = (d.heading + angleDiff(d.heading, at.bearing) * Math.min(1, dt * 6) + 360) % 360;
      d.marker.setLngLat(at.point);
      d.arrow.style.transform = `rotate(${(d.heading - mapBearing).toFixed(1)}deg)`;

      // Drop cars that have been well off screen for a while so new ones can appear nearby.
      const p = map.project(at.point);
      const off = p.x < -250 || p.y < -250 || p.x > box.clientWidth + 250 || p.y > box.clientHeight + 250;
      if (!off) d.offSince = 0;
      else if (!d.offSince) d.offSince = now;
      else if (now - d.offSince > 6000) this.#retire(d);
    }
  }
}
