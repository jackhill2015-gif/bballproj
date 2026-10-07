// Walk-ons at the start of a new season: every position gets 2 players and
// the roster 11, walk-ons come in well below the roster average, about 1 in
// 12 has high potential (and really grows), and they're tagged and logged.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const SIM = await import('../simulation.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const count = (r, pos) => r.filter(p => p.pos === pos).length;

// 1. addWalkons on a thin roster: 4 guards and a wing
S.buildUniverse(); newDynasty(60);
const t = G.teams[G.tid];
const keep = t.rost.filter(p => p.pos === 'PG').slice(0, 2).concat(t.rost.filter(p => p.pos === 'SG').slice(0, 2), t.rost.filter(p => p.pos === 'SF').slice(0, 1));
t.rost = keep;
const avg = keep.reduce((a, p) => a + p.ovr, 0) / keep.length;
const added = S.addWalkons(t);
check(POS.every(pos => count(t.rost, pos) >= 2), 'every position has at least 2 (' + POS.map(p => p + ' ' + count(t.rost, p)).join(', ') + ')');
check(t.rost.length === 11, 'roster filled to 11 (' + t.rost.length + ')');
check(added.every(p => p.walkon === true && p.cls === 'FR'), 'walk-ons are freshmen marked p.walkon');
check(added.every(p => p.ovr <= avg - 6), `walk-ons are well below the roster average ${avg.toFixed(1)} (${added.map(p => p.ovr).join(', ')})`);
// a full, balanced roster gets none
check(S.addWalkons(t).length === 0, 'no walk-ons when positions and roster size are covered');
// never past 15
t.rost = t.rost.filter(p => p.pos !== 'C').concat(Array.from({ length: 6 }, () => SIM.genPlayer(70, 'PG', 'SO'))).slice(0, 15);
const before15 = t.rost.length;
S.addWalkons(t);
check(t.rost.length <= 15, `never more than 15 (${before15} -> ${t.rost.length})`);

// 2. Over many rolls, about 1 in 12 is a gem (high potential)
let gems = 0, N = 6000;
const lowPot = [];
for (let i = 0; i < N; i++) {
  const p = SIM.genWalkon(60, POS[i % 5]);
  if (p.pot - p.ovr >= 10) gems++; else lowPot.push(p.pot - p.ovr);
}
const rate = gems / N;
check(rate > 1 / 12 - 0.015 && rate < 1 / 12 + 0.015, `about 1 in 12 has high potential (${(rate * 100).toFixed(1)}%, target 8.3%)`);
check(Math.max(...lowPot) <= 5, 'the rest have low potential (pot within 5 of ovr)');

// 3. Gems really grow: a rotation player or better in 2-3 years; the rest don't
const rosterAvg = 70;
const grow = (p, yrs) => { for (let y = 0; y < yrs; y++) { const g = SIM.calcGrowth(p, 70); ['sht', 'fin', 'def', 'reb', 'ply'].forEach(a => { p[a] = U.clamp(p[a] + (g[a] || 0), 38, 99); }); p.ovr = U.getOvr(p); if (p.ovr > p.pot) p.pot = p.ovr; p.cls = ['FR', 'SO', 'JR', 'SR'][Math.min(3, y + 1)]; } return p; };
let gemsGrown = [], restGrown = [];
for (let i = 0; i < 2000 && gemsGrown.length < 60; i++) {
  const p = SIM.genWalkon(rosterAvg - 11, POS[i % 5]);
  const gem = p.pot - p.ovr >= 10;
  const start = p.ovr; grow(p, 3);
  (gem ? gemsGrown : restGrown).push(p.ovr - start);
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
check(mean(gemsGrown) >= 9, `gems grow ~${mean(gemsGrown).toFixed(1)} over 3 years (from ${rosterAvg - 11} to about the roster average ${rosterAvg})`);
check(mean(restGrown) < 5, `other walk-ons grow ~${mean(restGrown).toFixed(1)} over 3 years`);

// 4. Through a real offseason: walk-ons join, log line names positions
S.buildUniverse(); newDynasty(60);
runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason();
const u = G.teams[G.tid];
u.rost = u.rost.filter(p => p.cls === 'SR' || p.pos === 'PG').slice(0, 7); // seniors leave too: very thin
G.recruits.forEach(r => { if (r.signed === G.tid) r.signed = -1; });
const logs = [];
S.registerSeasonCallbacks({ addLog: (t, w, x) => logs.push(x) });
G.recruitPhase = 3;
S.doOffseason();
const wo = u.rost.filter(p => p.walkon);
check(POS.every(pos => count(u.rost, pos) >= 2) && u.rost.length >= 11, `new season: ${u.rost.length} players, every position has 2 (${wo.length} walk-ons)`);
const line = logs.find(x => /walk-on/.test(x));
check(!!line && line.indexOf(wo.length + ' walk-on') === 0 && /\((\d )?(PG|SG|SF|PF|C)/.test(line), 'new-season log line: ' + line);
// they survive a save/load as normal players with the tag
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
check(G.teams[G.tid].rost.filter(p => p.walkon).length === wo.length, 'walk-on tag survives save and load');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
