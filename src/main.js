// App controller: owns the map, the player marker and camera, and the navigation state.

import * as maplibregl from '../vendor/maplibre/maplibre-gl.mjs';
import { getTheme, DEFAULT_THEME } from './themes.js';
import { buildStyle, ROUTE_SOURCE } from './mapstyle.js';
import { parseBlipId, renderBlip, BLIP_PIXEL_RATIO } from './icons.js';
import { GpsTracker, RouteSimulator } from './location.js';
import { fetchRoute } from './routing.js';
import { searchPlaces, reverseGeocode } from './search.js';
import { NavSession } from './nav.js';
import { haversine, destination, lerp, lerpAngle, angleDiff, bounds } from './geo.js';
import * as platform from './platform.js';
import { playCue, setSoundEnabled, unlockAudio } from './sound.js';
import { AmbientDrivers } from './traffic.js';
import * as ui from './ui.js';

const { el } = ui;
const root = document.documentElement;
const params = new URLSearchParams(location.search);

// ---- settings ------------------------------------------------------------------------------

const STORE_KEY = 'gm-map.v1';
const imperialLocales = ['en-US', 'en-GB', 'my', 'en-LR'];

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    saved = {};
  }
  return {
    theme: DEFAULT_THEME,
    units: imperialLocales.some((l) => (navigator.language || '').startsWith(l)) ? 'imperial' : 'metric',
    voice: true,
    tilt: true,
    headingUp: true,
    drivers: true,
    recent: [],
    last: null,
    ...saved,
  };
}

const settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode or storage full: settings just won't persist */
  }
}

if (params.get('theme')) settings.theme = getTheme(params.get('theme')).id;
if (params.get('units')) settings.units = params.get('units') === 'imperial' ? 'imperial' : 'metric';

// ---- state ---------------------------------------------------------------------------------

let theme = getTheme(settings.theme);

const state = {
  mode: 'idle', // idle | preview | nav
  follow: false,
  fix: null,
  dest: null,
  route: null,
  nav: null,
  sim: null,
  routeLine: null, // coordinates currently drawn
  rerouting: false,
  lastRerouteAt: 0,
};

const start = (() => {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { center: [lng, lat], zoom: Number(params.get('z')) || 15 };
  }
  if (settings.last) return { center: [settings.last.lng, settings.last.lat], zoom: settings.last.zoom || 15 };
  return { center: [-118.2437, 34.0522], zoom: 13.5 };
})();

// ---- map -----------------------------------------------------------------------------------

const basePixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
const pixelRatioFor = (t) => (t.pixel ? 1 / t.pixel : basePixelRatio());

const routeData = () => ({
  type: 'FeatureCollection',
  features: state.routeLine
    ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: state.routeLine } }]
    : [],
});

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(theme),
  center: start.center,
  zoom: start.zoom,
  pitch: Number(params.get('pitch')) || 0,
  bearing: Number(params.get('bearing')) || 0,
  maxPitch: 70,
  pixelRatio: pixelRatioFor(theme),
  attributionControl: false,
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
// Start with the credit collapsed to its (i) button so it doesn't cover the HUD. Marking it
// compact up front stops the control from auto-expanding when the first tiles arrive.
map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.add('maplibregl-compact');
map.touchZoomRotate.enable();
map.touchPitch.enable();

// Blips are drawn on demand the first time a style asks for them.
map.setMissingStyleImageResolver((id) => {
  const blip = parseBlipId(id);
  if (blip && !map.hasImage(id)) {
    map.addImage(id, renderBlip(getTheme(blip.themeId), blip.key), { pixelRatio: BLIP_PIXEL_RATIO });
  }
});

map.on('rotate', () => root.style.setProperty('--map-bearing', `${-map.getBearing()}deg`));

function setRouteLine(coords) {
  state.routeLine = coords;
  const src = map.getSource(ROUTE_SOURCE);
  if (src) src.setData(routeData());
}

