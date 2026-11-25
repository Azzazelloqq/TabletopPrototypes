import { drawText, wrap } from './font.js';
import { PAL, buildArt, LAYOUT as L } from './art.js';
import * as R from './rules.js';

const { YOU, RIVAL } = R;
const HINT = "Shove a sack into a chute; whatever falls out the far end lands in your rival's yard.";
const CHUTE_NAMES = ['LEFT', 'MIDDLE', 'RIGHT'];

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const art = buildArt();
const shade = (() => { // checkered darkening overlay for menus
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  const x = c.getContext('2d'); x.fillStyle = PAL.k;
  for (let y = 0; y < 360; y++) for (let i = y % 2; i < 640; i += 2) x.fillRect(i, y, 1, 1);
  return c;
})();

function fit() {
  const k = Math.max(1, Math.floor(Math.min(innerWidth / 640, innerHeight / 360)));
  cv.style.width = `${640 * k}px`;
  cv.style.height = `${360 * k}px`;
}
addEventListener('resize', fit);
fit();

// ---- sound: tiny synthesised blips ----
let ac = null;
function tone(f1, f2, dur, type = 'square', vol = 0.05, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
const sfx = {
  tick: () => tone(700, 600, 0.03),
  thud: () => tone(120, 55, 0.12, 'square', 0.06),
  land: (v) => v === 0 ? tone(160, 90, 0.1, 'triangle', 0.06) : v > 0
    ? (tone(988, 988, 0.06, 'triangle', 0.08), tone(1319, 1319, 0.1, 'triangle', 0.08, 0.06))
    : (tone(900, 1700, 0.08, 'sawtooth', 0.03), tone(1500, 800, 0.08, 'sawtooth', 0.03, 0.09)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.07, i * 0.1)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.16, 'triangle', 0.07, i * 0.13)),
};

// ---- game state ----
const game = {
  screen: 'select', rival: 0, easy: false, st: null, wins: [0, 0], round: 0, nextStarter: YOU,
  sel: 0, hover: null, armed: null, mouse: { x: -1, y: -1 }, log: [], anim: null, ai: null,
  result: null, banner: null, buttons: [], shown: [0, 0], bumped: [0, 0], floaters: [], handHover: null, wiggle: 0,
};
window.ratChute = game; // for debugging in the console

const rival = () => R.RIVALS[game.rival];
const label = (s) => R.KINDS[s.kind].label;
const good = (v) => (v > 0 ? PAL.Q : v < 0 ? PAL.E : PAL.C);
const bad = (v) => good(-v);

function startMatch(i) {
  game.rival = i; game.wins = [0, 0]; game.round = 0; game.nextStarter = YOU;
  startRound();
}

function startRound() {
  game.round++;
  game.st = R.newRound(game.nextStarter);
  game.log = [{ text: `ROUND ${game.round}: ${game.nextStarter === YOU ? 'YOU SHOVE' : rival().name + ' SHOVES'} FIRST`, color: PAL.C }];
  game.nextStarter = 1 - game.nextStarter;
  Object.assign(game, { screen: 'play', sel: null, hover: null, armed: null, anim: null, ai: null, result: null, banner: null, shown: [0, 0], floaters: [] });
}

function addLog(text, color) {
  game.log.push({ text, color });
  if (game.log.length > 6) game.log.shift();
}

// ---- positions ----
function handCenter(who, i, raised) {
  const y = L.handY[who] + (raised ? (who === YOU ? -8 : 6) : 0);
  return { x: L.handX[i], y };
}
function yardCell(who, i) {
  return {
    x: L.yardX + (i % L.yardCols) * L.cellW,
    y: (who === RIVAL ? L.yardTop : L.yardBottom + 2) + Math.floor(i / L.yardCols) * L.cellH,
  };
}
const yardCenter = (who, i) => { const c = yardCell(who, i); return { x: c.x + 9, y: c.y + 11 }; };
const totalPos = (who) => ({ x: L.totalX - 14, y: who === RIVAL ? 26 : 322 });

// A "+N" that flies from a landed sack to its yard total; the total counts it on arrival.
function scoreFloat(who, i, v, t0) {
  const from = yardCenter(who, i), to = totalPos(who);
  game.floaters.push({ who, v, t0, end: t0 + 650, x0: from.x, y0: from.y - 6, x1: to.x, y1: to.y });
}

