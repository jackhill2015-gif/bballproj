// Season goals, achievements, facilities and redshirts.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const GO = await import('../goals.js');
const F = await import('../facilities.js');
const RO = await import('../views/roster.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

console.log('── goals ──');
newDynasty(30);
const gs = GO.ensureGoals();
check(gs && gs.list.length === 3 && gs.list.every(g => g.text && g.target), 'three goals generated: ' + gs.list.map(g => g.text).join(' / '));
check(GO.ensureGoals() === gs, 'same goals on a second look');

console.log('── redshirt ──');
const t = G.teams[G.tid];
const pick = t.rost.find(p => p.cls === 'SR') || t.rost[6];
const idx = t.rost.indexOf(pick), clsBefore = pick.cls, ovrBefore = pick.ovr;
RO.toggleRedshirt(idx);
check(pick.rs === true && pick.mins === 0, 'redshirted player sits (0 minutes)');
check(t.rost.reduce((s, p) => s + p.mins, 0) === 200, 'team minutes still total 200');
check(t.rost[t.rost.length - 1] === pick, 'redshirt moved to the end of the bench');

console.log('── facilities ──');
G.pts = 1000;
const f0 = F.myFacilities().arena;
const r = F.upgradeFacility('arena');
check(r.ok && F.myFacilities().arena === f0 + 1 && G.pts === 1000 - r.cost, 'upgrade raises the level and spends NIL');
G.pts = 0; check(!F.upgradeFacility('practice').ok, 'cannot upgrade without enough NIL');
F.myFacilities().practice = 5;

console.log('── full season ──');
runRegSeason();
check(gs.rankedWins >= 0, 'ranked wins tracked (' + gs.rankedWins + ')');
check(pick.rs === true && (pick.s.gp || 0) === 0, 'redshirt never played');
runConfTourneys(); runNCAA();
check(gs.settled && G.goalHistory.length === 1, 'goals settled at season end (' + G.goalHistory[0].met + ' of 3 met)');
check(Object.keys(G.achievements || {}).length > 0, 'achievements unlocked: ' + Object.keys(G.achievements).join(', '));
S.beginOffseason();
check(!G.departingPlayers.some(d => d.name === pick.name), 'redshirt is not listed as departing');
const others = t.rost.filter(p => p !== pick && p.cls !== 'SR').map(p => ({ p, ovr: p.ovr }));
S.doOffseason();
check(G.teams[G.tid].rost.includes(pick), 'redshirt is still on the roster next season');
check(pick.cls === clsBefore && pick.rsUsed && !pick.rs, 'class unchanged, redshirt used up (' + pick.cls + ')');
check(pick.ovr >= ovrBefore, 'redshirt developed (' + ovrBefore + ' → ' + pick.ovr + ')');
const avgGain = others.reduce((s, o) => s + (o.p.ovr - o.ovr), 0) / others.length;
check(avgGain > 0, 'returners improved with practice facility level 5 (avg +' + avgGain.toFixed(1) + ')');
check(GO.ensureGoals().yr === G.yr && !GO.ensureGoals().settled, 'new goals for the new season');

console.log('── save/load keeps it all ──');
ST.saveStateNow(); const ach = JSON.stringify(G.achievements), fac = JSON.stringify(G.facilities);
S.buildUniverse(); ST.loadState();
check(JSON.stringify(G.achievements) === ach && JSON.stringify(G.facilities) === fac && G.goalHistory.length === 1, 'achievements, facilities and goal history persist');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
