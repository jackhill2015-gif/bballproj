// ═══════════════════════════════════════════════════════════
//  HOOPS OS — season.js
//  High-level game loop: universe building, scheduling,
//  week advancement, game launching, auto-sim, offseason.
// ═══════════════════════════════════════════════════════════

import { ALL_TEAMS, POS, CLS, RECRUIT_STATE_POOL, COACH_FN, COACH_LN, calcSchoolPrestige, SKILL_POINT_TABLE, calcExpectations } from './constants.js';
import {
  ri, clamp, getTOvr, fixMins, freshS, getTeamStyle, getOvr, ge, txt
} from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { genPlayer, simGame, distributeStats } from './simulation.js';

// ── Late-Binding Registry ────────────────────────────────
// To avoid circular imports (season ↔ tournament ↔ ui),
// other modules register their functions here at boot time.
// season.js calls them by reference through this object.
var _ext = {
  toast: null,
  addLog: null,
  updateAll: null,
  navTo: null,
  openModal: null,
  startConfTourney: null,
  simConfRoundAll: null,
  simNCAAround: null,
  playTournamentGame: null,
  renderSeasonRecap: null
};

export function registerSeasonCallbacks(callbacks) {
  Object.keys(callbacks).forEach(function(k) {
    if (_ext.hasOwnProperty(k)) _ext[k] = callbacks[k];
  });
}

// Convenience wrappers that safely call registered functions
function toast(msg, col) { if (_ext.toast) _ext.toast(msg, col); }
function addLog(type, wk, text) { if (_ext.addLog) _ext.addLog(type, wk, text); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }
function navTo(v) { if (_ext.navTo) _ext.navTo(v); }

// ═══════════════════════════════════════════════════════════
//  UNIVERSE BUILDING
// ═══════════════════════════════════════════════════════════

