// Put: game flow, drawing and input. One 640x360 canvas scaled by a whole number.
import {
  OPPONENTS, WIN_SCORE, SEEN_STAKE, newDeck, shuffle, trickOutcome, handFinished, handWinner,
  answerChoice, leadChoice, handEquity, aiWantsPut, aiSeesPut,
} from './rules.js';
import * as A from './art.js';
import { wrap, textWidth, LINE_HEIGHT } from './font.js';
import { sfx, unlockAudio } from './sound.js';

const W = 640, H = 360;
const C = A.C;
const HINT = ['Higher card takes the trick, best of three wins.',
  'Instead of a card you can PUT: they fold and give you a point, or the hand is played for 3.'];

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const backdrop = A.backdrop();

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.max(1, Math.floor(Math.min(innerWidth * dpr / W, innerHeight * dpr / H)));
  cv.style.width = `${W * s / dpr}px`;
  cv.style.height = `${H * s / dpr}px`;
}
addEventListener('resize', fit);
fit();

// ---------- state ----------
const S = {
  screen: 'select', opp: null, scores: [0, 0], dealer: 1,
  hands: [[], []], shown: [0, 0], tricks: [], wins: [0, 0], leader: 0,
  put: null, stake: 1, willBluff: false, reveal: false,
  status: '', prompt: null, overlay: null, bubble: null,
  tellExpr: 'neutral', eventExpr: 'neutral', eventUntil: 0,
  shakeUntil: 0, slap: null, flyers: [], hover: null, hits: [],
};

const now = () => performance.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let resolver = null;

function ask(kind) {
  S.prompt = kind;
  return new Promise((r) => { resolver = (v) => { S.prompt = null; resolver = null; r(v); }; });
}

function say(textLine, ms = 1600) { S.bubble = { text: textLine, until: now() + ms }; }
function react(expr, ms = 1200) { S.eventExpr = expr; S.eventUntil = now() + ms; }
function reaction(good) {
  const t = S.opp.tells;
  if (good) return t === 'loud' ? 'grin' : t === 'subtle' ? 'smug' : 'smirk';
  return t === 'loud' ? 'angry' : t === 'subtle' ? 'frown' : 'neutral';
}

// ---------- layout ----------
const SLOT_X = [236, 300, 364];
const DECK = { x: 150, y: 150 };
const playerCardPos = (i, n) => ({ x: Math.round(300 - (n * 44 + (n - 1) * 10) / 2) + i * 54, y: 270 });
const aiCardPos = (i) => ({ x: 18 + i * 34, y: 146 });
const slotPos = (t, side) => ({ x: SLOT_X[t] - 18, y: side === 1 ? 144 : 200 });
const BTN = {
  put: { x: 470, y: 222, w: 140, h: 34, label: 'PUT!', fill: C.blood },
  fold: { x: 448, y: 222, w: 86, h: 34, label: 'FOLD', fill: C.slateLight },
  see: { x: 544, y: 222, w: 86, h: 34, label: 'SEE', fill: C.sage },
};

// The flight is drawn each frame; the timer (not the frame loop) ends it, so play never stalls.
async function fly(rank, from, to, ms) {
  const f = { rank, from, to, t0: now(), ms };
  S.flyers.push(f);
  await wait(ms);
  S.flyers.splice(S.flyers.indexOf(f), 1);
}

// ---------- computer opponent ----------
function aiView() {
  const trick = S.tricks[S.tricks.length - 1];
  const open = trick && !trick.done;
  const seen = [];
  for (const t of S.tricks) for (const c of t.cards) if (c !== null) seen.push(c);
  return {
    hand: S.hands[1], oppCount: S.hands[0].length, seen, wins: S.wins,
    tricksPlayed: S.tricks.filter((t) => t.done).length,
    leader: S.leader, lead: open ? trick.cards[S.leader] : null,
  };
}

