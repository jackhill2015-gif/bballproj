// HOOPS OS — record book / Hall of Fame test
// Usage: node test-harness/records-test.mjs
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

const R  = await import(REPO + '/records.js');
const ST = await import(REPO + '/state.js');
const { G, LS } = ST;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// capture hook calls
const logged = [], toasted = [];
R.registerRecordsCallbacks({
  log: (type, wk, text) => logged.push({ type, wk, text }),
  toast: (msg, col) => toasted.push({ msg, col }),
});

function fakePlayer(name, cls, s) {
  return { name, pos: 'SG', cls, mins: 20, s: Object.assign({ gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 }, s) };
}
function resetG() {
  G.records = undefined; G._recBreaks = undefined;
  G.tid = 0; G.yr = 2025; G.gi = 5;
  G.teams = [];
  LS._recLines = null; LS._recPre = null; LS.tH = null; LS.tA = null;
  logged.length = 0; toasted.length = 0;
}

// A book with at least one finished season (single-game records only
// announce once the inaugural season is in the books).
function establish(tid) { R.bookFor(tid).season.pts = { v: 999, name: 'Old Timer', yr: 2020 }; }

console.log('== shape / defaults ==');
resetG();
t('defaultRecords has books+hof', (() => { const d = R.defaultRecords(); return d.books && Array.isArray(d.hof); })());
t('ensureRecords fills undefined', (() => { R.ensureRecords(); return G.records && G.records.books && Array.isArray(G.records.hof); })());
t('ensureRecords preserves existing', (() => { G.records.hof.push({ name: 'X' }); R.ensureRecords(); return G.records.hof.length === 1; })());
resetG();
t('bookFor creates empty book', (() => {
  const b = R.bookFor(3);
  return b.game.pts === null && b.season.blk === null && b.career.ast === null && !!G.records.books[3];
})());

console.log('== game records ==');
resetG();
G.teams = [{ id: 0, name: 'Test U', rost: [fakePlayer('Alpha', 'JR', {})] }];
t('inaugural season: game records update quietly', (() => {
  R.checkGameRecords(0, [{ p: G.teams[0].rost[0], pts: 20, reb: 0, ast: 0, stl: 0, blk: 0 }], 1);
  const q = R.checkGameRecords(0, [{ p: G.teams[0].rost[0], pts: 40, reb: 0, ast: 0, stl: 0, blk: 0 }], 2);
  const ok = q.length === 0 && G.records.books[0].game.pts.v === 40;
  resetG(); G.teams = [{ id: 0, name: 'Test U', rost: [fakePlayer('Alpha', 'JR', {})] }];
  return ok;
})());
establish(0);
const L1 = [{ p: G.teams[0].rost[0], pts: 28, reb: 5, ast: 4, stl: 1, blk: 0 }];
let br = R.checkGameRecords(0, L1, 5);
t('first marks set silently (no breaks)', br.length === 0 && G.records.books[0].game.pts.v === 28);
t('no log/toast on silent set', logged.length === 0 && toasted.length === 0);
const L2 = [{ p: G.teams[0].rost[0], pts: 35, reb: 5, ast: 4, stl: 1, blk: 0 }];
br = R.checkGameRecords(0, L2, 6);
t('higher line breaks the record', br.length === 1 && br[0].stat === 'pts' && br[0].value === 35 && br[0].prev === 28);
t('book updated to new mark', G.records.books[0].game.pts.v === 35 && G.records.books[0].game.pts.name === 'Alpha');
const L3 = [{ p: G.teams[0].rost[0], pts: 35, reb: 12, ast: 4, stl: 1, blk: 0 }];
br = R.checkGameRecords(0, L3, 7);
t('tie does not break; new stat category breaks', br.length === 1 && br[0].stat === 'reb');
const L0 = [{ p: G.teams[0].rost[0], pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 }];
br = R.checkGameRecords(0, L0, 8);
t('scoreless line breaks nothing', br.length === 0);

console.log('== snap/diff ==');
resetG();
const tm = { id: 0, rost: [fakePlayer('A', 'JR', { pts: 100, reb: 40 }), fakePlayer('B', 'SO', { pts: 50 })] };
const pre = R.snapRoster(tm);
tm.rost[0].s.pts += 22; tm.rost[0].s.reb += 7; tm.rost[1].s.ast += 3;
const dl = R.diffRoster(tm, pre);
t('diff isolates the game line', dl[0].pts === 22 && dl[0].reb === 7 && dl[1].ast === 3 && dl[1].pts === 0);
t('userLinesFromRes picks user side', (() => {
  G.tid = 7;
  const res = { plines: { h: { tid: 3, lines: ['H'] }, a: { tid: 7, lines: ['A'] } } };
  return R.userLinesFromRes(res)[0] === 'A';
})());
t('userLinesFromRes null when absent', R.userLinesFromRes({}) === null);

console.log('== surface (ambient notify) ==');
resetG();
G.teams = [{ id: 0, name: 'Test U', rost: [fakePlayer('Alpha', 'JR', {})] }];
establish(0);
R.checkGameRecords(0, [{ p: G.teams[0].rost[0], pts: 20, reb: 0, ast: 0, stl: 0, blk: 0 }], 1); // silent set
LS._recLines = [{ p: G.teams[0].rost[0], pts: 31, reb: 0, ast: 0, stl: 0, blk: 0 }];
const sb = R.surfaceUserGameRecords();
t('surface returns breaks', sb.length === 1 && sb[0].value === 31);
t('log line queued as type r', logged.length === 1 && logged[0].type === 'r' && /SCHOOL RECORD/.test(logged[0].text));
t('toast queued', toasted.length === 1 && /Record!/.test(toasted[0].msg));
t('LS staging cleared', LS._recLines === null && LS._recPre === null);
t('season highlight reel collected', (G._recBreaks || []).length === 1);
logged.length = 0; toasted.length = 0;
t('surface with no staging is a no-op', R.surfaceUserGameRecords().length === 0 && logged.length === 0);

