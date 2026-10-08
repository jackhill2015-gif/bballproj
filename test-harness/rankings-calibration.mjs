// Full poll calibration (not in run-all: a few minutes). Sims N seasons
// (default 20) and prints the game's AP-style poll next to the real AP
// numbers from research/rankings/real-stats.json.
//   node test-harness/rankings-calibration.mjs [seasons] [--md]
import { simulate, compare, printTable } from './rankings-lib.mjs';
const N = +(process.argv.find(a => /^\d+$/.test(a)) || 20);
const MD = process.argv.includes('--md');
const t0 = Date.now();
const st = simulate(N, 60, s => process.stderr.write('season ' + (s + 1) + '/' + N + '\r'));
const rows = compare(st);
console.log('\nGame poll vs real AP poll, ' + N + ' simulated seasons (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
printTable(rows);
if (MD) {
  console.log('\n| Stat | Game | Real | Band | |\n|---|---|---|---|---|');
  rows.forEach(r => console.log('| ' + r[0].replace(/^\s*\.\.\./, '... ') + ' | ' + r[1] + ' | ' + r[2] + ' | ' + r[3] + ' | ' + (r[4] ? 'ok' : 'outside') + ' |'));
}
const bad = rows.filter(r => !r[4]).length;
console.log('\n' + (bad ? bad + ' stat(s) outside their band' : 'ALL WITHIN BANDS'));
process.exit(bad ? 1 : 0);
