// ═══════════════════════════════════════════════════════════
//  HOOPS OS — simulation.js
//  Core game engine. Player generation, possession logic,
//  full game simulation, stat distribution, momentum.
//  No DOM access. No UI side effects.
// ═══════════════════════════════════════════════════════════

import { COM, DIFF_MOD } from './constants.js';
import { ri, clamp, gn, getOvr, getTOvr, pick, freshS } from './utils.js';
import { moraleAttrMod, MORALE_DEFAULT } from './morale.js';
import { G, LS } from './state.js';
import { snapRoster, diffRoster } from './records.js';

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
  p.pot = clamp(p.ovr + potGap, p.ovr, 99);

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
  var ovr = getTOvr(t);
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
export function getFloor(team, wFn) {
  var pool = [];
  team.rost.forEach(function(p) {
    var w = wFn ? wFn(p) : p.mins;
    w = Math.max(0, Math.round(w));
    for (var i = 0; i < w; i++) pool.push(p);
  });
  return pool.length ? pool[ri(0, pool.length - 1)] : team.rost[0];
}

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
  var ovrExp = (scheme === 'motion') ? 1 : 2.0; // motion: even shot distribution
  var w = p.mins * Math.pow(Math.max(40, p.ovr) / 72, ovrExp) * (u / 20) * (POS_USAGE[p.pos] || 1);
  if (scheme === 'drive' && p.pos === 'PG') w *= 1.8;
  if (scheme === 'set' && (p.pos === 'PF' || p.pos === 'C')) w *= 1.75;
  return w;
}
function astW(p) { return p.mins * Math.pow(Math.max(40, p.ply) / 62, 2); }
function rebW(p) { return p.mins * Math.pow(Math.max(40, p.reb) / 62, 3); }

