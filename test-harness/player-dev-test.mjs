// Player development part 1, fast version (in run-all): recruit pool vs
// players leaving, CPU rosters 13-15, generated top-up freshmen rare, class
// sizes even, and the packed recruit pool surviving a save and load.
// Full report: node test-harness/player-dev.mjs
import { measure, summary } from './player-dev-lib.mjs';
import { G, S, ST, newDynasty } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

const o = measure({ seasons: 4 });
const s = summary(o);
check(o.offseasons.every(x => x.pool >= x.leaving), `recruit pool covers players leaving every year (${o.offseasons.map(x => x.pool + ' vs ' + x.leaving).join(', ')})`);
check(s.recruitsJoined >= 0.85 * s.leaving, `recruits joining rosters keep up with players leaving (${f1(s.recruitsJoined)} vs ${f1(s.leaving)})`);
check(s.topupsMax <= 15, `generated top-up freshmen are rare (${o.offseasons.map(x => x.added.topups).join(', ')} a year; was about 600)`);
check(s.cpuMin >= 13 && s.cpuMax <= 15, `CPU rosters 13-15 every season (${s.cpuMin}-${s.cpuMax}, mean ${f1(s.cpuMean)})`);
check(s.classMin >= 0.8 * s.classMax, `class sizes even, no four-year echo (${s.classMin}-${s.classMax} per class)`);
check(s.frMinsMin >= 0.08, `freshmen keep a real share of minutes every season (lowest ${Math.round(s.frMinsMin * 100)}%)`);
check(o.offseasons.every(x => x.stars[5] >= 15 && x.stars[5] <= 40 && x.stars[4] > x.stars[5] && x.stars[3] > x.stars[4]), 'star counts look like a real class (about 25 five-stars, more 4s, more 3s)');

// The packed pool (about 1,500 recruits) comes back whole after save and load
newDynasty(40);
const before = G.recruits.length;
G.recruits[0].signed = 3; G.recruits[0].status = 'gone';
const r5 = G.recruits[5], rv = r5.rivals.map(x => x.tid + ':' + x.name).join(',');
ST.saveStateNow();
const raw = localStorage.getItem('hoops_os_v3');
S.buildUniverse(); ST.loadState();
const a = G.recruits[5];
check(G.recruits.length === before && before > 1000, `recruit pool survives save and load (${G.recruits.length} of ${before})`);
check(a.name === r5.name && a.ovr === r5.ovr && a.sht === r5.sht && a.stars === r5.stars && a.natRank === r5.natRank, 'recruit ratings and rank survive');
check(a.rivals.map(x => x.tid + ':' + x.name).join(',') === rv, 'rival schools come back with their names');
check(a.s && a.s.gp === 0 && a.mins === 0 && G.recruits[0].signed === 3 && !G.recruits[0].rivals, 'stat line rebuilt; signed recruits drop their race');
const kb = Math.round(JSON.stringify(JSON.parse(raw).recruitsP).length / 1024);
check(kb < 250, `recruit pool is small in the save (${kb} KB)`);
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