// ---- animation: sacks fly along timed keys [t, x, y, hop] ----
function startShove(who, h, k, now) {
  const st = game.st, c = st.chutes[k], sack = st.hands[who][h], cx = L.chuteX[k];
  const dir = who === YOU ? -1 : 1;
  const end = who === YOU ? 0 : 2, exit = 2 - end;
  const t1 = now + 200, t2 = now + 520, t3 = now + 900;
  const from = handCenter(who, h, true);
  const flyers = [{ sack, keys: [[now, from.x, from.y], [t1, cx, L.slotY[end] - dir * L.stepY], [t2, cx, L.slotY[end]]] }];
  c.forEach((s, i) => {
    const keys = [[now, cx, L.slotY[i]], [t1, cx, L.slotY[i]], [t2, cx, L.slotY[i] + dir * L.stepY]];
    if (i === exit) { const y = yardCenter(1 - who, st.yards[1 - who].length); keys.push([t3, y.x, y.y, true]); }
    flyers.push({ sack: s, keys });
  });
  const dropped = c[exit];
  game.hover = null; game.armed = null; shownPv = null;
  game.anim = {
    flyers, end: t3, events: [[t1, sfx.thud], [t3, () => sfx.land(dropped.v)]],
    done: () => {
      R.applyShove(st, who, h, k);
      scoreFloat(1 - who, st.yards[1 - who].length - 1, dropped.v, t3);
      if (who === YOU) addLog(`YOU: ${label(sack)} IN, ${rival().name} GETS ${label(dropped)}`, bad(dropped.v));
      else addLog(`${rival().name}: ${label(sack)} IN, YOU GET ${label(dropped)}`, good(dropped.v));
      if (R.isRoundOver(st)) startDoorsteps(t3);
      else game.sel = st.hands[YOU].length === 1 ? 0 : null;
    },
  };
}

function startDoorsteps(now) {
  const st = game.st, flyers = [], events = [];
  game.banner = 'DOORSTEPS DROP!';
  st.chutes.forEach((c, k) => {
    const t = now + 700 + k * 650, cx = L.chuteX[k];
    for (const [who, slot] of [[YOU, 0], [RIVAL, 2]]) {
      const to = yardCenter(who, st.yards[who].length + k);
      flyers.push({ sack: c[slot], keys: [[now, cx, L.slotY[slot]], [t, cx, L.slotY[slot]], [t + 450, to.x, to.y, true]] });
    }
    const iy = st.yards[YOU].length + k, ir = st.yards[RIVAL].length + k;
    events.push([t + 450, () => {
      sfx.land(c[0].v + c[2].v || 1);
      scoreFloat(YOU, iy, c[0].v, t + 450); scoreFloat(RIVAL, ir, c[2].v, t + 450);
    }]);
  });
  game.anim = {
    flyers, events, end: now + 700 + 3 * 650 + 500,
    done: () => { R.applyDoorsteps(st); game.banner = null; finishRound(); },
  };
}

function finishRound() {
  const a = R.total(game.st.yards[YOU]), b = R.total(game.st.yards[RIVAL]);
  const winner = a > b ? YOU : b > a ? RIVAL : null;
  if (winner !== null) game.wins[winner]++;
  game.result = { a, b, winner };
  game.screen = game.wins.some((w) => w >= 2) ? 'matchEnd' : 'roundEnd';
  (winner === RIVAL ? sfx.lose : sfx.win)();
}

const ease = (p) => p * p * (3 - 2 * p);
function flyerPos(f, now) {
  const k = f.keys;
  if (now <= k[0][0]) return { x: k[0][1], y: k[0][2] };
  for (let i = 1; i < k.length; i++) {
    if (now < k[i][0]) {
      const [ta, xa, ya] = k[i - 1], [tb, xb, yb, hop] = k[i];
      const p = (now - ta) / (tb - ta), e = ease(p);
      return { x: xa + (xb - xa) * e, y: ya + (yb - ya) * e - (hop ? Math.sin(Math.PI * p) * 18 : 0) };
    }
  }
  const last = k.at(-1);
  return { x: last[1], y: last[2] };
}

