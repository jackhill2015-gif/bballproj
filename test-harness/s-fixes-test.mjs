// S1-S10 verification test — modeled on test-harness/harness.mjs
// Verifies: schedule mutuality (S1-S4), standings integrity, no NaN,
// save slimming + debounce + prestige persistence (S9/S10),
// achievement wiring (S7/S8), dedupe (S5), standings pct sort (S6).
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
    insertAdjacentHTML() {}, children: [], lastChild: null,
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, remove() {}, click() {},
  };
  return el;
}
globalThis.document = {
  getElementById: () => stubEl(),
  createElement: () => stubEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: stubEl(),
};
globalThis.window = {};
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

const S   = await import(REPO + '/season.js');
const T   = await import(REPO + '/tournament.js');
const SIM = await import(REPO + '/simulation.js');
const ST  = await import(REPO + '/state.js');
const U   = await import(REPO + '/utils.js');
const C   = await import(REPO + '/constants.js');
const { G, LS, SetupState } = ST;

S.registerSeasonCallbacks({
  addLog() {}, updateAll() {}, navTo() {},
  startConfTourney() { T.startConfTourney(); },
  playTournamentGame(w) { T.playTournamentGame(w); },
  openModal() {},
});
T.registerTournamentCallbacks({
  toast() {}, addLog() {}, updateAll() {}, navTo() {},
  openModal() {},
  endSeason() { S.endSeason(); },
  renderBracket() {},
});

