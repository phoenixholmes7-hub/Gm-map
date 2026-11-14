// Builds a complete MapLibre style from a theme. Map data comes from OpenFreeMap, which serves
// OpenStreetMap vector tiles in the OpenMapTiles schema with no API key.

import { fontFaces } from './themes.js';
import { POI_ICON, SUBCLASS_ICON, blipId } from './icons.js';

const TILES = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export const ROUTE_SOURCE = 'route';
export const FIRST_LABEL_LAYER = 'label-road';

const EMPTY = { type: 'FeatureCollection', features: [] };

const inClass = (...c) => ['match', ['get', 'class'], c, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];

/** Zoom-interpolated line width; [z8, z13, z16, z20] in px, scaled per theme. */
function width(stops, scale, extra = 0) {
  const zs = [8, 13, 16, 20];
  const out = ['interpolate', ['exponential', 1.5], ['zoom']];
  stops.forEach((w, i) => out.push(zs[i], w * scale + (w > 0 ? extra : 0)));
  return out;
}

const ROADS = [
  // id, classes, widths at z8/13/16/20, minzoom
  { id: 'minor', classes: ['minor', 'service', 'track', 'raceway', 'busway'], w: [0, 0.9, 5, 30], minzoom: 12 },
  { id: 'mid', classes: ['secondary', 'tertiary'], w: [0.5, 2, 8, 40], minzoom: 9 },
  { id: 'major', classes: ['primary', 'trunk'], w: [1, 3, 11, 48], minzoom: 6 },
  { id: 'motorway', classes: ['motorway'], w: [1.5, 4, 14, 56], minzoom: 4 },
];

