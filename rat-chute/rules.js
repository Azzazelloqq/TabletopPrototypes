// Rat Chute rules and AI. Pure state, no drawing.
// Chute index 0 is the player's end (player doorstep), index 2 is the rival's end.
export const YOU = 0;
export const RIVAL = 1;
export const HAND_SIZE = 2;

export const KINDS = {
  g1: { v: 1, label: '+1' },
  g2: { v: 2, label: '+2' },
  g3: { v: 3, label: '+3' },
  crown: { v: 5, label: '+5' },
  rat: { v: -2, label: '-2' },
  plague: { v: -4, label: '-4' },
};
const BAG = [['g1', 9], ['g2', 7], ['g3', 4], ['crown', 1], ['rat', 9], ['plague', 3]];

let nextId = 1;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newRound(starter) {
  const bag = [];
  for (const [kind, n] of BAG)
    for (let i = 0; i < n; i++) bag.push({ id: nextId++, kind, v: KINDS[kind].v });
  shuffle(bag);
  const chutes = [0, 1, 2].map(() => [bag.pop(), bag.pop(), bag.pop()]);
  const hands = [[bag.pop(), bag.pop()], [bag.pop(), bag.pop()]];
  return { bag, chutes, hands, yards: [[], []], turn: starter };
}

export const total = (yard) => yard.reduce((s, x) => s + x.v, 0);
export const isRoundOver = (st) => st.hands[0].length === 0 && st.hands[1].length === 0;

// What a shove would do, without changing the state.
export function previewShove(st, who, handIdx, k) {
  const c = st.chutes[k];
  return { sack: st.hands[who][handIdx], dropped: who === YOU ? c[2] : c[0] };
}

export function applyShove(st, who, handIdx, k) {
  const c = st.chutes[k];
  const [sack] = st.hands[who].splice(handIdx, 1);
  let dropped;
  if (who === YOU) { dropped = c.pop(); c.unshift(sack); }
  else { dropped = c.shift(); c.push(sack); }
  st.yards[1 - who].push(dropped);
  while (st.hands[who].length < HAND_SIZE && st.bag.length) st.hands[who].push(st.bag.pop());
  st.turn = 1 - who;
  return dropped;
}

// Round end: the sack at each end of each chute drops to the player on that side.
export function applyDoorsteps(st) {
  for (const c of st.chutes) {
    st.yards[YOU].push(c[0]);
    st.yards[RIVAL].push(c[2]);
    c[0] = c[2] = null;
  }
}

// ---- AI ----
export const RIVALS = [
  { name: 'GRUBB', style: 'GREEDY', blurb: 'GRABS WHAT HE CAN, NEVER LOOKS BACK.',
    w: { gift: 1, guard: 0, next: 0, late: 0 } },
  { name: 'HESK', style: 'CAUTIOUS', blurb: 'KEEPS RATS OFF HER OWN DOORSTEP.',
    w: { gift: 1, guard: 0.7, next: 0, late: 0 } },
  { name: 'VELL', style: 'EXPERT', blurb: 'COUNTS EVERY SACK, PLANS FOR THE END.',
    w: { gift: 1, guard: 0.7, next: 0.5, late: 1 } },
];

const min = (a) => Math.min(...a);
const sum = (a) => a.reduce((s, x) => s + x, 0);

// Scores one rival move from the board and the rival's own hand; higher is better for the rival.
export function scoreRivalMove(st, handIdx, k, w) {
  const chutes = st.chutes.map((c) => c.slice());
  const dropped = chutes[k].shift();
  chutes[k].push(st.hands[RIVAL][handIdx]);
  const ownDoor = chutes.map((c) => c[2].v); // rival's doorstep: the player can push these into the rival's yard
  const yourDoor = chutes.map((c) => c[0].v); // player's doorstep: the rival can push these into the player's yard
  // Shoves left in the round after this one; the doorstep balance matters as the round closes.
  const shovesLeft = st.hands[0].length + st.hands[1].length - 1 + st.bag.length;
  const lateness = Math.max(0, 1 - shovesLeft / 8);
  return -w.gift * dropped.v
    + w.guard * min(ownDoor)
    + w.next * -min(yourDoor)
    + w.late * lateness * (sum(ownDoor) - sum(yourDoor));
}

export function chooseRivalMove(st, w, noise) {
  let best = null;
  st.hands[RIVAL].forEach((_, h) => {
    for (let k = 0; k < 3; k++) {
      const s = scoreRivalMove(st, h, k, w) + (Math.random() * 2 - 1) * noise;
      if (!best || s > best.s) best = { h, k, s };
    }
  });
  return best;
}
