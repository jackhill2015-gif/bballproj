// HOOPS OS sim-engine calibration + M-fix regression script
// Measures engine output vs research/cbb-calibration-targets.md bands.
const REPO = '/home/hatch/workspace/bballproj';

// ── browser shims ──
const _store = {};
globalThis.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
  clear: () => { for (const k in _store) delete _store[k]; },
};
function stubEl() {
  const el = {
    textContent: '', innerHTML: '', value: '', onclick: null, oninput: null,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() { return el; }, removeChild() {}, insertBefore() {},
    querySelector() { return null; }, querySelectorAll: () => [],
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {},
  };
  return el;
}
globalThis.document = {
  getElementById: () => stubEl(), createElement: () => stubEl(),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, body: stubEl(),
};
globalThis.window = {};

const SIM = await import(REPO + '/simulation.js');
const U = await import(REPO + '/utils.js');
const ST = await import(REPO + '/state.js');
const { G, LS } = ST;
const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const CLS = ['FR', 'SO', 'JR', 'SR'];
const OFFS = ['balanced', 'motion', 'drive', 'set', 'early'];
const DEFS = ['man', '2-3', '3-2', '1-3-1', 'box1'];

function buildTeams(n, baseLo, baseHi) {
  const teams = [];
  for (let i = 0; i < n; i++) {
    const base = Math.round(baseLo + (baseHi - baseLo) * (i / (n - 1)));
    const rost = [];
    for (let j = 0; j < 13; j++) rost.push(SIM.genPlayer(base, POS[j % 5], CLS[j % 4]));
    U.fixMins(rost);
    const strat = { off: OFFS[i % 5], def: DEFS[(i * 2 + 1) % 5] };
    teams.push({ id: 1000 + i, name: 'T' + i, baseOvr: base, rost, strat });
  }
  return teams;
}

function resetG() {
  G.tid = -999;
  G.difficulty = 'normal';
  G.coach = null;
  G.nextHomeBonus = 0;
  G.momentum = { tid: -1, pts: 0 };
  G.buffs = []; G.injuries = [];
}

function newAgg() {
  return { g: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 0, oreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, wins: 0 };
}
function accTeam(agg, team) {
  for (const p of team.rost) {
    const s = p.s;
    agg.pts += s.pts; agg.fgm += s.fgm; agg.fga += s.fga;
    agg.tpm += s.tpm || 0; agg.tpa += s.tpa || 0;
    agg.ftm += s.ftm || 0; agg.fta += s.fta || 0;
    agg.to += s.to || 0; agg.oreb += s.oreb || 0; agg.reb += s.reb;
    agg.ast += s.ast; agg.stl += s.stl || 0; agg.blk += s.blk || 0;
  }
}
function sumPts(team) { let t = 0; for (const p of team.rost) t += p.s.pts; return t; }