// Readable faces for the easier opponents; the Veteran shows nothing.
function updateTell() {
  const tells = S.opp.tells;
  if (tells === 'none') { S.tellExpr = 'neutral'; return; }
  const bluffing = S.put && S.put.by === 1 && S.put.bluff;
  const eq = handEquity(1, aiView(), 200);
  const strong = eq.win >= 0.6, weak = eq.win < 0.3;
  if (tells === 'loud') S.tellExpr = bluffing || (weak && S.put) ? 'nervous' : strong ? 'smirk' : weak ? 'worried' : 'neutral';
  else S.tellExpr = bluffing ? 'sweat' : strong ? 'smug' : weak ? 'glance' : 'neutral';
}

// ---------- flow ----------
async function main() {
  let opp = null;
  for (;;) {
    if (!opp) {
      S.screen = 'select';
      opp = OPPONENTS[await ask('select')];
    }
    if (await runMatch(opp) === 'newopp') opp = null;
  }
}

async function runMatch(opp) {
  Object.assign(S, { screen: 'table', opp, scores: [0, 0], dealer: 1, tricks: [], hands: [[], []], put: null, stake: 1, overlay: null });
  S.tellExpr = 'neutral';
  let last;
  while (S.scores[0] < WIN_SCORE && S.scores[1] < WIN_SCORE) {
    last = await playHand();
    S.dealer = 1 - S.dealer;
  }
  const won = S.scores[0] >= WIN_SCORE;
  sfx(won ? 'win' : 'lose');
  S.overlay = {
    title: won ? 'You win the match!' : `${opp.name} wins the match`,
    titleColor: won ? C.bloodDark : C.ink,
    lines: [last.title, ...last.lines, `Final score: you ${S.scores[0]}, ${opp.name} ${S.scores[1]}`],
    buttons: [{ id: 'again', label: 'PLAY AGAIN', w: 110 }, { id: 'newopp', label: 'NEW RIVAL', w: 110 }],
  };
  const choice = await ask('end');
  S.overlay = null;
  return choice;
}

async function playHand() {
  const deck = shuffle(newDeck());
  Object.assign(S, {
    hands: [deck.slice(0, 3).sort((a, b) => a - b), deck.slice(3, 6)], shown: [0, 0],
    tricks: [], wins: [0, 0], put: null, stake: 1, reveal: false, leader: 1 - S.dealer,
    willBluff: Math.random() < S.opp.bluff,
  });
  S.status = S.dealer === 0 ? 'You deal.' : `${S.opp.name} deals.`;
  for (let k = 0; k < 6; k++) {
    const side = (S.leader + k) % 2;
    const to = side === 1 ? aiCardPos(S.shown[1]) : playerCardPos(S.shown[0], 3);
    sfx('card');
    await fly(null, DECK, to, 140);
    S.shown[side]++;
  }
  updateTell();

  while (!handFinished(S.wins, S.tricks.filter((t) => t.done).length)) {
    const trick = { cards: [null, null], leader: S.leader, done: false, winner: -1 };
    S.tricks.push(trick);
    const index = S.tricks.length - 1;
    for (const side of [S.leader, 1 - S.leader]) {
      const r = side === 0 ? await playerTurn(trick, index) : await aiTurn(trick, index);
      if (r.fold) return endHand(r.caller, 1, true);
    }
    const w = trickOutcome(trick.leader, trick.cards[trick.leader], trick.cards[1 - trick.leader]);
    trick.done = true;
    trick.winner = w;
    if (w >= 0) { S.wins[w]++; S.leader = w; }
    sfx(w === 0 ? 'win' : w === 1 ? 'lose' : 'tie');
    if (w >= 0) react(reaction(w === 1), 900);
    updateTell();
    await wait(650);
  }
  const winner = handWinner(S.wins);
  return endHand(winner, winner < 0 ? 0 : S.stake, false);
}

async function playerTurn(trick, index) {
  for (;;) {
    const leading = trick.cards[1] === null;
    const putText = S.put ? '' : ' Or call PUT.';
    S.status = leading ? `Your lead: play any card.${putText}` : `Your answer: beat the ${trick.cards[1]}.${putText}`;
    const choice = await ask('play');
    if (choice === 'put') {
      const r = await playerPuts();
      if (r.fold) return r;
      continue;
    }
    const n = S.hands[0].length;
    const from = playerCardPos(choice, n);
    const rank = S.hands[0].splice(choice, 1)[0];
    S.status = '';
    sfx('card');
    await fly(rank, from, slotPos(index, 0), 200);
    trick.cards[0] = rank;
    return {};
  }
}

