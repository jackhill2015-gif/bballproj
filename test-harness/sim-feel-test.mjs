// Sim realism, fast version for run-all: one season, loose bands.
// Full run (4+ seasons, real bands): node test-harness/sim-feel.mjs
import { measure, report, printReport, REAL } from './sim-feel-lib.mjs';
import { G, SIM, U } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

const o = measure({ seasons: 1, curveGames: 1600, r64Reps: 40, schemeGames: 700 });
const rows = report(o, 2); // every band twice as wide
printReport(o, rows);
console.log('');
// Upsets from one season are four games per seed line: check the lines
// together, top half (1-4 seeds) and bottom half (5-8 seeds)
const grp = ks => { let w = 0, n = 0; ks.forEach(k => { const u = o.upsets[k] || [0, 0]; w += u[0]; n += u[1]; }); return 100 * w / Math.max(1, n); };
const real = ks => ks.reduce((s, k) => s + REAL.upsets[k], 0) / ks.length;
const top = ['1v16', '2v15', '3v14', '4v13'], low = ['5v12', '6v11', '7v10', '8v9'];
check(Math.abs(grp(top) - real(top)) <= 9, 'upsets, 1-4 seeds: ' + grp(top).toFixed(1) + '% (real ' + real(top).toFixed(1) + '%)');
check(Math.abs(grp(low) - real(low)) <= 12, 'upsets, 5-8 seeds: ' + grp(low).toFixed(1) + '% (real ' + real(low).toFixed(1) + '%)');
// Overtime is real 5-minute periods: an overtime game adds about an eighth
// of a game's points per period, and the result carries the count
G.tid = -999; G.phase = 'ncaa'; SIM.SITE.campus = false;
const eq = G.teams.filter(t => U.getTOvr(t) === 75).slice(0, 12);
const tot = { 0: [], 1: [] }; let otN = 0, games = 0, tiedFinal = 0, badOt = 0;
for (let n = 0; n < 1500; n++) {
  const a = eq[n % eq.length], b = eq[(n * 7 + 3) % eq.length]; if (a === b) continue;
  const r = SIM.simGame(a, b, false); games++;
  if (r.homeScore === r.awayScore) tiedFinal++;
  if (r.ot !== undefined && !(r.ot >= 1 && r.ot <= 6)) badOt++;
  if (r.ot) otN++;
  if ((r.ot || 0) <= 1) tot[r.ot || 0].push(r.homeScore + r.awayScore);
}
const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
check(tiedFinal === 0 && badOt === 0, 'no tied finals; ot is 1-6 when present');
check(otN / games > 0.02 && otN / games < 0.12, 'evenly matched teams go to overtime ' + (100 * otN / games).toFixed(1) + '% of the time');
const add = avg(tot[1]) - avg(tot[0]);
check(tot[1].length >= 5 && add > 8 && add < 26, 'one overtime adds ' + add.toFixed(1) + ' points (a 5-minute period, regulation ' + avg(tot[0]).toFixed(0) + ')');
// One season's scoring leader and 20-point scorers swing a lot: wider here
const wide = { 'Scoring leader (ppg)': [20, 30], 'Players at 20+ ppg': [3, 28] };
Object.keys(wide).forEach(k => { const r = rows.find(x => x[0] === k), v = +r[1]; check(v >= wide[k][0] && v <= wide[k][1], k + ' ' + r[1] + ' (fast-test band ' + wide[k].join('-') + ')'); });
rows.filter(r => !r[0].startsWith('Upset') && !wide[r[0]]).forEach(r => check(r[3], r[0] + ' ' + r[1] + ' (loose band)'));
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