// ---- markers -------------------------------------------------------------------------------

const playerEl = document.createElement('div');
playerEl.className = 'player';
const playerMarker = new maplibregl.Marker({ element: playerEl, rotationAlignment: 'map', pitchAlignment: 'map' });

const destEl = document.createElement('div');
destEl.className = 'dest';
destEl.innerHTML =
  '<svg viewBox="0 0 34 44"><path class="pin" d="M17 42C17 42 3 26 3 16a14 14 0 0 1 28 0c0 10-14 26-14 26z"/><circle class="dot" cx="17" cy="16" r="5"/></svg>';
const destMarker = new maplibregl.Marker({ element: destEl, anchor: 'bottom' });

// Decorative computer-controlled cars (see traffic.js).
const drivers = new AmbientDrivers(map, maplibregl.Marker, {
  getPlayer: () => (player.has ? [player.shown.lng, player.shown.lat] : null),
});

// ---- theme ---------------------------------------------------------------------------------

function applyTheme(id, { initial = false } = {}) {
  theme = getTheme(id);
  settings.theme = theme.id;
  document.body.dataset.theme = theme.id;
  for (const [k, v] of Object.entries(theme.ui)) root.style.setProperty(k, v);
  root.style.setProperty('--route', theme.map.route);
  playerEl.innerHTML = ui.playerSvg(theme.player);
  el.go.textContent = theme.text.go;
  platform.setChrome({ light: theme.lightBars, color: theme.map.bg });
  if (!initial) {
    map.setPixelRatio(pixelRatioFor(theme));
    map.setStyle(buildStyle(theme, { routeData: routeData() }), { diff: false });
    saveSettings();
  }
}

// ---- player + camera -----------------------------------------------------------------------

const ANCHOR_Y = 0.68; // where the player sits on screen while following (fraction of height)

const player = {
  has: false,
  from: { lng: 0, lat: 0, heading: 0 },
  to: { lng: 0, lat: 0, heading: 0 },
  shown: { lng: 0, lat: 0, heading: 0 },
  t0: 0,
  dur: 1000,
  lastFixAt: 0,
  speed: 0,
};

const cam = { bearing: 0, zoom: 16, pitch: 0, userZoom: null, holdUntil: 0, applied: '' };
let gesture = false;

function setPlayerTarget(pos, heading, speed) {
  const now = performance.now();
  const interval = player.lastFixAt ? now - player.lastFixAt : 1000;
  player.lastFixAt = now;
  player.speed = speed || 0;
  const h = heading ?? player.to.heading;
  const jumped = player.has && haversine([player.shown.lng, player.shown.lat], pos) > 250;
  if (!player.has || jumped) {
    Object.assign(player.shown, { lng: pos[0], lat: pos[1], heading: h });
    playerMarker.setLngLat(pos).setRotation(h);
    if (!player.has) playerMarker.addTo(map);
    player.has = true;
  }
  player.from = { ...player.shown };
  player.to = { lng: pos[0], lat: pos[1], heading: h };
  player.t0 = now;
  player.dur = Math.max(200, Math.min(1600, interval * 1.05));
}

/** Auto zoom: pull back as speed rises so more road is visible. */
function zoomTarget() {
  if (cam.userZoom !== null) return cam.userZoom;
  const z = 17.4 - player.speed / 13;
  return Math.max(15, Math.min(17.4, z));
}

const pitchTarget = () => (settings.tilt ? 55 : 0);

/** Map centre that puts the player at ANCHOR_Y, looking along `bearing`. */
function centerAhead(pos, bearing) {
  const c = map.getContainer();
  const w = c.clientWidth;
  const h = c.clientHeight;
  const mid = map.unproject([w / 2, h / 2]);
  const anchor = map.unproject([w / 2, h * ANCHOR_Y]);
  const d = haversine([mid.lng, mid.lat], [anchor.lng, anchor.lat]);
  return destination(pos, bearing, d);
}

