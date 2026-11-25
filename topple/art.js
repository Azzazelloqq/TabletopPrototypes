// Palette, bitmap fonts and sprites. Everything is drawn in code at 1 texel = 1 canvas pixel.

export const W = 640;
export const H = 360;

// The whole game uses these 32 colours.
export const C = {
  ink: '#0b0a14', night: '#151428', deep: '#211f3d', blue: '#2f3058',
  slate: '#474c7e', steel: '#6c75a2', mist: '#a4adcb', pale: '#d6dcec',
  wood1: '#2f1d15', wood2: '#47291b', wood3: '#653b22', wood4: '#8a532d', wood5: '#b2713a',
  amber: '#d89342', candle: '#f4bd5c', glow: '#ffe08d', cream: '#fff4d4',
  red0: '#4d1622', red1: '#86282f', red2: '#cf5340',
  green0: '#283c2b', green1: '#4b6a3d', green2: '#7d9a53',
  sand1: '#a98a60', sand2: '#d3bb8e', sand3: '#eedfba',
  skin0: '#86503a', skin1: '#c27f57', skin2: '#e7b189',
  plum0: '#2e1c35', plum1: '#4c2f50', plum2: '#76496f',
};

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').imageSmoothingEnabled = false;
  return canvas;
}

// Builds a sprite from text rows; key maps a character to a colour, unknown characters stay transparent.
export function spriteFromRows(rows, key) {
  const w = Math.max(...rows.map(row => row.length));
  const canvas = makeCanvas(w, rows.length);
  const g = canvas.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = key[row[x]];
      if (!colour) continue;
      g.fillStyle = colour;
      g.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

// ---------------------------------------------------------------- fonts

const g = s => s.split(' ');

const SMALL_GLYPHS = {
  A: g('.###. #...# #...# ##### #...# #...# #...#'), B: g('####. #...# #...# ####. #...# #...# ####.'),
  C: g('.###. #...# #.... #.... #.... #...# .###.'), D: g('####. #...# #...# #...# #...# #...# ####.'),
  E: g('##### #.... #.... ####. #.... #.... #####'), F: g('##### #.... #.... ####. #.... #.... #....'),
  G: g('.###. #...# #.... #.### #...# #...# .####'), H: g('#...# #...# #...# ##### #...# #...# #...#'),
  I: g('### .#. .#. .#. .#. .#. ###'), J: g('..### ...#. ...#. ...#. #..#. #..#. .##..'),
  K: g('#...# #..#. #.#.. ##... #.#.. #..#. #...#'), L: g('#.... #.... #.... #.... #.... #.... #####'),
  M: g('#...# ##.## #.#.# #.#.# #...# #...# #...#'), N: g('#...# #...# ##..# #.#.# #..## #...# #...#'),
  O: g('.###. #...# #...# #...# #...# #...# .###.'), P: g('####. #...# #...# ####. #.... #.... #....'),
  Q: g('.###. #...# #...# #...# #.#.# #..#. .##.#'), R: g('####. #...# #...# ####. #.#.. #..#. #...#'),
  S: g('.#### #.... #.... .###. ....# ....# ####.'), T: g('##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'),
  U: g('#...# #...# #...# #...# #...# #...# .###.'), V: g('#...# #...# #...# #...# #...# .#.#. ..#..'),
  W: g('#...# #...# #...# #.#.# #.#.# ##.## #...#'), X: g('#...# #...# .#.#. ..#.. .#.#. #...# #...#'),
  Y: g('#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'), Z: g('##### ....# ...#. ..#.. .#... #.... #####'),
  a: g('..... ..... .###. ....# .#### #...# .####'), b: g('#.... #.... ####. #...# #...# #...# ####.'),
  c: g('.... .... .### #... #... #... .###'), d: g('....# ....# .#### #...# #...# #...# .####'),
  e: g('..... ..... .###. #...# ##### #.... .###.'), f: g('..## .#.. #### .#.. .#.. .#.. .#..'),
  g: g('..... ..... .#### #...# #...# #...# .#### ....# .###.'), h: g('#.... #.... ####. #...# #...# #...# #...#'),
  i: g('# . # # # # #'), j: g('..# ... ..# ..# ..# ..# ..# ..# ##.'),
  k: g('#... #... #..# #.#. ##.. #.#. #..#'), l: g('#. #. #. #. #. #. .#'),
  m: g('..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#'), n: g('.... .... ###. #..# #..# #..# #..#'),
  o: g('..... ..... .###. #...# #...# #...# .###.'), p: g('..... ..... ####. #...# #...# #...# ####. #.... #....'),
  q: g('..... ..... .#### #...# #...# #...# .#### ....# ....#'), r: g('.... .... #.## ##.. #... #... #...'),
  s: g('.... .... .### #... .##. ...# ###.'), t: g('.#.. .#.. #### .#.. .#.. .#.. ..##'),
  u: g('.... .... #..# #..# #..# #..# .###'), v: g('..... ..... #...# #...# #...# .#.#. ..#..'),
  w: g('..... ..... #...# #...# #.#.# #.#.# .#.#.'), x: g('..... ..... #...# .#.#. ..#.. .#.#. #...#'),
  y: g('.... .... #..# #..# #..# #..# .### ...# .##.'), z: g('.... .... #### ...# .##. #... ####'),
  0: g('.###. #...# #..## #.#.# ##..# #...# .###.'), 1: g('.#. ##. .#. .#. .#. .#. ###'),
  2: g('.###. #...# ....# ..##. .#... #.... #####'), 3: g('####. ....# ....# .###. ....# ....# ####.'),
  4: g('...#. ..##. .#.#. #..#. ##### ...#. ...#.'), 5: g('##### #.... ####. ....# ....# #...# .###.'),
  6: g('.###. #.... #.... ####. #...# #...# .###.'), 7: g('##### ....# ...#. ..#.. .#... .#... .#...'),
  8: g('.###. #...# #...# .###. #...# #...# .###.'), 9: g('.###. #...# #...# .#### ....# ....# .###.'),
  ' ': g('... ... ... ... ... ... ...'), '.': g('. . . . . . #'), ',': g('.. .. .. .. .. .# #.'),
  ':': g('. . # . . # .'), '!': g('# # # # # . #'), '?': g('.###. #...# ....# ...#. ..#.. ..... ..#..'),
  '-': g('... ... ... ### ... ... ...'), '+': g('..... ..#.. ..#.. ##### ..#.. ..#.. .....'),
  '/': g('..# ..# .#. .#. .#. #.. #..'), "'": g('# # . . . . .'), '(': g('.# #. #. #. #. #. .#'),
  ')': g('#. .# .# .# .# .# #.'), '=': g('.... .... #### .... #### .... ....'),
  '[': g('## #. #. #. #. #. ##'), ']': g('## .# .# .# .# .# ##'),
  '>': g('#... .#.. ..#. ...# ..#. .#.. #...'), '<': g('...# ..#. .#.. #... .#.. ..#. ...#'),
};

const BIG_GLYPHS = {
  0: g('.####. ##..## ##..## ##..## ##..## ##..## ##..## ##..## .####.'),
  1: g('..##.. .###.. ..##.. ..##.. ..##.. ..##.. ..##.. ..##.. .####.'),
  2: g('.####. ##..## ....## ....## ...##. ..##.. .##... ##.... ######'),
  3: g('.####. ##..## ....## ....## ..###. ....## ....## ##..## .####.'),
  4: g('...##. ..###. .####. ##.##. ##.##. ###### ...##. ...##. ...##.'),
  5: g('###### ##.... ##.... #####. ....## ....## ....## ##..## .####.'),
  6: g('.####. ##..## ##.... ##.... #####. ##..## ##..## ##..## .####.'),
  7: g('###### ....## ....## ...##. ...##. ..##.. ..##.. ..##.. ..##..'),
  8: g('.####. ##..## ##..## ##..## .####. ##..## ##..## ##..## .####.'),
  9: g('.####. ##..## ##..## ##..## .##### ....## ....## ##..## .####.'),
  T: g('###### ###### ..##.. ..##.. ..##.. ..##.. ..##.. ..##.. ..##..'),
  O: g('.####. ##..## ##..## ##..## ##..## ##..## ##..## ##..## .####.'),
  P: g('#####. ##..## ##..## ##..## #####. ##.... ##.... ##.... ##....'),
  L: g('##.... ##.... ##.... ##.... ##.... ##.... ##.... ###### ######'),
  E: g('###### ##.... ##.... #####. ##.... ##.... ##.... ##.... ######'),
  '+': g('...... ...... ..##.. ..##.. ###### ###### ..##.. ..##.. ......'),
  '-': g('...... ...... ...... ...... ###### ###### ...... ...... ......'),
  ' ': g('.... .... .... .... .... .... .... .... ....'),
};

export const SMALL = { glyphs: SMALL_GLYPHS, spacing: 1, name: 'small' };
export const BIG = { glyphs: BIG_GLYPHS, spacing: 2, name: 'big' };

const glyphCache = new Map();
function glyphSprite(font, ch, colour) {
  const key = `${font.name}|${ch}|${colour}`;
  let sprite = glyphCache.get(key);
  if (!sprite) {
    sprite = spriteFromRows(font.glyphs[ch] ?? font.glyphs['?'] ?? font.glyphs[' '], { '#': colour });
    glyphCache.set(key, sprite);
  }
  return sprite;
}

const glyphWidth = (font, ch) => (font.glyphs[ch] ?? font.glyphs['?'] ?? font.glyphs[' '])[0].length;

export function textWidth(text, font = SMALL) {
  let w = 0;
  for (const ch of text) w += glyphWidth(font, ch) + font.spacing;
  return Math.max(0, w - font.spacing);
}

// opts: { font, align: 'left' | 'center' | 'right', shadow: colour }
export function drawText(ctx, text, x, y, colour, opts = {}) {
  const font = opts.font ?? SMALL;
  if (opts.align === 'center') x -= Math.floor(textWidth(text, font) / 2);
  else if (opts.align === 'right') x -= textWidth(text, font);
  x = Math.round(x);
  y = Math.round(y);
  for (const ch of text) {
    if (opts.shadow) ctx.drawImage(glyphSprite(font, ch, opts.shadow), x + 1, y + 1);
    ctx.drawImage(glyphSprite(font, ch, colour), x, y);
    x += glyphWidth(font, ch) + font.spacing;
  }
}

// Title letters built from little stone bricks, one brick per glyph pixel.
export function stoneTitle(text) {
  const brick = spriteFromRows(['TTTs', 'Tffs', 'Tffs', 'ssss'], { T: C.sand3, f: C.sand2, s: C.sand1 });
  const w = textWidth(text, BIG) * 4 + 3;
  const canvas = makeCanvas(w, 9 * 4 + 3);
  const ctx = canvas.getContext('2d');
  let x0 = 0;
  for (const ch of text) {
    const rows = BIG_GLYPHS[ch];
    for (const pass of [0, 1]) {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '#') continue;
          if (pass === 0) { ctx.fillStyle = C.ink; ctx.fillRect(x0 + x * 4 - 1, y * 4 - 1, 6, 6); ctx.fillRect(x0 + x * 4 + 2, y * 4 + 2, 5, 5); }
          else ctx.drawImage(brick, x0 + x * 4, y * 4);
        }
      });
    }
    x0 += (rows[0].length + BIG.spacing) * 4;
  }
  return canvas;
}

