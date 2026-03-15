// ═══════════════════════════════════════════════════════════
//  HOOPS OS — simulation.js
//  Core game engine. Player generation, possession logic,
//  full game simulation, stat distribution, momentum.
//  No DOM access. No UI side effects.
// ═══════════════════════════════════════════════════════════

import { COM, DIFF_MOD } from './constants.js';
import { ri, clamp, gn, getOvr, getTOvr, pick } from './utils.js';
import { G } from './state.js';

// ── Player Generation ────────────────────────────────────
export function genPlayer(base, pos, cls) {
  var p = {
    name: gn(), pos: pos, cls: cls, mins: 0,
    sht: ri(base - 12, base + 12),
    fin: ri(base - 12, base + 12),
    def: ri(base - 12, base + 12),
    reb: ri(base - 12, base + 12),
    ply: ri(base - 12, base + 12),
    s: { gp: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0 }
  };
  if (pos === 'PG') { p.ply += 16; p.sht += 5; p.reb -= 16; }
  if (pos === 'SG') { p.sht += 14; p.fin += 5; p.reb -= 10; }
  if (pos === 'SF') { p.sht += 5; p.fin += 7; p.def += 5; }
  if (pos === 'PF') { p.fin += 11; p.reb += 11; p.sht -= 10; p.def += 4; }
  if (pos === 'C')  { p.fin += 16; p.reb += 16; p.def += 10; p.sht -= 20; p.ply -= 8; }
  ['sht', 'fin', 'def', 'reb', 'ply'].forEach(function(a) {
    p[a] = clamp(p[a], 38, 99);
  });
  p.ovr = getOvr(p);

  // Potential — higher ceiling for younger players
  var potGap = cls === 'FR' ? ri(5, 18) : cls === 'SO' ? ri(3, 12) : cls === 'JR' ? ri(1, 7) : ri(0, 3);
  // Hidden gem chance: ~8% of freshmen get a huge potential spike regardless of current OVR
  if (cls === 'FR' && Math.random() < 0.08) {
    potGap = ri(18, 30);
  }
  p.pot = clamp(p.ovr + potGap, p.ovr, 99);

  return p;
}

// ── Engine Strategy ──────────────────────────────────────
// Determines a team's play style for the sim engine.
export function getEngineStrat(t) {
  var ovr = getTOvr(t);
  var f = t.strat ? t.strat.focus : 'balanced';
  var d = t.strat ? t.strat.def : 'man';
  if (f === 'perimeter') return 'Pace & Space';
  if (d === 'press' || f === 'paint') return 'Grit & Grind';
  if (ovr >= 88) return 'Pace & Space';
  if (ovr >= 78) return 'Standard';
  return 'Grit & Grind';
}

