// HOOPS OS — R1..R9 regression test (recruiting / carousel / portal)
// Usage: node test-harness/r-test.mjs
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── browser shims ──
const _store = {};
globalThis.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
  clear: () => { for (const k in _store) delete _store[k]; },
};
const _els = {};
function stubEl() {
  const el = {
    textContent: '', innerHTML: '', value: '', onclick: null, oninput: null,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, insertBefore() {},
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {},
  };
  return el;
}
globalThis.document = {
  getElementById: id => (_els[id] || (_els[id] = stubEl())),
  createElement: () => stubEl(),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {},
  body: stubEl(), head: stubEl(),
};
globalThis.window = {};

const S  = await import(REPO + '/season.js');
const ST = await import(REPO + '/state.js');
const U  = await import(REPO + '/utils.js');
const R  = await import(REPO + '/views/recruiting.js');
const P  = await import(REPO + '/views/portal.js');
const { G, SetupState } = ST;

S.registerSeasonCallbacks({ addLog(){}, updateAll(){}, navTo(){}, toast(){},
  startConfTourney(){}, playTournamentGame(){}, openModal(){} });
R.registerRecruitingCallbacks({ toast(){}, addLog(){}, updateAll(){} });
globalThis.window._genRecruits = S.genRecruits;

let failures = 0;
function check(cond, name, detail) {
  if (cond) { console.log('  ok: ' + name); }
  else { failures++; console.log('  FAIL: ' + name + (detail ? ' — ' + detail : '')); }
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// ── setup: fresh universe, user team with a played season ──
// ── setup: minimal fake universe (14 teams / 2 confs).
// NOTE: S.buildUniverse() is currently broken by another agent's uncommitted
// utils.js change (pick(['balanced',...]) passes strings to a function-array
// picker → TypeError). Fake teams exercise all R1-R9 paths without it.
const SIM = await import(REPO + '/simulation.js');
const POSA = ['PG','SG','SF','PF','C'], CLSA = ['FR','SO','JR','SR'];
let _pn = 0;
function mkPlayer(ovr, pos, cls) {
  const p = { name: 'TestPlayer' + (_pn++), pos, cls, mins: 0,
    sht: ovr, fin: ovr, def: ovr, reb: ovr, ply: ovr, s: U.freshS() };
  p.ovr = U.getOvr(p); p.pot = Math.min(99, p.ovr + 6);
  return p;
}
function mkTeam(id, name, conf, prestige, baseOvr) {
  const rost = [];
  for (let j = 0; j < 13; j++) {
    rost.push(mkPlayer(baseOvr + ((j * 7 + id) % 9) - 4, POSA[j % 5], j < 3 ? 'SR' : CLSA[(j + id) % 4]));
  }
  U.fixMins(rost);
  return { id, name, conf, schoolPrestige: prestige, baseOvr, rost,
    wins: 0, loss: 0, cWins: 0, cLoss: 0, pts: baseOvr * 10, sched: [], streak: 0,
    ts: { pts: 0, opp: 0, fgm: 0, fga: 0, games: 0 },
    coach: { firstName: 'CPU', lastName: 'Coach' + id, age: 50, off: 70, def: 70, dev: 70, rec: 70, tenure: 3 } };
}
G.teams = [];
for (let i = 0; i < 14; i++) {
  G.teams.push(mkTeam(i, 'Team' + i, i % 2 ? 'Test West' : 'Test East', 30 + ((i * 37) % 65), 65 + ((i * 13) % 20)));
}
G.tid = 0; G.yr = 2025; G.gi = 29; G.wk = 20; G.pts = 120;
G.phase = 'reg'; G.difficulty = 'normal';
G.bracket = []; G.confTourneys = {}; G.confTitles = 0; G.championships = 0;
G.logs = []; G.history = []; G.leagueChamps = [];
G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0; G.recruitTargets = [];
G.departingPlayers = []; G.offseasonStep = 'turnover';
G.injuries = []; G.buffs = []; G.nextHomeBonus = 0;
G.momentum = { tid: -1, pts: 0 };
G.prestige = 3;
G.coach = { firstName: 'Test', lastName: 'Coach', age: 40, off: 70, def: 70, dev: 70, rec: 70,
  xp: 0, level: 1, careerWins: 20, careerLoss: 10, tenure: 2, hotSeat: false,
  titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0, awards: [], history: [] };
G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };
G.expectations = null; G.skillPointsEarned = 3; G.skillPointsToSpend = 3;
ST.resetLS();
S.genRecruits();

