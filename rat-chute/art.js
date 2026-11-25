// All pixel art, built in code on texel grids from one palette.
import { GLYPHS } from './font.js';

export const PAL = {
  k: '#120b0f', d: '#1f1418', D: '#2e1f24', w: '#43302e', W: '#563d36',
  b: '#5a3c26', B: '#7d5533', L: '#a8784a',
  s: '#7a6446', S: '#a88d62', T: '#cdb284',
  g: '#a8741a', G: '#e0ad38', Y: '#fff0a0',
  r: '#4a4652', R: '#7a7684', p: '#d88a94',
  P: '#4f6b2e', Q: '#8fb04a',
  e: '#9c2f2a', E: '#e05a44',
  h: '#d9a066', H: '#9c6a44', i: '#f0c890',
  c: '#f4e6c6', C: '#9a8c7a',
  f: '#ff9a2a', F: '#ffd860',
  n: '#3e5f8a', v: '#6a4a7a',
};

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.a = new Array(w * h).fill('.'); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.a[y * this.w + x]; }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
  ellipse(cx, cy, rx, ry, c, shade = null) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (q <= 1) this.set(x, y, shade && (x - cx) / rx + (y - cy) / ry > 0.7 ? shade : c);
      }
  }
  // Adds a dark outline around every filled shape.
  outline(c = 'k') {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.get(x, y) === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const n = this.get(x + dx, y + dy); return n !== '.' && n !== c;
        })) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, c);
  }
  text(str, x, y, c, scale = 1) {
    let cx = x;
    for (const ch of str) {
      const g = GLYPHS[ch];
      for (let r = 0; r < 7; r++)
        for (let q = 0; q < g[r].length; q++)
          if (g[r][q] === '#') this.rect(cx + q * scale, y + r * scale, scale, scale, c);
      cx += (g[0].length + 1) * scale;
    }
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const x = cv.getContext('2d');
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++) {
        const c = this.a[j * this.w + i];
        if (c !== '.') { x.fillStyle = PAL[c]; x.fillRect(i, j, 1, 1); }
      }
    return cv;
  }
}

const strWidth = (s, scale) => [...s].reduce((w, ch) => w + (GLYPHS[ch][0].length + 1) * scale, -scale);

// ---- Sacks (34x38, centre at 17,19) ----
export const SACK_W = 34, SACK_H = 38;
const BODY = { 13: 6, 14: 6, 15: 8, 16: 10, 17: 12, 18: 13, 19: 14, 33: 14, 34: 13, 35: 11, 36: 8 };
const bodyHw = (y) => BODY[y] ?? 15;
const TEXT_COLOR = { g1: 'Y', g2: 'Y', g3: 'Y', crown: 'Y', rat: 'E', plague: 'Q' };
const LABEL = { g1: '+1', g2: '+2', g3: '+3', crown: '+5', rat: '-2', plague: '-4' };

function sackBody(g, tied) {
  for (let y = 13; y <= 36; y++) {
    const hw = bodyHw(y);
    for (let x = 17 - hw; x <= 16 + hw; x++) {
      let c = 'S';
      if (x <= 18 - hw && y < 34) c = 'T';
      if (x >= 14 + hw || y >= 34) c = 's';
      if ((x * 7 + y * 13) % 11 === 0) c = c === 'T' ? 'S' : 's';
      g.set(x, y, c);
    }
  }
  if (tied) { // closed tuft above the rope
    g.ellipse(16.5, 9, 4, 4, 'S');
    g.set(14, 7, 'T'); g.set(15, 6, 'T'); g.set(19, 9, 's'); g.set(18, 11, 's');
  } else { // open mouth
    for (const [y, hw] of [[10, 8], [11, 9], [12, 8]])
      for (let x = 17 - hw; x <= 16 + hw; x++) g.set(x, y, y === 10 ? 'T' : 'S');
    g.rect(11, 10, 12, 1, 'b'); // dark inside of the mouth
  }
  for (let x = 11; x <= 22; x++) { g.set(x, 13, 'B'); g.set(x, 14, x % 3 ? 'b' : 'L'); }
}

