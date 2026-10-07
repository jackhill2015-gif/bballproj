// Conference tournaments: every winner advances, byes only in the opening
// round, top seeds never get more than one bye, champion won every game it played
import { G, S, T, U, newDynasty, runRegSeason, runConfTourneys } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(10); U.fixMins(G.teams[G.tid].rost); runRegSeason(); runConfTourneys();
let bad = [], sizes = new Set();
Object.keys(G.confTourneys).forEach(conf => {
  const ct = G.confTourneys[conf]; const n = ct.seeds.length; sizes.add(n);
  const games = {}; ct.seeds.forEach(t => games[t.id] = { played: 0, lost: false, rounds: [] });
  ct.rounds.forEach((rd, ri) => rd.forEach(m => {
    [m.t1, m.t2].forEach(t => { games[t.id].played++; games[t.id].rounds.push(ri); });
    const loser = m.winner === m.t1 ? m.t2 : m.t1; games[loser.id].lost = true;
    if (games[m.winner.id].lost) bad.push(conf + ': a team that already lost played on');
  }));
  // every round after the first must contain every winner of the previous round
  for (let r = 1; r < ct.rounds.length; r++) {
    const prevWinners = ct.rounds[r - 1].map(m => m.winner.id);
    const inRound = new Set(ct.rounds[r].flatMap(m => [m.t1.id, m.t2.id]));
    prevWinners.forEach(id => { if (!inRound.has(id)) bad.push(conf + ': a winner of round ' + r + ' was skipped'); });
  }
  const P = 2 ** Math.floor(Math.log2(n));
  const expectedGames = n - 1;
  const total = ct.rounds.reduce((a, rd) => a + rd.length, 0);
  if (total !== expectedGames) bad.push(conf + ': ' + total + ' games for ' + n + ' teams');
  if (n !== P && ct.rounds[0].length !== n - P) bad.push(conf + ': opening round has ' + ct.rounds[0].length + ' games, expected ' + (n - P));
  const champ = ct.champ; const cg = games[champ.id];
  if (cg.lost) bad.push(conf + ': champion lost a game');
  if (new Set(cg.rounds).size !== cg.rounds.length || cg.rounds.length < Math.log2(P)) bad.push(conf + ': champion skipped rounds (' + cg.rounds.join(',') + ')');
});
check(bad.length === 0, 'all ' + Object.keys(G.confTourneys).length + ' conference brackets are valid (sizes ' + [...sizes].sort((a, b) => a - b).join(', ') + ')' + (bad.length ? ' — ' + bad.slice(0, 4).join('; ') : ''));
console.log(fails ? fails + ' FAILED' : 'all conference bracket checks passed');
process.exit(fails ? 1 : 0);