function check(name, val, lo, hi, fmt) {
  const f = fmt || (v => (Math.round(v * 10) / 10));
  const ok = val >= lo && val <= hi;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${f(val)}  (band ${f(lo)}–${f(hi)})`);
  return ok;
}

console.log('── building 48-team universe (base 60–94), full scheme coverage ──');
resetG();
const teams = buildTeams(48, 60, 94);
const aggs = teams.map(() => newAgg());

let nGames = 0, homeWins = 0, margins = [], marginPairs = [], phantom = 0, nanFound = 0;
let totH = 0, totA = 0;

console.log('── simming round-robin (~1128 games) ──');
const t0 = Date.now();
for (let i = 0; i < teams.length; i++) {
  for (let j = i + 1; j < teams.length; j++) {
    const home = ((i + j) % 2 === 0) ? teams[i] : teams[j];
    const away = home === teams[i] ? teams[j] : teams[i];
    const hi = teams.indexOf(home), ai = teams.indexOf(away);
    const hPts0 = sumPts(home), aPts0 = sumPts(away);
    const res = SIM.simGame(home, away, true); // userIsHome=true on purpose: M2 must still gate
    nGames++;
    if (sumPts(home) - hPts0 !== res.homeScore) phantom++;
    if (sumPts(away) - aPts0 !== res.awayScore) phantom++;
    totH += res.homeScore; totA += res.awayScore;
    margins.push(res.homeScore - res.awayScore);
    marginPairs.push([hi, ai, res.homeScore - res.awayScore]);
    if (res.homeScore > res.awayScore) { homeWins++; aggs[hi].wins++; }
    else aggs[ai].wins++;
    aggs[hi].g++; aggs[ai].g++;
  }
}
teams.forEach((t, i) => accTeam(aggs[i], t));
let L = { g: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 0, oreb: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
for (const a of aggs) for (const k in L) L[k] += a[k];
L.g = nGames * 2;

for (const t of teams) for (const p of t.rost)
  for (const k in p.s) if (typeof p.s[k] !== 'number' || !Number.isFinite(p.s[k])) nanFound++;

console.log(`  simmed ${nGames} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  phantom-point games: ${phantom}, NaN stats: ${nanFound}`);
console.log('\n── calibration vs bands ──');
const g = L.g;
const poss = p => p.fga - p.oreb + p.to + 0.44 * p.fta; // standard formula
let allOk = true;
allOk &= check('1.1 avg team PPG', L.pts / g, 70, 76);
allOk &= check('2.1 avg tempo (poss/gm)', poss(L) / g, 64, 70);
console.log(`  diag: FGA/gm ${(L.fga / g).toFixed(1)}, OR/gm ${(L.oreb / g).toFixed(1)}`);
allOk &= check('3.1 avg FG%', L.fgm / L.fga, 0.425, 0.455, v => v.toFixed(3));
allOk &= check('3.2 avg 3P%', L.tpm / L.tpa, 0.325, 0.355, v => v.toFixed(3));
allOk &= check('3.3 3PA share of FGA', L.tpa / L.fga, 0.36, 0.42, v => v.toFixed(3));
allOk &= check('3.3b avg 3PA/game', L.tpa / g, 20, 30, v => v.toFixed(1));
allOk &= check('3.5 avg FT%', L.ftm / L.fta, 0.690, 0.740, v => v.toFixed(3));
allOk &= check('3.6 avg FTA/game', L.fta / g, 19, 25, v => v.toFixed(1));
allOk &= check('4.1 avg OR%', L.oreb / L.reb, 0.26, 0.31, v => v.toFixed(3));
allOk &= check('4.3 avg team RPG', L.reb / g, 33, 38, v => v.toFixed(1));
allOk &= check('5.1 avg TO%', L.to / poss(L), 0.16, 0.20, v => v.toFixed(3));
allOk &= check('5.2 avg team TO/game', L.to / g, 10.5, 13.5, v => v.toFixed(1));
allOk &= check('5.4 avg team steals/game', L.stl / g, 6.0, 8.5, v => v.toFixed(1));
allOk &= check('5.5 avg team blocks/game', L.blk / g, 3.0, 4.5, v => v.toFixed(1));
allOk &= check('5.6 avg team A/TO', L.ast / L.to, 1.1, 1.6, v => v.toFixed(2));
allOk &= check('5.7 avg team assists/game', L.ast / g, 13, 17, v => v.toFixed(1));
allOk &= check('7.1 home win%', homeWins / nGames, 0.62, 0.72, v => v.toFixed(3));
const meanM = margins.reduce((s, m) => s + m, 0) / margins.length;
const sdM = Math.sqrt(margins.reduce((s, m) => s + (m - meanM) ** 2, 0) / margins.length);
allOk &= check('1.7 margin sigma', sdM, 9.5, 12.5, v => v.toFixed(1));
allOk &= check('1.7 mean |margin|', margins.reduce((s, m) => s + Math.abs(m), 0) / nGames, 10, 14, v => v.toFixed(1));
const intra = marginPairs.filter(([a, b]) => Math.floor(a / 8) === Math.floor(b / 8)).map(([, , m]) => m);
const iMean = intra.reduce((s, m) => s + m, 0) / Math.max(1, intra.length);
const iSd = Math.sqrt(intra.reduce((s, m) => s + (m - iMean) ** 2, 0) / Math.max(1, intra.length));
console.log(`  diag: intra-tier margin sigma = ${iSd.toFixed(1)} (n=${intra.length})`);
allOk &= check('7.2 home margin (HCA pts)', meanM, 2.5, 4.0, v => v.toFixed(2));
console.log(`  note: avg total ${((totH + totA) / nGames).toFixed(1)}, home ${(totH / nGames).toFixed(1)} / away ${(totA / nGames).toFixed(1)}`);

const byPos = {};
for (const t of teams) for (const p of t.rost) {
  if (p.s.gp < 10) continue;
  (byPos[p.pos] = byPos[p.pos] || []).push(p.s.pts / p.s.gp);
}
// starter positional scoring (top-5 minutes per team): the fair M10 comparison
const stPos = {};
for (const t of teams) {
  const starters = t.rost.slice().sort((a, b) => b.mins - a.mins).slice(0, 5);
  for (const p of starters) {
    if (p.s.gp < 10) continue;
    (stPos[p.pos] = stPos[p.pos] || []).push(p.s.pts / p.s.gp);
  }
}
console.log('── starter positional scoring (ppg) ──');
for (const pos of POS) {
  const a = stPos[pos] || [];
  const m = a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  console.log(`  ${pos}: ${m.toFixed(1)} ppg (n=${a.length})`);
}
console.log('\n── positional scoring (ppg, min 10 gp) ──');
for (const pos of POS) {
  const a = byPos[pos] || [];
  const m = a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  console.log(`  ${pos}: ${m.toFixed(1)} ppg (n=${a.length})`);
}
let scorLead = 0, astLead = 0, rebLead = 0;
const dblFig = [];
for (const t of teams) {
  let n10 = 0;
  for (const p of t.rost) {
    if (p.s.gp < 10) continue;
    const ppg = p.s.pts / p.s.gp, apg = p.s.ast / p.s.gp, rpg = p.s.reb / p.s.gp;
    if (ppg > scorLead) scorLead = ppg;
    if (apg > astLead) astLead = apg;
    if (rpg > rebLead) rebLead = rpg;
    if (ppg >= 10) n10++;
  }
  dblFig.push(n10);
}
console.log('\n── player lines ──');
allOk &= check('6.1 scoring leader ppg', scorLead, 21, 26, v => v.toFixed(1));
allOk &= check('6.5 assists leader apg', astLead, 8.0, 10.5, v => v.toFixed(1));
allOk &= check('4.4 rebounding leader rpg', rebLead, 11.0, 14.5, v => v.toFixed(1));
allOk &= check('6.4 avg players >=10ppg/team', dblFig.reduce((s, v) => s + v, 0) / dblFig.length, 3.0, 4.2, v => v.toFixed(2));

const paces = aggs.map(a => poss(a) / a.g).sort((x, y) => x - y);
console.log(`\n  pace: min ${paces[0].toFixed(1)} / max ${paces[paces.length - 1].toFixed(1)} / spread ${(paces[paces.length - 1] - paces[0]).toFixed(1)}`);
const efg = (L.fgm + 0.5 * L.tpm) / L.fga;
allOk &= check('3.7 avg eFG%', efg, 0.490, 0.525, v => v.toFixed(3));

console.log(`\n${allOk ? 'ALL CALIBRATION CHECKS PASS' : 'SOME CHECKS FAILED — tuning needed'}`);
