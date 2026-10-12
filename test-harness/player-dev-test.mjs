// Player development, fast version (in run-all). Part 1: recruit pool vs
// players leaving, CPU rosters 13-15, generated top-up freshmen rare, class
// sizes even, and the packed recruit pool surviving a save and load.
// Part 2: OVR rises by class, freshmen's share of minutes, developPlayer's
// rates (breakouts, stalls, coaching, position), scouted POT, old saves.
// Full report: node test-harness/player-dev.mjs
import { measure, summary } from './player-dev-lib.mjs';
import { G, S, ST, SIM, newDynasty } from './season-lib.mjs';
import { REPO } from './shim.mjs';
const RP = await import(REPO + '/recruitpool.js');
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

// ── Part 2 ──
check(s.ovr.FR + 1 < s.ovr.SO && s.ovr.SO + 0.5 < s.ovr.JR && s.ovr.JR + 0.3 < s.ovr.SR, `OVR rises by class (${['FR', 'SO', 'JR', 'SR'].map(c => c + ' ' + f1(s.ovr[c])).join(', ')})`);
check(s.mins.FR >= 0.07 && s.mins.FR <= 0.17, `freshmen play about 10-15% of minutes (${Math.round(s.mins.FR * 100)}%)`);
const mean = a => a.reduce((x, v) => x + v, 0) / a.length;
// One offseason for 4,000 freshmen at the same gap: rates and multipliers
const fr = (dev, prac, mins, pos = 'SF') => { const p = SIM.genPlayer(70, pos, 'FR'); p.tp = p.ovr + 10; p.pot = p.tp; p.mins = mins; const o = p.ovr, r = { sht: p.sht, fin: p.fin, def: p.def, reb: p.reb, ply: p.ply }; const k = SIM.developPlayer(p, dev, prac); return { d: p.ovr - o, k, p, r }; };
const base = Array.from({ length: 4000 }, () => fr(70, 0, 20));
const br = base.filter(x => x.k === 'breakout').length / base.length, sl = base.filter(x => x.k === 'stall').length / base.length;
check(br > 0.03 && br < 0.07 && sl > 0.045 && sl < 0.095, `breakouts about 1 in 20 (${(br * 100).toFixed(1)}%), stalls about 1 in 14 (${(sl * 100).toFixed(1)}%)`);
check(base.filter(x => x.k === 'breakout').every(x => x.d >= 5 && x.p.tp >= x.p.ovr), 'a breakout adds about 6-10 and raises the ceiling');
const norm = a => mean(a.filter(x => !x.k).map(x => x.d));
const g99 = norm(Array.from({ length: 3000 }, () => fr(99, 5, 20))), g40 = norm(Array.from({ length: 3000 }, () => fr(40, 0, 20))), g70 = norm(base);
check(g99 / g70 > 1.25 && g99 / g70 < 1.6 && g70 / g40 > 1.1, `coaching and facility matter (best ${f1(g99)}, average ${f1(g70)}, worst ${f1(g40)} a year)`);
const gBench = norm(Array.from({ length: 3000 }, () => fr(70, 0, 0))), gStar = norm(Array.from({ length: 3000 }, () => fr(70, 0, 32)));
check(gStar > gBench * 1.15, `rotation players grow faster (${f1(gStar)} vs ${f1(gBench)} on the bench)`);
const cs = Array.from({ length: 1500 }, () => fr(70, 0, 20, 'C')).filter(x => !x.k);
const gain = (x, a) => x.p[a] - x.r[a];
check(mean(cs.map(x => gain(x, 'reb') + gain(x, 'def'))) > 2 * mean(cs.map(x => gain(x, 'sht') + gain(x, 'ply'))), 'a center grows mostly in rebounding and defense');
const grown = Array.from({ length: 500 }, () => { const p = SIM.genPlayer(70, 'PG', 'FR'); p.mins = 20; for (const c of ['FR', 'SO', 'JR']) { p.cls = c; SIM.developPlayer(p, 70, 0); } return p; });
check(grown.every(p => p.pot >= p.ovr && p.tp >= p.ovr && p.pot <= 99), 'POT never below overall, true potential never below overall');
check(mean(grown.map(p => Math.abs(p.pot - p.tp))) < 1.2, `the POT estimate closes in on the truth with time (off by ${f1(mean(grown.map(p => Math.abs(p.pot - p.tp))))} as seniors)`);
// Scouted POT on recruits: a few points either way, closer with a better recruiter
newDynasty(40);
const err = () => mean(G.recruits.map(r => Math.abs(r.pot - r.tp)));
G.coach.rec = 50; S.genRecruits(); const e50 = err();
G.coach.rec = 95; S.genRecruits(); const e95 = err();
check(G.recruits.every(r => typeof r.tp === 'number' && r.pot >= r.ovr) && e50 > 2.5 && e50 < 5 && e95 < e50 - 1, `recruit POT is an estimate (off by ${f1(e50)} with a 50 recruiter, ${f1(e95)} with 95; sd ${RP.scoutSd().toFixed(1)})`);
// Old saves: true potential near the POT shown, nothing else moves on load
const u = G.teams[G.tid].rost;
u.forEach(p => { delete p.tp; });
const snap = u.map(p => [p.name, p.ovr, p.pot, p.sht]);
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
const u2 = G.teams[G.tid].rost;
check(snap.every(([n, o, pt, sh]) => { const p = u2.find(x => x.name === n); return p && p.ovr === o && p.pot === pt && p.sht === sh && p.tp >= o && Math.abs(p.tp - Math.max(o, pt)) <= 2; }), 'old save: players get a true potential within 2 of their POT; ratings and POT unchanged');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
