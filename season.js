// ═══════════════════════════════════════════════════════════
//  HOOPS OS — season.js
//  High-level game loop: universe building, scheduling,
//  week advancement, game launching, auto-sim, offseason.
// ═══════════════════════════════════════════════════════════

import { recomputeRatings, snapshotRanks } from './ratings.js';
import { ensureGoals, noteUserResult, settleGoals, checkAchievements } from './goals.js';
import { practiceBonus, trainingChance, facilitiesFor } from './facilities.js';
import { payGate, payTvShare, ledger as financeLedger } from './finance.js';
import { ALL_TEAMS, POS, CLS, RECRUIT_STATE_POOL, COACH_FN, COACH_LN, calcSchoolPrestige, SKILL_POINT_TABLE, calcExpectations } from './constants.js';
import {
  ri, clamp, getTOvr, fixMins, freshS, autoLineup, getTeamStyle, getOvr, ge, txt, fmtScore,
  awardScore, pickPositionalTeam
} from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { genPlayer, simGame, calcGrowth } from './simulation.js';
import { recordGameMorale } from './morale.js';
import { rollEvents } from './events.js';
import {
  snapRoster, diffRoster, userLinesFromRes, surfaceUserGameRecords,
  processSeasonRecords, clearSeasonBreaks
} from './records.js';

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
  renderSeasonRecap: null,
  updateAdvance: null
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

// Non-conference home court: like real "buy games", the bigger program
// usually hosts. Stronger school hosts 80% of the time.
function oocHostIsFirst(a, b) {
  var pa = a.schoolPrestige || 50, pb = b.schoolPrestige || 50;
  if (pa === pb) return ri(0, 1) === 0;
  var strongerIsA = pa > pb;
  return ri(1, 100) <= 80 ? strongerIsA : !strongerIsA;
}

export function buildSchedules() {
  var tid = G.tid;

  // Clear all schedules
  G.teams.forEach(function(tm) { tm.sched = []; for (var i = 0; i < 30; i++) tm.sched.push(null); });

  // ── STEP 1: Conference games (weeks 10-29) ──
  var confs = {};
  G.teams.forEach(function(tm) {
    if (!confs[tm.conf]) confs[tm.conf] = [];
    confs[tm.conf].push(tm.id);
  });

  Object.keys(confs).forEach(function(conf) {
    var ids = confs[conf];
    // Odd-sized conferences can't fill 20 games (bye each week); cap at 18.
    // The 2 open weeks become cross-conference games via Step 3.
    var maxConf = ids.length % 2 === 1 && ids.length > 2 ? (ids.length <= 9 ? 16 : 18) : 20;
    // For each team, schedule conference games against conference opponents
    ids.forEach(function(teamId) {
      var opponents = ids.filter(function(x) { return x !== teamId; });
      // Shuffle opponents
      for (var s = opponents.length - 1; s > 0; s--) {
        var k = ri(0, s); var tmp = opponents[s]; opponents[s] = opponents[k]; opponents[k] = tmp;
      }
      var gameCount = 0;
      var oppIdx = 0;
      for (var w = 10; w < 30; w++) {
        if (G.teams[teamId].sched[w]) continue; // already filled by a paired matchup
        if (gameCount >= maxConf) break;
        // Find an opponent that's free this week
        var found = false;
        for (var attempt = 0; attempt < opponents.length; attempt++) {
          var oppId = opponents[(oppIdx + attempt) % opponents.length];
          if (!G.teams[oppId].sched[w]) {
            var home = gameCount % 2 === 0;
            var hid = home ? teamId : oppId;
            var aid = home ? oppId : teamId;
            G.teams[hid].sched[w] = { opp: aid, home: true, conf: true, played: false, uScore: 0, oScore: 0 };
            G.teams[aid].sched[w] = { opp: hid, home: false, conf: true, played: false, uScore: 0, oScore: 0 };
            gameCount++;
            oppIdx = (oppIdx + attempt + 1) % opponents.length;
            found = true;
            break;
          }
        }
        if (!found) {
          // No free opponent (odd conference bye week) — leave the bye.
          // Step 3 pairs bye weeks across conferences as OOC games.
          oppIdx++;
        }
      }
    });
  });

  // ── STEP 2: OOC games (weeks 0-9) ──
  // For CPU teams, pair them across conferences
  G.teams.forEach(function(tm) {
    if (tm.id === tid) return;
    for (var w = 0; w < 10; w++) {
      if (tm.sched[w]) continue;
      // Find a cross-conference opponent free this week
      for (var j = 0; j < G.teams.length; j++) {
        var other = G.teams[j];
        if (other.id === tm.id || other.id === tid || other.conf === tm.conf) continue;
        if (other.sched[w]) continue;
        var tmHosts = oocHostIsFirst(tm, other);
        tm.sched[w] = { opp: other.id, home: tmHosts, conf: false, played: false, uScore: 0, oScore: 0 };
        other.sched[w] = { opp: tm.id, home: !tmHosts, conf: false, played: false, uScore: 0, oScore: 0 };
        break;
      }
    }
  });

  // ── STEP 3: Fill any remaining nulls ──
  // Pair bye weeks week-by-week: collect all teams with a null in week w,
  // shuffle, and pair them as cross-conf OOC games. If the count is odd,
  // one team keeps the bye (unavoidable with 99 odd-conf teams).
  for (var w = 0; w < 30; w++) {
    var needGame = [];
    for (var ti = 0; ti < G.teams.length; ti++) {
      var t = G.teams[ti];
      if (t.id === tid) continue;
      if (!t.sched[w]) needGame.push(t);
    }
    // Shuffle
    for (var a = needGame.length - 1; a > 0; a--) {
      var b = ri(0, a);
      var tmpT = needGame[a]; needGame[a] = needGame[b]; needGame[b] = tmpT;
    }
    // Pair up (leave last unpaired if odd)
    for (var p = 0; p + 1 < needGame.length; p += 2) {
      var t1 = needGame[p], t2 = needGame[p + 1];
      var h = oocHostIsFirst(t1, t2);
      t1.sched[w] = { opp: t2.id, home: h, conf: false, played: false, uScore: 0, oScore: 0 };
      t2.sched[w] = { opp: t1.id, home: !h, conf: false, played: false, uScore: 0, oScore: 0 };
    }
  }

  G.gi = 0;
  recomputeRatings(); // preseason rankings from roster strength
}

