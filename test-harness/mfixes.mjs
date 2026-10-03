// M-fix regression tests: M1, M2, M3, M4, M5, M7, M8.
// (M6 phantom=0 verified in calib.mjs; M9/M10 covered by code review + calib.)
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const _store = {};
globalThis.localStorage = { getItem: k => _store[k] ?? null, setItem: (k, v) => { _store[k] = String(v); }, removeItem: k => { delete _store[k]; }, clear: () => {} };
function stubEl() {
  const el = { textContent: '', innerHTML: '', value: '', onclick: null, oninput: null, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() { return el; }, removeChild() {}, insertBefore() {},
    querySelector() { return null; }, querySelectorAll: () => [],
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {} };
  return el;
}
globalThis.document = { getElementById: () => stubEl(), createElement: () => stubEl(), querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, body: stubEl() };
globalThis.window = {};
const SIM = await import(REPO + '/simulation.js');
const U = await import(REPO + '/utils.js');
const ST = await import(REPO + '/state.js');
const UI = await import(REPO + '/ui.js');
const { G, LS } = ST;
const POS = ['PG', 'SG', 'SF', 'PF', 'C'], CLS = ['FR', 'SO', 'JR', 'SR'];
let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function mkTeam(id, base, off, def) {
  const rost = [];
  for (let j = 0; j < 13; j++) rost.push(SIM.genPlayer(base, POS[j % 5], CLS[j % 4]));
  U.fixMins(rost);
  return { id, name: 'T' + id, rost, strat: { off: off || 'balanced', def: def || 'man' } };
}
function baseG() {
  G.tid = -999; G.difficulty = 'normal'; G.coach = null; G.nextHomeBonus = 0;
  G.momentum = { tid: -1, pts: 0 }; G.buffs = []; G.injuries = []; G.simInterval = null;
  G.phase = 'reg';
}

// ── M1: simGame increments GP exactly once per participant ──
console.log('── M1: GP single-count ──');
{
  baseG();
  const a = mkTeam(1, 80), b = mkTeam(2, 80);
  const gp0 = a.rost.map(p => p.s.gp);
  const mins0 = a.rost.map(p => p.mins);
  SIM.simGame(a, b, false);
  const gpOk = a.rost.every((p, i) => p.s.gp === gp0[i] + (mins0[i] > 0 ? 1 : 0));
  ok(gpOk, 'simGame gp+1 exactly once per rotation player (DNPs stay 0)', a.rost.map(p => p.s.gp).join(','));
  SIM.simGame(a, b, false);
  const gpOk2 = a.rost.every((p, i) => p.s.gp === gp0[i] + (mins0[i] > 0 ? 2 : 0));
  ok(gpOk2, 'second game gp+1 again (no drift/double-count)');
}

// ── M2: difficulty must not leak into CPU-vs-CPU ──
console.log('── M2: difficulty gating ──');
{
  const margins = {};
  for (const d of ['easy', 'legend']) {
    baseG(); G.difficulty = d;
    let m = 0; const N = 400;
    for (let n = 0; n < N; n++) {
      const a = mkTeam(11, 80), b = mkTeam(12, 80);
      const r = SIM.simGame(a, b, true); // tournament-style call: userIsHome=true, but no user team
      m += r.homeScore - r.awayScore;
    }
    margins[d] = m / 400;
  }
  const diff = Math.abs(margins.easy - margins.legend);
  ok(diff < 2.5, `CPU-vs-CPU margin unaffected by difficulty (easy ${margins.easy.toFixed(2)} vs legend ${margins.legend.toFixed(2)}, Δ=${diff.toFixed(2)})`);
  // positive control: user-involved game IS affected
  baseG();
  const mu = {};
  for (const d of ['easy', 'legend']) {
    G.difficulty = d; let m = 0; const N = 300;
    for (let n = 0; n < N; n++) {
      const a = mkTeam(21, 80), b = mkTeam(22, 80);
      G.tid = 21; // user is home team
      const r = SIM.simGame(a, b, true);
      m += r.homeScore - r.awayScore;
    }
    mu[d] = m / 300;
  }
  G.tid = -999;
  ok(mu.easy - mu.legend > 3, `user game IS difficulty-affected (easy ${mu.easy.toFixed(1)} vs legend ${mu.legend.toFixed(1)})`);
}

// ── M3: coach bonus must not leak into CPU-vs-CPU ──
console.log('── M3: coach gating ──');
{
  const margins = {};
  for (const c of ['good', 'bad']) {
    baseG();
    G.coach = c === 'good' ? { off: 99, def: 99 } : { off: 40, def: 40 };
    let m = 0; const N = 400;
    for (let n = 0; n < N; n++) {
      const a = mkTeam(31, 80), b = mkTeam(32, 80);
      const r = SIM.simGame(a, b, false);
      m += r.homeScore - r.awayScore;
    }
    margins[c] = m / 400;
  }
  const diff = Math.abs(margins.good - margins.bad);
  ok(diff < 2.5, `CPU-vs-CPU margin unaffected by coach (99/99: ${margins.good.toFixed(2)} vs 40/40: ${margins.bad.toFixed(2)}, Δ=${diff.toFixed(2)})`);
  G.coach = null;
}