// ---- update ----
function update(now) {
  for (const f of game.floaters) if (now >= f.end) { game.shown[f.who] += f.v; game.bumped[f.who] = now; }
  game.floaters = game.floaters.filter((f) => now < f.end);
  const a = game.anim;
  if (a) {
    while (a.events.length && now >= a.events[0][0]) a.events.shift()[1]();
    if (now >= a.end) { game.anim = null; a.done(); }
    return;
  }
  const st = game.st;
  if (game.screen !== 'play' || st.turn !== RIVAL) return;
  if (!game.ai) game.ai = { at: now + 450, move: null };
  else if (!game.ai.move && now >= game.ai.at) {
    game.ai.move = R.chooseRivalMove(st, rival().w, game.easy ? 3 : 0.25);
    game.ai.at = now + 1100;
    sfx.tick();
  } else if (game.ai.move && now >= game.ai.at) {
    const { h, k } = game.ai.move;
    game.ai = null;
    startShove(RIVAL, h, k, now);
  }
}

const yourMove = () => game.screen === 'play' && !game.anim && game.st.turn === YOU;

// ---- drawing helpers ----
const R0 = Math.round;
function box(x, y, w, h, c, t = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, t); ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h); ctx.fillRect(x + w - t, y, t, h);
}
function sackFrame(s, now) {
  if (s.kind === 'straw') return 0;
  if (s.kind === 'rat' || s.kind === 'mouse') return Math.floor(now / 230 + s.id) % 2;
  if (s.kind === 'plague') return Math.floor(now / 140 + s.id) % 2;
  return (now / 90 + s.id * 13) % 45 < 3 ? 1 : 0;
}
function drawSack(s, x, y, now) {
  ctx.drawImage(art.sack[s.kind][sackFrame(s, now)], R0(x) - 17, R0(y) - 19);
}
function drawBack(x, y) { ctx.drawImage(art.back, R0(x) - 17, R0(y) - 19); }
const blink = (now) => Math.floor(now / 260) % 2 === 0;
function sackBox(x, y, color) { box(R0(x) - 19, R0(y) - 21, 38, 42, color, 2); }

function button(x, y, w, h, text, onClick) {
  const over = game.mouse.x >= x && game.mouse.x < x + w && game.mouse.y >= y && game.mouse.y < y + h;
  ctx.fillStyle = PAL.k; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = over ? PAL.B : PAL.b; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = over ? PAL.L : PAL.B; ctx.fillRect(x + 1, y + 1, w - 2, 1);
  drawText(ctx, text, x + w / 2, y + Math.floor((h - 7) / 2), over ? PAL.Y : PAL.c, { align: 'center' });
  game.buttons.push({ x, y, w, h, onClick });
}

function portrait(i, x, y) {
  ctx.fillStyle = PAL.k; ctx.fillRect(x, y, 36, 36);
  ctx.fillStyle = PAL.D; ctx.fillRect(x + 1, y + 1, 34, 34);
  box(x + 1, y + 1, 34, 34, PAL.b);
  ctx.drawImage(art.portraits[i], x + 2, y + 2);
}

function pips(x, y, n) {
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = PAL.k; ctx.fillRect(x + i * 10, y, 8, 8);
    ctx.fillStyle = i < n ? PAL.G : PAL.D; ctx.fillRect(x + i * 10 + 1, y + 1, 6, 6);
    if (i < n) { ctx.fillStyle = PAL.Y; ctx.fillRect(x + i * 10 + 2, y + 2, 2, 2); }
  }
}

