import * as R from './rules.js';
import * as A from './art.js';
import { C, TILE, FACE, FRONT } from './art.js';
import { drawText, textWidth, makeCanvas } from './font.js';

// ---------------------------------------------------------------- layout (texels)

const BX = 220, BY = 44;                                   // board top-left
const PANEL = [{ x: 14, y: 196, w: 160, h: 92 }, { x: 14, y: 40, w: 160, h: 92 }];
const TRAY = [{ x: 466, y: 244, w: 160, h: 34 }, { x: 466, y: 50, w: 160, h: 34 }];
const LINE_Y = 298;                                        // status / result line under the board
const HINT = 'Tumble a die: the edge number comes up. Same or more takes a rival. Reach their back row.';

const OPPONENTS = [
  {
    id: 'pip', name: 'Pip', title: 'the kitchen boy', blurb: ['Just learning.', 'Moves on a whim.'], stars: 1,
    ai: { depth: 1, weights: 'steady', noise: 8 },
    look: { skin: [C.gin2, C.pink2, C.icing], hair: C.gin1, coat: [C.slate, C.steel], trim: C.icing2, hat: 'cap', eyes: C.mist },
  },
  {
    id: 'marta', name: 'Marta', title: 'the baker', blurb: ['Charges straight', 'for your back row.'], stars: 2,
    ai: { depth: 2, weights: 'rush', noise: 2 },
    look: { skin: [C.gin2, C.pink2, C.icing], hair: C.gin0, coat: [C.red1, C.red2], trim: C.red2, hat: 'kerchief', eyes: C.gin3 },
  },
  {
    id: 'treacle', name: 'Old Treacle', title: 'the miser', blurb: ['Hoards every cube', 'he can take.'], stars: 3,
    ai: { depth: 2, weights: 'hoard', noise: 2 },
    look: { skin: [C.gin1, C.gin3, C.icing2], hair: C.sug1, coat: [C.pink1, C.ch3], trim: C.amber, hat: 'bald', eyes: C.candle },
  },
  {
    id: 'conf', name: 'The Confectioner', title: 'of the night market', blurb: ['Thinks three', 'moves ahead.'], stars: 4,
    ai: { depth: 3, weights: 'steady', noise: 0 },
    look: { skin: [C.sug0, C.sug2, C.sug3], hair: C.ink, coat: [C.ch1, C.ch2], trim: C.red2, hat: 'tophat', eyes: C.red2 },
  },
];

const cellXY = i => ({ x: BX + (i % R.COLS) * TILE, y: BY + (R.ROWS - 1 - Math.floor(i / R.COLS)) * TILE });
const faceXY = i => { const p = cellXY(i); return { x: p.x + 5, y: p.y + 2 }; };
const traySlot = (side, n) => ({ x: TRAY[side].x + 8 + n * 14, y: TRAY[side].y + 10 });

// ---------------------------------------------------------------- canvas

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.floor(Math.min(innerWidth * dpr / A.W, innerHeight * dpr / A.H)));
  canvas.style.width = `${A.W * k / dpr}px`;
  canvas.style.height = `${A.H * k / dpr}px`;
  canvas.style.left = `${Math.floor((innerWidth * dpr - A.W * k) / 2) / dpr}px`;
  canvas.style.top = `${Math.floor((innerHeight * dpr - A.H * k) / 2) / dpr}px`;
}
addEventListener('resize', fit);
fit();

const layout = { bx: BX, by: BY, cols: R.COLS, rows: R.ROWS, homeRows: R.HOME_ROWS, trays: TRAY };
const backgrounds = [A.buildBackground(layout, 1), A.buildBackground(layout, 0.93)];
const portraits = new Map(OPPONENTS.map(o => [o.id, [A.portrait(o.look, false), A.portrait(o.look, true)]]));
const checker = (() => {
  const c = makeCanvas(A.W, A.H);
  const g = c.getContext('2d');
  g.fillStyle = C.ink;
  for (let y = 0; y < A.H; y++) for (let x = y & 1; x < A.W; x += 2) g.fillRect(x, y, 1, 1);
  return c;
})();
const dither = (x, y, w, h) => ctx.drawImage(checker, x, y, w, h, x, y, w, h);

// ---------------------------------------------------------------- sound (tiny synthesised blips)

let audio = null;
let muted = false;
function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  if (muted || !audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur);
}
function noise(dur, vol) {
  if (muted || !audio) return;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.value = vol;
  src.buffer = buffer;
  src.connect(gain).connect(audio.destination);
  src.start();
}
const sfx = {
  bounce: () => tone(200 + Math.random() * 160, 0.05, 'square', 0.03),
  thud: () => tone(130, 0.12, 'triangle', 0.16, -60),
  crunch: () => { noise(0.22, 0.16); tone(95, 0.22, 'sawtooth', 0.05, -50); },
  sugar: () => tone(990, 0.09, 'square', 0.03, 300),
  click: () => tone(660, 0.04, 'square', 0.03),
  pass: () => tone(240, 0.2, 'triangle', 0.06, -80),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.1)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0, i * 0.15)),
};

