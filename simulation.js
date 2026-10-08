// ═══════════════════════════════════════════════════════════
//  HOOPS OS — simulation.js
//  Core game engine. Player generation, possession logic,
//  full game simulation, stat distribution, momentum.
//  No DOM access. No UI side effects.
// ═══════════════════════════════════════════════════════════

import { COM, DIFF_MOD } from './constants.js';
import { ri, clamp, gn, getOvr, getTOvr, pick, freshS, rawOvr, scaleOvr, oldOvr } from './utils.js';
import { moraleAttrMod, MORALE_DEFAULT } from './morale.js';
import { G, LS } from './state.js';
import { snapRoster, diffRoster } from './records.js';
import { arenaBonus } from './facilities.js';

// ── Player Generation ────────────────────────────────────
export function genPlayer(base, pos, cls) {
  var p = {
    name: gn(), pos: pos, cls: cls, mins: 0,
    sht: ri(base - 18, base + 18),
    fin: ri(base - 18, base + 18),
    def: ri(base - 18, base + 18),
    reb: ri(base - 18, base + 18),
    ply: ri(base - 18, base + 18),
    morale: MORALE_DEFAULT,
    s: freshS()
  };

  // Archetype system
  var roll = ri(1, 100);
  if (pos === 'PG') {
    if (roll <= 52) { // Floor General
      p.ply += ri(14, 22); p.sht += ri(6, 12); p.def += ri(3, 8); p.fin -= ri(6, 12); p.reb -= ri(12, 18);
    } else { // Scoring Guard
      p.sht += ri(14, 22); p.fin += ri(8, 14); p.ply += ri(4, 10); p.reb -= ri(8, 14);
    }
  } else if (pos === 'SG') {
    if (roll <= 50) { // Sharpshooter
      p.sht += ri(15, 23); p.fin -= ri(8, 14); p.def += ri(2, 7);
    } else { // Slasher
      p.fin += ri(14, 22); p.sht += ri(6, 12); p.ply += ri(5, 11);
    }
  } else if (pos === 'SF') {
    if (roll <= 55) { // Two-Way Wing
      p.sht += ri(8, 14); p.def += ri(10, 16); p.fin += ri(4, 9); p.ply += ri(3, 8);
    } else { // Point Forward
      p.ply += ri(13, 20); p.sht += ri(7, 13); p.reb += ri(5, 10);
    }
  } else if (pos === 'PF') {
    if (roll <= 48) { // Stretch Four
      p.sht += ri(12, 20); p.fin += ri(4, 9); p.reb += ri(6, 11); p.def += ri(3, 8);
    } else { // Paint Beast
      p.fin += ri(14, 22); p.reb += ri(13, 21); p.sht -= ri(10, 16); p.ply -= ri(5, 10);
    }
  } else if (pos === 'C') {
    if (roll <= 50) { // Rim Protector
      p.def += ri(14, 22); p.reb += ri(15, 23); p.fin += ri(6, 12); p.sht -= ri(14, 20); p.ply -= ri(8, 14);
    } else { // Offensive Center
      p.fin += ri(15, 23); p.reb += ri(8, 14); p.sht += ri(5, 11); p.def -= ri(8, 14);
    }
  }

  // Star boost for high-base teams
  if (base >= 78 && ri(1, 100) <= 28) {
    var main = (pos === 'PG') ? 'ply' : (pos === 'SG') ? 'sht' : (pos === 'SF') ? 'def' : (pos === 'PF' || pos === 'C') ? 'reb' : 'fin';
    p[main] = clamp(p[main] + ri(7, 13), 38, 99);
  }

  ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) { p[a] = clamp(p[a], 38, 99); });
  p.ovr = getOvr(p);

  // Development curve + potential
  var devRoll = ri(1, 100);
  if (cls === 'FR') { p.devCurve = (devRoll <= 20) ? 'early' : (devRoll <= 80) ? 'normal' : 'late'; }
  else if (cls === 'SO') { p.devCurve = (devRoll <= 15) ? 'early' : (devRoll <= 75) ? 'normal' : 'late'; }
  else { p.devCurve = (devRoll <= 35) ? 'late' : 'normal'; }

  var potGap = (cls === 'FR') ? ri(5, 18) : (cls === 'SO') ? ri(3, 12) : (cls === 'JR') ? ri(1, 7) : ri(0, 3);
  if (cls === 'FR' && ri(1, 100) <= 8) { potGap = ri(18, 30); if (p.devCurve === 'normal') p.devCurve = 'late'; }
  if (p.devCurve === 'late') potGap += ri(4, 9);
  // Elite players have little room left: headroom shrinks the gap near the top
  var raw = rawOvr(p);
  var headroom = clamp((99 - raw) / 30, 0.2, 1);
  p.pot = Math.max(p.ovr, scaleOvr(raw + potGap * headroom));

  return p;
}

// ── Walk-ons ─────────────────────────────────────────────
// A walk-on freshman rated about `target` overall (well below the roster).
// About 1 in 12 is a gem: high potential, and he really grows into it
// (see calcGrowth). The rest top out a few points above where they start.
export var WALKON_GEM_RATE = 1 / 12;
export function genWalkon(target, pos) {
  var p = genPlayer(Math.max(45, Math.round(oldOvr(target)) - 6), pos, 'FR');
  // Shift every skill until the overall lands on the target
  for (var k = 0; k < 6 && p.ovr !== target; k++) {
    var step = Math.max(-12, Math.min(12, Math.round((oldOvr(target) - oldOvr(p.ovr)))));
    if (!step) break;
    ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) { p[a] = clamp(p[a] + step, 38, 99); });
    p.ovr = getOvr(p);
  }
  p.walkon = true;
  if (Math.random() < WALKON_GEM_RATE) {
    p.devCurve = 'early';
    p.pot = Math.min(99, Math.max(p.ovr + 12, target + ri(14, 20)));
  } else {
    p.devCurve = 'normal';
    p.pot = p.ovr + ri(1, 4);
  }
  return p;
}

