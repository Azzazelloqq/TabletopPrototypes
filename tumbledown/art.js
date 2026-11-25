// Palette and code-drawn sprites: candlelit table, gingerbread board, sugar and chocolate dice, portraits.
import { makeCanvas, drawText, BIG, TINY, bayer } from './font.js';
import { roll } from './rules.js';

export const W = 640;
export const H = 360;

// The whole game uses these 32 colours.
export const C = {
  ink: '#0b0a14', night: '#151428', deep: '#211f3d', blue: '#2f3058', slate: '#474c7e', steel: '#6c75a2', mist: '#a4adcb',
  wood1: '#1f140f', wood2: '#32201a', wood3: '#4a2e20',
  gin0: '#5a2f19', gin1: '#7c4424', gin2: '#9b5a2e', gin3: '#c27c40',
  icing: '#f5e9d6', icing2: '#d8c6ab',
  sug0: '#8f8aa3', sug1: '#c4bfd3', sug2: '#e6e2ee', sug3: '#fffdf6',
  ch0: '#2a130e', ch1: '#4a2216', ch2: '#6a3522', ch3: '#91573a',
  amber: '#d89342', candle: '#f4bd5c', glow: '#ffe08d',
  red1: '#8c2a33', red2: '#d9554a', pink1: '#a9506f', pink2: '#e58aa7',
};

export const TILE = 40;        // board square
export const FACE = 30;        // top face of a die
export const FRONT = 5;        // visible front side under the top face

// ---------------------------------------------------------------- dice

const SKIN = [
  { face: C.sug2, hi: C.sug3, lo: C.sug1, edge: C.sug0, num: C.ch1, small: C.ch3, front: C.sug1, frontLo: C.sug0 },
  { face: C.ch2, hi: C.ch3, lo: C.ch1, edge: C.ch0, num: C.icing, small: C.gin3, front: C.ch1, frontLo: C.ch0 },
];

const faceCache = new Map();

// Top face of a die: the big top number and, at each edge, the number that comes up when it tumbles that way.
export function faceSprite(side, o) {
  const key = `${side}|${o.join()}`;
  let c = faceCache.get(key);
  if (c) return c;
  const s = SKIN[side];
  c = makeCanvas(FACE, FACE);
  const g = c.getContext('2d');
  g.fillStyle = s.edge; g.fillRect(1, 0, FACE - 2, FACE); g.fillRect(0, 1, FACE, FACE - 2);
  g.fillStyle = s.lo; g.fillRect(1, 1, FACE - 2, FACE - 2);
  g.fillStyle = s.hi; g.fillRect(1, 1, FACE - 3, FACE - 3);
  g.fillStyle = s.face; g.fillRect(2, 2, FACE - 4, FACE - 4);
  // sugar grains / cocoa specks, kept off the numbers (the centre cross)
  const clear = v => v >= 9 && v < FACE - 9;
  for (let y = 3; y < FACE - 3; y++) {
    for (let x = 3; x < FACE - 3; x++) {
      if (clear(x) || clear(y)) continue;
      const h = (x * 73 + y * 151 + o[0] * 37) % 97;
      if (h < 3) { g.fillStyle = s.hi; g.fillRect(x, y, 1, 1); } else if (h < 5) { g.fillStyle = s.lo; g.fillRect(x, y, 1, 1); }
    }
  }
  drawText(g, String(o[0]), FACE / 2 - 3, FACE / 2 - 4, s.num, { font: BIG });
  const mid = FACE / 2 - 2;
  drawText(g, String(roll(o, 'N')[0]), mid, 3, s.small, { font: TINY });
  drawText(g, String(roll(o, 'S')[0]), mid, FACE - 8, s.small, { font: TINY });
  drawText(g, String(roll(o, 'W')[0]), 3, mid, s.small, { font: TINY });
  drawText(g, String(roll(o, 'E')[0]), FACE - 6, mid, s.small, { font: TINY });
  faceCache.set(key, c);
  return c;
}

const frontCache = [0, 1].map(side => {
  const s = SKIN[side];
  const c = makeCanvas(FACE, FRONT);
  const g = c.getContext('2d');
  g.fillStyle = s.frontLo; g.fillRect(1, 0, FACE - 2, FRONT); g.fillRect(0, 0, FACE, FRONT - 1);
  g.fillStyle = s.front; g.fillRect(1, 0, FACE - 2, FRONT - 2);
  return c;
});
export const frontSprite = side => frontCache[side];

// Small blank cube for the hand trays.
const cubeCache = [0, 1].map(side => {
  const s = SKIN[side];
  const c = makeCanvas(12, 14);
  const g = c.getContext('2d');
  g.fillStyle = s.edge; g.fillRect(0, 0, 12, 14);
  g.fillStyle = s.front; g.fillRect(1, 10, 10, 3);
  g.fillStyle = s.face; g.fillRect(1, 1, 10, 9);
  g.fillStyle = s.hi; g.fillRect(1, 1, 9, 1); g.fillRect(1, 1, 1, 8);
  g.fillStyle = s.num; g.fillRect(5, 5, 2, 2);
  return c;
});
export const cubeSprite = side => cubeCache[side];

