import * as R from './rules.js';
import * as A from './art.js';
import { C } from './art.js';

// ---------------------------------------------------------------- layout (texels)

const TOWER_X = [262, 320, 378];          // tower centres
const BASE_Y = [330, 172];                 // die bottoms per side: 0 player, 1 opponent
const HAND = [{ x: 186, y: 284 }, { x: 186, y: 124 }];
const TRAY = [{ x: 440, y: 300, w: 164, h: 24 }, { x: 440, y: 142, w: 164, h: 24 }];
const PANEL = [{ x: 6, y: 236, w: 142, h: 102 }, { x: 6, y: 80, w: 142, h: 96 }];
const SIDE_Y = [[186, 340], [78, 180]];    // vertical hit range of each side's towers
const FIGURE_POS = { x: 304, y: 46 };
const HINT = 'Stack on your towers, or throw at theirs: every lower die from the top falls to you.';
const EASY_NOISE = 4;

const OPPONENTS = [
  { id: 'hobb', name: 'Hobb', title: 'the brewer', blurb: ['Plays it straight', 'and weighs every throw.'], profile: { w: 1, raidBonus: 0 } },
  { id: 'rook', name: 'Rook', title: 'the cutpurse', blurb: ["Can't keep his hands", 'off your towers.'], profile: { w: 1, raidBonus: 3 } },
  { id: 'tallow', name: 'Tallow', title: 'the miser', blurb: ['Hoards her stones,', 'rarely throws one.'], profile: { w: 1, raidBonus: -4 } },
];

const slotPos = (side, t, i) => ({ x: TOWER_X[t] - 7, y: BASE_Y[side] - A.DIE_H - A.DIE_STEP * i });
const trayPos = (side, i) => ({ x: TRAY[side].x + 7 + i * 15, y: TRAY[side].y + 6 });

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

const layout = {
  mats: HAND.map(h => ({ x: h.x + 7, y: h.y + 16, rx: 18, ry: 7 })),
  plinths: [0, 1].flatMap(side => TOWER_X.map(x => ({ x: x - 11, y: BASE_Y[side], w: 22 }))),
  trays: TRAY,
  midline: { x0: 166, x1: 432, y: 182 },
};
const backgrounds = [A.buildBackground(layout, 1), A.buildBackground(layout, 0.93)];
const title = A.stoneTitle('TOPPLE');
const checker = (() => {
  const c = A.makeCanvas(A.W, A.H);
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
  bounce: () => tone(180 + Math.random() * 160, 0.05, 'square', 0.03),
  land: () => tone(150, 0.14, 'triangle', 0.18, -90),
  crash: n => { noise(0.18 + n * 0.05, 0.12 + n * 0.02); tone(110, 0.25, 'sawtooth', 0.05, -60); },
  loot: i => tone(440 * 2 ** (i * 2 / 12), 0.08, 'square', 0.035),
  tick: () => tone(1100, 0.012, 'square', 0.012),
  click: () => tone(660, 0.04, 'square', 0.03),
  clank: () => { tone(1250, 0.18, 'square', 0.04, -300); tone(1870, 0.12, 'triangle', 0.05, -500); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.1)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0, i * 0.15)),
};

// ---------------------------------------------------------------- animation helpers

let now = 0;
let flowId = 0;                 // bumped to abandon a running match flow
const tweens = new Set();
const tween = (ms, fn = () => {}) => new Promise(resolve => tweens.add({ t0: now, ms, fn, resolve }));
const wait = ms => tween(ms);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - (1 - k) ** 2;

let flyers = [];      // dice in flight { die, x, y, flat }
let particles = [];   // { x, y, vx, vy, colour, life }
let popups = [];      // { text, x, y, colour, t0, life, big }
let shake = 0;

function popup(text, x, y, colour, big = false, life = 900) {
  popups.push({ text, x, y, colour, t0: now, life, big });
}
function burst(x, y, colours, count, speed = 1.5) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, vx: (Math.random() * 2 - 1) * speed, vy: -Math.random() * speed * 1.5,
      colour: colours[i % colours.length], life: 30 + Math.random() * 25,
    });
  }
}
const stoneColours = owner => (owner === 0 ? [C.sand3, C.sand2, C.sand1] : [C.pale, C.mist, C.steel]);

