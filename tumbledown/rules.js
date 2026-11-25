// Tumbledown rules and AI. No DOM: also runs under Node for headless checks.
//
// A die's orientation is [top, north, east]; bottom = 7 - top, south = 7 - north, west = 7 - east.
// Row 0 is side 0's back row (bottom of the screen); side 0 moves north (row + 1), side 1 south.

export const COLS = 5;
export const ROWS = 6;
export const DICE = 5;
export const HOME_ROWS = 2;
export const GAMES_TO_WIN = 2;

export const DIRS = { N: [1, 0], S: [-1, 0], E: [0, 1], W: [0, -1] };

// Orientation after tumbling one square in direction d ('N' | 'S' | 'E' | 'W').
export function roll([t, n, e], d) {
  if (d === 'N') return [7 - n, t, e];
  if (d === 'S') return [n, 7 - t, e];
  if (d === 'E') return [7 - e, n, t];
  return [e, n, 7 - t];
}

// All 24 orientations reachable from a base die by rolling.
export const ORIENTS = (() => {
  const seen = new Map();
  const front = [[1, 2, 3]];
  while (front.length) {
    const o = front.pop();
    const key = o.join();
    if (seen.has(key)) continue;
    seen.set(key, o);
    for (const d of 'NSEW') front.push(roll(o, d));
  }
  return [...seen.values()];
})();

// One orientation per top face, used by the search to average over a throw's outcome.
const REP = [1, 2, 3, 4, 5, 6].map(t => ORIENTS.find(o => o[0] === t));

export const randomOrient = (rnd = Math.random) => ORIENTS[Math.floor(rnd() * ORIENTS.length)];

export const idx = (r, c) => r * COLS + c;
export const backRow = side => (side === 0 ? 0 : ROWS - 1);
export const farRow = side => (side === 0 ? ROWS - 1 : 0);
export const forward = side => (side === 0 ? 'N' : 'S');
export const isHome = (side, r) => (side === 0 ? r < HOME_ROWS : r >= ROWS - HOME_ROWS);

let nextId = 1;
export const makeDie = (side, o) => ({ id: nextId++, side, o });

// A new game: each side's dice are thrown onto its back row.
export function newGame(rnd = Math.random) {
  const board = new Array(ROWS * COLS).fill(null);
  for (const side of [0, 1]) {
    for (let c = 0; c < COLS; c++) board[idx(backRow(side), c)] = makeDie(side, randomOrient(rnd));
  }
  return { board, hand: [0, 0], turn: 0, winner: null, reason: null, passes: 0 };
}

export function clone(s) {
  return { board: s.board.slice(), hand: s.hand.slice(), turn: s.turn, winner: s.winner, reason: s.reason, passes: s.passes };
}

const beats = (attack, defence) => attack >= defence;

// Legal moves for a side:
//   { kind: 'tumble', from, to, dir, o, capture }  or  { kind: 'throw', to }
export function moves(s, side = s.turn) {
  const out = [];
  for (let i = 0; i < s.board.length; i++) {
    const die = s.board[i];
    if (!die || die.side !== side) continue;
    const r = Math.floor(i / COLS), c = i % COLS;
    for (const dir of [forward(side), 'E', 'W']) {
      const [dr, dc] = DIRS[dir];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      const to = idx(rr, cc);
      const o = roll(die.o, dir);
      const target = s.board[to];
      if (!target) {
        if (dir === 'E' || dir === 'W') continue; // sideways only to capture
        out.push({ kind: 'tumble', from: i, to, dir, o, capture: false });
      } else if (target.side !== side && beats(o[0], target.o[0])) {
        out.push({ kind: 'tumble', from: i, to, dir, o, capture: true });
      }
    }
  }
  if (s.hand[side] > 0) {
    for (let i = 0; i < s.board.length; i++) {
      if (!s.board[i] && isHome(side, Math.floor(i / COLS))) out.push({ kind: 'throw', to: i });
    }
  }
  return out;
}