// Outline around a square, used for legal destinations and selection.
export function outline(ctx, x, y, w, h, colour, dashed = false, phase = 0) {
  ctx.fillStyle = colour;
  if (!dashed) {
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    return;
  }
  for (let i = 0; i < w; i++) if (((i + phase) >> 2) % 2 === 0) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + w - 1 - i, y + h - 1, 1, 1); }
  for (let i = 0; i < h; i++) if (((i + phase) >> 2) % 2 === 0) { ctx.fillRect(x + w - 1, y + i, 1, 1); ctx.fillRect(x, y + h - 1 - i, 1, 1); }
}

// ---------------------------------------------------------------- background: table, board, trays

export const CANDLES = [{ x: 96, y: 300 }, { x: 560, y: 186 }];

// layout: { bx, by, cols, rows, homeRows, trays: [{x,y,w,h}] }
export function buildBackground(L, flicker) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  // dark table planks lit by candles
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let light = 0;
      for (const cd of CANDLES) {
        const d = Math.hypot((x - cd.x) * 0.8, y - cd.y);
        light = Math.max(light, 1 - d / 330);
      }
      light *= flicker;
      const plank = Math.floor((y + (x > 320 ? 9 : 0)) / 23);
      const seam = (y + (x > 320 ? 9 : 0)) % 23 === 0;
      const grain = ((x * 7 + plank * 131) % 53) < 2 ? -0.12 : 0;
      const v = light + grain + bayer(x, y) * 0.22 - 0.06;
      g.fillStyle = seam ? C.ink : v > 0.62 ? C.wood3 : v > 0.32 ? C.wood2 : v > 0.1 ? C.wood1 : C.ink;
      g.fillRect(x, y, 1, 1);
    }
  }
  // the gingerbread slab
  const bw = L.cols * TILE, bh = L.rows * TILE;
  const sx = L.bx - 8, sy = L.by - 8, sw = bw + 16, sh = bh + 16;
  g.fillStyle = C.ink; g.fillRect(sx - 1, sy + 3, sw + 3, sh + 4);
  g.fillStyle = C.gin0; g.fillRect(sx, sy, sw, sh + 4);
  g.fillStyle = C.gin1; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = C.gin2; g.fillRect(sx + 1, sy + 1, sw - 2, 1);
  // icing scallops around the rim
  for (let x = sx + 2; x < sx + sw - 2; x += 4) {
    g.fillStyle = C.icing; g.fillRect(x, sy + 3, 2, 2); g.fillRect(x, sy + sh - 5, 2, 2);
  }
  for (let y = sy + 6; y < sy + sh - 4; y += 4) {
    g.fillStyle = C.icing; g.fillRect(sx + 3, y, 2, 2); g.fillRect(sx + sw - 5, y, 2, 2);
  }
  // squares
  for (let r = 0; r < L.rows; r++) {
    for (let col = 0; col < L.cols; col++) {
      const x = L.bx + col * TILE, y = L.by + (L.rows - 1 - r) * TILE;
      const dark = (r + col) % 2 === 0;
      g.fillStyle = dark ? C.gin1 : C.gin2;
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle = dark ? C.gin0 : C.gin1;
      g.fillRect(x, y + TILE - 1, TILE, 1); g.fillRect(x + TILE - 1, y, 1, TILE);
      g.fillStyle = dark ? C.gin2 : C.gin3;
      g.fillRect(x, y, TILE - 1, 1); g.fillRect(x, y, 1, TILE - 1);
      // a few baked crumbs
      for (let k = 0; k < 5; k++) {
        const h = (r * 97 + col * 41 + k * 59) % 1000;
        g.fillStyle = k % 2 ? C.gin3 : C.gin0;
        g.fillRect(x + 4 + (h % 31), y + 4 + Math.floor(h / 31) % 31, 1, 1);
      }
      // home rows: sugar dusting for you (bottom), cocoa dusting for the rival (top)
      const home = r < L.homeRows ? 0 : r >= L.rows - L.homeRows ? 1 : -1;
      if (home >= 0) {
        g.fillStyle = home === 0 ? C.icing2 : C.ch1;
        for (let yy = 2; yy < TILE - 2; yy += 3) for (let xx = 2 + (yy % 2); xx < TILE - 2; xx += 5) {
          if (((xx * 13 + yy * 7 + r * 5) % 7) < 2) g.fillRect(x + xx, y + yy, 1, 1);
        }
      }
    }
  }
  // icing line where each side's home rows end
  for (const yLine of [L.by + (L.rows - L.homeRows) * TILE, L.by + L.homeRows * TILE]) {
    for (let x = L.bx; x < L.bx + bw; x++) {
      g.fillStyle = (x >> 1) % 2 ? C.icing : C.icing2;
      g.fillRect(x, yLine - 1, 1, 2);
    }
  }
  // hand trays: little wooden boxes
  for (const t of L.trays) {
    g.fillStyle = C.ink; g.fillRect(t.x - 1, t.y - 1, t.w + 2, t.h + 3);
    g.fillStyle = C.gin0; g.fillRect(t.x, t.y, t.w, t.h + 1);
    g.fillStyle = C.wood1; g.fillRect(t.x + 3, t.y + 3, t.w - 6, t.h - 6);
    g.fillStyle = C.gin2; g.fillRect(t.x, t.y, t.w, 1);
  }
  return c;
}

