// HOOPS OS — portal pitch competition test
// Proves the transfer portal is no longer a free supermarket:
//  (a) a low-prestige school can't reliably land top-5 OVR entrants
//  (b) top entrants disproportionately land at high-prestige schools
//  (c) user pitch % chances behave sanely
//  (d) old-save entrants (no suitors/homeState) backfill cleanly
// Usage: node test-harness/portal-pitch-test.mjs
const REPO = '/home/hatch/workspace/bballproj';

const _store = {};
globalThis.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
  clear: () => { for (const k in _store) delete _store[k]; },
};
const _els = {};
function stubEl() {
  return { textContent: '', innerHTML: '', value: '', onclick: null, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, insertBefore() {},
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {} };
}
globalThis.document = {
  getElementById: id => (_els[id] || (_els[id] = stubEl())),
  createElement: () => stubEl(), querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, body: stubEl(), head: stubEl(),
};
globalThis.window = {};

const S  = await import(REPO + '/season.js');
const ST = await import(REPO + '/state.js');
const U  = await import(REPO + '/utils.js');
const R  = await import(REPO + '/views/recruiting.js');
const P  = await import(REPO + '/views/portal.js');
const { G } = ST;

S.registerSeasonCallbacks({ addLog(){}, updateAll(){}, navTo(){}, toast(){}, startConfTourney(){}, playTournamentGame(){}, openModal(){} });
R.registerRecruitingCallbacks({ toast(){}, addLog(){}, updateAll(){} });
globalThis.window._genRecruits = S.genRecruits;

let failures = 0;
function check(cond, name, detail) {
  if (cond) { console.log('  ok: ' + name); }
  else { failures++; console.log('  FAIL: ' + name + (detail ? ' — ' + detail : '')); }
}

const POSA = ['PG','SG','SF','PF','C'], CLSA = ['FR','SO','JR','SR'];
let _pn = 0;
function mkPlayer(ovr, pos, cls) {
  const p = { name: 'T' + (_pn++), pos, cls, mins: 0,
    sht: ovr, fin: ovr, def: ovr, reb: ovr, ply: ovr, s: U.freshS(), morale: 50 };
  p.ovr = U.getOvr(p); p.pot = Math.min(99, p.ovr + 6);
  return p;
}
function mkTeam(id, name, conf, prestige, baseOvr) {
  const rost = [];
  for (let j = 0; j < 13; j++) {
    const p = mkPlayer(baseOvr + ((j * 7 + id) % 9) - 4, POSA[j % 5], j < 3 ? 'SR' : CLSA[(j + id) % 4]);
    // make some rotation players unhappy enough to enter the portal
    if (j % 4 === 0) { p.mins = 4; p.morale = 20; }
    rost.push(p);
  }
  U.fixMins(rost);
  return { id, name, conf, schoolPrestige: prestige, baseOvr, rost,
    wins: 0, loss: 0, cWins: 0, cLoss: 0, pts: baseOvr * 10, sched: [], streak: 0,
    ts: { pts: 0, opp: 0, fgm: 0, fga: 0, games: 0 },
    coach: { firstName: 'CPU', lastName: 'C' + id, age: 50, off: 70, def: 70, dev: 70, rec: 70, tenure: 3 } };
}
function freshUniverse(userPrestige) {
  _pn = 0; G.teams = [];
  for (let i = 0; i < 14; i++) {
    G.teams.push(mkTeam(i, 'Team' + i, i % 2 ? 'W' : 'E',
      i === 0 ? userPrestige : 30 + ((i * 37) % 65), 65 + ((i * 13) % 20)));
  }
  G.tid = 0; G.yr = 2025; G.gi = 29; G.wk = 20; G.pts = 10000;
  G.phase = 'reg'; G.difficulty = 'normal';
  G.bracket = []; G.confTourneys = {}; G.confTitles = 0; G.championships = 0;
  G.logs = []; G.history = []; G.leagueChamps = [];
  G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0; G.recruitTargets = [];
  G.departingPlayers = []; G.offseasonStep = 'portal';
  G.injuries = []; G.buffs = []; G.nextHomeBonus = 0; G.momentum = { tid: -1, pts: 0 }; G.prestige = 3;
  G.coach = { firstName: 'T', lastName: 'C', age: 40, off: 70, def: 70, dev: 70, rec: 70,
    xp: 0, level: 1, careerWins: 20, careerLoss: 10, tenure: 2, hotSeat: false,
    titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0, awards: [], history: [] };
  G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };
  G.expectations = null; G.skillPointsEarned = 3; G.skillPointsToSpend = 3;
  G.portalEntrants = []; G.portalPicksLeft = 0;
  ST.resetLS();
}