function coin(g, cx, cy) {
  g.ellipse(cx, cy, 3.2, 2.2, 'G');
  g.set(cx - 1, cy - 1, 'Y'); g.set(cx, cy - 1, 'Y');
  g.set(cx + 1, cy + 1, 'g'); g.set(cx + 2, cy, 'g');
}
function sparkle(g, x, y) {
  g.set(x, y, 'c'); g.set(x - 1, y, 'Y'); g.set(x + 1, y, 'Y'); g.set(x, y - 1, 'Y'); g.set(x, y + 1, 'Y');
}

function ratHead(g, frame, plague) {
  const [body, shade, inner, eye] = plague ? ['Q', 'P', 'v', 'E'] : ['R', 'r', 'p', 'k'];
  const dx = frame ? 1 : 0, cy = frame ? 7 : 8;
  g.ellipse(11 + dx, cy - 4, 2.3, 2.3, body); g.set(11 + dx, cy - 4, inner);
  g.ellipse(23 + dx, cy - 4, 2.3, 2.3, body); g.set(23 + dx, cy - 4, inner);
  g.ellipse(17 + dx, cy, 6.3, 4.3, body, shade);
  g.ellipse(17 + dx, cy + 3, 2.5, 1.6, body);
  g.set(14 + dx, cy - 1, eye); g.set(20 + dx, cy - 1, eye);
  g.set(17 + dx, cy + 4, inner); g.set(16 + dx, cy + 4, inner);
  if (plague) { g.set(13 + dx, cy + 1, 'P'); g.set(21 + dx, cy - 2, 'P'); g.set(19 + dx, cy + 2, 'P'); }
  // paws gripping the mouth of the sack
  const pawY = 11;
  g.set(10 - dx, pawY, inner); g.set(11 - dx, pawY, inner);
  g.set(23 + dx, pawY, inner); g.set(24 + dx, pawY, inner);
}

function crown(g, glint) {
  g.rect(10, 6, 14, 5, 'G');
  for (const sx of [10, 16, 22]) for (let j = 0; j < 4; j++) {
    g.set(sx + 1, 2 + j, 'G'); if (j > 0) { g.set(sx, 2 + j, 'G'); g.set(sx + 2, 2 + j, 'G'); }
  }
  g.rect(10, 10, 14, 1, 'g');
  g.set(11, 7, 'Y'); g.set(11, 8, 'Y'); g.set(17, 2, 'Y');
  g.set(16, 8, 'e'); g.set(17, 8, 'e'); g.set(12, 9, 'n'); g.set(21, 9, 'n');
  if (glint) sparkle(g, 24, 2);
}

const COINS = {
  g1: [[13, 9], [20, 10]],
  g2: [[12, 9], [21, 10], [16, 6]],
  g3: [[11, 9], [17, 10], [23, 9], [14, 6], [20, 5]],
};

// frame 0/1: glint for gold, squirm for rats.
function makeSack(kind, frame) {
  const g = new Grid(SACK_W, SACK_H);
  sackBody(g, false);
  if (COINS[kind]) {
    for (const [x, y] of COINS[kind]) coin(g, x, y);
    if (frame) { const [x, y] = COINS[kind].at(-1); sparkle(g, x + 2, y - 2); }
  } else if (kind === 'crown') crown(g, frame);
  else ratHead(g, frame, kind === 'plague');
  g.outline();
  // value plate
  g.rect(5, 19, 24, 16, 'k');
  g.rect(6, 20, 22, 14, 'd');
  const label = LABEL[kind];
  g.text(label, 17 - Math.ceil(strWidth(label, 2) / 2), 20, TEXT_COLOR[kind], 2);
  return g.canvas();
}

function makeSackBack() {
  const g = new Grid(SACK_W, SACK_H);
  sackBody(g, true);
  g.outline();
  g.text('?', 12, 19, 'C', 2);
  return g.canvas();
}

