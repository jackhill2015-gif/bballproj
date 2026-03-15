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
// active players weighted by OVR and minutes.
export function distributeStats(team, teamScore) {
  var active = team.rost.filter(function(p) { return p.mins > 0; });
  if (!active.length) return;
  var totalMins = active.reduce(function(a, b) { return a + b.mins; }, 0);
  var remaining = teamScore;
  active.forEach(function(p, i) {
    p.s.gp++;
    var share = p.mins / totalMins;
    // Points weighted by shooting ability
    var ptShare = Math.round(teamScore * share * (0.7 + (p.sht / 100) * 0.6));
    ptShare = Math.min(ptShare, remaining);
    p.s.pts += ptShare;
    if (i === active.length - 1) p.s.pts += remaining - ptShare;
    remaining -= ptShare;
    // Rebounds weighted by reb attribute
    p.s.reb += Math.round((p.reb / 99) * (35 * share) + ri(0, 2));
    // Assists weighted by playmaking
    p.s.ast += Math.round((p.ply / 99) * (18 * share) + ri(0, 1));
    // FG attempts/makes (rough estimate)
    var fga = Math.round(p.mins * 0.7 + ri(0, 3));
    var fgm = Math.round(fga * clamp(0.3 + (p.sht / 200), 0.3, 0.65));
    p.s.fga += fga;
    p.s.fgm += fgm;
  });
}