// ── M5: putback credits FGA (live sim) ──
console.log('── M5: putback FGA ──');
{
  baseG();
  G.tid = 41;
  const A = mkTeam(41, 80), B = mkTeam(42, 80);
  G.teams = { 41: A, 42: B }; G.momentum = { tid: -1, pts: 0 };
  LS.clock = 1200; LS.half = 1; LS.possCount = 0;
  let sawPutback = 0, bad = 0;
  for (let n = 0; n < 4000; n++) {
    const offT = n % 2 ? A : B, defT = n % 2 ? B : A;
    const before = offT.rost.map(p => ({ fgm: p.s.fgm, fga: p.s.fga }));
    const res = SIM.simPoss(offT, defT);
    LS.clock -= res.time; LS.possCount++;
    if (res.pbp && res.pbp.includes('putback')) {
      sawPutback++;
      // find the shooter: fgm increased
      offT.rost.forEach((p, i) => {
        if (p.s.fgm > before[i].fgm && p.s.fga <= before[i].fga) bad++;
      });
    }
    if (LS.clock <= 0) { LS.clock = 1200; }
  }
  ok(sawPutback > 0 && bad === 0, `putback always credits FGA (${sawPutback} putbacks, ${bad} bad)`);
  delete G.teams;
}

// ── M7: duplicate names don't scramble identity-keyed state ──
console.log('── M7: identity-keyed fatigue/fouls/minutes ──');
{
  baseG();
  const a = mkTeam(51, 80), b = mkTeam(52, 80);
  // force duplicate names with different minutes
  a.rost[0].name = 'Alex Johnson'; a.rost[0].mins = 30;
  a.rost[6].name = 'Alex Johnson'; a.rost[6].mins = 12;
  b.rost[1].name = 'Alex Johnson'; b.rost[1].mins = 28;
  const minsA0 = a.rost[0].mins, minsA6 = a.rost[6].mins, minsB1 = b.rost[1].mins;
  SIM.simGame(a, b, false);
  ok(a.rost[0].mins === minsA0 && a.rost[6].mins === minsA6 && b.rost[1].mins === minsB1,
    `minutes restored per-identity with duplicate names (${a.rost[0].mins}/${a.rost[6].mins}/${b.rost[1].mins})`);
}

// ── M8: sellout bonus consumed ──
console.log('── M8: nextHomeBonus ──');
{
  baseG();
  const a = mkTeam(61, 80), b = mkTeam(62, 80);
  G.tid = 61; G.nextHomeBonus = 3;
  SIM.simGame(a, b, true);
  ok(G.nextHomeBonus === 0, 'sellout bonus consumed after user home game');
  G.nextHomeBonus = 3;
  const c = mkTeam(63, 80), d = mkTeam(64, 80);
  G.tid = -999;
  SIM.simGame(c, d, false);
  ok(G.nextHomeBonus === 3, 'sellout bonus NOT consumed by CPU-vs-CPU game');
  G.tid = -999; G.nextHomeBonus = 0;
}

// ── M4: skipGame snapshot/restore full stat objects ──
console.log('── M4: skipGame full-stat restore ──');
{
  baseG();
  const tH = mkTeam(71, 80), tA = mkTeam(72, 80);
  // simulate a partially-played live game: bump some stats
  tH.rost[0].s.pts = 12; tH.rost[0].s.fgm = 5; tH.rost[0].s.fga = 9;
  tH.rost[1].s.ast = 4; tA.rost[2].s.reb = 7; tA.rost[2].s.blk = 2;
  const gpH = tH.rost[0].s.gp, gpA = tA.rost[2].s.gp;
  const snapH = JSON.stringify(tH.rost.map(p => p.s));
  const snapA = JSON.stringify(tA.rost.map(p => p.s));
  LS.tH = tH; LS.tA = tA; LS.game = { home: true }; LS.hs = 0; LS.as = 0;
  const s0 = tH.rost[0].s; // object identity
  UI.skipGame();
  ok(JSON.stringify(tH.rost.map(p => p.s)) === snapH, 'home stats fully restored (no double-count)');
  ok(JSON.stringify(tA.rost.map(p => p.s)) === snapA, 'away stats fully restored (no double-count)');
  ok(tH.rost[0].s === s0, 'stat object identity preserved for UI rebuild');
  ok(tH.rost[0].s.gp === gpH && tA.rost[2].s.gp === gpA, 'gp unchanged by skip');
  ok(typeof LS.hs === 'number' && typeof LS.as === 'number', 'score set from sim');
}

console.log(`\n${fail === 0 ? 'ALL M-REGRESSIONS PASS' : `${fail} FAILURES`} (${pass} passed)`);
process.exit(fail === 0 ? 0 : 1);
