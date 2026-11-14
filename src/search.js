// Place search using Photon (OpenStreetMap data, no API key, fair-use public server).

const ENDPOINT = 'https://photon.komoot.io';
const LANGS = ['en', 'de', 'fr'];

function lang() {
  const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(l) ? l : 'en';
}

function toPlace(f) {
  const p = f.properties || {};
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const name = p.name || street || p.city || p.county || p.state || p.country || 'Unnamed place';
  const detail = [p.name ? street : '', p.district, p.city !== name ? p.city : '', p.state, p.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  const [lng, lat] = f.geometry.coordinates;
  return { name, detail, lng, lat, kind: p.osm_value || p.type || '' };
}

/** "34.05, -118.24" style input is treated as a coordinate. */
export function parseLatLng(q) {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(q);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, detail: 'Coordinates', lng, lat, kind: 'coordinate' };
}

export async function searchPlaces(q, near, { signal } = {}) {
  const direct = parseLatLng(q);
  if (direct) return [direct];
  try {
    return await photonSearch(q, near, signal);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return nominatimSearch(q, near, signal); // second public geocoder if the first is down
  }
}

async function photonSearch(q, near, signal) {
  const params = new URLSearchParams({ q, limit: '7', lang: lang() });
  if (near) {
    params.set('lat', near[1].toFixed(4));
    params.set('lon', near[0].toFixed(4));
  }
  const res = await fetch(`${ENDPOINT}/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = await res.json();
  return (body.features || []).map(toPlace);
}

async function nominatimSearch(q, near, signal) {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '7', addressdetails: '0' });
  if (near) {
    // Prefer results within roughly 100 km without excluding the rest of the world.
    params.set('viewbox', [near[0] - 1, near[1] + 1, near[0] + 1, near[1] - 1].map((n) => n.toFixed(3)).join(','));
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const rows = await res.json();
  return rows.map((r) => {
    const [name, ...rest] = String(r.display_name || '').split(', ');
    return { name: r.name || name, detail: rest.slice(0, 3).join(', '), lng: Number(r.lon), lat: Number(r.lat), kind: r.type || '' };
  });
}

/** Name for a dropped pin; resolves to null if nothing is nearby. */
export async function reverseGeocode(lngLat, { signal } = {}) {
  const params = new URLSearchParams({ lat: lngLat[1].toFixed(6), lon: lngLat[0].toFixed(6), lang: lang() });
  const res = await fetch(`${ENDPOINT}/reverse?${params}`, { signal });
  if (!res.ok) return null;
  const body = await res.json();
  return body.features?.length ? toPlace(body.features[0]) : null;
}