function applyCamera() {
  const s = player.shown;
  const wantBearing = settings.headingUp ? s.heading : 0;
  cam.bearing = lerpAngle(cam.bearing, wantBearing, 0.1);
  if (Math.abs(angleDiff(cam.bearing, wantBearing)) < 0.05) cam.bearing = wantBearing;
  cam.zoom = lerp(cam.zoom, zoomTarget(), 0.05);
  cam.pitch = lerp(cam.pitch, pitchTarget(), 0.08);
  const bearing = ((cam.bearing + 540) % 360) - 180;
  const center = centerAhead([s.lng, s.lat], bearing);
  // Skip the redraw when nothing moved; this is most of the time at a red light.
  const key = `${center[0].toFixed(7)},${center[1].toFixed(7)},${bearing.toFixed(2)},${cam.zoom.toFixed(3)},${cam.pitch.toFixed(2)}`;
  if (key === cam.applied) return;
  cam.applied = key;
  map.jumpTo({ center, bearing, zoom: cam.zoom, pitch: cam.pitch });
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!document.hidden) drivers.tick(now);
  if (!player.has) return;
  const k = Math.min(1, (now - player.t0) / player.dur);
  const s = player.shown;
  const lng = lerp(player.from.lng, player.to.lng, k);
  const lat = lerp(player.from.lat, player.to.lat, k);
  const heading = lerpAngle(player.from.heading, player.to.heading, Math.min(1, k * 1.6));
  if (lng !== s.lng || lat !== s.lat || heading !== s.heading) {
    s.lng = lng;
    s.lat = lat;
    s.heading = heading;
    playerMarker.setLngLat([lng, lat]).setRotation(heading);
  }
  if (state.follow && !gesture && now >= cam.holdUntil) applyCamera();
}
requestAnimationFrame(frame);

function setFollow(on, { animate = true } = {}) {
  if (on && !player.has) return;
  state.follow = on;
  ui.setToggle(el.locateBtn, on);
  platform.keepAwake(on || state.mode === 'nav');
  if (!on) return;
  cam.applied = '';
  const s = player.shown;
  const bearing = settings.headingUp ? s.heading : 0;
  cam.bearing = bearing;
  cam.zoom = zoomTarget();
  cam.pitch = pitchTarget();
  if (animate) {
    map.easeTo({ center: [s.lng, s.lat], bearing, zoom: cam.zoom, pitch: cam.pitch, duration: 700 });
    cam.holdUntil = performance.now() + 720;
  }
}

// ---- gestures ------------------------------------------------------------------------------

const canvas = map.getCanvasContainer();
let press = null;
let lastLongPress = 0;

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}

function endGesture() {
  if (!gesture) return;
  gesture = false;
  if (state.follow) {
    // Keep a pinch-zoom the driver chose instead of snapping back to auto zoom.
    if (Math.abs(map.getZoom() - cam.zoom) > 0.05) cam.userZoom = map.getZoom();
    cam.zoom = map.getZoom();
    cam.bearing = map.getBearing();
    cam.pitch = map.getPitch();
    cam.applied = '';
  }
}

canvas.addEventListener('touchstart', (e) => {
  gesture = true;
  cancelPress();
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  press = {
    x: t.clientX,
    y: t.clientY,
    timer: setTimeout(() => {
      const at = map.unproject([press.x - rect.left, press.y - rect.top]);
      press = null;
      lastLongPress = Date.now();
      navigator.vibrate?.(25);
      dropPin(at);
    }, 550),
  };
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (!press) return;
  const t = e.touches[0];
  if (e.touches.length !== 1 || Math.hypot(t.clientX - press.x, t.clientY - press.y) > 10) cancelPress();
}, { passive: true });
for (const type of ['touchend', 'touchcancel']) {
  canvas.addEventListener(type, (e) => {
    cancelPress();
    if (e.touches.length === 0) endGesture();
  }, { passive: true });
}
canvas.addEventListener('mousedown', () => {
  gesture = true;
});
window.addEventListener('mouseup', endGesture);
let wheelTimer = 0;
canvas.addEventListener('wheel', () => {
  gesture = true;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(endGesture, 260);
}, { passive: true });

