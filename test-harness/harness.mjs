// HOOPS OS runtime bug-hunt harness
// Runs the REAL modules from ~/workspace/bballproj with minimal browser shims.
// Usage: node /tmp/hoops-fuzz/harness.mjs
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── browser shims (set BEFORE dynamic imports evaluate module bodies) ──
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
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: stubEl(),
};
globalThis.window = {};

// ── import the real modules ──
const S   = await import(REPO + '/season.js');
const T   = await import(REPO + '/tournament.js');
const SIM = await import(REPO + '/simulation.js');
const ST  = await import(REPO + '/state.js');
const U   = await import(REPO + '/utils.js');
const EV  = await import(REPO + '/events.js');
const C   = await import(REPO + '/constants.js');
const { G, LS, SetupState } = ST;

// wire the late-binding callback registries (no-ops except flow-critical ones)
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

// ── bug / note collectors ──
const bugs = [], notes = [], failures = [];
let bugCount = 0;
function bug(title, detail) {
  bugCount++;
  bugs.push({ n: bugCount, title, detail });
  console.log(`\n[BUG #${bugCount}] ${title}\n    ${detail}`);
}
function note(msg) { notes.push(msg); console.log(`[note] ${msg}`); }
function fail(stage, err) {
  failures.push({ stage, err: String(err && err.stack || err) });
  console.log(`\n[FAIL] ${stage}: ${err && err.stack || err}`);
}
function assert(cond, title, detail) {
  if (!cond) bug(title, detail || '(assertion failed)');
  return !!cond;
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
let stageErrors = 0;
function stage(name, fn) {
  console.log(`\n── stage: ${name} ──`);
  try { fn(); console.log(`   ok: ${name}`); }
  catch (e) { stageErrors++; fail(name, e); }
}

// ── helpers ──
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
  const confTeams = G.teams.filter(x => x.conf === t.conf);
  const cAvg = confTeams.reduce((s, x) => s + U.getTOvr(x), 0) / confTeams.length;
  G.expectations = C.calcExpectations(U.getTOvr(t), cAvg);
}

function checkWeekInvariants(gi) {
  for (const tm of G.teams) {
    if (!Number.isInteger(tm.wins) || tm.wins < 0 || !Number.isInteger(tm.loss) || tm.loss < 0)
      bug('non-integer/negative record', `${tm.name}: wins=${tm.wins} loss=${tm.loss} (week ${gi})`);
    if (!isNum(tm.pts)) bug('NaN/non-finite NET pts', `${tm.name}: pts=${tm.pts} (week ${gi})`);
    if (!Array.isArray(tm.sched) || tm.sched.length !== 30)
      bug('schedule length != 30', `${tm.name}: len=${tm.sched && tm.sched.length} (week ${gi})`);
    else for (let w = 0; w < 30; w++) {
      const s = tm.sched[w];
      if (s == null) continue;
      if (typeof s.opp !== 'number' || typeof s.played !== 'boolean')
        bug('malformed schedule entry', `${tm.name} w${w}: ${JSON.stringify(s).slice(0, 120)}`);
      if (s.played && (!Number.isInteger(s.uScore) || !Number.isInteger(s.oScore) || s.uScore < 0 || s.oScore < 0 || s.uScore > 400 || s.oScore > 400))
        bug('insane score in schedule', `${tm.name} w${w}: ${s.uScore}-${s.oScore}`);
    }
    for (const p of tm.rost) {
      for (const k of ['sht', 'fin', 'def', 'reb', 'ply', 'ovr', 'mins'])
        if (!isNum(p[k])) bug('NaN player attr', `${tm.name} ${p.name}: ${k}=${p[k]} (week ${gi})`);
      for (const k of ['pts', 'reb', 'ast', 'fgm', 'fga', 'stl', 'blk', 'gp'])
        if (p.s && !isNum(p.s[k])) bug('NaN player stat', `${tm.name} ${p.name}: s.${k}=${p.s[k]} (week ${gi})`);
    }
  }
}

function checkStandingsConsistency(label) {
  let bad = 0;
  for (const tm of G.teams) {
    let played = 0, confPlayed = 0;
    for (const s of tm.sched) {
      if (s && s.played) { played++; if (s.conf) confPlayed++; }
    }
    if (tm.wins + tm.loss !== played) {
      bad++;
      if (bad <= 8) bug('standings mismatch: wins+loss != played games',
        `${label}: ${tm.name} is ${tm.wins}-${tm.loss} (${tm.wins + tm.loss} results) but schedule shows ${played} played games`);
    }
    if (tm.cWins + tm.cLoss !== confPlayed)
      bug('conf standings mismatch', `${label}: ${tm.name} conf ${tm.cWins}-${tm.cLoss} but ${confPlayed} conf games played`);
  }
  if (bad > 8) note(`${label}: ${bad} total teams with wins+loss != played games (showing first 8)`);
  return bad;
}

