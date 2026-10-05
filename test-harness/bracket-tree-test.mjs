// The bracket tree is rebuilt from each team's per-round scores (b.sc).
// After a full tournament it must agree with what was actually played.
import { G, S, T, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const B = await import('../views/bracket.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
for (let run = 0; run < 2; run++) {
  S.buildUniverse(); newDynasty(run ? 120 : 5); U.fixMins(G.teams[G.tid].rost);
  runRegSeason(); runConfTourneys();
  check(G.bracket.length === 64 && G.bracket.every(b => !b.sc || !b.sc.length), `run ${run}: 64-team field, no results yet`);
  runNCAA();
  const total = G.bracket.reduce((s, b) => s + (b.sc || []).length, 0);
  check(total === 126, `run ${run}: 63 games recorded (126 team scores, got ${total})`);
  const champ = G.bracket.find(b => b.active);
  check(champ && champ.sc.length === 6, `run ${run}: champion played 6 games`);
  const M = B._bracketModel();
  const ff = M.finalFour();
  check(ff.champ === champ, `run ${run}: tree's champion is the real champion (${champ.team.name})`);
  // every rebuilt match has exactly one winner, and the loser's run ended there
  let ok = true, n = 0;
  const each = (mt, k) => { n++; const wa = M.wonRound(mt.a, k), wb = M.wonRound(mt.b, k); const loser = wa ? mt.b : mt.a;
    if (wa === wb || loser.sc.length !== k + 1 || loser.active) ok = false;
    if (mt.a.sc[k] === mt.b.sc[k]) ok = false; if ((mt.a.sc[k] > mt.b.sc[k]) !== wa) ok = false; };
  for (let r = 0; r < 4; r++) M.regionRounds(r).forEach((round, k) => round.forEach(mt => each(mt, k)));
  ff.semis.forEach(mt => each(mt, 4)); each(ff.title, 5);
  check(ok && n === 63, `run ${run}: all 63 rebuilt games have one winner, higher score wins, loser's run ends there`);
  // survives save/load
  ST.saveStateNow(); const before = JSON.stringify(G.bracket.map(b => b.sc)); ST.loadState();
  check(JSON.stringify(G.bracket.map(b => b.sc)) === before, `run ${run}: round-by-round scores persist in the save`);
}
console.log(fails ? fails + ' FAILED' : 'all bracket tree checks passed');
process.exit(fails ? 1 : 0);