let failures = 0;
function check(cond, label, detail) {
  if (cond) { console.log(`  ok: ${label}`); }
  else { failures++; console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`); }
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// ── S5: dedupe ──
console.log('\n── S5: ALL_TEAMS dedupe ──');
{
  const teams = C.ALL_TEAMS;
  const seen = {};
  teams.forEach(t => { seen[t.n] = (seen[t.n] || 0) + 1; });
  const dups = Object.keys(seen).filter(n => seen[n] > 1);
  check(teams.length === 365, `ALL_TEAMS has 365 entries (got ${teams.length})`); // full 2025-26 D1 universe
  check(dups.length === 0, `no duplicated schools (dups: ${dups.join(', ') || 'none'})`);
  const expect = { SMU: 'ACC', Hawaii: 'Big West', 'James Madison': 'Sun Belt', Omaha: 'Summit', 'Stony Brook': 'CAA', Bellarmine: 'ASUN', 'Austin Peay': 'ASUN', Mercer: 'SoCon' }; // UMKC slot repurposed to Omaha in the 365-team expansion
  let confOk = true;
  for (const n of Object.keys(expect)) {
    const t = teams.find(x => x.n === n);
    if (!t || t.c !== expect[n]) { confOk = false; console.log(`    conf wrong: ${n} -> ${t && t.c}`); }
  }
  check(confOk, 'kept copies are in the current conferences');
}

// ── setup ──
function resetG() {
  S.buildUniverse();
  G.tid = 0; G.yr = 2025; G.gi = 0; G.wk = 0; G.pts = 120;
  G.phase = 'reg'; G.difficulty = 'normal';
  G.bracket = []; G.confTourneys = {}; G.confTitles = 0; G.championships = 0;
  G.logs = []; G.history = []; G.leagueChamps = [];
  G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0; G.recruitTargets = [];
  G.departingPlayers = []; G.offseasonStep = 'turnover';
  G.injuries = []; G.buffs = []; G.nextHomeBonus = 0;
  G.momentum = { tid: -1, pts: 0 };
  G.prestige = 3;
  G.coach = {
    firstName: 'Test', lastName: 'Coach', age: 40,
    off: 70, def: 70, dev: 70, rec: 70, xp: 0, level: 1,
    careerWins: 0, careerLoss: 0, tenure: 0, hotSeat: false,
    titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0, awards: [], history: []
  };
  G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };
  G.expectations = null; G.skillPointsEarned = 0; G.skillPointsToSpend = 0;
  ST.resetLS();
  S.buildSchedules();
  const t = G.teams[G.tid];
  const pool = G.teams.filter(x => x.id !== G.tid && x.conf !== t.conf);
  for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const tmp = pool[i]; pool[i] = pool[k]; pool[k] = tmp; }
  SetupState.NC_PICKS = pool.slice(0, 10).map(x => x.id);
  S.setupUserOOC();
  S.genRecruits();
}

function auditMutuality(label) {
  let oneSided = 0, total = 0;
  const examples = [];
  for (const tm of G.teams) {
    for (let w = 0; w < 30; w++) {
      const s = tm.sched[w];
      if (!s) continue;
      total++;
      const opp = G.teams[s.opp];
      const back = opp && opp.sched[w];
      if (!opp || !back || back.opp !== tm.id) {
        oneSided++;
        if (examples.length < 5) examples.push(`${tm.name} w${w} -> ${opp ? opp.name : '?'}, back=${back ? (back.opp === tm.id ? 'ok' : 'vs ' + G.teams[back.opp].name) : 'null'}`);
      }
    }
  }
  check(oneSided === 0, `${label}: mutuality (${total} entries, ${oneSided} one-sided)`, examples.join(' | '));
  return oneSided;
}

console.log('\n── S2/S3: schedule build mutuality ──');
resetG();
check(G.teams.length === 365, `universe has 365 teams (got ${G.teams.length})`);
auditMutuality('post-build');
// user OOC filled + mutual
{
  const t = G.teams[G.tid];
  let filled = 0, mutual = 0;
  for (let w = 0; w < 10; w++) {
    const s = t.sched[w];
    if (s && s.opp !== undefined) {
      filled++;
      const back = G.teams[s.opp].sched[w];
      if (back && back.opp === G.tid) mutual++;
    }
  }
  check(filled === 10, `user OOC: 10/10 weeks filled (got ${filled})`);
  check(mutual === 10, `user OOC: 10/10 mutual (got ${mutual})`);
}

// ── S4: swapOOC ──
console.log('\n── S4: swapOOC both-sides + orphan handling ──');
{
  const tid = G.tid, slot = 3;
  const oldOppId = G.teams[tid].sched[slot].opp;
  // pick a new opponent that currently HAS a game in that slot (tests displacement)
  let newOppId = null;
  for (const tm of G.teams) {
    if (tm.id === tid || tm.id === oldOppId || tm.conf === G.teams[tid].conf) continue;
    if (tm.sched[slot] && tm.sched[slot].opp !== tid) { newOppId = tm.id; break; }
  }
  const displacedId = G.teams[newOppId].sched[slot].opp;
  S.swapOOC(slot, newOppId);
  check(G.teams[tid].sched[slot].opp === newOppId, 'user side points to new opponent');
  const back = G.teams[newOppId].sched[slot];
  check(back && back.opp === tid, 'new opponent side mirrors back to user');
  const oldBack = G.teams[oldOppId].sched[slot];
  check(!oldBack || oldBack.opp !== tid, 'old opponent orphaned to bye (no dangling ref to user)');
  const dispBack = G.teams[displacedId].sched[slot];
  check(!dispBack || dispBack.opp !== newOppId, 'displaced third team orphaned to bye');
  auditMutuality('post-swapOOC');
  // swap back to restore
  S.swapOOC(slot, oldOppId);
  check(G.teams[tid].sched[slot].opp === oldOppId, 'swap back works');
}

// ── full regular season ──
console.log('\n── S1: full regular season — standings integrity ──');
{
  let guard = 0;
  while (G.phase === 'reg' && G.gi < 30) {
    if (++guard > 500) { check(false, 'season terminated'); break; }
    const game = G.teams[G.tid].sched[G.gi];
    if (!game || game.played) { S.simCPUWeek(); S.advanceWeek(); }
    else { S.launchSim(false); }
  }
  check(G.phase === 'conf_tourn', `reached conf_tourn (phase=${G.phase})`);
  let bad = 0, confBad = 0, nanBad = 0;
  for (const tm of G.teams) {
    let played = 0, confPlayed = 0;
    for (const s of tm.sched) { if (s && s.played) { played++; if (s.conf) confPlayed++; } }
    if (tm.wins + tm.loss !== played) bad++;
    if (tm.cWins + tm.cLoss !== confPlayed) confBad++;
    if (!isNum(tm.pts) || !Number.isInteger(tm.wins) || !Number.isInteger(tm.loss)) nanBad++;
  }
  check(bad === 0, `wins+loss == played for ALL ${G.teams.length} teams (${bad} mismatches)`);
  check(confBad === 0, `conf wins+loss == conf played for all teams (${confBad} mismatches)`);
  check(nanBad === 0, `no NaN/non-integer records (${nanBad} bad)`);
  auditMutuality('post-regular-season');
}

// ── S6: standings pct sort (logic check) ──
console.log('\n── S6: win-pct sort logic ──');
{
  // emulate the sort comparator from views/standings.js
  const confPct = t => { const g = t.cWins + t.cLoss; return g > 0 ? t.cWins / g : 0; };
  const fake = [
    { name: 'A', cWins: 12, cLoss: 8, pts: 100 },  // .600
    { name: 'B', cWins: 9, cLoss: 1, pts: 50 },   // .900 — fewer wins, better pct
    { name: 'C', cWins: 0, cLoss: 0, pts: 10 },   // no games
  ];
  const sorted = fake.slice().sort((a, b) => confPct(b) - confPct(a) || b.cWins - a.cWins || b.pts - a.pts);
  check(sorted[0].name === 'B' && sorted[1].name === 'A' && sorted[2].name === 'C',
    `pct sort: B(.900) > A(.600) > C(0 games) — got ${sorted.map(t => t.name).join(',')}`);
}

// ── S10: save slimming + debounce, S9: prestige ──
console.log('\n── S9/S10: save slimming, debounce, prestige ──');
{
  G.prestige = 4;
  ST.saveStateNow();
  const raw = _store['hoops_os_v3'];
  const kb = Math.round(raw.length / 1024);
  console.log(`  save size: ${kb}KB`);
  check(kb < 1500, `save slimmed well under old 3.4MB (${kb}KB)`);
  const parsed = JSON.parse(raw);
  check(typeof parsed.prestige === 'number' && parsed.prestige === 4, 'prestige persisted in save');
  check(parsed._saveVersion === 10, `save version is 10 (got ${parsed._saveVersion})`);
  const bracketHasObjects = parsed.bracket.some(b => b.team && typeof b.team === 'object');
  check(!bracketHasObjects, 'bracket serialized as team IDs (no embedded team objects)');

  // debounce: saveState() should NOT write immediately
  G.prestige = 2;
  ST.saveState();
  const rawAfterDebounced = _store['hoops_os_v3'];
  check(JSON.parse(rawAfterDebounced).prestige === 4, 'debounced saveState() does not write synchronously');
  await new Promise(r => setTimeout(r, 1300));
  const rawAfterWait = _store['hoops_os_v3'];
  check(JSON.parse(rawAfterWait).prestige === 2, 'debounced saveState() writes after ~1s (trailing)');

  // saveStateNow writes immediately
  G.prestige = 5;
  ST.saveStateNow();
  check(JSON.parse(_store['hoops_os_v3']).prestige === 5, 'saveStateNow() writes immediately');

  // roundtrip preserves prestige, phase, standings
  const before = G.teams.map(t => t.wins + '-' + t.loss).join(',');
  const phaseBefore = G.phase, giBefore = G.gi;
  G.prestige = 0; // clobber
  const ok = ST.loadState();
  check(ok === true, 'loadState roundtrip ok');
  check(G.prestige === 5, `prestige restored after load (got ${G.prestige})`);
  check(G.phase === phaseBefore && G.gi === giBefore, 'phase/gi preserved');
  check(G.teams.map(t => t.wins + '-' + t.loss).join(',') === before, 'standings preserved');
  check(isNum(G.prestige), 'prestige is a finite number (not NaN)');

  // legacy (v6, no prestige) migration
  const legacy = JSON.parse(_store['hoops_os_v3']);
  delete legacy.prestige;
  legacy._saveVersion = 6;
  _store['hoops_os_v3'] = JSON.stringify(legacy);
  ST.loadState();
  check(typeof G.prestige === 'number' && G.prestige >= 1 && G.prestige <= 5, `v6 save migrates prestige (got ${G.prestige})`);
}

// ── conf tourneys + NCAA + S7/S8 ──
console.log('\n── conf tourneys + NCAA: achievements + history ──');
{
  let guard = 0;
  while (!T.allConfDone()) {
    if (++guard > 3000) { check(false, 'conf tourneys terminated'); break; }
    const um = T.getUserConfMatchup();
    if (um) T.playTournamentGame(false);
    else T.advanceConfTourney();
  }
  check(T.allConfDone(), 'all conf tourneys done');

  // save/load MID-TOURNAMENT (confTourneys rehydration)
  ST.saveStateNow();
  const ctConfs = Object.keys(G.confTourneys).length;
  ST.loadState();
  check(Object.keys(G.confTourneys).length === ctConfs, `confTourneys rehydrated (${ctConfs} confs)`);
  let ctOk = true;
  for (const conf of Object.keys(G.confTourneys)) {
    const ct = G.confTourneys[conf];
    if (ct.champ && (typeof ct.champ !== 'object' || typeof ct.champ.id !== 'number')) ctOk = false;
    for (const s of ct.seeds) if (!s || typeof s.id !== 'number') ctOk = false;
  }
  check(ctOk, 'confTourney champs/seeds rehydrated to team objects');

  // NCAA
  if (!G.bracket.length) { check(false, 'NCAA bracket built'); }
  else {
    check(G.bracket.length === 64, `bracket has 64 teams (got ${G.bracket.length})`);
    // save/load with live bracket (slim → rehydrate)
    ST.saveStateNow();
    ST.loadState();
    let brOk = G.bracket.length === 64;
    for (const b of G.bracket) if (!b.team || typeof b.team.id !== 'number' || !b.team.name) brOk = false;
    check(brOk, 'bracket rehydrated to team objects after save/load');

    let guard2 = 0;
    while (true) {
      const active = G.bracket.filter(b => b.active);
      if (active.length <= 1) break;
      if (++guard2 > 200) { check(false, 'NCAA terminated'); break; }
      const um = T.getUserNCAAmatchup();
      if (um) T.playTournamentGame(false); else T.simNCAAround();
    }
    const champ = G.bracket.filter(b => b.active);
    check(champ.length === 1, 'exactly one NCAA champion');
    check(G.phase === 'offseason', `endSeason ran (phase=${G.phase})`);

    // S8: achievement flags
    const sa = G.seasonAchievements;
    const inField = G.bracket.some(b => b.team.id === G.tid);
    check(sa.madeNCAA === inField, `madeNCAA=${sa.madeNCAA} matches bracket membership (${inField})`);
    const userChamp = champ.length === 1 && champ[0].team.id === G.tid;
    if (userChamp) {
      check(sa.natChamp && sa.champGame && sa.finalFour && sa.sweet16, 'user champ: all tourney flags set');
    } else if (sa.tourneyFinish) {
      const tf = sa.tourneyFinish;
      const expectS16 = ['Sweet 16', 'Elite Eight', 'Final Four', 'Championship Game'].includes(tf);
      check(sa.sweet16 === expectS16, `sweet16=${sa.sweet16} for finish "${tf}"`);
    }
    const uct = G.confTourneys[G.teams[G.tid].conf];
    const userConfChamp = uct && uct.done && uct.champ && uct.champ.id === G.tid;
    check(sa.confTitleThisYear === !!userConfChamp, `confTitleThisYear=${sa.confTitleThisYear} matches conf tourney champ (${!!userConfChamp})`);
    console.log(`  achievements: ${JSON.stringify(sa)}`);
    console.log(`  skillPointsEarned: ${G.skillPointsEarned}`);

    // S7: history uses tourneyFinish
    const h = (G.history || []).find(x => x.year === G.yr);
    check(!!h, 'season history recorded');
    if (h) {
      console.log(`  history tourneyFinish: "${h.tourneyFinish}"`);
      const validFinishes = ['CHAMP', 'Championship Game', 'Final Four', 'Elite Eight', 'Sweet 16', 'Round of 32', 'Round of 64', 'Did Not Qualify', 'Conf Tourney'];
      check(validFinishes.includes(h.tourneyFinish), `tourneyFinish is a real finish ("${h.tourneyFinish}")`);
      if (!userChamp && sa.tourneyFinish) {
        check(h.tourneyFinish === sa.tourneyFinish, 'history matches recorded tourneyFinish');
      }
      check(h.tourneyFinish !== 'Runner-Up', 'not the bogus always-Runner-Up value');
    }
  }
}

// ── S8 unit: wireSeasonAchievements across every rung ──
console.log('\n── S8 unit: achievement flag wiring ──');
{
  const tid = G.tid;
  const mkEntry = (id, active) => ({ team: G.teams[id], seed: 1, active: !!active, score: null, won: false });
  const otherIds = G.teams.filter(t => t.id !== tid).slice(0, 63).map(t => t.id);

  function freshSA() {
    G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };
  }

  // 1. conf title
  freshSA();
  G.confTourneys = {};
  G.confTourneys[G.teams[tid].conf] = { done: true, champ: G.teams[tid], seeds: [], rounds: [] };
  G.bracket = [];
  S.wireSeasonAchievements();
  check(G.seasonAchievements.confTitleThisYear === true, 'conf title wired when user wins conf tourney');
  check(G.seasonAchievements.madeNCAA === false, 'no NCAA flags without a bracket');

  // 2. elimination rungs
  const rungs = [
    ['Round of 64', { madeNCAA: true, sweet16: false, finalFour: false, champGame: false, natChamp: false }],
    ['Round of 32', { madeNCAA: true, sweet16: false, finalFour: false, champGame: false, natChamp: false }],
    ['Sweet 16', { madeNCAA: true, sweet16: true, finalFour: false, champGame: false, natChamp: false }],
    ['Elite Eight', { madeNCAA: true, sweet16: true, finalFour: false, champGame: false, natChamp: false }],
    ['Final Four', { madeNCAA: true, sweet16: true, finalFour: true, champGame: false, natChamp: false }],
    ['Championship Game', { madeNCAA: true, sweet16: true, finalFour: true, champGame: true, natChamp: false }],
  ];
  for (const [finish, expect] of rungs) {
    freshSA();
    G.seasonAchievements.tourneyFinish = finish;
    G.bracket = [mkEntry(tid, false)].concat(otherIds.map(id => mkEntry(id, true)));
    G.confTourneys = {};
    const sa = S.wireSeasonAchievements();
    let ok = true;
    for (const k of Object.keys(expect)) if (sa[k] !== expect[k]) ok = false;
    check(ok, `elimination "${finish}" → flags ${JSON.stringify(expect)}`);
  }

  // 3. user wins it all
  freshSA();
  G.bracket = [mkEntry(tid, true)];
  G.confTourneys = {};
  const saChamp = S.wireSeasonAchievements();
  check(saChamp.natChamp && saChamp.champGame && saChamp.finalFour && saChamp.sweet16 && saChamp.madeNCAA,
    'champion: all five NCAA flags set');
  check(saChamp.tourneyFinish === 'CHAMP', `champion: tourneyFinish="CHAMP" (got "${saChamp.tourneyFinish}")`);

  // 4. slimmed (id-based) bracket refs also resolve
  freshSA();
  G.bracket = [{ team: tid, seed: 1, active: false, score: null, won: false }]
    .concat(otherIds.map(id => ({ team: id, seed: 1, active: true, score: null, won: false })));
  G.seasonAchievements.tourneyFinish = 'Sweet 16';
  const saSlim = S.wireSeasonAchievements();
  check(saSlim.madeNCAA === true && saSlim.sweet16 === true, 'id-based (slimmed) bracket refs resolve');

  // 5. DNQ history fallback
  freshSA();
  G.bracket = otherIds.map(id => mkEntry(id, id === otherIds[0]));
  G.confTourneys = {};
  G.yr = 2099; // fresh year to bypass the duplicate-year guard
  S.recordSeasonHistory('ncaa');
  const hdnq = G.history[G.history.length - 1];
  check(hdnq.tourneyFinish === 'Did Not Qualify', `DNQ history = "Did Not Qualify" (got "${hdnq.tourneyFinish}")`);
  G.history.pop();
  G.yr = 2025;
}

// ── final full-mutuality + NaN sweep ──
console.log('\n── final sweep ──');
{
  let nan = 0;
  for (const tm of G.teams) {
    if (!isNum(tm.pts)) nan++;
    for (const p of tm.rost) for (const k of ['pts', 'reb', 'ast', 'fgm', 'fga', 'gp']) {
      if (p.s && !isNum(p.s[k])) nan++;
    }
  }
  check(nan === 0, `no NaN in team pts / player stats (${nan} bad)`);
}

console.log(`\n════════ RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} ════════`);
process.exit(failures === 0 ? 0 : 1);