function runRegSeason() {
  let guard = 0;
  while (G.phase === 'reg' && G.gi < 30) {
    if (++guard > 500) { bug('regular season never terminated', `stuck at gi=${G.gi} phase=${G.phase}`); return; }
    const game = G.teams[G.tid].sched[G.gi];
    if (!game || game.played) { S.simCPUWeek(); S.advanceWeek(); }
    else { S.launchSim(false); }
    if (guard % 5 === 0) checkWeekInvariants(G.gi);
  }
  checkWeekInvariants(G.gi);
  assert(G.phase === 'conf_tourn', 'phase advanced to conf_tourn after week 30', `phase=${G.phase} gi=${G.gi}`);
}

function runConfTourneys() {
  let guard = 0;
  while (!T.allConfDone()) {
    if (++guard > 3000) { bug('conf tourneys never terminated', 'possible infinite loop'); return; }
    const um = T.getUserConfMatchup();
    if (um) T.playTournamentGame(false);
    else T.advanceConfTourney();
  }
  assert(T.allConfDone(), 'all conf tourneys done', '');
  for (const conf of Object.keys(G.confTourneys)) {
    const ct = G.confTourneys[conf];
    if (!ct.done) bug('conf tourney not marked done', conf);
    if (!ct.champ) bug('conf tourney crowned NO champion', conf + ' done=' + ct.done);
    const nTeams = ct.seeds.length;
    const nGames = ct.rounds.reduce((s, r) => s + r.length, 0);
    if (nGames !== nTeams - 1)
      bug('conf tourney dropped team(s) without a game',
        `${conf}: ${nTeams} teams, ${ct.rounds.length} rounds, only ${nGames} games played (need ${nTeams - 1}); ` +
        `${nTeams - 1 - nGames} team(s) vanished`);
    for (const r of ct.rounds) for (const m of r) {
      if (!m.winner) bug('conf tourney matchup has no winner', `${conf}: ${m.t1.name} vs ${m.t2.name}`);
      if (!Number.isInteger(m.s1) || !Number.isInteger(m.s2))
        bug('conf tourney non-integer score', `${conf}: ${m.s1}-${m.s2}`);
    }
  }
}

function runNCAA() {
  if (!G.bracket.length) { bug('no NCAA bracket built after conf tourneys', ''); return; }
  assert(G.bracket.length === 64, 'NCAA bracket has 64 teams', `got ${G.bracket.length}`);
  const seeds = G.bracket.map(b => b.team.id);
  assert(new Set(seeds).size === seeds.length, 'NCAA bracket has no duplicate teams', '');
  let guard = 0;
  while (true) {
    const active = G.bracket.filter(b => b.active);
    if (active.length <= 1) break;
    if (++guard > 200) { bug('NCAA tourney never terminated', `active=${active.length}`); return; }
    const um = T.getUserNCAAmatchup();
    if (um) T.playTournamentGame(false); else T.simNCAAround();
    for (const b of G.bracket) {
      if (!isNum(b.score) && b.score !== null) bug('NCAA non-numeric score', `${b.team.name}: ${b.score}`);
    }
  }
  const champ = G.bracket.filter(b => b.active);
  assert(champ.length === 1, 'NCAA crowned exactly one champion', `active=${champ.length}`);
  if (champ.length === 1) note(`NCAA champion: ${champ[0].team.name} (seed ${champ[0].seed})`);
  assert(G.phase === 'offseason', 'endSeason ran (phase=offseason)', `phase=${G.phase}`);
}

// ═══ MAIN: full multi-season run + fuzz ═══
console.log('hoops-fuzz harness — repo:', REPO);

stage('buildUniverse + buildSchedules + setupUserOOC + genRecruits', () => {
  resetG();
  assert(G.teams.length > 0, 'universe built', '');
  note(`universe: ${G.teams.length} teams`);
  for (const tm of G.teams) {
    assert(tm.rost.length >= 10, 'roster min size', `${tm.name}: ${tm.rost.length}`);
    assert(tm.sched.length === 30, 'schedule built', `${tm.name}`);
  }
  // user OOC: every pick should be mutual
  const t = G.teams[G.tid];
  for (let w = 0; w < 10; w++) {
    const s = t.sched[w];
    if (!s) { bug('user OOC week unfilled', `week ${w} is null after setupUserOOC`); continue; }
    const opp = G.teams[s.opp];
    const back = opp.sched[w];
    if (!back || back.opp !== G.tid)
      bug('one-sided user OOC game (opponent has no matching entry)',
        `user vs ${opp.name} week ${w}: opponent sched[${w}] = ${back ? `vs ${G.teams[back.opp].name}` : 'null'}`);
  }
  // swapOOC / getAutoOOC smoke
  S.swapOOC(0, 7);
  const auto = S.getAutoOOC();
  assert(Array.isArray(auto), 'getAutoOOC returns array', '');
});