// One-finger drags take over the camera; pinches only change zoom and keep following.
map.on('dragstart', (e) => {
  const oe = e.originalEvent;
  if (!oe || (oe.touches && oe.touches.length > 1)) return;
  setFollow(false);
});
map.on('contextmenu', (e) => {
  if (Date.now() - lastLongPress > 1000) dropPin(e.lngLat);
});
map.on('click', () => {
  ui.renderResults(null);
  el.q.blur();
});

// ---- destination + routing -----------------------------------------------------------------

let routeAbort = null;

const origin = () => {
  if (state.fix) return [state.fix.lng, state.fix.lat];
  const c = map.getCenter();
  return [c.lng, c.lat];
};

// ---- recent destinations -------------------------------------------------------------------

const MAX_RECENT = 8;

/** Put a destination at the top of the recents list (replacing an older copy of itself). */
function remember(place) {
  const entry = { name: place.name, detail: place.detail || '', lng: place.lng, lat: place.lat };
  const same = (r) => haversine([r.lng, r.lat], [entry.lng, entry.lat]) < 40;
  settings.recent = [entry, ...(settings.recent || []).filter((r) => !same(r))].slice(0, MAX_RECENT);
  saveSettings();
}

function showRecents() {
  ui.renderRecents(settings.recent, setDestination, () => {
    settings.recent = [];
    saveSettings();
    ui.renderResults(null);
  });
}

async function dropPin(lngLat) {
  const place = { name: theme.text.waypoint, detail: '', lng: lngLat.lng, lat: lngLat.lat };
  const pending = setDestination(place);
  try {
    const named = await reverseGeocode([lngLat.lng, lngLat.lat]);
    if (named && state.dest === place) {
      place.name = named.name;
      place.detail = named.detail;
      if (state.route) remember(place);
      if (state.mode === 'preview' && state.route) ui.sheetPreview(place, state.route, settings.units, { canStart: !!state.fix });
      else if (state.mode === 'preview') el.sheetTitle.textContent = place.name;
    }
  } catch {
    /* the pin keeps its generic name */
  }
  return pending;
}

async function setDestination(place) {
  if (state.mode === 'nav') endNav({ silent: true });
  routeAbort?.abort();
  routeAbort = new AbortController();
  state.dest = place;
  state.route = null;
  state.mode = 'preview';
  setRouteLine(null);
  destMarker.setLngLat([place.lng, place.lat]).addTo(map);
  cue('waypoint');
  ui.renderResults(null);
  el.q.value = '';
  el.q.blur();
  el.qClear.hidden = true;
  el.themes.hidden = true;
  ui.sheetLoading(place);
  try {
    const route = await fetchRoute(origin(), [place.lng, place.lat], { signal: routeAbort.signal });
    if (state.dest !== place) return;
    state.route = route;
    setRouteLine(route.coords);
    setFollow(false);
    ui.sheetPreview(place, route, settings.units, { canStart: !!state.fix });
    cue('route');
    remember(place);
    const c = map.getContainer();
    map.fitBounds(bounds(route.coords), {
      padding: { top: Math.min(140, c.clientHeight * 0.2), bottom: Math.min(220, c.clientHeight * 0.34), left: 40, right: 76 },
      bearing: 0,
      pitch: 0,
      duration: 900,
      maxZoom: 16.5,
    });
  } catch (err) {
    if (err.name === 'AbortError' || state.dest !== place) return;
    cue('error');
    ui.sheetError(place, navigator.onLine === false ? 'You appear to be offline' : err.final ? 'No drivable route found' : 'Routing service unavailable. Try again shortly.');
  }
}

