// Player development, full run: node test-harness/player-dev.mjs [seasons=8]
// League overall and minutes by class, recruit pool vs players leaving, how
// roster spots get filled, CPU roster sizes, programs moving. Part 1 targets
// (HANDOFF.md item 0); exits 1 if any is out of band.
import { measure, printReport, summary, CLS } from './player-dev-lib.mjs';
const seasons = +(process.argv[2] || 8);
const t0 = Date.now();
const o = measure({ seasons });
console.log('Player development: ' + seasons + ' seasons (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
printReport(o);
const s = summary(o);
const f1 = v => (Math.round(v * 10) / 10).toFixed(1), pc = v => Math.round(v * 100) + '%';
const rows = [
  ['Recruit pool covers players leaving', f1(s.pool) + ' vs ' + f1(s.leaving), s.pool >= s.leaving],
  ['Recruits joining rosters per year vs leaving', f1(s.recruitsJoined) + ' vs ' + f1(s.leaving), s.recruitsJoined >= 0.85 * s.leaving],
  ['Generated top-up freshmen per year (rare)', f1(s.topups) + ' (max ' + s.topupsMax + ')', s.topupsMax <= 15],
  ['CPU rosters 13-15 every season', s.cpuMin + '-' + s.cpuMax + ', mean ' + f1(s.cpuMean) + ', worst season ' + pc(s.cpuIn13to15) + ' in 13-15', s.cpuIn13to15 >= 0.95 && s.cpuMin >= 12],
  ['Class sizes even (no echo)', s.classMin + '-' + s.classMax + ' players per class', s.classMin >= 0.8 * s.classMax],
  ['Freshman minutes share, every season', pc(s.frMinsMin) + '-' + pc(s.frMinsMax), s.frMinsMin >= 0.08],
];
console.log('\nSeasons 2-' + seasons + ': OVR by class ' + CLS.map(c => c + ' ' + f1(s.ovr[c])).join(', ')
  + '; minutes ' + CLS.map(c => c + ' ' + pc(s.mins[c])).join(', ') + '; FR minutes on the top 25 ' + pc(s.eliteFR)
  + '; 5-star arrives ' + f1(s.arrive5) + ', 4-star ' + f1(s.arrive4) + ', median top-5 ' + f1(s.top5Median) + '; team OVR top 25 ' + f1(s.teamTop25) + ', median ' + f1(s.teamMed) + ', 90th pct down ' + f1(s.teamP90));
console.log('\nPart 1 targets:');
rows.forEach(r => console.log('  ' + (r[2] ? 'ok  ' : 'OUT ') + r[0].padEnd(48) + r[1]));
const bad = rows.filter(r => !r[2]).length;
console.log('\n' + (bad ? bad + ' target(s) out of band' : 'ALL PART 1 TARGETS IN BAND'));
process.exit(bad ? 1 : 0);
