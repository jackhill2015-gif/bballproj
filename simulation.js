// ═══════════════════════════════════════════════════════════
//  HOOPS OS — simulation.js
//  Core game engine. Player generation, possession logic,
//  full game simulation, stat distribution, momentum.
//  No DOM access. No UI side effects.
// ═══════════════════════════════════════════════════════════

import { COM, DIFF_MOD } from './constants.js';
import { ri, clamp, gn, getOvr, getTOvr, pick, freshS } from './utils.js';
import { G, LS } from './state.js';

// ── Player Generation ────────────────────────────────────
export function genPlayer(base, pos, cls) {
  var p = {
    name: gn(), pos: pos, cls: cls, mins: 0,
    sht: ri(base - 18, base + 18),
    fin: ri(base - 18, base + 18),
    def: ri(base - 18, base + 18),
    reb: ri(base - 18, base + 18),
    ply: ri(base - 18, base + 18),
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

// ── Single Possession (Live Sim) ─────────────────────────
// Play types, defensive schemes, clutch, fouls, steals, blocks.
// Returns: { pts, time, pbp, big, type, run }
export function simPoss(offT, defT) {
  // Timeout boost (UI live-sim button): +5 make% on the user's team's next
  // offensive possession only, then auto-cleared. No-op in CPU-vs-CPU games.
  var toBoost = false;
  if (offT.id === G.tid && G.timeoutBoost) { toBoost = true; G.timeoutBoost = false; }
  var time = ri(12, 22);
  var pts = 0;
  var pbp = '';
  var big = false;
  var type = 'miss';
  var run = null;

  var possCount = (typeof LS.possCount === 'number') ? LS.possCount : 0;
  var tiredness = Math.min(possCount / 160, 0.12);
  var isClutch = (LS.clock <= 120 && LS.half === 2);

  var off = getFloor(offT);
  var def = getFloor(defT);
  var defScheme = (defT.strat && defT.strat.def) ? defT.strat.def : 'man';

  // Play type
  var playRoll = ri(1, 100);
  var playType = 'standard';
  if (playRoll <= 15) playType = 'iso';
  else if (playRoll <= 40) playType = 'pnr';
  else if (playRoll <= 50) playType = 'fastbreak';
  else if (playRoll <= 65) playType = 'post';
  if (isClutch && playType === 'fastbreak') playType = 'standard';

  var isThree = false, isRim = false, makePct = 0, assistPct = 58, foulExtra = 0;

  if (playType === 'iso') {
    var bestOvr = 0;
    offT.rost.forEach(function(p) { if (p.mins > 0 && p.ovr > bestOvr) bestOvr = p.ovr; });
    var tr = 0;
    do { off = getFloor(offT); tr++; } while (off.ovr < bestOvr - 5 && tr < 3);
    isRim = off.fin > off.sht + 8; isThree = !isRim && ri(1, 100) <= 45;
    makePct = isRim ? 60 : 45; assistPct = 25;
  } else if (playType === 'pnr') {
    var tg = 0;
    do { off = getFloor(offT); tg++; } while ((off.pos !== 'PG' && off.pos !== 'SG') && tg < 3);
    var scr = getFloor(offT); var tb = 0;
    while ((scr.pos !== 'PF' && scr.pos !== 'C') && tb < 3) { scr = getFloor(offT); tb++; }
    var pr = ri(1, 100);
    if (pr <= 50) { isThree = ri(1, 100) <= 50; isRim = !isThree; }
    else if (pr <= 80) { off = scr; isRim = true; }
    else { off = getFloor(offT); isThree = true; makePct += 5; }
    assistPct = 78;
  } else if (playType === 'fastbreak') {
    isRim = true; makePct += 9; assistPct = 68;
  } else if (playType === 'post') {
    var tp = 0;
    do { off = getFloor(offT); tp++; } while ((off.pos !== 'PF' && off.pos !== 'C') && tp < 3);
    isRim = true; foulExtra = 4;
  } else {
    var sB = (getEngineStrat(offT) === 'Pace & Space') ? 7 : (getEngineStrat(offT) === 'Grit & Grind') ? -7 : 0;
    isThree = ri(1, 100) <= (33 + sB); isRim = !isThree && ri(1, 100) <= 26;
  }

  // Foul
  var foulChance = 8 + foulExtra;
  if (def.def < 60) foulChance += 3;
  if (isRim) foulChance += 5;
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
  var toChance = clamp(13 + Math.round((def.def - off.ply) * 0.13), 8, 25);
  if (defScheme === 'press') toChance += 6;
  if (defScheme === 'zone') toChance -= 3;
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
    var bc = isThree ? 2 : (isRim ? 10 : 7);
    bc = clamp(bc + Math.round((def.reb - 50) * 0.09), 1, 19);
    if (ri(1, 100) <= bc) {
      if (typeof def.s.blk !== 'number') def.s.blk = 0;
      def.s.blk++;
      return { pts: 0, time: time, pbp: '<span class="p-bl">' + pick(COM.block, off.name, def.name) + '</span>', big: true, type: 'block', run: null };
    }
  }

  // Shot make %
  if (makePct === 0) {
    if (isThree) {
      makePct = clamp(38 + Math.round((off.sht - def.def) * 0.22), 28, 46);
      if (defScheme === 'zone') makePct -= 5; if (defScheme === 'press') makePct += 3;
    } else if (isRim) {
      makePct = clamp(62 + Math.round((off.fin - def.def) * 0.32), 48, 78);
      if (defScheme === 'zone') makePct -= 7; if (defScheme === 'press') makePct += 3;
    } else {
      makePct = clamp(46 + Math.round((off.sht - def.def) * 0.26), 36, 56);
      if (defScheme === 'zone') makePct += 4; if (defScheme === 'press') makePct += 3;
    }
  }
  if (isClutch) makePct -= 4;
  makePct = Math.round(makePct * (1 - tiredness));
  makePct = clamp(makePct, 26, 78);
  if (toBoost) makePct = clamp(makePct + 5, 26, 85); // timeout boost: +5 make%

  off.s.fga++;
  if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
  if (ri(1, 100) <= makePct) {
    pts = isThree ? 3 : 2;
    off.s.fgm++; off.s.pts += pts;
    if (isThree) off.s.tpm = (off.s.tpm || 0) + 1;
    if (ri(1, 100) <= assistPct) {
      var at = 0; var asst = getFloor(offT);
      while (asst === off && at < 4) { asst = getFloor(offT); at++; }
      if (asst !== off) asst.s.ast++;
    }
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
    def.s.reb = (def.s.reb || 0) + 1;
    return { pts: 0, time: time, pbp: '<span class="p-ms">' + pick(isThree ? COM.miss3 : COM.miss2, off.name, def.name) + '</span>', big: false, type: 'miss', run: null };
  }
}


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
  var dm = userInvolved ? (DIFF_MOD[G.difficulty] || 0) : 0;
  var userT = userIsHomeActual ? home : away;
  var cpuBoost = Math.round(-dm * 0.5);
  // Timeout flag must never leak into CPU-vs-CPU games: drop it when the user
  // isn't playing. (When the user IS playing it's consumed possession-by-possession.)
  if (!userInvolved) G.timeoutBoost = false;
  home.rost.forEach(function(p, i) {
    hOrig[i] = { sht: p.sht, fin: p.fin, def: p.def };
    var mod = (userT === home) ? dm : cpuBoost;
    p.sht = clamp(p.sht + mod, 30, 99); p.fin = clamp(p.fin + mod, 30, 99); p.def = clamp(p.def + mod, 30, 99);
  });
  away.rost.forEach(function(p, i) {
    aOrig[i] = { sht: p.sht, fin: p.fin, def: p.def };
    var mod = (userT === away) ? dm : cpuBoost;
    p.sht = clamp(p.sht + mod, 30, 99); p.fin = clamp(p.fin + mod, 30, 99); p.def = clamp(p.def + mod, 30, 99);
  });
  // M8 FIX: wire the sellout-crowd event (events.js sets G.nextHomeBonus=3).
  // Applies to the user's next home game only, consumed once.
  var homeBonus = 1;
  if (userIsHomeActual && (G.nextHomeBonus || 0) > 0) {
    homeBonus += G.nextHomeBonus;
    G.nextHomeBonus = 0;
  }
  var hStrat = getEngineStrat(home), aStrat = getEngineStrat(away);
  var paceMod = 0;
  if (hStrat === 'Pace & Space' || aStrat === 'Pace & Space') paceMod += 4;
  if (hStrat === 'Grit & Grind' && aStrat === 'Grit & Grind') paceMod -= 4;
  var possPerTeam = clamp(76 + paceMod + ri(-3, 3), 68, 84);
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

  function runPoss(numPoss, offTeam, defTeam, isHomeOff) {
    var shotBonus = isHomeOff ? homeBonus : 0;
    var offIsUser = (isHomeOff ? home : away).id === G.tid;
    for (var i = 0; i < numPoss; i++) {
      // Timeout boost: the UI sets G.timeoutBoost=true; the user's team's next
      // offensive possession gets +5 make%, then the flag auto-clears
      // (consume-once). offIsUser is false in CPU-vs-CPU games, so it never fires there.
      var toBoost = false;
      if (offIsUser && G.timeoutBoost) { toBoost = true; G.timeoutBoost = false; }
      var isClutch = (i >= numPoss - 8);
      var off = getFloor(offTeam);
      var def = getFloor(defTeam);
      fatigue.set(off, (fatigue.get(off) || 0) + 1);
      fatigue.set(def, (fatigue.get(def) || 0) + 1);
      var defScheme = (defTeam.strat && defTeam.strat.def) ? defTeam.strat.def : 'man';
      if (defScheme === 'press') fatigue.set(def, (fatigue.get(def) || 0) + 1);

      var momMakeBonus = 0, momTOBonus = 0;
      var offMom = isHomeOff ? hMomentum : aMomentum;
      if (offMom >= 5) { momMakeBonus = 4; momTOBonus = 2; }
      else if (offMom >= 3) { momMakeBonus = 2; momTOBonus = 1; }
      momMakeBonus = clamp(momMakeBonus, 0, 5);

      var toChance = clamp(13 + Math.round((def.def - off.ply) * 0.12), 8, 22);
      if (defScheme === 'press') toChance += 5;
      if (defScheme === 'zone') toChance -= 2;
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
        continue;
      }
      lastTransition = false;

      var playRoll = ri(1, 100);
      var playType = 'standard';
      if (playRoll <= 15) playType = 'iso';
      else if (playRoll <= 40) playType = 'pnr';
      else if (playRoll <= 50 && lastTransition) playType = 'fastbreak';
      else if (playRoll <= 65) playType = 'post';
      if (isClutch && playType === 'fastbreak') playType = 'standard';

      var isThree = false, isRim = false, makePct = 0, foulExtra = 0, assistPct = 58;

      if (playType === 'iso') {
        var bestOvr = 0;
        offTeam.rost.forEach(function(p) { if (p.mins > 0 && p.ovr > bestOvr) bestOvr = p.ovr; });
        var tries = 0;
        do { off = getFloor(offTeam); tries++; } while (off.ovr < bestOvr - 5 && tries < 3);
        isRim = off.fin > off.sht;
        isThree = !isRim && ri(1, 100) <= 40;
        makePct = isRim ? 58 : 42;
        assistPct = 20;
      } else if (playType === 'pnr') {
        var triesG = 0;
        do { off = getFloor(offTeam); triesG++; } while ((off.pos !== 'PG' && off.pos !== 'SG') && triesG < 3);
        var screener = getFloor(offTeam);
        var triesB = 0;
        while ((screener.pos !== 'PF' && screener.pos !== 'C') && triesB < 3) { screener = getFloor(offTeam); triesB++; }
        var pnrRoll = ri(1, 100);
        if (pnrRoll <= 50) { isThree = ri(1, 100) <= 55; isRim = !isThree; }
        else if (pnrRoll <= 80) { off = screener; isRim = true; }
        else { off = getFloor(offTeam); isThree = true; makePct += 4; }
        assistPct = 75;
      } else if (playType === 'fastbreak') {
        isRim = true; makePct += 8; assistPct = 65;
      } else if (playType === 'post') {
        var triesP = 0;
        do { off = getFloor(offTeam); triesP++; } while ((off.pos !== 'PF' && off.pos !== 'C') && triesP < 3);
        isRim = true; foulExtra = 3;
      } else {
        var stratBonus = (getEngineStrat(offTeam) === 'Pace & Space') ? 6 : (getEngineStrat(offTeam) === 'Grit & Grind') ? -6 : 0;
        isThree = ri(1, 100) <= (32 + stratBonus);
        isRim = !isThree && ri(1, 100) <= 25;
      }

      var foulChance = 8 + foulExtra;
      if (def.def < 60) foulChance += 3;
      if (isRim) foulChance += 4;
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
        for (var ft = 0; ft < 2; ft++) {
          if (ri(1, 100) <= ftPct) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; }
        }
        off.s.fta = (off.s.fta || 0) + 2;
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        continue;
      }

      if (ri(1, 100) <= 5) {
        var ftPct2 = clamp(55 + Math.round(off.sht * 0.2), 65, 85);
        var tiredness2 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
        ftPct2 = Math.round(ftPct2 * (1 - tiredness2 * 0.5));
        for (var ft2 = 0; ft2 < 2; ft2++) {
          if (ri(1, 100) <= ftPct2) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.ftm = (off.s.ftm || 0) + 1; }
        }
        off.s.fta = (off.s.fta || 0) + 2;
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        continue;
      }

      if (playType !== 'fastbreak') {
        var blkChance = isThree ? 2 : (isRim ? 9 : 6);
        blkChance = clamp(blkChance + Math.round((def.reb - 50) * 0.08), 1, 18);
        if (ri(1, 100) <= blkChance) {
          if (typeof def.s.blk !== 'number') def.s.blk = 0;
          def.s.blk++; off.s.fga++;
          if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
          continue;
        }
      }

      if (makePct === 0) {
        if (isThree) {
          makePct = clamp(38 + Math.round((off.sht - def.def) * 0.2) + shotBonus, 28, 46);
          if (defScheme === 'zone') makePct -= 4; if (defScheme === 'press') makePct += 2;
        } else if (isRim) {
          makePct = clamp(62 + Math.round((off.fin - def.def) * 0.3) + shotBonus, 48, 78);
          if (defScheme === 'zone') makePct -= 6; if (defScheme === 'press') makePct += 2;
        } else {
          makePct = clamp(46 + Math.round((off.sht - def.def) * 0.25) + shotBonus, 36, 56);
          if (defScheme === 'zone') makePct += 3; if (defScheme === 'press') makePct += 2;
        }
      }
      if (isClutch) makePct -= 3;
      makePct += momMakeBonus;
      var tiredness3 = Math.min((fatigue.get(off) || 0) / 80, 0.15);
      makePct = Math.round(makePct * (1 - tiredness3));
      makePct = clamp(makePct, 25, 78);
      if (toBoost) makePct = clamp(makePct + 5, 25, 85); // timeout boost: +5 make%

      off.s.fga++;
      if (isThree) off.s.tpa = (off.s.tpa || 0) + 1;
      if (ri(1, 100) <= makePct) {
        var pts = isThree ? 3 : 2;
        if (isHomeOff) hScore += pts; else aScore += pts;
        off.s.pts += pts; off.s.fgm++;
        if (isThree) off.s.tpm = (off.s.tpm || 0) + 1;
        if (ri(1, 100) <= assistPct) {
          var tries2 = 0;
          var asst = getFloor(offTeam);
          while (asst === off && tries2 < 5) { asst = getFloor(offTeam); tries2++; }
          if (asst !== off) asst.s.ast++;
        }
        if (!isThree && ri(1, 100) <= 8) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; off.s.fta = (off.s.fta || 0) + 1; off.s.ftm = (off.s.ftm || 0) + 1; }
        if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
      } else {
        var oRebChance = 22;
        if (defScheme === 'zone') oRebChance += 5;
        if (ri(1, 100) <= oRebChance) { var oReb = getFloor(offTeam); oReb.s.reb++; oReb.s.oreb = (oReb.s.oreb || 0) + 1; }
        else {
          var dReb = getFloor(defTeam); dReb.s.reb++; lastTransition = true;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        }
      }
    }
  }

  runPoss(possPerTeam, home, away, true);
  runPoss(possPerTeam, away, home, false);
  // M3 FIX: user coach bonuses apply ONLY when the user's team is playing —
  // never in CPU-vs-CPU games.
  if (G.coach && userInvolved) {
    var offBonus = Math.round((G.coach.off - 70) * 0.15);
    var defBonus = Math.round((G.coach.def - 70) * 0.15);
    if (userIsHomeActual) { hScore += offBonus; aScore -= defBonus; } else { aScore += offBonus; hScore -= defBonus; }
  }
  var ot = 0;
  while (hScore === aScore && ot < 5) { ot++; runPoss(4, home, away, true); runPoss(4, away, home, false); }
  // M6 FIX: no phantom OT tiebreak point — play extra possessions until the tie
  // breaks. The credited fallback is a near-impossible safety net (and even it
  // credits the point to a player rather than thin air).
  var otx = 0;
  while (hScore === aScore && otx < 10) { otx++; runPoss(1, home, away, true); runPoss(1, away, home, false); }
  if (hScore === aScore) { hScore++; getFloor(home).s.pts++; }
  home.rost.forEach(function(p, i) { p.sht = hOrig[i].sht; p.fin = hOrig[i].fin; p.def = hOrig[i].def; });
  away.rost.forEach(function(p, i) { p.sht = aOrig[i].sht; p.fin = aOrig[i].fin; p.def = aOrig[i].def; });
  home.rost.forEach(function(p) { if (origMins.has(p)) p.mins = origMins.get(p); });
  away.rost.forEach(function(p) { if (origMins.has(p)) p.mins = origMins.get(p); });
  return { homeScore: hScore, awayScore: aScore };
}

// M9 NOTE: distributeStats is intentionally kept as a no-op for now.
// Stats accumulate on player objects inside simGame, so it does nothing — but
// season.js still imports it (line 12) and calls it (simCPUWeek). Deleting this
// export before those call sites are removed would break module loading
// entirely. S-team: remove the season.js import + calls first, then delete this.
// distributeStats is no longer needed — kept as no-op for backward compat
export function distributeStats(team, teamScore) {}
