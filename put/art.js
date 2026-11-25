// Pixel art drawn in code: one palette, cached sprites for text, cards, portraits and the tavern.
import { plotText, textWidth } from './font.js';

export const C = {
  ink: '#0e0b10', night: '#1f1820', plum: '#2e2228', woodDark: '#43302b', wood: '#5e4232',
  woodLight: '#7d5a3c', tan: '#a37b4f', ochre: '#d2a96a', paper: '#f0d9a0', paperHi: '#fff4d6',
  paperShade: '#c9b48a', paperDark: '#8c7a5c', bloodDark: '#6b1f22', blood: '#a33a2c',
  ember: '#d8673a', amber: '#f2a649', moss: '#3b4a3a', sage: '#56664a', slate: '#39424e',
  slateLight: '#5b6670', ash: '#8e9aa0', chalk: '#c7ced0', skinDark: '#8a5a44', skin: '#b87d5e',
  skinLight: '#d9a07c', blue: '#4b6a8a', blueLight: '#9ec5d8',
};

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

export function ellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// Ordered-dither a second colour over a region; amount(x, y) in 0..1 says how much of it.
function dither(g, x0, y0, w, h, color, amount) {
  g.fillStyle = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (amount(x, y) * 16 > BAYER[y & 3][x & 3] + 0.5) g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------- text ----------
const textCache = new Map();

export function text(g, str, x, y, color, scale = 1, shadow = null) {
  const key = `${str}|${color}|${scale}|${shadow}`;
  let img = textCache.get(key);
  if (!img) {
    const pad = shadow ? scale : 0;
    const [c, cg] = canvas(Math.max(1, textWidth(str, scale) + pad), 9 * scale + pad);
    if (shadow) { cg.fillStyle = shadow; plotText(cg, str, scale, scale, scale); }
    cg.fillStyle = color;
    plotText(cg, str, 0, 0, scale);
    img = c;
    textCache.set(key, img);
  }
  g.drawImage(img, Math.round(x), Math.round(y));
}

export function textCentered(g, str, cx, y, color, scale = 1, shadow = null) {
  text(g, str, Math.round(cx - textWidth(str, scale) / 2), y, color, scale, shadow);
}

// ---------- cards ----------
export const CARD = { big: { w: 44, h: 62, scale: 3 }, small: { w: 36, h: 50, scale: 2 }, back: { w: 30, h: 42 } };
const cardCache = new Map();

function cardShape(g, w, h, border, fill) {
  rect(g, 1, 0, w - 2, h, border);
  rect(g, 0, 1, w, h - 2, border);
  rect(g, 1, 1, w - 2, h - 2, fill);
}

function cardFace(rank, size, glow) {
  const key = `f${rank}${size}${glow}`;
  if (cardCache.has(key)) return cardCache.get(key);
  const { w, h, scale } = CARD[size];
  const [c, g] = canvas(w, h);
  cardShape(g, w, h, glow ? C.amber : C.ink, C.paper);
  rect(g, 1, h - 3, w - 2, 2, C.paperShade);
  rect(g, w - 3, 1, 2, h - 2, C.paperShade);
  rect(g, 1, 1, w - 4, 1, C.paperHi);
  // inner frame
  rect(g, 3, 3, w - 6, 1, C.tan); rect(g, 3, h - 4, w - 6, 1, C.tan);
  rect(g, 3, 3, 1, h - 6, C.tan); rect(g, w - 4, 3, 1, h - 6, C.tan);
  const ink = rank >= 11 ? C.blood : C.ink;
  const label = String(rank);
  const tw = textWidth(label, scale);
  text(g, label, Math.round((w - tw) / 2), Math.round(h / 2 - 3.5 * scale) - 1, ink, scale);
  if (size === 'big') {
    text(g, label, 6, 6, ink);
    text(g, label, w - 6 - textWidth(label), h - 13, ink);
  }
  cardCache.set(key, c);
  return c;
}

function cardBack(w, h) {
  const key = `b${w}x${h}`;
  if (cardCache.has(key)) return cardCache.get(key);
  const [c, g] = canvas(w, h);
  cardShape(g, w, h, C.ink, C.bloodDark);
  rect(g, 2, 2, w - 4, h - 4, C.ochre);
  rect(g, 3, 3, w - 6, h - 6, C.bloodDark);
  g.fillStyle = C.blood;
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) g.fillRect(x, y, 1, 1);
  }
  ellipse(g, w >> 1, h >> 1, 4, 5, C.ochre);
  ellipse(g, w >> 1, h >> 1, 2, 3, C.bloodDark);
  cardCache.set(key, c);
  return c;
}

