// Topple rules and computer opponent. Pure functions over a plain round state.
// A die is { v: pips, o: side that rolled it }. Side 0 is the player, side 1 the opponent.

export const ROLLS_PER_ROUND = 10;
export const TOWER_COUNT = 3;
export const ROUNDS_TO_WIN = 2;

export function newRound() {
  return {
    towers: [[[], [], []], [[], [], []]], // towers[side][tower] = dice, bottom first
    loot: [[], []],
    rollsLeft: [ROLLS_PER_ROUND, ROLLS_PER_ROUND],
  };
}

function cloneRound(r) {
  return {
    towers: r.towers.map(side => side.map(tower => tower.slice())),
    loot: r.loot.map(dice => dice.slice()),
    rollsLeft: r.rollsLeft.slice(),
  };
}

export const pips = dice => dice.reduce((sum, d) => sum + d.v, 0);
export const towerPips = (r, side) => r.towers[side].reduce((sum, tower) => sum + pips(tower), 0);
export const lootPips = (r, side) => pips(r.loot[side]);
export const score = (r, side) => towerPips(r, side) + lootPips(r, side);

// Dice that fall when a die of value v hits this tower, top first.
export function fallingDice(tower, v) {
  const fallen = [];
  for (let i = tower.length - 1; i >= 0 && tower[i].v < v; i--) fallen.push(tower[i]);
  return fallen;
}

export function legalMoves(r, side, v) {
  const moves = [];
  for (let t = 0; t < TOWER_COUNT; t++) moves.push({ kind: 'build', t });
  for (let t = 0; t < TOWER_COUNT; t++) {
    if (fallingDice(r.towers[1 - side][t], v).length > 0) moves.push({ kind: 'raid', t });
  }
  return moves;
}

export function applyMove(r, side, die, move) {
  const next = cloneRound(r);
  next.rollsLeft[side]--;
  if (move.kind === 'build') {
    next.towers[side][move.t].push(die);
  } else {
    const tower = next.towers[1 - side][move.t];
    const fallen = fallingDice(tower, die.v);
    tower.length -= fallen.length;
    next.loot[side].push(...fallen);
  }
  return next;
}

// Pips the attacker would take with the best raid using a die of value v.
function bestHaul(r, attacker, v) {
  let best = 0;
  for (const tower of r.towers[1 - attacker]) best = Math.max(best, pips(fallingDice(tower, v)));
  return best;
}

// Average over the rival's six possible next rolls of twice their best haul from this side.
function exposure(r, side) {
  const rival = 1 - side;
  if (r.rollsLeft[rival] === 0) return 0;
  let total = 0;
  for (let v = 1; v <= 6; v++) total += 2 * bestHaul(r, rival, v);
  return total / 6;
}

// profile: { w: exposure weight, raidBonus: added to raid moves }; noise: half-width of uniform random noise.
export function chooseMove(r, side, die, profile, noise = 0, random = Math.random) {
  let best = [];
  let bestValue = -Infinity;
  for (const move of legalMoves(r, side, die.v)) {
    const next = applyMove(r, side, die, move);
    let value = score(next, side) - score(next, 1 - side) - profile.w * exposure(next, side);
    if (move.kind === 'raid') value += profile.raidBonus;
    if (noise > 0) value += (random() * 2 - 1) * noise;
    if (value > bestValue + 1e-9) { best = [move]; bestValue = value; }
    else if (Math.abs(value - bestValue) <= 1e-9) best.push(move);
  }
  return best[Math.floor(random() * best.length)];
}