// ---------------------------------------------------------------- dice

// 14x16: three rows of top face, then the front face that shows the value.
const DIE_ROWS = [
  '.oooooooooooo.',
  'oTTTTTTTTTTTTo',
  'otttttttttttto',
  'ohhhhhhhhhhhso',
  ...Array(10).fill('ohffffffffffso'),
  'osssssssssssso',
  '.oooooooooooo.',
];
export const DIE_W = 14;
export const DIE_H = 16;
export const DIE_STEP = 13; // vertical distance between stacked dice
export const FLAT_H = 13;

const PIPS = {
  1: [[1, 1]], 2: [[2, 0], [0, 2]], 3: [[2, 0], [1, 1], [0, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

const STONE = [
  { T: C.cream, t: C.sand3, h: C.sand3, f: C.sand2, s: C.sand1, p: C.wood2 }, // player: warm sandstone
  { T: C.pale, t: C.pale, h: C.pale, f: C.mist, s: C.steel, p: C.night },   // opponent: cold slate
];
const OUTLINE = { normal: C.ink, hi: C.glow, red: C.red2 };

const dieCache = new Map();
// style: 'normal' | 'hi' | 'red' | 'ghost'; flat: only the front face (loot tray).
export function dieSprite(v, owner, style = 'normal', flat = false) {
  const key = `${v}|${owner}|${style}|${flat}`;
  let sprite = dieCache.get(key);
  if (sprite) return sprite;
  const rows = DIE_ROWS.map(row => row.split(''));
  for (const [cx, cy] of PIPS[v]) {
    const x = 3 + cx * 3;
    const y = 5 + cy * 3;
    rows[y][x] = rows[y][x + 1] = rows[y + 1][x] = rows[y + 1][x + 1] = 'p';
  }
  let text = rows.map(row => row.join(''));
  if (flat) text = ['.oooooooooooo.', ...text.slice(4)];
  if (style === 'ghost') {
    text = text.map((row, y) => row.split('').map((ch, x) => (ch !== 'o' && (x + y) % 2 ? '.' : ch)).join(''));
  }
  sprite = spriteFromRows(text, { ...STONE[owner], o: style === 'ghost' ? C.glow : OUTLINE[style] });
  dieCache.set(key, sprite);
  return sprite;
}

// ---------------------------------------------------------------- characters

const RAMPS = {
  skin: [C.skin0, C.skin1, C.skin2], shadedSkin: [C.skin0, C.skin0, C.skin1],
  beard: [C.wood2, C.wood3, C.wood4], tunic: [C.green0, C.green1, C.green2], apron: [C.sand1, C.sand2, C.sand3],
  hood: [C.night, C.blue, C.slate], scarf: [C.red0, C.red1, C.red2], leather: [C.wood1, C.wood2, C.wood3],
  hair: [C.steel, C.mist, C.pale], shawl: [C.plum0, C.plum1, C.plum2], gold: [C.amber, C.candle, C.glow],
  mug: [C.wood2, C.wood3, C.wood4], steel: [C.steel, C.mist, C.pale],
};

// Paints a 32x32 figure from shapes, shades every part (lit from the upper left) and outlines it.
function paintFigure(paint, blink) {
  const N = 32;
  const mat = Array.from({ length: N }, () => Array(N).fill(null));
  const fixed = [];
  const set = (x, y, m) => { if (x >= 0 && y >= 0 && x < N && y < N) mat[y][x] = m; };
  const api = {
    ell(cx, cy, rx, ry, m) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, m);
      }
    },
    rect(x0, y0, w, h, m) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, m); },
    px(x, y, m) { set(x, y, m); },
    fix(x, y, colour) { fixed.push([x, y, colour]); },
  };
  paint(api, blink);
  const canvas = makeCanvas(N, N);
  const ctx = canvas.getContext('2d');
  const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? mat[y][x] : null);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const m = mat[y][x];
    if (m) {
      const ramp = RAMPS[m];
      ctx.fillStyle = at(x - 1, y - 1) !== m ? ramp[2] : at(x + 1, y + 1) !== m ? ramp[0] : ramp[1];
    } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
      ctx.fillStyle = C.ink;
    } else continue;
    ctx.fillRect(x, y, 1, 1);
  }
  for (const [x, y, colour] of fixed) { ctx.fillStyle = colour; ctx.fillRect(x, y, 1, 1); }
  return canvas;
}

