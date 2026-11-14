// HUD rendering. Pure DOM: no map logic lives here.

import { THEMES } from './themes.js';
import { formatDistance, formatDuration, formatSpeed } from './geo.js';

const $ = (id) => document.getElementById(id);

export const el = {
  search: $('search'), q: $('q'), qClear: $('q-clear'), results: $('results'),
  banner: $('banner'), bannerArrow: $('banner-arrow'), bannerDist: $('banner-dist'), bannerText: $('banner-text'),
  themesBtn: $('btn-themes'), viewBtn: $('btn-view'), compassBtn: $('btn-compass'), voiceBtn: $('btn-voice'), locateBtn: $('btn-locate'),
  speed: $('speed'), speedVal: $('speed-val'), speedUnit: $('speed-unit'),
  gps: $('gps'),
  sheet: $('sheet'), sheetTitle: $('sheet-title'), sheetSub: $('sheet-sub'), sheetStats: $('sheet-stats'),
  stDist: $('st-dist'), stDistUnit: $('st-dist-unit'), stTime: $('st-time'), stEta: $('st-eta'),
  go: $('btn-go'), demo: $('btn-demo'), cancel: $('btn-cancel'), end: $('btn-end'),
  themes: $('themes'), themeGrid: $('theme-grid'), themesClose: $('themes-close'), driversBtn: $('btn-drivers'),
  arrival: $('arrival'), arrivalTitle: $('arrival-title'), arrivalSub: $('arrival-sub'),
  toast: $('toast'),
};

// Manoeuvre arrows, drawn as strokes on a 24x24 grid. Left-hand versions are mirrored.
const ARROWS = {
  straight: 'M12 21V4 M5.5 10.5 12 4l6.5 6.5',
  right: 'M6 21v-7a4 4 0 0 1 4-4h9 M14.5 5.5 19 10l-4.5 4.5',
  'slight-right': 'M8 21v-6.3a4 4 0 0 1 1.2-2.9L17 4 M10.5 4H17v6.5',
  'sharp-right': 'M7 21V7.5a2.5 2.5 0 0 1 4.3-1.8L18 12.5 M18 6v6.5h-6.5',
  uturn: 'M17 21V9.5a5 5 0 0 0-10 0V17 M2.5 12.5 7 17l4.5-4.5',
  roundabout: 'M12 21v-4 M12 17a4.5 4.5 0 1 1 4.5-4.5 M13.5 9.5 16.5 12.5l3-3',
  arrive: 'M6 21V4 M6 5h11.5l-2.5 3.5 2.5 3.5H6',
};

function arrowSvg(key) {
  const mirror = key.endsWith('left');
  const d = ARROWS[key.replace('left', 'right')] || ARROWS.straight;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"${mirror ? ' style="transform:scaleX(-1)"' : ''}><path d="${d}"/></svg>`;
}

const show = (node, on) => {
  node.hidden = !on;
};

// ---- search ------------------------------------------------------------------------------

const CLOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 7.5V12l3 2"/></svg>';
const PIN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 7.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"/></svg>';

function placeRow(p, icon, onPick) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `${icon}<div><strong></strong><span></span></div>`;
  b.querySelector('strong').textContent = p.name;
  b.querySelector('span').textContent = p.detail || '';
  b.addEventListener('click', () => onPick(p));
  li.append(b);
  return li;
}

export function renderResults(places, onPick) {
  el.results.replaceChildren();
  if (!places) {
    show(el.results, false);
    return;
  }
  if (!places.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing found';
    el.results.append(li);
  }
  for (const p of places) el.results.append(placeRow(p, PIN, onPick));
  show(el.results, true);
}

/** Recent destinations, shown when the search box is focused and empty. */
export function renderRecents(places, onPick, onClear) {
  el.results.replaceChildren();
  if (!places?.length) {
    show(el.results, false);
    return;
  }
  const head = document.createElement('li');
  head.className = 'head';
  const label = document.createElement('span');
  label.textContent = 'Recent';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear';
  clear.addEventListener('click', onClear);
  head.append(label, clear);
  el.results.append(head);
  for (const p of places) el.results.append(placeRow(p, CLOCK, onPick));
  show(el.results, true);
}

// ---- destination sheet -------------------------------------------------------------------

export function sheetLoading(place) {
  el.sheetTitle.textContent = place.name;
  el.sheetSub.textContent = 'Finding a route…';
  show(el.sheetSub, true);
  show(el.sheetStats, false);
  show(el.go, false);
  show(el.demo, false);
  show(el.cancel, true);
  show(el.end, false);
  show(el.sheet, true);
}

export function sheetPreview(place, route, units, { canStart }) {
  el.sheetTitle.textContent = place.name;
  const d = formatDistance(route.distance, units);
  el.sheetSub.textContent = `${d.value} ${d.unit} · ${formatDuration(route.duration)}${place.detail ? ` · ${place.detail}` : ''}`;
  show(el.sheetSub, true);
  show(el.sheetStats, false);
  show(el.go, canStart);
  show(el.demo, true);
  el.demo.classList.toggle('primary', !canStart);
  show(el.cancel, true);
  show(el.end, false);
  show(el.sheet, true);
}

export function sheetError(place, message) {
  el.sheetTitle.textContent = place.name;
  el.sheetSub.textContent = message;
  show(el.sheetSub, true);
  show(el.sheetStats, false);
  show(el.go, false);
  show(el.demo, false);
  show(el.cancel, true);
  show(el.end, false);
  show(el.sheet, true);
}

