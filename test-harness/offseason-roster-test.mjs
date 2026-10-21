// The offseason rollover keeps everyone who should stay: juniors become
// seniors (they used to be dropped with the graduating class), redshirt
// seniors get their extra year, and every recruit and transfer you sign is
// on the roster when the new season starts. Graduating seniors leave.
import { G, S, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const P = await import('../views/portal.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

for (const tid of [5, 60, 200]) {
  S.buildUniverse(); newDynasty(tid);
  runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool();
  if (G.offseasonStep === 'retention') { G.retention.asks.forEach(a => { a.decision = 'keep'; }); G.pts = 99999; R.finishRetention(); }
  R.renderOffseason();
  const t = G.teams[G.tid];
  // one returning junior and one redshirt senior for sure
  const ret = t.rost.filter(p => p.cls !== 'SR');
  if (ret[0]) ret[0].cls = 'JR';
  if (ret[1]) { ret[1].cls = 'SR'; ret[1].rs = true; }
  const juniors = t.rost.filter(p => p.cls === 'JR').map(p => p.name);
  const rsSeniors = t.rost.filter(p => p.cls === 'SR' && p.rs).map(p => p.name);
  // sign a mix: big offers on transfers, points on recruits
  G.pts = 99999; G.recruitingBudget = 5000; G.recruitingSpent = 0;
  P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 2).forEach(e => P.adjustOffer(e.pid, 600));
  G.recruits.filter(r => r.status === 'open').sort((a, b) => a.ovr - b.ovr).slice(0, 12).forEach(r => { R.addTarget(r.id); for (let k = 0; k < 30; k++) R.adjustPoints(r.id, 5); });
  let g = 0; while (G.offseasonStep === 'build' && g++ < 6) R.advanceBuild();
  const signed = G.recruits.filter(r => r.signed === G.tid).map(r => r.name);
  const grads = t.rost.filter(p => p.cls === 'SR' && !p.rs).map(p => p.name);
  // everyone on the roster at decision day who isn't graduating (returners + transfers you signed)
  const staying = t.rost.filter(p => !(p.cls === 'SR' && !p.rs)).map(p => p.name);
  const juniorsNow = juniors.filter(n => t.rost.some(p => p.name === n));
  S.doOffseason();
  const names = new Set(G.teams[G.tid].rost.map(p => p.name));
  if (juniorsNow.length < juniors.length) console.log('   (left before decision day: ' + juniors.filter(n => !juniorsNow.includes(n)).join(', ') + ')');
  check(juniorsNow.every(n => names.has(n)), `team ${tid}: all ${juniorsNow.length} juniors on the roster at decision day return as seniors`);
  check(rsSeniors.every(n => names.has(n)), `team ${tid}: ${rsSeniors.length} redshirt senior(s) stay one more year`);
  check(staying.every(n => names.has(n)), `team ${tid}: all ${staying.length} returners and signed transfers are on the new roster`);
  check(signed.every(n => names.has(n)), `team ${tid}: all ${signed.length} signed recruits joined the roster`);
  check(grads.every(n => !names.has(n)), `team ${tid}: ${grads.length} graduating senior(s) left`);
  check(!G.teams[G.tid].rost.some(p => p._grad || p._rsKeep), `team ${tid}: no leftover offseason flags`);
}
console.log(fails ? fails + ' FAILED' : 'all offseason roster checks passed');
process.exit(fails ? 1 : 0);