// live path: diff vs LS._recPre
resetG();
const tH = { id: 0, name: 'Test U', rost: [fakePlayer('Alpha', 'JR', { pts: 500 })] };
const tA = { id: 9, name: 'Opp', rost: [fakePlayer('Zed', 'SR', { pts: 100 })] };
G.teams = [tH, tA]; G.tid = 0;
establish(0);
R.checkGameRecords(0, [{ p: tH.rost[0], pts: 25, reb: 0, ast: 0, stl: 0, blk: 0 }], 1);
LS.tH = tH; LS.tA = tA;
LS._recPre = { h: R.snapRoster(tH), a: R.snapRoster(tA), hid: 0, aid: 9 };
tH.rost[0].s.pts += 30; // live accumulation
const lb = R.surfaceUserGameRecords();
t('live path diffs vs pre-game snapshot', lb.length === 1 && lb[0].value === 30);

t('several breaks in one game make one toast', (() => {
  resetG(); G.teams = [{ id: 0, name: 'Test U', rost: [fakePlayer('Alpha', 'JR', {})] }]; establish(0);
  R.checkGameRecords(0, [{ p: G.teams[0].rost[0], pts: 10, reb: 5, ast: 2, stl: 1, blk: 1 }], 1);
  LS._recLines = [{ p: G.teams[0].rost[0], pts: 30, reb: 15, ast: 9, stl: 1, blk: 1 }];
  const b = R.surfaceUserGameRecords();
  return b.length === 3 && toasted.length === 1 && logged.length === 3;
})());

console.log('== season / career / HOF ==');
resetG();
const star = fakePlayer('Starman', 'SR', { gp: 32, pts: 700, reb: 200, ast: 150, stl: 40, blk: 20 });
const role = fakePlayer('Roley', 'SO', { gp: 32, pts: 200, reb: 100, ast: 60, stl: 20, blk: 10 });
const legend = fakePlayer('Legend', 'SR', { gp: 33, pts: 800, reb: 150, ast: 120, stl: 30, blk: 15 });
legend.c = { pts: 1500, reb: 300, ast: 200, stl: 60, blk: 30 }; // 3 prior years → crosses 2000
G.teams = [{ id: 0, name: 'Test U', rost: [star, role, legend] }];
let out = R.processSeasonRecords();
t('season records set', G.records.books[0].season.pts.v === 800);
t('career totals accumulated', legend.c.pts === 2300 && star.c.pts === 700);
t('career record set', G.records.books[0].career.pts.v === 2300);
t('2000-pt senior inducted to HOF', out.inductees.some(h => h.name === 'Legend'));
t('HOF honors listed', out.inductees.find(h => h.name === 'Legend').honors.includes('2,000-pt scorer'));
t('HOF log + toast announced', logged.some(l => /HALL OF FAME/.test(l.text)) && toasted.some(x => /HOF: Legend/.test(x.msg)));
t('no double-induction on repeat call', (() => {
  const n = G.records.hof.length;
  R.processSeasonRecords();
  return G.records.hof.length === n;
})());
t('inaugural season writes marks quietly', (() => {
  resetG();
  G.teams = [{ id: 0, name: 'Test U', rost: [
    fakePlayer('A', 'FR', { gp: 30, pts: 400, reb: 100, ast: 80, stl: 20, blk: 10 }),
    fakePlayer('B', 'FR', { gp: 30, pts: 500, reb: 120, ast: 90, stl: 25, blk: 12 })
  ] }];
  const o = R.processSeasonRecords();
  const bk = R.bookFor(0);
  return o.seasonBreaks.length === 0 && o.careerBreaks.length === 0
    && bk.season.pts.v === 500 && bk.career.pts.v === 500
    && logged.length === 0 && toasted.length === 0;
})());
t('second season announces real breaks', (() => {
  // same roster (still FR in the fixture → no draft departure), star tops last year's marks
  G.teams[0].rost[1].s = { gp: 31, pts: 600, reb: 120, ast: 90, stl: 25, blk: 12 };
  const o = R.processSeasonRecords();
  return o.seasonBreaks.length === 1 && o.seasonBreaks[0].stat === 'pts'
    && logged.some(l => /SCHOOL RECORD/.test(l.text));
})());
t('career keeps accumulating across seasons', (() => {
  resetG();
  const soph = fakePlayer('Soph', 'SO', { gp: 30, pts: 200, reb: 100, ast: 60, stl: 20, blk: 10 });
  G.teams = [{ id: 0, name: 'Test U', rost: [soph] }];
  R.processSeasonRecords();
  soph.s = { gp: 33, pts: 400, reb: 120, ast: 80, stl: 25, blk: 12 };
  R.processSeasonRecords();
  return soph.c.pts === 600;
})());

console.log('== old-save compat ==');
resetG();
G.records = undefined; // what a v7 save looks like after load
G.teams = [{ id: 0, name: 'Test U', rost: [fakePlayer('A', 'JR', { gp: 10, pts: 100 })] }];
let ok = true;
try {
  R.bookFor(0);
  R.processSeasonRecords();
  R.surfaceUserGameRecords();
} catch (e) { ok = false; console.log('   threw:', e.message); }
t('undefined records never crash', ok && !!G.records && !!G.records.books[0]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