// ---- screens ----
function renderSelect(now) {
  ctx.drawImage(shade, 0, 0);
  drawText(ctx, 'RAT CHUTE', 320, 18, PAL.G, { scale: 3, align: 'center', shadow: PAL.k });
  drawText(ctx, 'CHOOSE YOUR RIVAL ACROSS THE CELLAR WALL', 320, 50, PAL.c, { align: 'center', shadow: PAL.k });
  const styleColor = [PAL.G, PAL.Q, PAL.p];
  R.RIVALS.forEach((r, i) => {
    const x = 30 + i * 200, y = 70, w = 180, h = 184;
    const over = game.mouse.x >= x && game.mouse.x < x + w && game.mouse.y >= y && game.mouse.y < y + h;
    ctx.fillStyle = PAL.k; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = over ? PAL.D : PAL.d; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    box(x + 1, y + 1, w - 2, h - 2, over ? PAL.L : PAL.b);
    portrait(i, x + 72, y + 12);
    drawText(ctx, r.name, x + 90, y + 58, PAL.c, { scale: 2, align: 'center' });
    drawText(ctx, r.style, x + 90, y + 78, styleColor[i], { align: 'center' });
    wrap(r.blurb, 160).forEach((line, j) => drawText(ctx, line, x + 90, y + 96 + j * 11, PAL.C, { align: 'center' }));
    button(x + 40, y + 148, 100, 20, 'PLAY', () => startMatch(i));
    game.buttons.at(-1).x = x; game.buttons.at(-1).y = y; game.buttons.at(-1).w = w; game.buttons.at(-1).h = h;
  });
  const bx = 228, by = 270;
  ctx.fillStyle = PAL.k; ctx.fillRect(bx, by, 11, 11);
  ctx.fillStyle = PAL.D; ctx.fillRect(bx + 1, by + 1, 9, 9);
  if (game.easy) { ctx.fillStyle = PAL.G; ctx.fillRect(bx + 3, by + 3, 5, 5); }
  drawText(ctx, 'EASY: SHAKY HANDS, MORE MISTAKES', bx + 18, by + 2, game.easy ? PAL.Y : PAL.C, { shadow: PAL.k });
  game.buttons.push({ x: bx - 4, y: by - 4, w: 230, h: 19, onClick: () => { game.easy = !game.easy; } });
  drawText(ctx, 'FIRST TO WIN 2 ROUNDS TAKES THE MATCH', 320, 300, PAL.C, { align: 'center', shadow: PAL.k });
  drawCandles(now);
}

function drawCandles(now) {
  L.candles.forEach(([x, y], i) => ctx.drawImage(art.candle[Math.floor(now / 160 + i * 1.7) % 3], x, y));
}

function previewInfo() {
  if (!yourMove() || game.sel === null) return null;
  const k = game.armed ?? game.hover;
  if (k === null) return null;
  return { k, ...R.previewShove(game.st, YOU, game.sel, k) };
}

// ---- move preview: an overlay on the unchanged board, faded in and out ----
let shownPv = null, lastNow = 0;
function fadePreview(target, now) {
  const step = Math.min(50, now - lastNow) / 170;
  lastNow = now;
  if (target && (!shownPv || shownPv.k !== target.k || shownPv.sack !== target.sack))
    shownPv = { ...target, alpha: shownPv?.k === target.k ? shownPv.alpha : 0 };
  if (!shownPv) return null;
  shownPv.alpha = Math.max(0, Math.min(1, shownPv.alpha + (target ? step : -step)));
  if (!target && shownPv.alpha === 0) shownPv = null;
  return shownPv;
}
// Gentle looping push toward the rival, a few texels at most.
const nudge = (pv, now) => -Math.round(pv.alpha * 3 * (1 - Math.cos((2 * Math.PI * now) / 900)) / 2);
const GHOST_Y = L.slotY[0] + 62;

function dashedBox(x, y, w, h, color, now) {
  ctx.fillStyle = color;
  const off = Math.floor(now / 110);
  const on = (i) => (i + off) % 6 < 3;
  for (let i = 0; i < w; i++) { if (on(i)) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + w - 1 - i, y + h - 1, 1, 1); } }
  for (let j = 0; j < h; j++) { if (on(j)) { ctx.fillRect(x + w - 1, y + j, 1, 1); ctx.fillRect(x, y + h - 1 - j, 1, 1); } }
}