// ---------------------------------------------------------------- animation helpers

let now = 0;
let flowId = 0;                 // bumped to abandon a running flow
const tweens = new Set();
const tween = (ms, fn = () => {}) => new Promise(resolve => tweens.add({ t0: now, ms, fn, resolve }));
const wait = ms => tween(ms);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - (1 - k) ** 2;

let tumbling = null;   // { die, from, dir, oNew, k }
let flyers = [];       // { kind: 'die' | 'cube', side, o, x, y, size }
let particles = [];    // { x, y, vx, vy, colour, life }
let shake = 0;
const hidden = new Set();   // die ids not drawn on the board (moving or in flight)
const shownHand = [0, 0];   // tray cubes on display (they land after the rules already counted them)

function burst(x, y, colours, count, speed = 1.5) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (Math.random() * 2 - 1) * speed, vy: -Math.random() * speed * 1.6, colour: colours[i % colours.length], life: 25 + Math.random() * 25 });
  }
}
const crumbs = side => (side === 0 ? [C.sug3, C.sug2, C.sug1] : [C.ch3, C.ch2, C.gin3]);

// ---------------------------------------------------------------- state

let scene = 'select';          // 'select' | 'play' | 'tutorial'
let match = null;              // { opp, wins, game, starter }
let state = null;              // rules state of the current game
let choosing = null;           // { resolve } while the player picks a move
let selected = null;           // cell index, 'hand' or null
let hoverCell = null;
let hoverTray = false;
let aiShow = null;             // { from, to } outlines of the move the opponent is about to make
let status = null;             // { text, colour } line under the board
let result = null;             // { text, sub, colour, labels, resolve } in-scene game result
let winnerCell = null;         // die that broke through, pulsing
let tutorial = null;           // { step, emph: { cell, dir } | 'home' | null }
let buttons = [];

function resetVisuals() {
  tumbling = null; flyers = []; particles = []; hidden.clear();
  choosing = null; selected = null; aiShow = null; status = null; result = null; winnerCell = null;
  shownHand[0] = shownHand[1] = 0;
}

function startMatch(opp) {
  flowId++;
  tweens.clear();
  scene = 'play';
  tutorial = null;
  match = { opp, wins: [0, 0], game: 1, starter: 0 };
  playMatch(flowId);
}

function toMenu() {
  flowId++;
  tweens.clear();
  resetVisuals();
  scene = 'select';
  tutorial = null;
  match = null;
  state = null;
}

const oppName = () => match.opp.name;

async function playMatch(id) {
  const alive = () => id === flowId;
  for (;;) {
    resetVisuals();
    state = R.newGame();
    state.turn = match.starter;
    await openingThrows();
    if (!alive()) return;
    while (state.winner === null) {
      const side = state.turn;
      const move = side === 0 ? await playerMove() : await aiMove();
      if (!alive()) return;
      await playMove(move);
      if (!alive()) return;
      if (state.passes && state.winner === null) {
        const who = state.turn === 0 ? oppName() : 'You';
        status = { text: `${who} ${who === 'You' ? 'are' : 'is'} stuck and ${who === 'You' ? 'pass' : 'passes'}.`, colour: C.pink2 };
        sfx.pass();
        await wait(1300);
        if (!alive()) return;
      }
    }
    status = null;
    if (state.winner === -1) {
      await showResult('BOTH SIDES ARE STUCK', 'Same number of dice: the game is replayed.', C.mist, ['REPLAY']);
      if (!alive()) return;
      continue;
    }
    const w = state.winner;
    match.wins[w]++;
    match.starter = 1 - w;          // the loser moves first next game
    (w === 0 ? sfx.win : sfx.lose)();
    const how = state.reason === 'breach' ? (w === 0 ? 'Your die reached their back row.' : 'Their die reached your back row.')
      : state.reason === 'wipe' ? (w === 0 ? 'You took all their dice.' : 'They took all your dice.')
      : 'Both stuck: more dice wins.';
    const colour = w === 0 ? C.glow : C.pink2;
    if (match.wins[w] === R.GAMES_TO_WIN) {
      const head = w === 0 ? `YOU WIN THE MATCH ${match.wins[0]}-${match.wins[1]}` : `${oppName().toUpperCase()} WINS THE MATCH ${match.wins[1]}-${match.wins[0]}`;
      const choice = await showResult(head, how, colour, ['REMATCH', 'OPPONENTS']);
      if (!alive()) return;
      if (choice === 0) startMatch(match.opp); else toMenu();
      return;
    }
    const head = w === 0 ? `YOU WIN GAME ${match.game}` : `${oppName().toUpperCase()} WINS GAME ${match.game}`;
    await showResult(head, how, colour, ['NEXT GAME']);
    if (!alive()) return;
    match.game++;
  }
}