export function calcGrowth(p, coachDev) {
  var devBonus = Math.round((coachDev - 70) / 15);
  var baseTotal = (p.cls === 'FR') ? ri(4, 9) : (p.cls === 'SO') ? ri(3, 6) : (p.cls === 'JR') ? ri(2, 4) : ri(1, 3);
  baseTotal += devBonus;
  baseTotal = clamp(baseTotal, 1, 12);
  if (p.devCurve === 'early' && (p.cls === 'FR' || p.cls === 'SO')) baseTotal += ri(1, 3);
  if (p.devCurve === 'late' && (p.cls === 'JR' || p.cls === 'SR')) baseTotal += ri(2, 4);
  baseTotal = clamp(baseTotal, 1, 15);
  var changes = { sht: 0, fin: 0, def: 0, reb: 0, ply: 0 };
  var remaining = baseTotal;
  var attrs = ['sht', 'fin', 'def', 'reb', 'ply'];
  while (remaining > 0) {
    var attr = attrs[ri(0, 4)];
    var add = ri(1, Math.min(3, remaining + 1));
    changes[attr] += add; remaining -= add;
  }
  // Gem walk-ons (high potential) grow fast until they reach it: from well
  // below the roster to a rotation player in 2-3 years
  if (p.walkon && (p.pot || 0) - (p.ovr || 0) >= 5) {
    var extra = ri(12, 18);
    while (extra > 0) { var ea = attrs[ri(0, 4)]; changes[ea] += 1; extra--; }
  }
  if (p.pos === 'PG' || p.pos === 'SG') changes.ply = clamp(changes.ply + ri(0, 1), 0, 5);
  if (p.pos === 'PF' || p.pos === 'C') changes.reb = clamp(changes.reb + ri(0, 1), 0, 5);
  return changes;
}

// ── Engine Strategy / Schemes ────────────────────────────
// Every team carries t.strat = { off, def } with REAL sim effects.
//   Offense: balanced | motion | drive | set | early
//   Defense: man | 2-3 | 3-2 | 1-3-1 | box1   (legacy 'zone'→2-3, 'press' kept)
// See getTeamStyle (utils.js) for CPU scheme identities.
export function getEngineStrat(t) {
  var o = (t.strat && t.strat.off) || 'balanced';
  if (o === 'early') return 'Pace & Space';
  if (o === 'set') return 'Grit & Grind';
  var ovr = oldOvr(getTOvr(t));
  if (ovr >= 88) return 'Pace & Space';
  if (ovr >= 78) return 'Standard';
  return 'Grit & Grind';
}

// Per-team pace modifier from offensive scheme (possessions/game).
function schemePaceMod(strat) {
  var o = (strat && strat.off) || 'balanced';
  if (o === 'early') return 10;  // fast: 72+ poss
  if (o === 'set') return -10;   // slow: ~59-62 poss
  return 0;
}

// 3PA tendency modifier from offensive scheme (percentage points).
function schemeThreeMod(offTeam) {
  var o = (offTeam.strat && offTeam.strat.off) || 'balanced';
  if (o === 'early') return 16;  // perimeter-focused
  if (o === 'motion') return 4;
  if (o === 'set') return -6;    // inside-focused
  if (o === 'drive') return -2;
  return 0;
}

// The opponent's star (box-and-one target): highest ovr with minutes.
function teamStar(t) {
  var best = null, bestOvr = -1;
  t.rost.forEach(function(p) { if (p.mins > 0 && p.ovr > bestOvr) { bestOvr = p.ovr; best = p; } });
  return best;
}

// ── Floor Selection ──────────────────────────────────────
// Picks a random active player weighted by minutes, with an optional weight
// function for role-based usage: stars shoot more per minute, playmakers
// create more assists, bigs grab more boards.
// Weighted pick without building a pool array (same distribution as before:
// integer weights, uniform draw over their sum). Called ~20k times per game.
export function getFloor(team, wFn) {
  var rost = team.rost, n = rost.length, total = 0, i, w;
  var ws = _floorW.length >= n ? _floorW : (_floorW = new Array(n * 2));
  for (i = 0; i < n; i++) {
    w = wFn ? wFn(rost[i]) : rost[i].mins;
    w = Math.max(0, Math.round(w));
    ws[i] = w; total += w;
  }
  if (!total) return rost[0];
  var r = ri(0, total - 1);
  for (i = 0; i < n; i++) { r -= ws[i]; if (r < 0) return rost[i]; }
  return rost[n - 1];
}
var _floorW = new Array(32);