export function sheetNav(place) {
  el.sheetTitle.textContent = place.name;
  show(el.sheetSub, false);
  show(el.sheetStats, true);
  show(el.go, false);
  show(el.demo, false);
  show(el.cancel, false);
  show(el.end, true);
  show(el.sheet, true);
}

export function hideSheet() {
  show(el.sheet, false);
}

// ---- navigation --------------------------------------------------------------------------

export function navMode(on) {
  document.body.classList.toggle('navigating', on);
  show(el.banner, on);
  show(el.search, !on);
  if (on) show(el.results, false);
}

let lastArrow = '';

export function renderNav(n, units) {
  if (n.next.icon !== lastArrow) {
    lastArrow = n.next.icon;
    el.bannerArrow.innerHTML = arrowSvg(n.next.icon);
  }
  const d = formatDistance(n.toNext, units);
  el.bannerDist.innerHTML = `<b>${d.value}</b><span>${d.unit}</span>`;
  el.bannerText.textContent = n.next.text;

  const r = formatDistance(n.remaining, units);
  el.stDist.textContent = r.value;
  el.stDistUnit.textContent = r.unit;
  el.stTime.textContent = formatDuration(n.seconds).replace(' min', '');
  el.stTime.nextElementSibling.textContent = n.seconds >= 3570 ? 'time' : 'min';
  // "4:32 PM" becomes a big 4:32 with a small PM beside it; 24-hour locales just get "eta".
  const [clock, suffix] = new Date(Date.now() + n.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).split(/\s+/);
  el.stEta.textContent = clock;
  el.stEta.nextElementSibling.textContent = suffix || 'eta';
}

export function renderSpeed(mps, units) {
  el.speedVal.textContent = formatSpeed(mps, units);
  el.speedUnit.textContent = units === 'imperial' ? 'mph' : 'km/h';
  show(el.speed, true);
}

let arrivalTimer = 0;

export function showArrival(theme, ms = 4500) {
  el.arrivalTitle.textContent = theme.text.arrived;
  el.arrivalSub.textContent = theme.text.arrivedSub;
  show(el.arrival, true);
  clearTimeout(arrivalTimer);
  arrivalTimer = setTimeout(() => show(el.arrival, false), ms);
}

// ---- misc --------------------------------------------------------------------------------

let toastTimer = 0;

export function toast(message, ms = 3200) {
  el.toast.textContent = message;
  show(el.toast, true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => show(el.toast, false), ms);
}

export function setToggle(button, on) {
  button.classList.toggle('on', on);
  button.setAttribute('aria-pressed', String(on));
}

/** Miniature map swatch built from a theme's palette. */
function themePreview(t) {
  const p = t.map;
  const casing = t.casing > 0 ? `<path d="M-5 30H125M40-5V60M88-5V46" stroke="${p.casing}" stroke-width="6.5"/>` : '';
  return `<svg viewBox="0 0 120 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true"${t.pixel ? ' shape-rendering="crispEdges"' : ''}>
    <rect width="120" height="72" fill="${p.bg}"/>
    <path d="M0 52C30 42 52 70 120 54V72H0z" fill="${p.water}" stroke="${p.waterLine}" stroke-width="1"/>
    <rect x="94" y="4" width="22" height="20" fill="${p.park}"/>
    <rect x="46" y="36" width="14" height="10" fill="${p.building}" stroke="${p.buildingLine}" stroke-width=".8"/>
    <rect x="66" y="36" width="16" height="8" fill="${p.building}" stroke="${p.buildingLine}" stroke-width=".8"/>
    <g fill="none">
      <path d="M-5 14H125M14-5V46M64-5V50" stroke="${p.minor}" stroke-width="1.6"/>
      ${casing}
      <path d="M-5 30H125M40-5V60M88-5V46" stroke="${p.major}" stroke-width="4"/>
      <path d="M14 44V30H64V14H112" stroke="${p.routeCasing}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M14 44V30H64V14H112" stroke="${p.route}" stroke-width="3" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

export function renderThemes(activeId, onPick) {
  el.themeGrid.replaceChildren();
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `theme-card${t.id === activeId ? ' active' : ''}`;
    b.style.setProperty('--card-font', t.ui['--ui-display']);
    b.innerHTML = `${themePreview(t)}<strong></strong><span></span>`;
    b.querySelector('strong').textContent = t.name;
    b.querySelector('span').textContent = t.tagline;
    b.addEventListener('click', () => onPick(t.id));
    el.themeGrid.append(b);
  }
}

// Player arrow artwork: a smooth chevron, or a stepped 8x8 pixel arrow for blocky themes.
const PIXEL_ARROW = ['...XX...', '...XX...', '..XXXX..', '..XXXX..', '.XXXXXX.', '.XX..XX.', 'XX....XX', 'X......X'];

export function playerSvg(kind) {
  if (kind === 'pixel') {
    let d = '';
    PIXEL_ARROW.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c === 'X') d += `M${x * 4} ${y * 4}h4v4h-4z`;
      });
    });
    return `<svg viewBox="-3 -3 38 38" shape-rendering="crispEdges"><path class="pl-out" d="${d}"/><path class="pl-in" d="${d}"/></svg>`;
  }
  const d = 'M16 2.5 28 28.5 16 22.5 4 28.5z';
  return `<svg viewBox="0 0 32 32"><path class="pl-out" d="${d}"/><path class="pl-in" d="${d}"/></svg>`;
}