export function drawCandle(ctx, cd, frame) {
  const { x, y } = cd;
  ctx.fillStyle = C.ink; ctx.fillRect(x - 6, y + 22, 13, 3);
  ctx.fillStyle = C.wood3; ctx.fillRect(x - 6, y + 20, 13, 3);
  ctx.fillStyle = C.icing2; ctx.fillRect(x - 3, y, 7, 21);
  ctx.fillStyle = C.icing; ctx.fillRect(x - 3, y, 3, 21); ctx.fillRect(x + 1, y, 1, 6);
  ctx.fillStyle = C.ink; ctx.fillRect(x, y - 2, 1, 2);
  const sway = [0, 1, 0, -1, 0, 0][frame % 6];
  const tall = [7, 8, 7, 6, 8, 7][frame % 6];
  ctx.fillStyle = C.amber; ctx.fillRect(x - 1 + sway, y - 2 - tall, 3, tall);
  ctx.fillStyle = C.candle; ctx.fillRect(x + sway, y - 3 - tall, 1, tall - 1);
  ctx.fillStyle = C.glow; ctx.fillRect(x + sway, y - tall + 1, 1, tall - 4);
}

// ---------------------------------------------------------------- portraits (44x44 busts)

// spec: { skin, hair, coat, trim, hat: 'cap'|'kerchief'|'bald'|'tophat', beard, eyes }
export function portrait(spec, blink) {
  const c = makeCanvas(44, 44);
  const g = c.getContext('2d');
  const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // shoulders and coat
  R(C.ink, 6, 33, 32, 11);
  R(spec.coat[0], 7, 34, 30, 10);
  R(spec.coat[1], 9, 34, 26, 2);
  R(spec.trim, 20, 35, 4, 9);
  // neck and head
  R(spec.skin[0], 18, 28, 8, 6);
  R(C.ink, 11, 9, 22, 22);
  R(spec.skin[1], 12, 10, 20, 20);
  R(spec.skin[2], 13, 11, 12, 6);
  R(spec.skin[0], 12, 26, 20, 4);
  // ears
  R(spec.skin[0], 10, 17, 2, 5); R(spec.skin[0], 32, 17, 2, 5);
  // eyes
  if (blink) { R(C.ink, 16, 19, 4, 1); R(C.ink, 24, 19, 4, 1); }
  else { R(C.ink, 16, 18, 4, 3); R(C.ink, 24, 18, 4, 3); R(spec.eyes, 17, 19, 1, 1); R(spec.eyes, 25, 19, 1, 1); }
  // mouth
  R(spec.skin[0], 19, 25, 6, 1);
  if (spec.hat === 'cap') {
    R(C.ink, 10, 2, 24, 10); R(C.icing, 11, 3, 22, 7); R(C.icing2, 11, 9, 22, 2); R(C.sug3, 14, 4, 6, 2);
    R(spec.hair, 12, 12, 3, 3); R(spec.hair, 29, 12, 3, 3);
    // freckles
    R(spec.skin[0], 15, 22, 1, 1); R(spec.skin[0], 17, 23, 1, 1); R(spec.skin[0], 27, 22, 1, 1); R(spec.skin[0], 25, 23, 1, 1);
  } else if (spec.hat === 'kerchief') {
    R(C.ink, 10, 6, 24, 8); R(spec.trim, 11, 7, 22, 6); R(C.icing, 14, 8, 2, 2); R(C.icing, 22, 9, 2, 2); R(C.icing, 28, 8, 2, 2);
    R(spec.hair, 11, 13, 3, 8); R(spec.hair, 30, 13, 3, 8);
    R(C.pink1, 14, 22, 3, 2); R(C.pink1, 27, 22, 3, 2);
  } else if (spec.hat === 'bald') {
    R(spec.skin[2], 15, 10, 8, 2);
    R(spec.hair, 11, 14, 2, 6); R(spec.hair, 31, 14, 2, 6);
    R(spec.hair, 14, 17, 6, 1); R(spec.hair, 24, 17, 6, 1);
    R(C.ink, 12, 23, 20, 10); R(spec.hair, 13, 23, 18, 9); R(C.sug3, 15, 24, 3, 1); R(spec.skin[0], 19, 25, 6, 1);
  } else if (spec.hat === 'tophat') {
    R(C.ink, 7, 9, 30, 4); R(C.ink, 12, 0, 20, 10);
    R(C.ch1, 13, 1, 18, 9); R(C.red1, 13, 7, 18, 2); R(C.ch2, 8, 10, 28, 2);
    R(spec.hair, 12, 13, 2, 7); R(spec.hair, 30, 13, 2, 7);
    R(C.ink, 15, 24, 14, 1); R(spec.hair, 17, 23, 3, 1); R(spec.hair, 24, 23, 3, 1);
  }
  return c;
}