async function fly(f, to, ms, arc) {
  const from = { x: f.x, y: f.y };
  flyers.push(f);
  await tween(ms, k => {
    f.x = lerp(from.x, to.x, k);
    f.y = lerp(from.y, to.y, ease(k)) - arc * 4 * k * (1 - k);
  });
  flyers = flyers.filter(other => other !== f);
}

// ---------------------------------------------------------------- game state

let scene = 'select';            // 'select' | 'play'
let easy = false;
let match = null;                // { opp, wins, round, starter }
let round = null;                // rules state
let turn = 0;
let hand = null;                 // rolled die waiting at a hand mat { die, side, x, y, face, glow }
let choosing = null;             // { die, resolve } while the player decides
let hover = null;                // { side, t } under the pointer during the player's choice
let aiPreview = null;            // move the opponent is about to make
let overlay = null;              // { lines, buttons }
let banner = null;               // { text, sub, t0 }
let figureShake = 0;
let blockFlash = null;           // { side, t, until }: the top die that stopped a raid
const shown = [0, 0];            // displayed totals counting toward the real ones
const pop = [0, 0];
let buttons = [];                // clickable rectangles for the current frame

function resetBoardVisuals() {
  flyers = []; particles = []; popups = [];
  hand = null; choosing = null; hover = null; aiPreview = null; overlay = null; banner = null; blockFlash = null;
  shown[0] = shown[1] = 0;
}

function startMatch(opp) {
  flowId++;
  tweens.clear();
  scene = 'play';
  match = { opp, wins: [0, 0], round: 1, starter: 0 };
  playMatch(flowId);
}

function toMenu() {
  flowId++;
  tweens.clear();
  resetBoardVisuals();
  scene = 'select';
  match = null;
  round = null;
}

async function playMatch(id) {
  const alive = () => id === flowId;
  for (;;) {
    round = R.newRound();
    resetBoardVisuals();
    const starter = match.starter;
    banner = { text: `ROUND ${match.round}`, sub: starter === 0 ? 'You roll first' : `${match.opp.name} rolls first`, t0: now };
    await wait(1400);
    if (!alive()) return;
    banner = null;
    let side = starter;
    for (let i = 0; i < R.ROLLS_PER_ROUND * 2; i++) {
      turn = side;
      await playTurn(side);
      if (!alive()) return;
      side = 1 - side;
    }
    await wait(700);
    if (!alive()) return;
    const s = [R.score(round, 0), R.score(round, 1)];
    if (s[0] === s[1]) {
      sfx.click();
      await showOverlay([`TIE  ${s[0]} : ${s[1]}`, 'The round is played again.'], ['REPLAY ROUND']);
      continue;
    }
    const winner = s[0] > s[1] ? 0 : 1;
    match.wins[winner]++;
    match.starter = winner;
    (winner === 0 ? sfx.win : sfx.lose)();
    const scoreLine = `${s[0]} : ${s[1]}`;
    if (match.wins[winner] === R.ROUNDS_TO_WIN) {
      const head = winner === 0 ? 'YOU WIN THE MATCH' : `${match.opp.name.toUpperCase()} WINS THE MATCH`;
      const choice = await showOverlay([head, `Last round ${scoreLine}   Rounds ${match.wins[0]} - ${match.wins[1]}`], ['REMATCH', 'OPPONENTS']);
      if (!alive()) return;
      if (choice === 0) startMatch(match.opp); else toMenu();
      return;
    }
    const head = winner === 0 ? 'YOU TAKE THE ROUND' : `${match.opp.name.toUpperCase()} TAKES THE ROUND`;
    await showOverlay([head, `${scoreLine}   Rounds ${match.wins[0]} - ${match.wins[1]}`], ['NEXT ROUND']);
    if (!alive()) return;
    match.round++;
  }
}

function showOverlay(lines, labels) {
  return new Promise(resolve => { overlay = { lines, labels, resolve }; });
}

async function playTurn(side) {
  const die = { v: 1 + Math.floor(Math.random() * 6), o: side };
  await rollAnimation(side, die);
  let move;
  if (side === 0) {
    move = await new Promise(resolve => { choosing = { die, resolve }; });
    choosing = null;
    hover = null;
  } else {
    await wait(500);
    move = R.chooseMove(round, 1, die, match.opp.profile, easy ? EASY_NOISE : 0);
    aiPreview = move;
    await wait(650);
    aiPreview = null;
  }
  await moveAnimation(side, die, move);
}

