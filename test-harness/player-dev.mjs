// Player development, full run: node test-harness/player-dev.mjs [seasons=8] [--rise runs]
// League overall and minutes by class, recruit pool vs players leaving, how
// roster spots get filled, CPU roster sizes, programs moving. Part 1 targets
// (HANDOFF.md item 0); exits 1 if any is out of band.
import { measure, printReport, summary, CLS, printDev, rise, printRise } from './player-dev-lib.mjs';
const seasons = +(process.argv[2] || 8);
const riseRuns = process.argv.includes('--rise') ? +(process.argv[process.argv.indexOf('--rise') + 1] || 4) : 0;
const t0 = Date.now();
const o = measure({ seasons });
console.log('Player development: ' + seasons + ' seasons (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
printReport(o);
printDev(o.dev);
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
rows.forEach(r => console.log('  ' + (r[2] ? 'ok  ' : 'OUT ') + r[0].padEnd(52) + r[1]));
// Part 2 targets (HANDOFF.md item 0, part 2)
const d = o.dev, l4 = d.low4;
const step = CLS.slice(1).map((c, i) => s.ovr[c] - s.ovr[CLS[i]]);
const rows2 = [
  ['OVR rises by class, a clear step each year', CLS.map(c => f1(s.ovr[c])).join(' < '), step.every(v => v >= 1)],
  ['Freshmen 10-15% of minutes overall', pc(s.mins.FR), s.mins.FR >= 0.09 && s.mins.FR <= 0.16],
  ['... higher on elite teams', pc(s.eliteFR) + ' on the top 25', s.eliteFR > s.mins.FR && s.eliteFR <= 0.24],
  ['Career growth several times 2.4, with spread', f1(d.career.mean) + ' (10th-90th ' + d.career.p10 + ' to ' + d.career.p90 + ')', d.career.mean >= 6 && d.career.p90 - d.career.p10 >= 6],
  ['Higher POT recruits grow more', f1(d.potHigh) + ' vs ' + f1(d.potLow), d.potHigh >= d.potLow * 1.25],
  ['Breakouts about 1 in 20 (+6 or more)', pc(d.breakout), d.breakout >= 0.03 && d.breakout <= 0.09],
  ['Stalls about 1 in 10 (0 or less)', pc(d.stall), d.stall >= 0.06 && d.stall <= 0.16],
  ['Best vs worst development coach +25-40%', d.devRatio.toFixed(2) + 'x', d.devRatio >= 1.2 && d.devRatio <= 1.5],
  ['Rotation players grow faster than buried ones', d.minsRatio.toFixed(2) + 'x', d.minsRatio > 1.05],
  // starter at a low school (team rank 151-250); not an instant star (below
  // the league's top 10% of players as a freshman); very good by his junior
  // year (in the top 10%, clear of the low schools' best)
  ['4-star at a low school: starter, very good by JR', 'starts ' + pc(l4.starter) + ', OVR ' + f1(l4.fr) + ' -> ' + f1(l4.jr) + ' as JR (top 10% ' + f1(l4.p90) + ')', l4.starter >= 0.7 && l4.fr < l4.p90 && l4.jr >= l4.p90 && l4.jr - l4.fr >= 4],
];
console.log('\nPart 2 targets:');
rows2.forEach(r => console.log('  ' + (r[2] ? 'ok  ' : 'OUT ') + r[0].padEnd(52) + r[1]));
if (riseRuns) {
  console.log('\nBottom-tier school (about #330 of 365 by base level):'); printRise(rise({ runs: riseRuns, seasons, pickRank: 0.9 }));
  console.log('\nLower-middle school (about #255 of 365):'); printRise(rise({ runs: riseRuns, seasons, pickRank: 0.7 }));
}
const bad = rows.filter(r => !r[2]).length, bad2 = rows2.filter(r => !r[2]).length;
console.log('\n' + (bad ? bad + ' part 1 target(s) out of band' : 'ALL PART 1 TARGETS IN BAND') + '; ' + (bad2 ? bad2 + ' part 2 target(s) out of band' : 'ALL PART 2 TARGETS IN BAND'));
process.exit(bad || bad2 ? 1 : 0);