// Usage weights: concentrate shots on high-ovr players, assists on
// playmakers, rebounds on bigs — produces realistic star lines.
// Shooter weight = minutes-share × usage, layered over a natural star-usage
// curve (better players shoot more per minute). p.usage is the UI Strategy
// slider (0-100, default 20 = neutral); missing/0 treated as 20 (old saves).
// Schemes stack on top: drive funnels through PG, set feeds PF/C, motion
// flattens distribution. Normalized by the pool, so extremes can't break it.
// Positional shot share: in college ball the ball lives in the guards' and
// wings' hands; bigs score mostly off post-ups, rolls and putbacks (which the
// play-type logic already routes to them). Without this, bigs' inflated ovr
// (reb/def-weighted) made them the top shot-takers too.
var POS_USAGE = { PG: 1.0, SG: 1.05, SF: 1.1, PF: 0.95, C: 0.85 };
function shooterWeight(p, offTeam) {
  var u = (typeof p.usage === 'number' && p.usage > 0) ? p.usage : 20;
  u = clamp(u, 1, 100);
  var scheme = offTeam ? ((offTeam.strat && offTeam.strat.off) || 'balanced') : 'balanced';
  var ovrExp = (scheme === 'motion') ? TUNE.usageExp / 2 : TUNE.usageExp; // motion: more even shot distribution
  var w = p.mins * Math.pow(Math.max(40, p.ovr) / 72, ovrExp) * (u / 20) * (POS_USAGE[p.pos] || 1);
  // Stars: the best player on the floor takes a bigger share of his own
  // team's shots (relative to his teammates, not the whole league)
  if (offTeam) {
    var top = topTwo(offTeam), k = scheme === 'motion' ? 0.5 : 1;
    if (p === top[0]) w *= 1 + (TUNE.star1 - 1) * k;
    else if (p === top[1]) w *= 1 + (TUNE.star2 - 1) * k;
  }
  if (scheme === 'drive' && p.pos === 'PG') w *= 1.8;
  if (scheme === 'set' && (p.pos === 'PF' || p.pos === 'C')) w *= 1.75;
  return w;
}
// A team's two best players with minutes (cached per game)
var _best = new WeakMap();
function topTwo(t) {
  var b = _best.get(t);
  if (b) return b;
  var a = t.rost.filter(function(p) { return p.mins > 0; }).sort(function(x, y) { return y.ovr - x.ovr; });
  b = [a[0] || null, a[1] || null];
  _best.set(t, b);
  return b;
}
function astW(p) { return p.mins * Math.pow(Math.max(40, p.ply) / 62, 2); }
function rebW(p) { return p.mins * Math.pow(Math.max(40, p.reb) / 62, 2.3); }
// Shot blockers: length and timing (rebounding and defense), bigs first
function blkW(p) { return p.mins * Math.pow(Math.max(40, (p.reb + p.def) / 2) / 62, 4) * (p.pos === 'C' ? 1.8 : p.pos === 'PF' ? 1.4 : 1); }

// Primary-playmaker assist: 55% of assists go to the highest-ply player on
// the floor (not the scorer), the rest are weighted by playmaking.
function pickAssister(offTeam, off, out) {
  var asst = null;
  if (ri(1, 100) <= 48) {
    var bestPly = -1;
    offTeam.rost.forEach(function(p) {
      if (p !== off && p.mins > 0 && !(out && out.has(p)) && p.ply > bestPly) { bestPly = p.ply; asst = p; }
    });
  } else {
    var tries = 0;
    asst = getFloor(offTeam, out ? function(p) { return out.has(p) ? 0 : astW(p); } : astW);
    while (asst === off && tries < 5) { asst = getFloor(offTeam, out ? function(p) { return out.has(p) ? 0 : astW(p); } : astW); tries++; }
  }
  if (asst && asst !== off) asst.s.ast++;
}

// ── Momentum & Runs System ───────────────────────────────
export function updateMomentum(scoringTeamId, pts) {
  var team = G.teams[scoringTeamId];
  if (!team) return null;
  if (G.momentum.tid === scoringTeamId) {
    G.momentum.pts += pts;
  } else {
    G.momentum.tid = scoringTeamId;
    G.momentum.pts = pts;
    return null;
  }
  if (G.momentum.pts >= 6 && G.momentum.pts % 2 === 0) {
    var isUser = scoringTeamId === G.tid;
    return {
      text: G.momentum.pts + '-0 RUN \u2014 ' + team.name.toUpperCase(),
      isUser: isUser
    };
  }
  return null;
}

