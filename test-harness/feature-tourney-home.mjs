// HOOPS OS feature test: home-page tournament swap + full-bracket reveal
// Usage: node test-harness/feature-tourney-home.mjs
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── browser shims with id-keyed persistent elements ──
const _store = {};
globalThis.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
  clear: () => { for (const k in _store) delete _store[k]; },
};
function stubEl(id) {
  const kids = [];
  const el = {
    _id: id, textContent: '', innerHTML: '', value: '', onclick: null,
    style: {}, dataset: {},
    children: kids,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { kids.push(c); return c; },
    removeChild() {}, insertBefore() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {},
  };
  return el;
}
const _els = {};
globalThis.document = {
  getElementById: (id) => (_els[id] || (_els[id] = stubEl(id))),
  createElement: () => stubEl('anon'),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: stubEl('body'),
};
globalThis.window = {};

const S  = await import(REPO + '/season.js');
const T  = await import(REPO + '/tournament.js');
const ST = await import(REPO + '/state.js');
const { G, SetupState } = ST;
const DASH = await import(REPO + '/views/dashboard.js');
const BR   = await import(REPO + '/views/bracket.js');

let navTarget = null;
S.registerSeasonCallbacks({
  addLog() {}, updateAll() {}, navTo(v) { navTarget = v; },
  startConfTourney() { T.startConfTourney(); },
  playTournamentGame(w) { T.playTournamentGame(w); },
  openModal() {},
});
T.registerTournamentCallbacks({
  toast() {}, addLog() {}, updateAll() {}, navTo(v) { navTarget = v; },
  openModal() {}, endSeason() {}, renderBracket() {},
});

let pass = 0, failCount = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok: ' + name); }
  else { failCount++; console.log('  FAIL: ' + name); }
}

console.log('── setup: new universe, user team ──');
S.buildUniverse();
G.tid = 0; G.yr = 2025; G.gi = 0; G.wk = 0; G.pts = 120;
G.phase = 'reg'; G.difficulty = 'normal';
G.coach = { firstName: 'Test', lastName: 'Coach', level: 1, xp: 0, tenure: 0, careerWins: 0, careerLoss: 0 };
G.logs = []; G.expectations = { low: 15, high: 20, danger: 8 };
SetupState.ACTIVE_VIEW = 'dashboard';

console.log('── 1. home swap: reg → conf_tourn → ncaa ──');
DASH.renderDashboard();
let html = _els['dash-content'].innerHTML;
ok(html.includes('dash-sum'), 'reg phase: home shows normal dashboard (school card)');
ok(!html.includes('Conference Tournaments'), 'reg phase: home does NOT show tournament hub');

T.startConfTourney(); // sets phase='conf_tourn', navTo('dashboard')
DASH.renderDashboard();
html = _els['dash-content'].innerHTML;
ok(G.phase === 'conf_tourn', 'phase is conf_tourn after startConfTourney');
ok(html.includes('Conference Tournaments'), 'conf_tourn phase: home shows tournament hub');
ok(!html.includes('dash-sum'), 'conf_tourn phase: home does NOT show regular dashboard');
ok(html.includes('QUICK SIM') || html.includes('ADVANCE'), 'conf_tourn home: user can play/advance from home');

// sim through all conf tourneys (user's conf needs its game simmed too)
let guard = 0;
const userConf = G.teams[G.tid].conf;
while (!T.allConfDone() && guard++ < 20) { T.simConfRoundAll(); T.simConfRound(userConf); }
ok(T.allConfDone(), 'all conference tournaments complete');
T.buildNCAA(); // sets phase='ncaa', opens reveal overlay
ok(G.phase === 'ncaa', 'phase is ncaa after buildNCAA');
DASH.renderDashboard();
html = _els['dash-content'].innerHTML;
ok(html.includes('NCAA Tournament'), 'ncaa phase: home shows NCAA hub');
ok(!html.includes('dash-sum'), 'ncaa phase: home does NOT show regular dashboard');

console.log('── 2. full-bracket reveal (no region stepping) ──');
const btn = _els['br-reveal-btn'];
ok(btn.textContent.includes('Reveal the field'), 'reveal button says Reveal the field (got: "' + btn.textContent + '")');
btn.onclick(); // the single reveal action
const wrapKids = _els['br-bracket'].children.length;
ok(wrapKids === 4, 'one click reveals all 4 regions at once (got ' + wrapKids + ')');
ok(btn.textContent.includes('Go to the tournament'), 'after reveal, button becomes Go to the tournament (got: "' + btn.textContent + '")');
navTarget = null;
btn.onclick(); // close
ok(_els['bracket-reveal'].style.display === 'none', 'reveal overlay closes');
ok(navTarget === 'dashboard', 'after reveal, lands on home (dashboard), not bracket view');

console.log('── 3. new season reverts home ──');
G.phase = 'reg'; G.gi = 0; G.yr++;
DASH.renderDashboard();
html = _els['dash-content'].innerHTML;
ok(html.includes('dash-sum'), 'new season (reg): home reverts to normal dashboard');
ok(!html.includes('NCAA Tournament'), 'new season: no tournament hub on home');

console.log('\n════════ RESULT: ' + (failCount === 0 ? 'ALL PASS (' + pass + ' passed)' : failCount + ' FAILURES') + ' ════════');
process.exit(failCount === 0 ? 0 : 1);
