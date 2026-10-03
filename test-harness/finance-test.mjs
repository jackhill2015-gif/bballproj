// Program money: every stream pays, spending is tracked, and a season's
// income lets each tier of program afford roughly one real splurge.
import { G, S, ST, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const FI = await import('../finance.js');
const R = await import('../views/recruiting.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const pickTeam = (lo, hi) => G.teams.findIndex(t => (t.schoolPrestige || 50) >= lo && (t.schoolPrestige || 50) < hi);
const rows = [];
for (const [label, lo, hi] of [['small', 0, 35], ['mid', 45, 60], ['power', 80, 101]]) {
  S.buildUniverse();
  const tid = pickTeam(lo, hi);
  newDynasty(tid); G.pts = 0;
  runRegSeason(); runConfTourneys(); runNCAA();
  S.beginOffseason();
  R.proceedToRecruiting(); // donor check lands
  const l = FI.ledger(), tot = FI.totals(l);
  rows.push([label, G.teams[tid].name, G.teams[tid].schoolPrestige, l.income.gate, l.income.tv, l.income.tourney, l.income.ad, l.income.donors, tot.income]);
  check(l.income.gate > 0 && l.income.tv > 0 && l.income.donors > 0, `${label}: ticket, TV and donor income all paid`);
  check(G.pts === tot.income, `${label}: budget equals logged income (${G.pts})`);
}
console.log('  tier   school          prestige gate  tv  tourney ad  donors total');
rows.forEach(r => console.log('  ' + r[0].padEnd(6) + ' ' + String(r[1]).padEnd(15) + ' ' + String(r[2]).padStart(8) + ' ' + [3,4,5,6,7,8].map(i => String(r[i]).padStart(5)).join('')));
const [small, mid, power] = rows.map(r => r[8]);
check(small >= 250 && small <= 600, 'small program season income in range (' + small + ')');
check(power > small, 'power program earns more than a small one');
check(mid >= 300, 'mid program can afford a facility upgrade or a strong portal offer (' + mid + ')');
console.log('── spending is tracked ──');
const before = FI.ledger().spend.facilities;
G.pts = 500; const F = await import('../facilities.js'); const up = F.upgradeFacility('practice');
check(up.ok && FI.ledger().spend.facilities === before + up.cost, 'facility upgrade logged as spending');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