// ── Single Possession (Live Sim) ─────────────────────────
// Watched games run on the same engine as quick sims (createGame below):
// one call plays one possession and describes it for the play-by-play.
// The engine for the game in progress lives on LS.eng (made on the first
// possession, cleared when the game ends).
// Returns: { pts, defPts, hs, as, time, pbp, big, type, run }
export function simPoss(offT, defT) {
  // NOTE: live game is watch-only by design — no mid-game coaching
  // controls. Schemes/rotation/usage are pre-game decisions only.
  var eng = LS.eng;
  if (!eng || !((eng.home === offT && eng.away === defT) || (eng.home === defT && eng.away === offT))) {
    var h = (LS.tH === offT || LS.tH === defT) ? LS.tH : defT;
    eng = LS.eng = createGame(h, h === offT ? defT : offT, { campus: !!(LS.game && LS.game._campus) });
  }
  var isHomeOff = offT === eng.home;
  // Seconds per possession from the game's pace; how many trips each team
  // has left decides clutch and late-game play, like the quick sim
  var T = 1200 / eng.gamePoss;
  var rem = Math.max(0, LS.clock || 0) / (2 * T);
  var clutch = false, late = false;
  if (LS.half === 2) { clutch = rem <= 8; late = rem <= TUNE.lateTrips; }
  else if (LS.half >= 3) { clutch = late = rem <= 2; }
  var e = eng.poss(isHomeOff, clutch, late, LS.half >= 2);
  var sc = eng.score();
  var time = Math.max(4, Math.round(T * (0.58 + Math.random() * 0.8))) + (e.oreb ? 4 : 0); // averages T with second chances
  var off = e.off || getFloor(offT), def = e.def || getFloor(defT);
  var pbp = '', big = false, type = 'miss', run = null;
  if (e.type === 'turn') {
    type = 'turn';
    pbp = '<span class="p-to">' + pick(e.stl ? COM.steal : COM.turn, off.name, def.name)
      + (e.runout ? ' ' + def.name + ' takes it the other way for two.' : '') + '</span>';
  } else if (e.type === 'foul') {
    type = 'foul'; big = e.ftm === 2;
    pbp = '<span class="p-foul">Foul on ' + def.name + '. ' + off.name + ' to the line \u2014 ' + e.ftm + ' of 2.</span>';
  } else if (e.type === 'block') {
    type = 'block'; big = true;
    pbp = '<span class="p-bl">' + pick(COM.block, off.name, def.name) + '</span>';
  } else if (e.type === 'putback') {
    type = 'make';
    pbp = '<span class="p-mk">' + pick(COM.putback, off.name) + '</span>';
  } else if (e.type === 'make') {
    type = 'make'; big = !!(e.and1 || e.fast);
    var txt;
    if (clutch && ri(1, 100) <= 40) txt = pick(COM.clutch, off.name);
    else if (e.fast || (e.rim && off.fin > 84)) txt = pick(COM.dunk, off.name, def.name);
    else if (e.three) txt = pick(COM.make3, off.name, def.name);
    else txt = pick(COM.make2, off.name, def.name);
    pbp = '<span class="p-mk">' + txt + (e.and1 ? ' And one.' : '') + '</span>';
  } else {
    pbp = '<span class="p-ms">' + pick(e.three ? COM.miss3 : COM.miss2, off.name, def.name) + '</span>';
  }
  if (e.pts > 0) run = updateMomentum(offT.id !== undefined ? offT.id : -1, e.pts);
  return { pts: e.pts, defPts: e.defPts, hs: sc.h, as: sc.a, time: time, pbp: pbp, big: big, type: type, run: run };
}


// ── Engine tuning (calibrated with test-harness/calib-run.mjs + season-diag.mjs)
// HOME_BONUS: shooting-% points for the home offense (~+3.5 pts/game HCA).
// PUTBACK_PCT: share of offensive rebounds that go straight back up (the rest
//   kick out and reset to a normal, perimeter-weighted shot).
// SCORE_EFFECT_*: second-half lead beyond START costs the leader RATE shooting-%
//   points per point of lead, capped at MAX (trailer gains the same).
var HOME_BONUS = 8;
var PUTBACK_PCT = 50;
var SCORE_EFFECT_START = 7;
var SCORE_EFFECT_RATE = 0.8;
var SCORE_EFFECT_MAX = 10;
// Engine knobs (exported so test-harness/sim-feel.mjs can tune them;
// research/sim-feel.md has the targets they were tuned to)
//   skill: how much a matchup's rating gap moves shot and turnover odds
//   lateTrips / lateSqueeze: last trips of a close game (play for the tie;
//     a leader milking the clock gets a tougher shot)
//   oreb: offensive rebound chance on a miss; pressTO: press turnover bump
//   usageExp: league-wide extra shots for higher-rated players (off)
//   star1 / star2: shot-share boost for a team's best and second-best player
//   volFree / volPen: past volFree shots in a game, each is volPen % harder
export var TUNE = { skill: 2.4, lateTrips: 6, lateSqueeze: 14, oreb: 34, pressTO: 1.5, usageExp: 0, star1: 1.45, star2: 1.15, volFree: 12, volPen: 1.5, scoreRate: SCORE_EFFECT_RATE, scoreMax: SCORE_EFFECT_MAX };

// ── Full Game Simulation (Final Engine) ──────────────────
// Possession-based with play types, clutch, momentum, fouls, fatigue, schemes.
// Stats accumulate on player objects. No separate distributeStats needed.
// Tournament site override: conference games on campus (higher seed hosts)
export var SITE = { campus: false };