async function rollAnimation(side, die) {
  const home = HAND[side];
  hand = { die, side, x: home.x - 12, y: home.y - 30, face: 1 + Math.floor(Math.random() * 6) };
  let lastFace = 0;
  let contacts = 0;
  await tween(620, k => {
    hand.x = Math.round(lerp(home.x - 12, home.x, ease(k)));
    let h;
    if (k < 0.4) { const u = k / 0.4; h = -30 * (1 - u * u); }
    else if (k < 0.7) { const u = (k - 0.4) / 0.3; h = -9 * 4 * u * (1 - u); }
    else if (k < 0.88) { const u = (k - 0.7) / 0.18; h = -3 * 4 * u * (1 - u); }
    else h = 0;
    hand.y = home.y + h;
    const c = k >= 0.88 ? 3 : k >= 0.7 ? 2 : k >= 0.4 ? 1 : 0;
    if (c > contacts) { contacts = c; sfx.bounce(); burst(hand.x + 7, home.y + 16, [C.wood4, C.wood3], 3, 0.8); }
    if (k < 0.85 && now - lastFace > 70) { lastFace = now; hand.face = 1 + Math.floor(Math.random() * 6); }
    if (k >= 0.85) hand.face = die.v;
  });
  hand.y = home.y;
  hand.face = die.v;
}

async function moveAnimation(side, die, move) {
  const f = { die, x: hand.x, y: hand.y };
  hand = null;
  round.rollsLeft[side]--;
  if (move.kind === 'build') {
    const tower = round.towers[side][move.t];
    const to = slotPos(side, move.t, tower.length);
    await fly(f, to, 300, 26);
    tower.push(die);
    sfx.land();
    shake = Math.max(shake, 1.2);
    burst(to.x + 7, to.y + 15, [C.wood4, C.sand1], 4, 1);
    popup(`+${die.v}`, to.x + 7, to.y - 8, side === 0 ? C.glow : C.pale);
    return;
  }
  // Raid: the thrown die lands on the tower top and knocks dice off one at a time,
  // until it reaches a die it cannot break (or the tower is gone); then it is spent.
  const target = 1 - side;
  const tower = round.towers[target][move.t];
  const fallen = R.fallingDice(tower, die.v);
  const haul = R.pips(fallen);
  const base = round.loot[side].length;
  await fly(f, slotPos(target, move.t, tower.length), 320, 40);
  flyers.push(f);
  if (target === 1) figureShake = 18;
  // knock-offs run in sequence; each knocked die's flight to the tray carries on in parallel
  const landings = [];
  for (let i = 0; i < fallen.length; i++) {
    const d = fallen[i];
    if (i > 0) {
      // drop onto the next die down
      const from = f.y;
      const to = slotPos(target, move.t, tower.length).y;
      await tween(110, k => { f.y = lerp(from, to, k * k); });
    }
    tower.pop();
    const hit = slotPos(target, move.t, tower.length);
    sfx.crash(i);
    shake = Math.max(shake, 2 + i);
    burst(hit.x + 7, hit.y + 3, stoneColours(d.o), 8, 1.8);
    popup(`+${d.v}`, hit.x + (side === 0 ? 22 : -8), hit.y + 2, side === 0 ? C.glow : C.pale);
    const g = { die: d, x: hit.x, y: hit.y, flat: true };
    landings.push(fly(g, trayPos(side, base + i), 420, 34).then(() => {
      round.loot[side].push(d);
      sfx.loot(i);
    }));
    await wait(170);
  }
  if (tower.length > 0) {
    // blocked: the next die holds, the thrown die clanks off it and breaks
    const from = { x: f.x, y: f.y };
    const to = slotPos(target, move.t, tower.length).y;
    await tween(90, k => { f.y = lerp(from.y, to, k * k); });
    sfx.clank();
    shake = Math.max(shake, 1.5);
    blockFlash = { side: target, t: move.t, until: now + 600 };
    popup('HOLDS', TOWER_X[move.t] + (side === 0 ? -26 : 26), to + 6, C.red2);
    const dir = move.t === 0 ? -1 : 1;
    await tween(300, k => { f.x = from.x + dir * 16 * k; f.y = to - 16 * 4 * k * (1 - k) + 8 * k; });
  } else {
    // the whole tower is gone: the thrown die smashes on the plinth
    const from = f.y;
    const to = slotPos(target, move.t, 0).y;
    await tween(110, k => { f.y = lerp(from, to, k * k); });
    sfx.crash(2);
  }
  flyers = flyers.filter(other => other !== f);
  burst(f.x + 7, f.y + 8, stoneColours(die.o), 14, 2);
  await Promise.all(landings);
  if (fallen.length >= 3 || haul >= 12) {
    shake = Math.max(shake, 7);
    popup('TOPPLE!', 320, 178, C.glow, true, 1300);
    sfx.crash(4);
  }
  await wait(150);
}