const FIGURES = {
  // Hobb the brewer: bald, bushy beard, green tunic, apron, a mug at hand.
  hobb(p, blink) {
    p.ell(16, 25, 11, 6, 'tunic');
    p.rect(11, 21, 10, 8, 'apron');
    p.ell(16, 11, 6, 7, 'skin');
    p.px(9, 11, 'skin'); p.px(23, 11, 'skin');
    p.ell(16, 17, 6, 5, 'beard');
    p.rect(13, 13, 7, 1, 'beard');
    p.ell(16, 28, 13, 3, 'tunic');
    p.ell(11, 28, 3, 2, 'skin'); p.ell(21, 28, 3, 2, 'skin');
    p.rect(24, 21, 5, 8, 'mug'); p.px(29, 23, 'mug'); p.px(29, 26, 'mug'); p.px(30, 24, 'mug'); p.px(30, 25, 'mug');
    p.fix(24, 21, C.cream); p.fix(25, 21, C.cream); p.fix(26, 21, C.cream); p.fix(27, 21, C.cream); p.fix(28, 21, C.cream);
    p.fix(12, 8, C.wood3); p.fix(13, 8, C.wood3); p.fix(19, 8, C.wood3); p.fix(20, 8, C.wood3);
    for (const x of [13, 19]) p.fix(x, 10, blink ? C.skin0 : C.ink), p.fix(x + 1, 10, blink ? C.skin0 : C.ink);
    p.fix(16, 11, C.skin0); p.fix(16, 12, C.skin0); p.fix(17, 12, C.skin0);
    p.fix(15, 16, C.wood1); p.fix(16, 16, C.wood1); p.fix(17, 16, C.wood1);
  },
  // Rook the cutpurse: deep hood, red scarf over the mouth, a knife on the table.
  rook(p, blink) {
    p.ell(16, 25, 11, 6, 'hood');
    p.ell(16, 11, 8, 9, 'hood');
    p.px(16, 1, 'hood'); p.px(15, 2, 'hood'); p.px(17, 2, 'hood');
    p.ell(16, 12, 4, 5, 'shadedSkin');
    p.ell(16, 17, 6, 3, 'scarf');
    p.rect(19, 19, 3, 6, 'scarf');
    p.ell(16, 28, 13, 3, 'hood');
    p.rect(24, 28, 7, 1, 'steel'); p.px(23, 28, 'leather'); p.px(22, 28, 'leather');
    p.ell(12, 28, 3, 2, 'leather'); p.ell(21, 28, 3, 2, 'leather');
    p.fix(13, 9, C.ink); p.fix(14, 9, C.ink); p.fix(18, 9, C.ink); p.fix(19, 9, C.ink);
    if (blink) { p.fix(14, 11, C.skin0); p.fix(18, 11, C.skin0); }
    else { p.fix(14, 11, C.glow); p.fix(13, 11, C.ink); p.fix(18, 11, C.glow); p.fix(19, 11, C.ink); }
    p.fix(16, 12, C.skin0); p.fix(16, 13, C.skin0);
  },
  // Mother Tallow the miser: grey bun, plum shawl, a gold coin held close.
  tallow(p, blink) {
    p.ell(16, 25, 11, 6, 'shawl');
    p.ell(16, 12, 6, 7, 'skin');
    p.ell(16, 8, 7, 4, 'hair');
    p.ell(16, 3, 3, 2, 'hair');
    p.rect(9, 8, 2, 7, 'hair'); p.rect(22, 8, 2, 7, 'hair');
    p.ell(16, 21, 8, 3, 'shawl');
    p.ell(16, 28, 13, 3, 'shawl');
    p.ell(13, 28, 3, 2, 'skin'); p.ell(19, 28, 3, 2, 'skin');
    p.ell(16, 26, 2, 2, 'gold');
    if (blink) { p.fix(13, 12, C.skin0); p.fix(14, 12, C.skin0); p.fix(18, 12, C.skin0); p.fix(19, 12, C.skin0); }
    else { p.fix(13, 12, C.ink); p.fix(14, 12, C.ink); p.fix(18, 12, C.ink); p.fix(19, 12, C.ink); p.fix(14, 11, C.skin0); p.fix(18, 11, C.skin0); }
    p.fix(16, 13, C.skin0); p.fix(16, 14, C.skin0); p.fix(15, 15, C.skin0);
    p.fix(15, 17, C.wood2); p.fix(16, 17, C.wood2); p.fix(17, 17, C.wood2);
  },
};

