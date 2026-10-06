// HOOPS OS — portal battle (3-stage) test
// Proves the staged portal battle works:
//  (a) a low-prestige school can't vacuum the top of the board
//  (b) prestige gradient: high-prestige schools convert better
//  (c) % chances behave sanely; offer validations hold
//  (d) early signings happen sometimes but not always
//  (e) pivot refunds 75% after the Open stage (100% during it)
//  (f) thin board → late entries surface on Signing Day
//  (g) old-save entrants (no suitors/homeState/offer) backfill cleanly
// Usage: node test-harness/portal-pitch-test.mjs
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

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
const B  = await import(REPO + '/views/battle.js');
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
    if (j % 4 === 0) { p.mins = 4; p.morale = 20; } // unhappy enough to enter
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
  G.portalEntrants = []; G.portalStage = 0; G.portalCpuTakes = {}; G.portalUserSigns = 0;
  ST.resetLS();
}
function runFullBattle() {
  P.advancePortalStage(); // → Vibe Check
  P.advancePortalStage(); // → Signing Day
  P.advancePortalStage(); // → finalize
}

// ── (c) % sanity + offer validations ──
console.log('── chance % sanity ──');
freshUniverse(55);
P.genPortalEntrants();
let avail = P.portalBoard().filter(e => e.fromTid !== G.tid);
check(avail.length > 0, 'portal board has entrants', 'n=' + avail.length);
const sample = avail[0];
const ch0 = P.portalChance(sample);
check(ch0.pct >= 1 && ch0.pct <= 99, '% chance within [1,99]', 'pct=' + ch0.pct);
check(ch0.inRace === false, 'not in race before any offer');
check(ch0.suitors.length >= 3 && ch0.suitors.length <= 6, '3-6 suitors per entrant', 'n=' + ch0.suitors.length);
check(ch0.suitors.every(s => s.tid !== G.tid && s.tid !== sample.fromTid),
  'user and old school excluded from suitors');
const cheap = P.portalCost({ ovr: 68 }), pricey = P.portalCost({ ovr: 86 });
check(pricey > cheap, 'reference NIL cost scales with OVR', cheap + ' vs ' + pricey);
// bigger offer → higher %
P.adjustOffer(sample.pid, 10);
const chSmall = P.portalChance(sample);
P.adjustOffer(sample.pid, 90);
const chBig = P.portalChance(sample);
check(chBig.pct >= chSmall.pct, 'bigger offer → higher or equal %', chSmall.pct + '% vs ' + chBig.pct + '%');
check(chBig.inRace === true, 'in race after placing an offer');
// same entrant, higher prestige → higher %
P.adjustOffer(sample.pid, -100); // reset
G.teams[G.tid].schoolPrestige = 90;
P.adjustOffer(sample.pid, 50);
const chHigh = P.portalChance(sample);
P.adjustOffer(sample.pid, -50);
G.teams[G.tid].schoolPrestige = 40;
P.adjustOffer(sample.pid, 50);
const chLow = P.portalChance(sample);
P.adjustOffer(sample.pid, -50);
G.teams[G.tid].schoolPrestige = 55;
check(chHigh.pct > chLow.pct, 'higher prestige → higher %', chLow.pct + '% vs ' + chHigh.pct + '%');

console.log('── offer validations ──');
G.pts = 5;
check(P.adjustOffer(sample.pid, 10) === false, 'offer refused with insufficient NIL');
G.pts = 10000;
const ownE = P.portalBoard().find(e => e.fromTid === G.tid);
if (ownE) check(P.adjustOffer(ownE.pid, 10) === false, "can't offer your own transfer");
check(P.adjustOffer(sample.pid, -10) === false, "can't withdraw below zero");
check(P.pivotOffer(sample.pid) === false, "can't pivot with no offer");

// ── (e) pivot refunds ──
console.log('── pivot refunds ──');
freshUniverse(55);
P.genPortalEntrants();
const pe = P.portalBoard().filter(e => e.fromTid !== G.tid)[0];
G.pts = 1000;
P.adjustOffer(pe.pid, 100); // stage 0: full refund
const ptsAfterAdd = G.pts;
P.adjustOffer(pe.pid, -100);
check(G.pts === ptsAfterAdd + 100, 'full refund when pulling out during Open stage',
  'pts=' + G.pts + ' expected=' + (ptsAfterAdd + 100));
P.adjustOffer(pe.pid, 100);
P.advancePortalStage(); // → Vibe Check (stage 1): 25% sunk
const beforePivot = G.pts;
P.pivotOffer(pe.pid);
const refunded = G.pts - beforePivot;
if (pe.pickedBy === G.tid) console.log('  (skip: he committed to you early, nothing to refund)');
else check(refunded === 75, 'pivot after Open stage refunds 75%', 'refunded=' + refunded);
check((pe.offer || 0) === 0, 'offer zeroed after pivot');

// ── (d) early signings: sometimes, not always ──
console.log('── early signing frequency ──');
let earlyTrials = 0, earlyUserSigns = 0, earlyCpuSigns = 0;
for (let t = 0; t < 24; t++) {
  freshUniverse(70);
  P.genPortalEntrants();
  const top3 = P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 3);
  for (const e of top3) P.adjustOffer(e.pid, 120);
  const signsBefore = G.portalUserSigns || 0;
  const cpuBefore = Object.keys(G.portalCpuTakes || {}).length;
  P.advancePortalStage(); // early round 1
  earlyUserSigns += (G.portalUserSigns || 0) - signsBefore;
  earlyCpuSigns += Object.keys(G.portalCpuTakes || {}).length - cpuBefore;
  earlyTrials++;
}
console.log('    early user signs: ' + earlyUserSigns + '/' + (earlyTrials * 3)
  + ' · early CPU signs: ' + earlyCpuSigns);