export function drawCard(g, x, y, rank, size = 'big', glow = false) {
  const { w, h } = CARD[size];
  rect(g, x + 2, y + 2, w - 1, h - 1, C.night);
  g.drawImage(cardFace(rank, size, glow), x, y);
}

export function drawBack(g, x, y, w = CARD.back.w, h = CARD.back.h) {
  rect(g, x + 2, y + 2, w - 1, h - 1, C.night);
  g.drawImage(cardBack(w, h), x, y);
}

// ---------- portraits (96 x 112) ----------
export const PORTRAIT = { w: 96, h: 112 };

export const EXPRESSIONS = {
  neutral: { brow: 'flat', mouth: 'line', look: [0, 0] },
  think: { brow: 'flat', mouth: 'line', look: [0, 1] },
  smirk: { brow: 'raise', mouth: 'smirk', look: [0, 0] },
  grin: { brow: 'up', mouth: 'grin', look: [0, 0] },
  smug: { brow: 'flat', mouth: 'smirk', look: [0, 0], squint: true },
  worried: { brow: 'worried', mouth: 'frown', look: [0, 0] },
  nervous: { brow: 'worried', mouth: 'wobble', look: [2, 0], sweat: true },
  sweat: { brow: 'flat', mouth: 'line', look: [0, 0], sweat: true },
  glance: { brow: 'flat', mouth: 'line', look: [-2, 0] },
  shout: { brow: 'angry', mouth: 'open', look: [0, 0] },
  angry: { brow: 'angry', mouth: 'frown', look: [0, 0] },
  frown: { brow: 'flat', mouth: 'frown', look: [0, 0] },
};

const LOOKS = {
  drunkard: { skin: C.skin, shade: C.skinDark, light: C.skinLight, cloth: C.woodLight, clothDark: C.wood, hair: C.woodDark, brow: C.woodDark, rx: 24, ry: 27 },
  miser: { skin: C.skinLight, shade: C.skin, light: C.paper, cloth: C.sage, clothDark: C.moss, hair: C.ash, brow: C.ash, rx: 19, ry: 27 },
  veteran: { skin: C.skinDark, shade: C.woodLight, light: C.skin, cloth: C.woodDark, clothDark: C.plum, hair: C.ash, brow: C.chalk, rx: 25, ry: 27 },
};

const portraitCache = new Map();