// ---- Mini sacks for the yards (18x23) ----
function makeMini(kind) {
  const g = new Grid(18, 23);
  const hws = { 5: 3, 6: 5, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 5, 13: 3 };
  for (let y = 5; y <= 13; y++) for (let x = 9 - hws[y]; x <= 8 + hws[y]; x++) g.set(x, y, x < 7 - hws[y] + 4 && y < 12 ? 'T' : x > 10 ? 's' : 'S');
  g.rect(6, 4, 6, 1, 'B');
  if (COINS[kind]) { g.rect(6, 2, 3, 2, 'G'); g.rect(10, 2, 3, 2, 'G'); g.set(6, 2, 'Y'); g.set(10, 2, 'Y'); if (kind !== 'g1') g.rect(8, 1, 2, 2, 'G'); }
  else if (kind === 'crown') { g.rect(6, 2, 7, 2, 'G'); g.set(6, 1, 'G'); g.set(9, 0, 'G'); g.set(9, 1, 'G'); g.set(12, 1, 'G'); g.set(9, 2, 'e'); }
  else {
    const [b, eye] = kind === 'plague' ? ['Q', 'E'] : ['R', 'k'];
    g.rect(6, 1, 7, 3, b); g.set(5, 0, b); g.set(13, 0, b); g.set(7, 2, eye); g.set(11, 2, eye);
  }
  g.outline();
  const label = LABEL[kind];
  const tx = 9 - Math.ceil(strWidth(label, 1) / 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.text(label, tx + dx, 15 + dy, 'k');
  g.text(label, tx, 15, TEXT_COLOR[kind]);
  return g.canvas();
}

// ---- Portraits (32x32) ----
function portraitGrubb() {
  const g = new Grid(32, 32);
  g.ellipse(16, 34, 15, 9, 'b', 'k'); g.rect(14, 25, 4, 7, 'c'); g.set(15, 31, 'C');
  g.rect(13, 21, 7, 5, 'H');
  g.ellipse(6, 15, 2.2, 2.6, 'h'); g.ellipse(26, 15, 2.2, 2.6, 'H');
  g.ellipse(16, 14, 10, 10, 'h', 'H');
  g.ellipse(16, 19, 9, 4.5, 'h', 'H');
  g.set(11, 7, 'i'); g.set(12, 6, 'i'); g.set(13, 6, 'i'); g.set(10, 8, 'i');
  for (let x = 10; x <= 13; x++) g.set(x, 11 + (x === 10 ? 1 : 0), 'b');
  for (let x = 19; x <= 22; x++) g.set(x, 11 + (x === 22 ? 1 : 0), 'b');
  g.set(12, 13, 'k'); g.set(20, 13, 'k'); g.set(11, 13, 'c'); g.set(21, 13, 'c');
  g.ellipse(16, 16, 2, 1.4, 'H'); g.set(15, 15, 'i');
  g.rect(12, 19, 9, 1, 'k'); g.rect(13, 20, 7, 1, 'k');
  g.set(14, 19, 'c'); g.set(15, 19, 'c'); g.set(17, 19, 'G'); g.set(18, 19, 'c');
  for (let y = 21; y <= 23; y++) for (let x = 10; x <= 22; x++) if ((x + y) % 3 === 0 && g.get(x, y) === 'h') g.set(x, y, 'H');
  g.set(26, 18, 'G'); g.set(26, 19, 'G');
  g.outline();
  return g.canvas();
}

function portraitHesk() {
  const g = new Grid(32, 32);
  g.ellipse(16, 34, 15, 9, 'v', 'n');
  g.ellipse(16, 15, 12, 14, 'R', 'r');
  g.ellipse(16, 17, 8, 10, 'r');
  g.ellipse(16, 17, 7, 9, 'h', 'H');
  g.rect(11, 9, 10, 2, 'C'); g.set(12, 11, 'C'); g.set(20, 11, 'C');
  g.rect(12, 14, 3, 1, 'H'); g.rect(18, 14, 3, 1, 'H');
  g.set(13, 15, 'k'); g.set(19, 15, 'k');
  g.set(16, 16, 'H'); g.set(16, 17, 'H'); g.set(16, 18, 'H'); g.set(17, 19, 'H');
  g.set(11, 18, 'H'); g.set(21, 18, 'H'); g.set(12, 20, 'H'); g.set(20, 20, 'H');
  g.rect(14, 22, 5, 1, 'e');
  g.set(9, 26, 'G');
  g.outline();
  return g.canvas();
}

function portraitVell() {
  const g = new Grid(32, 32);
  g.ellipse(16, 35, 15, 9, 'b', 'k'); g.rect(8, 28, 16, 1, 'L');
  g.ellipse(16, 15, 12, 14, 'B', 'b');
  g.ellipse(16, 18, 8, 9, 'k');
  g.ellipse(16, 18, 7, 8, 'H');
  g.rect(10, 11, 13, 3, 'b');
  g.ellipse(16, 24, 7.5, 6, 'C', 'r'); g.rect(13, 28, 7, 3, 'C');
  g.set(13, 22, 'c'); g.set(12, 24, 'c'); g.set(14, 26, 'c');
  g.rect(13, 21, 7, 1, 'c');
  for (const ex of [13, 19]) {
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) g.set(ex + dx, 17 + dy, 'G');
    g.set(ex, 17, 'k'); g.set(ex - 1, 16, 'Y');
  }
  g.set(16, 17, 'G');
  g.set(16, 19, 'h');
  g.outline();
  return g.canvas();
}