check(earlyUserSigns > 0, 'early signings happen sometimes', 'n=' + earlyUserSigns);
check(earlyUserSigns < earlyTrials * 3, 'not every target signs early',
  earlyUserSigns + '/' + (earlyTrials * 3));

// ── (a)+(b) prestige gradient on the real universe ──
console.log('── low-prestige top-5 conversion (real universe) ──');
const mkCoach = () => ({ firstName: 'T', lastName: 'C', age: 40, off: 70, def: 70, dev: 70, rec: 70,
  xp: 0, level: 1, careerWins: 20, careerLoss: 10, tenure: 2, hotSeat: false,
  titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0, awards: [], history: [] });
function battleTrials(userPrestige, trials) {
  let signs = 0, att = 0;
  for (let t = 0; t < trials; t++) {
    S.buildUniverse();
    G.tid = 0; G.yr = 2025; G.pts = 10000; G.gi = 29; G.phase = 'reg';
    G.coach = mkCoach();
    G.teams[0].schoolPrestige = userPrestige;
    G.portalEntrants = []; G.portalStage = 0; G.portalCpuTakes = {}; G.portalUserSigns = 0;
    G.offseasonStep = 'portal';
    P.genPortalEntrants();
    const top5 = P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 5);
    for (const e of top5) { P.adjustOffer(e.pid, 100); att++; }
    runFullBattle();
    signs += (G.portalUserSigns || 0);
  }
  return { signs, att };
}
const lo = battleTrials(50, 24);
const loRate = lo.signs / lo.att;
console.log('    prestige-50: ' + lo.signs + '/' + lo.att + ' (' + (loRate * 100).toFixed(1) + '%)');
check(lo.att > 50, 'enough battle trials ran', 'att=' + lo.att);
check(loRate < 0.45, 'low-prestige school wins well under half of top-5 battles',
  (loRate * 100).toFixed(1) + '%');
const hi = battleTrials(90, 24);
const hiRate = hi.signs / hi.att;
console.log('    prestige-90: ' + hi.signs + '/' + hi.att + ' (' + (hiRate * 100).toFixed(1) + '%)');
check(hiRate > loRate, 'prestige gradient: 90-prestige converts better than 50-prestige',
  (loRate * 100).toFixed(1) + '% vs ' + (hiRate * 100).toFixed(1) + '%');

// ── (f) thin board → late entries ──
console.log('── thin board late entries ──');
freshUniverse(55);
P.genPortalEntrants();
G.portalUserSigns = 0; // thin: nothing signed, nothing pursued
G.portalStage = 1;
P.advancePortalStage(); // → Signing Day triggers maybeLatePortalEntries
const lates = P.portalBoard().filter(e => e.late);
check(lates.length >= 1 && lates.length <= 2, '1-2 late entries surface on thin board',
  'n=' + lates.length);

// ── (g) old-save backfill ──
console.log('── old-save entrant backfill ──');
freshUniverse(55);
G.portalEntrants = [{
  pid: 4242, name: 'OldTimer', pos: 'SG', ovr: 78, pot: 80, cls: 'JR',
  fromTid: 5, fromName: 'Team5', mins: 12, sht: 78, fin: 78, def: 78, reb: 78, ply: 78,
  reason: 'Playing time', pickedBy: -1
  // NOTE: no suitors, no homeState, no offer — pre-battle save
}];
let threw = false, chOld = null;
try {
  const b = P.portalBoard();
  chOld = P.portalChance(b[0]);
  P.adjustOffer(b[0].pid, 10);
} catch (err) { threw = true; console.log('    threw: ' + err.message); }
check(!threw, 'old entrants work without crashing');
check(chOld && chOld.suitors.length >= 3 && typeof chOld.pct === 'number',
  'suitors + homeState + offer backfilled on old entrants');

// ── roster sanity after a full battle ──
console.log('── roster sanity ──');
freshUniverse(60);
P.genPortalEntrants();
const some = P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 6);
some.forEach(e => P.adjustOffer(e.pid, 40));
runFullBattle();
let badRoster = 0, dupPortal = 0;
G.teams.forEach(tm => {
  if (tm.rost.length > 15) badRoster++;
  // Unclaimed entrants stay flagged until the offseason's global CPU pass
  // (resolvePortalCPU) — only a flag with no pending entrant is a leak.
  tm.rost.forEach(p => { if (p._portalPid && !(G.portalEntrants || []).some(e => e.pid === p._portalPid && e.pickedBy === -1)) dupPortal++; });
});
check(badRoster === 0, 'no roster exceeds 15 after full battle', 'bad=' + badRoster);
check(dupPortal === 0, 'no _portalPid flags leak onto rosters', 'leaked=' + dupPortal);
check(G.offseasonStep === 'recruiting', 'battle ends by advancing to recruiting');

console.log('\n' + (failures ? failures + ' FAILURES' : 'ALL PASS'));
process.exit(failures ? 1 : 0);