const showResult = (text, sub, colour, labels) => new Promise(resolve => { result = { text, sub, colour, labels, resolve }; });

async function playerMove() {
  status = { text: 'Your turn', colour: C.glow };
  const move = await new Promise(resolve => { choosing = { resolve }; });
  choosing = null;
  selected = null;
  status = null;
  return move;
}

async function aiMove() {
  status = { text: `${oppName()} is thinking...`, colour: C.mist };
  await wait(450);
  const move = R.chooseMove(state, match.opp.ai);
  aiShow = { from: move.kind === 'throw' ? 'hand' : move.from, to: move.to };
  await wait(550);
  aiShow = null;
  status = null;
  return move;
}

// Animates a move, then applies it to the rules state.
async function playMove(move) {
  const side = state.turn;
  if (move.kind === 'tumble') {
    await tumbleAnim(side, move);
    R.apply(state, move);
    hidden.clear();
    if (state.winner === side && state.reason === 'breach') breachFx(move.to);
  } else {
    const o = R.randomOrient();
    await throwAnim(side, move.to, o, true);
    R.apply(state, move, o);
    hidden.clear();
  }
}

// The die rolls over its leading edge; the face that comes up grows as the old top folds away.
async function tumbleAnim(side, move) {
  const die = state.board[move.from];
  const target = move.capture ? state.board[move.to] : null;
  hidden.add(die.id);
  tumbling = { die, from: move.from, dir: move.dir, oNew: move.o, k: 0 };
  let crunched = false;
  let landing = null;
  await tween(330, k => {
    tumbling.k = k;
    if (target && !crunched && k > 0.55) {
      crunched = true;
      landing = captureFx(side, target, move.to);
    }
  });
  tumbling = null;
  sfx.thud();
  const p = faceXY(move.to);
  burst(p.x + FACE / 2, p.y + FACE, [C.gin3, C.gin2], 4, 0.8);
  shake = Math.max(shake, target ? 0 : 0.8);
  // board state is applied after the tumble; keep the die on its new square meanwhile
  state.board[move.to] = { ...die, o: move.o };
  state.board[move.from] = null;
  hidden.delete(die.id);
  if (landing) await landing;
  state.board[move.from] = die;          // restore so the rules apply the move themselves
  state.board[move.to] = target;
}

// The taken die bursts and flies to the captor's tray, changing colour on the way.
async function captureFx(side, target, cell) {
  hidden.add(target.id);
  const p = faceXY(cell);
  sfx.crunch();
  shake = Math.max(shake, 4);
  burst(p.x + FACE / 2, p.y + FACE / 2, crumbs(target.side), 18, 2.2);
  const to = traySlot(side, shownHand[side]);
  const f = { kind: 'die', side: target.side, o: target.o, x: p.x, y: p.y, size: FACE };
  flyers.push(f);
  await tween(520, k => {
    f.x = lerp(p.x, to.x, ease(k));
    f.y = lerp(p.y, to.y, ease(k)) - 40 * 4 * k * (1 - k);
    f.size = Math.round(lerp(FACE, 12, k));
    if (k > 0.5 && f.kind === 'die') { f.kind = 'cube'; f.side = side; burst(f.x + 6, f.y + 6, [C.glow, C.sug3], 6, 1); }
  });
  flyers = flyers.filter(x => x !== f);
  shownHand[side]++;
  sfx.sugar();
}

// A die bounces in from the tray (or the table edge for the opening) and lands on a random face.
async function throwAnim(side, cell, o, fromHand) {
  let from;
  if (fromHand) { shownHand[side]--; from = traySlot(side, shownHand[side]); }
  else from = { x: TRAY[side].x + 60, y: TRAY[side].y + 4 };
  const to = faceXY(cell);
  const f = { kind: 'die', side, o: R.randomOrient(), x: from.x, y: from.y, size: FACE, front: true };
  flyers.push(f);
  let lastFace = 0, contacts = 0;
  await tween(560, k => {
    f.x = Math.round(lerp(from.x, to.x, ease(Math.min(1, k * 1.25))));
    let h;
    if (k < 0.45) { const u = k / 0.45; h = -34 * 4 * u * (1 - u) * 0.5 + lerp(from.y, to.y, ease(u)) - to.y; }
    else if (k < 0.72) { const u = (k - 0.45) / 0.27; h = -10 * 4 * u * (1 - u); }
    else if (k < 0.88) { const u = (k - 0.72) / 0.16; h = -3 * 4 * u * (1 - u); }
    else h = 0;
    f.y = Math.round(to.y + h);
    const c = k >= 0.88 ? 3 : k >= 0.72 ? 2 : k >= 0.45 ? 1 : 0;
    if (c > contacts) { contacts = c; sfx.bounce(); burst(f.x + FACE / 2, to.y + FACE + 2, [C.gin3, C.gin2], 3, 0.7); }
    if (k < 0.85 && now - lastFace > 70) { lastFace = now; f.o = R.randomOrient(); }
    if (k >= 0.85) f.o = o;
  });
  flyers = flyers.filter(x => x !== f);
  sfx.thud();
}