// ---------------------------------------------------------------- input

let pointer = { x: -1, y: -1 };
let touchArmed = null;   // touch: first tap previews, second tap on the same target commits

function toTexel(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / r.width * A.W), y: Math.floor((e.clientY - r.top) / r.height * A.H) };
}

function targetAt(p) {
  for (let side = 0; side < 2; side++) {
    if (p.y < SIDE_Y[side][0] || p.y > SIDE_Y[side][1]) continue;
    for (let t = 0; t < 3; t++) if (Math.abs(p.x - TOWER_X[t]) <= 24) return { side, t };
  }
  return null;
}

// The move a target stands for, or null when it is blocked.
function moveFor(target, side, v) {
  if (target.side === side) return { kind: 'build', t: target.t };
  return R.fallingDice(round.towers[target.side][target.t], v).length > 0 ? { kind: 'raid', t: target.t } : null;
}

canvas.addEventListener('pointermove', e => {
  pointer = toTexel(e);
  if (e.pointerType !== 'touch') hover = choosing ? targetAt(pointer) : null;
});
canvas.addEventListener('pointerleave', () => { pointer = { x: -1, y: -1 }; hover = null; });
canvas.addEventListener('pointerdown', e => {
  if (!audio) { try { audio = new AudioContext(); } catch { audio = null; } }
  pointer = toTexel(e);
  const button = buttons.find(b => pointer.x >= b.x && pointer.y >= b.y && pointer.x < b.x + b.w && pointer.y < b.y + b.h);
  if (button) { sfx.click(); button.action(); return; }
  if (!choosing) return;
  const target = targetAt(pointer);
  if (e.pointerType === 'touch') {
    const same = target && touchArmed && touchArmed.side === target.side && touchArmed.t === target.t;
    hover = target;
    touchArmed = target;
    if (!same) return;
  }
  if (!target) return;
  const move = moveFor(target, 0, choosing.die.v);
  if (!move) return;
  touchArmed = null;
  choosing.resolve(move);
});
addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') muted = !muted; });

// ---------------------------------------------------------------- update and render

let flickerFrame = 0;
let nextFlicker = 0;
let lastCount = 0;

function frame(t) {
  now = t;
  for (const tw of [...tweens]) {
    const k = Math.min(1, (t - tw.t0) / tw.ms);
    tw.fn(k);
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
  update();
  render();
  requestAnimationFrame(frame);
}

function update() {
  if (now > nextFlicker) { flickerFrame = (flickerFrame + 1 + Math.floor(Math.random() * 2)) % 6; nextFlicker = now + 90 + Math.random() * 120; }
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
  particles = particles.filter(p => p.life > 0);
  popups = popups.filter(p => now - p.t0 < p.life);
  shake = shake > 0.4 ? shake * 0.86 : 0;
  if (figureShake > 0) figureShake--;
  if (round && now - lastCount > 35) {
    lastCount = now;
    for (const side of [0, 1]) {
      const real = R.score(round, side);
      if (shown[side] === real) continue;
      const diff = real - shown[side];
      shown[side] += Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) / 5));
      pop[side] = 6;
      sfx.tick();
    }
  }
  for (const side of [0, 1]) if (pop[side] > 0) pop[side]--;
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (scene === 'select') renderSelect();
  else renderPlay(sx, sy);
  drawTextButton(muted ? 'SOUND OFF' : 'SOUND ON', 634, 4, () => { muted = !muted; }, 'right');
  canvas.style.cursor = buttons.some(b => inside(pointer, b)) || (choosing && hover && moveFor(hover, 0, choosing.die.v)) ? 'pointer' : 'default';
}

const inside = (p, b) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

function panel(x, y, w, h, border = C.slate) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.night;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