stage('season 1: full regular season', () => {
  runRegSeason();
  checkStandingsConsistency('season 1 reg');
  // save/load roundtrip mid-flow
  ST.saveState();
  const ok = ST.loadState();
  assert(ok === true, 'saveState/loadState roundtrip', `loadState returned ${ok}`);
});

stage('season 1: conference tournaments', () => { runConfTourneys(); });

stage('season 1: NCAA tournament to champion', () => { runNCAA(); });

stage('season 1: beginOffseason + doOffseason', () => {
  S.beginOffseason();
  S.doOffseason();
  assert(G.phase === 'reg' && G.gi === 0, 'new season reset', `phase=${G.phase} gi=${G.gi} yr=${G.yr}`);
  for (const tm of G.teams) {
    assert(tm.rost.length >= 10, 'post-offseason roster min', `${tm.name}: ${tm.rost.length}`);
    assert(tm.wins === 0 && tm.loss === 0, 'records reset', `${tm.name}: ${tm.wins}-${tm.loss}`);
    assert(tm.sched.length === 30, 'new schedules built', `${tm.name}`);
    for (const p of tm.rost) {
      if (p.s.gp !== 0 || p.s.pts !== 0) { bug('player stats not reset for new season', `${tm.name} ${p.name}`); break; }
    }
  }
});

stage('season 2: full run (reg + conf + ncaa + offseason)', () => {
  runRegSeason();
  checkStandingsConsistency('season 2 reg');
  runConfTourneys();
  runNCAA();
  S.beginOffseason(); S.doOffseason();
  assert(G.phase === 'reg', 'season 3 begins', `phase=${G.phase}`);
});

// ═══ simGame fuzz: rating spreads ═══
function mkTeam(base, n, minsFn) {
  const rost = [];
  for (let i = 0; i < (n === undefined ? 10 : n); i++) {
    const p = SIM.genPlayer(base, C.POS[i % 5], 'JR');
    p.mins = minsFn ? minsFn(i) : (i < 5 ? 32 : i < 9 ? 10 : 0);
    rost.push(p);
  }
  return { id: 900 + Math.floor(Math.random() * 90), name: 'FUZZ', conf: 'X', rost, strat: U.getTeamStyle('ACC', base) };
}
stage('simGame: 600 games across rating spreads', () => {
  const pairs = [[50, 50], [60, 80], [70, 70], [90, 60], [90, 90], [55, 95]];
  let minS = 1e9, maxS = -1e9, sum = 0, cnt = 0, ties = 0;
  for (const [bh, ba] of pairs) {
    for (let i = 0; i < 100; i++) {
      const h = mkTeam(bh), a = mkTeam(ba);
      const res = SIM.simGame(h, a, false);
      cnt++; sum += res.homeScore + res.awayScore;
      minS = Math.min(minS, res.homeScore, res.awayScore);
      maxS = Math.max(maxS, res.homeScore, res.awayScore);
      if (!Number.isInteger(res.homeScore) || !Number.isInteger(res.awayScore))
        bug('simGame non-integer score', `${bh}v${ba}: ${res.homeScore}-${res.awayScore}`);
      if (!isNum(res.homeScore) || !isNum(res.awayScore))
        bug('simGame NaN score', `${bh}v${ba}: ${res.homeScore}-${res.awayScore}`);
      if (res.homeScore === res.awayScore) ties++;
      if (res.homeScore < 20 || res.awayScore < 20 || res.homeScore > 200 || res.awayScore > 200)
        bug('simGame insane score', `${bh}v${ba}: ${res.homeScore}-${res.awayScore}`);
      // player stat sanity
      let pSum = 0;
      for (const p of h.rost.concat(a.rost)) {
        for (const k of ['pts', 'reb', 'ast', 'fgm', 'fga', 'stl', 'blk'])
          if (!isNum(p.s[k])) bug('simGame NaN player stat', `s.${k}=${p.s[k]}`);
        pSum += p.s.pts;
      }
      const tSum = res.homeScore + res.awayScore;
      if (pSum > tSum) bug('player pts exceed team score', `${bh}v${ba}: players=${pSum} teams=${tSum}`);
    }
  }
  note(`600 games: avg total=${(sum / cnt).toFixed(1)} min=${minS} max=${maxS} ties=${ties}`);
  assert(ties === 0, 'simGame never ties', `${ties} ties`);
});

