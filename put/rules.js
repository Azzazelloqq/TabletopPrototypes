// Put: rules and the computer opponent. Pure logic, no drawing.
// Sides: 0 = player, 1 = opponent. A trick outcome of -1 means a tie.

export const WIN_SCORE = 7;
export const SEEN_STAKE = 3;

export const OPPONENTS = [
  { id: 'drunkard', name: 'Wendel', title: 'the Drunkard', blurb: ['Loud, lucky and', 'always thirsty.'],
    putAt: 0.55, bluff: 0.30, trust: 1.0, seeBias: 0.05, minSee: 0, tells: 'loud',
    lines: { put: 'PUT!', fold: 'Bah! Take it.', see: 'I\'ll drink to that!', win: 'Ha! Pay up!', lose: 'Curse these cards...' } },
  { id: 'miser', name: 'Quill', title: 'the Miser', blurb: ['Counts every coin', 'twice. Rarely bets.'],
    putAt: 0.75, bluff: 0.05, trust: 0.85, seeBias: -0.03, minSee: 0.6, tells: 'subtle',
    lines: { put: 'Put.', fold: 'Not with my coin.', see: 'Show me, then.', win: 'Mine. All mine.', lose: 'Hmph.' } },
  { id: 'veteran', name: 'Orrin', title: 'the Veteran', blurb: ['Forty years at the', 'table. Gives nothing.'],
    putAt: 0.65, bluff: 0.15, trust: 0.9, seeBias: 0, minSee: 0, tells: 'none',
    lines: { put: 'Put.', fold: 'Fold.', see: 'Seen.', win: 'Again.', lose: 'Fair.' } },
];

export function newDeck() {
  const deck = [];
  for (let rank = 1; rank <= 13; rank++) for (let i = 0; i < 4; i++) deck.push(rank);
  return deck;
}

export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function trickOutcome(leader, leadCard, answerCard) {
  if (leadCard === answerCard) return -1;
  return leadCard > answerCard ? leader : 1 - leader;
}

// Two tricks win; one trick with the rest tied also wins (more tricks after three).
export function handFinished(wins, tricksPlayed) {
  return wins[0] >= 2 || wins[1] >= 2 || tricksPlayed === 3;
}

export function handWinner(wins) {
  if (wins[0] === wins[1]) return -1;
  return wins[0] > wins[1] ? 0 : 1;
}

// Cheapest card that beats the lead, otherwise the lowest card.
export function answerChoice(hand, leadCard) {
  let best = -1;
  for (let i = 0; i < hand.length; i++) {
    if (hand[i] > leadCard && (best < 0 || hand[i] < hand[best])) best = i;
  }
  return best >= 0 ? best : lowestIndex(hand);
}

// Middle card of three, otherwise the lowest.
export function leadChoice(hand) {
  const order = hand.map((_, i) => i).sort((a, b) => hand[a] - hand[b]);
  return hand.length === 3 ? order[1] : order[0];
}

function lowestIndex(hand) {
  let best = 0;
  for (let i = 1; i < hand.length; i++) if (hand[i] < hand[best]) best = i;
  return best;
}

function highestIndex(hand) {
  let best = 0;
  for (let i = 1; i < hand.length; i++) if (hand[i] > hand[best]) best = i;
  return best;
}

// Greedy play-out: leaders play their highest card, answers follow answerChoice.
function playOut(hands, wins, leader, pendingLead, tricksPlayed) {
  while (!handFinished(wins, tricksPlayed)) {
    let lead = pendingLead;
    pendingLead = null;
    if (lead === null) lead = hands[leader].splice(highestIndex(hands[leader]), 1)[0];
    const answerer = 1 - leader;
    const answer = hands[answerer].splice(answerChoice(hands[answerer], lead), 1)[0];
    const winner = trickOutcome(leader, lead, answer);
    tricksPlayed++;
    if (winner >= 0) { wins[winner]++; leader = winner; }
  }
  return handWinner(wins);
}

// Chances of side `me` to win / draw the current hand, from what `me` can see.
// view: { hand, oppCount, seen (every face-up card so far), wins, tricksPlayed, leader, lead (card already led this trick or null) }
export function handEquity(me, view, samples = 40) {
  const pool = newDeck();
  for (const card of view.hand.concat(view.seen)) pool.splice(pool.indexOf(card), 1);
  let win = 0, draw = 0;
  for (let s = 0; s < samples; s++) {
    for (let i = 0; i < view.oppCount; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const hands = [];
    hands[me] = view.hand.slice();
    hands[1 - me] = pool.slice(0, view.oppCount);
    const result = playOut(hands, view.wins.slice(), view.leader, view.lead, view.tricksPlayed);
    if (result === me) win++;
    else if (result === -1) draw++;
  }
  return { win: win / samples, draw: draw / samples };
}

// Chance to win the match from a score, treating each decisive hand as a coin flip for one point.
const MATCH_TABLE = (() => {
  const table = [];
  for (let a = 0; a <= WIN_SCORE; a++) {
    table[a] = [];
    for (let b = 0; b <= WIN_SCORE; b++) {
      if (a === 0) table[a][b] = 1;
      else if (b === 0) table[a][b] = 0;
      else table[a][b] = 0.5 * table[a - 1][b] + 0.5 * table[a][b - 1];
    }
  }
  return table;
})();

export function matchChance(myScore, oppScore) {
  return MATCH_TABLE[Math.max(0, WIN_SCORE - myScore)][Math.max(0, WIN_SCORE - oppScore)];
}

export function aiWantsPut(profile, equity, willBluff) {
  return equity.win >= profile.putAt || (equity.win < 0.3 && willBluff);
}

// The opponent (side 1) answers the player's Put. scores = [player, opponent].
export function aiSeesPut(profile, equity, scores) {
  if (scores[0] + 1 >= WIN_SCORE) return true;
  if (equity.win < profile.minSee) return false;
  const win = equity.win * profile.trust;
  const loss = 1 - win - equity.draw;
  const fold = matchChance(scores[1], scores[0] + 1);
  const see = win * matchChance(scores[1] + SEEN_STAKE, scores[0])
    + equity.draw * matchChance(scores[1], scores[0])
    + loss * matchChance(scores[1], scores[0] + SEEN_STAKE);
  return see + profile.seeBias >= fold;
}