export const countBoard = (s, side) => s.board.reduce((n, d) => n + (d && d.side === side ? 1 : 0), 0);
export const material = (s, side) => countBoard(s, side) + s.hand[side];

// Applies a move in place. A throw needs the orientation it landed on.
// Returns { captured } (the taken die or null). After the move, the side to move passes when stuck.
export function apply(s, m, throwOrient) {
  const side = s.turn;
  let captured = null;
  if (m.kind === 'tumble') {
    const die = s.board[m.from];
    captured = m.capture ? s.board[m.to] : null;
    s.board[m.from] = null;
    s.board[m.to] = { ...die, o: m.o };
    if (captured) s.hand[side]++;
    if (Math.floor(m.to / COLS) === farRow(side)) { s.winner = side; s.reason = 'breach'; }
  } else {
    s.board[m.to] = makeDie(side, throwOrient);
    s.hand[side]--;
  }
  const rival = 1 - side;
  if (s.winner === null && material(s, rival) === 0) { s.winner = side; s.reason = 'wipe'; }
  s.turn = rival;
  s.passes = 0;
  if (s.winner === null && moves(s).length === 0) {
    s.passes = 1;
    s.turn = side;           // the rival is stuck and passes
    if (moves(s).length === 0) {
      const a = material(s, 0), b = material(s, 1);
      s.winner = a > b ? 0 : b > a ? 1 : -1;  // -1: drawn, replay
      s.reason = 'locked';
    }
  }
  return { captured };
}

// ---------------------------------------------------------------- AI

export const WEIGHTS = {
  steady: { board: 10, hand: 7, adv: 0.6, top: 0.4, threat: 4 },
  rush: { board: 10, hand: 5, adv: 1.6, top: 0.2, threat: 3 },
  hoard: { board: 10, hand: 9, adv: 0.3, top: 0.8, threat: 6 },
};

const progress = (side, r) => (side === 0 ? r : ROWS - 1 - r);

export function evaluate(s, me, w) {
  if (s.winner !== null) return s.winner === me ? 1000 : s.winner === -1 ? 0 : -1000;
  let score = 0;
  for (let i = 0; i < s.board.length; i++) {
    const d = s.board[i];
    if (!d) continue;
    const sign = d.side === me ? 1 : -1;
    const p = progress(d.side, Math.floor(i / COLS));
    score += sign * (w.board + w.adv * p * p + w.top * d.o[0]);
  }
  score += w.hand * (s.hand[me] - s.hand[1 - me]);
  if (moves(s).some(m => m.capture)) score += s.turn === me ? w.threat : -w.threat;
  return score;
}

const ordered = ms => ms.slice().sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

function search(s, depth, me, w, alpha, beta) {
  if (depth === 0 || s.winner !== null) return evaluate(s, me, w);
  const maximizing = s.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of ordered(moves(s))) {
    const v = valueAfter(s, m, depth - 1, me, w, alpha, beta);
    if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

function valueAfter(s, m, depth, me, w, alpha = -Infinity, beta = Infinity) {
  if (m.kind === 'throw') {
    let total = 0;
    for (const o of REP) {
      const t = clone(s);
      apply(t, m, o);
      total += search(t, depth, me, w, -Infinity, Infinity);
    }
    return total / REP.length;
  }
  const t = clone(s);
  apply(t, m);
  return search(t, depth, me, w, alpha, beta);
}

// Gaussian noise via Box-Muller, so weak opponents sometimes misjudge.
function gauss(rnd) {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

// profile: { depth, weights, noise }
export function chooseMove(s, profile, rnd = Math.random) {
  const me = s.turn;
  const w = WEIGHTS[profile.weights];
  let best = null, bestV = -Infinity;
  for (const m of ordered(moves(s))) {
    const v = valueAfter(s, m, profile.depth - 1, me, w) + (profile.noise ? gauss(rnd) * profile.noise : rnd() * 1e-3);
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