function drawPreviewOverlay(pv, now) {
  const st = game.st, cx = L.chuteX[pv.k], off = nudge(pv, now), a = pv.alpha;
  ctx.save();
  ctx.globalAlpha = 0.45 * a; ctx.fillStyle = PAL.k;
  for (let k = 0; k < 3; k++) if (k !== pv.k) ctx.fillRect(L.chuteX[k] - 22, L.chuteTop - 2, 44, L.chuteBottom - L.chuteTop + 4);
  ctx.globalAlpha = a;
  dashedBox(cx - 23, L.chuteTop - 3, 46, L.chuteBottom - L.chuteTop + 6, PAL.F, now);
  // slide direction between the sacks
  for (const y of [(L.slotY[0] + GHOST_Y) / 2, (L.slotY[0] + L.slotY[1]) / 2, (L.slotY[1] + L.slotY[2]) / 2])
    drawText(ctx, '^', cx, y - 4 + off, PAL.F, { align: 'center', shadow: PAL.k });
  // the sack that would drop, and where it would land
  sackBox(cx, L.slotY[2] + off, bad(pv.dropped.v));
  const land = yardCell(RIVAL, st.yards[RIVAL].length);
  const x0 = cx, y0 = L.slotY[2] - 22 + off, x1 = land.x + 9, y1 = land.y + 24;
  ctx.fillStyle = PAL.F;
  for (let i = 1; i < 14; i++) {
    const t = ((i + (now / 140) % 1) / 14), u = 1 - t; // marching dots on a curve
    const x = u * u * x0 + 2 * u * t * x0 + t * t * x1, y = u * u * y0 + 2 * u * t * y1 + t * t * y1;
    ctx.fillRect(R0(x) - 1, R0(y) - 1, 2, 2);
  }
  ctx.globalAlpha = 0.6 * a;
  ctx.drawImage(art.mini[pv.dropped.kind], land.x, land.y);
  ctx.globalAlpha = a;
  dashedBox(land.x - 1, land.y - 1, 20, 25, bad(pv.dropped.v), now);
  // ghost of the hand sack at the entry: it becomes your doorstep
  ctx.globalAlpha = 0.55 * a;
  drawSack(pv.sack, cx, GHOST_Y + off, now);
  ctx.globalAlpha = a;
  dashedBox(cx - 19, GHOST_Y + off - 21, 38, 42, good(pv.sack.v), now);
  if (pv.sack.v < 0) {
    ctx.fillStyle = PAL.k; ctx.fillRect(cx + 13, GHOST_Y + off - 25, 9, 11);
    ctx.fillStyle = PAL.E; ctx.fillRect(cx + 14, GHOST_Y + off - 24, 7, 9);
    drawText(ctx, '!', cx + 17, GHOST_Y + off - 23, PAL.c);
  }
  ctx.restore();
}

function renderChute(k, now, pv) {
  const st = game.st, cx = L.chuteX[k], hidden = game.anim ? new Set(game.anim.flyers.map((f) => f.sack?.id)) : null;
  const off = pv && pv.k === k ? nudge(pv, now) : 0;
  const aiPick = game.ai?.move?.k === k;
  if (aiPick) box(cx - 23, L.chuteTop - 2, 46, L.chuteBottom - L.chuteTop + 4, PAL.E);
  st.chutes[k].forEach((s, i) => { if (s && !hidden?.has(s.id)) drawSack(s, cx, L.slotY[i] + off, now); });
  if (aiPick && blink(now)) sackBox(cx, L.slotY[0], good(st.chutes[k][0].v));
}