export function buildStyle(theme, { routeData = EMPTY } = {}) {
  const p = theme.map;
  const s = theme.roadScale;
  const lab = theme.labels;
  const layers = [];
  const add = (layer) => layers.push(layer);
  const fill = (id, sourceLayer, color, extra = {}) =>
    add({ id, type: 'fill', source: 'omt', 'source-layer': sourceLayer, ...extra, paint: { 'fill-color': color, 'fill-antialias': !theme.pixel, ...(extra.paint || {}) } });

  add({ id: 'background', type: 'background', paint: { 'background-color': p.bg } });

  // ---- land ------------------------------------------------------------------------------
  fill('landuse-urban', 'landuse', p.urban, { filter: inClass('residential', 'suburb', 'neighbourhood', 'commercial', 'retail') });
  fill('landuse-industrial', 'landuse', p.industrial, { filter: inClass('industrial', 'railway', 'garages', 'military') });
  fill('landcover-sand', 'landcover', p.sand, { filter: inClass('sand') });
  fill('landcover-ice', 'landcover', p.ice, { filter: inClass('ice') });
  fill('landcover-grass', 'landcover', p.park, { filter: inClass('grass', 'farmland', 'wetland'), paint: { 'fill-opacity': 0.6 } });
  fill('landcover-wood', 'landcover', p.wood, { filter: inClass('wood') });
  fill('park', 'park', p.park, { paint: { 'fill-opacity': 0.7 } });
  fill('landuse-green', 'landuse', p.park, { filter: inClass('cemetery', 'stadium', 'pitch', 'playground', 'track', 'park', 'grass') });

  // ---- water -----------------------------------------------------------------------------
  const inland = ['match', ['get', 'class'], ['ocean'], false, true];
  fill('water', 'water', p.lake ? ['case', inland, p.lake, p.water] : p.water);
  if (p.shore) {
    // Pale surf line hugging the coast. Tile polygons wind so that "right of the line" is
    // always the water side; the offset keeps the glow off the land. Kept narrow so the
    // clipped edges of water polygons (just outside each tile) never show as a grid.
    add({
      id: 'water-shore-soft', type: 'line', source: 'omt', 'source-layer': 'water', minzoom: 5,
      paint: { 'line-color': p.shore, 'line-width': 6, 'line-offset': 3, 'line-blur': 5, 'line-opacity': 0.45 },
    });
    add({
      id: 'water-shore', type: 'line', source: 'omt', 'source-layer': 'water', minzoom: 5,
      paint: { 'line-color': p.shore, 'line-width': 3, 'line-offset': 1.5, 'line-blur': 2, 'line-opacity': 0.8 },
    });
  }
  add({
    id: 'water-outline', type: 'line', source: 'omt', 'source-layer': 'water', minzoom: 9,
    paint: { 'line-color': p.waterLine, 'line-width': theme.pixel ? 3 : 1, 'line-opacity': theme.glow ? 0.55 : 0.8 },
  });
  add({
    id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 10,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': theme.glow ? p.waterLine : p.lake || p.water, 'line-width': width([0, 1, 3, 12], s), 'line-opacity': theme.glow ? 0.5 : 1 },
  });

  // ---- airports --------------------------------------------------------------------------
  fill('aeroway-area', 'aeroway', p.runway, { minzoom: 11, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-opacity': 0.7 } });
  add({
    id: 'aeroway-runway', type: 'line', source: 'omt', 'source-layer': 'aeroway', minzoom: 10,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], inClass('runway', 'taxiway')],
    paint: { 'line-color': p.runway, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1, 16, ['match', ['get', 'class'], 'runway', 40, 10]] },
  });

  // ---- buildings (flat) ------------------------------------------------------------------
  if (!theme.extrude) {
    fill('building', 'building', p.building, { minzoom: 13, paint: { 'fill-outline-color': p.buildingLine } });
  }

  // ---- roads -----------------------------------------------------------------------------
  const roadLayout = { 'line-cap': theme.pixel ? 'butt' : 'round', 'line-join': 'round' };
  const tunnelFade = ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.4, 1];

  add({
    id: 'road-path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
    filter: ['all', inClass('path', 'pier'), notTunnel],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': p.path, 'line-width': width([0, 0.6, 1.6, 6], s), 'line-dasharray': [2, 1.5] },
  });

  if (theme.glow) {
    // Soft bloom underneath the brighter roads.
    for (const r of ROADS.slice(1)) {
      add({
        id: `road-glow-${r.id}`, type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: r.minzoom,
        filter: inClass(...r.classes), layout: roadLayout,
        paint: {
          'line-color': p[r.id], 'line-opacity': 0.28,
          'line-width': width(r.w, s * 2.6, 4), 'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 2, 16, 10],
        },
      });
    }
  }

  if (theme.casing > 0) {
    for (const r of ROADS) {
      if (theme.inkMinor && r.id === 'minor') continue;
      add({
        id: `road-casing-${r.id}`, type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: r.minzoom,
        filter: inClass(...r.classes), layout: roadLayout,
        paint: { 'line-color': p.casing, 'line-width': width(r.w, s, theme.casing * 2), 'line-opacity': tunnelFade },
      });
    }
  }
  for (const r of ROADS) {
    const ink = theme.inkMinor && r.id === 'minor';
    add({
      id: `road-${r.id}`, type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: r.minzoom,
      filter: inClass(...r.classes), layout: roadLayout,
      paint: {
        'line-color': p[r.id],
        // Ink themes draw back streets as a single pen stroke instead of a cased ribbon.
        'line-width': ink ? width([0, 0.7, 1.6, 4], 1) : width(r.w, s),
        'line-opacity': tunnelFade,
      },
    });
  }

  add({
    id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
    filter: inClass('rail', 'transit'),
    paint: { 'line-color': p.rail, 'line-width': width([0, 0.8, 2, 6], s), 'line-dasharray': theme.inkMinor ? [0.6, 2] : [4, 2] },
  });
  if (theme.inkMinor) {
    add({
      id: 'rail-spine', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
      filter: inClass('rail', 'transit'),
      paint: { 'line-color': p.rail, 'line-width': width([0, 0.3, 0.7, 2], 1) },
    });
  }

  // ---- buildings (3D) --------------------------------------------------------------------
  if (theme.extrude) {
    fill('building', 'building', p.building, { minzoom: 13, maxzoom: 15, paint: { 'fill-outline-color': p.buildingLine } });
    add({
      id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 15,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, p.building, 60, p.buildingTop],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': theme.extrudeOpacity ?? 0.85,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  add({
    id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
    filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
    paint: { 'line-color': p.boundary, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 10, 2], 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
  });

  // ---- route -----------------------------------------------------------------------------
  // Zoom must be the outermost expression, so each variant gets its own stop list.
  const routeWidth = (mult = 1, extra = 0) => {
    const out = ['interpolate', ['exponential', 1.5], ['zoom']];
    for (const [z, w] of [[6, 3], [13, 5.5], [16, 10], [20, 26]]) out.push(z, w * mult + extra);
    return out;
  };
  const routeLayout = { 'line-cap': 'round', 'line-join': 'round' };
  add({
    id: 'route-casing', type: 'line', source: ROUTE_SOURCE, layout: routeLayout,
    paint: { 'line-color': p.routeCasing, 'line-width': routeWidth(1, theme.pixel ? 6 : 3.5) },
  });
  if (theme.glow) {
    add({
      id: 'route-glow', type: 'line', source: ROUTE_SOURCE, layout: routeLayout,
      paint: { 'line-color': p.route, 'line-width': routeWidth(2.6), 'line-blur': 12, 'line-opacity': 0.45 },
    });
  }
  add({
    id: 'route-line', type: 'line', source: ROUTE_SOURCE, layout: routeLayout,
    paint: { 'line-color': p.route, 'line-width': routeWidth() },
  });

  // ---- labels ----------------------------------------------------------------------------
  const name = ['coalesce', ['get', 'name:latin'], ['get', 'name']];
  const text = (color, extra = {}) => ({
    'text-color': color, 'text-halo-color': p.halo, 'text-halo-width': lab.halo, ...extra,
  });
  const sz = (n) => Math.round(n * lab.size * 10) / 10;
  const caps = lab.upper ? 'uppercase' : 'none';

  const majorRoad = inClass('motorway', 'trunk', 'primary', 'secondary', 'tertiary');
  if (lab.tags) {
    // Low-resolution themes can't draw legible text along a curve, so street names become
    // upright tags pinned to the start of each road segment instead.
    add({
      id: FIRST_LABEL_LAYER, type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14.5,
      filter: ['all', ['!=', ['get', 'class'], 'path'], ['any', majorRoad, ['>=', ['zoom'], 16.5]]],
      layout: {
        'symbol-placement': 'point', 'text-field': name, 'text-font': ['Noto Sans Regular'],
        'text-size': sz(15), 'text-padding': 14, 'text-max-width': 9, 'text-letter-spacing': lab.spacing,
        'symbol-sort-key': ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 0, ['secondary', 'tertiary'], 1, 2],
      },
      paint: text(p.labelRoad),
    });
  } else {
    add({
      id: FIRST_LABEL_LAYER, type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13,
      filter: ['!=', ['get', 'class'], 'path'],
      layout: {
        'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, sz(10.5), 18, sz(14.5)],
        'text-transform': caps, 'text-letter-spacing': lab.spacing, 'text-max-angle': 35,
        'symbol-spacing': 320, 'text-padding': 4,
      },
      paint: text(p.labelRoad),
    });
  }

  add({
    id: 'label-water', type: 'symbol', source: 'omt', 'source-layer': 'water_name', minzoom: 4,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': name, 'text-font': ['Noto Sans Italic'], 'text-size': sz(12.5),
      'text-letter-spacing': 0.14, 'text-max-width': 6, 'text-transform': caps,
    },
    paint: text(p.labelWater, { 'text-halo-width': theme.pixel ? lab.halo : 1 }),
  });

  // Points of interest drawn as themed "blips".
  const poiKeys = Object.keys(POI_ICON);
  const subKeys = Object.keys(SUBCLASS_ICON);
  const byClass = ['match', ['get', 'class']];
  for (const k of poiKeys) byClass.push(k, blipId(theme, POI_ICON[k]));
  byClass.push(blipId(theme, 'star'));
  // The specific kind of place wins over its broad class when we have an icon for it.
  const iconFor = ['match', ['get', 'subclass']];
  for (const k of subKeys) iconFor.push(k, blipId(theme, SUBCLASS_ICON[k]));
  iconFor.push(byClass);
  add({
    id: 'label-poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: lab.tags ? 15 : 14,
    filter: ['all', ['any', inClass(...poiKeys), ['match', ['get', 'subclass'], subKeys, true, false]], ['<=', ['get', 'rank'], ['step', ['zoom'], 6, 15, 14, 16, 30, 17, 90]]],
    layout: {
      'icon-image': iconFor, 'icon-size': theme.pixel ? 1.6 : ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 1.1],
      'icon-padding': theme.pixel ? 14 : 6, 'symbol-sort-key': ['get', 'rank'],
      'text-field': ['step', ['zoom'], '', lab.tags ? 17.5 : 16, name], 'text-font': ['Noto Sans Regular'],
      'text-size': sz(10.5), 'text-anchor': 'top', 'text-offset': [0, theme.pixel ? 1.5 : 1.3],
      'text-optional': true, 'text-max-width': 7, 'text-transform': caps, 'text-letter-spacing': lab.spacing,
    },
    paint: text(p.labelMinor),
  });

  add({
    id: 'label-airport', type: 'symbol', source: 'omt', 'source-layer': 'aerodrome_label', minzoom: 9,
    layout: {
      'icon-image': blipId(theme, 'plane'), 'icon-size': theme.pixel ? 1.6 : 1,
      'text-field': ['step', ['zoom'], '', 11, name], 'text-font': ['Noto Sans Regular'], 'text-size': sz(11),
      'text-anchor': 'top', 'text-offset': [0, 1.3], 'text-optional': true, 'text-max-width': 8,
      'text-transform': caps, 'text-letter-spacing': lab.spacing,
    },
    paint: text(p.labelMinor),
  });

  const place = (id, classes, minzoom, maxzoom, size, { color = p.label, bold = false, spacing = lab.spacing, upper = lab.upper } = {}) =>
    add({
      id: `label-${id}`, type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom, maxzoom,
      filter: inClass(...classes),
      layout: {
        'text-field': name, 'text-font': [bold ? 'Noto Sans Bold' : 'Noto Sans Regular'],
        'text-size': Array.isArray(size) ? ['interpolate', ['linear'], ['zoom'], minzoom, sz(size[0]), maxzoom, sz(size[1])] : sz(size),
        'text-transform': upper ? 'uppercase' : 'none', 'text-letter-spacing': spacing, 'text-max-width': 8,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 20], 'text-padding': lab.tags ? 16 : 3,
      },
      paint: text(color),
    });

  if (!lab.tags) place('neighbourhood', ['neighbourhood', 'quarter'], 13, 16.5, 11, { color: p.labelMinor, spacing: 0.16, upper: true });
  place('suburb', ['suburb'], 11, 15.5, [11, 14], { color: p.labelMinor, spacing: 0.16, upper: true });
  place('village', ['village', 'hamlet'], 10.5, 16, [10.5, 14]);
  place('town', ['town'], 7.5, 15, [11.5, 17], { bold: true });
  place('city', ['city'], 3.5, 14, [12.5, 24], { bold: true });
  place('state', ['state', 'province'], 3.5, 8, [10, 14], { color: p.labelMinor, spacing: 0.2, upper: true });
  place('country', ['country'], 1, 6.5, [11, 18], { bold: true, spacing: 0.1, upper: true });

  return {
    version: 8,
    name: `GM Map ${theme.name}`,
    glyphs: GLYPHS,
    'font-faces': fontFaces(theme),
    sky: {
      'sky-color': p.sky, 'horizon-color': p.horizon, 'fog-color': p.fog,
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.75,
    },
    sources: {
      omt: { type: 'vector', url: TILES, attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
      [ROUTE_SOURCE]: { type: 'geojson', data: routeData },
    },
    layers,
  };
}