// ── Assign user's OOC picks into the master schedule as matched pairs ──
// Balanced non-conference slate: 3 tough, 4 even, 3 easier (by team overall)
export function pickBalancedOOC() {
  var me = G.teams[G.tid], myOvr = getTOvr(me);
  var pool = G.teams.filter(function(t) { return t.conf !== me.conf && t.id !== G.tid; });
  var shuf = function(a) { return a.sort(function() { return 0.5 - Math.random(); }); };
  var tough = shuf(pool.filter(function(t) { return Math.abs(getTOvr(t) - myOvr) <= 6 && getTOvr(t) >= myOvr; })).slice(0, 3);
  var mid = shuf(pool.filter(function(t) { return getTOvr(t) >= myOvr - 11 && getTOvr(t) < myOvr + 4; })).slice(0, 4);
  var easy = shuf(pool.filter(function(t) { return getTOvr(t) < myOvr - 8; })).slice(0, 3);
  var seen = {}, picks = [];
  tough.concat(mid).concat(easy).forEach(function(t) { if (!seen[t.id] && picks.length < 10) { seen[t.id] = true; picks.push(t.id); } });
  // Short on any band: fill with the closest-rated teams left, never a
  // random blowout either way
  shuf(pool.slice()).sort(function(a, b) { return Math.abs(getTOvr(a) - myOvr) - Math.abs(getTOvr(b) - myOvr); })
    .forEach(function(t) { if (!seen[t.id] && picks.length < 10) { seen[t.id] = true; picks.push(t.id); } });
  return picks;
}

if (typeof window !== 'undefined') window._pickBalancedOOC = pickBalancedOOC;

export function setupUserOOC() {
  var tid = G.tid;
  var picks = SetupState.NC_PICKS || [];
  var assigned = 0;
  picks.forEach(function(oppId) {
    // Find a week 0-9 where BOTH user and opponent are free
    for (var w = 0; w < 10; w++) {
      if (G.teams[tid].sched[w] || G.teams[oppId].sched[w]) continue;
      var home = assigned % 2 === 0;
      G.teams[tid].sched[w] = { opp: oppId, home: home, conf: false, played: false, uScore: 0, oScore: 0 };
      G.teams[oppId].sched[w] = { opp: tid, home: !home, conf: false, played: false, uScore: 0, oScore: 0 };
      assigned++;
      return;
    }
    // If no shared free week, take a free user week and displace the
    // opponent's existing game (their old opponent gets a bye) so the new
    // game is still written on BOTH sides. Never create a one-sided game.
    for (var w2 = 0; w2 < 10; w2++) {
      if (!G.teams[tid].sched[w2]) {
        var home2 = assigned % 2 === 0;
        var oppOld = G.teams[oppId].sched[w2];
        if (oppOld && oppOld.opp !== undefined && oppOld.opp !== tid) {
          var orphan2 = G.teams[oppOld.opp];
          if (orphan2 && orphan2.sched[w2] && orphan2.sched[w2].opp === oppId) {
            orphan2.sched[w2] = null;
          }
        }
        G.teams[tid].sched[w2] = { opp: oppId, home: home2, conf: false, played: false, uScore: 0, oScore: 0 };
        G.teams[oppId].sched[w2] = { opp: tid, home: !home2, conf: false, played: false, uScore: 0, oScore: 0 };
        assigned++;
        return;
      }
    }
  });
}

export function getAutoOOC() {
  return G.teams[G.tid].sched.slice(0, 10)
    .filter(function(s) { return s && s.opp !== undefined; })
    .map(function(s) { return G.teams[s.opp]; });
}

