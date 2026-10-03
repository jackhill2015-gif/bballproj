// Menu sims stop at the right milestone and go through the normal weekly
// path (rankings get recomputed along the way).
import { G, S, SetupState, newDynasty } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const until = () => new Promise(res => { const iv = setInterval(() => { if (!SetupState.G_AUTO) { clearInterval(iv); res(); } }, 20); });
newDynasty(9);
const pts0 = G.teams.map(t => t.pts).join();
S.doPlay('sim-reg'); await until();
check(G.phase === 'conf_tourn', 'sim to end of regular season stops at the conference tournament (phase ' + G.phase + ')');
check(G.teams[G.tid].wins + G.teams[G.tid].loss >= 28, 'user played the regular season');
check(G.teams.map(t => t.pts).join() !== pts0 && G.teams.some(t => t.lastRank), 'rankings updated week to week');
S.doPlay('sim-conf'); await until();
check(G.phase === 'ncaa' && G.bracket.length === 64, 'sim through conference tournament stops at Selection Sunday');
S.doPlay('sim-season'); await until();
check(G.phase === 'offseason', 'sim through end of season reaches the offseason');
newDynasty(10); S.doPlay('sim-season'); setTimeout(() => S.doPlay('stop'), 150); await until();
check(G.phase === 'reg' && G.gi > 0 && G.gi < 30, 'stop halts a running sim mid-season (week ' + G.gi + ')');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
