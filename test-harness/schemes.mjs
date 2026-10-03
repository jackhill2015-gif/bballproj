// Scheme effect verification: each scheme must produce its identity.
// Also: per-player usage slider test (star 35 vs 15).
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const _store = {};
globalThis.localStorage = { getItem: k => _store[k] ?? null, setItem: (k, v) => { _store[k] = String(v); }, removeItem: k => { delete _store[k]; }, clear: () => {} };
function stubEl() { return { textContent: '', innerHTML: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, appendChild() {}, remove() {}, querySelector() { return null; }, querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, removeEventListener() {}, click() {} }; }
globalThis.document = { getElementById: () => stubEl(), createElement: () => stubEl(), querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, body: stubEl() };
globalThis.window = {};
const SIM = await import(REPO + '/simulation.js');
const U = await import(REPO + '/utils.js');
const ST = await import(REPO + '/state.js');
const { G } = ST;
const POS = ['PG', 'SG', 'SF', 'PF', 'C'], CLS = ['FR', 'SO', 'JR', 'SR'];
G.tid = -999; G.difficulty = 'normal'; G.coach = null; G.nextHomeBonus = 0;
G.momentum = { tid: -1, pts: 0 }; G.buffs = []; G.injuries = [];

let uid = 0;
function mkTeam(base, off, def) {
  const rost = [];
  for (let j = 0; j < 13; j++) rost.push(SIM.genPlayer(base, POS[j % 5], CLS[j % 4]));
  U.fixMins(rost);
  return { id: 5000 + (uid++), name: 'T' + uid, rost, strat: { off, def } };
}
function reset(t) { for (const p of t.rost) p.s = U.freshS(); }
function agg(t) {
  const o = { pts: 0, fga: 0, tpa: 0, fta: 0, to: 0, reb: 0, oreb: 0, g: 0 };
  for (const p of t.rost) {
    o.pts += p.s.pts; o.fga += p.s.fga; o.tpa += (p.s.tpa || 0); o.fta += (p.s.fta || 0);
    o.to += (p.s.to || 0); o.reb += p.s.reb; o.oreb += (p.s.oreb || 0); o.g = p.s.gp;
  }
  return o;
}
function posPts(t) {
  const o = {};
  for (const p of t.rost) { o[p.pos] = (o[p.pos] || 0) + p.s.pts; }
  const g = t.rost[0].s.gp || 1;
  for (const k in o) o[k] = (o[k] / g).toFixed(1);
  return o;
}

// ── Test 1: offensive scheme identities (vs balanced/man opponent) ──
console.log('── OFFENSIVE SCHEMES (200 games each vs balanced/man, base 80) ──');
for (const off of ['balanced', 'motion', 'drive', 'set', 'early']) {
  const A = mkTeam(80, off, 'man');
  const poss = [], ppa = [];
  let pgShare = 0, bigPts = 0, totPts = 0;
  for (let n = 0; n < 200; n++) {
    const B = mkTeam(80, 'balanced', 'man');
    const r = SIM.simGame(A, B, n % 2 === 0);
    const a = agg(A);
    poss.push(a.fga - a.oreb + a.to + 0.44 * a.fta);
    ppa.push(a.tpa / Math.max(1, a.fga));
    const pp = posPts(A);
    pgShare += parseFloat(pp.PG) / (parseFloat(pp.PG) + parseFloat(pp.SG) + parseFloat(pp.SF) + parseFloat(pp.PF) + parseFloat(pp.C));
    bigPts += parseFloat(pp.PF) + parseFloat(pp.C);
    totPts += a.pts;
    reset(A); reset(B);
  }
  const avg = arr => (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);
  console.log(`${off.padEnd(9)} poss=${avg(poss)}  3PAshare=${(ppa.reduce((s,v)=>s+v,0)/ppa.length).toFixed(2)}  PG share=${(pgShare/200).toFixed(2)}  PF+C ppg=${(bigPts/200).toFixed(1)}  PPG=${(totPts/200).toFixed(1)}`);
}

// ── Test 2: defensive scheme identities ──
console.log('\n── DEFENSIVE SCHEMES (opp balanced/base80; 200 games) ──');
for (const def of ['man', '2-3', '3-2', '1-3-1', 'box1']) {
  let o3pa = 0, o3pm = 0, ofga = 0, ofgm = 0, oto = 0, orim = 0;
  let starPPG = 0, games = 0;
  for (let n = 0; n < 200; n++) {
    const A = mkTeam(80, 'balanced', def);
    const B = mkTeam(80, 'balanced', 'man');
    SIM.simGame(n % 2 === 0 ? A : B, n % 2 === 0 ? B : A, false);
    const o = n % 2 === 0 ? agg(B) : agg(A); // opponent's offense
    o3pa += o.tpa; o3pm += 0; ofga += o.fga; ofgm += 0; oto += o.to;
    // opponent 3P% and rim%: approximate via team totals is hard; use TO + star
    const opp = n % 2 === 0 ? B : A;
    let star = null;
    for (const p of opp.rost) if (p.mins > 0 && (!star || p.ovr > star.ovr)) star = p;
    starPPG += star.s.pts / Math.max(1, star.s.gp);
    games++;
    reset(A); reset(B);
  }
  console.log(`${def.padEnd(6)} opp 3PA/gm=${(o3pa/games).toFixed(1)}  opp TO/gm=${(oto/games).toFixed(1)}  opp star ppg=${(starPPG/games).toFixed(1)}`);
}

// ── Test 3: usage slider (SAME team, star usage 35 vs 15) ──
console.log('\n── USAGE SLIDER (same team, star usage 35 vs 15; 150 games each) ──');
{
  const A = mkTeam(84, 'balanced', 'man');
  const starters = A.rost.slice().sort((a, b) => b.mins - a.mins).slice(0, 5);
  const star = starters.slice().sort((a, b) => b.ovr - a.ovr)[0];
  for (const u of [35, 15]) {
    star.usage = u;
    for (const p of A.rost) p.s = U.freshS(); // reset A's stats
    let starPts = 0, teamPts = 0, teamFGA = 0, g = 0;
    for (let n = 0; n < 150; n++) {
      const B = mkTeam(80, 'balanced', 'man');
      SIM.simGame(A, B, n % 2 === 0);
      g++;
    }
    for (const p of A.rost) { teamPts += p.s.pts; teamFGA += p.s.fga; }
    starPts = star.s.pts;
    console.log(`usage=${u}: star ${star.pos} (ovr ${star.ovr}) ppg=${(starPts/g).toFixed(1)}  team ppg=${(teamPts/g).toFixed(1)}  team FGA/gm=${(teamFGA/g).toFixed(1)}`);
  }
  console.log(`(star is ${star.name}, ${star.pos}; expect: star ppg visibly higher at 35, team ppg/FGA roughly flat)`);
}
console.log('(expect: star ppg visibly higher at 35, team ppg/FGA roughly flat)');