console.log('── R9/R1: turnover → portal step ──');
S.beginOffseason();
check(G.offseasonStep === 'skillpoints', 'beginOffseason routes to skillpoints');
// skillpoints → carousel (finishSkillPoints)
R.finishSkillPoints();
check(G.offseasonStep === 'carousel', 'finishSkillPoints routes to carousel');
R.stayAtSchool();
check(G.offseasonStep === 'turnover', 'stayAtSchool routes to turnover');
// turnover → portal via proceedToRecruiting
const userRosterBefore = G.teams[G.tid].rost.length;
R.proceedToRecruiting();
check(G.offseasonStep === 'portal', 'proceedToRecruiting now routes to portal (R9)');
check(Array.isArray(G.portalEntrants) && G.portalEntrants.length > 0,
  'portal entrants generated', 'count=' + (G.portalEntrants || []).length);
check(G.portalStage === 0, 'portal battle starts at stage 0 (Open)');
check(G.portalEntrants.every(e => isNum(e.pid) && isNum(e.ovr) && isNum(e.fromTid) && e.name && e.pos),
  'entrant records have name/pos/ovr/old school, no NaN');
check(G.portalEntrants.length <= P.PORTAL_MAX_ENTRANTS, 'entrant cap respected');

console.log('── R9: user portal battle (3-stage offers) ──');
G.pts = 500; // afford any offer
const board = P.portalBoard().filter(e => e.fromTid !== G.tid);
check(board.length > 0, 'board has available transfers');
const pick1 = board[0], pick2 = board[1];
const p1from = pick1.fromTid, p1name = pick1.name;
const beforeLen = G.teams[p1from].rost.length;
const ch1 = P.portalChance(pick1);
check(ch1.pct >= 1 && ch1.pct <= 99 && ch1.suitors.length >= 3 && ch1.inRace === false,
  'chance shows sane % and suitors; not in race before offering', 'pct=' + ch1.pct);
check(P.adjustOffer(pick1.pid, 50) === true, 'offer 1 placed (NIL escrowed)');
check(P.adjustOffer(pick2.pid, 30) === true, 'offer 2 placed (NIL escrowed)');
check(P.portalChance(pick1).inRace === true, 'in race after placing an offer');
check(G.pts === 500 - 80, 'NIL escrowed up front', 'pts=' + G.pts);
// run the full 3-stage battle to resolution
P.advancePortalStage(); // → Vibe Check
check(G.portalStage === 1, 'battle advances to stage 1 (Vibe Check)');
P.advancePortalStage(); // → Signing Day
check(G.portalStage === 2, 'battle advances to stage 2 (Signing Day)');
P.advancePortalStage(); // → finalize → recruiting
check(G.offseasonStep === 'recruiting', 'finalize routes to recruiting');
check(!G.portalEntrants.some(e => e.pid === pick1.pid), 'offered entrant leaves the pool');
const onUser = G.teams[G.tid].rost.some(p => p.name === p1name);
const onCpu = G.teams.some(tm => tm.id !== G.tid && tm.rost.some(p => p.name === p1name));
const stayed = G.teams[p1from].rost.some(p => p.name === p1name);
check(onUser || onCpu || stayed, 'offered entrant landed somewhere or stayed put');
check(G.teams[p1from].rost.length <= beforeLen, 'old roster never grows from the portal');
check(Number.isFinite(G.pts) && G.pts <= 500, 'NIL accounting sane after battle', 'pts=' + G.pts);
let leaked = 0;
G.teams.forEach(tm => tm.rost.forEach(p => { if (p._portalPid) leaked++; }));
check(leaked === 0, 'no _portalPid flags leak after battle', 'leaked=' + leaked);

console.log('── R9: portal → recruiting via doPlay router ──');
S.doPlay('sim');
check(G.offseasonStep === 'recruiting', 'doPlay portal branch advances to recruiting');

