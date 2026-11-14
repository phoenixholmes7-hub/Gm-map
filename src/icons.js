// Point-of-interest "blips". The glyphs are simple original silhouettes on a 24x24 grid;
// each theme renders them in its own style onto a canvas that MapLibre uses as an icon.

/** OpenMapTiles POI class -> glyph key. */
export const POI_ICON = {
  cafe: 'cup',
  restaurant: 'food', fast_food: 'food',
  bar: 'drink', beer: 'drink', alcohol_shop: 'drink',
  fuel: 'fuel',
  shop: 'bag', clothing_store: 'bag', grocery: 'bag',
  hospital: 'cross', pharmacy: 'cross',
  police: 'shield',
  lodging: 'bed',
  bank: 'coin', atm: 'coin',
  parking: 'parking',
  attraction: 'star', museum: 'star', castle: 'star', art_gallery: 'star', stadium: 'star', cinema: 'star', theatre: 'star',
  park: 'tree',
  car: 'car',
  railway: 'train',
};

// f = filled path (even-odd), s = stroked path, t = single character drawn as text.
const GLYPHS = {
  cup: {
    f: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z',
    s: 'M17 10.5h1.2a2.3 2.3 0 0 1 0 4.6H17 M3.5 21.5h14 M8 3.2c-.9 1 .9 2 0 3.2 M12 3.2c-.9 1 .9 2 0 3.2',
  },
  food: { f: 'M14.5 3c2.6 0 4 2.6 4 6v4.5h-4z', s: 'M5 3v4.5a2.5 2.5 0 0 0 5 0V3 M7.5 3v18 M16.6 13.5V21' },
  drink: { f: 'M3.5 4h17L12 13.2z', s: 'M12 13v7 M7.5 20.5h9' },
  fuel: {
    f: 'M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20z M7 6.5h5V11H7z',
    s: 'M4 20.5h11 M14 11h1.5a1.5 1.5 0 0 1 1.5 1.5v4.2a1.6 1.6 0 0 0 3.2 0V9.5L17.5 6.5',
  },
  bag: { f: 'M4.5 8.5h15l-1 12.5h-13z', s: 'M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5' },
  cross: { f: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  shield: { f: 'M12 2.5 20 5.5v5.8c0 4.9-3.3 9-8 10.7-4.7-1.7-8-5.8-8-10.7V5.5z' },
  bed: { f: 'M5 11.2a2 2 0 1 0 4 0 2 2 0 1 0-4 0z', s: 'M3 5.5V19 M3 16h18v3 M21 16v-2.5a3 3 0 0 0-3-3h-7V16' },
  coin: { t: '$' },
  parking: { t: 'P' },
  star: { f: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z' },
  tree: { f: 'M12 2.5 17 9h-2.6l4.1 6H13.2v6h-2.4v-6H5.5l4.1-6H7z' },
  plane: {
    f: 'M12 2c.9 0 1.5 1 1.5 2.2v4.6l7.5 4.7v2.1l-7.5-2.4v4.6l2.3 1.7v1.8L12 20.2l-3.8 1.1v-1.8l2.3-1.7v-4.6L3 15.6v-2.1l7.5-4.7V4.2C10.5 3 11.1 2 12 2z',
  },
  train: {
    f: 'M7.5 3h9A3.5 3.5 0 0 1 20 6.5v8a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 14.5v-8A3.5 3.5 0 0 1 7.5 3z M7 6.5V11h10V6.5z M7.3 14.6a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z M14.3 14.6a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z',
    s: 'M8.5 18.5l-2 3 M15.5 18.5l2 3',
  },
  car: {
    f: 'M5.2 10.5 6.7 6.3A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.9 1.3l1.5 4.2A2.5 2.5 0 0 1 21 13v4.5h-2.2V19a1.3 1.3 0 0 1-2.6 0v-1.5H7.8V19a1.3 1.3 0 0 1-2.6 0v-1.5H3V13a2.5 2.5 0 0 1 2.2-2.5z M7.4 10.2h9.2l-1.1-3.2H8.5z M5.6 13.7a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M16.2 13.7a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z',
  },
};

// Category colours for the themes that colour-code their blips.
const TINT = {
  cup: '#c9793a', food: '#f08a24', drink: '#b455e0', fuel: '#e5484d', bag: '#3d8bfd', cross: '#e5484d',
  shield: '#3d6dfd', bed: '#19a6a6', coin: '#2fa84f', parking: '#3d6dfd', star: '#e6b400', tree: '#2f9e44',
  plane: '#3da5e0', train: '#6b7280', car: '#6b7280',
};
const NEON = {
  cup: '#ffb86b', food: '#ff9f43', drink: '#ff2bd6', fuel: '#ff5470', bag: '#19d3ff', cross: '#ff5470',
  shield: '#6c8cff', bed: '#3dffd2', coin: '#7dff6b', parking: '#6c8cff', star: '#fff23a', tree: '#3dff8f',
  plane: '#19d3ff', train: '#c8b6ff', car: '#c8b6ff',
};

export const BLIP_PIXEL_RATIO = 2;
const SIZE = 34; // CSS px
const PX = SIZE * BLIP_PIXEL_RATIO;

export function blipId(theme, key) {
  return `blip-${theme.id}-${key}`;
}

export function parseBlipId(id) {
  const m = /^blip-([a-z]+)-([a-z]+)$/.exec(id);
  return m && GLYPHS[m[2]] ? { themeId: m[1], key: m[2] } : null;
}

/** Draw a glyph into a box of `size` px centred on (cx, cy). */
function drawGlyph(ctx, key, cx, cy, size, color, outline) {
  const g = GLYPHS[key];
  const k = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fillPath = g.f ? new Path2D(g.f) : null;
  const strokePath = g.s ? new Path2D(g.s) : null;
  const pass = (c, grow) => {
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    if (g.t) {
      ctx.font = `900 21px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (grow) {
        ctx.lineWidth = grow;
        ctx.strokeText(g.t, 12, 12.8);
      }
      ctx.fillText(g.t, 12, 12.8);
      return;
    }
    if (fillPath) {
      if (grow) {
        ctx.lineWidth = grow;
        ctx.stroke(fillPath);
      }
      ctx.fill(fillPath, 'evenodd');
    }
    if (strokePath) {
      ctx.lineWidth = 2 + grow;
      ctx.stroke(strokePath);
    }
  };
  if (outline) pass(outline.color, outline.width);
  pass(color, 0);
  ctx.restore();
}

const RENDER = {
  // Bare white silhouette with a dark keyline.
  outline(ctx, key) {
    drawGlyph(ctx, key, PX / 2, PX / 2, PX * 0.76, '#ffffff', { color: '#090a0b', width: 3.6 });
  },
  // Ink stamp on a parchment disc.
  ink(ctx, key) {
    const r = PX / 2 - 4;
    ctx.beginPath();
    ctx.arc(PX / 2, PX / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = '#efe1bd';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4a3520';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PX / 2, PX / 2, r - 5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    drawGlyph(ctx, key, PX / 2, PX / 2, PX * 0.5, '#3b2815');
  },
  // Flat colour tile with a hard border. Kept bold: this theme renders at a third of the
  // screen resolution, so fine detail would turn to mush.
  tile(ctx, key) {
    const m = 4;
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(m, m, PX - m * 2, PX - m * 2);
    ctx.fillStyle = TINT[key] || '#6b7280';
    ctx.fillRect(m + 5, m + 5, PX - m * 2 - 10, PX - m * 2 - 10);
    drawGlyph(ctx, key, PX / 2, PX / 2, PX * 0.66, '#ffffff');
  },
  // Glowing glyph in a neon ring.
  glow(ctx, key) {
    const c = NEON[key] || '#19d3ff';
    ctx.beginPath();
    ctx.arc(PX / 2, PX / 2, PX / 2 - 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 6, 32, 0.88)';
    ctx.fill();
    ctx.shadowColor = c;
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = c;
    ctx.stroke();
    drawGlyph(ctx, key, PX / 2, PX / 2, PX * 0.46, c);
  },
  // Monochrome glyph framed by corner brackets.
  bracket(ctx, key) {
    const c = '#7dffa8';
    const a = 7;
    const b = PX - 7;
    const l = 12;
    ctx.fillStyle = 'rgba(2, 10, 4, 0.85)';
    ctx.fillRect(a, a, b - a, b - a);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[a, a, 1, 1], [b, a, -1, 1], [a, b, 1, -1], [b, b, -1, -1]]) {
      ctx.moveTo(x + dx * l, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * l);
    }
    ctx.stroke();
    drawGlyph(ctx, key, PX / 2, PX / 2, PX * 0.5, c);
  },
};

/** Render a blip to raw pixels for map.addImage(). Browser only. */
export function renderBlip(theme, key) {
  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = PX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  (RENDER[theme.blip] || RENDER.outline)(ctx, key);
  const { data } = ctx.getImageData(0, 0, PX, PX);
  return { width: PX, height: PX, data };
}

/** Same artwork as a data URL, for use in the HTML HUD. */
export function blipDataUrl(theme, key) {
  const canvas = document.createElement('canvas');
  canvas.width = PX;
  canvas.height = PX;
  (RENDER[theme.blip] || RENDER.outline)(canvas.getContext('2d'), key);
  return canvas.toDataURL();
}