// ---- Candle (10x24), 3 flame frames ----
function makeCandle(frame) {
  const g = new Grid(10, 24);
  g.rect(0, 21, 10, 2, 'r'); g.rect(1, 20, 8, 1, 'R');
  g.rect(3, 10, 4, 10, 'c'); g.rect(6, 10, 1, 10, 'C'); g.set(3, 12, 'C'); g.set(3, 13, 'c');
  g.set(2, 11, 'c'); g.set(2, 12, 'c');
  g.set(5, 9, 'k');
  const sway = [0, 1, -1][frame];
  g.ellipse(5 + sway * 0.5, 6, 1.6, 2.8, 'f');
  g.set(5 + sway, 2, 'f');
  g.rect(4, 6, 2, 2, 'F'); g.set(5, 5, 'F');
  g.outline();
  return g.canvas();
}

// ---- Background (640x360) ----
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

export const LAYOUT = {
  chuteX: [230, 320, 410],
  slotY: [256, 178, 100], // slot 0 = your doorstep (bottom), slot 2 = rival doorstep (top)
  stepY: 78,
  chuteTop: 56, chuteBottom: 298,
  yardX: 202, yardTop: 6, yardBottom: 300, yardCols: 13, cellW: 18, cellH: 24,
  handX: [508, 556], handY: [326, 28], // handY indexed by player: [you, rival]
  candles: [[22, 236], [608, 236]],
};