function clearDestination() {
  routeAbort?.abort();
  state.dest = null;
  state.route = null;
  state.mode = 'idle';
  setRouteLine(null);
  destMarker.remove();
  ui.hideSheet();
}

// ---- navigation ----------------------------------------------------------------------------

let speakTimer = 0;

/** Play one of the current theme's sound cues; returns its length in ms. */
function cue(name) {
  return settings.voice ? playCue(theme.id, name) : 0;
}

/** Speak a line, optionally after a cue so the chime lands first and the voice follows. */
function say(text, cueName) {
  const lead = cueName ? Math.min(cue(cueName), 650) : 0;
  clearTimeout(speakTimer);
  if (!settings.voice || !text) return;
  if (lead) speakTimer = setTimeout(() => platform.speak(text), lead);
  else platform.speak(text);
}

function startNav({ demo = false } = {}) {
  if (!state.route || !state.dest) return;
  state.nav = new NavSession(state.route, { units: settings.units });
  state.mode = 'nav';
  setRouteLine(state.route.coords);
  ui.navMode(true);
  ui.sheetNav(state.dest);
  platform.setNavigating(true);
  cam.userZoom = null;
  if (demo) {
    state.sim = new RouteSimulator(state.route, { rate: Number(params.get('sim')) || 1 });
    state.sim.addEventListener('fix', (e) => onFix(e.detail));
    state.sim.start();
  } else if (state.fix) {
    onFix(state.fix);
  }
  setFollow(true);
  say(state.route.steps[0]?.text, 'start');
}

function endNav({ silent = false, arrived = false } = {}) {
  state.sim?.stop();
  state.sim = null;
  state.nav = null;
  clearTimeout(speakTimer);
  platform.stopSpeaking();
  platform.setNavigating(false);
  ui.navMode(false);
  clearDestination();
  platform.keepAwake(state.follow);
  if (arrived) {
    ui.showArrival(theme);
    say(theme.text.arrivedSub, 'arrive');
  } else if (!silent) {
    ui.toast('Navigation ended');
  }
  // After a demo, hand the marker back to the real GPS position if there is one.
  if (state.fix?.simulated) {
    state.fix = null;
    el.speed.hidden = true;
  }
}

async function reroute() {
  if (state.rerouting || !state.dest || Date.now() - state.lastRerouteAt < 8000) return;
  state.rerouting = true;
  state.lastRerouteAt = Date.now();
  ui.toast('Re-routing…');
  const dest = state.dest;
  try {
    const route = await fetchRoute(origin(), [dest.lng, dest.lat]);
    if (state.mode !== 'nav' || state.dest !== dest) return;
    state.route = route;
    state.nav = new NavSession(route, { units: settings.units });
    setRouteLine(route.coords);
    say('Route updated', 'reroute');
  } catch {
    /* keep the old route; we'll try again on a later fix */
  } finally {
    state.rerouting = false;
  }
}

function onFix(fix) {
  if (state.sim && !fix.simulated) return; // the demo drive owns the marker
  const first = !state.fix;
  state.fix = fix;
  let pos = [fix.lng, fix.lat];
  let heading = fix.heading;

  if (state.nav) {
    const n = state.nav.update(fix);
    if (n.onRoad) {
      pos = n.snapped;
      if (fix.speed > 1.5 || heading === null) heading = n.roadBearing;
    }
    ui.renderNav(n, settings.units);
    setRouteLine(state.nav.remainingLine(pos));
    if (n.say) say(n.say, 'turn');
    if (n.arrived) {
      setPlayerTarget(pos, heading, fix.speed);
      endNav({ arrived: true });
      return;
    }
    if (n.offRoute && !fix.simulated) reroute();
  }

  setPlayerTarget(pos, heading, fix.speed);
  ui.renderSpeed(fix.speed, settings.units);
  el.gps.hidden = true;

  if (first && !fix.simulated) {
    if (state.mode === 'idle') setFollow(true, { animate: true });
    else if (state.mode === 'preview' && state.route) ui.sheetPreview(state.dest, state.route, settings.units, { canStart: true });
  }
  if (!fix.simulated) {
    settings.last = { lng: fix.lng, lat: fix.lat, zoom: 15.5 };
    if (!onFix.savedAt || Date.now() - onFix.savedAt > 15000) {
      onFix.savedAt = Date.now();
      saveSettings();
    }
  }
}

