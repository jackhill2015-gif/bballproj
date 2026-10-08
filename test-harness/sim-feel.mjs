// Sim realism, full run: node test-harness/sim-feel.mjs [seasons=16] (about 3 min)
// Reports every target in research/sim-feel.md; exits 1 if any is out of band.
// The fast version (loose bands) is sim-feel-test.mjs in run-all.
import { measure, report, printReport } from './sim-feel-lib.mjs';
const seasons = +(process.argv[2] || 16);
const t0 = Date.now();
const o = measure({ seasons, curveGames: 3000, r64Reps: 50, schemeGames: 1500 });
const rows = report(o);
console.log('Sim feel: ' + seasons + ' seasons (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
printReport(o, rows);
const bad = rows.filter(r => !r[3]).length;
console.log('\n' + (bad ? bad + ' stat(s) outside their band' : 'ALL TARGETS WITHIN BANDS'));
process.exit(bad ? 1 : 0);