// ── One game, possession by possession ───────────────────
// createGame holds everything about a game in progress (score, fatigue,
// fouls, shot counts, momentum) and plays one possession at a time. Quick
// sims loop it (simGame); watched games call it once per play (simPoss),
// so both play exactly the same basketball.
// Nothing on the players is changed while a game is on (a save can happen
// mid-game): difficulty and morale are offsets, fouled-out players a set.
//   opts.countGP: add a game played for everyone with minutes (quick sims;
//     watched games count it at tipoff). opts.campus: home court applies in
//     a tournament game on campus.
export function createGame(home, away, opts) {
  opts = opts || {};
  var hScore = 0, aScore = 0, ev = null;
  _best.delete(home); _best.delete(away);
  // M2 FIX: difficulty modifiers apply ONLY when the user's team is in the game.
  var userInvolved = (home.id === G.tid) || (away.id === G.tid);
  var userIsHomeActual = userInvolved && (home.id === G.tid);
  var dm = userInvolved ? (DIFF_MOD[G.difficulty] || 0) : 0;
  var userT = userIsHomeActual ? home : away;
  var cpuBoost = Math.round(-dm * 0.5);
  var adj = new Map();
  [home, away].forEach(function(t) {
    t.rost.forEach(function(p) {
      // difficulty edge plus morale (-2..+2, a subtle team-wide drift)
      adj.set(p, ((userInvolved && userT === t) ? dm : (userInvolved ? cpuBoost : 0)) + moraleAttrMod(p));
    });
  });
  function S(p) { return clamp(p.sht + (adj.get(p) || 0), 30, 99); }
  function F(p) { return clamp(p.fin + (adj.get(p) || 0), 30, 99); }
  function D(p) { return clamp(p.def + (adj.get(p) || 0), 30, 99); }
  // M8 FIX: the sellout-crowd event (G.nextHomeBonus) applies to the user's
  // next home game only, consumed once. Tournament games are neutral-site.
  var neutralSite = (G.phase === 'conf_tourn' || G.phase === 'ncaa') && !(SITE.campus || opts.campus);
  var homeBonus = neutralSite ? 0 : HOME_BONUS + (home.id === G.tid ? arenaBonus(G.tid) : 0);
  if (!neutralSite && userIsHomeActual && (G.nextHomeBonus || 0) > 0) {
    homeBonus += G.nextHomeBonus;
    G.nextHomeBonus = 0;
  }
  // M3 FIX: your coach's offense and defense count only in your games, as a
  // small shooting edge (about 1.3 points a game per shooting point)
  var coachEdgeH = 0, coachEdgeA = 0, coachDefH = 0, coachDefA = 0;
  if (G.coach && userInvolved) {
    var ce = (G.coach.off - 70) * 0.15 / 1.3, cd = (G.coach.def - 70) * 0.15 / 1.3;
    if (userIsHomeActual) { coachEdgeH = ce; coachDefH = cd; } else { coachEdgeA = ce; coachDefA = cd; }
  }
  // Pace is a GAME-level trait (both teams alternate possessions, so both get
  // the same count). Averaging the two schemes' tendencies: early-vs-early
  // runs, set-vs-set grinds.
  var gamePoss = clamp(68 + Math.round((schemePaceMod(home.strat) + schemePaceMod(away.strat)) / 2) + ri(-3, 3), 56, 88);
  // M1 NOTE: simGame owns the single per-game GP increment for both teams.
  if (opts.countGP) {
    home.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
    away.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
  }
  // M7 FIX: fatigue/fouls keyed by player identity, not by name.
  var fatigue = new Map(), playerFouls = new Map(), shots = new Map(), out = new Set();
  [home, away].forEach(function(t) {
    t.rost.forEach(function(p) {
      if (p.mins > 0) {
        fatigue.set(p, 0); playerFouls.set(p, 0);
        if (typeof p.s.stl !== 'number') p.s.stl = 0;
        if (typeof p.s.blk !== 'number') p.s.blk = 0;
      }
    });
  });
  // Floor picks skip fouled-out players
  function onW(p) { return out.has(p) ? 0 : p.mins; }
  function rW(p) { return out.has(p) ? 0 : rebW(p); }
  function bW(p) { return out.has(p) ? 0 : blkW(p); }

  var hMomentum = 0, aMomentum = 0;
  var lastTransition = false;
  // Box-and-one targets, computed once per game.
  var homeStar = teamStar(home), awayStar = teamStar(away);

  // INTERLEAVE FIX: possessions alternate home/away like a real game.
  function runOnePoss(offTeam, defTeam, isHomeOff, isClutch, lateGame, secondHalf) {
    ev = { type: 'miss', pts: 0, defPts: 0 };
    var sc0 = isHomeOff ? hScore : aScore, dsc0 = isHomeOff ? aScore : hScore;
    runInner(offTeam, defTeam, isHomeOff, isClutch, lateGame, secondHalf);
    ev.pts = (isHomeOff ? hScore : aScore) - sc0; ev.defPts = (isHomeOff ? aScore : hScore) - dsc0;
    return ev;
  }
  function runInner(offTeam, defTeam, isHomeOff, isClutch, lateGame, secondHalf) {
    var shotBonus = isHomeOff ? homeBonus : 0;
    var defScheme = (defTeam.strat && defTeam.strat.def) ? defTeam.strat.def : 'man';
    var oScheme = (offTeam.strat && offTeam.strat.off) || 'balanced';
    // Box-and-one: the defense's answer to the opponent's star — freeze him out.
    var offStar = (defScheme === 'box1') ? (isHomeOff ? homeStar : awayStar) : null;
    var sw = function(p) {
      if (out.has(p)) return 0;
      var w = shooterWeight(p, offTeam);
      if (offStar && p === offStar) w *= 0.35;
      return w;
    };
      var off = getFloor(offTeam, sw);
      var def = getFloor(defTeam, onW);
      fatigue.set(off, (fatigue.get(off) || 0) + 1);
      fatigue.set(def, (fatigue.get(def) || 0) + 1);
      if (defScheme === 'press') fatigue.set(def, (fatigue.get(def) || 0) + 1);

      var momMakeBonus = 0, momTOBonus = 0;
      var offMom = isHomeOff ? hMomentum : aMomentum;
      if (offMom >= 6) { momMakeBonus = 2; momTOBonus = 1; }
      else if (offMom >= 4) { momMakeBonus = 1; momTOBonus = 0; }
      momMakeBonus = clamp(momMakeBonus, 0, 5);

      var toChance = clamp(16 + Math.round((D(def) - off.ply) * 0.12 * TUNE.skill), 8, 26);
      if (defScheme === 'press') toChance += TUNE.pressTO;
      if (defScheme === '2-3' || defScheme === 'zone') toChance -= 2;
      if (defScheme === '3-2') toChance -= 1;
      if (defScheme === '1-3-1') toChance += 2;
      if (isClutch) toChance += 2;
      toChance += momTOBonus;
      toChance = clamp(toChance, 8, 30);
      if (ri(1, 100) <= toChance) {
        off.s.to = (off.s.to || 0) + 1;
        if (ri(1, 100) <= 60) {
          if (typeof def.s.stl !== 'number') def.s.stl = 0;
          def.s.stl++; ev.stl = true;
        }
        ev.type = 'turn'; ev.off = off; ev.def = def;
        // M6 FIX: press-forced fastbreak points are credited to the defender who
        // forced the turnover (FGA+FGM+PTS) — no more phantom points.
        if (defScheme === 'press' && ri(1, 100) <= 10) {
          if (isHomeOff) aScore += 2; else hScore += 2;
          def.s.pts += 2; def.s.fgm++; def.s.fga++; ev.runout = true;
        }
        lastTransition = true;
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        return;
      }
      lastTransition = false;

      var playRoll = ri(1, 100);
      var playType = 'standard';
      var isoT = (oScheme === 'drive') ? 22 : 15;
      var pnrT = isoT + 25;
      var postT = pnrT + ((oScheme === 'set') ? 22 : 12);
      if (playRoll <= isoT) playType = 'iso';
      else if (playRoll <= pnrT) playType = 'pnr';
      else if (playRoll <= 50 && lastTransition) playType = 'fastbreak';
      else if (playRoll <= postT) playType = 'post';
      if (isClutch && playType === 'fastbreak') playType = 'standard';

      var isThree = false, isRim = false, makePct = 0, foulExtra = 0, assistPct = 78;

      if (playType === 'iso') {
        var bestOvr = 0;
        offTeam.rost.forEach(function(p) { if (p.mins > 0 && !out.has(p) && p.ovr > bestOvr) bestOvr = p.ovr; });
        var tries = 0;
        do { off = getFloor(offTeam, sw); tries++; } while (off.ovr < bestOvr - 5 && tries < 3);
        isRim = F(off) > S(off);
        isThree = !isRim && ri(1, 100) <= 55;
        makePct = isRim ? 58 : 42;
        assistPct = 20;
      } else if (playType === 'pnr') {
        var triesG = 0;
        do { off = getFloor(offTeam, sw); triesG++; } while ((off.pos !== 'PG' && off.pos !== 'SG') && triesG < 3);
        var screener = getFloor(offTeam, sw);
        var triesB = 0;
        while ((screener.pos !== 'PF' && screener.pos !== 'C') && triesB < 3) { screener = getFloor(offTeam, sw); triesB++; }
        var pnrRoll = ri(1, 100);
        if (pnrRoll <= 60) { isThree = ri(1, 100) <= 65; isRim = !isThree; }
        else if (pnrRoll <= 80) { off = screener; isRim = true; }
        else { off = getFloor(offTeam, sw); isThree = true; makePct += 4; }
        assistPct = 75;
      } else if (playType === 'fastbreak') {
        isRim = true; makePct += 8; assistPct = 65;
      } else if (playType === 'post') {
        var triesP = 0;
        do { off = getFloor(offTeam, sw); triesP++; } while ((off.pos !== 'PF' && off.pos !== 'C') && triesP < 3);
        isRim = true; foulExtra = 3;
      } else {
        isThree = ri(1, 100) <= (48 + schemeThreeMod(offTeam));
        var rimCh = (oScheme === 'drive') ? 38 : 25;
        isRim = !isThree && ri(1, 100) <= rimCh;
      }
      // Late and close: down three, you need a three; down one or two, you
      // go for two (and the tie)
      if (lateGame) {
        var down = isHomeOff ? (aScore - hScore) : (hScore - aScore);
        if (down === 3) { isThree = true; isRim = false; }
        else if (down === 1 || down === 2) { if (isThree) { isThree = false; isRim = ri(1, 100) <= 60; } }
      }

      var foulChance = 10 + foulExtra;
      if (D(def) < 60) foulChance += 3;
      if (isRim) foulChance += 4;
      if (oScheme === 'drive' && isRim && (playType === 'iso' || playType === 'pnr')) foulChance += 3;
      if (isClutch) foulChance += 4;
      foulChance = clamp(foulChance, 5, 22);
      if (ri(1, 100) <= foulChance) {
        var dFouls = (playerFouls.get(def) || 0) + 1;
        playerFouls.set(def, dFouls);
        if (dFouls >= 5) out.add(def);
        ev.type = 'foul'; ev.off = off; ev.def = def; ev.ftm = 0;
        var ftPct = clamp(55 + Math.round(S(off) * 0.2), 65, 85);
        var tiredness = Math.min((fatigue.get(off) || 0) / 80, 0.15);
        ftPct = Math.round(ftPct * (1 - tiredness * 0.5));
        ftPct = clamp(ftPct, 60, 90);
        var lastFtMade = false;
        for (var ft = 0; ft < 2; ft++) {
          lastFtMade = ri(1, 100) <= ftPct;
          if (lastFtMade) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; ev.ftm++; }
        }
        off.s.fta = (off.s.fta || 0) + 2;
        if (!lastFtMade) ftRebound(offTeam, defTeam);
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        return;
      }

      if (ri(1, 100) <= 5) {
        ev.type = 'foul'; ev.off = off; ev.def = def; ev.ftm = 0;
        var ftPct2 = clamp(55 + Math.round(S(off) * 0.2), 65, 85);
        var tiredness2 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
        ftPct2 = Math.round(ftPct2 * (1 - tiredness2 * 0.5));
        var lastFt2 = false;
        for (var ft2 = 0; ft2 < 2; ft2++) {
          lastFt2 = ri(1, 100) <= ftPct2;
          if (lastFt2) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; ev.ftm++; }
        }
        off.s.fta = (off.s.fta || 0) + 2;
        if (!lastFt2) ftRebound(offTeam, defTeam);
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        return;
      }

      if (playType !== 'fastbreak') {
        var blkChance = isThree ? 1 : (isRim ? 8 : 6);
        blkChance = clamp(blkChance + Math.round((def.reb - 50) * 0.08), 1, 18);
        if (ri(1, 100) <= blkChance) {
          var blocker = getFloor(defTeam, bW);
          ev.type = 'block'; ev.off = off; ev.def = blocker;
          if (typeof blocker.s.blk !== 'number') blocker.s.blk = 0;
          blocker.s.blk++; blocker.s.reb++; off.s.fga++;
          if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
          return;
        }
      }

      if (makePct === 0) {
        if (isThree) {
          makePct = clamp(37 + Math.round((S(off) - D(def)) * 0.2 * TUNE.skill), 28, 48) + shotBonus / 2;
          if (defScheme === '2-3' || defScheme === 'zone') makePct += 2;
          else if (defScheme === '3-2') makePct -= 5;
          else if (defScheme === '1-3-1') makePct += 2;
          if (defScheme === 'press') makePct += 2;
        } else if (isRim) {
          makePct = clamp(65 + Math.round((F(off) - D(def)) * 0.3 * TUNE.skill), 48, 80) + shotBonus;
          if (defScheme === '2-3' || defScheme === 'zone') makePct -= 8;
          else if (defScheme === '3-2') makePct += 4;
          if (defScheme === 'press') makePct += 2;
        } else {
          makePct = clamp(51 + Math.round((S(off) - D(def)) * 0.25 * TUNE.skill), 36, 60) + shotBonus;
          if (defScheme === '3-2') makePct -= 2;
          if (defScheme === 'press') makePct += 2;
        }
        if (oScheme === 'motion' && !isRim) makePct += 2;
        if (offStar && off === offStar) makePct -= 6;
      }
      if (isClutch) makePct -= 3;
      // Your coach's offense and defense (your games only)
      makePct += isHomeOff ? (coachEdgeH - coachDefA) : (coachEdgeA - coachDefH);
      // Volume: past a normal night's shots, each extra attempt is a little
      // harder (the defense keys on him, tired legs)
      var vol = shots.get(off) || 0;
      if (vol > TUNE.volFree) makePct -= (vol - TUNE.volFree) * TUNE.volPen;
      shots.set(off, vol + 1);
      makePct += momMakeBonus;
      makePct += scoreEffect(isHomeOff, secondHalf);
      // Late and close, the leader milks the clock for a tougher shot and the
      // trailer gets all-out effort
      if (lateGame) {
        var lead3 = isHomeOff ? (hScore - aScore) : (aScore - hScore);
        if (lead3 >= 1 && lead3 <= 4) makePct -= TUNE.lateSqueeze;
        else if (lead3 >= -4 && lead3 <= -1) makePct += TUNE.lateSqueeze / 2;
      }
      var tiredness3 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
      makePct = Math.round(makePct * (1 - tiredness3));
      makePct = clamp(makePct, 25, 78);

      off.s.fga++;
      if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
      ev.off = off; ev.def = def; ev.three = isThree; ev.rim = isRim; ev.fast = playType === 'fastbreak';
      if (ri(1, 100) <= makePct) {
        ev.type = 'make';
        var pts = isThree ? 3 : 2;
        if (isHomeOff) hScore += pts; else aScore += pts;
        off.s.pts += pts; off.s.fgm++;
        if (isThree) off.s.tpm = (off.s.tpm || 0) + 1;
        if (ri(1, 100) <= assistPct) { pickAssister(offTeam, off, out); }
        if (!isThree && ri(1, 100) <= 8) { ev.and1 = true; if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.fta = (off.s.fta || 0) + 1; off.s.ftm = (off.s.ftm || 0) + 1; }
        if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
      } else {
        var oRebChance = TUNE.oreb;
        if (defScheme === '2-3' || defScheme === 'zone') oRebChance += 3;
        else if (defScheme === '3-2') oRebChance += 2;
        if (ri(1, 100) <= oRebChance) {
          var oReb = getFloor(offTeam, rW); oReb.s.reb++; ev.oreb = oReb; oReb.s.oreb = (oReb.s.oreb || 0) + 1;
          // Second-chance putback: the rebounder goes right back up (rim attempt).
          // This is what makes FGA/rebound volume match real D1 (OREB extends
          // the possession instead of ending it).
          if (ri(1, 100) > PUTBACK_PCT) {
            // Kick-out: the possession resets and the offense runs its normal
            // shot selection (perimeter-weighted) instead of a big's putback.
            var ko = getFloor(offTeam, sw), koDef = getFloor(defTeam, onW);
            var ko3 = ri(1, 100) <= 45;
            var koPct = ko3 ? clamp(38 + Math.round((S(ko) - D(koDef)) * 0.2 * TUNE.skill), 28, 48) + shotBonus / 2
                            : clamp(50 + Math.round((S(ko) - D(koDef)) * 0.25 * TUNE.skill), 36, 60) + shotBonus;
            koPct += scoreEffect(isHomeOff, secondHalf) + (isHomeOff ? (coachEdgeH - coachDefA) : (coachEdgeA - coachDefH));
            koPct = Math.round(koPct * (1 - Math.min((fatigue.get(ko) || 0) / 80, 0.15)));
            ko.s.fga++; if (ko3) ko.s.tpa = (ko.s.tpa || 0) + 1;
            if (ri(1, 100) <= koPct) {
              var kp = ko3 ? 3 : 2;
              if (isHomeOff) hScore += kp; else aScore += kp;
              ko.s.pts += kp; ko.s.fgm++; if (ko3) ko.s.tpm = (ko.s.tpm || 0) + 1;
              ev.type = 'make'; ev.off = ko; ev.def = koDef; ev.three = ko3; ev.kick = true;
              if (ri(1, 100) <= 70) pickAssister(offTeam, ko, out);
              if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
            } else {
              var koReb = getFloor(defTeam, rW); koReb.s.reb++;
              ev.type = 'miss'; ev.off = ko; ev.def = koDef; ev.three = ko3; ev.kick = true;
              if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
            }
            return;
          }
          var pbDef = getFloor(defTeam, onW);
          var pbPct = clamp(52 + Math.round((F(oReb) - D(pbDef)) * 0.3 * TUNE.skill), 38, 72) + shotBonus;
          var pbTired = Math.min((fatigue.get(oReb) || 0) / 80, 0.15);
          pbPct = Math.round(pbPct * (1 - pbTired));
          oReb.s.fga++;
          if (ri(1, 100) <= pbPct) {
            if (isHomeOff) hScore += 2; else aScore += 2;
            oReb.s.pts += 2; oReb.s.fgm++;
            ev.type = 'putback'; ev.off = oReb;
            if (ri(1, 100) <= 30) { pickAssister(offTeam, oReb, out); }
            if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
          } else if (ri(1, 100) <= 30) {
            var oReb2 = getFloor(offTeam, rW); oReb2.s.reb++; oReb2.s.oreb = (oReb2.s.oreb || 0) + 1;
          } else {
            var dReb2 = getFloor(defTeam, rW); dReb2.s.reb++;
            if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
          }
        }
        else {
          var dReb = getFloor(defTeam, rW); dReb.s.reb++; lastTransition = true;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        }
      }
  }

  // Score effects (garbage time / comeback pressure): once a lead gets big in
  // the second half, the leader empties the bench and coasts while the trailer
  // gambles and presses. Close games are untouched.
  function scoreEffect(isHomeOff, secondHalf) {
    if (!secondHalf) return 0;
    var lead = isHomeOff ? (hScore - aScore) : (aScore - hScore);
    var over = Math.abs(lead) - SCORE_EFFECT_START;
    if (over <= 0) return 0;
    var a = Math.min(TUNE.scoreMax, over * TUNE.scoreRate);
    return lead > 0 ? -a : a;
  }

  // A missed final free throw is a live ball: the defense usually secures it.
  function ftRebound(offTeam, defTeam) {
    if (ri(1, 100) <= 14) { var o = getFloor(offTeam, rW); o.s.reb++; o.s.oreb = (o.s.oreb || 0) + 1; }
    else { var d = getFloor(defTeam, rW); d.s.reb++; }
  }

  return {
    home: home, away: away, gamePoss: gamePoss,
    // one possession: isHomeOff, clutch (last minutes), late (last few
    // trips of a close game), secondHalf (score effects). Returns what
    // happened: { type, pts, defPts, off, def, three, rim, fast, and1, ... }
    poss: function(isHomeOff, clutch, late, secondHalf) {
      return isHomeOff ? runOnePoss(home, away, true, clutch, late, secondHalf)
                       : runOnePoss(away, home, false, clutch, late, secondHalf);
    },
    score: function() { return { h: hScore, a: aScore }; },
    // last resort if overtimes can't break a tie: a free throw to a player
    breakTie: function() { if (hScore === aScore) { hScore++; getFloor(home).s.pts++; } }
  };
}