export function buildUniverse() {
  G.teams = [];
  ALL_TEAMS.forEach(function(td, i) {
    var rost = [];
    for (var j = 0; j < 13; j++) {
      rost.push(genPlayer(td.o, POS[j % 5], CLS[ri(0, 3)]));
    }
    fixMins(rost);
    var strat = getTeamStyle(td.c, td.o);
    var sp = calcSchoolPrestige(td.o);

    // Generate NPC coach
    var npcCoach = {
      firstName: COACH_FN[ri(0, COACH_FN.length - 1)],
      lastName: COACH_LN[ri(0, COACH_LN.length - 1)],
      age: ri(35, 65),
      off: clamp(sp + ri(-15, 15), 40, 99),
      def: clamp(sp + ri(-15, 15), 40, 99),
      dev: clamp(sp + ri(-15, 15), 40, 99),
      rec: clamp(sp + ri(-15, 15), 40, 99),
      tenure: ri(1, 12),
      wins: 0, loss: 0
    };

    G.teams.push({
      id: i, name: td.n, conf: td.c, baseOvr: td.o, rost: rost,
      wins: 0, loss: 0, cWins: 0, cLoss: 0,
      pts: td.o * 10 + ri(-30, 30),
      sched: [], streak: 0,
      ts: { pts: 0, opp: 0, fgm: 0, fga: 0, games: 0 },
      strat: strat,
      schoolPrestige: sp,
      coach: npcCoach,
      coachHistory: []
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  SCHEDULE BUILDING
// ═══════════════════════════════════════════════════════════

export function buildSchedules() {
  var tid = G.tid;
  var t = G.teams[tid];
  G.teams[tid].sched = [];

  // Build tier-appropriate OOC pool
  var myOvr = getTOvr(t);
  var oocPool = [];
  if (myOvr >= 85) {
    oocPool = G.teams.filter(function(x) { return x.id !== tid && x.conf !== t.conf && getTOvr(x) >= 78; });
  } else if (myOvr >= 75) {
    oocPool = G.teams.filter(function(x) { return x.id !== tid && x.conf !== t.conf && getTOvr(x) >= 68; });
  } else {
    oocPool = G.teams.filter(function(x) { return x.id !== tid && x.conf !== t.conf; });
  }
  oocPool.sort(function() { return 0.5 - Math.random(); });
  var picks = oocPool.slice(0, 10);
  while (picks.length < 10) {
    var extra;
    do { extra = ri(0, G.teams.length - 1); }
    while (extra === tid || picks.some(function(p) { return p.id === extra; }));
    picks.push(G.teams[extra]);
  }
  for (var w = 0; w < 10; w++) {
    G.teams[tid].sched.push({
      opp: picks[w].id, home: w % 2 === 0,
      conf: false, played: false, uScore: 0, oScore: 0
    });
  }
  // Override with any manual NC picks
  SetupState.NC_PICKS.forEach(function(id, i) {
    G.teams[tid].sched[i] = {
      opp: id, home: i % 2 === 0,
      conf: false, played: false, uScore: 0, oScore: 0
    };
  });
  // Conference games 10–29
  var conf = G.teams.filter(function(x) { return x.conf === t.conf && x.id !== tid; });
  for (var w2 = 0; w2 < 20; w2++) {
    G.teams[tid].sched.push({
      opp: conf[w2 % conf.length].id, home: w2 % 2 === 0,
      conf: true, played: false, uScore: 0, oScore: 0
    });
  }
  // CPU teams schedules
  G.teams.forEach(function(tm) {
    if (tm.id === tid) return;
    tm.sched = [];
    var tconf = G.teams.filter(function(x) { return x.conf === tm.conf && x.id !== tm.id; });
    for (var w3 = 0; w3 < 10; w3++) {
      var opp;
      do { opp = ri(0, G.teams.length - 1); } while (opp === tm.id);
      tm.sched.push({
        opp: opp, home: ri(0, 1) === 1,
        conf: false, played: false, uScore: 0, oScore: 0
      });
    }
    for (var w4 = 0; w4 < 20; w4++) {
      tm.sched.push({
        opp: tconf[w4 % tconf.length].id, home: w4 % 2 === 0,
        conf: true, played: false, uScore: 0, oScore: 0
      });
    }
  });
  G.gi = 0;
}

export function getAutoOOC() {
  return G.teams[G.tid].sched.slice(0, 10)
    .filter(function(s) { return s && s.opp !== undefined; })
    .map(function(s) { return G.teams[s.opp]; });
}

export function swapOOC(slot, newTeamId) {
  if (slot < 0 || slot > 9) return;
  G.teams[G.tid].sched[slot] = {
    opp: newTeamId, home: slot % 2 === 0,
    conf: false, played: false, uScore: 0, oScore: 0
  };
  saveState();
}

// ═══════════════════════════════════════════════════════════
//  RECRUITING
// ═══════════════════════════════════════════════════════════

export function genRecruits() {
  G.recruits = [];
  // Star distribution: 10x5★, 40x4★, 100x3★, 150x2★, 100x1★ = 400 total
  var starDist = [];
  var i;
  for (i = 0; i < 10; i++) starDist.push(5);
  for (i = 0; i < 40; i++) starDist.push(4);
  for (i = 0; i < 100; i++) starDist.push(3);
  for (i = 0; i < 150; i++) starDist.push(2);
  for (i = 0; i < 100; i++) starDist.push(1);

  for (i = 0; i < starDist.length; i++) {
    var star = starDist[i];
    var base = star === 5 ? ri(82, 92) : star === 4 ? ri(74, 84) : star === 3 ? ri(66, 76) : star === 2 ? ri(58, 68) : ri(50, 60);
    var r = genPlayer(base, POS[ri(0, 4)], 'FR');
    r.id = i; r.stars = star; r.interest = ri(0, 25); r.signed = -1;
    r.points = 0; r.status = 'open';
    r.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
    G.recruits.push(r);
  }
  // Sort by OVR descending, then assign national rank
  G.recruits.sort(function(a, b) { return b.ovr - a.ovr; });
  G.recruits.forEach(function(r, idx) { r.id = idx; r.natRank = idx + 1; });
  // Assign positional rank
  var posCount = {};
  G.recruits.forEach(function(r) {
    if (!posCount[r.pos]) posCount[r.pos] = 0;
    posCount[r.pos]++;
    r.posRank = posCount[r.pos];
  });
  // Assign persistent rival schools (3-5 CPU schools interested in each recruit)
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  G.recruits.forEach(function(r) {
    var rivalCount = ri(3, 5);
    // Higher-star recruits attract higher-ranked schools
    var poolSize = r.stars >= 5 ? 25 : r.stars >= 4 ? 50 : r.stars >= 3 ? 100 : r.stars >= 2 ? 200 : 332;
    var pool = ranked.slice(0, poolSize).filter(function(t) { return t.id !== G.tid; });
    // Shuffle and pick
    for (var j = pool.length - 1; j > 0; j--) {
      var k = ri(0, j); var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
    }
    r.rivals = pool.slice(0, rivalCount).map(function(t) {
      return { tid: t.id, name: t.name };
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  CPU WEEK SIMULATION
// ═══════════════════════════════════════════════════════════

export function simCPUWeek() {
  var done = new Set();
  G.teams.forEach(function(t) {
    if (t.id === G.tid || done.has(t.id)) return;
    var s = t.sched[G.gi];
    if (!s || s.played || s.opp === undefined || s.opp === null) return;
    var opp = G.teams[s.opp];
    if (!opp || done.has(opp.id)) return;
    if (opp.id === G.tid) return;
    var res = simGame(t, opp, false);
    var s1 = res.homeScore, s2 = res.awayScore;
    if (s1 > s2) {
      t.wins++; t.pts += 45; opp.loss++; opp.pts -= 15;
      if (s.conf) { t.cWins++; opp.cLoss++; }
    } else {
      opp.wins++; opp.pts += 45; t.loss++; t.pts -= 15;
      if (s.conf) { opp.cWins++; t.cLoss++; }
    }
    s.played = true;
    if (opp.id !== G.tid) { var sg = opp.sched[G.gi]; if (sg) sg.played = true; }
    t.ts.pts += s1; t.ts.opp += s2; t.ts.games++;
    opp.ts.pts += s2; opp.ts.opp += s1; opp.ts.games++;
    distributeStats(t, s1);
    distributeStats(opp, s2);
    done.add(t.id); done.add(opp.id);
  });
  // CPU recruit drift
  G.recruits.forEach(function(r) {
    if (r.signed >= 0) return;
    if (ri(1, 100) < 20) {
      r.interest = Math.min(100, r.interest + ri(4, 14));
      if (r.interest >= 100) r.signed = ri(0, G.teams.length - 1);
    }
  });
  // Rank-based NIL earnings
  var _nilRanked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var _nilRank = _nilRanked.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var _nilEarn = _nilRank <= 25 ? 40 : _nilRank <= 64 ? 30 : _nilRank <= 150 ? 22 : 14;
  G.pts += _nilEarn;
}

// ═══════════════════════════════════════════════════════════
//  RECORD RESULT (user game)
// ═══════════════════════════════════════════════════════════

export function recordResult() {
  var game = LS.game;
  if (game.played) return;
  game.played = true;
  var uHome = game.home;
  var uScore = uHome ? LS.hs : LS.as;
  var oScore = uHome ? LS.as : LS.hs;
  game.uScore = uScore;
  game.oScore = oScore;
  var won = uScore > oScore;
  var t = G.teams[G.tid], opp = uHome ? LS.tA : LS.tH;
  if (won) {
    t.wins++; opp.loss++; opp.pts -= 15;
    if (game.conf) { t.cWins++; opp.cLoss++; }
    // Quality win bonus: more pts for beating ranked teams
    var oppRank = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === opp.id; }) + 1;
    var winBonus = oppRank <= 10 ? 65 : oppRank <= 25 ? 55 : oppRank <= 64 ? 45 : 35;
    t.pts += winBonus;
  } else {
    t.loss++; opp.wins++; opp.pts += 45;
    if (game.conf) { t.cLoss++; opp.cWins++; }
    // Bad loss penalty: lose more pts for losing to weak teams
    var oppRank2 = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === opp.id; }) + 1;
    var lossPenalty = oppRank2 > 150 ? -35 : oppRank2 > 64 ? -25 : -15;
    t.pts += lossPenalty;
  }
  [LS.tH, LS.tA].forEach(function(tm) {
    tm.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
  });
  addLog(won ? 'w' : 'l', G.gi + 1,
    '<b>' + (won ? 'W' : 'L') + '</b> vs <b>' + opp.name + '</b>  ' + uScore + '\u2013' + oScore);
  toast((won ? 'W ' : 'L ') + uScore + '-' + oScore + ' vs ' + opp.name,
    won ? 'var(--grn)' : 'var(--red)');
}

// ═══════════════════════════════════════════════════════════
//  ADVANCE WEEK
// ═══════════════════════════════════════════════════════════

export function advanceWeek() {
  G.gi++;
  G.wk = G.gi;
  if (G.gi >= 30 && G.phase === 'reg') {
    G.phase = 'conf_tourn';
    saveState();
    updateAll();
    if (_ext.startConfTourney) _ext.startConfTourney();
    return;
  }
  saveState();
  updateAll();
}

// ═══════════════════════════════════════════════════════════
//  LAUNCH SIM (user game — quick or live)
// ═══════════════════════════════════════════════════════════

export function launchSim(watch) {
  var t = G.teams[G.tid];
  var game = t.sched[G.gi];
  if (!game) { toast('No game scheduled \u2014 game ' + G.gi); return; }
  var tH = game.home ? t : G.teams[game.opp];
  var tA = game.home ? G.teams[game.opp] : t;
  G.momentum = { tid: -1, pts: 0 };
  // Set up LS
  LS.tH = tH; LS.tA = tA; LS.game = game; LS.userTeam = t;
  LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0;
  LS.h1 = null; LS.a1 = null; LS.poss = 'A';
  LS.streak_h = 0; LS.streak_a = 0;
  if (watch) {
    if (_ext.openModal) _ext.openModal(tH, tA);
  } else {
    var res = simGame(tH, tA, game.home);
    LS.hs = res.homeScore; LS.as = res.awayScore;
    recordResult();
    simCPUWeek();
    advanceWeek();
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAY BUTTON DISPATCHER
// ═══════════════════════════════════════════════════════════

export function doPlay(mode) {
  var dd = ge('play-dropdown');
  if (dd) dd.classList.remove('open');

  if (mode === 'auto') {
    if (SetupState.G_AUTO) {
      SetupState.G_AUTO = false;
      updateAutoBtn();
      return;
    } else {
      SetupState.G_AUTO = true;
      updateAutoBtn();
      autoSimNext();
      return;
    }
  }
  // Manual play — stop any running auto sim
  SetupState.G_AUTO = false;
  updateAutoBtn();

  if (G.phase === 'reg' && G.gi < 30) {
    launchSim(mode === 'live');
  } else if (G.phase === 'reg' && G.gi >= 30) {
    G.phase = 'conf_tourn';
    if (_ext.startConfTourney) _ext.startConfTourney();
  } else if (G.phase === 'conf_tourn' || G.phase === 'ncaa') {
    if (_ext.playTournamentGame) _ext.playTournamentGame(mode === 'live');
  } else if (G.phase === 'offseason') {
    if (G.offseasonStep === 'turnover') {
      if (window.proceedToRecruiting) window.proceedToRecruiting();
    } else if (G.recruitPhase < 3) {
      if (window.advanceRecruitPhase) window.advanceRecruitPhase();
    } else {
      doOffseason();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  AUTO-SIM
// ═══════════════════════════════════════════════════════════

export function updateAutoBtn() {
  var lbl = ge('auto-label'), sub = ge('auto-sub'), opt = ge('auto-opt');
  if (!lbl) return;
  if (SetupState.G_AUTO) {
    lbl.textContent = 'Stop Auto Sim';
    lbl.style.color = 'var(--red)';
    if (sub) sub.textContent = 'Click to stop';
    if (opt) opt.style.background = 'rgba(229,62,62,.06)';
  } else {
    lbl.textContent = 'Auto Sim Season';
    lbl.style.color = '';
    if (sub) sub.textContent = 'Runs until you stop';
    if (opt) opt.style.background = '';
  }
}

export function autoSimNext() {
  if (!SetupState.G_AUTO) return;

  // Tournament phases
  if (G.phase === 'conf_tourn') {
    if (_ext.playTournamentGame) _ext.playTournamentGame(false);
    if (SetupState.G_AUTO) setTimeout(autoSimNext, 500);
    return;
  }
  if (G.phase === 'ncaa') {
    if (_ext.playTournamentGame) _ext.playTournamentGame(false);
    if (SetupState.G_AUTO) setTimeout(autoSimNext, 500);
    return;
  }
  if (G.phase === 'offseason' || G.phase === 'recap') {
    SetupState.G_AUTO = false;
    updateAutoBtn();
    return;
  }
  // Season done — advance
  if (G.gi >= 30 && G.phase === 'reg') {
    SetupState.G_AUTO = false;
    updateAutoBtn();
    advanceWeek();
    return;
  }

  var t = G.teams[G.tid];
  var game = t.sched[G.gi];

  // Skip empty slot
  if (!game || game.played) {
    G.gi++; G.wk = G.gi;
    saveState(); updateAll();
    setTimeout(autoSimNext, 50);
    return;
  }

  // Sim user game
  var tH = game.home ? t : G.teams[game.opp];
  var tA = game.home ? G.teams[game.opp] : t;
  LS.tH = tH; LS.tA = tA; LS.game = game; LS.userTeam = t;
  LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0;
  LS.h1 = null; LS.a1 = null; LS.poss = 'A';
  var res = simGame(tH, tA, game.home);
  LS.hs = res.homeScore; LS.as = res.awayScore;
  recordResult();
  simCPUWeek();

  // Finish line — game 29 is the 30th game
  if (G.gi >= 29) {
    SetupState.G_AUTO = false;
    updateAutoBtn();
    advanceWeek();
    return;
  }

  G.gi++; G.wk = G.gi;
  saveState(); updateAll();
  setTimeout(autoSimNext, 320);
}

// ═══════════════════════════════════════════════════════════
//  END OF SEASON
// ═══════════════════════════════════════════════════════════

export function recordSeasonHistory(source) {
  if (!G.history) G.history = [];
  var t = G.teams[G.tid];
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var tf = source === 'conf_elim' ? 'Conf Tourney' :
    G.championships > 0 ? 'CHAMP' :
    G.bracket && G.bracket.filter(function(b) { return b.active; }).length <= 2 ? 'Runner-Up' :
    G.bracket && G.bracket.filter(function(b) { return b.active; }).length <= 4 ? 'Final Four' :
    G.bracket && G.bracket.filter(function(b) { return b.active; }).length <= 8 ? 'Elite Eight' :
    G.bracket && G.bracket.filter(function(b) { return b.active; }).length <= 16 ? 'Sweet 16' :
    G.bracket && G.bracket.filter(function(b) { return b.active; }).length <= 32 ? 'Round of 32' :
    rank <= 64 ? 'Round of 64' : 'Did Not Qualify';
  // Don't duplicate
  if (G.history.find(function(h) { return h.year === G.yr; })) return;
  G.history.push({
    year: G.yr, wins: t.wins, loss: t.loss, rank: rank,
    confTitle: G.confTitles > 0, championship: G.championships > 0,
    tourneyFinish: tf,
    note: t.wins + '-' + t.loss + ' \u00b7 #' + rank + ' NET \u00b7 ' + tf
  });
}

export function endSeason() {
  // Record league champ if not already
  var still = G.bracket.filter(function(b) { return b.active; });
  if (still.length === 1) {
    if (!G.leagueChamps) G.leagueChamps = [];
    var ch = still[0].team;
    if (!G.leagueChamps.find(function(c) { return c.year === G.yr; }))
      G.leagueChamps.push({ year: G.yr, name: ch.name, tid: ch.id });
  }
  recordSeasonHistory('ncaa');
  showRecap();
  saveState();
}

export function showRecap() {
  var rs = ge('recap-screen');
  if (!rs) return;
  rs.classList.add('open');
  var rc = ge('recap-content');
  if (rc && _ext.renderSeasonRecap) rc.innerHTML = _ext.renderSeasonRecap();
}

export function beginOffseason() {
  var rs = ge('recap-screen');
  if (rs) rs.classList.remove('open');
  G.phase = 'offseason';

  // Calculate departing players
  var t = G.teams[G.tid];
  G.departingPlayers = [];
  t.rost.forEach(function(p) {
    var gp = p.s.gp || 0;
    var ppg = gp > 0 ? p.s.pts / gp : 0;
    if (p.cls === 'SR') {
      G.departingPlayers.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, reason: 'Graduated', ppg: ppg.toFixed(1), rpg: gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0', apg: gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0', mins: p.mins });
    } else if (ppg >= 16 && p.cls !== 'FR') {
      G.departingPlayers.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, reason: 'Declared for Draft', ppg: ppg.toFixed(1), rpg: gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0', apg: gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0', mins: p.mins });
    }
  });

  G.offseasonStep = 'turnover';
  G.recruitPhase = 0;
  G.recruitTargets = [];
  saveState(); updateAll(); navTo('offseason');
}

// ═══════════════════════════════════════════════════════════
//  OFFSEASON
// ═══════════════════════════════════════════════════════════

export function doOffseason() {
  var t = G.teams[G.tid];

  // Resolve recruiting class from point allocations
  if (window.resolveRecruitingClass) window.resolveRecruitingClass();

  var commits = G.recruits.filter(function(r) { return r.signed === G.tid; });

  // Age up / develop returning players (coach DEV rating affects growth)
  var devBonus = Math.round((G.coach.dev - 70) / 15); // -2 to +2 based on DEV rating
  t.rost.forEach(function(p) {
    if (p.cls === 'SR') return;
    ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) {
      p[a] = clamp(p[a] + ri(-1, 4) + devBonus, 38, 99);
    });
    p.ovr = getOvr(p);
    if (p.pot && p.ovr > p.pot) p.pot = p.ovr; // pot can't be below ovr
    var idx = CLS.indexOf(p.cls);
    if (idx < 3) p.cls = CLS[idx + 1];
  });

  // Remove seniors
  t.rost = t.rost.filter(function(p) { return p.cls !== 'SR'; });

  // Add commits
  commits.forEach(function(r) {
    var np = JSON.parse(JSON.stringify(r));
    np.s = freshS(); np.cls = 'FR';
    t.rost.push(np);
  });

  // Fill roster to minimum
  while (t.rost.length < 10) {
    var np = genPlayer(ri(62, 74), POS[ri(0, 4)], 'FR');
    np.s = freshS();
    t.rost.push(np);
  }
  fixMins(t.rost);

  // Advance year
  G.yr++; G.wk = 0; G.gi = 0; G.phase = 'reg';
  G.bracket = []; G.confTourneys = {};

  // Reset recruiting budget for next cycle
  G.recruitingBudget = 0;
  G.recruitingSpent = 0;

  // Rank-based offseason NIL bonus
  var _osRanked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var _osRank = _osRanked.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var _osBonus = _osRank <= 10 ? 200 : _osRank <= 25 ? 150 : _osRank <= 64 ? 100 : _osRank <= 150 ? 70 : 40;
  G.pts += _osBonus;

  // Reset all teams for new season
  G.teams.forEach(function(tm) {
    tm.wins = 0; tm.loss = 0; tm.cWins = 0; tm.cLoss = 0; tm.sched = [];
    tm.ts = { pts: 0, opp: 0, fgm: 0, fga: 0, games: 0 }; tm.streak = 0;
    tm.rost.forEach(function(p) { p.s = freshS(); });
    if (tm.id !== G.tid) {
      tm.rost = tm.rost.filter(function(p) { return p.cls !== 'SR'; });
      tm.rost.forEach(function(p) {
        var i = CLS.indexOf(p.cls);
        if (i < 3) p.cls = CLS[i + 1];
        p.s = freshS();
      });
      while (tm.rost.length < 10) {
        var np2 = genPlayer(tm.baseOvr, POS[ri(0, 4)], 'FR');
        np2.s = freshS();
        tm.rost.push(np2);
      }
      fixMins(tm.rost);
    }
  });

  buildSchedules();
  genRecruits();
  addLog('ev', 0, 'Season ' + G.yr + ' begins.');
  toast('Season ' + G.yr + ' starts now!');
  saveState(); updateAll(); navTo('dashboard');
}
