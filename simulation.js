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

// ── Single Possession (Live Sim) ─────────────────────────
// Play types, defensive schemes, clutch, fouls, steals, blocks.
// Returns: { pts, time, pbp, big, type, run }
export function simPoss(offT, defT) {
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
    return { pts: made, time: time, pbp: '<span class="p-foul">Foul on ' + def.name + '. ' + off.name + ' to the line \u2014 ' + made + ' of 2.</span>', big: made === 2, type: 'foul', run: null };
  }

  // Turnover
  var toChance = clamp(13 + Math.round((def.def - off.ply) * 0.13), 8, 25);
  if (defScheme === 'press') toChance += 6;
  if (defScheme === 'zone') toChance -= 3;
  if (isClutch) toChance += 3;
  if (ri(1, 100) <= toChance) {
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

  off.s.fga++;
  if (ri(1, 100) <= makePct) {
    pts = isThree ? 3 : 2;
    off.s.fgm++; off.s.pts += pts;
    if (ri(1, 100) <= assistPct) {
      var at = 0; var asst = getFloor(offT);
      while (asst === off && at < 4) { asst = getFloor(offT); at++; }
      if (asst !== off) asst.s.ast++;
    }
    if (!isThree && ri(1, 100) <= 9) { pts += 1; off.s.pts++; big = true; }
    var txt;
    if (isClutch && ri(1, 100) <= 40) txt = pick(COM.clutch, off.name);
    else if (playType === 'fastbreak' || (isRim && off.fin > 84)) txt = pick(COM.dunk, off.name, def.name);
    else if (isThree) txt = pick(COM.make3, off.name, def.name);
    else txt = pick(COM.make2, off.name, def.name);
    run = updateMomentum(offT.id !== undefined ? offT.id : -1, pts);
    return { pts: pts, time: time, pbp: '<span class="p-mk">' + txt + '</span>', big: big || playType === 'fastbreak', type: 'make', run: run };
  } else {
    if (ri(1, 100) <= 23) {
      off.s.reb++; off.s.pts += 2; off.s.fgm++;
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
  var dm = DIFF_MOD[G.difficulty] || 0;
  var userT = userIsHome ? home : away;
  var cpuBoost = Math.round(-dm * 0.5);
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
  var homeBonus = 1;
  var hStrat = getEngineStrat(home), aStrat = getEngineStrat(away);
  var paceMod = 0;
  if (hStrat === 'Pace & Space' || aStrat === 'Pace & Space') paceMod += 4;
  if (hStrat === 'Grit & Grind' && aStrat === 'Grit & Grind') paceMod -= 4;
  var possPerTeam = clamp(76 + paceMod + ri(-3, 3), 68, 84);
  home.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });
  away.rost.forEach(function(p) { if (p.mins > 0) p.s.gp++; });

  var fatigue = {}, playerFouls = {}, origMins = {};
  home.rost.forEach(function(p) {
    if (p.mins > 0) {
      fatigue[p.name] = 0; playerFouls[p.name] = 0; origMins[p.name] = p.mins;
      if (typeof p.s.stl !== 'number') p.s.stl = 0;
      if (typeof p.s.blk !== 'number') p.s.blk = 0;
    }
  });
  away.rost.forEach(function(p) {
    if (p.mins > 0) {
      fatigue[p.name] = 0; playerFouls[p.name] = 0; origMins[p.name] = p.mins;
      if (typeof p.s.stl !== 'number') p.s.stl = 0;
      if (typeof p.s.blk !== 'number') p.s.blk = 0;
    }
  });

  var hMomentum = 0, aMomentum = 0;
  var lastTransition = false;

  function runPoss(numPoss, offTeam, defTeam, isHomeOff) {
    var shotBonus = isHomeOff ? homeBonus : 0;
    for (var i = 0; i < numPoss; i++) {
      var isClutch = (i >= numPoss - 8);
      var off = getFloor(offTeam);
      var def = getFloor(defTeam);
      fatigue[off.name] = (fatigue[off.name] || 0) + 1;
      fatigue[def.name] = (fatigue[def.name] || 0) + 1;
      var defScheme = (defTeam.strat && defTeam.strat.def) ? defTeam.strat.def : 'man';
      if (defScheme === 'press') fatigue[def.name] += 1;

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
        if (ri(1, 100) <= 60) {
          if (typeof def.s.stl !== 'number') def.s.stl = 0;
          def.s.stl++;
        }
        if (defScheme === 'press' && ri(1, 100) <= 15) {
          if (isHomeOff) aScore += 2; else hScore += 2;
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
        var dName = def.name;
        playerFouls[dName] = (playerFouls[dName] || 0) + 1;
        if (playerFouls[dName] >= 5) def.mins = 0;
        var ftPct = clamp(55 + Math.round(off.sht * 0.2), 65, 85);
        var tiredness = Math.min((fatigue[off.name] || 0) / 80, 0.15);
        ftPct = Math.round(ftPct * (1 - tiredness * 0.5));
        ftPct = clamp(ftPct, 60, 90);
        for (var ft = 0; ft < 2; ft++) {
          if (ri(1, 100) <= ftPct) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; }
        }
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        continue;
      }

      if (ri(1, 100) <= 5) {
        var ftPct2 = clamp(55 + Math.round(off.sht * 0.2), 65, 85);
        var tiredness2 = Math.min((fatigue[off.name] || 0) / 80, 0.15);
        ftPct2 = Math.round(ftPct2 * (1 - tiredness2 * 0.5));
        for (var ft2 = 0; ft2 < 2; ft2++) {
          if (ri(1, 100) <= ftPct2) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; }
        }
        if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        continue;
      }

      if (playType !== 'fastbreak') {
        var blkChance = isThree ? 2 : (isRim ? 9 : 6);
        blkChance = clamp(blkChance + Math.round((def.reb - 50) * 0.08), 1, 18);
        if (ri(1, 100) <= blkChance) {
          if (typeof def.s.blk !== 'number') def.s.blk = 0;
          def.s.blk++; off.s.fga++;
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
      var tiredness3 = Math.min((fatigue[off.name] || 0) / 80, 0.15);
      makePct = Math.round(makePct * (1 - tiredness3));
      makePct = clamp(makePct, 25, 78);

      off.s.fga++;
      if (ri(1, 100) <= makePct) {
        var pts = isThree ? 3 : 2;
        if (isHomeOff) hScore += pts; else aScore += pts;
        off.s.pts += pts; off.s.fgm++;
        if (ri(1, 100) <= assistPct) {
          var tries2 = 0;
          var asst = getFloor(offTeam);
          while (asst === off && tries2 < 5) { asst = getFloor(offTeam); tries2++; }
          if (asst !== off) asst.s.ast++;
        }
        if (!isThree && ri(1, 100) <= 8) { if (isHomeOff) hScore++; else aScore++; off.s.pts++; }
        if (isHomeOff) { hMomentum++; aMomentum = 0; } else { aMomentum++; hMomentum = 0; }
      } else {
        var oRebChance = 22;
        if (defScheme === 'zone') oRebChance += 5;
        if (ri(1, 100) <= oRebChance) { var oReb = getFloor(offTeam); oReb.s.reb++; }
        else {
          var dReb = getFloor(defTeam); dReb.s.reb++; lastTransition = true;
          if (isHomeOff) { aMomentum++; hMomentum = 0; } else { hMomentum++; aMomentum = 0; }
        }
      }
    }
  }

  runPoss(possPerTeam, home, away, true);
  runPoss(possPerTeam, away, home, false);
  if (G.coach) {
    var offBonus = Math.round((G.coach.off - 70) * 0.15);
    var defBonus = Math.round((G.coach.def - 70) * 0.15);
    if (userIsHome) { hScore += offBonus; aScore -= defBonus; } else { aScore += offBonus; hScore -= defBonus; }
  }
  var ot = 0;
  while (hScore === aScore && ot < 5) { ot++; runPoss(4, home, away, true); runPoss(4, away, home, false); }
  if (hScore === aScore) hScore++;
  home.rost.forEach(function(p, i) { p.sht = hOrig[i].sht; p.fin = hOrig[i].fin; p.def = hOrig[i].def; });
  away.rost.forEach(function(p, i) { p.sht = aOrig[i].sht; p.fin = aOrig[i].fin; p.def = aOrig[i].def; });
  home.rost.forEach(function(p) { if (origMins[p.name] !== undefined) p.mins = origMins[p.name]; });
  away.rost.forEach(function(p) { if (origMins[p.name] !== undefined) p.mins = origMins[p.name]; });
  return { homeScore: hScore, awayScore: aScore };
}

// distributeStats is no longer needed — kept as no-op for backward compat
export function distributeStats(team, teamScore) {}