// ── (c) % chances behave sanely ──
console.log('── pitch % sanity ──');
freshUniverse(55);
P.genPortalEntrants();
let avail = P.portalBoard().filter(e => e.fromTid !== G.tid);
check(avail.length > 0, 'portal board has entrants', 'n=' + avail.length);
const sample = avail[0];
const ch = P.portalChance(sample);
check(ch.pct >= 1 && ch.pct <= 99, '% chance within [1,99]', 'pct=' + ch.pct);
check(ch.cost > 0 && Number.isFinite(ch.cost), 'NIL cost positive', 'cost=' + ch.cost);
check(ch.suitors.length >= 3 && ch.suitors.length <= 6, '3-6 suitors per entrant', 'n=' + ch.suitors.length);
check(ch.suitors.every(s => s.tid !== G.tid && s.tid !== sample.fromTid),
  'user and old school excluded from suitors');
const cheap = P.portalCost({ ovr: 68 }), pricey = P.portalCost({ ovr: 86 });
check(pricey > cheap, 'NIL cost scales with OVR', cheap + ' vs ' + pricey);
// same entrant, higher prestige → higher %
G.teams[G.tid].schoolPrestige = 90;
const chHigh = P.portalChance(sample);
G.teams[G.tid].schoolPrestige = 40;
const chLow = P.portalChance(sample);
check(chHigh.pct > chLow.pct, 'higher prestige → higher %', chLow.pct + '% vs ' + chHigh.pct + '%');
G.teams[G.tid].schoolPrestige = 55;
// pitch validations
G.portalPicksLeft = 0;
check(P.portalPitch(sample.pid) === false, 'pitch refused with no pitches left');
G.portalPicksLeft = 2; G.pts = 0;
check(P.portalPitch(sample.pid) === false, 'pitch refused with insufficient NIL');
G.pts = 10000;
const ownE = P.portalBoard().find(e => e.fromTid === G.tid);
if (ownE) check(P.portalPitch(ownE.pid) === false, "can't pitch your own transfer");

// ── (d) old-save backfill ──
console.log('── old-save entrant backfill ──');
freshUniverse(55);
G.portalEntrants = [{
  pid: 4242, name: 'OldTimer', pos: 'SG', ovr: 78, pot: 80, cls: 'JR',
  fromTid: 5, fromName: 'Team5', mins: 12, sht: 78, fin: 78, def: 78, reb: 78, ply: 78,
  reason: 'Playing time', pickedBy: -1
  // NOTE: no suitors, no homeState — pre-pitch-competition save
}];
let threw = false, chOld = null;
try {
  const b = P.portalBoard();
  chOld = P.portalChance(b[0]);
} catch (err) { threw = true; console.log('    threw: ' + err.message); }
check(!threw, 'old entrants render/pitch-chance without crashing');
check(chOld && chOld.suitors.length >= 3 && typeof chOld.pct === 'number',
  'suitors + homeState backfilled on old entrants');