export function portrait(id, exprName, blink, sweatFrame) {
  const key = `${id}|${exprName}|${blink}|${sweatFrame}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const [c, g] = canvas(PORTRAIT.w, PORTRAIT.h);
  drawPortrait(g, id, EXPRESSIONS[exprName], blink, sweatFrame);
  portraitCache.set(key, c);
  return c;
}

function drawPortrait(g, id, ex, blink, sweatFrame) {
  const L = LOOKS[id];
  const cx = 48, cy = 52;
  // back wall with lamp light from the upper left
  rect(g, 0, 0, 96, 112, C.plum);
  dither(g, 0, 0, 96, 112, C.woodDark, (x, y) => Math.max(0, 1 - Math.hypot(x - 10, y - 10) / 90));
  // shoulders
  ellipse(g, cx, 122, 46, 32, C.ink);
  ellipse(g, cx, 122, 45, 31, L.clothDark);
  ellipse(g, cx - 4, 124, 38, 28, L.cloth);
  // neck
  rect(g, cx - 9, cy + 20, 18, 18, L.shade);

  if (id === 'miser') { // hood behind the head
    ellipse(g, cx, cy + 2, L.rx + 10, L.ry + 10, C.ink);
    ellipse(g, cx, cy + 2, L.rx + 9, L.ry + 9, C.moss);
    ellipse(g, cx - 3, cy - 2, L.rx + 6, L.ry + 6, C.sage);
  }
  // ears
  if (id !== 'miser') {
    ellipse(g, cx - L.rx, cy + 4, 4, 6, C.ink);
    ellipse(g, cx + L.rx, cy + 4, 4, 6, C.ink);
    ellipse(g, cx - L.rx, cy + 4, 3, 5, L.shade);
    ellipse(g, cx + L.rx, cy + 4, 3, 5, L.shade);
  }
  // head
  ellipse(g, cx, cy, L.rx + 1, L.ry + 1, C.ink);
  ellipse(g, cx, cy, L.rx, L.ry, L.shade);
  ellipse(g, cx - 2, cy - 1, L.rx - 3, L.ry - 2, L.skin);
  ellipse(g, cx - 8, cy - 9, Math.round(L.rx / 3), Math.round(L.ry / 3), L.light);

  if (id === 'drunkard') {
    // messy hair
    ellipse(g, cx, cy - 22, 22, 9, C.ink);
    ellipse(g, cx, cy - 22, 21, 8, L.hair);
    for (const [hx, hy] of [[-18, -18], [-12, -27], [-2, -30], [9, -28], [17, -22], [21, -14], [-21, -10]]) {
      ellipse(g, cx + hx, cy + hy, 4, 3, L.hair);
    }
    rect(g, cx - 14, cy - 24, 3, 1, C.wood); rect(g, cx + 2, cy - 26, 4, 1, C.wood);
    // stubble
    dither(g, cx - 18, cy + 10, 36, 16, L.shade, (x, y) => (Math.hypot((x - cx) / 20, (y - cy) / 27) < 0.98 && y > cy + 12 && Math.abs(y - cy - 18) > 3) ? 0.3 : 0);
    // rosy cheeks
    dither(g, cx - 16, cy + 6, 8, 5, C.blood, () => 0.4);
    dither(g, cx + 8, cy + 6, 8, 5, C.blood, () => 0.4);
  } else if (id === 'miser') {
    // grey hair parted under the hood, wrinkles, a mole
    ellipse(g, cx - 1, cy - 22, 15, 6, L.hair);
    rect(g, cx - 1, cy - 27, 1, 8, C.slateLight);
    rect(g, cx - 13, cy - 13, 7, 1, L.shade); rect(g, cx + 6, cy - 13, 7, 1, L.shade);
    rect(g, cx - 15, cy + 12, 1, 6, L.shade); rect(g, cx + 14, cy + 12, 1, 6, L.shade);
    rect(g, cx + 9, cy + 15, 2, 2, C.woodDark);
    // hood front edge
    rect(g, cx - L.rx - 6, cy - 6, 5, 40, C.sage);
    rect(g, cx + L.rx + 1, cy - 6, 5, 40, C.moss);
  } else {
    // bald with a scar, grey beard, eye patch on his right eye (viewer's left)
    rect(g, cx + 4, cy - 26, 1, 3, C.bloodDark); rect(g, cx + 5, cy - 23, 1, 4, C.bloodDark); rect(g, cx + 6, cy - 19, 1, 3, C.bloodDark);
    ellipse(g, cx, cy + 16, 22, 14, C.ink);
    ellipse(g, cx, cy + 16, 21, 13, L.hair);
    rect(g, cx - 22, cy + 2, 44, 12, L.skin);
    dither(g, cx - 20, cy + 6, 40, 8, L.hair, (x, y) => (y - (cy + 6)) / 8);
    ellipse(g, cx + 4, cy + 22, 12, 6, C.slateLight);
  }

  // eyes: 9 x 5 whites, 2 x 3 pupils that can slide fully to a side
  const eyeY = cy - 2;
  const eyes = id === 'veteran' ? [cx + 11] : [cx - 11, cx + 11];
  const half = id === 'miser' ? 3 : 4;
  for (const ex0 of eyes) {
    if (blink) {
      rect(g, ex0 - half, eyeY, half * 2 + 1, 1, C.ink);
      continue;
    }
    const top = ex.squint ? eyeY - 1 : eyeY - 2;
    rect(g, ex0 - half - 1, top - 1, half * 2 + 3, eyeY + 4 - top, C.ink);
    rect(g, ex0 - half, top, half * 2 + 1, eyeY + 2 - top, id === 'drunkard' ? C.paperShade : C.paperHi);
    const px = Math.max(ex0 - half, Math.min(ex0 + half - 1, ex0 + ex.look[0] * 2));
    rect(g, px, Math.max(top, eyeY - 1 + ex.look[1]), 2, ex.squint ? 2 : 3, C.ink);
    if (id === 'drunkard' && !ex.squint) rect(g, ex0 - half, top, half * 2 + 1, 1, L.shade); // heavy lids
  }
  if (id === 'veteran') {
    ellipse(g, cx - 11, eyeY, 6, 5, C.ink);
    rect(g, cx - 25, eyeY - 10, 20, 1, C.ink);
    for (let i = 0; i < 6; i++) rect(g, cx - 5 + i * 4, eyeY - 8 - i, 4, 1, C.ink);
  }
  if (id === 'miser') { // spectacles
    for (const ex0 of eyes) {
      rect(g, ex0 - 6, eyeY - 5, 13, 1, C.ochre); rect(g, ex0 - 6, eyeY + 4, 13, 1, C.ochre);
      rect(g, ex0 - 6, eyeY - 5, 1, 10, C.ochre); rect(g, ex0 + 6, eyeY - 5, 1, 10, C.ochre);
    }
    rect(g, cx - 4, eyeY - 2, 9, 1, C.ochre);
  }

  // brows: 11 wide, 2 thick, slanting up to 3 texels
  for (const ex0 of [cx - 11, cx + 11]) {
    const inner = ex0 < cx ? 1 : -1; // toward the nose
    const by = eyeY - 8;
    for (let i = -5; i <= 5; i++) {
      const t = (i * inner + 5) / 10; // 0 outer end, 1 inner end
      let dy = 0;
      if (ex.brow === 'angry') dy = Math.round(t * 3);
      if (ex.brow === 'worried') dy = -Math.round(t * 3) + 1;
      if (ex.brow === 'up') dy = -3;
      if (ex.brow === 'raise' && ex0 > cx) dy = -3 - Math.round((1 - t) * 1);
      rect(g, ex0 + i, by + dy, 1, 2, L.brow);
    }
  }

  // nose
  if (id === 'drunkard') {
    ellipse(g, cx, cy + 8, 5, 4, C.ink);
    ellipse(g, cx, cy + 8, 4, 3, C.blood);
    rect(g, cx - 2, cy + 6, 2, 1, C.ember);
  } else if (id === 'miser') {
    for (let i = 0; i < 10; i++) rect(g, cx + 1 + Math.floor(i / 4), cy + i, 1, 1, C.ink);
    rect(g, cx - 1, cy + 10, 5, 1, C.ink);
    rect(g, cx, cy + 2, 1, 7, L.light);
  } else {
    rect(g, cx - 1, cy + 1, 1, 7, L.shade);
    rect(g, cx - 3, cy + 8, 6, 1, C.ink);
  }

  drawMouth(g, cx, cy + 18, ex.mouth, id === 'miser' ? 6 : 8);

  if (ex.sweat) {
    const d = sweatFrame * 2;
    for (const [sx, sy] of [[cx + 19, cy - 18 + d], [cx - 21, cy - 12 + d], [cx + 16, cy + 2 + d]]) {
      rect(g, sx, sy, 1, 1, C.blue);
      rect(g, sx - 1, sy + 1, 3, 1, C.blue);
      rect(g, sx - 2, sy + 2, 5, 3, C.blue);
      rect(g, sx - 1, sy + 2, 3, 2, C.blueLight);
      rect(g, sx - 1, sy + 2, 1, 1, C.paperHi);
      rect(g, sx - 1, sy + 5, 3, 1, C.blue);
    }
  }
}

// Mouth shapes; mx, my is the centre of a neutral mouth, half its half-width.
function drawMouth(g, mx, my, kind, half) {
  const ink = C.ink;
  const row = (x0, x1, y) => rect(g, mx + x0, my + y, x1 - x0 + 1, 1, ink);
  switch (kind) {
    case 'line':
      row(-half, half, 0);
      break;
    case 'smirk': // flat on the left, hooked up on the right
      row(-half, 2, 0);
      row(3, half - 2, -1);
      row(half - 1, half, -2);
      rect(g, mx + half + 1, my - 3, 1, 1, ink);
      break;
    case 'grin':
      row(-half - 1, half + 1, -2);
      rect(g, mx - half, my - 1, half * 2 + 1, 5, ink);
      rect(g, mx - half + 1, my - 1, half * 2 - 1, 2, C.paperHi);
      rect(g, mx - half + 2, my + 2, half * 2 - 3, 1, C.blood);
      rect(g, mx - half - 2, my - 3, 1, 1, ink); rect(g, mx + half + 2, my - 3, 1, 1, ink);
      break;
    case 'frown':
      row(-half + 3, half - 3, -1);
      row(-half + 1, -half + 2, 0); row(half - 2, half - 1, 0);
      rect(g, mx - half, my + 1, 1, 1, ink); rect(g, mx + half, my + 1, 1, 1, ink);
      break;
    case 'wobble':
      for (let i = -half; i <= half; i++) rect(g, mx + i, my + [0, -1, 0, 1][(i + 16) % 4], 1, 1, ink);
      break;
    case 'open':
      ellipse(g, mx, my + 1, 6, 5, ink);
      ellipse(g, mx, my + 3, 4, 2, C.blood);
      rect(g, mx - 4, my - 3, 9, 1, C.paperHi);
      break;
  }
}

// ---------- small tavern patrons, about 32 texels tall ----------
export function drawPatron(g, x, y, look, frame) {
  // x, y = feet centre
  const { body, bodyDark, skin, hair } = look;
  rect(g, x - 5, y - 10, 4, 10, C.night); rect(g, x + 1, y - 10, 4, 10, C.night); // legs
  rect(g, x - 6, y - 1, 5, 1, C.ink); rect(g, x + 1, y - 1, 5, 1, C.ink);
  rect(g, x - 7, y - 23, 14, 14, C.ink);
  rect(g, x - 6, y - 22, 12, 12, body);
  rect(g, x + 2, y - 22, 4, 12, bodyDark);
  rect(g, x - 7, y - 12, 14, 2, C.woodDark); // belt
  rect(g, x - 4, y - 32, 8, 9, C.ink);
  rect(g, x - 3, y - 31, 6, 8, skin);
  rect(g, x - 3, y - 32, 6, 3, hair);
  rect(g, x + 1, y - 28, 1, 1, C.ink);
  // arm with tankard, lifted on frame 1
  const lift = frame ? 6 : 0;
  rect(g, x + 6, y - 21, 3, 9 - lift, bodyDark);
  rect(g, x + 7, y - 15 - lift, 5, 6, C.ash);
  rect(g, x + 7, y - 15 - lift, 5, 1, C.paperHi);
  rect(g, x + 12, y - 14 - lift, 1, 3, C.ash);
}

// ---------- static tavern backdrop ----------
export const TABLE_Y = 132;

export function backdrop() {
  const [c, g] = canvas(640, 360);
  // wall planks
  rect(g, 0, 0, 640, TABLE_Y, C.plum);
  for (let x = 0; x < 640; x += 24) {
    rect(g, x, 0, 1, TABLE_Y, C.night);
    rect(g, x + 1, 0, 1, TABLE_Y, C.woodDark);
    rect(g, x + 5, 20 + (x * 7) % 60, 1, 1, C.night);
  }
  // lamp glow on the wall
  dither(g, 0, 0, 640, TABLE_Y, C.woodDark, (x, y) => Math.max(0, 1 - Math.hypot(x - 300, (y - 14) * 1.4) / 210) * 1.2);
  dither(g, 160, 0, 280, 90, C.wood, (x, y) => Math.max(0, 1 - Math.hypot(x - 300, (y - 14) * 1.4) / 90) * 1.1);
  // bar counter
  rect(g, 136, 96, 300, 4, C.woodLight);
  rect(g, 136, 100, 300, 32, C.woodDark);
  for (let x = 140; x < 436; x += 20) rect(g, x, 102, 1, 30, C.night);
  rect(g, 136, 100, 300, 1, C.ink);
  // shelf with bottles
  rect(g, 150, 58, 270, 3, C.woodLight);
  rect(g, 150, 61, 270, 2, C.night);
  const bottles = [[162, C.sage], [176, C.bloodDark], [188, C.ochre], [214, C.moss], [226, C.blood], [262, C.sage], [348, C.blood], [362, C.ochre], [380, C.moss], [398, C.bloodDark], [410, C.sage]];
  for (const [bx, col] of bottles) {
    rect(g, bx - 1, 41, 8, 17, C.ink);
    rect(g, bx, 42, 6, 16, col);
    rect(g, bx + 1, 44, 1, 10, C.paperShade);
    rect(g, bx + 1, 34, 4, 8, C.ink);
    rect(g, bx + 2, 35, 2, 7, col);
  }
  // barrels behind the counter
  for (const bx of [300, 322]) {
    ellipse(g, bx, 82, 10, 13, C.ink);
    ellipse(g, bx, 82, 9, 12, C.wood);
    rect(g, bx - 9, 76, 19, 1, C.ash); rect(g, bx - 9, 88, 19, 1, C.ash);
    rect(g, bx - 1, 84, 2, 3, C.night);
  }
  // table
  rect(g, 0, TABLE_Y, 640, 360 - TABLE_Y, C.wood);
  for (let y = TABLE_Y + 6; y < 360; y += 22) {
    rect(g, 0, y, 640, 1, C.woodDark);
    rect(g, 0, y + 1, 640, 1, C.woodLight);
    for (let x = (y * 13) % 90; x < 640; x += 90 + (y % 30)) rect(g, x, y + 8 + (x % 9), 18 + (x % 13), 1, C.woodDark);
  }
  dither(g, 0, TABLE_Y, 640, 360 - TABLE_Y, C.woodLight, (x, y) => Math.max(0, 1 - Math.hypot((x - 300) / 300, (y - 230) / 120)) * 0.9);
  dither(g, 0, TABLE_Y, 640, 360 - TABLE_Y, C.woodDark, (x, y) => Math.max(0, Math.hypot((x - 320) / 330, (y - 200) / 190) - 0.85) * 3);
  rect(g, 0, TABLE_Y, 640, 1, C.ink);
  rect(g, 0, TABLE_Y + 1, 640, 2, C.tan);
  rect(g, 0, TABLE_Y + 3, 640, 2, C.woodLight);
  rect(g, 0, TABLE_Y + 5, 640, 1, C.woodDark);
  return c;
}

// Wooden frame with a filled interior.
export function panel(g, x, y, w, h, fill, frame = C.wood) {
  rect(g, x, y, w, h, C.ink);
  rect(g, x + 1, y + 1, w - 2, h - 2, frame);
  rect(g, x + 1, y + 1, w - 2, 1, C.woodLight);
  rect(g, x + 4, y + 4, w - 8, h - 8, C.ink);
  rect(g, x + 5, y + 5, w - 10, h - 10, fill);
}

// Starburst behind the "PUT!" call.
let burstImg = null;
export function burst() {
  if (burstImg) return burstImg;
  const [c, g] = canvas(200, 110);
  const shape = (scale, color) => {
    g.fillStyle = color;
    for (let y = 0; y < 110; y++) {
      for (let x = 0; x < 200; x++) {
        const dx = (x - 100) / 100, dy = (y - 55) / 55;
        const a = Math.atan2(dy, dx);
        const r = (0.72 + 0.28 * ((Math.floor((a + Math.PI) / (Math.PI / 8)) % 2) ? 1 : 0.55)) * scale;
        if (Math.hypot(dx, dy) < r) g.fillRect(x, y, 1, 1);
      }
    }
  };
  shape(1, C.ink);
  shape(0.94, C.blood);
  shape(0.78, C.ember);
  shape(0.6, C.amber);
  burstImg = c;
  return c;
}