export function simGame(home, away, userIsHome) {
  var userInvolved = (home.id === G.tid) || (away.id === G.tid);
  // Records: snapshot the user's team's per-player stats before the sim so
  // single-game record checks can diff afterwards. CPU-only games skip it.
  var _recSnap = userInvolved
    ? { h: snapRoster(home), a: snapRoster(away), hid: home.id, aid: away.id }
    : null;
  var g = createGame(home, away, { countGP: true });
  var gamePoss = g.gamePoss;
  for (var pi = 0; pi < gamePoss; pi++) {
    var pClutch = (pi >= gamePoss - 8), pLate = (pi >= gamePoss - TUNE.lateTrips), p2 = pi >= gamePoss * 0.45;
    g.poss(true, pClutch, pLate, p2);
    g.poss(false, pClutch, pLate, p2);
  }
  // Overtime: real 5-minute periods (an eighth of the game's possessions
  // each), as many as it takes. The crowd-noise and score rules carry over.
  var ot = 0, otPoss = Math.max(6, Math.round(gamePoss / 8));
  while (g.score().h === g.score().a && ot < 6) {
    ot++;
    for (var oti = 0; oti < otPoss; oti++) {
      var otClutch = oti >= otPoss - 2;
      g.poss(true, otClutch, otClutch, true); g.poss(false, otClutch, otClutch, true);
    }
  }
  // Safety net after six overtimes (never seen in testing): one more trip
  // each until it breaks, then credit a free throw to a player
  for (var otx = 0; otx < 10 && g.score().h === g.score().a; otx++) { g.poss(true, true, true, true); g.poss(false, true, true, true); }
  g.breakTie();
  var sc = g.score();
  var res = { homeScore: sc.h, awayScore: sc.a };
  if (ot) res.ot = ot;
  if (_recSnap) {
    res.plines = {
      h: { tid: _recSnap.hid, lines: diffRoster(home, _recSnap.h) },
      a: { tid: _recSnap.aid, lines: diffRoster(away, _recSnap.a) }
    };
  }
  return res;
}