function drawTextButton(label, x, y, action, align = 'left') {
  const w = A.textWidth(label) + 8;
  const bx = align === 'right' ? x - w : align === 'center' ? x - Math.floor(w / 2) : x;
  const b = { x: bx, y, w, h: 13, action };
  const hot = inside(pointer, b);
  panel(b.x, b.y, b.w, b.h, hot ? C.candle : C.slate);
  A.drawText(ctx, label, b.x + 4, b.y + 3, hot ? C.glow : C.mist);
  buttons.push(b);
}

function drawButton(label, cx, y, action) {
  const w = A.textWidth(label) + 20;
  const b = { x: cx - Math.floor(w / 2), y, w, h: 19, action };
  const hot = inside(pointer, b);
  panel(b.x, b.y + (hot ? -1 : 0), b.w, b.h, hot ? C.glow : C.amber);
  A.drawText(ctx, label, cx, b.y + 6 + (hot ? -1 : 0), hot ? C.glow : C.cream, { align: 'center', shadow: C.ink });
  buttons.push(b);
}

// ---------------------------------------------------------------- select screen

function renderSelect() {
  dither(0, 0, A.W, A.H);
  ctx.drawImage(title, Math.floor((A.W - title.width) / 2), 26);
  A.drawText(ctx, 'a dice game of towers and raids', 320, 72, C.mist, { align: 'center', shadow: C.ink });
  A.drawText(ctx, 'Choose who sits across the table', 320, 92, C.candle, { align: 'center', shadow: C.ink });
  OPPONENTS.forEach((opp, i) => {
    const card = { x: 110 + i * 150 - 10, y: 110, w: 140, h: 150, action: () => startMatch(opp) };
    const hot = inside(pointer, card);
    const lift = hot ? -2 : 0;
    panel(card.x, card.y + lift, card.w, card.h, hot ? C.candle : C.slate);
    const fx = card.x + 46, fy = card.y + 12 + lift;
    panel(fx, fy, 48, 48, hot ? C.amber : C.blue);
    ctx.fillStyle = C.deep;
    ctx.fillRect(fx + 1, fy + 1, 46, 46);
    ctx.drawImage(A.figureSprite(opp.id, blinkNow(i)), fx + 8, fy + 15);
    const cx = card.x + card.w / 2;
    A.drawText(ctx, opp.name.toUpperCase(), cx, fy + 56, C.glow, { align: 'center', shadow: C.ink });
    A.drawText(ctx, opp.title, cx, fy + 67, C.candle, { align: 'center' });
    opp.blurb.forEach((line, j) => A.drawText(ctx, line, cx, fy + 84 + j * 11, C.mist, { align: 'center' }));
    buttons.push(card);
  });
  const label = `${easy ? '[x]' : '[ ]'} EASY: the opponent makes mistakes`;
  const w = A.textWidth(label) + 8;
  const b = { x: 320 - Math.floor(w / 2), y: 280, w, h: 13, action: () => { easy = !easy; } };
  A.drawText(ctx, label, 320, 283, inside(pointer, b) ? C.glow : easy ? C.candle : C.mist, { align: 'center', shadow: C.ink });
  buttons.push(b);
  A.drawText(ctx, 'First to win 2 rounds takes the match.', 320, 312, C.steel, { align: 'center', shadow: C.ink });
}

const blinkNow = seed => (now + seed * 1300) % 3400 < 140;

// ---------------------------------------------------------------- play screen

