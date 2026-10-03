// Player history (p.h), awards (p.aw) and the development report survive a
// full season + offseason and a save/load.
import { G, S, ST, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
newDynasty(12); runRegSeason(); runConfTourneys(); runNCAA();
const t = G.teams[G.tid], p = t.rost.find(x => x.cls !== 'SR');
check(Array.isArray(p.h) && p.h.length === 1 && p.h[0][0] === G.yr && p.h[0][1] === G.tid, 'season row recorded [yr, team, ovr, gp, pts, reb, ast, stl, blk]: ' + JSON.stringify(p.h[0]));
check(p.h[0][3] === p.s.gp && p.h[0][4] === p.s.pts, 'row totals match the season stats');
const awarded = G.teams.flatMap(tm => tm.rost).filter(x => (x.aw || []).length);
check(awarded.some(x => x.aw.some(a => /Player of the Year/.test(a))) && awarded.filter(x => x.aw.some(a => /All-American/.test(a))).length === 5, 'POY and five All-Americans tagged');
S.beginOffseason(); S.doOffseason();
const rep = G.devReport;
check(rep && rep.yr === G.yr && rep.rows.length > 5, 'development report built for ' + rep.yr + ' (' + rep.rows.length + ' returners)');
const r0 = rep.rows.find(r => r.name === p.name);
check(r0 && r0.ovrTo === p.ovr && typeof r0.delta.sht === 'number', 'report row matches the player after development (' + r0.ovrFrom + ' → ' + r0.ovrTo + ')');
const keep = G.teams[G.tid].rost.find(x => (x.h || []).length === 1);
const keepH = JSON.stringify(keep && keep.h);
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
const p2 = G.teams[G.tid].rost.find(x => keep && x.name === keep.name);
check(p2 && JSON.stringify(p2.h) === keepH && G.devReport && G.devReport.rows.length === rep.rows.length, 'history and report survive save/load');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