// Each side's five dice are thrown onto its back row; they stay hidden until they land.
async function openingThrows() {
  const dice = state.board.map((d, i) => ({ d, i })).filter(x => x.d);
  dice.forEach(x => hidden.add(x.d.id));
  status = { text: 'Both sides throw their dice...', colour: C.mist };
  await Promise.all(dice.map((x, n) => wait((n % R.COLS) * 110 + (x.d.side === 1 ? 50 : 0))
    .then(() => throwAnim(x.d.side, x.i, x.d.o, false))
    .then(() => hidden.delete(x.d.id))));
  status = null;
  await wait(250);
}

function breachFx(cell) {
  winnerCell = cell;
  const p = faceXY(cell);
  shake = Math.max(shake, 5);
  burst(p.x + FACE / 2, p.y + FACE / 2, [C.glow, C.candle, C.sug3], 26, 2.4);
}

// ---------------------------------------------------------------- input

let pointer = { x: -1, y: -1 };

function toTexel(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / r.width * A.W), y: Math.floor((e.clientY - r.top) / r.height * A.H) };
}

function cellAt(p) {
  const c = Math.floor((p.x - BX) / TILE), row = R.ROWS - 1 - Math.floor((p.y - BY) / TILE);
  if (p.x < BX || p.y < BY || c >= R.COLS || row < 0) return null;
  return R.idx(row, c);
}
const inside = (p, b) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

// Legal moves for a source: a cell with the player's die, or 'hand'.
function movesFrom(src) {
  if (src === null || !state) return [];
  return R.moves(state, 0).filter(m => (src === 'hand' ? m.kind === 'throw' : m.kind === 'tumble' && m.from === src));
}

// What the outlines currently show: the selection, else whatever the pointer rests on.
function shownSource() {
  if (!choosing) return null;
  if (selected !== null) return selected;
  if (hoverTray && state.hand[0] > 0) return 'hand';
  if (hoverCell !== null && state.board[hoverCell]?.side === 0) return hoverCell;
  return null;
}

canvas.addEventListener('pointermove', e => {
  pointer = toTexel(e);
  hoverCell = cellAt(pointer);
  hoverTray = inside(pointer, TRAY[0]);
});
canvas.addEventListener('pointerleave', () => { pointer = { x: -1, y: -1 }; hoverCell = null; hoverTray = false; });
canvas.addEventListener('pointerdown', e => {
  if (!audio) { try { audio = new AudioContext(); } catch { audio = null; } }
  pointer = toTexel(e);
  hoverCell = cellAt(pointer);
  hoverTray = inside(pointer, TRAY[0]);
  const button = buttons.find(b => inside(pointer, b));
  if (button) { sfx.click(); button.action(); return; }
  if (tutorial) { runStep(tutorial.step + 1); return; }
  if (!choosing) return;
  const shown = movesFrom(selected);
  const pick = hoverCell !== null && shown.find(m => m.to === hoverCell);
  if (pick) { choosing.resolve(pick); return; }
  if (hoverTray && state.hand[0] > 0) { selected = selected === 'hand' ? null : 'hand'; sfx.click(); return; }
  if (hoverCell !== null && state.board[hoverCell]?.side === 0 && movesFrom(hoverCell).length) {
    selected = selected === hoverCell ? null : hoverCell;
    sfx.click();
    return;
  }
  selected = null;
});
addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') muted = !muted; });

// ---------------------------------------------------------------- update and render

let flickerFrame = 0;
let nextFlicker = 0;

