// Events for every team: CPU injuries and streaks, exact buff undo, season clean-up
import { G, S, U, newDynasty } from './season-lib.mjs';
import * as EV from '../events.js';
import * as UT from '../utils.js';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(30);
const t = G.teams[G.tid];

// 1. A hot streak on a 97 shooter takes off exactly what it added
const star = t.rost[0]; star.sht = 97;
const bf = UT.applyBuff(t, star.name, 'sht', 5, 3);
check(star.sht === 99 && bf.applied === 2, 'hot streak clamps at 99 and records +2 (' + bf.applied + ')');
UT.undoBuff(t, bf);
check(star.sht === 97, 'undo restores 97 (' + star.sht + ')');
const before = t.rost.map(p => [p.sht, p.fin, p.def]);
t.rost[1].sht = 98;
const tb = UT.applyBuff(t, 'TEAM', 'all', 2, 2);
UT.undoBuff(t, tb);
check(t.rost.every((p, i) => p.fin === before[i][1] && p.def === before[i][2]) && t.rost[1].sht === 98, 'team buff undoes exactly');

// 2. Injury lengths: mostly short, some long, a few for the season
const ws = Array.from({ length: 4000 }, UT.injuryWeeks);
const short = ws.filter(w => w <= 3).length / ws.length;
check(short > 0.8 && short < 0.95, 'injuries mostly 1-3 weeks (' + (short * 100).toFixed(0) + '%)');
check(ws.some(w => w >= 4 && w < 30) && ws.some(w => w === 99) && ws.filter(w => w === 99).length / ws.length < 0.03, 'some long, a few season-ending');

// 3. CPU teams get events
let inj = 0, seen = new Set();
for (let w = 1; w <= 20; w++) { EV.rollCpuEvents(w); inj = Math.max(inj, G.cpuInj.length); G.cpuInj.forEach(i => seen.add(i.tid)); }
check(inj > 20, 'many CPU players out at once (' + inj + ')');
check(seen.size > 100 && !seen.has(G.tid), 'injuries across the league, never the user team via cpu list (' + seen.size + ' teams)');
const bad = G.teams.filter(x => x.id !== G.tid && x.rost.reduce((a, p) => a + p.mins, 0) !== 200);
check(bad.length === 0, 'every CPU team still plays 200 minutes (' + bad.length + ' off)');
const out = G.cpuInj[0];
if (out) {
  const p = G.teams[out.tid].rost.find(q => q.name === out.playerName);
  check(p && p.mins === 0, 'an injured CPU player sits');
}

// 4. End of season clears everything and restores ratings
EV.clearSeasonEvents();
check(G.cpuInj.length === 0 && G.cpuBuffs.length === 0 && G.injuries.length === 0 && G.buffs.length === 0, 'all events cleared');
check(G.teams.every(x => x.id === G.tid || x.rost.reduce((a, p) => a + p.mins, 0) === 200), 'minutes still 200 everywhere');
console.log(fails ? fails + ' FAILED' : 'all event checks passed');
process.exit(fails ? 1 : 0);