// ── (a) low-prestige school can't vacuum the top of the board ──
console.log('── low-prestige top-5 conversion ──');
let attempts = 0, wins = 0;
const TRIALS = 40;
for (let tI = 0; tI < TRIALS; tI++) {
  freshUniverse(50);
  P.genPortalEntrants();
  const top5 = P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 5);
  for (const e of top5) {
    G.portalPicksLeft = 10; G.pts = 10000;
    const before = G.teams[G.tid].rost.length;
    if (P.portalPitch(e.pid)) {
      attempts++;
      if (G.teams[G.tid].rost.length > before) wins++;
    }
  }
}
const rate = attempts ? wins / attempts : 0;
console.log('    prestige-50 user: ' + wins + '/' + attempts + ' top-5 pitches won (' + (rate * 100).toFixed(1) + '%)');
check(attempts > 50, 'enough pitch trials ran', 'attempts=' + attempts);
check(rate < 0.45, 'low-prestige school wins well under half of top-5 pitches', (rate * 100).toFixed(1) + '%');

// ── (b) top entrants land at prestigious programs ──
// Measured on the REAL 365-team universe: elite entrants only draw suitors
// from the top 25 programs, so the prestige gradient should be stark.
console.log('── suitor resolution prestige gradient (real universe) ──');
let topPrest = [], restPrest = [];
const BTRIALS = 10;
const mkCoach = () => ({ firstName: 'T', lastName: 'C', age: 40, off: 70, def: 70, dev: 70, rec: 70,
  xp: 0, level: 1, careerWins: 20, careerLoss: 10, tenure: 2, hotSeat: false,
  titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0, awards: [], history: [] });
for (let tI = 0; tI < BTRIALS; tI++) {
  S.buildUniverse();
  G.tid = 0; G.yr = 2025; G.pts = 10000; G.coach = mkCoach();
  const donorTeam = G.teams[200];
  // thin out some low-prestige rosters so mediocre transfers have somewhere to go
  G.teams.forEach(tm => { if ((tm.schoolPrestige || 50) < 40 && tm.id !== G.tid) tm.rost = tm.rost.slice(0, 11); });
  G.portalEntrants = [];
  for (let i = 0; i < 16; i++) {
    const ovr = i < 8 ? 86 : 70;
    G.portalEntrants.push({
      pid: 7000 + i, name: 'Pool' + tI + '_' + i, pos: POSA[i % 5], ovr, pot: ovr + 2,
      cls: 'JR', fromTid: donorTeam.id, fromName: donorTeam.name, mins: 10,
      sht: ovr, fin: ovr, def: ovr, reb: ovr, ply: ovr,
      reason: 'Playing time', pickedBy: -1
    });
  }
  P.resolvePortalCPU();
  G.teams.forEach(tm => {
    tm.rost.forEach(p => {
      if (p.transfer && p.name.indexOf('Pool' + tI + '_') === 0) {
        if (p.ovr >= 84) topPrest.push(tm.schoolPrestige || 50);
        else restPrest.push(tm.schoolPrestige || 50);
      }
    });
  });
}
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const mTop = mean(topPrest), mRest = mean(restPrest);
console.log('    elite-transfer landing prestige: ' + mTop.toFixed(1) + ' (n=' + topPrest.length + ')'
  + ' vs mediocre: ' + mRest.toFixed(1) + ' (n=' + restPrest.length + ')');
check(topPrest.length > 20, 'elite transfers landed somewhere', 'n=' + topPrest.length);
check(mTop > mRest + 8, 'elite transfers land at more prestigious schools', mTop.toFixed(1) + ' vs ' + mRest.toFixed(1));

// ── resolution leaves rosters sane ──
console.log('── roster sanity after resolution ──');
freshUniverse(60);
P.genPortalEntrants();
P.resolvePortalCPU();
let badRoster = 0;
G.teams.forEach(tm => { if (tm.rost.length > 15) badRoster++; });
check(badRoster === 0, 'no roster exceeds 15 after CPU resolution', 'bad=' + badRoster);

console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
