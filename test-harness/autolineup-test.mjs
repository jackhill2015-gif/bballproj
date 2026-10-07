// Auto-manage lineup: healthy best players start, injured/redshirt sit, 200 minutes
import { G, S, U, newDynasty } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(30);
const t = G.teams[G.tid];
const best = t.rost.slice().sort((a, b) => b.ovr - a.ovr)[0];
t.rost.find(p => p !== best).rs = true;
G.injuries = [{ playerName: best.name, weeksLeft: 3, type: 'Ankle', origMins: 30 }];
G.autoLineup = true; S.applyAutoLineup();
const sum = t.rost.reduce((a, p) => a + p.mins, 0);
check(sum === 200, 'minutes add up to 200 (' + sum + ')');
check(best.mins === 0, 'injured best player sits');
check(t.rost.filter(p => p.rs).every(p => p.mins === 0), 'redshirt sits');
const healthy = t.rost.filter(p => !p.rs && p.name !== best.name).sort((a, b) => b.ovr - a.ovr);
check(healthy.slice(0, 5).every(p => p.mins >= 30) && t.rost.indexOf(healthy[0]) === 0, 'top five healthy players start, best healthy first');
G.injuries = []; S.applyAutoLineup();
check(best.mins >= 30, 'he goes back into the lineup when healthy (' + best.mins + ' min)');
G.autoLineup = false; best.mins = 7; S.applyAutoLineup();
check(best.mins === 7, 'does nothing when turned off');
let n = 0; G.autoLineup = true;
for (let w = 0; w < 30 && G.phase === 'reg'; w++) { const g = t.sched[G.gi]; if (g && !g.played) S.launchSim(false); else { S.simCPUWeek(); S.advanceWeek(); } n++; }
check(t.rost.reduce((a, p) => a + p.mins, 0) === 200, 'still 200 minutes after a full season of injuries and returns');
console.log(fails ? fails + ' FAILED' : 'all auto-lineup checks passed');
process.exit(fails ? 1 : 0);