function renderPlay(sx, sy) {
  const opp = match.opp;
  // the opponent across the table
  const fShake = figureShake > 0 ? (figureShake % 4 < 2 ? 1 : -1) : 0;
  ctx.drawImage(A.figureSprite(opp.id, blinkNow(0)), FIGURE_POS.x + fShake, FIGURE_POS.y);

  ctx.setTransform(1, 0, 0, 1, sx, sy);
  // preview of the move under consideration
  const previewSide = choosing ? 0 : aiPreview ? 1 : null;
  const die = choosing ? choosing.die : hand?.die;
  let preview = null; // { side, move } or { blocked: target }
  if (choosing && hover) {
    const move = moveFor(hover, 0, die.v);
    preview = move ? { side: 0, move } : { blocked: hover };
  } else if (aiPreview) preview = { side: 1, move: aiPreview };

  const falling = new Set();
  if (preview?.move?.kind === 'raid') {
    for (const d of R.fallingDice(round.towers[1 - preview.side][preview.move.t], die.v)) falling.add(d);
  }

  for (const side of [0, 1]) {
    for (let t = 0; t < 3; t++) {
      const tower = round.towers[side][t];
      tower.forEach((d, i) => {
        const p = slotPos(side, t, i);
        const hot = falling.has(d);
        const lift = hot && Math.floor(now / 160) % 2 ? -2 : 0;
        const blocking = blockFlash && now < blockFlash.until && blockFlash.side === side && blockFlash.t === t && i === tower.length - 1;
        const jitter = blocking ? [1, -1, 0][Math.floor(now / 50) % 3] : 0;
        const style = hot ? (previewSide === 0 ? 'hi' : 'red') : blocking && Math.floor(now / 100) % 2 ? 'red' : 'normal';
        ctx.drawImage(A.dieSprite(d.v, d.o, style), p.x + jitter, p.y + lift);
      });
      // during the player's choice, opponent towers that cannot be raided are dimmed
      if (choosing && side === 1 && !moveFor({ side, t }, 0, die.v)) {
        const top = slotPos(1, t, Math.max(tower.length, 1) - 1).y - 2;
        dither(TOWER_X[t] - 12, top, 24, BASE_Y[1] + 5 - top);
      }
    }
  }
  if (preview?.move?.kind === 'build') {
    const tower = round.towers[preview.side][preview.move.t];
    const p = slotPos(preview.side, preview.move.t, tower.length);
    if (Math.floor(now / 200) % 2 || preview.side === 0) ctx.drawImage(A.dieSprite(die.v, preview.side, 'ghost'), p.x, p.y);
    A.drawText(ctx, `+${die.v}`, p.x + 7, p.y - 10, preview.side === 0 ? C.glow : C.pale, { align: 'center', shadow: C.ink });
  } else if (preview?.move?.kind === 'raid') {
    const tower = round.towers[1 - preview.side][preview.move.t];
    const p = slotPos(1 - preview.side, preview.move.t, tower.length - 1);
    const haul = R.pips(R.fallingDice(tower, die.v));
    A.drawText(ctx, `TAKE +${haul}`, p.x + 7, p.y - 11, preview.side === 0 ? C.glow : C.red2, { align: 'center', shadow: C.ink });
  } else if (preview?.blocked) {
    const tower = round.towers[1][preview.blocked.t];
    const y = slotPos(1, preview.blocked.t, Math.max(tower.length, 1) - 1).y - 11;
    const why = tower.length === 0 ? 'EMPTY' : `TOP ${tower[tower.length - 1].v} HOLDS`;
    A.drawText(ctx, why, TOWER_X[preview.blocked.t], y, C.red2, { align: 'center', shadow: C.ink });
  }

  // loot trays
  for (const side of [0, 1]) {
    round.loot[side].forEach((d, i) => {
      const p = trayPos(side, i);
      ctx.drawImage(A.dieSprite(d.v, d.o, 'normal', true), p.x, p.y);
    });
    const label = side === 0 ? 'YOUR LOOT' : `${opp.name.toUpperCase()}'S LOOT`;
    A.drawText(ctx, `${label}  ${R.lootPips(round, side)}`, TRAY[side].x + 2, TRAY[side].y - 10, C.mist, { shadow: C.ink });
  }

  // rolled die at its hand mat
  if (hand) {
    const glow = choosing && Math.floor(now / 300) % 2;
    ctx.drawImage(A.dieSprite(hand.face, hand.side, glow ? 'hi' : 'normal'), Math.round(hand.x), Math.round(hand.y));
    const label = hand.side === 0 ? 'YOUR DIE' : `${opp.name.toUpperCase()}'S DIE`;
    A.drawText(ctx, label, HAND[hand.side].x + 7, HAND[hand.side].y + 26, hand.side === 0 ? C.glow : C.mist, { align: 'center', shadow: C.ink });
  }
  for (const f of flyers) ctx.drawImage(A.dieSprite(f.die.v, f.die.o, 'normal', !!f.flat), Math.round(f.x), Math.round(f.y));
  for (const p of particles) { ctx.fillStyle = p.colour; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  for (const p of popups) {
    const k = (now - p.t0) / p.life;
    if (k > 0.75 && Math.floor(now / 60) % 2) continue;
    A.drawText(ctx, p.text, p.x, p.y - Math.round(ease(Math.min(1, k * 1.5)) * 12), p.colour, { align: 'center', shadow: C.ink, font: p.big ? A.BIG : A.SMALL });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // score panels
  const delta = [0, 0];
  if (preview?.move) {
    const s = preview.side;
    if (preview.move.kind === 'build') delta[s] = die.v;
    else { const haul = R.pips(R.fallingDice(round.towers[1 - s][preview.move.t], die.v)); delta[s] = haul; delta[1 - s] = -haul; }
  }
  for (const side of [0, 1]) drawPanel(side, delta[side]);

  // wall info
  A.drawText(ctx, `ROUND ${match.round}`, 10, 6, C.candle, { shadow: C.ink });
  A.drawText(ctx, 'first to 2 rounds', 10, 16, C.steel, { shadow: C.ink });
  drawTextButton('MENU', 578, 4, toMenu, 'right');
  if (easy) A.drawText(ctx, 'EASY', 320, 6, C.steel, { align: 'center', shadow: C.ink });

  A.drawText(ctx, HINT, 320, 349, C.mist, { align: 'center' });

  if (banner) {
    const k = Math.min(1, (now - banner.t0) / 250);
    const y = Math.round(lerp(150, 160, ease(k)));
    panel(220, y, 200, 40, C.amber);
    A.drawText(ctx, banner.text, 320, y + 8, C.glow, { align: 'center', shadow: C.ink });
    A.drawText(ctx, banner.sub, 320, y + 24, C.mist, { align: 'center' });
  }
  if (overlay) renderOverlay();
}

function drawPanel(side, delta) {
  const box = PANEL[side];
  const active = turn === side && !overlay && !banner;
  panel(box.x, box.y, box.w, box.h, active ? C.candle : C.slate);
  const x = box.x + 6;
  let y = box.y + 6;
  const name = side === 0 ? 'YOU' : match.opp.name.toUpperCase();
  A.drawText(ctx, name, x, y, active ? C.glow : C.cream, { shadow: C.ink });
  if (active) A.drawText(ctx, side === 0 ? '< your turn' : '< thinking', x + A.textWidth(name) + 6, y, C.candle);
  // rounds won
  for (let i = 0; i < R.ROUNDS_TO_WIN; i++) {
    const cx = box.x + box.w - 20 + i * 10;
    ctx.fillStyle = C.ink; ctx.fillRect(cx - 1, y - 1, 9, 9);
    ctx.fillStyle = i < match.wins[side] ? C.candle : C.deep; ctx.fillRect(cx, y, 7, 7);
    if (i < match.wins[side]) { ctx.fillStyle = C.glow; ctx.fillRect(cx + 1, y + 1, 2, 2); }
  }
  y += 14;
  const bounce = pop[side] > 3 ? -1 : 0;
  const total = String(shown[side]);
  A.drawText(ctx, total, x, y + bounce, pop[side] ? C.cream : C.glow, { font: A.BIG, shadow: C.ink });
  if (delta) {
    A.drawText(ctx, delta > 0 ? `+${delta}` : `${delta}`, x + A.textWidth(total, A.BIG) + 6, y + 2, delta > 0 ? C.glow : C.red2, { shadow: C.ink });
  }
  A.drawText(ctx, `towers ${R.towerPips(round, side)}`, x + 52, y, C.mist);
  A.drawText(ctx, `loot ${R.lootPips(round, side)}`, x + 52, y + 10, C.mist);
  y += 26;
  A.drawText(ctx, `rolls left ${round.rollsLeft[side]}`, x, y, C.steel);
  y += 11;
  for (let i = 0; i < R.ROLLS_PER_ROUND; i++) {
    const nx = x + i * 8;
    ctx.fillStyle = C.ink; ctx.fillRect(nx, y, 6, 8);
    ctx.fillStyle = i < round.rollsLeft[side] ? (side === 0 ? C.sand2 : C.mist) : C.deep;
    ctx.fillRect(nx + 1, y + 1, 4, 6);
  }
}

function renderOverlay() {
  dither(0, 0, A.W, A.H);
  const w = 320, h = 110, x = 160, y = 118;
  panel(x, y, w, h, C.amber);
  A.drawText(ctx, overlay.lines[0], 320, y + 16, C.glow, { align: 'center', shadow: C.ink });
  A.drawText(ctx, overlay.lines[1], 320, y + 36, C.mist, { align: 'center' });
  const n = overlay.labels.length;
  overlay.labels.forEach((label, i) => {
    drawButton(label, 320 + (i - (n - 1) / 2) * 120, y + 70, () => {
      const resolve = overlay.resolve;
      overlay = null;
      resolve(i);
    });
  });
}

requestAnimationFrame(frame);
