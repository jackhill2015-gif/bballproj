// Portal entrant mix across several offseasons: mostly role players, a
// solid middle tier, a few stars — not a board of 95+ overalls.
import { G, S, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const P = await import('../views/portal.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const all = [], reasons = {};
const N = +(process.argv[2] || 2);
for (let k = 0; k < N; k++) {
  newDynasty(40 + k); runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason();
  P.genPortalEntrants();
  G.portalEntrants.forEach(e => { all.push(e.ovr); reasons[e.reason] = (reasons[e.reason] || 0) + 1; });
  console.log(`  offseason ${k + 1}: ${G.portalEntrants.length} entrants`);
}
const n = all.length, share = f => all.filter(f).length / n;
const pct = x => (x * 100).toFixed(0) + '%';
// v11 overall scale: 85+ is star territory, under 75 is a role player
const s90 = share(o => o >= 85), s85 = share(o => o >= 80 && o < 85), s80 = share(o => o >= 75 && o < 80), sLow = share(o => o < 75);
console.log(`  85+ ${pct(s90)} · 80-84 ${pct(s85)} · 75-79 ${pct(s80)} · under 75 ${pct(sLow)}`);
console.log('  reasons', reasons);
check(n / N >= 100, 'a full portal each year (' + Math.round(n / N) + ' avg)');
check(s90 <= 0.10 && s90 > 0, 'stars are scarce but present (85+: ' + pct(s90) + ')');
check(sLow >= 0.45, 'most entrants are role players under 75 (' + pct(sLow) + ')');
check(Object.keys(reasons).length >= 3, 'several transfer reasons appear');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