export function swapOOC(slot, newTeamId) {
  if (slot < 0 || slot > 9) return;
  var tid = G.tid;
  var newOpp = G.teams[newTeamId];
  if (!newOpp || newTeamId === tid) return;
  var oldEntry = G.teams[tid].sched[slot];
  var oldOppId = oldEntry ? oldEntry.opp : null;

  // 1. Orphan handling: the previous opponent's mirrored entry becomes a bye
  if (oldOppId !== null && oldOppId !== undefined && oldOppId !== newTeamId) {
    var oldOpp = G.teams[oldOppId];
    if (oldOpp && oldOpp.sched[slot] && oldOpp.sched[slot].opp === tid) {
      oldOpp.sched[slot] = null;
    }
  }

  // 2. If the new opponent already had a game this week, void it (their old
  //    opponent gets a bye) so we don't orphan a third team
  if (newOpp.sched[slot]) {
    var displacedId = newOpp.sched[slot].opp;
    if (displacedId !== undefined && displacedId !== null && displacedId !== tid) {
      var displaced = G.teams[displacedId];
      if (displaced && displaced.sched[slot] && displaced.sched[slot].opp === newTeamId) {
        displaced.sched[slot] = null;
      }
    }
  }

  // 3. Write both sides of the new matchup
  var home = slot % 2 === 0;
  G.teams[tid].sched[slot] = {
    opp: newTeamId, home: home,
    conf: false, played: false, uScore: 0, oScore: 0
  };
  newOpp.sched[slot] = {
    opp: tid, home: !home,
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
    var poolSize = r.stars >= 5 ? 25 : r.stars >= 4 ? 50 : r.stars >= 3 ? 100 : r.stars >= 2 ? 200 : G.teams.length;
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
  var simmed = new Set(); // track "teamA-teamB" pairs already simmed this week
  G.teams.forEach(function(t) {
    if (t.id === G.tid) return;
    var s = t.sched[G.gi];
    if (!s || s.played || s.opp === undefined || s.opp === null) return;
    var opp = G.teams[s.opp];
    if (!opp || opp.id === G.tid) return;

    // Check if we already simmed this pair (matched game)
    var pairKey = Math.min(t.id, opp.id) + '-' + Math.max(t.id, opp.id);
    if (simmed.has(pairKey)) { s.played = true; return; }
    simmed.add(pairKey);

    var homeTeam = s.home ? t : opp;
    var awayTeam = s.home ? opp : t;
    var res = simGame(homeTeam, awayTeam, false);
    var hScore = res.homeScore, aScore = res.awayScore;

    // Record results for both teams
    if (hScore > aScore) {
      homeTeam.wins++; awayTeam.loss++;
      if (s.conf) { homeTeam.cWins++; awayTeam.cLoss++; }
      recordGameMorale(homeTeam, awayTeam);
    } else {
      awayTeam.wins++; homeTeam.loss++;
      if (s.conf) { awayTeam.cWins++; homeTeam.cLoss++; }
      recordGameMorale(awayTeam, homeTeam);
    }

    // Mark both sides as played
    s.played = true;
    s.uScore = s.home ? hScore : aScore;
    s.oScore = s.home ? aScore : hScore;
    var oppSched = opp.sched[G.gi];
    if (oppSched && oppSched.opp === t.id) {
      oppSched.played = true;
      oppSched.uScore = oppSched.home ? hScore : aScore;
      oppSched.oScore = oppSched.home ? aScore : hScore;
    }

    // Stats
    homeTeam.ts.pts += hScore; homeTeam.ts.opp += aScore; homeTeam.ts.games++;
    awayTeam.ts.pts += aScore; awayTeam.ts.opp += hScore; awayTeam.ts.games++;
  });
  // CPU recruit drift
  G.recruits.forEach(function(r) {
    if (r.signed >= 0) return;
    if (ri(1, 100) < 20) {
      r.interest = Math.min(100, r.interest + ri(4, 14));
      if (r.interest >= 100) r.signed = ri(0, G.teams.length - 1);
    }
  });
  // (NIL now comes from named sources — see finance.js — not a weekly drip)
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
  // Box score for your game (both teams), from the sim's per-game lines
  // (quick sim) or a before/after diff (watched game)
  try {
    var _bx = function(lines) {
      return (lines || []).filter(function(L) { return L.p && (L.p.mins > 0 || L.pts || L.reb || L.ast); })
        .map(function(L) { return [L.p.name, L.p.pos, L.pts || 0, L.reb || 0, L.ast || 0, L.stl || 0, L.blk || 0]; })
        .sort(function(a, b) { return b[2] - a[2]; });
    };
    var hl = null, al = null;
    if (LS._boxPlines) { hl = LS._boxPlines.h && LS._boxPlines.h.lines; al = LS._boxPlines.a && LS._boxPlines.a.lines; }
    else if (LS._recPre) { hl = diffRoster(LS.tH, LS._recPre.h); al = diffRoster(LS.tA, LS._recPre.a); }
    if (hl || al) game.box = uHome ? { u: _bx(hl), o: _bx(al) } : { u: _bx(al), o: _bx(hl) };
  } catch (e) { /* box score is optional */ }
  LS._boxPlines = null;
  var won = uScore > oScore;
  var t = G.teams[G.tid], opp = uHome ? LS.tA : LS.tH;
  // S1: mirror the result onto the OPPONENT's schedule entry so their
  // played-games count stays in sync with wins+losses
  var oppEntry = opp.sched[G.gi];
  if (oppEntry && oppEntry.opp === G.tid) {
    oppEntry.played = true;
    oppEntry.uScore = oScore;
    oppEntry.oScore = uScore;
  }
  if (won) {
    t.wins++; opp.loss++;
    if (game.conf) { t.cWins++; opp.cLoss++; }
  } else {
    t.loss++; opp.wins++;
    if (game.conf) { t.cLoss++; opp.cWins++; }
  }
  // Rankings (t.pts) are recomputed from all results in advanceWeek — see ratings.js.
  // The final stays on the dashboard until the next game is played.
  G.lastResult = { yr: G.yr, oppId: opp.id, home: !!uHome, u: uScore, o: oScore, won: won, wk: G.gi + 1, label: game.conf ? 'Conference' : 'Non-conference' };
  noteUserResult(opp, won);
  // Ticket sales for home games
  if (uHome && G.phase === 'reg') payGate(facilitiesFor(G.tid).arena || 0);
  // Note: GP is counted once per game — simGame() increments it internally
  // for quick/auto-simmed games, and launchSim() increments at tipoff for live games.
  // Morale: both teams' players react to the result.
  recordGameMorale(won ? t : opp, won ? opp : t);
  addLog(won ? 'w' : 'l', G.gi + 1,
    '<b>' + (won ? 'W' : 'L') + '</b> vs <b>' + opp.name + '</b>  ' + fmtScore(uScore, oScore));
  toast((won ? 'W ' : 'L ') + fmtScore(uScore, oScore, '-') + ' vs ' + opp.name,
    won ? 'var(--grn)' : 'var(--red)');
  // Records: surface any broken single-game school records (no-op if none).
  surfaceUserGameRecords();
}

// ═══════════════════════════════════════════════════════════
//  ADVANCE WEEK
// ═══════════════════════════════════════════════════════════

// Auto-manage lineup (roster screen toggle, G.autoLineup)
if (typeof window !== 'undefined') window._applyAutoLineup = function() { applyAutoLineup(); };
export function applyAutoLineup() {
  if (!G.autoLineup || !G.teams[G.tid]) return;
  var out = {};
  (G.injuries || []).forEach(function(inj) { if (inj.weeksLeft > 0) out[inj.playerName] = true; });
  autoLineup(G.teams[G.tid], out);
}

export function advanceWeek() {
  G.gi++;
  G.wk = G.gi;
  if (G.phase === 'reg') payTvShare(); // once a season, after week 1
  snapshotRanks();    // last week's poll, for movement arrows
  recomputeRatings(); // rankings reflect every result through this week
  checkAchievements();

  // Training room: injured players sometimes heal a week early
  // (suspensions and academic issues aren't medical, so they don't)
  var _tc = trainingChance(G.tid);
  (G.injuries || []).forEach(function(inj) {
    if (inj.type === 'Suspension' || inj.type === 'Academic') return;
    if (inj.weeksLeft > 1 && Math.random() < _tc) inj.weeksLeft--;
  });

  // Fire mid-season events during regular season
  if (G.phase === 'reg' && G.gi < 30) {
    rollEvents(G.gi);
  }
  applyAutoLineup(); // injuries and returns are handled for you when it's on

  if (G.gi >= 30 && G.phase === 'reg') {
    // Build the brackets first, then draw: drawing the tournament screen
    // before any bracket existed crashed and left the season stuck
    G.phase = 'conf_tourn';
    if (_ext.startConfTourney) _ext.startConfTourney();
    else { saveState(); updateAll(); }
    return;
  }
  saveState();
  updateAll();
}

// ═══════════════════════════════════════════════════════════
//  LAUNCH SIM (user game — quick or live)
// ═══════════════════════════════════════════════════════════

export function launchSim(watch) {
  if (G.phase !== 'reg') return; // Only regular season games
  if (G.gi >= 30) return; // Past end of schedule
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
  LS.possCount = 0;
  if (watch) {
    // Increment GP for live sim (simGame does this internally for quick sim)
    tH.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
    tA.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
    // Records: snapshot for the post-game diff (live games accumulate
    // possession-by-possession, so there's no simGame result to read).
    LS._recPre = { h: snapRoster(tH), a: snapRoster(tA), hid: tH.id, aid: tA.id };
    if (_ext.openModal) _ext.openModal(tH, tA);
  } else {
    var res = simGame(tH, tA, game.home);
    LS.hs = res.homeScore; LS.as = res.awayScore;
    LS._recLines = userLinesFromRes(res);
    LS._boxPlines = res.plines || null;
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

  // Multi-game sims: run to a milestone, or stop one that's running
  if (mode === 'auto' || mode === 'stop') { stopAutoSim(); return; }
  if (mode === 'sim-reg' || mode === 'sim-conf' || mode === 'sim-season') {
    SetupState.G_AUTO = mode;
    updateAutoBtn();
    autoSimNext();
    return;
  }
  // Manual play — stop any running auto sim
  SetupState.G_AUTO = false;
  updateAutoBtn();

  if (G.phase === 'reg' && G.gi < 30) {
    // Skip bye weeks
    var userGame = G.teams[G.tid].sched[G.gi];
    if (!userGame) {
      simCPUWeek();
      advanceWeek();
      return;
    }
    launchSim(mode === 'live');
  } else if (G.phase === 'reg' && G.gi >= 30) {
    G.phase = 'conf_tourn';
    if (_ext.startConfTourney) _ext.startConfTourney();
  } else if (G.phase === 'conf_tourn' || G.phase === 'ncaa') {
    if (_ext.playTournamentGame) _ext.playTournamentGame(mode === 'live');
  } else if (G.phase === 'offseason') {
    if (window._moveOnWarning && window._moveOnWarning(function() { doPlay(mode); })) return; // heads-up first
    if (G.offseasonStep === 'fired') {
      if (window.proceedFromFired) window.proceedFromFired();
    } else if (G.offseasonStep === 'recap') {
      if (window.beginOffseason) window.beginOffseason();
    } else if (G.offseasonStep === 'skillpoints') {
      if (window.finishSkillPoints) window.finishSkillPoints();
    } else if (G.offseasonStep === 'carousel') {
      if (window.stayAtSchool) window.stayAtSchool();
    } else if (G.offseasonStep === 'turnover') {
      if (window.proceedToRecruiting) window.proceedToRecruiting();
    } else if (G.offseasonStep === 'retention') {
      if (window.finishRetention) window.finishRetention();
    } else if (G.offseasonStep === 'portal') {
      if (window.advancePortalStage) window.advancePortalStage();
    } else if (G.offseasonStep === 'signed') {
      if (window.toSchedule) window.toSchedule(); else doOffseason();
    } else if (G.offseasonStep === 'schedule') {
      doOffseason();
    } else if (G.recruitPhase < 3) {
      if (window.advanceRecruitPhase) window.advanceRecruitPhase();
    } else {
      if (window.finishSigningDay) window.finishSigningDay(); else doOffseason();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  AUTO-SIM
// ═══════════════════════════════════════════════════════════

export function updateAutoBtn() {
  // The top-bar button and menu reflect whether a multi-game sim is running
  if (_ext.updateAdvance) _ext.updateAdvance();
}

export function stopAutoSim() {
  SetupState.G_AUTO = false;
  updateAutoBtn();
}

// Has the running sim reached its milestone?
function autoSimDone(target) {
  if (G.phase === 'offseason') return true;
  if (target === 'sim-reg') return G.phase !== 'reg';
  if (target === 'sim-conf') return G.phase === 'ncaa' || G.phase === 'offseason';
  return false; // sim-season runs until the offseason
}

// One step per tick (a game week or a tournament round) so the screen keeps
// up and Stop works between steps. Every step goes through the same code a
// manual click does, so rankings, events and records all update.
export function autoSimNext() {
  var target = SetupState.G_AUTO;
  if (!target) return;
  if (autoSimDone(target)) { stopAutoSim(); return; }

  if (G.phase === 'reg') {
    if (G.gi >= 30) { advanceWeek(); }
    else {
      var game = G.teams[G.tid].sched[G.gi];
      if (!game || game.played) { simCPUWeek(); advanceWeek(); }
      else launchSim(false);
    }
  } else if (G.phase === 'conf_tourn' || G.phase === 'ncaa') {
    // A full-season sim skips the Selection Sunday reveal
    var rev = ge('bracket-reveal');
    if (rev && rev.style.display === 'block' && target === 'sim-season') {
      if (window.closeBracketReveal) window.closeBracketReveal();
    }
    if (_ext.playTournamentGame) _ext.playTournamentGame(false);
  }

  if (autoSimDone(target)) { stopAutoSim(); return; }
  if (SetupState.G_AUTO) setTimeout(autoSimNext, 60);
}

// ═══════════════════════════════════════════════════════════
//  END OF SEASON
// ═══════════════════════════════════════════════════════════

// Team refs may be full objects (live) or ids (slimmed save) — resolve either
function teamIdOf(ref) {
  if (ref === null || ref === undefined) return null;
  return typeof ref === 'number' ? ref : ref.id;
}

function userWonNatChamp() {
  if (!G.bracket || !G.bracket.length) return false;
  var still = G.bracket.filter(function(b) { return b.active; });
  return still.length === 1 && teamIdOf(still[0].team) === G.tid;
}

// ── S8: wire the skill-point achievement flags from tournament outcomes ──
// tournament.js records G.seasonAchievements.tourneyFinish at NCAA elimination;
// this derives every flag that endSeason's skill-point calc reads (conf title,
// NCAA appearance, Sweet 16 / Final Four / title game / championship) from the
// conference tourneys + NCAA bracket, so the points are actually winnable.
export function wireSeasonAchievements() {
  var sa = G.seasonAchievements || (G.seasonAchievements = {});
  var tid = G.tid;
  var t = G.teams[tid];

  // Conference title: user won their own conference tournament
  if (!sa.confTitleThisYear && G.confTourneys && t) {
    var uct = G.confTourneys[t.conf];
    if (uct && uct.done && teamIdOf(uct.champ) === tid) sa.confTitleThisYear = true;
  }

  // NCAA appearance + progress
  var inField = false;
  if (G.bracket && G.bracket.length) {
    inField = G.bracket.some(function(b) { return teamIdOf(b.team) === tid; });
  }
  // Opening Round teams made the field too, win or lose
  if (!inField && G.ncaaOpening && G.ncaaOpening.games) {
    inField = G.ncaaOpening.games.some(function(g) { return teamIdOf(g.t1) === tid || teamIdOf(g.t2) === tid; });
  }
  if (inField) sa.madeNCAA = true;

  if (userWonNatChamp()) {
    sa.madeNCAA = true; sa.sweet16 = true; sa.finalFour = true;
    sa.champGame = true; sa.natChamp = true;
    // The champion is never "eliminated", so record the finish for history
    if (!sa.tourneyFinish) sa.tourneyFinish = 'CHAMP';
  } else if (sa.tourneyFinish) {
    var tf = sa.tourneyFinish;
    if (tf === 'Sweet 16' || tf === 'Elite Eight' || tf === 'Final Four' || tf === 'Championship Game') sa.sweet16 = true;
    if (tf === 'Final Four' || tf === 'Championship Game') sa.finalFour = true;
    if (tf === 'Championship Game') sa.champGame = true;
  }
  return sa;
}

export function recordSeasonHistory(source) {
  if (!G.history) G.history = [];
  var t = G.teams[G.tid];
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  // S7: trust the recorded tournament finish (set at NCAA elimination in
  // tournament.js, 'CHAMP' wired for the champion). The old bracket-count
  // heuristic always resolved to "Runner-Up" for non-champions.
  var sa = G.seasonAchievements || {};
  var inField = G.bracket && G.bracket.some(function(b) { return teamIdOf(b.team) === G.tid; });
  var tf = source === 'conf_elim' ? 'Conf Tourney' :
    sa.tourneyFinish ? sa.tourneyFinish :
    inField ? 'Round of 64' : 'Did Not Qualify';
  // Don't duplicate
  if (G.history.find(function(h) { return h.year === G.yr; })) return;
  G.history.push({
    year: G.yr, school: t.name, wins: t.wins, loss: t.loss, rank: rank,
    // per-season flags (were the career counters, so every season after a
    // first title read as a title season)
    confTitle: !!sa.confTitleThisYear, championship: !!sa.natChamp,
    tourneyFinish: tf,
    note: t.wins + '-' + t.loss + ' \u00b7 #' + rank + ' NET \u00b7 ' + tf
  });
}

// ── Player history (read by player pages) ───────────────
// Every player keeps one row per season: p.h = [[yr, tid, ovr, gp, pts,
// reb, ast, stl, blk], ...] (season totals, postseason included), and
// p.aw = ['2025 Player of the Year', '2025 All-American', ...].
// College careers are short, so this stays small.
export function recordPlayerSeasons() {
  var all = [];
  G.teams.forEach(function(tm) {
    tm.rost.forEach(function(p) {
      var s = p.s || {};
      if (!p.h) p.h = [];
      if (p.h.length && p.h[p.h.length - 1][0] === G.yr) return; // already recorded
      p.h.push([G.yr, tm.id, p.ovr, s.gp || 0, s.pts || 0, s.reb || 0, s.ast || 0, s.stl || 0, s.blk || 0]);
      if ((s.gp || 0) >= 10) all.push({ p: p, tid: tm.id, per: awardScore(p, tm) });
    });
  });
  all.sort(function(a, b) { return b.per - a.per; });
  var give = function(p, label) { if (!p.aw) p.aw = []; if (p.aw.indexOf(label) < 0) p.aw.push(label); };
  if (all[0]) give(all[0].p, G.yr + ' Player of the Year');
  pickPositionalTeam(all, function(x) { return x.p.pos; }).forEach(function(x) { give(x.p, G.yr + ' All-American'); });
  var fr = all.filter(function(x) { return x.p.cls === 'FR'; })[0];
  if (fr) give(fr.p, G.yr + ' Freshman of the Year');
}

export function endSeason() {
  wireSeasonAchievements();
  var still = G.bracket.filter(function(b) { return b.active; });
  if (still.length === 1) {
    if (!G.leagueChamps) G.leagueChamps = [];
    var ch = still[0].team;
    if (!G.leagueChamps.find(function(c) { return c.year === G.yr; }))
      G.leagueChamps.push({ year: G.yr, name: ch.name, tid: ch.id });
  }
  recordSeasonHistory('ncaa');

  // Records: season/career record checks + Hall of Fame inductions.
  // Runs while p.s still holds the finished season.
  processSeasonRecords();
  recordPlayerSeasons();

  // Season goals: rewards land now (NIL + prestige inside settleGoals)
  checkAchievements();
  var goalRes = settleGoals();

  // Calculate skill points
  var t = G.teams[G.tid];
  var sa = G.seasonAchievements;
  var earned = goalRes ? goalRes.skill : 0;
  if (goalRes) addLog('ev', G.gi, 'Season goals: <b>' + goalRes.met + ' of ' + goalRes.total + '</b> met'
    + (goalRes.met ? ' (+' + goalRes.skill + ' skill point' + (goalRes.skill > 1 ? 's' : '') + ', +' + goalRes.nil + ' NIL)' : '') + '.');
  if (t.wins >= 16) earned++;
  if (t.wins >= 20) earned++;
  if (t.wins >= 25) earned++;
  if (sa.confTitleThisYear) earned++;
  if (sa.madeNCAA) earned++;
  if (sa.sweet16) earned++;
  if (sa.finalFour) earned++;
  if (sa.champGame) earned++;
  if (sa.natChamp) earned++;
  G.skillPointsEarned = earned;
  // Unspent points carry over, so moving on never costs you anything
  G.skillPointsToSpend = (G.skillPointsToSpend || 0) + earned;

  // Update coach career stats
  G.coach.careerWins += t.wins;
  G.coach.careerLoss += t.loss;
  G.coach.tenure++;
  G.coach.age++;

  // ── HOT SEAT / FIRING CHECK ──
  var exp = G.expectations;
  var fired = false;
  var totalGames = t.wins + t.loss;
  var winPct = totalGames > 0 ? t.wins / totalGames : 0.5;

  // Fallback: if no expectations, generate them now based on current data
  if (!exp) {
    var confT = G.teams.filter(function(x) { return x.conf === t.conf; });
    var cAvg = confT.reduce(function(s, x) { return s + getTOvr(x); }, 0) / (confT.length || 1);
    exp = calcExpectations(getTOvr(t), cAvg);
  }

  if (t.wins < exp.danger) {
    if (G.coach.hotSeat) {
      fired = true;
      G.coach.hotSeat = false;
    } else {
      G.coach.hotSeat = true;
      addLog('ev', G.gi, '<b>Hot seat.</b> The administration is concerned. Another season like this and you will be replaced.');
    }
  } else if (t.wins < exp.low || (exp.ncaa && !(G.seasonAchievements || {}).madeNCAA)) {
    if (G.coach.hotSeat) {
      if (Math.random() < 0.4) {
        fired = true;
      } else {
        addLog('ev', G.gi, 'The athletic director is giving you one more season.');
      }
    } else {
      G.coach.hotSeat = true;
      addLog('ev', G.gi, (t.wins >= exp.low ? 'Missing the NCAA tournament with this roster was a disappointment.' : 'Disappointing season.') + ' The athletic director expects improvement next year.');
    }
  } else {
    G.coach.hotSeat = false;
  }

  // Additional failsafe: 4+ years of losing = fired regardless
  if (!fired && G.coach.tenure >= 4 && G.coach.careerWins < G.coach.careerLoss) {
    if (winPct < 0.40) {
      fired = true;
      addLog('ev', G.gi, 'After ' + G.coach.tenure + ' years of losing, the administration has seen enough.');
    }
  }

  // Fire CPU coaches that underperformed
  G.teams.forEach(function(tm) {
    if (tm.id === G.tid) return;
    var tmTotal = tm.wins + tm.loss;
    if (tmTotal === 0) return;
    var tmWinPct = tm.wins / tmTotal;
    if (tmWinPct < 0.35 || (tmWinPct < 0.42 && Math.random() < 0.3)) {
      // CPU coach fired — generate replacement
      tm.coachHistory = tm.coachHistory || [];
      if (tm.coach) {
        tm.coachHistory.push({ yr: G.yr, coach: tm.coach.firstName + ' ' + tm.coach.lastName, record: tm.wins + '-' + tm.loss, fired: true });
      }
      tm.coach = {
        firstName: COACH_FN[ri(0, COACH_FN.length - 1)],
        lastName: COACH_LN[ri(0, COACH_LN.length - 1)],
        age: ri(35, 60), off: ri(55, 85), def: ri(55, 85),
        dev: ri(55, 85), rec: ri(55, 85), tenure: 0
      };
    } else if (tm.coach) {
      tm.coach.tenure = (tm.coach.tenure || 0) + 1;
      tm.coach.age = (tm.coach.age || 45) + 1;
    }
  });

  if (fired) {
    G.coach.history.push({ yr: G.yr, school: t.name, wins: t.wins, loss: t.loss, action: 'Fired' });
    addLog('ev', G.gi, '<b>You have been fired from ' + t.name + '.</b>');
    // Replace user with NPC at current school
    t.coach = {
      firstName: COACH_FN[ri(0, COACH_FN.length - 1)],
      lastName: COACH_LN[ri(0, COACH_LN.length - 1)],
      age: ri(35, 60), off: ri(55, 85), def: ri(55, 85),
      dev: ri(55, 85), rec: ri(55, 85), tenure: 0
    };
    t.coachHistory = t.coachHistory || [];
    t.coachHistory.push({ yr: G.yr, coach: G.coach.firstName + ' ' + G.coach.lastName, record: t.wins + '-' + t.loss, fired: true });
    G.phase = 'offseason';
    G.offseasonStep = 'fired';
    saveState(); updateAll(); navTo('offseason');
  } else {
    G.coach.history.push({ yr: G.yr, school: t.name, wins: t.wins, loss: t.loss, action: G.coach.hotSeat ? 'Hot Seat' : 'Retained' });
    G.phase = 'offseason';
    G.offseasonStep = 'recap';
    saveState(); updateAll(); navTo('offseason');
  }
}

export function showRecap() {
  // Legacy — redirect to the offseason view
  G.phase = 'offseason';
  G.offseasonStep = 'recap';
  updateAll(); navTo('offseason');
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
    if (p.cls === 'SR' && !p.rs) {
      G.departingPlayers.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, reason: 'Graduated', ppg: ppg.toFixed(1), rpg: gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0', apg: gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0', mins: p.mins });
    } else if (ppg >= 16 && p.cls !== 'FR') {
      G.departingPlayers.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, reason: 'Declared for Draft', ppg: ppg.toFixed(1), rpg: gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0', apg: gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0', mins: p.mins });
    }
  });

  // Skill points were spent on the recap screen: go straight to the carousel
  if (G.coach) delete G.coach.skillInitial;
  G.offseasonStep = 'carousel';
  G.recruitPhase = 0;
  G.recruitTargets = [];
  G.portalEntrants = []; G.portalStage = 0; G.portalCpuTakes = {}; G.portalUserSigns = 0;
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

  // Development report: snapshot every returner before they develop
  var _devBefore = t.rost.filter(function(p) { return p.cls !== 'SR' || p.rs; }).map(function(p) {
    return { p: p, cls: p.cls, rs: !!p.rs, ovr: p.ovr, pot: p.pot || p.ovr, sht: p.sht, fin: p.fin, def: p.def, reb: p.reb, ply: p.ply };
  });

  // Age up / develop returning players using calcGrowth.
  // Redshirts: no class change (the year doesn't count), +2 extra
  // development, and the redshirt is used up for good.
  t.rost.forEach(function(p) {
    if (p.cls === 'SR' && !p.rs) return;
    var growth = calcGrowth(p, G.coach.dev);
    // Practice facility: extra development points, spread at random
    for (var _pb = practiceBonus(G.tid), _ga = ['sht', 'fin', 'def', 'reb', 'ply']; _pb > 0; _pb--) {
      var _a = _ga[ri(0, 4)]; growth[_a] = (growth[_a] || 0) + 1;
    }
    ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) {
      p[a] = clamp(p[a] + (growth[a] || 0), 38, 99);
    });
    p.ovr = getOvr(p);
    if (p.pot && p.ovr > p.pot) p.pot = p.ovr;
    if (p.rs) {
      var _rsA = ['sht', 'fin', 'def', 'reb', 'ply'];
      for (var _r = 0; _r < 2; _r++) { var _k = _rsA[ri(0, 4)]; p[_k] = clamp(p[_k] + 1, 38, 99); }
      p.ovr = getOvr(p); if (p.pot && p.ovr > p.pot) p.pot = p.ovr;
      p.rs = false; p.rsUsed = true; p._rsKeep = true;
      return;
    }
    var idx = CLS.indexOf(p.cls);
    if (idx < 3) p.cls = CLS[idx + 1];
  });

  // G.devReport: what every returner gained this offseason (read by the
  // development report screen). Attribute keys: sht fin def reb ply.
  G.devReport = {
    yr: G.yr + 1, school: t.name,
    rows: _devBefore.map(function(b) {
      var p = b.p, d = {};
      ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) { d[a] = p[a] - b[a]; });
      return { name: p.name, pos: p.pos, clsFrom: b.cls, clsTo: p.cls, redshirt: b.rs,
               ovrFrom: b.ovr, ovrTo: p.ovr, pot: p.pot || p.ovr, delta: d };
    })
  };

  // Remove seniors (a senior who redshirted stays for one more year)
  t.rost = t.rost.filter(function(p) { var keep = p.cls !== 'SR' || p._rsKeep; delete p._rsKeep; return keep; });

  // Add commits (R6: class-size cap enforced)
  var CLASS_SIZE_CAP = 8;
  commits.sort(function(a, b) { return b.ovr - a.ovr; });
  var _croom = Math.max(0, 15 - t.rost.length);
  // Your class is already limited to one signee per open spot, so only room applies
  commits.slice(0, _croom).forEach(function(r) {
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
  G.lastResult = null;
  G.teams.forEach(function(tm) { tm.lastRank = 0; });
  G.bracket = []; G.confTourneys = {}; G.ncaaOpening = null;
  // Records: fresh highlight reel for the new season
  clearSeasonBreaks();

  // Reset recruiting budget for next cycle
  G.recruitingBudget = 0;
  G.recruitingSpent = 0;

  // Reset all teams for new season
  var _userTouchedByPortal = false;
  G.teams.forEach(function(tm) {
    tm.wins = 0; tm.loss = 0; tm.cWins = 0; tm.cLoss = 0; tm.sched = [];
    tm.ts = { pts: 0, opp: 0, fgm: 0, fga: 0, games: 0 }; tm.streak = 0;
    tm.rost.forEach(function(p) { p.s = freshS(); p.morale = 50; }); // fresh vibes, new season
    if (tm.id !== G.tid) {
      tm.rost = tm.rost.filter(function(p) { return p.cls !== 'SR'; });
      // CPU returners develop too, by their own coach's development rating
      // (without this, CPU ratings froze after signing and every user
      // program pulled away by season 4-5 — research/difficulty-report.md)
      var _cdev = (tm.coach && tm.coach.dev) || 70;
      tm.rost.forEach(function(p) {
        var _g = calcGrowth(p, _cdev);
        ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) { p[a] = clamp(p[a] + (_g[a] || 0), 38, 99); });
        p.ovr = getOvr(p);
        if (p.pot && p.ovr > p.pot) p.pot = p.ovr;
        var i = CLS.indexOf(p.cls);
        if (i < 3) p.cls = CLS[i + 1];
        p.s = freshS();
      });
      // R2: CPU-signed recruits join their rosters (R6: class-size capped)
      var _sig = G.recruits.filter(function(r) { return r.signed === tm.id && r.status === 'gone'; });
      _sig.sort(function(a, b) { return b.ovr - a.ovr; });
      var _sroom = Math.max(0, 15 - tm.rost.length);
      _sig.slice(0, Math.min(CLASS_SIZE_CAP, _sroom)).forEach(function(r) {
        var _np = JSON.parse(JSON.stringify(r));
        _np.s = freshS(); _np.cls = 'FR'; _np.mins = 0;
        tm.rost.push(_np);
      });
      // R9: portal pickups resolve globally AFTER all CPU rosters are rebuilt
    }
  });
  // Every remaining entrant resolves through its suitor field in one global
  // pass (user pitches resolved immediately at pitch time). Teams only take
  // transfers they need; unclaimed entrants stay on their old rosters.
  if (window._resolvePortalCPU && window._resolvePortalCPU()) _userTouchedByPortal = true;
  G.teams.forEach(function(tm) {
    if (tm.id === G.tid) return;
    while (tm.rost.length < 10) {
      var np2 = genPlayer(tm.baseOvr, POS[ri(0, 4)], 'FR');
      np2.s = freshS();
      tm.rost.push(np2);
    }
    fixMins(tm.rost);
  });
  if (_userTouchedByPortal) fixMins(G.teams[G.tid].rost);
  // R9 repair: portal poaching may have shrunk already-processed CPU rosters — refill them
  G.teams.forEach(function(tm) {
    if (tm.id === G.tid || tm.rost.length >= 10) return;
    while (tm.rost.length < 10) {
      var _w = genPlayer(tm.baseOvr, POS[ri(0, 4)], 'FR');
      _w.s = freshS();
      tm.rost.push(_w);
    }
    fixMins(tm.rost);
  });
  if (window._clearPortalState) window._clearPortalState();

  buildSchedules();
  // Auto-generate user's OOC opponents for new season
  var myOvr = getTOvr(G.teams[G.tid]);
  // Your non-conference slate: the one you set in the offseason (schedule
  // step), else a balanced auto-pick
  var _ncOk = Array.isArray(G.ncPicks) && G.ncPicks.length === 10 && G.ncPicks.every(function(id) {
    return G.teams[id] && id !== G.tid && G.teams[id].conf !== G.teams[G.tid].conf;
  });
  SetupState.NC_PICKS = _ncOk ? G.ncPicks.slice() : pickBalancedOOC();
  G.ncPicks = null;
  setupUserOOC();

  genRecruits();

  // Calculate season expectations
  var confTeams = G.teams.filter(function(x) { return x.conf === G.teams[G.tid].conf; });
  var confAvgOvr = confTeams.reduce(function(s, x) { return s + getTOvr(x); }, 0) / (confTeams.length || 1);
  var _myO = getTOvr(G.teams[G.tid]);
  G.expectations = calcExpectations(_myO, confAvgOvr, G.teams.filter(function(x) { return getTOvr(x) > _myO; }).length + 1);
  G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };

  applyAutoLineup(); // new roster, fresh lineup when auto-manage is on
  addLog('ev', 0, 'Season ' + G.yr + ' begins. Expectations: ' + G.expectations.low + '-' + G.expectations.high + ' wins' + (G.expectations.ncaa ? ' and an NCAA tournament bid.' : '.'));
  toast('Season ' + G.yr + ' has started');
  saveState(); updateAll(); navTo('dashboard');
}