async function playerPuts() {
  S.put = { by: 0, seen: false };
  slap(0);
  S.status = `${S.opp.name} weighs your Put...`;
  updateTell();
  await wait(1400);
  const sees = aiSeesPut(S.opp, handEquity(1, aiView(), 60), S.scores);
  if (!sees) {
    say(S.opp.lines.fold);
    return { fold: true, caller: 0 };
  }
  say(S.opp.lines.see);
  S.put.seen = true;
  S.stake = SEEN_STAKE;
  sfx('coin');
  await wait(700);
  return {};
}

async function aiTurn(trick, index) {
  const leading = trick.cards[0] === null;
  S.status = `${S.opp.name} is thinking...`;
  if (S.opp.tells === 'none') react('think', 900);
  await wait(700 + Math.random() * 500);
  if (!S.put) {
    const eq = handEquity(1, aiView(), 40);
    if (aiWantsPut(S.opp, eq, S.willBluff)) {
      S.put = { by: 1, seen: false, bluff: eq.win < 0.3 };
      slap(1);
      say(S.opp.lines.put);
      react('shout', 600);
      updateTell();
      S.status = `${S.opp.name} calls PUT!`;
      const answer = await ask('respond');
      if (answer === 'fold') return { fold: true, caller: 1 };
      S.put.seen = true;
      S.stake = SEEN_STAKE;
      sfx('coin');
      await wait(400);
    }
  }
  const hand = S.hands[1];
  const i = leading ? leadChoice(hand) : answerChoice(hand, trick.cards[0]);
  const from = aiCardPos(i);
  const rank = hand.splice(i, 1)[0];
  sfx('card');
  await fly(rank, from, slotPos(index, 1), 240);
  trick.cards[1] = rank;
  updateTell();
  return {};
}

function slap(caller) {
  S.slap = { caller, t0: now() };
  S.shakeUntil = now() + 320;
  sfx('slap');
}

async function endHand(winner, points, folded) {
  S.reveal = true;
  S.status = '';
  if (winner >= 0) S.scores[winner] += points;
  const name = S.opp.name;
  if (winner === 1) { react(reaction(true), 2000); if (!folded) say(S.opp.lines.win); sfx('lose'); }
  if (winner === 0) { react(reaction(false), 2000); if (!folded) say(S.opp.lines.lose); sfx('coin'); }
  S.tellExpr = 'neutral';
  const lines = [];
  if (folded) lines.push(winner === 0 ? `${name} folded to your Put.` : `You folded to ${name}'s Put.`);
  else lines.push(`Tricks: you ${S.wins[0]}, ${name} ${S.wins[1]}.${S.put && S.put.seen ? ' The Put was seen.' : ''}`);
  lines.push(points ? `${winner === 0 ? 'You score' : `${name} scores`} ${points} point${points > 1 ? 's' : ''}.` : 'Nobody scores.');
  const result = {
    title: winner === 0 ? 'You take the hand' : winner === 1 ? `${name} takes the hand` : 'A drawn hand',
    lines,
  };
  await wait(900);
  if (S.scores[0] >= WIN_SCORE || S.scores[1] >= WIN_SCORE) return result;
  S.overlay = { ...result, buttons: [{ id: 'next', label: 'NEXT HAND', w: 110 }] };
  await ask('next');
  S.overlay = null;
  return result;
}

// ---------- input ----------
function pointer(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}

function hitAt(p) {
  for (let i = S.hits.length - 1; i >= 0; i--) {
    const h = S.hits[i];
    if (p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) return h.id;
  }
  return null;
}

cv.addEventListener('pointermove', (e) => {
  S.hover = hitAt(pointer(e));
  cv.style.cursor = S.hover ? 'pointer' : 'default';
});