function renderBoard(now) {
  const st = game.st, r = rival(), target = previewInfo(), pv = fadePreview(target, now);
  const hidden = game.anim ? new Set(game.anim.flyers.map((f) => f.sack.id)) : new Set();
  drawCandles(now);

  // rival info (top-left) and yours (bottom-left)
  portrait(game.rival, 6, 6);
  drawText(ctx, r.name, 48, 8, PAL.c, { scale: 2 });
  drawText(ctx, r.style + (game.easy ? ' (EASY)' : ''), 48, 26, PAL.C);
  pips(48, 38, game.wins[RIVAL]);
  drawText(ctx, 'YOU', 10, 306, PAL.c, { scale: 2 });
  pips(10, 326, game.wins[YOU]);
  drawText(ctx, 'ROUNDS', 32, 327, PAL.C);
  drawText(ctx, 'ROUNDS', 70, 39, PAL.C);
  // yard totals at the side, next to the yards; they count each sack when its score arrives
  for (const [who, y] of [[RIVAL, 6], [YOU, 303]]) {
    drawText(ctx, 'YARD', L.totalX, y, PAL.C, { align: 'right' });
    const t = game.shown[who], fresh = now - game.bumped[who] < 220;
    drawText(ctx, String(t), L.totalX, y + 11 - (fresh ? 2 : 0), fresh ? PAL.c : t < 0 ? PAL.E : PAL.Y, { scale: 3, align: 'right', shadow: PAL.k });
  }

  // left panel: round and bag
  drawText(ctx, `ROUND ${game.round}`, 98, 134, PAL.c, { scale: 2, align: 'center' });
  drawText(ctx, 'FIRST TO 2 ROUND WINS', 98, 154, PAL.C, { align: 'center' });
  drawBack(48, 190);
  drawText(ctx, 'IN THE BAG', 74, 176, PAL.C);
  drawText(ctx, String(st.bag.length), 74, 188, PAL.c, { scale: 2 });
  drawText(ctx, `${r.name}'S DOORSTEP >`, 204, L.slotY[2] + 14, PAL.C, { align: 'right', shadow: PAL.k });
  drawText(ctx, 'YOUR DOORSTEP >', 204, L.slotY[0] + 14, PAL.C, { align: 'right', shadow: PAL.k });

  for (let k = 0; k < 3; k++) renderChute(k, now, pv);

  // yards
  for (const who of [YOU, RIVAL])
    st.yards[who].forEach((s, i) => { const c = yardCell(who, i); ctx.drawImage(art.mini[s.kind], c.x, c.y); });
  if (pv) drawPreviewOverlay(pv, now);

  // your hand: bobs while waiting for a pick, lifts on hover, stays up and framed when picked
  const mine = yourMove();
  st.hands[YOU].forEach((s, i) => {
    if (hidden.has(s.id)) return;
    const picked = i === game.sel && mine, over = mine && game.handHover === i;
    const p = handCenter(YOU, i, picked);
    let dx = 0, dy = 0;
    if (mine && game.sel === null) dy = Math.round(Math.sin(now / 260 + i * 1.6) * 1.5) - 1;
    if (over && !picked) dy -= 4;
    if (now - game.wiggle < 400) dx = Math.round(Math.sin((now - game.wiggle) / 35) * 2);
    drawSack(s, p.x + dx, p.y + dy, now);
    if (picked) sackBox(p.x, p.y, PAL.F);
    else if (over) box(R0(p.x) - 19, R0(p.y + dy) - 21, 38, 42, PAL.L);
  });
  st.hands[RIVAL].forEach((s, i) => {
    if (hidden.has(s.id)) return;
    const picked = game.ai?.move?.h === i;
    const p = handCenter(RIVAL, i, picked);
    if (picked) { drawSack(s, p.x, p.y, now); sackBox(p.x, p.y, PAL.E); } else drawBack(p.x, p.y);
  });

  // right panel: whose turn and what happened; round results also land here
  const px = 541;
  if (game.screen !== 'play') renderResult(px);
  else if (game.banner) {
    drawText(ctx, game.banner, px, 72, PAL.F, { scale: 2, align: 'center' });
    drawText(ctx, 'EACH CHUTE END FALLS TO ITS SIDE', px, 92, PAL.C, { align: 'center' });
  } else {
    if (st.turn === YOU) drawText(ctx, 'YOUR TURN', px, 72, PAL.F, { scale: 2, align: 'center' });
    else drawText(ctx, `${r.name}'S TURN`, px, 72, PAL.E, { scale: 2, align: 'center' });
    if (mine) drawText(ctx, game.sel === null ? 'PICK A SACK FROM YOUR HAND' : 'NOW PICK A CHUTE', px, 92, PAL.C, { align: 'center' });
    else if (game.ai?.move) drawText(ctx, `SHOVES ${label(st.hands[RIVAL][game.ai.move.h])} INTO THE ${CHUTE_NAMES[game.ai.move.k]} CHUTE`, px, 92, PAL.E, { align: 'center' });
    else if (st.turn === RIVAL && !game.anim) drawText(ctx, 'THINKING...', px, 92, PAL.C, { align: 'center' });
  }
  if (game.screen === 'play') game.log.forEach((e, j) => drawText(ctx, e.text, 458, 136 + j * 12, e.color));

  // flying sacks
  if (game.anim) for (const f of game.anim.flyers) { const p = flyerPos(f, now); drawSack(f.sack, p.x, p.y, now); }

  // scores flying to the totals
  for (const f of game.floaters) {
    const t = Math.max(0, (now - f.t0) / (f.end - f.t0)), e = ease(t);
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * t) * 10;
    drawText(ctx, (f.v > 0 ? '+' : '') + f.v, x, y, f.v > 0 ? PAL.Y : f.v < 0 ? PAL.E : PAL.C, { scale: 2, align: 'center', shadow: PAL.k });
  }
  button(8, 336, 38, 12, 'MENU', () => { game.screen = 'select'; game.anim = null; game.ai = null; });
}

