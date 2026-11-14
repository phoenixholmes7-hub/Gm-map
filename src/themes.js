// Theme definitions. Each theme is an original look in a familiar game-map genre:
// a map palette, label fonts, HUD styling and a few flavour strings.
//
// `map`   colours consumed by mapstyle.js
// `ui`    CSS custom properties applied to the HUD
// `fonts` woff2 files used for on-map labels (regular / bold / italic)

const font = (file) => new URL(`../vendor/fonts/${file}.woff2`, import.meta.url).href;

export const THEMES = [
  {
    id: 'heist',
    name: 'Heist',
    tagline: 'Blacked-out city radar',
    map: {
      bg: '#0b0c0d', urban: '#131416', industrial: '#17181a',
      park: '#0f1512', wood: '#0d1310', sand: '#1c1c19', ice: '#22262a',
      water: '#3d525b', lake: '#8fa8b2', shore: '#d3e3e9', waterLine: '#b7ccd4',
      building: '#1c1d20', buildingLine: '#2a2c30', buildingTop: '#33363b',
      motorway: '#e9ebed', major: '#bfc2c6', mid: '#8f9297', minor: '#5d6065', path: '#3f4246',
      casing: '#040404', rail: '#4a4d52', runway: '#2e3136', boundary: '#55585d',
      label: '#f4f6f8', labelMinor: '#b9bfc7', labelRoad: '#d5dae0', labelWater: '#dbe8ed', halo: '#040404',
      route: '#ffcc33', routeCasing: '#5c4300',
      sky: '#060707', horizon: '#3d525b', fog: '#0b0c0d',
    },
    roadScale: 1, casing: 1.4, glow: false, extrude: true, extrudeOpacity: 0.85,
    labels: { upper: true, spacing: 0.08, halo: 1.6, size: 1 },
    fonts: { regular: ['oswald', 'oswald-ext'], bold: ['oswald', 'oswald-ext'], italic: ['oswald', 'oswald-ext'] },
    blip: 'outline',
    player: 'chevron',
    ui: {
      '--ui-bg': 'rgba(10, 11, 13, 0.86)', '--ui-fg': '#f4f6f8', '--ui-dim': '#9aa1aa',
      '--ui-accent': '#ffcc33', '--ui-on-accent': '#16181b', '--ui-border': '2px solid #f4f6f8',
      '--ui-radius': '2px', '--ui-shadow': '0 6px 24px rgba(0,0,0,.6)',
      '--ui-font': "'Oswald', 'Arial Narrow', sans-serif", '--ui-display': "'Bebas Neue', 'Oswald', sans-serif",
      '--ui-caps': 'uppercase', '--ui-track': '0.06em',
      '--player-fill': '#ffffff', '--player-stroke': '#090a0b',
    },
    lightBars: false,
    text: { go: 'Start job', arrived: 'Job done', arrivedSub: 'You made it to the drop', waypoint: 'Waypoint' },
  },
  {
    id: 'frontier',
    name: 'Frontier',
    tagline: 'Hand-inked parchment',
    map: {
      bg: '#e4d3a9', urban: '#dfcb9d', industrial: '#d8c495',
      park: '#cfc890', wood: '#c1bf87', sand: '#eadbb3', ice: '#efe6cb',
      water: '#b4c2ae', waterLine: '#6f6a4d',
      building: '#cdb688', buildingLine: '#8f744c', buildingTop: '#d6c193',
      motorway: '#d5a85e', major: '#dcb672', mid: '#e6cd96', minor: '#7a5c38', path: '#8f744c',
      casing: '#4a3520', rail: '#4a3520', runway: '#cdb688', boundary: '#8f744c',
      label: '#33230f', labelMinor: '#4a3520', labelRoad: '#4a3520', labelWater: '#45605c', halo: 'rgba(236, 221, 182, 0.92)',
      route: '#a8211c', routeCasing: '#4d0b08',
      sky: '#d9c48f', horizon: '#e9dab4', fog: '#e4d3a9',
    },
    roadScale: 0.9, casing: 1.1, inkMinor: true, glow: false, extrude: false,
    labels: { upper: false, spacing: 0.04, halo: 1.4, size: 1.12 },
    fonts: { regular: ['im-fell-english'], bold: ['im-fell-english-sc'], italic: ['im-fell-english-italic'] },
    blip: 'ink',
    player: 'chevron',
    ui: {
      '--ui-bg': 'rgba(233, 218, 180, 0.94)', '--ui-fg': '#33230f', '--ui-dim': '#7a5c38',
      '--ui-accent': '#a8211c', '--ui-on-accent': '#f3e6c4', '--ui-border': '2px solid #4a3520',
      '--ui-radius': '3px', '--ui-shadow': '0 4px 14px rgba(60, 35, 10, .45)',
      '--ui-font': "'IM Fell English', Georgia, serif", '--ui-display': "'Rye', 'IM Fell English SC', serif",
      '--ui-caps': 'none', '--ui-track': '0.02em',
      '--player-fill': '#a8211c', '--player-stroke': '#33230f',
    },
    lightBars: true,
    text: { go: 'Ride out', arrived: "Journey's end", arrivedSub: 'You have reached your destination', waypoint: 'Marked spot' },
  },
  {
    id: 'blocks',
    name: 'Blockworld',
    tagline: 'Chunky pixel overworld',
    map: {
      bg: '#7dbd52', urban: '#8ac660', industrial: '#93b86a',
      park: '#5ea83e', wood: '#3d8a35', sand: '#e6d998', ice: '#e8f4f7',
      water: '#3f78e6', waterLine: '#2c5bc0',
      building: '#a3a3a3', buildingLine: '#6b6b6b', buildingTop: '#bdbdbd',
      motorway: '#c9c9c9', major: '#dcb86c', mid: '#dcb86c', minor: '#cfa85c', path: '#b8914a',
      casing: '#6f5527', rail: '#4d4d4d', runway: '#a3a3a3', boundary: '#2f6a28',
      label: '#ffffff', labelMinor: '#ffffff', labelRoad: '#ffffff', labelWater: '#dce9ff', halo: '#1c1c1c',
      route: '#ff3b3b', routeCasing: '#6e0c0c',
      sky: '#8fc5ff', horizon: '#cfe6ff', fog: '#bfe0ff',
    },
    roadScale: 1.5, casing: 2.4, glow: false, extrude: true, extrudeOpacity: 1,
    pixel: 3,
    labels: { upper: false, spacing: 0.02, halo: 3, size: 1.5, tags: true },
    fonts: { regular: ['pixelify-sans', 'pixelify-sans-ext'], bold: ['pixelify-sans', 'pixelify-sans-ext'], italic: ['pixelify-sans', 'pixelify-sans-ext'] },
    blip: 'tile',
    player: 'pixel',
    ui: {
      '--ui-bg': 'rgba(38, 38, 52, 0.94)', '--ui-fg': '#ffffff', '--ui-dim': '#b9b9c9',
      '--ui-accent': '#ffd83d', '--ui-on-accent': '#262634', '--ui-border': '3px solid #0d0d14',
      '--ui-radius': '0px', '--ui-shadow': '4px 4px 0 rgba(0,0,0,.55)',
      '--ui-font': "'Pixelify Sans', 'Courier New', monospace", '--ui-display': "'Press Start 2P', 'Pixelify Sans', monospace",
      '--ui-caps': 'none', '--ui-track': '0',
      '--player-fill': '#ffffff', '--player-stroke': '#0d0d14',
    },
    lightBars: false,
    text: { go: 'Start quest', arrived: 'Quest complete!', arrivedSub: 'Destination reached', waypoint: 'Waypoint' },
  },
  {
    id: 'neon',
    name: 'Neon',
    tagline: 'Synthwave night grid',
    map: {
      bg: '#0b0620', urban: '#0f0929', industrial: '#130b30',
      park: '#0a1e2b', wood: '#081a25', sand: '#1b1238', ice: '#1b1a45',
      water: '#06142f', waterLine: '#19d3ff',
      building: '#1a0f42', buildingLine: '#5b2ea8', buildingTop: '#2a1668',
      motorway: '#ff2bd6', major: '#ff5ac8', mid: '#8a63ff', minor: '#4a3a96', path: '#342a70',
      casing: '#0b0620', rail: '#3e3480', runway: '#2a1668', boundary: '#5b2ea8',
      label: '#eaffff', labelMinor: '#8ef0ff', labelRoad: '#8ef0ff', labelWater: '#19d3ff', halo: '#0b0620',
      route: '#fff23a', routeCasing: '#6b6100',
      sky: '#12052e', horizon: '#ff2bd6', fog: '#2a0f52',
    },
    roadScale: 0.8, casing: 1, glow: true, extrude: true, extrudeOpacity: 0.8,
    labels: { upper: true, spacing: 0.12, halo: 1.6, size: 0.92 },
    fonts: { regular: ['orbitron'], bold: ['orbitron'], italic: ['orbitron'] },
    blip: 'glow',
    player: 'chevron',
    ui: {
      '--ui-bg': 'rgba(14, 7, 40, 0.86)', '--ui-fg': '#eaffff', '--ui-dim': '#9a8fd0',
      '--ui-accent': '#19d3ff', '--ui-on-accent': '#0b0620', '--ui-border': '1.5px solid #ff2bd6',
      '--ui-radius': '10px', '--ui-shadow': '0 0 18px rgba(255, 43, 214, .45)',
      '--ui-font': "'Orbitron', 'Trebuchet MS', sans-serif", '--ui-display': "'Orbitron', sans-serif",
      '--ui-caps': 'uppercase', '--ui-track': '0.08em',
      '--player-fill': '#19d3ff', '--player-stroke': '#ffffff',
    },
    lightBars: false,
    text: { go: 'Launch run', arrived: 'Run complete', arrivedSub: 'Destination locked in', waypoint: 'Beacon' },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    tagline: 'Green-phosphor wireframe',
    map: {
      bg: '#020a04', urban: '#031006', industrial: '#041408',
      park: '#052211', wood: '#041c0d', sand: '#06180a', ice: '#082010',
      water: '#010503', waterLine: '#1c9c4c',
      building: '#04160a', buildingLine: '#127a3a', buildingTop: '#072512',
      motorway: '#7dffa8', major: '#3fe57c', mid: '#25b85c', minor: '#167a3d', path: '#0f5a2c',
      casing: '#020a04', rail: '#0f5a2c', runway: '#0a3018', boundary: '#127a3a',
      label: '#b4ffd0', labelMinor: '#5fe08f', labelRoad: '#5fe08f', labelWater: '#1c9c4c', halo: '#020a04',
      route: '#ffb000', routeCasing: '#4d3500',
      sky: '#010503', horizon: '#0a3018', fog: '#020a04',
    },
    roadScale: 0.62, casing: 0, glow: true, extrude: false,
    labels: { upper: true, spacing: 0.06, halo: 1.4, size: 1 },
    fonts: { regular: ['share-tech-mono'], bold: ['share-tech-mono'], italic: ['share-tech-mono'] },
    blip: 'bracket',
    player: 'chevron',
    ui: {
      '--ui-bg': 'rgba(2, 14, 6, 0.9)', '--ui-fg': '#b4ffd0', '--ui-dim': '#2fae63',
      '--ui-accent': '#ffb000', '--ui-on-accent': '#020a04', '--ui-border': '1.5px solid #25b85c',
      '--ui-radius': '0px', '--ui-shadow': '0 0 14px rgba(63, 229, 124, .35)',
      '--ui-font': "'Share Tech Mono', 'Courier New', monospace", '--ui-display': "'VT323', 'Share Tech Mono', monospace",
      '--ui-caps': 'uppercase', '--ui-track': '0.04em',
      '--player-fill': '#b4ffd0', '--player-stroke': '#020a04',
    },
    lightBars: false,
    text: { go: 'Execute', arrived: 'Destination reached', arrivedSub: 'Route complete. Awaiting input_', waypoint: 'Marker' },
  },
];

export const DEFAULT_THEME = 'heist';

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// Characters covered by the "latin" and "latin-ext" webfont subsets. Anything else falls
// back to the Noto Sans glyphs served alongside the tiles.
const LATIN = ['U+0-FF', 'U+131', 'U+152-153', 'U+2000-206F', 'U+20AC', 'U+2122'];
const LATIN_EXT = ['U+100-130', 'U+132-151', 'U+154-24F', 'U+1E00-1EFF'];

/**
 * MapLibre `font-faces` block for a theme. The display fonts are registered under the same
 * names as the server-side glyph stacks, so the style can ask for one font name and get the
 * themed face for Latin text with an automatic fallback for every other script.
 */
export function fontFaces(theme) {
  const faces = (files) =>
    files.map((f, i) => ({ url: font(f), 'unicode-range': i === 0 ? LATIN : LATIN_EXT }));
  return {
    'Noto Sans Regular': faces(theme.fonts.regular),
    'Noto Sans Bold': faces(theme.fonts.bold),
    'Noto Sans Italic': faces(theme.fonts.italic),
  };
}