cv.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const id = hitAt(pointer(e));
  S.hover = id;
  if (!id || !resolver) return;
  const [kind, arg] = id.split(':');
  sfx('click');
  if (kind === 'card' || kind === 'opp') resolver(Number(arg));
  else resolver(kind);
});

// ---------- drawing ----------
function hit(id, x, y, w, h) { S.hits.push({ id, x, y, w, h }); }

function button(id, b) {
  const hover = S.hover === id;
  const y = b.y - (hover ? 1 : 0);
  A.rect(ctx, b.x + 1, b.y + 2, b.w, b.h, C.ink);
  A.rect(ctx, b.x, y, b.w, b.h, C.ink);
  A.rect(ctx, b.x + 1, y + 1, b.w - 2, b.h - 2, hover ? C.ember : b.fill);
  A.rect(ctx, b.x + 1, y + 1, b.w - 2, 2, hover ? C.amber : C.ochre);
  A.rect(ctx, b.x + 1, y + b.h - 3, b.w - 2, 2, C.night);
  A.textCentered(ctx, b.label, b.x + b.w / 2, y + Math.round(b.h / 2) - 7, C.paperHi, 2, C.ink);
  hit(id, b.x, b.y, b.w, b.h);
}

function expression() {
  return now() < S.eventUntil ? S.eventExpr : S.tellExpr;
}

function drawPortrait(x, y, id, expr) {
  const t = now();
  const blink = ((t + id.length * 1300) % 4200) < 130 ? 1 : 0;
  ctx.drawImage(A.portrait(id, expr, blink, Math.floor(t / 350) % 2), x, y);
}

function drawLamp() {
  const flicker = Math.floor(now() / 140) % 5 === 0;
  A.rect(ctx, 300, 0, 1, 8, C.ink);
  A.rect(ctx, 294, 8, 13, 3, C.ink);
  A.rect(ctx, 295, 11, 11, 14, C.ink);
  A.rect(ctx, 296, 12, 9, 12, flicker ? C.ember : C.amber);
  A.rect(ctx, 299, 15, 3, 6, flicker ? C.amber : C.paperHi);
  A.rect(ctx, 294, 25, 13, 2, C.ink);
}

function drawPatrons() {
  const t = now();
  A.drawPatron(ctx, 176, 131, { body: C.blue, bodyDark: C.slate, skin: C.skin, hair: C.woodDark }, (t % 5200) < 900 ? 1 : 0);
  A.drawPatron(ctx, 412, 131, { body: C.bloodDark, bodyDark: C.plum, skin: C.skinLight, hair: C.ochre }, ((t + 2600) % 6100) < 900 ? 1 : 0);
}

function drawHint() {
  HINT.forEach((line, i) => A.textCentered(ctx, line, 320, 338 + i * 11, C.paperShade, 1, C.night));
}

function drawSelect() {
  A.textCentered(ctx, 'PUT', 320, 16, C.amber, 5, C.ink);
  A.textCentered(ctx, 'A tavern card game for two. Choose your rival.', 320, 60, C.paper, 1, C.ink);
  const diff = ['Easy: shows his hand on his face', 'Tricky: tells are faint', 'Hard: no tells at all'];
  OPPONENTS.forEach((o, i) => {
    const cx = 160 + i * 160, x = cx - 53, y = 78;
    const id = `opp:${i}`;
    const hover = S.hover === id;
    if (hover) A.rect(ctx, x - 2, y - 2, 110, 126, C.amber);
    A.panel(ctx, x, y, 106, 122, C.plum);
    drawPortrait(x + 5, y + 5, o.id, hover ? 'grin' : 'neutral');
    hit(id, x, y, 106, 200);
    A.textCentered(ctx, o.name, cx, 206, hover ? C.amber : C.paperHi, 2, C.ink);
    A.textCentered(ctx, o.title, cx, 226, C.paper, 1, C.ink);
    o.blurb.forEach((l, k) => A.textCentered(ctx, l, cx, 242 + k * 10, C.paperShade, 1, C.night));
    A.textCentered(ctx, diff[i], cx, 268, i === 2 ? C.ember : C.ochre, 1, C.night);
  });
  A.textCentered(ctx, 'First to 7 points wins the match.', 320, 300, C.paper, 1, C.ink);
  drawHint();
}