const figureCache = new Map();
export function figureSprite(id, blink = false) {
  const key = `${id}|${blink}`;
  if (!figureCache.has(key)) figureCache.set(key, paintFigure(FIGURES[id], blink));
  return figureCache.get(key);
}

// ---------------------------------------------------------------- candle and background

export const CANDLES = [
  { x: 226, y: 82, r: 250, i: 1.0 },
  { x: 414, y: 82, r: 250, i: 1.0 },
  { x: 624, y: 334, r: 190, i: 0.8 },
];

const FLAMES = [
  ['.c.', 'cgc', 'gwg', 'gwg', '.g.'],
  ['..c', '.cg', 'cgw', 'gwg', '.g.'],
  ['c..', 'gc.', 'wgc', 'gwg', '.g.'],
].map(rows => spriteFromRows(rows, { c: C.amber, g: C.candle, w: C.cream }));
const CANDLE_BODY = spriteFromRows([
  '...o...',
  '..ohho.',
  '..ohfso',
  '..ohfso',
  '..ohfso',
  '..ohfso',
  '..ohfso',
  '..ohfso',
  '..ohfso',
  '.oahbbao',
  'oaaaaaaao',
  '.ooooooo.',
], { o: C.ink, h: C.cream, f: C.sand3, s: C.sand2, a: C.amber, b: C.wood4 });