function frame(t) {
  now = t;
  for (const tw of [...tweens]) {
    const k = Math.min(1, (t - tw.t0) / tw.ms);
    tw.fn(k);
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
  if (now > nextFlicker) { flickerFrame = (flickerFrame + 1 + Math.floor(Math.random() * 2)) % 6; nextFlicker = now + 90 + Math.random() * 120; }
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
  particles = particles.filter(p => p.life > 0);
  shake = shake > 0.4 ? shake * 0.85 : 0;
  render();
  requestAnimationFrame(frame);
}

function render() {
  buttons = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, A.W, A.H);
  const sx = Math.round((Math.random() * 2 - 1) * shake);
  const sy = Math.round((Math.random() * 2 - 1) * shake);
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  ctx.drawImage(backgrounds[flickerFrame === 3 ? 1 : 0], 0, 0);
  A.CANDLES.forEach((c, i) => A.drawCandle(ctx, c, Math.floor(now / 110) + i));
  if (scene !== 'select' && state) renderBoard();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (scene === 'select') renderSelect();
  else renderHud();
  drawTextButton(muted ? 'SOUND OFF' : 'SOUND ON', 634, 4, () => { muted = !muted; }, 'right');
  const src = shownSource();
  const clickable = buttons.some(b => inside(pointer, b)) || (choosing && ((hoverCell !== null && (movesFrom(hoverCell).length || movesFrom(src).some(m => m.to === hoverCell))) || (hoverTray && state.hand[0] > 0)));
  canvas.style.cursor = clickable ? 'pointer' : 'default';
}

function drawDie(side, o, x, y, size = FACE, front = true) {
  x = Math.round(x); y = Math.round(y);
  if (size !== FACE) { ctx.drawImage(A.faceSprite(side, o), x, y, size, size); return; }
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 1, y + FACE + FRONT, FACE - 1, 1);
  if (front) ctx.drawImage(A.frontSprite(side), x, y + FACE);
  ctx.drawImage(A.faceSprite(side, o), x, y);
}