console.log('── R1: recruiting phases — signed stores team id ──');
// invest points in a few recruits
R.renderOffseason(); // initRecruitingIfNeeded
const open = G.recruits.filter(r => r.status === 'open').slice(0, 12);
open.forEach((r, i) => R.adjustPoints(r.id, 5 + (i % 3) * 5));
R.advanceRecruitPhase();
R.advanceRecruitPhase();
const gone = G.recruits.filter(r => r.status === 'gone' && r.signed >= 0);
check(gone.length > 0, 'CPU signees exist', 'count=' + gone.length);
const badSigned = gone.filter(r => !G.teams[r.signed] || G.teams[r.signed].id !== r.signed);
check(badSigned.length === 0, 'R1: every CPU signee signed = valid team id (not rank)', 'bad=' + badSigned.length);
const nameMismatch = gone.filter(r => r.goneTo && G.teams[r.signed] && G.teams[r.signed].name !== r.goneTo);
check(nameMismatch.length === 0, 'R1: goneTo matches the signed team name', 'bad=' + nameMismatch.length);

console.log('── R5: board capped at 30 rows ──');
R.renderOffseason();
const html = _els['offseason-content'].innerHTML;
const rows = (html.match(/data-rid="/g) || []).length;
check(rows <= 30 && rows === 30, 'board renders exactly 30 rows w/ show-more', 'rows=' + rows);
check(html.indexOf('data-show-more') >= 0, 'show-more button present');
R.showMoreBoard();
const html2 = _els['offseason-content'].innerHTML;
const rows2 = (html2.match(/data-rid="/g) || []).length;
check(rows2 === 60, 'show-more adds 30 rows', 'rows=' + rows2);

console.log('── doOffseason: R2 signees join, R6 class cap, R9 portal before walk-ons ──');
// Finalize signings first so the snapshot sees exactly what doOffseason will
// (idempotent — doOffseason's internal call becomes a no-op). Tag CPU signees
// with a unique marker that survives the JSON deep-copy onto rosters.
window.resolveRecruitingClass();
let _tagN = 0;
const _expected = {};
G.recruits.forEach(r => {
  if (r.status === 'gone' && r.signed >= 0 && r.signed !== G.tid) {
    r._testTag = 'sig' + (_tagN++);
    (_expected[r.signed] || (_expected[r.signed] = [])).push(r._testTag);
  }
});
S.doOffseason();
check(G.phase === 'reg', 'new season started');
// R2: signees on correct CPU rosters (lower bound: min(n, cap 8, roster room))
let r2ok = true;
Object.keys(_expected).forEach(tid => {
  const tm = G.teams[+tid];
  const tags = _expected[tid];
  const added = tm.rost.filter(p => p._testTag && tags.indexOf(p._testTag) >= 0).length;
  const bound = Math.min(tags.length, 8, Math.max(0, 15 - tm.rost.length));
  if (added < bound) {
    r2ok = false;
    console.log('    R2 shortfall: ' + tm.name + ' n=' + tags.length + ' added=' + added + ' bound=' + bound + ' finalLen=' + tm.rost.length);
  }
});
check(r2ok, 'R2: CPU signees joined their rosters (within cap/room)');
// R1 regression on rosters: recruit-sourced players (deep copy keeps signed/stars) sit on the signing team
let wrongTeam = 0;
G.teams.forEach(tm => {
  tm.rost.forEach(p => {
    if (p.stars !== undefined && p.signed !== tm.id) wrongTeam++;
  });
});
check(wrongTeam === 0, 'R1: no recruit-sourced player on the wrong roster', 'wrong=' + wrongTeam);
// R6: class-size cap
const userClass = G.teams[G.tid].rost.filter(p => p.cls === 'FR' && p.stars !== undefined).length;
check(userClass <= 8, 'R6: user class capped at 8', 'class=' + userClass);
let cpuOver = 0;
G.teams.forEach(tm => {
  if (tm.id === G.tid) return;
  const n = tm.rost.filter(p => p.cls === 'FR' && p.stars !== undefined).length;
  if (n > 8) cpuOver++;
});
check(cpuOver === 0, 'R6: no CPU team exceeds class cap of 8', 'over=' + cpuOver);
// rosters sane
let shortRosters = 0, badRoster = 0, shortNames = [];
G.teams.forEach(tm => {
  if (tm.rost.length < 10) { shortRosters++; shortNames.push(tm.name + '(' + tm.rost.length + ')' + (tm.id === G.tid ? '[USER]' : '')); }
  if (tm.rost.length > 15) badRoster++;
});
check(shortRosters === 0 && badRoster === 0, 'all rosters 10–15 players', 'short=' + shortRosters + ' ' + shortNames.join(',') + ' over=' + badRoster);
// R9: global suitor resolution — deterministic unit test
// (e2e signee volume varies; test the mechanism directly)
console.log('── R9: resolvePortalCPU unit test ──');
const needy = G.teams[3];
needy.rost = needy.rost.filter(p => p.pos !== 'PG').slice(0, 7); // gap, no PGs
const donor = G.teams[5];
G.portalEntrants = [];
const entDefs = [
  { pos: 'PG', ovr: 70 }, { pos: 'C', ovr: 75 }, { pos: 'C', ovr: 76 }, { pos: 'C', ovr: 77 },
];
entDefs.forEach((d, i) => {
  const dp = donor.rost[i];
  dp._portalPid = 9000 + i;
  G.portalEntrants.push({ pid: 9000 + i, name: dp.name, pos: d.pos, ovr: d.ovr, pot: d.ovr + 4,
    cls: dp.cls, fromTid: donor.id, fromName: donor.name, mins: dp.mins,
    sht: d.ovr, fin: d.ovr, def: d.ovr, reb: d.ovr, ply: d.ovr,
    reason: 'Playing time', pickedBy: -1, homeState: 'CA',
    suitors: [{ tid: needy.id, name: needy.name }] });
});
const needyBefore = needy.rost.length, donorBefore = donor.rost.length;
const touched = P.resolvePortalCPU();
const took = needy.rost.length - needyBefore;
check(took === 3, 'resolvePortalCPU: needy team takes up to 3 (cap)', 'took=' + took);
const newGuys = needy.rost.slice(needyBefore);
check(newGuys.every(p => p.transfer === true && isNum(p.ovr) && CLSA.indexOf(p.cls) >= 0),
  'portal pickups flagged transfer, valid ovr/cls');
check(donor.rost.length === donorBefore - 3, 'claimed entrants removed from old roster');
check(G.portalEntrants.length === 1, 'unwanted entrant stays in pool when winner is capped');
P.clearPortalState();
check((G.portalEntrants || []).length === 0, 'portal state cleared after offseason');
// NaN sweep
let nanCount = 0;
G.teams.forEach(tm => {
  tm.rost.forEach(p => {
    if (!isNum(p.ovr) || !isNum(p.sht) || !isNum(p.mins)) nanCount++;
  });
});
check(nanCount === 0, 'no NaN in player ratings/minutes', 'bad=' + nanCount);
const userMins = G.teams[G.tid].rost.reduce((s, p) => s + p.mins, 0);
check(userMins === 200, 'user minutes total 200 after offseason', 'total=' + userMins);

console.log('── R4: fired coach cannot stay ──');
G.coach.history.push({ yr: G.yr, school: 'Old School', action: 'Fired' });
G.offseasonStep = 'carousel';
R.stayAtSchool();
check(G.offseasonStep === 'carousel', 'R4: stayAtSchool blocked for fired coach');
R.renderOffseason();
check(_els['offseason-content'].innerHTML.indexOf('Stay at') < 0, 'R4: stay card hidden for fired coach');
G.coach.history.push({ yr: G.yr, school: 'New School', action: 'Left for New School' });
R.stayAtSchool();
check(G.offseasonStep === 'turnover', 'non-fired coach can still stay');

console.log('── R3: rejected jobs hidden by stable team id ──');
G.coach.history.push({ yr: G.yr, school: 'New School', action: 'Stayed' });
G.offseasonStep = 'carousel';
// give some CPU teams fake losing records so the carousel has open jobs
let faked = 0;
G.teams.forEach(tm => {
  if (tm.id !== G.tid && faked < 20) { tm.wins = 5; tm.loss = 25; faked++; }
});
const realRandom = Math.random;
Math.random = () => 0.9999; // force rejection (roll ~99.99 > max 95% chance)
let r3ok = false, attempts = 0;
while (!r3ok && attempts < 12) {
  attempts++;
  R.renderOffseason();
  const jobs = globalThis.window._carouselJobs || [];
  if (!jobs.length) break;
  const target = jobs[0];
  const tid = target.team.id;
  R.applyForJob(tid); // rejected → hidden by team id
  R.renderOffseason();
  const jobs2 = globalThis.window._carouselJobs || [];
  const html3 = _els['offseason-content'].innerHTML;
  if (jobs2.some(j => j.team.id === tid)) {
    r3ok = html3.indexOf('data-apply-job="' + tid + '"') < 0;
    check(r3ok, 'R3: rejected team id ' + tid + ' hidden on re-render (attempt ' + attempts + ')');
  }
}
Math.random = realRandom;
if (!r3ok) { failures++; console.log('  FAIL: R3 — rejected job never regenerated within 12 attempts'); }
else console.log('  ok: R3 stable-id hiding verified');
// data-apply-job ids are team ids, not render indices
R.renderOffseason();
const html4 = _els['offseason-content'].innerHTML;
const ids = (html4.match(/data-apply-job="(\d+)"/g) || []).map(s => +s.match(/\d+/)[0]);
const jobIds = (globalThis.window._carouselJobs || []).map(j => j.team.id);
check(ids.length > 0 && ids.every(id => jobIds.indexOf(id) >= 0),
  'R3: applyForJob wired with team ids', 'ids=' + ids.slice(0, 5).join(','));

console.log('── R8: slider never silently drops minutes ──');
const ROS = await import(REPO + '/views/roster.js');
const t = G.teams[G.tid];
t.rost.forEach((p, i) => { p.mins = 40; }); // everyone maxed — nowhere to redistribute
const totBefore = t.rost.reduce((s, p) => s + p.mins, 0);
const fakeInput = { getAttribute: () => '0', value: '20' };
ROS.updateMinsSlider(fakeInput);
const totAfter = t.rost.reduce((s, p) => s + p.mins, 0);
check(t.rost[0].mins === 40 && totAfter === totBefore,
  'R8: decrease with no redistribution room keeps minutes', 'p0=' + t.rost[0].mins + ' total=' + totAfter);
// normal decrease still redistributes
t.rost.forEach((p, i) => { p.mins = i < 5 ? 30 : i < 9 ? 12 : 0; });
const tot2 = t.rost.reduce((s, p) => s + p.mins, 0);
const inp2 = { getAttribute: () => '0', value: '10' };
ROS.updateMinsSlider(inp2);
const tot3 = t.rost.reduce((s, p) => s + p.mins, 0);
check(tot3 === tot2 && t.rost[0].mins === 10, 'R8: normal decrease redistributes fully', 'total=' + tot3);

console.log('── R7: _skillInitial survives reload ──');
G.coach.off = 72; G.coach.def = 71; G.coach.dev = 70; G.coach.rec = 70;
G.skillPointsEarned = 3; G.skillPointsToSpend = 3;
G.offseasonStep = 'skillpoints';
R.renderOffseason(); // snapshots _skillInitial + persists on G.coach
R.allocateSkillPoint('off');
check(G.coach.off === 73 && G.skillPointsToSpend === 2, 'allocate works');
// save + "reload" (fresh module import sharing the same G)
ST.saveStateNow();
const saved = JSON.parse(_store['hoops_os_v3']);
check(saved.coach && saved.coach.skillInitial && saved.coach.skillInitial.off === 72,
  'R7: skillInitial persisted in save', JSON.stringify(saved.coach && saved.coach.skillInitial));
const R2 = await import(REPO + '/views/recruiting.js?reload=1');
R2.registerRecruitingCallbacks({ toast(){}, addLog(){}, updateAll(){} });
R2.renderOffseason(); // re-derives _skillInitial from G.coach.skillInitial
R2.deallocateSkillPoint('off');
check(G.coach.off === 72 && G.skillPointsToSpend === 3, 'R7: deallocate back to persisted initial after reload');
R2.deallocateSkillPoint('off');
check(G.coach.off === 72, 'R7: cannot deallocate below initial');
R2.finishSkillPoints();
check(!G.coach.skillInitial, 'R7: snapshot cleared after finishing');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