function drawSlate() {
  A.panel(ctx, 440, 6, 194, 122, C.slate);
  const name = S.opp.name;
  A.textCentered(ctx, `FIRST TO ${WIN_SCORE}`, 537, 14, C.ash);
  A.textCentered(ctx, 'YOU', 491, 27, C.chalk);
  A.textCentered(ctx, name, 583, 27, C.chalk);
  A.textCentered(ctx, String(S.scores[0]), 491, 38, C.paperHi, 3);
  A.textCentered(ctx, String(S.scores[1]), 583, 38, C.paperHi, 3);
  A.textCentered(ctx, '-', 537, 45, C.ash, 2);
  A.rect(ctx, 450, 64, 174, 1, C.slateLight);
  const row = (label, value, y, color = C.chalk) => {
    A.text(ctx, label, 452, y, C.ash);
    A.text(ctx, value, 622 - textWidth(value), y, color);
  };
  row('TRICKS', `you ${S.wins[0]} - ${S.wins[1]} ${name}`, 70);
  row('STAKE', S.stake === SEEN_STAKE ? '3 points' : '1 point', 82, S.stake === SEEN_STAKE ? C.amber : C.chalk);
  const putState = !S.put ? 'open' : S.put.seen ? 'seen' : 'called';
  row('PUT', putState, 94, S.put ? C.amber : C.chalk);
  row('DEALER', S.dealer === 0 ? 'you' : name, 106);
}


function drawTable() {
  // opponent portrait and name plate
  A.panel(ctx, 11, 7, 106, 122, C.plum);
  drawPortrait(16, 12, S.opp.id, expression());
  A.rect(ctx, 30, 122, 68, 13, C.ink);
  A.rect(ctx, 31, 123, 66, 11, C.ochre);
  A.rect(ctx, 31, 123, 66, 1, C.paper);
  A.textCentered(ctx, S.opp.name, 64, 125, C.ink);

  // speech bubble
  if (S.bubble && now() < S.bubble.until) {
    const big = S.bubble.text.length <= 5;
    const scale = big ? 2 : 1;
    const w = textWidth(S.bubble.text, scale) + 14, h = big ? 26 : 19;
    const x = 126, y = 18;
    A.rect(ctx, x, y, w, h, C.ink);
    A.rect(ctx, x + 1, y + 1, w - 2, h - 2, C.paper);
    A.rect(ctx, x - 4, y + 8, 5, 1, C.ink); A.rect(ctx, x - 2, y + 7, 3, 1, C.ink);
    A.rect(ctx, x - 2, y + 9, 3, 1, C.ink); A.rect(ctx, x, y + 8, 2, 1, C.paper);
    A.text(ctx, S.bubble.text, x + 7, y + (big ? 6 : 6), big ? C.blood : C.ink, scale);
  }

  // opponent's cards
  const n1 = Math.min(S.shown[1], S.hands[1].length);
  for (let i = 0; i < n1; i++) {
    if (S.reveal) A.drawCard(ctx, 14 + i * 38, 144, S.hands[1][i], 'small');
    else { const p = aiCardPos(i); A.drawBack(ctx, p.x, p.y); }
  }

  // deck
  for (let k = 0; k < 3; k++) A.drawBack(ctx, DECK.x - k, DECK.y - k);

  // trick slots
  for (let t = 0; t < 3; t++) {
    for (const side of [1, 0]) {
      const p = slotPos(t, side);
      const card = S.tricks[t] ? S.tricks[t].cards[side] : null;
      if (card === null) {
        A.rect(ctx, p.x, p.y, 36, 50, C.woodDark);
        A.rect(ctx, p.x + 1, p.y + 1, 34, 48, C.wood);
      } else A.drawCard(ctx, p.x, p.y, card, 'small');
    }
    const tr = S.tricks[t];
    if (tr && tr.done) {
      const [label, color] = tr.winner === 0 ? ['WON', C.amber] : tr.winner === 1 ? ['LOST', C.ember] : ['TIE', C.chalk];
      A.textCentered(ctx, label, SLOT_X[t], 255, color, 1, C.ink);
    }
  }

  // player's hand
  const hand = S.hands[0];
  const n0 = Math.min(S.shown[0], hand.length);
  const canPlay = S.prompt === 'play';
  for (let i = 0; i < n0; i++) {
    const p = playerCardPos(i, S.shown[0] < 3 ? 3 : hand.length);
    const id = `card:${i}`;
    const lift = canPlay && S.hover === id ? 6 : 0;
    A.drawCard(ctx, p.x, p.y - lift, hand[i], 'big', canPlay);
    if (canPlay) hit(id, p.x, p.y - 6, 44, 68);
  }

  drawSlate();

  // status and buttons
  const statusLines = [];
  if (S.prompt === 'respond') {
    statusLines.push([`${S.opp.name} calls PUT!`, C.amber]);
    for (const l of wrap(`FOLD: ${S.opp.name} takes 1 point and the hand ends.`, 184)) statusLines.push([l, C.paper]);
    for (const l of wrap('SEE: play the hand out for 3 points.', 184)) statusLines.push([l, C.paper]);
  } else if (S.status) {
    for (const l of wrap(S.status, 184)) statusLines.push([l, C.paper]);
  }
  statusLines.forEach(([l, color], i) => A.text(ctx, l, 448, 148 + i * LINE_HEIGHT, color, 1, C.ink));
  if (S.prompt === 'play' && !S.put) button('put', BTN.put);
  if (S.prompt === 'respond') { button('fold', BTN.fold); button('see', BTN.see); }

  drawHint();
}

