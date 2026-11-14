// Driving routes from an OSRM-compatible server, normalised into the shape nav.js expects.

import { cumulative, nearestOnLine } from './geo.js';

// OpenStreetMap Germany's public routing server (the one openstreetmap.org itself uses).
// Fair-use only: one request at a time, no bulk traffic. Swap this for your own server or a
// commercial provider before shipping to a large audience.
const ENDPOINT = 'https://routing.openstreetmap.de/routed-car/route/v1/driving';

export async function fetchRoute(from, to, { signal } = {}) {
  const pair = `${from[0].toFixed(6)},${from[1].toFixed(6)};${to[0].toFixed(6)},${to[1].toFixed(6)}`;
  const url = `${ENDPOINT}/${pair}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const body = await res.json();
  if (body.code !== 'Ok' || !body.routes?.length) throw new Error('No route found');
  return normaliseRoute(body.routes[0]);
}

/** Convert an OSRM route into { coords, cum, distance, duration, steps[] }. */
export function normaliseRoute(r) {
  const coords = r.geometry.coordinates;
  const cum = cumulative(coords);
  const steps = [];
  let search = 0;
  for (const leg of r.legs) {
    for (const st of leg.steps) {
      const m = st.maneuver;
      // Pin each manoeuvre to the route geometry so progress and steps share one measure.
      const hit = nearestOnLine(coords, m.location, search, coords.length - 2);
      const along = hit ? cum[hit.index] + (cum[hit.index + 1] - cum[hit.index]) * hit.t : 0;
      if (hit) search = hit.index;
      steps.push({
        type: m.type,
        modifier: m.modifier || '',
        exit: m.exit || 0,
        name: st.name || '',
        ref: st.ref || '',
        distance: st.distance,
        duration: st.duration,
        along,
        text: describe(m.type, m.modifier || '', st.name || st.ref || '', m.exit),
        icon: iconFor(m.type, m.modifier || ''),
      });
    }
  }
  return { coords, cum, distance: cum[cum.length - 1], duration: r.duration, steps };
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/** Plain-English instruction for an OSRM manoeuvre. */
export function describe(type, modifier, name, exit) {
  const onto = name ? ` onto ${name}` : '';
  const on = name ? ` on ${name}` : '';
  const side = modifier.includes('left') ? 'left' : modifier.includes('right') ? 'right' : '';
  switch (type) {
    case 'depart':
      return name ? `Head out on ${name}` : 'Head out';
    case 'arrive':
      return side ? `Your destination is on the ${side}` : 'You have arrived';
    case 'merge':
      return `Merge${side ? ` ${side}` : ''}${onto}`;
    case 'on ramp':
      return `Take the ramp${side ? ` on the ${side}` : ''}${onto}`;
    case 'off ramp':
      return `Take the exit${side ? ` on the ${side}` : ''}${onto}`;
    case 'fork':
      return `Keep ${side || 'straight'}${onto}`;
    case 'roundabout':
    case 'rotary':
      return exit && ORDINAL[exit] ? `At the roundabout, take the ${ORDINAL[exit]} exit${onto}` : `Enter the roundabout${onto}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    case 'new name':
      return `Continue${onto}`;
    case 'notification':
      return `Continue${on}`;
    default:
      break;
  }
  // turn, continue, end of road, roundabout turn
  if (modifier === 'uturn') return 'Make a U-turn';
  if (modifier === 'straight' || !modifier) return `Continue straight${on}`;
  const turn = modifier.startsWith('slight') ? `Bear ${side}` : modifier.startsWith('sharp') ? `Turn sharp ${side}` : `Turn ${side}`;
  return `${turn}${onto}`;
}

/** Arrow glyph key for the manoeuvre banner (see ARROWS in ui.js). */
export function iconFor(type, modifier) {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'straight';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (modifier === 'uturn') return 'uturn';
  if (modifier === 'straight' || !modifier) return 'straight';
  return modifier.replace(' ', '-'); // left, right, slight-left, sharp-right...
}