stage('simGame: weird inputs', () => {
  // extreme bases
  for (const b of [0, 1, 99, 120]) {
    const res = SIM.simGame(mkTeam(b), mkTeam(b), false);
    assert(isNum(res.homeScore) && isNum(res.awayScore), `simGame base=${b} sane`, `${res.homeScore}-${res.awayScore}`);
  }
  // all-zero minutes (nobody "active")
  const z1 = mkTeam(70), z2 = mkTeam(70);
  z1.rost.forEach(p => p.mins = 0); z2.rost.forEach(p => p.mins = 0);
  const rz = SIM.simGame(z1, z2, false);
  assert(isNum(rz.homeScore), 'simGame all-mins-0 survives', `${rz.homeScore}-${rz.awayScore}`);
  // single-player rosters
  const s1 = mkTeam(80, 1, () => 40), s2 = mkTeam(80, 1, () => 40);
  const rs = SIM.simGame(s1, s2, false);
  assert(isNum(rs.homeScore), 'simGame 1-man roster survives', `${rs.homeScore}-${rs.awayScore}`);
  // duplicate player names across teams (origMins/fatigue keyed by name)
  const d1 = mkTeam(75), d2 = mkTeam(75);
  d1.rost.forEach((p, i) => p.name = 'Same Name ' + (i % 5));
  d2.rost.forEach((p, i) => p.name = 'Same Name ' + (i % 5));
  const before = d1.rost.map(p => p.mins).join(',') + '|' + d2.rost.map(p => p.mins).join(',');
  SIM.simGame(d1, d2, false);
  const after = d1.rost.map(p => p.mins).join(',') + '|' + d2.rost.map(p => p.mins).join(',');
  if (before !== after) bug('simGame mins not restored with duplicate player names',
    `before=${before} after=${after} (origMins keyed by name collides)`);
  // EMPTY roster — expect a crash; record it
  const e1 = mkTeam(70), e2 = { id: 1, name: 'EMPTY', conf: 'X', rost: [], strat: null };
  try {
    SIM.simGame(e1, e2, false);
    note('simGame with empty roster did NOT crash (unexpected)');
  } catch (err) {
    bug('simGame crashes on empty roster', String(err).split('\n')[0] + ' — simulation.js getFloor() returns undefined for empty roster');
  }
});

stage('simPoss: 2000 possessions', () => {
  const h = mkTeam(75), a = mkTeam(75);
  LS.clock = 1200; LS.half = 1; LS.possCount = 0;
  for (let i = 0; i < 2000; i++) {
    LS.clock = 1200 - (i % 1200); LS.half = i % 2400 < 1200 ? 1 : 2;
    const r = SIM.simPoss(i % 2 ? h : a, i % 2 ? a : h);
    if (!r || !isNum(r.pts) || r.pts < 0 || r.pts > 4) bug('simPoss bad result', JSON.stringify(r).slice(0, 160));
    if (typeof r.pbp !== 'string') bug('simPoss pbp not string', typeof r.pbp);
  }
});

stage('events.rollEvents x300', () => {
  resetG();
  for (let i = 0; i < 300; i++) EV.rollEvents(i % 30);
  note(`injuries=${G.injuries.length} buffs=${G.buffs.length}`);
});

stage('utils edge cases', () => {
  assert(U.getTOvr({ rost: [] }) === 0, 'getTOvr empty roster', '');
  assert(U.ord(1) === '1st' && U.ord(2) === '2nd' && U.ord(3) === '3rd', 'ord', '');
  U.fixMins([{ mins: 0 }]); // short roster must not crash
  const g1 = SIM.calcGrowth(SIM.genPlayer(70, 'PG', 'FR'), 70);
  assert(isNum(g1.sht), 'calcGrowth', '');
  const _sty = U.getTeamStyle('ACC', 95);
  assert(_sty && ['balanced','motion','drive','set','early'].indexOf(_sty.off) >= 0 &&
    ['man','2-3','3-2','1-3-1','box1'].indexOf(_sty.def) >= 0 &&
    typeof _sty.identity === 'string' && _sty.identity.indexOf(' / ') > 0, 'getTeamStyle', '');
});

stage('loadState with legacy (v1) save', () => {
  resetG();
  const v1 = { tid: 0, yr: 2025, phase: 'reg', difficulty: 'normal', teams: G.teams.slice(0, 5).map(t => ({ id: t.id, wins: 3, loss: 2 })) };
  _store['hoops_os_v3'] = JSON.stringify(v1);
  const ok = ST.loadState();
  assert(ok === true, 'legacy save migrates without crash', `returned ${ok}`);
});

// ═══ summary ═══
console.log('\n════════ SUMMARY ════════');
console.log(`bugs found: ${bugCount}`);
console.log(`stage crashes: ${stageErrors}`);
console.log(`notes: ${notes.length}`);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log(' -', f.stage)); }
process.exit(0);