// ---- GPS -----------------------------------------------------------------------------------

const gps = new GpsTracker();
gps.addEventListener('fix', (e) => onFix(e.detail));
gps.addEventListener('error', (e) => {
  const { code } = e.detail;
  if (code === 1) {
    el.gps.hidden = false;
    ui.toast('Location permission is off. Enable it to see yourself on the map.', 5000);
  } else if (!state.fix) {
    ui.toast('Waiting for a GPS signal…');
  }
});

function startGps() {
  el.gps.hidden = true;
  if (gps.start()) return;
  el.gps.hidden = false;
}

// GPS is always on: it starts with the app and again whenever the app comes back to the
// foreground. The button only appears if permission was refused.
function initGps() {
  startGps();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !gps.active) startGps();
  });
}

// ---- HUD wiring ----------------------------------------------------------------------------

el.gps.addEventListener('click', startGps);

el.locateBtn.addEventListener('click', () => {
  if (!gps.active && !state.sim) startGps();
  if (!player.has) {
    if (gps.active) ui.toast('Waiting for a GPS signal…');
    return;
  }
  cam.userZoom = null;
  setFollow(true);
});

el.viewBtn.addEventListener('click', () => {
  settings.tilt = !settings.tilt;
  ui.setToggle(el.viewBtn, settings.tilt);
  saveSettings();
  if (!state.follow) map.easeTo({ pitch: pitchTarget(), duration: 500 });
});

el.compassBtn.addEventListener('click', () => {
  if (state.follow) {
    settings.headingUp = !settings.headingUp;
    ui.setToggle(el.compassBtn, settings.headingUp);
    saveSettings();
  } else {
    map.easeTo({ bearing: 0, duration: 500 });
  }
});

// One switch for all audio: sound cues and spoken directions.
el.voiceBtn.addEventListener('click', () => {
  settings.voice = !settings.voice;
  ui.setToggle(el.voiceBtn, settings.voice);
  setSoundEnabled(settings.voice);
  if (settings.voice) cue('waypoint');
  else {
    clearTimeout(speakTimer);
    platform.stopSpeaking();
  }
  saveSettings();
});

el.speed.addEventListener('click', () => {
  settings.units = settings.units === 'imperial' ? 'metric' : 'imperial';
  if (state.nav) state.nav.units = settings.units;
  saveSettings();
  ui.renderSpeed(state.fix?.speed || 0, settings.units);
  if (state.mode === 'preview' && state.route) ui.sheetPreview(state.dest, state.route, settings.units, { canStart: !!state.fix });
});

el.themesBtn.addEventListener('click', () => {
  ui.renderThemes(theme.id, (id) => {
    applyTheme(id);
    el.themes.hidden = true;
    cue('route'); // let the new theme introduce itself
  });
  el.themes.hidden = !el.themes.hidden;
});
el.themesClose.addEventListener('click', () => {
  el.themes.hidden = true;
});

el.go.addEventListener('click', () => startNav());
el.demo.addEventListener('click', () => startNav({ demo: true }));
el.cancel.addEventListener('click', clearDestination);
el.end.addEventListener('click', () => endNav());

// Search-as-you-type with a short debounce; a newer query cancels the older request.
let searchTimer = 0;
let searchAbort = null;

async function runSearch(q, pickFirst = false) {
  searchAbort?.abort();
  searchAbort = new AbortController();
  try {
    const c = map.getCenter();
    const near = state.fix ? [state.fix.lng, state.fix.lat] : [c.lng, c.lat];
    const places = await searchPlaces(q, near, { signal: searchAbort.signal });
    if (pickFirst && places.length) setDestination(places[0]);
    else ui.renderResults(places, setDestination);
  } catch (err) {
    if (err.name !== 'AbortError') ui.toast('Search is unavailable right now');
  }
}