function makeBackground() {
  const g = new Grid(640, 360);
  const rand = rng(7);
  g.rect(0, 0, 640, 360, 'd');
  // brick wall
  for (let y = 56; y < 300; y++)
    for (let x = 0; x < 640; x++) {
      const row = Math.floor(y / 8), off = (row % 2) * 8;
      const mortar = y % 8 === 0 || (x + off) % 16 === 0;
      let c = mortar ? 'D' : 'w';
      if (!mortar && y % 8 === 1) c = 'W';
      g.set(x, y, c);
    }
  for (let n = 0; n < 60; n++) { // a few darker bricks
    const bx = Math.floor(rand() * 40) * 16, by = 56 + Math.floor(rand() * 30) * 8, off = ((by / 8) % 2) * 8;
    for (let y = by + 1; y < by + 8; y++) for (let x = bx - off + 1; x < bx - off + 16; x++) if (g.get(x, y) !== 'D') g.set(x, y, 'D');
  }
  // candle glow and corner gloom, dithered
  for (let y = 56; y < 300; y++)
    for (let x = 0; x < 640; x++) {
      const near = LAYOUT.candles.some(([cx, cy]) => Math.hypot(x - cx - 5, (y - cy) * 1.3) < 46);
      const edge = Math.min(x, 639 - x);
      if (near && g.get(x, y) === 'W' && (x + y) % 2 === 0) g.set(x, y, 'B');
      else if (near && g.get(x, y) === 'w' && (x + y) % 4 === 0) g.set(x, y, 'W');
      else if (!near && edge < 24 && (x + y) % 2 === 0) g.set(x, y, 'd');
    }
  // floor strips above and below the wall, with yards
  for (const [y0, y1] of [[0, 56], [300, 349]]) {
    g.rect(0, y0, 640, y1 - y0, 'D');
    for (let n = 0; n < 500; n++) g.set(Math.floor(rand() * 640), y0 + Math.floor(rand() * (y1 - y0)), 'd');
    const yx = LAYOUT.yardX - 6, yw = LAYOUT.yardCols * LAYOUT.cellW + 12;
    g.rect(yx, y0 + 2, yw, y1 - y0 - 4, 'b');
    for (let n = 0; n < 350; n++) g.set(yx + Math.floor(rand() * yw), y0 + 2 + Math.floor(rand() * (y1 - y0 - 4)), rand() < 0.5 ? 'B' : 'w');
    for (let x = yx; x < yx + yw; x++) { g.set(x, y0 + 1, 'B'); g.set(x, y1 - 2, 'B'); g.set(x, y0 + 2, 'k'); g.set(x, y1 - 1, 'k'); }
    for (let x = yx; x <= yx + yw; x += 12) for (let y = y0; y < y1; y++) if (y < y0 + 4 || y > y1 - 5) g.set(x, y, 'L');
    for (let y = y0 + 1; y < y1 - 1; y++) { g.set(yx, y, 'B'); g.set(yx + yw, y, 'B'); }
  }
  g.rect(0, 349, 640, 11, 'k');
  // side panels in the wall
  const panel = (x, y, w, h) => { g.rect(x, y, w, h, 'k'); g.rect(x + 1, y + 1, w - 2, h - 2, 'd'); g.rect(x + 1, y + 1, w - 2, 1, 'D'); };
  panel(10, 126, 176, 92);
  panel(450, 64, 182, 150);
  // chutes
  for (const cx of LAYOUT.chuteX) {
    const x0 = cx - 21, x1 = cx + 20;
    for (let y = LAYOUT.chuteTop; y < LAYOUT.chuteBottom; y++) {
      for (let x = x0; x <= x1; x++) {
        let c = 'B';
        if (x <= x0 + 3 || x >= x1 - 3) c = x === x0 + 1 || x === x1 - 3 ? 'L' : 'b';
        else if ((y - LAYOUT.chuteTop) % 13 === 0) c = 'b';
        else if (x === x0 + 4 || x === x1 - 4) c = 'b';
        if (x === x0 || x === x1) c = 'k';
        g.set(x, y, c);
      }
    }
    // dark openings into the yards and stone doorsteps
    g.rect(x0 + 4, LAYOUT.chuteTop - 2, 34, 4, 'k');
    g.rect(x0 + 4, LAYOUT.chuteBottom - 2, 34, 4, 'k');
    for (const sy of [LAYOUT.slotY[0] + 19, LAYOUT.slotY[2] + 19]) {
      g.rect(x0 + 2, sy, 38, 3, 'R'); g.rect(x0 + 2, sy + 3, 38, 1, 'r'); g.rect(x0 + 2, sy - 1, 38, 1, 'k');
    }
  }
  return g.canvas();
}

// ---- Exported sprite set ----
export function buildArt() {
  const kinds = ['g1', 'g2', 'g3', 'crown', 'rat', 'plague'];
  const sack = {}, mini = {};
  for (const k of kinds) { sack[k] = [makeSack(k, 0), makeSack(k, 1)]; mini[k] = makeMini(k); }
  return {
    sack, mini, back: makeSackBack(),
    portraits: [portraitGrubb(), portraitHesk(), portraitVell()],
    candle: [0, 1, 2].map(makeCandle),
    bg: makeBackground(),
  };
}
