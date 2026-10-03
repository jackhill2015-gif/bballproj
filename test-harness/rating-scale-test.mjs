// v11 overall scale: 90+ is rare, 99 almost never, potential not pinned at
// 99; game rules see the same numbers as before (oldOvr round-trips);
// old saves convert once.
import { G, S, ST, U, newDynasty } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
newDynasty(5); S.genRecruits();
const ps = G.teams.flatMap(t => t.rost), n = ps.length;
const sh = f => (ps.filter(f).length / n * 100).toFixed(1) + '%';
const q = (a, f) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(f * a.length)]; };
const ov = ps.map(p => p.ovr), pot = ps.map(p => p.pot);
console.log(`  players: median ${q(ov, .5)}, 90th pct ${q(ov, .9)}, 99th pct ${q(ov, .99)}, max ${Math.max(...ov)} · 90+ ${sh(p => p.ovr >= 90)} · pot 99 ${sh(p => p.pot >= 99)} · pot 95+ ${sh(p => p.pot >= 95)}`);
check(ps.filter(p => p.ovr >= 90).length / n < 0.02, '90+ overall is rare (<2%)');
check(ps.filter(p => p.ovr >= 99).length <= 3, '99 overall almost never');
check(ps.filter(p => p.pot >= 99).length / n < 0.01, '99 potential is rare (<1%)');
check(ps.every(p => p.pot >= p.ovr), 'potential never below overall');
const rec = G.recruits;
console.log(`  recruits: top ${Math.max(...rec.map(r => r.ovr))}, 5-star avg ${(rec.filter(r => r.stars === 5).reduce((s, r) => s + r.ovr, 0) / 10).toFixed(1)}, pot 99 ${rec.filter(r => r.pot >= 99).length}`);
let rt = 0; for (let a = 40; a <= 99; a += 0.5) { if (Math.abs(U.oldOvr(U.scaleOvr(a)) - a) > 1.4) rt++; }
check(rt === 0, 'oldOvr undoes scaleOvr within rounding');
const tv = G.teams.map(t => U.getTOvr(t));
console.log(`  teams: median ${q(tv, .5)}, best ${Math.max(...tv)}, worst ${Math.min(...tv)}`);
console.log('── old save converts once ──');
ST.saveStateNow();
const raw = JSON.parse(localStorage.getItem('hoops_os_v3'));
raw._saveVersion = 10;               // pretend it's an old save...
const p0 = G.teams[G.tid].rost[0];
const before = { ovr: p0.ovr, name: p0.name };
// ...with old-scale overalls stored (as a v10 save would have)
localStorage.setItem('hoops_os_v3', JSON.stringify(raw));
S.buildUniverse(); ST.loadState();
const p1 = G.teams[G.tid].rost.find(p => p.name === before.name);
check(p1 && p1.ovr === U.getOvr(p1), 'loaded player overall recomputed on the new scale');
check(JSON.parse(localStorage.getItem('hoops_os_v3'))._saveVersion === 11, 'converted save written back as v11');
const again = p1.ovr; S.buildUniverse(); ST.loadState();
check(G.teams[G.tid].rost.find(p => p.name === before.name).ovr === again, 'reloading does not convert twice');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