el.q.addEventListener('input', () => {
  const q = el.q.value.trim();
  el.qClear.hidden = !el.q.value;
  clearTimeout(searchTimer);
  if (q.length < 3) {
    searchAbort?.abort();
    if (q.length === 0) showRecents();
    else ui.renderResults(null);
    return;
  }
  searchTimer = setTimeout(() => runSearch(q), 350);
});
el.search.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(searchTimer);
  const q = el.q.value.trim();
  if (q.length >= 2) runSearch(q, true);
});
el.qClear.addEventListener('click', () => {
  el.q.value = '';
  el.qClear.hidden = true;
  searchAbort?.abort();
  el.q.focus();
  showRecents();
});
el.q.addEventListener('focus', () => {
  if (!el.q.value.trim()) showRecents();
});

el.driversBtn.addEventListener('click', () => {
  settings.drivers = !settings.drivers;
  el.driversBtn.setAttribute('aria-pressed', String(settings.drivers));
  drivers.setEnabled(settings.drivers);
  saveSettings();
});

// Android's Back button: close whatever is open before leaving the app. Returns true when
// it did something, so the native shell knows not to background the app.
let backArmedAt = 0;
window.gmBack = () => {
  if (!el.themes.hidden) {
    el.themes.hidden = true;
    return true;
  }
  if (!el.results.hidden) {
    ui.renderResults(null);
    el.q.blur();
    return true;
  }
  if (state.mode === 'preview') {
    clearDestination();
    return true;
  }
  if (state.mode === 'nav') {
    // Ending a route by accident mid-drive is worse than one extra press.
    if (Date.now() - backArmedAt < 3000) endNav();
    else {
      backArmedAt = Date.now();
      ui.toast('Press back again to end navigation');
    }
    return true;
  }
  return false;
};

// Keep the speed badge, toast and attribution clear of the bottom sheet.
new ResizeObserver(() => {
  const h = el.sheet.hidden ? 0 : el.sheet.offsetHeight + 10;
  root.style.setProperty('--sheet-h', `${h}px`);
}).observe(el.sheet);
new MutationObserver(() => {
  const h = el.sheet.hidden ? 0 : el.sheet.offsetHeight + 10;
  root.style.setProperty('--sheet-h', `${h}px`);
}).observe(el.sheet, { attributes: true, attributeFilter: ['hidden'] });

platform.onNativeEvent((e) => {
  if (e.type === 'insets') {
    for (const [side, key] of [['top', '--sat'], ['right', '--sar'], ['bottom', '--sab'], ['left', '--sal']]) {
      if (Number.isFinite(e[side])) root.style.setProperty(key, `${e[side]}px`);
    }
  } else if (e.type === 'pip') {
    document.body.classList.toggle('pip', !!e.active);
    requestAnimationFrame(() => map.resize());
  }
});

window.addEventListener('pagehide', saveSettings);

// ---- boot ----------------------------------------------------------------------------------

applyTheme(theme.id, { initial: true });
ui.setToggle(el.viewBtn, settings.tilt);
ui.setToggle(el.compassBtn, settings.headingUp);
ui.setToggle(el.voiceBtn, settings.voice);
setSoundEnabled(settings.voice);
el.driversBtn.setAttribute('aria-pressed', String(settings.drivers));
drivers.setEnabled(settings.drivers);
// Browsers hold audio back until the first touch; the Android app has no such rule.
if (platform.isNativeApp) unlockAudio();
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
initGps();

if ('serviceWorker' in navigator && !platform.isNativeApp && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Handy from the console, and used by the automated checks.
window.gm = { map, state, settings, player, drivers, applyTheme, setDestination, startNav, endNav, onFix, setFollow };
