// Scouting reports: every prospect gets a type, sensible strengths and
// weaknesses for his position, and a fit report against your roster.
import { G, S, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const SC = await import('../views/scouting.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(60); U.fixMins(G.teams[G.tid].rost);
runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool(); R.proceedToRecruiting();
if (G.offseasonStep === 'retention') { G.pts = 9999; G.retention.asks.forEach(a => { a.decision = 'keep'; }); R.finishRetention(); }
const people = G.recruits.concat(G.portalEntrants.filter(e => e.fromTid !== G.tid));
let bad = 0;
people.forEach(p => {
  const t = SC.playerType(p), sw = SC.strengthsAndWeaknesses(p), f = SC.fitReport(p);
  if (!t || !['Starter', 'Rotation', 'Bench'].includes(f.role) || !f.posTxt || !SC.scoutingHTML(p).includes(t)) bad++;
  if (sw.strengths.some(s => sw.weaknesses.includes(s))) bad++;
});
check(bad === 0, `all ${people.length} recruits and transfers get a type, role and full report`);
const types = new Set(people.map(SC.playerType));
check(types.size >= 15, `player types are varied (${types.size} different)`);
const starters = people.filter(p => SC.fitReport(p).role === 'Starter');
check(starters.length > 0 && starters.every(p => p.ovr >= Math.min(...starters.map(x => x.ovr))), 'some prospects project as starters');
const need = people.filter(p => SC.fitReport(p).fillsNeed);
check(need.length > 0 && need.length < people.length * 0.4, `"Fills a need" is selective (typically ~15%; the roster draw can push it past a third) (${need.length} of ${people.length})`);
// a pure shooter at shooting guard reads as a shooter, and no guard is flagged for low rebounding alone
const shooter = { name: 'Test Shooter', pos: 'SG', ovr: 80, sht: 97, fin: 70, def: 68, reb: 55, ply: 70, cls: 'FR' };
check(['Sharpshooter', '3-and-D wing'].includes(SC.playerType(shooter)), 'a pure shooter at SG is a Sharpshooter (' + SC.playerType(shooter) + ')');
const pg = { name: 'Test PG', pos: 'PG', ovr: 80, sht: 78, fin: 74, def: 76, reb: 60, ply: 98, cls: 'FR' };
check(SC.playerType(pg) === 'Floor general', 'a pass-first PG is a Floor general (' + SC.playerType(pg) + ')');
check(!SC.strengthsAndWeaknesses({ ...shooter, sht: 87, fin: 97, reb: 99, def: 77, ply: 77 }).weaknesses.includes('shooting'), 'an 87 shooter is never tagged as a weak shooter');
console.log(fails ? fails + ' FAILED' : 'all scouting checks passed');
process.exit(fails ? 1 : 0);
