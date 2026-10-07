// Recruiting Board opens on "Within reach": recruits your fair share of
// points (budget / open spots) would sign at >= 50%. Show everyone brings
// back the full board. A low-prestige board isn't full of 5-stars.
import { G, S, ST, newDynasty } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const SG = await import('../views/signings.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

function board(tid) {
  newDynasty(tid);
  G.recruitPhase = 1; G.recruitingBudget = ST.calcRecruitingBudget(); G.recruitingSpent = 0;
  G.recruits.forEach(r => { r.points = 0; r.status = 'open'; r.signed = -1; });
  return G.recruits.filter(r => r.status === 'open');
}
const byPrestige = S => G.teams.slice().sort((a, b) => a.schoolPrestige - b.schoolPrestige);
S.buildUniverse();
const order = byPrestige();
const low = order[5].id, blue = order[order.length - 3].id;

const top = {};
for (const [label, tid] of [['low-prestige', low], ['blueblood', blue]]) {
  const open = board(tid);
  const sp = G.teams[tid].schoolPrestige;
  R.setBoardFilter({ fit: 'reach', near: false, targets: false, pos: 'All', stars: 0, sort: 'rank', dir: 1 });
  const reach = R.boardList(open);
  const fives = open.filter(r => r.stars === 5).length, reachFives = reach.filter(r => r.stars === 5).length;
  const avgStars = a => (a.reduce((s, r) => s + r.stars, 0) / Math.max(1, a.length)).toFixed(2);
  console.log(`  ${label} ${G.teams[tid].name} (prestige ${sp}, budget ${G.recruitingBudget}, open ${SG.openSpots()}): ${reach.length} of ${open.length} within reach, 5-stars ${reachFives}/${fives}, avg stars ${avgStars(reach)} vs ${avgStars(open)}`);
  check(reach.length > 0 && reach.length < open.length, `${label}: default view is a subset of the board`);
  check(reach.every(r => R.withinReach(r)), `${label}: default view only has recruits within reach`);
  check(open.filter(r => !reach.includes(r)).every(r => !R.withinReach(r)), `${label}: everyone within reach is shown`);
  check(reach.every((r, i) => i === 0 || reach[i - 1].ovr >= r.ovr), `${label}: best players first`);
  // within reach really means >= 50%: fair share on him, signing-day odds
  const fair = G.recruitingBudget / Math.max(1, SG.openSpots());
  if (label === 'low-prestige') {
    check(reachFives <= Math.max(1, Math.round(fives * 0.1)), `low-prestige: default view isn't full of 5-stars (${reachFives} of ${fives})`);
    check(reach.length >= SG.openSpots(), `low-prestige: enough recruits within reach to fill ${SG.openSpots()} spots (${reach.length})`);
  }
  top[label] = reach.filter(r => r.stars >= 4).length;
  R.setBoardFilter({ fit: 'all' });
  check(R.boardList(open).length === open.length, `${label}: Show everyone shows all ${open.length}`);
  // anyone you're already pursuing stays on the default view
  R.setBoardFilter({ fit: 'reach' });
  const far = open.find(r => !R.withinReach(r));
  if (far) { far.points = 5; check(R.boardList(open).includes(far), `${label}: a recruit you're pursuing stays on the default view`); far.points = 0; }
  // cache follows the budget
  const before = R.boardList(open).length;
  G.recruitingBudget = Math.round(G.recruitingBudget * 3);
  const after = R.boardList(open).length;
  check(after >= before, `${label}: a bigger budget brings more within reach (${before} -> ${after})`);
  // within reach = fair share gives >= 50% on signing day; spot-check the
  // boundary with the same odds the recruit page shows
  G.recruitingBudget = Math.round(G.recruitingBudget / 3);
  const sample = open.slice(0, 40);
  sample.forEach(r => { r.points = Math.round(fair); });
  const pct = r => { const me = R._schoolChancesForTest(r).find(x => x.isUser); return me ? me.pct : 0; };
  const agree = sample.filter(r => (pct(r) >= 49) === R.withinReach(r) || Math.abs(pct(r) - 50) <= 2).length;
  sample.forEach(r => { r.points = 0; });
  check(agree === sample.length, `${label}: within reach matches the shown odds at fair share (${agree}/${sample.length})`);
}
check(top.blueblood > top['low-prestige'], `blueblood sees more 4-5 stars within reach than a low-prestige school (${top.blueblood} vs ${top['low-prestige']})`);
// Show filter is remembered (ui-prefs); older prefs start on Within reach once
globalThis.window.localStorage = localStorage;
const prefs = async raw => { localStorage.setItem('hoops_os_ui', JSON.stringify({ recruiting: raw })); return (await import('../views/ui-prefs.js?r=' + Math.random())).getUiPrefs('recruiting').fit; };
check(await prefs(null) === 'reach', 'new players start on Within reach');
check(await prefs({ fit: 'all' }) === 'reach', 'prefs saved before Within reach move to it once');
check(await prefs({ fit: 'all', reachV: 1 }) === 'all', 'Show everyone is remembered');
check(await prefs({ fit: 'need', reachV: 1 }) === 'need', 'other Show choices are remembered');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
