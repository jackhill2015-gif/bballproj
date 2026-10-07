// Your games keep a box score (both teams) that matches the final score
import { G, S, ST, U, newDynasty } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(50); U.fixMins(G.teams[G.tid].rost);
let games = 0, ok = 0;
for (let w = 0; w < 12; w++) { const g = G.teams[G.tid].sched[G.gi]; if (g && !g.played) { S.launchSim(false); games++; } else { S.simCPUWeek(); S.advanceWeek(); } }
G.teams[G.tid].sched.forEach(g => {
  if (!g || !g.played) return;
  const sum = side => (side || []).reduce((a, r) => a + r[2], 0);
  if (g.box && sum(g.box.u) === g.uScore && sum(g.box.o) === g.oScore) ok++;
});
check(games > 0 && ok === games, `every game you played has a box score matching the final (${ok} of ${games})`);
ST.saveStateNow(); const before = JSON.stringify(G.teams[G.tid].sched.map(g => g && g.box)); ST.loadState();
check(JSON.stringify(G.teams[G.tid].sched.map(g => g && g.box)) === before, 'box scores survive a save and reload');
console.log(fails ? fails + ' FAILED' : 'all box score checks passed');
process.exit(fails ? 1 : 0);
