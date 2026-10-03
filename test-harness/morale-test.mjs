// HOOPS OS — morale system test
// Usage: node test-harness/morale-test.mjs
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

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
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {},
  };
  return el;
}
globalThis.document = {
  getElementById: () => stubEl(),
  createElement: () => stubEl(),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, body: stubEl(), head: stubEl(),
};
globalThis.window = {};

const M   = await import(REPO + '/morale.js');
const SIM = await import(REPO + '/simulation.js');
const ST  = await import(REPO + '/state.js');
const S   = await import(REPO + '/season.js');
const P   = await import(REPO + '/views/portal.js');
const { G } = ST;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

console.log('== mood tags ==');
t('100 -> Locked In', M.moodTag(100) === 'Locked In');
t('85 -> Locked In', M.moodTag(85) === 'Locked In');
t('84 -> Happy', M.moodTag(84) === 'Happy');
t('70 -> Happy', M.moodTag(70) === 'Happy');
t('69 -> Content', M.moodTag(69) === 'Content');
t('45 -> Content', M.moodTag(45) === 'Content');
t('44 -> Restless', M.moodTag(44) === 'Restless');
t('25 -> Restless', M.moodTag(25) === 'Restless');
t('24 -> Checked Out', M.moodTag(24) === 'Checked Out');
t('0 -> Checked Out', M.moodTag(0) === 'Checked Out');
t('undefined -> Content (default 50)', M.moodTag(undefined) === 'Content');
t('colors return pairs', Array.isArray(M.moodColors(90)) && M.moodColors(90).length === 2);

console.log('== attr mod ==');
t('morale 0 -> -2', M.moraleAttrMod({ morale: 0 }) === -2);
t('morale 50 -> 0', M.moraleAttrMod({ morale: 50 }) === 0);
t('morale 100 -> +2', M.moraleAttrMod({ morale: 100 }) === 2);
t('missing morale -> 0', M.moraleAttrMod({}) === 0);

console.log('== genPlayer init ==');
const gp = SIM.genPlayer(70, 'PG', 'FR');
t('genPlayer sets morale=50', gp.morale === 50);

console.log('== drift after games ==');
function mkTeam() {
  return {
    id: 999, wins: 0, loss: 0, streak: 0,
    rost: [
      { name: 'Star', pos: 'PG', cls: 'JR', ovr: 85, mins: 32, morale: 50, s: {} },
      { name: 'Bench', pos: 'SG', cls: 'SO', ovr: 80, mins: 5, morale: 50, s: {} },
      { name: 'Role', pos: 'SF', cls: 'FR', ovr: 65, mins: 20, morale: 50, s: {} },
    ]
  };
}
let tm = mkTeam();
M.updateMoraleAfterGame(tm, true);
t('win lifts morale', tm.rost[0].morale > 50);
t('streak=1 after win', tm.streak === 1);
t('benched star drifts down even in a win', tm.rost[1].morale < tm.rost[0].morale);

tm = mkTeam();
for (let i = 0; i < 6; i++) M.updateMoraleAfterGame(tm, false);
t('6 straight losses -> streak -6', tm.streak === -6);
t('freefall tanks morale', tm.rost[0].morale < 30);
t('morale clamped >= 0', tm.rost.every(p => p.morale >= 0));

tm = mkTeam();
for (let i = 0; i < 30; i++) M.updateMoraleAfterGame(tm, true);
t('morale clamped <= 100', tm.rost.every(p => p.morale <= 100));

console.log('== recordGameMorale ==');
let w = mkTeam(), l = mkTeam();
M.recordGameMorale(w, l);
t('winner streak +1', w.streak === 1);
t('loser streak -1', l.streak === -1);
t('winner morale > loser morale', w.rost[0].morale > l.rost[0].morale);

console.log('== portal weighting ==');
const c0 = M.portalEntryChance({ morale: 0 });
const c50 = M.portalEntryChance({ morale: 50 });
const c100 = M.portalEntryChance({ morale: 100 });
t('lower morale -> higher entry chance', c0 > c50 && c50 > c100);
t('chance in sane range', c0 > 0.5 && c0 < 0.9 && c100 > 0.2 && c100 < 0.45);
t('morale reason: checked out', M.moralePortalReason({ morale: 10, ovr: 70, mins: 30 }) === 'Lost faith in program');
t('morale reason: star benched', M.moralePortalReason({ morale: 60, ovr: 80, mins: 10 }) === 'Bigger role');
t('morale reason: default', M.moralePortalReason({ morale: 60, ovr: 70, mins: 5 }) === 'Playing time');

console.log('== restless star pitch ==');
const rt = { rost: [{ pos: 'PG', ovr: 80, morale: 30 }, { pos: 'SG', ovr: 70, morale: 60 }] };
t('detects restless star at PG', M.hasRestlessStarAt(rt, 'PG') === true);
t('no star at C', M.hasRestlessStarAt(rt, 'C') === false);
t('happy star does not count', M.hasRestlessStarAt({ rost: [{ pos: 'PG', ovr: 80, morale: 80 }] }, 'PG') === false);
t('null team safe', M.hasRestlessStarAt(null, 'PG') === false);

console.log('== integration: full season sim ==');
S.registerSeasonCallbacks({ addLog() {}, updateAll() {}, navTo() {}, startConfTourney() {}, playTournamentGame() {}, openModal() {} });
S.buildUniverse();
S.buildSchedules();
const ut = G.teams[G.tid];
// morale initialized on all generated players
t('all user players have morale', ut.rost.every(p => typeof p.morale === 'number'));
// sim 5 CPU weeks, check morale drifted and streaks tracked
let drifted = false, streaks = false;
for (let w = 0; w < 5; w++) S.simCPUWeek();
G.teams.forEach(t2 => {
  if (typeof t2.streak === 'number' && t2.streak !== 0) streaks = true;
  (t2.rost || []).forEach(p => { if (p.morale !== 50) drifted = true; });
});
t('morale drifted across league after 5 weeks', drifted);
t('streaks tracked', streaks);
// user team morale tags render sane
t('user morale values in range', ut.rost.every(p => p.morale >= 0 && p.morale <= 100));

// portal generation works with morale
P.genPortalEntrants();
t('portal entrants generated', Array.isArray(G.portalEntrants));
const lowMoraleEntrants = G.portalEntrants.filter(e => {
  // entrants don't carry morale; check the reason field exists
  return typeof e.reason === 'string' && e.reason.length > 0;
});
t('portal reasons assigned', lowMoraleEntrants.length === G.portalEntrants.length);

// simGame applies morale without crashing and restores attributes
const t1 = G.teams[0], t2 = G.teams[1];
t1.rost.forEach(p => { p.morale = 100; });
t2.rost.forEach(p => { p.morale = 0; });
const before = t1.rost[0].sht;
const res = SIM.simGame(t1, t2, false);
t('simGame returns scores', typeof res.homeScore === 'number' && typeof res.awayScore === 'number');
t('attributes restored after sim', t1.rost[0].sht === before);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