// Primary-playmaker assist: 55% of assists go to the highest-ply player on
// the floor (not the scorer), the rest are weighted by playmaking.
function pickAssister(offTeam, off) {
  var asst = null;
  if (ri(1, 100) <= 48) {
    var bestPly = -1;
    offTeam.rost.forEach(function(p) {
      if (p !== off && p.mins > 0 && p.ply > bestPly) { bestPly = p.ply; asst = p; }
    });
  } else {
    var tries = 0;
    asst = getFloor(offTeam, astW);
    while (asst === off && tries < 5) { asst = getFloor(offTeam, astW); tries++; }
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
// Play types, defensive schemes, clutch, fouls, steals, blocks.
// Returns: { pts, time, pbp, big, type, run }
export function simPoss(offT, defT) {
  // NOTE: live game is watch-only by design (jack) — no mid-game coaching
  // controls. Schemes/rotation/usage are pre-game decisions only.
  var time = ri(12, 22);
  var pts = 0;
  var pbp = '';
  var big = false;
  var type = 'miss';
  var run = null;

  var possCount = (typeof LS.possCount === 'number') ? LS.possCount : 0;
  var tiredness = Math.min(possCount / 160, 0.12);
  var isClutch = (LS.clock <= 120 && LS.half === 2);

  var defScheme = (defT.strat && defT.strat.def) ? defT.strat.def : 'man';
  var oScheme = (offT.strat && offT.strat.off) || 'balanced';
  var offStarS = (defScheme === 'box1') ? teamStar(offT) : null;
  var swS = function(p) {
    var w = shooterWeight(p, offT);
    if (offStarS && p === offStarS) w *= 0.35;
    return w;
  };
  var off = getFloor(offT, swS);
  var def = getFloor(defT);

  // Play type
  var playRoll = ri(1, 100);
  var playType = 'standard';
  var isoTs = (oScheme === 'drive') ? 22 : 15;
  var pnrTs = isoTs + 25;
  if (playRoll <= isoTs) playType = 'iso';
  else if (playRoll <= pnrTs) playType = 'pnr';
  else if (playRoll <= 50) playType = 'fastbreak';
  else if (playRoll <= 60) playType = 'post';
  if (isClutch && playType === 'fastbreak') playType = 'standard';

  var isThree = false, isRim = false, makePct = 0, assistPct = 58, foulExtra = 0;

  if (playType === 'iso') {
    var bestOvr = 0;
    offT.rost.forEach(function(p) { if (p.mins > 0 && p.ovr > bestOvr) bestOvr = p.ovr; });
    var tr = 0;
    do { off = getFloor(offT, swS); tr++; } while (off.ovr < bestOvr - 5 && tr < 3);
    isRim = off.fin > off.sht + 8; isThree = !isRim && ri(1, 100) <= 55;
    makePct = isRim ? 60 : 45; assistPct = 25;
  } else if (playType === 'pnr') {
    var tg = 0;
    do { off = getFloor(offT, swS); tg++; } while ((off.pos !== 'PG' && off.pos !== 'SG') && tg < 3);
    var scr = getFloor(offT, swS); var tb = 0;
    while ((scr.pos !== 'PF' && scr.pos !== 'C') && tb < 3) { scr = getFloor(offT, swS); tb++; }
    var pr = ri(1, 100);
    if (pr <= 60) { isThree = ri(1, 100) <= 65; isRim = !isThree; }
    else if (pr <= 80) { off = scr; isRim = true; }
    else { off = getFloor(offT, swS); isThree = true; makePct += 5; }
    assistPct = 78;
  } else if (playType === 'fastbreak') {
    isRim = true; makePct += 9; assistPct = 68;
  } else if (playType === 'post') {
    var tp = 0;
    do { off = getFloor(offT, swS); tp++; } while ((off.pos !== 'PF' && off.pos !== 'C') && tp < 3);
    isRim = true; foulExtra = 4;
  } else {
    var sB = schemeThreeMod(offT);
    isThree = ri(1, 100) <= (40 + sB); isRim = !isThree && ri(1, 100) <= 26;
  }

  // Foul
  var foulChance = 8 + foulExtra;
  if (def.def < 60) foulChance += 3;
  if (isRim) foulChance += 5;
  if (oScheme === 'drive' && isRim && (playType === 'iso' || playType === 'pnr')) foulChance += 3;
  if (isClutch) foulChance += 5;
  foulChance = clamp(foulChance, 6, 24);
  if (ri(1, 100) <= foulChance) {
    var ftPct = clamp(55 + Math.round(off.sht * 0.22), 65, 88);
    ftPct = Math.round(ftPct * (1 - tiredness * 0.6));
    var made = 0;
    for (var f = 0; f < 2; f++) { if (ri(1, 100) <= ftPct) made++; }
    off.s.pts += made;
    off.s.fta = (off.s.fta || 0) + 2; off.s.ftm = (off.s.ftm || 0) + made;
    return { pts: made, time: time, pbp: '<span class="p-foul">Foul on ' + def.name + '. ' + off.name + ' to the line \u2014 ' + made + ' of 2.</span>', big: made === 2, type: 'foul', run: null };
  }

  // Turnover
  var toChance = clamp(17 + Math.round((def.def - off.ply) * 0.13), 8, 28);
  if (defScheme === 'press') toChance += 6;
  if (defScheme === '2-3' || defScheme === 'zone') toChance -= 2;
  if (defScheme === '3-2') toChance -= 1;
  if (defScheme === '1-3-1') toChance += 5;
  if (isClutch) toChance += 3;
  if (ri(1, 100) <= toChance) {
    off.s.to = (off.s.to || 0) + 1;
    if (ri(1, 100) <= 62) {
      if (typeof def.s.stl !== 'number') def.s.stl = 0;
      def.s.stl++;
      return { pts: 0, time: time, pbp: '<span class="p-to">' + pick(COM.steal, off.name, def.name) + '</span>', big: false, type: 'turn', run: null };
    }
    return { pts: 0, time: time, pbp: '<span class="p-to">' + pick(COM.turn, off.name, def.name) + '</span>', big: false, type: 'turn', run: null };
  }

  // Block
  if (playType !== 'fastbreak') {
    var bc = isThree ? 1 : (isRim ? 8 : 5);
    bc = clamp(bc + Math.round((def.reb - 50) * 0.09), 1, 19);
    if (ri(1, 100) <= bc) {
      if (typeof def.s.blk !== 'number') def.s.blk = 0;
      def.s.blk++; def.s.reb++;
      return { pts: 0, time: time, pbp: '<span class="p-bl">' + pick(COM.block, off.name, def.name) + '</span>', big: true, type: 'block', run: null };
    }
  }

  // Shot make %
  if (makePct === 0) {
    if (isThree) {
      makePct = clamp(40 + Math.round((off.sht - def.def) * 0.22), 28, 48);
      if (defScheme === '2-3' || defScheme === 'zone') makePct += 4;
      else if (defScheme === '3-2') makePct -= 5;
      else if (defScheme === '1-3-1') makePct += 2;
      if (defScheme === 'press') makePct += 3;
    } else if (isRim) {
      makePct = clamp(64 + Math.round((off.fin - def.def) * 0.32), 48, 80);
      if (defScheme === '2-3' || defScheme === 'zone') makePct -= 6;
      else if (defScheme === '3-2') makePct += 4;
      if (defScheme === 'press') makePct += 3;
    } else {
      makePct = clamp(48 + Math.round((off.sht - def.def) * 0.26), 36, 58);
      if (defScheme === '3-2') makePct -= 2;
      if (defScheme === 'press') makePct += 3;
    }
    if (oScheme === 'motion' && !isRim) makePct += 2;
    if (offStarS && off === offStarS) makePct -= 6;
  }
  if (isClutch) makePct -= 4;
  // Home court + score effects, matching simGame so watched games play like
  // simmed ones. Tournament games are neutral-site.
  var liveHome = (G.phase === 'reg' && offT === LS.tH);
  if (liveHome) makePct += HOME_BONUS;
  if (LS.half >= 2) {
    var liveLead = (offT === LS.tH) ? (LS.hs - LS.as) : (LS.as - LS.hs);
    var liveOver = Math.abs(liveLead) - SCORE_EFFECT_START;
    if (liveOver > 0) makePct += (liveLead > 0 ? -1 : 1) * Math.min(SCORE_EFFECT_MAX, liveOver * SCORE_EFFECT_RATE);
  }
  makePct = Math.round(makePct * (1 - tiredness));
  makePct = clamp(makePct, 26, 78);

  off.s.fga++;
  if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
  if (ri(1, 100) <= makePct) {
    pts = isThree ? 3 : 2;
    off.s.fgm++; off.s.pts += pts;
    if (isThree) off.s.tpm = (off.s.tpm || 0) + 1;
    if (ri(1, 100) <= assistPct) { pickAssister(offT, off); }
    if (!isThree && ri(1, 100) <= 9) { pts += 1; off.s.pts++; off.s.fta = (off.s.fta || 0) + 1; off.s.ftm = (off.s.ftm || 0) + 1; big = true; }
    var txt;
    if (isClutch && ri(1, 100) <= 40) txt = pick(COM.clutch, off.name);
    else if (playType === 'fastbreak' || (isRim && off.fin > 84)) txt = pick(COM.dunk, off.name, def.name);
    else if (isThree) txt = pick(COM.make3, off.name, def.name);
    else txt = pick(COM.make2, off.name, def.name);
    run = updateMomentum(offT.id !== undefined ? offT.id : -1, pts);
    return { pts: pts, time: time, pbp: '<span class="p-mk">' + txt + '</span>', big: big || playType === 'fastbreak', type: 'make', run: run };
  } else {
    if (ri(1, 100) <= 23) {
      // M5 FIX: putback credits the FGA with the FGM (was inflating FG%).
      off.s.reb++; off.s.oreb = (off.s.oreb || 0) + 1; off.s.pts += 2; off.s.fgm++; off.s.fga++;
      run = updateMomentum(offT.id !== undefined ? offT.id : -1, 2);
      return { pts: 2, time: time + 4, pbp: '<span class="p-mk">' + pick(COM.putback, off.name) + '</span>', big: false, type: 'make', run: run };
    }
    var dRebS = getFloor(defT, rebW); dRebS.s.reb = (dRebS.s.reb || 0) + 1;
    return { pts: 0, time: time, pbp: '<span class="p-ms">' + pick(isThree ? COM.miss3 : COM.miss2, off.name, def.name) + '</span>', big: false, type: 'miss', run: null };
  }
}


// ── Engine tuning (calibrated with test-harness/calib-run.mjs + season-diag.mjs)
// HOME_BONUS: shooting-% points for the home offense (~+3.5 pts/game HCA).
// PUTBACK_PCT: share of offensive rebounds that go straight back up (the rest
//   kick out and reset to a normal, perimeter-weighted shot).
// SCORE_EFFECT_*: second-half lead beyond START costs the leader RATE shooting-%
//   points per point of lead, capped at MAX (trailer gains the same).
var HOME_BONUS = 6;
var PUTBACK_PCT = 50;
var SCORE_EFFECT_START = 7;
var SCORE_EFFECT_RATE = 0.7;
var SCORE_EFFECT_MAX = 9;

// ── Full Game Simulation (Final Engine) ──────────────────
// Possession-based with play types, clutch, momentum, fouls, fatigue, schemes.
// Stats accumulate on player objects. No separate distributeStats needed.
export function simGame(home, away, userIsHome) {
  var hScore = 0, aScore = 0;
  var hOrig = [], aOrig = [];
  // M2 FIX: difficulty modifiers apply ONLY when the user's team is in the game.
  // userIsHome is unreliable (tournament CPU-vs-CPU games pass true), so derive
  // involvement from team ids vs G.tid.
  var userInvolved = (home.id === G.tid) || (away.id === G.tid);
  var userIsHomeActual = userInvolved && (home.id === G.tid);
  // Records: snapshot the user's team's per-player stats before the sim so
  // single-game record checks can diff afterwards. CPU-only games skip it.
  var _recSnap = userInvolved
    ? { h: snapRoster(home), a: snapRoster(away), hid: home.id, aid: away.id }
    : null;
  var dm = userInvolved ? (DIFF_MOD[G.difficulty] || 0) : 0;
  var userT = userIsHomeActual ? home : away;
  var cpuBoost = Math.round(-dm * 0.5);
  home.rost.forEach(function(p, i) {
    hOrig[i] = { sht: p.sht, fin: p.fin, def: p.def };
    var mod = (userT === home) ? dm : cpuBoost;
    var mm = moraleAttrMod(p); // morale: -2..+2, subtle team-wide drift
    p.sht = clamp(p.sht + mod + mm, 30, 99); p.fin = clamp(p.fin + mod + mm, 30, 99); p.def = clamp(p.def + mod + mm, 30, 99);
  });
  away.rost.forEach(function(p, i) {
    aOrig[i] = { sht: p.sht, fin: p.fin, def: p.def };
    var mod = (userT === away) ? dm : cpuBoost;
    var mm = moraleAttrMod(p); // morale: -2..+2, subtle team-wide drift
    p.sht = clamp(p.sht + mod + mm, 30, 99); p.fin = clamp(p.fin + mod + mm, 30, 99); p.def = clamp(p.def + mod + mm, 30, 99);
  });
  // M8 FIX: wire the sellout-crowd event (events.js sets G.nextHomeBonus=3).
  // Applies to the user's next home game only, consumed once.
  // Conference and NCAA tournament games are neutral-site: no home court.
  var neutralSite = G.phase === 'conf_tourn' || G.phase === 'ncaa';
  var homeBonus = neutralSite ? 0 : HOME_BONUS;
  if (!neutralSite && userIsHomeActual && (G.nextHomeBonus || 0) > 0) {
    homeBonus += G.nextHomeBonus;
    G.nextHomeBonus = 0;
  }
  // Pace is a GAME-level trait (both teams alternate possessions, so both get
  // the same count — real basketball). Averaging the two schemes' tendencies:
  // early-vs-early runs, set-vs-set grinds. Per-team pace created possession
  // inequality (up to ~14 extra trips) which blew up margin variance.
  var gamePoss = clamp(68 + Math.round((schemePaceMod(home.strat) + schemePaceMod(away.strat)) / 2) + ri(-3, 3), 56, 88);
  // M1 NOTE: simGame owns the single per-game GP increment for both teams.
  // Callers must NOT increment GP again for the same game (season.js
  // recordResult currently does for user games — that half is the S-team fix).
  home.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
  away.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });

  // M7 FIX: key fatigue/fouls/minutes by player identity (Map on the player
  // object), not by name — duplicate names used to scramble these.
  var fatigue = new Map(), playerFouls = new Map(), origMins = new Map();
  home.rost.forEach(function(p) {
    if (p.mins > 0) {
      fatigue.set(p, 0); playerFouls.set(p, 0); origMins.set(p, p.mins);
      if (typeof p.s.stl !== 'number') p.s.stl = 0;
      if (typeof p.s.blk !== 'number') p.s.blk = 0;
    }
  });
  away.rost.forEach(function(p) {
    if (p.mins > 0) {
      fatigue.set(p, 0); playerFouls.set(p, 0); origMins.set(p, p.mins);
      if (typeof p.s.stl !== 'number') p.s.stl = 0;
      if (typeof p.s.blk !== 'number') p.s.blk = 0;
    }
  });

  var hMomentum = 0, aMomentum = 0;
  var lastTransition = false;

  // INTERLEAVE FIX: possessions alternate home/away like a real game. Running all
  // of one team's possessions first gave the first offense a ~+4pt edge because
  // fatigue accumulates across the whole game (the second offense shot tired).
  // Interleaving removes the bias and makes momentum a real tug-of-war.
  function runOnePoss(offTeam, defTeam, isHomeOff, isClutch) {
    var shotBonus = isHomeOff ? homeBonus : 0;
    var defScheme = (defTeam.strat && defTeam.strat.def) ? defTeam.strat.def : 'man';
    var oScheme = (offTeam.strat && offTeam.strat.off) || 'balanced';
    // Box-and-one: the defense's answer to the opponent's star — freeze him out.
    var offStar = (defScheme === 'box1') ? (isHomeOff ? homeStar : awayStar) : null;
    var sw = function(p) {
      var w = shooterWeight(p, offTeam);
      if (offStar && p === offStar) w *= 0.35;
      return w;
    };
      var off = getFloor(offTeam, sw);
      var def = getFloor(defTeam);
      fatigue.set(off, (fatigue.get(off) || 0) + 1);
      fatigue.set(def, (fatigue.get(def) || 0) + 1);
      if (defScheme === 'press') fatigue.set(def, (fatigue.get(def) || 0) + 1);

      var momMakeBonus = 0, momTOBonus = 0;
      var offMom = isHomeOff ? hMomentum : aMomentum;
      if (offMom >= 6) { momMakeBonus = 2; momTOBonus = 1; }
      else if (offMom >= 4) { momMakeBonus = 1; momTOBonus = 0; }
      momMakeBonus = clamp(momMakeBonus, 0, 5);

      var toChance = clamp(16 + Math.round((def.def - off.ply) * 0.12), 8, 26);
      if (defScheme === 'press') toChance += 5;
      if (defScheme === '2-3' || defScheme === 'zone') toChance -= 2;
      if (defScheme === '3-2') toChance -= 1;
      if (defScheme === '1-3-1') toChance += 5;
      if (isClutch) toChance += 2;
      toChance += momTOBonus;
      toChance = clamp(toChance, 8, 30);
      if (ri(1, 100) <= toChance) {
        off.s.to = (off.s.to || 0) + 1;
        if (ri(1, 100) <= 60) {
          if (typeof def.s.stl !== 'number') def.s.stl = 0;
          def.s.stl++;
        }
        // M6 FIX: press-forced fastbreak points are credited to the defender who
        // forced the turnover (FGA+FGM+PTS) — no more phantom points.
        if (defScheme === 'press' && ri(1, 100) <= 15) {
          if (isHomeOff) aScore += 2; else hScore += 2;
          def.s.pts += 2; def.s.fgm++; def.s.fga++;
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
        offTeam.rost.forEach(function(p) { if (p.mins > 0 && p.ovr > bestOvr) bestOvr = p.ovr; });
        var tries = 0;
        do { off = getFloor(offTeam, sw); tries++; } while (off.ovr < bestOvr - 5 && tries < 3);
        isRim = off.fin > off.sht;
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

      var foulChance = 10 + foulExtra;
      if (def.def < 60) foulChance += 3;
      if (isRim) foulChance += 4;
      if (oScheme === 'drive' && isRim && (playType === 'iso' || playType === 'pnr')) foulChance += 3;
      if (isClutch) foulChance += 4;
      foulChance = clamp(foulChance, 5, 22);
      if (ri(1, 100) <= foulChance) {
        var dFouls = (playerFouls.get(def) || 0) + 1;
        playerFouls.set(def, dFouls);
        if (dFouls >= 5) def.mins = 0;
        var ftPct = clamp(55 + Math.round(off.sht * 0.2), 65, 85);
        var tiredness = Math.min((fatigue.get(off) || 0) / 80, 0.15);
        ftPct = Math.round(ftPct * (1 - tiredness * 0.5));
        ftPct = clamp(ftPct, 60, 90);
        var lastFtMade = false;
        for (var ft = 0; ft < 2; ft++) {
          lastFtMade = ri(1, 100) <= ftPct;
          if (lastFtMade) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; }
        }
        off.s.fta = (off.s.fta || 0) + 2;
        if (!lastFtMade) ftRebound(offTeam, defTeam);
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        return;
      }

      if (ri(1, 100) <= 5) {
        var ftPct2 = clamp(55 + Math.round(off.sht * 0.2), 65, 85);
        var tiredness2 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
        ftPct2 = Math.round(ftPct2 * (1 - tiredness2 * 0.5));
        var lastFt2 = false;
        for (var ft2 = 0; ft2 < 2; ft2++) {
          lastFt2 = ri(1, 100) <= ftPct2;
          if (lastFt2) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; }
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
          if (typeof def.s.blk !== 'number') def.s.blk = 0;
          def.s.blk++; def.s.reb++; off.s.fga++;
          if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
          return;
        }
      }

      if (makePct === 0) {
        if (isThree) {
          makePct = clamp(37 + Math.round((off.sht - def.def) * 0.2) + shotBonus, 28, 48);
          if (defScheme === '2-3' || defScheme === 'zone') makePct += 4;
          else if (defScheme === '3-2') makePct -= 5;
          else if (defScheme === '1-3-1') makePct += 2;
          if (defScheme === 'press') makePct += 2;
        } else if (isRim) {
          makePct = clamp(65 + Math.round((off.fin - def.def) * 0.3) + shotBonus, 48, 80);
          if (defScheme === '2-3' || defScheme === 'zone') makePct -= 6;
          else if (defScheme === '3-2') makePct += 4;
          if (defScheme === 'press') makePct += 2;
        } else {
          makePct = clamp(51 + Math.round((off.sht - def.def) * 0.25) + shotBonus, 36, 60);
          if (defScheme === '3-2') makePct -= 2;
          if (defScheme === 'press') makePct += 2;
        }
        if (oScheme === 'motion' && !isRim) makePct += 2;
        if (offStar && off === offStar) makePct -= 6;
      }
      if (isClutch) makePct -= 3;
      makePct += momMakeBonus;
      makePct += scoreEffect(isHomeOff);
      var tiredness3 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
      makePct = Math.round(makePct * (1 - tiredness3));
      makePct = clamp(makePct, 25, 78);

      off.s.fga++;
      if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
      if (ri(1, 100) <= makePct) {
        var pts = isThree ? 3 : 2;
        if (isHomeOff) hScore += pts; else aScore += pts;
        off.s.pts += pts; off.s.fgm++;
        if (isThree) off.s.tpm = (off.s.tpm || 0) + 1;
        if (ri(1, 100) <= assistPct) { pickAssister(offTeam, off); }
        if (!isThree && ri(1, 100) <= 8) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.fta = (off.s.fta || 0) + 1; off.s.ftm = (off.s.ftm || 0) + 1; }
        if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
      } else {
        var oRebChance = 32;
        if (defScheme === '2-3' || defScheme === 'zone') oRebChance += 5;
        else if (defScheme === '3-2') oRebChance += 2;
        if (ri(1, 100) <= oRebChance) {
          var oReb = getFloor(offTeam, rebW); oReb.s.reb++; oReb.s.oreb = (oReb.s.oreb || 0) + 1;
          // Second-chance putback: the rebounder goes right back up (rim attempt).
          // This is what makes FGA/rebound volume match real D1 (OREB extends
          // the possession instead of ending it).
          if (ri(1, 100) > PUTBACK_PCT) {
            // Kick-out: the possession resets and the offense runs its normal
            // shot selection (perimeter-weighted) instead of a big's putback.
            var ko = getFloor(offTeam, sw), koDef = getFloor(defTeam);
            var ko3 = ri(1, 100) <= 45;
            var koPct = ko3 ? clamp(38 + Math.round((ko.sht - koDef.def) * 0.2) + shotBonus, 28, 48)
                            : clamp(50 + Math.round((ko.sht - koDef.def) * 0.25) + shotBonus, 36, 60);
            koPct += scoreEffect(isHomeOff);
            koPct = Math.round(koPct * (1 - Math.min((fatigue.get(ko) || 0) / 80, 0.15)));
            ko.s.fga++; if (ko3) ko.s.tpa = (ko.s.tpa || 0) + 1;
            if (ri(1, 100) <= koPct) {
              var kp = ko3 ? 3 : 2;
              if (isHomeOff) hScore += kp; else aScore += kp;
              ko.s.pts += kp; ko.s.fgm++; if (ko3) ko.s.tpm = (ko.s.tpm || 0) + 1;
              if (ri(1, 100) <= 70) pickAssister(offTeam, ko);
              if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
            } else {
              var koReb = getFloor(defTeam, rebW); koReb.s.reb++;
              if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
            }
            return;
          }
          var pbDef = getFloor(defTeam);
          var pbPct = clamp(52 + Math.round((oReb.fin - pbDef.def) * 0.3) + shotBonus, 38, 72);
          var pbTired = Math.min((fatigue.get(oReb) || 0) / 80, 0.15);
          pbPct = Math.round(pbPct * (1 - pbTired));
          oReb.s.fga++;
          if (ri(1, 100) <= pbPct) {
            if (isHomeOff) hScore += 2; else aScore += 2;
            oReb.s.pts += 2; oReb.s.fgm++;
            if (ri(1, 100) <= 30) { pickAssister(offTeam, oReb); }
            if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
          } else if (ri(1, 100) <= 30) {
            var oReb2 = getFloor(offTeam, rebW); oReb2.s.reb++; oReb2.s.oreb = (oReb2.s.oreb || 0) + 1;
          } else {
            var dReb2 = getFloor(defTeam, rebW); dReb2.s.reb++;
            if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
          }
        }
        else {
          var dReb = getFloor(defTeam, rebW); dReb.s.reb++; lastTransition = true;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        }
      }
  }

  // Score effects (garbage time / comeback pressure): once a lead gets big in
  // the second half, the leader empties the bench and coasts while the trailer
  // gambles and presses. Real games compress this way, which is why college
  // blowouts rarely snowball to 40+. Close games are untouched.
  var curPoss = 0;
  function scoreEffect(isHomeOff) {
    if (curPoss < gamePoss * 0.45) return 0;
    var lead = isHomeOff ? (hScore - aScore) : (aScore - hScore);
    var over = Math.abs(lead) - SCORE_EFFECT_START;
    if (over <= 0) return 0;
    var adj = Math.min(SCORE_EFFECT_MAX, over * SCORE_EFFECT_RATE);
    return lead > 0 ? -adj : adj;
  }

  // A missed final free throw is a live ball: the defense usually secures it.
  function ftRebound(offTeam, defTeam) {
    if (ri(1, 100) <= 14) { var o = getFloor(offTeam, rebW); o.s.reb++; o.s.oreb = (o.s.oreb || 0) + 1; }
    else { var d = getFloor(defTeam, rebW); d.s.reb++; }
  }

  // Box-and-one targets, computed once per game.
  var homeStar = teamStar(home), awayStar = teamStar(away);
  for (var pi = 0; pi < gamePoss; pi++) {
    curPoss = pi;
    var pClutch = (pi >= gamePoss - 8);
    runOnePoss(home, away, true, pClutch);
    runOnePoss(away, home, false, pClutch);
  }
  // M3 FIX: user coach bonuses apply ONLY when the user's team is playing —
  // never in CPU-vs-CPU games.
  if (G.coach && userInvolved) {
    var offBonus = Math.round((G.coach.off - 70) * 0.15);
    var defBonus = Math.round((G.coach.def - 70) * 0.15);
    if (userIsHomeActual) { hScore += offBonus; aScore -= defBonus; } else { aScore += offBonus; hScore -= defBonus; }
  }
  var ot = 0;
  while (hScore === aScore && ot < 5) {
    ot++;
    for (var oti = 0; oti < 4; oti++) { runOnePoss(home, away, true, true); runOnePoss(away, home, false, true); }
  }
  // M6 FIX: no phantom OT tiebreak point — play extra possessions until the tie
  // breaks. The credited fallback is a near-impossible safety net (and even it
  // credits the point to a player rather than thin air).
  var otx = 0;
  while (hScore === aScore && otx < 10) {
    otx++;
    runOnePoss(home, away, true, true); runOnePoss(away, home, false, true);
  }
  if (hScore === aScore) { hScore++; getFloor(home).s.pts++; }
  home.rost.forEach(function(p, i) { p.sht = hOrig[i].sht; p.fin = hOrig[i].fin; p.def = hOrig[i].def; });
  away.rost.forEach(function(p, i) { p.sht = aOrig[i].sht; p.fin = aOrig[i].fin; p.def = aOrig[i].def; });
  home.rost.forEach(function(p) { if (origMins.has(p)) p.mins = origMins.get(p); });
  away.rost.forEach(function(p) { if (origMins.has(p)) p.mins = origMins.get(p); });
  var res = { homeScore: hScore, awayScore: aScore };
  if (_recSnap) {
    res.plines = {
      h: { tid: _recSnap.hid, lines: diffRoster(home, _recSnap.h) },
      a: { tid: _recSnap.aid, lines: diffRoster(away, _recSnap.a) }
    };
  }
  return res;
}