// Small result block in the side panel instead of a popup over the board.
function renderResult(px) {
  const { a, b, winner } = game.result, r = rival(), match = game.screen === 'matchEnd';
  const youWin = winner === YOU, col = winner === null ? PAL.C : youWin ? PAL.G : PAL.E;
  const head = match ? (youWin ? 'MATCH WON!' : 'MATCH LOST') : winner === null ? 'DRAW' : youWin ? 'ROUND WON!' : 'ROUND LOST';
  drawText(ctx, head, px, 72, col, { scale: 2, align: 'center' });
  drawText(ctx, `ROUND ${game.round}: YOU ${a} - ${b} ${r.name}`, px, 94, PAL.c, { align: 'center' });
  drawText(ctx, `ROUNDS: YOU ${game.wins[YOU]} - ${game.wins[RIVAL]} ${r.name}`, px, 108, PAL.C, { align: 'center' });
  if (match) {
    button(462, 130, 76, 18, 'REMATCH', () => startMatch(game.rival));
    button(544, 130, 76, 18, 'NEW RIVAL', () => { game.screen = 'select'; });
  } else button(486, 130, 110, 18, 'NEXT ROUND', startRound);
}

function render(now) {
  game.buttons = [];
  ctx.drawImage(art.bg, 0, 0);
  if (game.screen === 'select') renderSelect(now);
  else {
    renderBoard(now);
  }
  drawText(ctx, HINT, 320, 351, PAL.C, { align: 'center' });
}

function frame(now) {
  update(now);
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- input ----
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) * 640 / r.width), y: Math.floor((e.clientY - r.top) * 360 / r.height) };
}
const chuteAt = (p) => L.chuteX.findIndex((cx) => Math.abs(p.x - cx) <= 23 && p.y >= L.chuteTop - 40 && p.y < L.chuteBottom);
const handAt = (p) => L.handX.findIndex((hx, i) => i < game.st.hands[YOU].length && Math.abs(p.x - hx) <= 18 && Math.abs(p.y - L.handY[YOU]) <= 24);

cv.addEventListener('pointermove', (e) => {
  game.mouse = toCanvas(e);
  if (e.pointerType === 'mouse' && game.screen === 'play') {
    const k = chuteAt(game.mouse), h = handAt(game.mouse);
    game.hover = k >= 0 ? k : null;
    game.handHover = h >= 0 ? h : null;
  }
});
cv.addEventListener('pointerleave', () => { game.mouse = { x: -1, y: -1 }; game.hover = null; game.handHover = null; });
cv.addEventListener('pointerdown', (e) => {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  const p = game.mouse = toCanvas(e);
  const b = game.buttons.find((q) => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.h);
  if (b) { sfx.tick(); b.onClick(); return; }
  if (!yourMove()) return;
  const st = game.st, h = handAt(p);
  if (h >= 0) { game.sel = game.sel === h && st.hands[YOU].length > 1 ? null : h; game.armed = null; sfx.tick(); return; }
  const k = chuteAt(p);
  if (k < 0) { game.armed = null; return; }
  if (game.sel === null) { game.wiggle = performance.now(); sfx.tick(); return; } // nudge the player toward the hand
  if (e.pointerType !== 'mouse' && game.armed !== k) { game.armed = k; return; } // touch: first tap previews
  startShove(YOU, game.sel, k, performance.now());
});