export function drawCandle(ctx, candle, frame) {
  ctx.drawImage(CANDLE_BODY, candle.x - 4, candle.y - 12);
  ctx.drawImage(FLAMES[frame % 3], candle.x - 1, candle.y - 17);
}

const WOOD = [C.ink, C.wood1, C.wood2, C.wood3, C.wood4, C.wood5, C.amber, C.candle];
const WALL = [C.ink, C.night, C.deep, C.wood1, C.wood2, C.wood3, C.wood4];
const FELT = [C.ink, C.red0, C.red1, C.red2];
const STONE_RAMP = [C.ink, C.deep, C.slate, C.steel, C.mist];
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// layout: { mats: [{x,y,rx,ry}], plinths: [{x,y,w}], trays: [{x,y,w,h}], midline: {x0,x1,y} }
export function buildBackground(layout, flicker) {
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const put = (x, y, hex) => { const o = (y * W + x) * 4; const [r, gg, b] = rgb(hex); img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255; };
  const lightAt = (x, y) => {
    let l = 0;
    for (const c of CANDLES) {
      const d = Math.hypot(x - c.x, (y - (c.y - 14)) * 1.35) / (c.r * flicker);
      if (d < 1) l += c.i * (1 - d) ** 1.6;
    }
    const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2);
    return l - 0.35 * (vx * vx + vy * vy);
  };
  const inMat = (x, y) => layout.mats.some(m => ((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2 <= 1);
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = bayer(x, y);
    const light = lightAt(x, y);
    let ramp, base, gain = 4;
    if (y >= 346) { put(x, y, C.ink); continue; }
    if (y < 72) {
      // window with the night sky and moon
      if (x >= 456 && x < 512 && y >= 8 && y < 56) {
        const inner = x >= 458 && x < 510 && y >= 10 && y < 54 && x !== 483 && x !== 484 && y !== 31;
        if (!inner) { put(x, y, y === 8 || x === 456 ? C.wood4 : C.wood2); continue; }
        const moon = Math.hypot(x - 496, y - 21);
        if (moon < 6) { put(x, y, moon < 4 && x < 496 ? C.cream : C.pale); continue; }
        if (hash(x, y) < 0.012) { put(x, y, C.pale); continue; }
        put(x, y, (y - 10) / 44 + t * 0.9 > 1 ? C.blue : (y - 10) / 44 + t > 0.45 ? C.deep : C.night);
        continue;
      }
      // shelf with bottles
      if (y >= 40 && y < 43 && x >= 20 && x < 152) { ramp = WOOD; base = y === 40 ? 4 : 2; gain = 2; }
      else {
        const bottle = bottleAt(x, y);
        if (bottle) { put(x, y, bottle); continue; }
        ramp = WALL; base = x % 26 === 0 || x % 26 === 1 && hash(x, y >> 3) < 0.5 ? 1 : 2; gain = 3.2;
        if (y > 60) base = Math.min(base, 1);
      }
    } else if (y < 76) {
      ramp = WOOD; base = y === 72 ? 4 : y === 75 ? 1 : 3;
    } else if (y >= 338) {
      ramp = WOOD; base = y === 338 ? 4 : y >= 344 ? 1 : 3;
    } else if (layout.trays.some(r => inRect(x, y, r))) {
      const r = layout.trays.find(rr => inRect(x, y, rr));
      const edge = x < r.x + 2 || y < r.y + 2 || x >= r.x + r.w - 2 || y >= r.y + r.h - 2;
      if (edge) { ramp = WOOD; base = y < r.y + 1 || x < r.x + 1 ? 4 : 3; gain = 2; }
      else { ramp = FELT; base = y < r.y + 4 ? 0 : 1; gain = 1.5; }
    } else if (layout.plinths.some(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + 5)) {
      const p = layout.plinths.find(pp => x >= pp.x && x < pp.x + pp.w && y >= pp.y && y < pp.y + 5);
      ramp = STONE_RAMP; base = y === p.y ? 3 : y === p.y + 4 || x === p.x || x === p.x + p.w - 1 ? 1 : 2; gain = 1.5;
    } else if (inMat(x, y)) {
      ramp = FELT; base = 1; gain = 2;
    } else if (y === layout.midline.y && x >= layout.midline.x0 && x < layout.midline.x1) {
      ramp = WOOD; base = 1;
    } else if (y === layout.midline.y + 1 && x >= layout.midline.x0 && x < layout.midline.x1) {
      ramp = WOOD; base = 3;
    } else {
      // table planks, seams every 22 rows, sparse grain
      ramp = WOOD;
      const seam = (y - 76) % 22 === 0;
      const plank = Math.floor((y - 76) / 22);
      const joint = (x + plank * 97) % 180 === 0;
      base = seam || joint ? 1 : 2;
      if (!seam && hash(x >> 3, y) < 0.08) base = 1;
      else if (!seam && hash(x >> 4, y + 999) < 0.05) base = 3;
    }
    const level = Math.max(0, Math.min(ramp.length - 1, Math.floor(base + light * gain + t - 0.5)));
    put(x, y, ramp[level]);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const BOTTLES = [
  { x: 28, h: 14, c: [C.green0, C.green1, C.green2] }, { x: 40, h: 10, c: [C.red0, C.red1, C.red2] },
  { x: 52, h: 16, c: [C.plum0, C.plum1, C.plum2] }, { x: 68, h: 12, c: [C.green0, C.green1, C.green2] },
  { x: 104, h: 15, c: [C.night, C.blue, C.slate] }, { x: 118, h: 11, c: [C.red0, C.red1, C.red2] },
  { x: 134, h: 13, c: [C.green0, C.green1, C.green2] },
];
function bottleAt(x, y) {
  for (const b of BOTTLES) {
    const top = 40 - b.h;
    if (y < top || y >= 40) continue;
    const neck = y < top + 4;
    const left = neck ? b.x + 2 : b.x, right = neck ? b.x + 4 : b.x + 6;
    if (x < left || x > right) continue;
    if (x === left || x === right || y === top) return C.ink;
    if (x === left + 1 && !neck && y < 37) return b.c[2];
    return x === right - 1 ? b.c[0] : b.c[1];
  }
  return null;
}