function renderBoard() {
  const phase = Math.floor(now / 90);
  // destination outlines (the player's own choice, or the move the opponent is about to make)
  const src = shownSource();
  const dests = movesFrom(src);
  for (const m of dests) {
    const p = cellXY(m.to);
    A.outline(ctx, p.x + 1, p.y + 1, TILE - 2, TILE - 2, m.capture ? C.red2 : C.glow, !m.capture, phase);
  }
  if (aiShow) {
    const p = cellXY(aiShow.to);
    A.outline(ctx, p.x + 1, p.y + 1, TILE - 2, TILE - 2, C.pink2, true, phase);
  }
  if (tutorial?.emph === 'home') {
    for (let i = 0; i < R.ROWS * R.COLS; i++) {
      if (!R.isHome(0, Math.floor(i / R.COLS)) || state.board[i] || Math.floor(now / 250) % 2) continue;
      const p = cellXY(i);
      A.outline(ctx, p.x + 1, p.y + 1, TILE - 2, TILE - 2, C.glow, true, phase);
    }
  }
  // dice, back rows first so front sides overlap correctly
  for (let row = R.ROWS - 1; row >= 0; row--) {
    for (let c = 0; c < R.COLS; c++) {
      const i = R.idx(row, c);
      const d = state.board[i];
      if (!d || hidden.has(d.id)) continue;
      const p = faceXY(i);
      drawDie(d.side, d.o, p.x, p.y);
      const sel = (choosing && src === i) || (aiShow && aiShow.from === i);
      if (sel) A.outline(ctx, p.x - 2, p.y - 2, FACE + 4, FACE + FRONT + 4, aiShow ? C.pink2 : C.candle);
      if (winnerCell === i && Math.floor(now / 200) % 2) A.outline(ctx, p.x - 2, p.y - 2, FACE + 4, FACE + FRONT + 4, C.glow);
      if (tutorial?.emph?.cell === i && Math.floor(now / 220) % 2) {
        const e = edgeBox(tutorial.emph.dir);
        A.outline(ctx, p.x + e.x, p.y + e.y, 7, 9, C.red2);
      }
    }
  }
  if (tumbling) drawTumble(tumbling);
  // trays
  for (const side of [0, 1]) {
    for (let n = 0; n < shownHand[side]; n++) {
      const s = traySlot(side, n);
      ctx.drawImage(A.cubeSprite(side), s.x, s.y);
    }
    const label = side === 0 ? 'YOUR HAND' : `${match.opp.name.toUpperCase()}'S HAND`;
    drawText(ctx, label, TRAY[side].x + 2, TRAY[side].y - 10, C.mist, { shadow: C.ink });
    const hot = side === 0 && (selected === 'hand' || (choosing && hoverTray && state.hand[0] > 0));
    if (hot || (side === 1 && aiShow?.from === 'hand')) A.outline(ctx, TRAY[side].x - 2, TRAY[side].y - 2, TRAY[side].w + 4, TRAY[side].h + 4, side === 0 ? C.candle : C.pink2);
  }
  for (const f of flyers) {
    if (f.kind === 'cube') ctx.drawImage(A.cubeSprite(f.side), Math.round(f.x), Math.round(f.y));
    else drawDie(f.side, f.o, f.x, f.y, f.size, f.front);
  }
  for (const p of particles) { ctx.fillStyle = p.colour; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
}

// Where the small edge number sits on a face, for the tutorial's emphasis box.
function edgeBox(dir) {
  const mid = FACE / 2 - 3;
  return { N: { x: mid, y: 1 }, S: { x: mid, y: FACE - 10 }, W: { x: 1, y: mid - 1 }, E: { x: FACE - 8, y: mid - 1 } }[dir];
}

// A cube of edge s rolling about its leading bottom edge by angle a: the old top spans
// [s(1 - cos a + sin a), s(1 + sin a)] along the move, the face coming up spans [s(1 - cos a), s(1 - cos a + sin a)].
// The extra gap between squares (TILE - FACE) slides in linearly.
function drawTumble(t) {
  const s = FACE;
  const a = t.k * Math.PI / 2;
  const slide = (TILE - FACE) * t.k;
  const start = faceXY(t.from);
  const upNew = [s * (1 - Math.cos(a)), s * (1 - Math.cos(a) + Math.sin(a))];
  const upOld = [upNew[1], s * (1 + Math.sin(a))];
  const positive = t.dir === 'S' || t.dir === 'E';   // screen axis grows along the move
  const vertical = t.dir === 'N' || t.dir === 'S';
  const span = ([u0, u1]) => {
    const a0 = positive ? u0 + slide : s - u1 - slide;
    const a1 = positive ? u1 + slide : s - u0 - slide;
    return [Math.round(a0), Math.max(Math.round(a1), Math.round(a0))];
  };
  const lift = Math.round(Math.sin(a * 2) * 4);
  const all = span([upNew[0], upOld[1]]);
  ctx.fillStyle = C.ink;
  if (vertical) ctx.fillRect(start.x + 2, start.y + all[0] + 3, s - 2, all[1] - all[0]);
  else ctx.fillRect(start.x + all[0] + 2, start.y + 3, all[1] - all[0], s);
  for (const [range, o] of [[upNew, t.oNew], [upOld, t.die.o]]) {
    const [p0, p1] = span(range);
    if (p1 - p0 < 1) continue;
    const img = A.faceSprite(t.die.side, o);
    if (vertical) ctx.drawImage(img, start.x, start.y + p0 - lift, s, p1 - p0);
    else ctx.drawImage(img, start.x + p0, start.y - lift, p1 - p0, s);
  }
}

// ---------------------------------------------------------------- HUD

function panel(x, y, w, h, border = C.slate) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.night;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

function drawTextButton(label, x, y, action, align = 'left') {
  const w = textWidth(label) + 8;
  const bx = align === 'right' ? x - w : align === 'center' ? x - Math.floor(w / 2) : x;
  const b = { x: bx, y, w, h: 13, action };
  const hot = inside(pointer, b);
  panel(b.x, b.y, b.w, b.h, hot ? C.candle : C.slate);
  drawText(ctx, label, b.x + 4, b.y + 3, hot ? C.glow : C.mist);
  buttons.push(b);
}

function drawButton(label, cx, y, action) {
  const w = textWidth(label) + 16;
  const b = { x: cx - Math.floor(w / 2), y, w, h: 17, action };
  const hot = inside(pointer, b);
  panel(b.x, b.y + (hot ? -1 : 0), b.w, b.h, hot ? C.glow : C.amber);
  drawText(ctx, label, cx, b.y + 5 + (hot ? -1 : 0), hot ? C.glow : C.icing, { align: 'center', shadow: C.ink });
  buttons.push(b);
}

const blinkNow = seed => (now + seed * 1300) % 3600 < 140;

function renderHud() {
  const opp = match.opp;
  for (const side of [0, 1]) {
    const box = PANEL[side];
    const active = state && state.winner === null && state.turn === side && !result && (choosing || aiShow || status);
    panel(box.x, box.y, box.w, box.h, active ? C.candle : C.slate);
    if (side === 1) {
      panel(box.x + 6, box.y + 6, 48, 48, C.blue);
      ctx.fillStyle = C.deep; ctx.fillRect(box.x + 7, box.y + 7, 46, 46);
      ctx.drawImage(portraits.get(opp.id)[blinkNow(0) ? 1 : 0], box.x + 8, box.y + 8);
      drawText(ctx, opp.name.toUpperCase(), box.x + 60, box.y + 10, active ? C.glow : C.icing, { shadow: C.ink });
      drawText(ctx, opp.title, box.x + 60, box.y + 21, C.candle);
      drawText(ctx, 'chocolate dice', box.x + 60, box.y + 34, C.gin3);
    } else {
      drawText(ctx, 'YOU', box.x + 8, box.y + 10, active ? C.glow : C.icing, { shadow: C.ink });
      drawText(ctx, 'sugar dice', box.x + 8, box.y + 21, C.sug1);
      if (active) drawText(ctx, '< your turn', box.x + 8, box.y + 34, C.candle);
    }
    // games won
    const my = side === 1 ? box.y + 64 : box.y + 50;
    drawText(ctx, 'GAMES', box.x + 8, my + 2, C.steel);
    for (let i = 0; i < R.GAMES_TO_WIN; i++) {
      const cx = box.x + 50 + i * 14;
      ctx.fillStyle = C.ink; ctx.fillRect(cx - 1, my - 1, 12, 12);
      const won = i < match.wins[side];
      ctx.fillStyle = won ? C.candle : C.deep; ctx.fillRect(cx, my, 10, 10);
      if (won) { ctx.fillStyle = C.glow; ctx.fillRect(cx + 1, my + 1, 3, 3); }
    }
    if (side === 1 && active) drawText(ctx, aiShow ? 'moves' : 'thinking', box.x + 82, my + 2, C.candle);
  }
  drawText(ctx, tutorial ? 'HOW TO PLAY' : `GAME ${match.game}`, 14, 6, C.candle, { shadow: C.ink });
  if (!tutorial) drawText(ctx, 'first to 2 games', 14, 17, C.steel, { shadow: C.ink });
  drawTextButton(tutorial ? 'SKIP' : 'MENU', 578, 4, toMenu, 'right');

  const cx = BX + (R.COLS * TILE) / 2;
  if (tutorial) drawCaption(cx);
  else if (result) {
    drawText(ctx, result.text, cx, LINE_Y, result.colour, { align: 'center', shadow: C.ink });
    drawText(ctx, result.sub, cx, LINE_Y + 11, C.mist, { align: 'center', shadow: C.ink });
    const n = result.labels.length;
    result.labels.forEach((label, i) => drawButton(label, cx + (i - (n - 1) / 2) * 110, LINE_Y + 24, () => {
      const resolve = result.resolve;
      result = null;
      resolve(i);
    }));
  } else if (status) drawText(ctx, status.text, cx, LINE_Y + 4, status.colour, { align: 'center', shadow: C.ink });
  drawText(ctx, HINT, 320, 349, C.mist, { align: 'center', shadow: C.ink });
}

// ---------------------------------------------------------------- select screen

function renderSelect() {
  dither(0, 0, A.W, A.H);
  drawText(ctx, 'TUMBLEDOWN', 320, 22, C.icing, { align: 'center', scale: 3, shadow: C.ch1 });
  drawText(ctx, 'sugar dice tumble across the gingerbread', 320, 52, C.mist, { align: 'center', shadow: C.ink });
  drawText(ctx, 'Choose who sits across the table', 320, 76, C.candle, { align: 'center', shadow: C.ink });
  OPPONENTS.forEach((opp, i) => {
    const card = { x: 25 + i * 150, y: 92, w: 140, h: 162, action: () => startMatch(opp) };
    const hot = inside(pointer, card);
    const lift = hot ? -2 : 0;
    panel(card.x, card.y + lift, card.w, card.h, hot ? C.candle : C.slate);
    const fx = card.x + 46, fy = card.y + 10 + lift;
    panel(fx, fy, 48, 48, hot ? C.amber : C.blue);
    ctx.fillStyle = C.deep; ctx.fillRect(fx + 1, fy + 1, 46, 46);
    ctx.drawImage(portraits.get(opp.id)[blinkNow(i) ? 1 : 0], fx + 2, fy + 2);
    const cx = card.x + card.w / 2;
    drawText(ctx, opp.name.toUpperCase(), cx, fy + 56, C.glow, { align: 'center', shadow: C.ink });
    drawText(ctx, opp.title, cx, fy + 67, C.candle, { align: 'center' });
    opp.blurb.forEach((line, j) => drawText(ctx, line, cx, fy + 84 + j * 11, C.mist, { align: 'center' }));
    for (let s = 0; s < 4; s++) ctx.drawImage(A.cubeSprite(s < opp.stars ? 0 : 1), cx - 28 + s * 14, fy + 112);
    buttons.push(card);
  });
  drawText(ctx, 'First to win 2 games takes the match. The loser of a game moves first in the next.', 320, 276, C.steel, { align: 'center', shadow: C.ink });
  drawButton('HOW TO PLAY', 320, 300, startTutorial);
}

// ---------------------------------------------------------------- tutorial: the rules shown on the real board

const TUTORIAL_KEY = 'tumbledown.tutorialSeen';
const orient = (top, dir, up) => R.ORIENTS.find(o => o[0] === top && (!dir || R.roll(o, dir)[0] === up));
// dice: [side, row, col, top, dir?, up?]
function setBoard(dice, hand = [0, 0]) {
  state = { board: new Array(R.ROWS * R.COLS).fill(null), hand: hand.slice(), turn: 0, winner: null, reason: null, passes: 0 };
  for (const [side, r, c, top, dir, up] of dice) state.board[R.idx(r, c)] = R.makeDie(side, orient(top, dir, up));
  shownHand[0] = hand[0]; shownHand[1] = hand[1];
}
const RIVALS = [[1, 5, 0, 5], [1, 5, 1, 2], [1, 4, 3, 6], [1, 5, 4, 1]];
const tumbleOf = (from, dir) => R.moves(state, 0).find(m => m.kind === 'tumble' && m.from === from && m.dir === dir);

const TUTORIAL = [
  {
    caption: 'Each side throws its 5 dice onto its back row.',
    play: async () => {
      state = R.newGame();
      await openingThrows();
      await wait(900);
    },
  },
  {
    caption: 'Tumble a die one square forward: the number on that edge comes up.',
    play: async () => {
      setBoard([[0, 1, 2, 2, 'N', 4], [0, 0, 0, 3], [0, 0, 4, 6], ...RIVALS]);
      tutorial.emph = { cell: R.idx(1, 2), dir: 'N' };
      await wait(1600);
      tutorial.emph = null;
      await playMove(tumbleOf(R.idx(1, 2), 'N'));
      await wait(1100);
    },
  },
  {
    caption: 'Land on a rival die with the same number or more to take it.',
    play: async () => {
      setBoard([[0, 3, 1, 3, 'N', 5], [0, 0, 0, 3], [0, 1, 3, 6], [1, 4, 1, 4], [1, 5, 0, 5], [1, 5, 3, 2]]);
      tutorial.emph = { cell: R.idx(3, 1), dir: 'N' };
      await wait(1300);
      tutorial.emph = null;
      await playMove(tumbleOf(R.idx(3, 1), 'N'));
      await wait(1000);
    },
  },
  {
    caption: 'You may tumble sideways only to take. Taken dice join your hand.',
    play: async () => {
      setBoard([[0, 2, 2, 2, 'E', 6], [0, 0, 0, 3], [1, 2, 3, 3], [1, 5, 0, 5], [1, 4, 1, 1]], [1, 0]);
      tutorial.emph = { cell: R.idx(2, 2), dir: 'E' };
      await wait(1300);
      tutorial.emph = null;
      await playMove(tumbleOf(R.idx(2, 2), 'E'));
      await wait(1000);
    },
  },
  {
    caption: 'Or, instead of tumbling, throw a die from your hand onto your two home rows.',
    play: async () => {
      setBoard([[0, 2, 3, 6], [0, 0, 0, 3], [0, 1, 1, 4], [1, 5, 0, 5], [1, 4, 1, 1], [1, 5, 4, 3]], [2, 0]);
      tutorial.emph = 'home';
      selected = null;
      await wait(1400);
      tutorial.emph = null;
      await playMove({ kind: 'throw', to: R.idx(1, 3) });
      await wait(1000);
    },
  },
  {
    caption: 'Reach their back row, or take all their dice, to win. Win 2 games.',
    play: async () => {
      setBoard([[0, 4, 2, 3, 'N', 2], [0, 1, 0, 5], [0, 2, 3, 6], [1, 5, 0, 5], [1, 4, 4, 1], [1, 3, 1, 4]], [1, 1]);
      await wait(700);
      await playMove(tumbleOf(R.idx(4, 2), 'N'));
      sfx.win();
      for (const w of [1, 2]) { await wait(450); match.wins[0] = w; sfx.sugar(); }
      await wait(1400);
    },
  },
];

function startTutorial() {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* storage may be blocked */ }
  scene = 'tutorial';
  match = { opp: OPPONENTS[1], wins: [0, 0], game: 1, starter: 0 };
  runStep(0);
}

// Each step starts from its own board, so a click can jump straight to the next one.
async function runStep(i) {
  flowId++;
  tweens.clear();
  resetVisuals();
  if (i >= TUTORIAL.length) { toMenu(); return; }
  const id = flowId;
  tutorial = { step: i, emph: null };
  match.wins = [0, 0];
  state = null;
  setBoard([]);
  await wait(300);
  if (id !== flowId) return;
  await TUTORIAL[i].play();
  if (id === flowId) runStep(i + 1);
}

function drawCaption(cx) {
  drawText(ctx, `HOW TO PLAY  ${tutorial.step + 1}/${TUTORIAL.length}   click for next`, cx, LINE_Y, C.candle, { align: 'center', shadow: C.ink });
  drawText(ctx, TUTORIAL[tutorial.step].caption, cx, LINE_Y + 13, C.icing, { align: 'center', shadow: C.ink });
}

let tutorialSeen = false;
try { tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { /* storage may be blocked */ }
if (!tutorialSeen) startTutorial();

// debug handle for headless checks
window.tumbledown = { get state() { return state; }, get match() { return match; }, get choosing() { return !!choosing; }, get result() { return result; }, R };
requestAnimationFrame(frame);