// ── Floor Selection ──────────────────────────────────────
// Picks a random active player weighted by minutes.
export function getFloor(team) {
  var pool = [];
  team.rost.forEach(function(p) {
    for (var i = 0; i < p.mins; i++) pool.push(p);
  });
  return pool.length ? pool[ri(0, pool.length - 1)] : team.rost[0];
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

// ── Single Possession ────────────────────────────────────
// Simulates one offensive possession. Returns:
//   { pts, time, pbp, big, type, run? }
// Mutates player stat objects (fga, fgm, pts, reb, ast).
export function simPoss(offT, defT) {
  var off = getFloor(offT), def = getFloor(defT);
  var time = ri(12, 22);

  // Turnover — playmaking vs defense
  var toChance = clamp(0.13 - (off.ply - def.def) * 0.0015, 0.06, 0.24);
  if (Math.random() < toChance) {
    return {
      pts: 0, time: time,
      pbp: '<span class="p-to">' + pick(COM.turn, off.name, def.name) + '</span>',
      big: false, type: 'turn'
    };
  }

  // Shot type — strategy-based 3pt rate
  var strat = getEngineStrat(offT);
  var use3 = strat === 'Pace & Space' ? 0.42 : strat === 'Grit & Grind' ? 0.23 : 0.32;
  var is3 = Math.random() < use3;
  var isDunk = !is3 && off.fin > 82 && Math.random() < 0.28;

  // Block chance — based on rim protection (reb attribute)
  var blkChance = is3 ? 0.02 : clamp((def.reb - 65) * 0.0025, 0.01, 0.13);
  if (Math.random() < blkChance) {
    return {
      pts: 0, time: time,
      pbp: '<span class="p-bl">' + pick(COM.block, off.name, def.name) + '</span>',
      big: true, type: 'block'
    };
  }

  // Shot make chance — shooter vs defender
  var shotAttr = is3 ? off.sht : off.fin;
  var makeChance = clamp(0.39 + (shotAttr - def.def) * 0.0028, 0.22, 0.74);
  off.s.fga++;

  if (Math.random() < makeChance) {
    var pts = is3 ? 3 : 2;
    off.s.fgm++;
    off.s.pts += pts;

    // Assist
    var asst = Math.random() < 0.58 ? getFloor(offT) : null;
    if (asst && asst.name !== off.name) asst.s.ast = (asst.s.ast || 0) + 1;

    // And-1
    var andOne = !is3 && Math.random() < 0.08;
    if (andOne) { pts += 1; off.s.pts += 1; }

    var pbpTxt = isDunk ? pick(COM.dunk, off.name, def.name) :
                 is3    ? pick(COM.make3, off.name, def.name) :
                          pick(COM.make2, off.name, def.name);

    var _run = updateMomentum(offT.id !== undefined ? offT.id : -1, pts);

    return {
      pts: pts, time: time,
      pbp: '<span class="p-mk">' + pbpTxt + '</span>' +
           (andOne ? ' <span style="color:#63b3ed">(and-1!)</span>' : ''),
      big: isDunk || andOne, type: 'make', run: _run
    };
  } else {
    // Off rebound putback
    if (Math.random() < 0.22) {
      off.s.reb++;
      off.s.pts += 2;
      off.s.fgm++;
      var _run2 = updateMomentum(offT.id !== undefined ? offT.id : -1, 2);
      return {
        pts: 2, time: time + 4,
        pbp: '<span class="p-mk">' + pick(COM.putback, off.name) + '</span>',
        big: false, type: 'make', run: _run2
      };
    }
    def.s.reb = (def.s.reb || 0) + 1;
    return {
      pts: 0, time: time,
      pbp: '<span class="p-ms">' + pick(is3 ? COM.miss3 : COM.miss2, off.name, def.name) + '</span>',
      big: false, type: 'miss'
    };
  }
}

// ── Full Game Simulation ─────────────────────────────────
// Runs a complete game (regulation + OT). Returns:
//   { homeScore, awayScore }
// Temporarily modifies user team player attributes for
// difficulty, then restores them.
export function simGame(home, away, userIsHome) {
  var dm = DIFF_MOD[G.difficulty] || 0;
  var hStrat = getEngineStrat(home), aStrat = getEngineStrat(away);

  // Pace
  var pace = 71 + ri(-5, 6);
  if (hStrat === 'Pace & Space' || aStrat === 'Pace & Space') pace += 7;
  if (hStrat === 'Grit & Grind' && aStrat === 'Grit & Grind') pace -= 6;

  // Apply difficulty — nerf user AND boost CPU
  var userTeamPlayers = [];
  var cpuTeamPlayers = [];
  if (dm !== 0) {
    var userT = (userIsHome ? home : away);
    var cpuT = (userIsHome ? away : home);
    // Nerf user
    userT.rost.forEach(function(p) {
      if (p.mins > 0) {
        userTeamPlayers.push({ p: p, sht: p.sht, fin: p.fin, def: p.def });
        p.sht = clamp(p.sht + dm, 30, 99);
        p.fin = clamp(p.fin + dm, 30, 99);
        p.def = clamp(p.def + dm, 30, 99);
      }
    });
    // Boost CPU (half the magnitude, opposite direction)
    var cpuBoost = Math.round(-dm * 0.5);
    if (cpuBoost !== 0) {
      cpuT.rost.forEach(function(p) {
        if (p.mins > 0) {
          cpuTeamPlayers.push({ p: p, sht: p.sht, fin: p.fin, def: p.def });
          p.sht = clamp(p.sht + cpuBoost, 30, 99);
          p.fin = clamp(p.fin + cpuBoost, 30, 99);
          p.def = clamp(p.def + cpuBoost, 30, 99);
        }
      });
    }
  }

  var hScore = 0, aScore = 0;
  var poss = 'A';

  for (var i = 0; i < pace * 2; i++) {
    var offT = poss === 'H' ? home : away;
    var defT = poss === 'H' ? away : home;
    var res = simPoss(offT, defT);
    if (poss === 'H') hScore += res.pts; else aScore += res.pts;
    poss = poss === 'H' ? 'A' : 'H';
  }

  // Home court — applies to WHOEVER is home, not just user
  hScore += ri(1, 6);

  // Upset variance — random swing that makes any game losable
  var upset = ri(-8, 8);
  hScore += upset > 0 ? upset : 0;
  aScore += upset < 0 ? -upset : 0;

  // Coach OFF/DEF bonuses (applied to user team only)
  var userTeam = userIsHome ? home : away;
  if (userTeam && G.coach) {
    var offBonus = Math.round((G.coach.off - 70) * 0.15);
    var defPenalty = Math.round((G.coach.def - 70) * 0.15);
    if (userIsHome) { hScore += offBonus; aScore -= defPenalty; }
    else { aScore += offBonus; hScore -= defPenalty; }
  }

  // Restore player stats
  userTeamPlayers.forEach(function(obj) {
    obj.p.sht = obj.sht; obj.p.fin = obj.fin; obj.p.def = obj.def;
  });
  cpuTeamPlayers.forEach(function(obj) {
    obj.p.sht = obj.sht; obj.p.fin = obj.fin; obj.p.def = obj.def;
  });

  // Overtime
  var ot = 0;
  while (hScore === aScore && ot < 5) {
    for (var j = 0; j < 8; j++) {
      var res2 = simPoss(j % 2 === 0 ? home : away, j % 2 === 0 ? away : home);
      if (j % 2 === 0) hScore += res2.pts; else aScore += res2.pts;
    }
    ot++;
    if (ot === 5 && hScore === aScore) hScore++;
  }

  return { homeScore: hScore, awayScore: aScore };
}

// ── Stat Distribution ────────────────────────────────────
// After a quick sim (non-live), distribute team score across
// Distribute individual stats after a game. Weighted by minutes and attributes.
// Target realistic college stats: top scorer ~22-26 PPG, top rebounder ~10-12 RPG, top assist ~6-8 APG
export function distributeStats(team, teamScore) {
  var active = team.rost.filter(function(p) { return p.mins > 0; });
  if (!active.length) return;
  var totalMins = active.reduce(function(a, b) { return a + b.mins; }, 0);
  if (totalMins === 0) return;

  // Calculate weighted shares for points (shooting-weighted)
  var totalPtWeight = 0;
  active.forEach(function(p) {
    var share = p.mins / totalMins;
    totalPtWeight += share * (0.5 + (p.sht / 99) * 0.5);
  });

  var remaining = teamScore;
  active.forEach(function(p, i) {
    p.s.gp++;
    var share = p.mins / totalMins;

    // Points — shooting-weighted share of team total
    var ptWeight = share * (0.5 + (p.sht / 99) * 0.5);
    var ptShare = Math.round(teamScore * (ptWeight / totalPtWeight));
    if (i === active.length - 1) {
      ptShare = remaining; // last player gets remainder to ensure total matches
    } else {
      ptShare = Math.min(ptShare, remaining);
    }
    p.s.pts += ptShare;
    remaining -= ptShare;

    // Rebounds — team gets ~33-38 total, distributed by reb attribute + minutes
    var teamReb = 35;
    var rebShare = Math.round(teamReb * share * (0.4 + (p.reb / 99) * 0.6));
    rebShare = Math.max(0, Math.min(rebShare, 15)); // cap individual
    p.s.reb += rebShare;

    // Assists — team gets ~14-18 total, distributed by playmaking
    var teamAst = 15;
    var astShare = Math.round(teamAst * share * (0.3 + (p.ply / 99) * 0.7));
    astShare = Math.max(0, Math.min(astShare, 12)); // cap individual
    p.s.ast += astShare;

    // FG attempts/makes
    var fga = Math.round(ptShare * 0.55 + ri(0, 2)); // roughly 55% of points come from FG
    if (fga < 1 && ptShare > 0) fga = 1;
    var fgPct = clamp(0.32 + (p.sht / 99) * 0.28, 0.32, 0.60);
    var fgm = Math.round(fga * fgPct);
    p.s.fga += fga;
    p.s.fgm += fgm;
  });
}