function drawFlyers() {
  const t = now();
  for (const f of S.flyers) {
    const k = Math.min(1, (t - f.t0) / f.ms);
    const e = 1 - (1 - k) * (1 - k);
    const x = Math.round(f.from.x + (f.to.x - f.from.x) * e);
    const y = Math.round(f.from.y + (f.to.y - f.from.y) * e - Math.sin(k * Math.PI) * 10);
    if (f.rank === null) A.drawBack(ctx, x, y);
    else A.drawCard(ctx, x, y, f.rank, 'small');
  }
}

function drawSlap() {
  if (!S.slap) return;
  const age = now() - S.slap.t0;
  if (age > 1000) { S.slap = null; return; }
  ctx.drawImage(A.burst(), 200, 145);
  A.textCentered(ctx, 'PUT!', 300, 176, C.paperHi, 6, C.ink);
  A.textCentered(ctx, S.slap.caller === 0 ? 'you call' : `${S.opp.name} calls`, 300, 230, C.ink);
}

function drawOverlay() {
  const o = S.overlay;
  if (!o) return;
  const w = 300, h = 64 + o.lines.length * 11 + 30;
  const x = 150, y = Math.round(196 - h / 2);
  A.panel(ctx, x, y, w, h, C.paper);
  A.textCentered(ctx, o.title, x + w / 2, y + 12, o.titleColor || C.ink, 2);
  o.lines.forEach((l, i) => A.textCentered(ctx, l, x + w / 2, y + 36 + i * 11, C.woodDark));
  const total = o.buttons.reduce((s, b) => s + b.w, 0) + (o.buttons.length - 1) * 12;
  let bx = Math.round(x + w / 2 - total / 2);
  for (const b of o.buttons) {
    button(b.id, { x: bx, y: y + h - 44, w: b.w, h: 30, label: b.label, fill: b.id === 'newopp' ? C.slateLight : C.blood });
    bx += b.w + 12;
  }
}

function frame() {
  S.hits = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  A.rect(ctx, 0, 0, W, H, C.ink);
  if (now() < S.shakeUntil) ctx.setTransform(1, 0, 0, 1, Math.round(Math.random() * 6 - 3), Math.round(Math.random() * 4 - 2));
  ctx.drawImage(backdrop, 0, 0);
  drawPatrons();
  if (S.screen === 'select') drawSelect();
  else {
    drawLamp();
    drawTable();
    drawFlyers();
    drawSlap();
    drawOverlay();
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
main();
