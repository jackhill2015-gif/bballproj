// ═══════════════════════════════════════════════════════════
//  HOOPS OS — events.js
//  Mid-season events: injuries, streaks, drama, recruiting, national
// ═══════════════════════════════════════════════════════════

import { ri, autoLineup, applyBuff, undoBuff, injuryWeeks } from './utils.js';
import { G, saveState } from './state.js';
import { pollRank, pollTeams } from './poll.js';
import { addLog, toast } from './ui.js';

// ── CPU teams ───────────────────────────────────────────
// Every other team gets the player events too, quietly: injuries, suspensions,
// hot and cold stretches. State lives in G.cpuInj / G.cpuBuffs (entries carry
// the team id), apart from the user's G.injuries / G.buffs. Only ranked teams'
// stars and the league's best players get a line in the log.
var CPU_RATES = { injury: 12, academic: 2, conduct: 1.5, hot: 8, cold: 6, chem: 4, drama: 3, flu: 3 };
var CPU_LOG_CAP = 4;

function rollPct(p) { return Math.random() * 100 < p; }

function cpuHealthLine(t, p, text, weekNum, state) {
  if (state.logged >= CPU_LOG_CAP) return;
  var rank = pollRank(t.id);
  var top = t.rost.slice().sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3);
  var notable = p.ovr >= 84 || (rank && rank <= 25 && top.indexOf(p) >= 0);
  if (!notable) return;
  state.logged++;
  addLog('ev', weekNum, (rank && rank <= 25 ? '#' + rank + ' ' : '') + '<b>' + t.name + '</b>: ' + text);
}

export function rollCpuEvents(weekNum) {
  if (!G.cpuInj) G.cpuInj = [];
  if (!G.cpuBuffs) G.cpuBuffs = [];
  var state = { logged: 0 };
  var touched = {}; // tid -> true when a team's available players changed

  // Tick down injuries; a returning player gets his minutes back below
  for (var i = G.cpuInj.length - 1; i >= 0; i--) {
    var inj = G.cpuInj[i];
    inj.weeksLeft--;
    if (inj.weeksLeft <= 0) {
      touched[inj.tid] = true;
      G.cpuInj.splice(i, 1);
    }
  }
  // Tick down buffs
  for (var j = G.cpuBuffs.length - 1; j >= 0; j--) {
    var bf = G.cpuBuffs[j];
    bf.gamesLeft--;
    if (bf.gamesLeft <= 0) {
      if (G.teams[bf.tid]) undoBuff(G.teams[bf.tid], bf);
      G.cpuBuffs.splice(j, 1);
    }
  }

  function out(tid, name) {
    for (var k = 0; k < G.cpuInj.length; k++) if (G.cpuInj[k].tid === tid && G.cpuInj[k].playerName === name) return true;
    return false;
  }
  function hurt(t, type, weeks, text) {
    var pool = t.rost.filter(function(p) { return p.mins > 0 && !out(t.id, p.name); });
    if (pool.length < 6) return; // never strip a team below a rotation
    var p = pool[ri(0, pool.length - 1)];
    G.cpuInj.push({ tid: t.id, playerName: p.name, type: type, weeksLeft: weeks });
    touched[t.id] = true;
    cpuHealthLine(t, p, '<b>' + p.name + '</b> (' + p.pos + ') ' + text(weeks), weekNum, state);
  }
  function buff(t, who, attr, mod, games) {
    G.cpuBuffs.push(Object.assign(applyBuff(t, who, attr, mod, games), { tid: t.id }));
  }
  function starter(t) {
    var s = t.rost.slice().sort(function(a, b) { return b.mins - a.mins; }).slice(0, 5);
    return s[ri(0, s.length - 1)];
  }

  G.teams.forEach(function(t) {
    if (t.id === G.tid || !t.rost || !t.rost.length) return;
    if (rollPct(CPU_RATES.injury)) {
      var types = ['ankle sprain', 'broken finger', 'concussion', 'hamstring strain', 'knee contusion', 'shoulder sprain'];
      var type = types[ri(0, types.length - 1)];
      hurt(t, type, injuryWeeks(), function(w) { return 'is out with a ' + type + (w >= 30 ? ' for the season.' : ' for ' + w + (w === 1 ? ' week.' : ' weeks.')); });
    }
    if (rollPct(CPU_RATES.academic)) hurt(t, 'Academic', 2, function() { return 'is academically ineligible for 2 games.'; });
    if (rollPct(CPU_RATES.conduct)) hurt(t, 'Suspension', 1, function() { return 'is suspended for 1 game.'; });
    if (rollPct(CPU_RATES.hot)) buff(t, starter(t).name, 'sht', 5, 3);
    if (rollPct(CPU_RATES.cold)) buff(t, starter(t).name, 'sht', -5, 3);
    if (rollPct(CPU_RATES.flu)) buff(t, starter(t).name, 'fin', -4, 1);
    if (rollPct(CPU_RATES.chem)) buff(t, 'TEAM', 'all', 2, 2);
    if (rollPct(CPU_RATES.drama)) buff(t, 'TEAM', 'all', -2, 2);
  });

  // Hand out minutes again where someone left or came back
  Object.keys(touched).forEach(function(tid) {
    var t = G.teams[tid];
    if (!t || t.id === G.tid) return;
    var outMap = {};
    G.cpuInj.forEach(function(inj) { if (inj.tid === t.id) outMap[inj.playerName] = true; });
    autoLineup(t, outMap);
  });
}

// Season over: nobody stays hurt into the offseason and temporary rating
// changes come off before players develop.
export function clearSeasonEvents() {
  var user = G.teams[G.tid];
  (G.buffs || []).forEach(function(bf) { if (user) undoBuff(user, bf); });
  G.buffs = [];
  if (user) (G.injuries || []).forEach(function(inj) {
    user.rost.forEach(function(p) { if (p.name === inj.playerName && !p.rs) p.mins = inj.origMins || 20; });
  });
  G.injuries = [];
  (G.cpuBuffs || []).forEach(function(bf) { if (G.teams[bf.tid]) undoBuff(G.teams[bf.tid], bf); });
  G.cpuBuffs = [];
  var hurt = {};
  (G.cpuInj || []).forEach(function(inj) { hurt[inj.tid] = true; });
  G.cpuInj = [];
  Object.keys(hurt).forEach(function(tid) {
    var t = G.teams[tid];
    if (t && t.id !== G.tid && t.rost) autoLineup(t, {});
  });
}

export function rollEvents(weekNum) {
  if (!G.injuries) G.injuries = [];
  if (!G.buffs) G.buffs = [];
  if (typeof G.nextHomeBonus !== 'number') G.nextHomeBonus = 0;

  rollCpuEvents(weekNum);

  var t = G.teams[G.tid];
  if (!t || !t.rost) return;

  // ── Tick down injuries ──
  for (var i = G.injuries.length - 1; i >= 0; i--) {
    G.injuries[i].weeksLeft--;
    if (G.injuries[i].weeksLeft <= 0) {
      var rp = null;
      t.rost.forEach(function(p) { if (p.name === G.injuries[i].playerName) rp = p; });
      if (rp) {
        // a redshirt stays out; everyone else gets their minutes back
        rp.mins = rp.rs ? 0 : (G.injuries[i].origMins || 20);
        addLog('ev', weekNum, '<b>' + rp.name + '</b> cleared to play and returns to the lineup.');
        toast(rp.name + ' is back', 'var(--grn)');
      }
      G.injuries.splice(i, 1);
    }
  }

  // ── Tick down buffs/debuffs ──
  for (var j = G.buffs.length - 1; j >= 0; j--) {
    G.buffs[j].gamesLeft--;
    if (G.buffs[j].gamesLeft <= 0) {
      undoBuff(t, G.buffs[j]);
      G.buffs.splice(j, 1);
    }
  }

  // ── Roll new events (max 2 per week) ──
  var fired = 0;
  function tryFire(chance, fn) {
    if (fired >= 2) return;
    if (ri(1, 100) <= chance) { fn(); fired++; }
  }

  // Weekly honors post at most once per week: skip the roll entirely if
  // this week's log already contains the honor. (The engine rolls each
  // week once, but this guards against any double-roll of a week, e.g.
  // after a mid-week save/load edge.)
  function honorPosted(phrase) {
    var logs = G.logs || [];
    for (var hi = 0; hi < logs.length; hi++) {
      var he = logs[hi];
      if (he && he.type === 'ev' && he.wk === weekNum && String(he.text).indexOf(phrase) >= 0) return true;
    }
    return false;
  }

  var active = t.rost.filter(function(p) { return p.mins > 0; });
  var starters = t.rost.slice(0, 5);
  if (!active.length) return;

  // Rankings: the Top 25 poll (poll.js)
  var netRank = pollRank(G.tid) || 99;
  var played = t.sched.filter(function(s) { return s && s.played; });
  var lastGame = played.length ? played[played.length - 1] : null;
  var lastWin = lastGame ? lastGame.uScore > lastGame.oScore : false;

  // ── PLAYER EVENTS ──

  // 1. Injury (12%, same weekly rate as every CPU team)
  tryFire(12, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    var types = ['sprained ankle', 'broken finger', 'concussion', 'hamstring strain', 'knee contusion', 'shoulder sprain'];
    var type = types[ri(0, types.length - 1)];
    var weeks = injuryWeeks();
    G.injuries.push({ playerName: p.name, type: type, weeksLeft: weeks, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '<b>' + p.name + '</b> (' + p.pos + ') suffers a <b>' + type + '</b> \u2014 ' + (weeks >= 30 ? 'out for the season.' : 'out ' + weeks + (weeks === 1 ? ' week.' : ' weeks.')));
    toast(p.name + ' injured', '#dc2626');
  });

  // 2. Hot Streak (12%)
  tryFire(12, function() {
    var p = starters[ri(0, starters.length - 1)];
    G.buffs.push(applyBuff(t, p.name, 'sht', 5, 3));
    addLog('ev', weekNum, '<b>' + p.name + '</b> is on a hot streak \u2014 +5 shooting for the next 3 games.');
    toast(p.name + ' on a hot streak', 'var(--gld)');
  });

  // 3. Cold Streak (10%)
  tryFire(10, function() {
    var p = starters[ri(0, starters.length - 1)];
    G.buffs.push(applyBuff(t, p.name, 'sht', -5, 3));
    addLog('ev', weekNum, '<b>' + p.name + '</b> is in a shooting slump \u2014 struggling from the field for 3 games.');
    toast(p.name + ' slumping', 'var(--txt3)');
  });

  // 4. Academic Suspension (6%)
  tryFire(6, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    G.injuries.push({ playerName: p.name, type: 'Academic', weeksLeft: 2, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '<b>' + p.name + '</b> ruled academically ineligible \u2014 out 2 games.');
    toast(p.name + ' suspended', '#dc2626');
  });

  // 5. Player of the Week (20% — log only)
  if (!honorPosted('Player of the Week')) tryFire(20, function() {
    var best = null; var bestPpg = 0;
    starters.forEach(function(p) {
      var gp = p.s.gp || 1;
      var ppg = p.s.pts / gp;
      if (ppg > bestPpg) { bestPpg = ppg; best = p; }
    });
    if (best) addLog('ev', weekNum, '<b>' + best.name + '</b> named ' + t.conf + ' Player of the Week (' + bestPpg.toFixed(1) + ' PPG).');
  });

  // 6. Off-Court Issue (4%)
  tryFire(4, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    G.injuries.push({ playerName: p.name, type: 'Suspension', weeksLeft: 1, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '<b>' + p.name + '</b> suspended 1 game for off-court conduct.');
  });

  // ── TEAM EVENTS ──

  // 7. Chemistry Boost (8%)
  tryFire(8, function() {
    G.buffs.push(applyBuff(t, 'TEAM', 'all', 2, 2));
    addLog('ev', weekNum, 'Team chemistry surging \u2014 all attributes +2 for next 2 games.');
    toast('Chemistry boost', 'var(--grn)');
  });

  // 8. Locker Room Drama (5%)
  tryFire(5, function() {
    G.buffs.push(applyBuff(t, 'TEAM', 'all', -2, 2));
    addLog('ev', weekNum, 'Locker room tension after ' + (lastWin ? 'a close call' : 'tough loss') + ' \u2014 team distracted for 2 games.');
    toast('Locker room drama', '#dc2626');
  });

  // 9. Sellout Crowd (10%)
  tryFire(10, function() {
    G.nextHomeBonus = 3;
    addLog('ev', weekNum, 'Sellout crowd expected for the next home game.');
    toast('Sellout crowd expected', 'var(--grn)');
  });

  // 10. ESPN GameDay (5% — only if top 25)
  tryFire(netRank <= 25 ? 15 : 0, function() {
    addLog('ev', weekNum, 'ESPN College GameDay is coming to ' + t.name + '. National spotlight on the program.');
    toast('College GameDay visit', 'var(--gld)');
  });

  // ── COACHING EVENTS ──

  // 11. Coach of the Week (conditional)
  var recentWins = played.slice(-3).filter(function(g) { return g.uScore > g.oScore; }).length;
  if (!honorPosted('Coach of the Week')) tryFire(recentWins >= 3 ? 40 : 0, function() {
    addLog('ev', weekNum, 'Coach <b>' + G.coach.firstName + ' ' + G.coach.lastName + '</b> named ' + t.conf + ' Coach of the Week after 3 straight wins.');
  });

  // 12. AD Meeting — hot seat warning
  tryFire(G.coach.hotSeat ? 25 : 0, function() {
    addLog('ev', weekNum, 'Called into the AD\'s office. "We need to see improvement. The fanbase is restless."');
    toast('AD meeting...', '#dc2626');
  });

  // 13. Booster Pressure (if losing record)
  tryFire(t.loss > t.wins && weekNum > 10 ? 15 : 0, function() {
    addLog('ev', weekNum, 'Boosters are getting impatient with the ' + t.wins + '-' + t.loss + ' record. Pressure mounting.');
  });

  // 14. Poaching Rumors (if doing well)
  tryFire(t.wins > 15 && G.coach.off >= 75 ? 8 : 0, function() {
    addLog('ev', weekNum, 'Rumors swirling: Power conference programs have ' + G.coach.firstName + ' ' + G.coach.lastName + ' on their shortlist.');
  });

  // ── RECRUITING ──

  // 15. Recruit Visit (12%)
  tryFire(12, function() {
    if (!G.recruits || !G.recruits.length) return;
    var open = G.recruits.filter(function(r) { return r.status === 'open'; });
    if (!open.length) return;
    var r = open[ri(0, open.length - 1)];
    r.interest = Math.min(100, (r.interest || 0) + ri(10, 20));
    addLog('ev', weekNum, 'Recruit <b>' + r.name + '</b> (' + r.stars + '\u2605 ' + r.pos + ') had a good campus visit. Interest up.');
  });

  // 16. Rival Commits (8%)
  tryFire(8, function() {
    if (!G.recruits || !G.recruits.length) return;
    var targets = G.recruitTargets || [];
    if (!targets.length) return;
    var idx = ri(0, targets.length - 1);
    var rId = targets[idx];
    var r = G.recruits.find(function(rec) { return rec.id === rId; });
    if (r && r.status === 'open' && r.rivals && r.rivals.length) {
      var rv = r.rivals[ri(0, r.rivals.length - 1)];
      var rivalTid = typeof rv === 'object' ? rv.tid : rv;
      var rivalTeam = G.teams[rivalTid];
      r.status = 'gone'; r.signed = rivalTid; if (rivalTeam) r.goneTo = rivalTeam.name;
      addLog('ev', weekNum, '<b>' + r.name + '</b> (' + r.stars + '\u2605) commits to <b>' + (rivalTeam ? rivalTeam.name : 'a rival') + '</b>. Tough loss on the trail.');
    }
  });

  // ── NATIONAL ──

  // 17. Major Upset (10%)
  tryFire(10, function() {
    var top10 = pollTeams().slice(0, 10);
    if (!top10.length) return;
    var upset = top10[ri(0, top10.length - 1)];
    var rank = pollRank(upset.id);
    addLog('ev', weekNum, 'Upset: #' + rank + ' <b>' + upset.name + '</b> falls to an unranked opponent.');
  });

  // 18. Bracketology Update (15%)
  tryFire(weekNum >= 15 ? 15 : 0, function() {
    var seed = netRank <= 4 ? 1 : netRank <= 8 ? 2 : netRank <= 16 ? ri(3, 4) : netRank <= 32 ? ri(5, 8) : netRank <= 64 ? ri(9, 12) : 0;
    if (seed > 0) {
      addLog('ev', weekNum, 'ESPN Bracketology: <b>' + t.name + '</b> projected as a <b>#' + seed + ' seed</b>.');
    } else {
      addLog('ev', weekNum, 'ESPN Bracketology: <b>' + t.name + '</b> currently on the outside looking in.');
    }
  });

  // 19. Conference Standings (10%)
  tryFire(10, function() {
    var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
    conf.sort(function(a, b) { return b.cWins - a.cWins || b.pts - a.pts; });
    var pos = conf.findIndex(function(x) { return x.id === G.tid; }) + 1;
    addLog('ev', weekNum, '' + t.conf + ' standings update: <b>' + t.name + '</b> sits at <b>#' + pos + '</b> in the conference.');
  });

  // ── CREATIVE EXTRAS ──

  // 20. Video Game Distraction (5%)
  tryFire(5, function() {
    var p = active[ri(0, active.length - 1)];
    G.buffs.push(applyBuff(t, p.name, 'sht', -3, 1));
    addLog('ev', weekNum, '<b>' + p.name + '</b> was up all night before a game release. Shooting \u22123 next game.');
  });

  // 21. Transfer Portal Threat (4%)
  tryFire(4, function() {
    var bench = t.rost.filter(function(p) { return (p.mins === 0 || p.mins < 5) && !p.rs; });
    if (bench.length) {
      var p = bench[ri(0, bench.length - 1)];
      addLog('ev', weekNum, '<b>' + p.name + '</b> is reportedly unhappy with playing time and exploring the transfer portal.');
    }
  });

  // 22. Sneaker Deal (3%)
  tryFire(3, function() {
    addLog('ev', weekNum, 'New sneaker deal announced for ' + t.name + '. Morale boost across the roster.');
    toast('Sneaker deal announced', 'var(--gld)');
  });

  // 23. Flu Game (6%)
  tryFire(6, function() {
    var p = starters[ri(0, starters.length - 1)];
    G.buffs.push(applyBuff(t, p.name, 'fin', -4, 1));
    addLog('ev', weekNum, '<b>' + p.name + '</b> battling illness \u2014 playing through it but finishing \u22124 next game.');
  });

  // 24. Freshman Breakout (8% — only freshmen)
  tryFire(8, function() {
    var freshmen = t.rost.filter(function(p) { return p.cls === 'FR' && p.mins > 0; });
    if (freshmen.length) {
      var p = freshmen[ri(0, freshmen.length - 1)];
      G.buffs.push(applyBuff(t, p.name, 'sht', 3, 4));
      G.buffs.push(applyBuff(t, p.name, 'fin', 3, 4));
      addLog('ev', weekNum, 'Freshman <b>' + p.name + '</b> is on a breakout stretch \u2014 boosted for 4 games.');
      toast(p.name + ' breakout', 'var(--grn)');
    }
  });

  // 25. Rivalry Hype (conditional)
  tryFire(weekNum >= 10 ? 8 : 0, function() {
    var next = t.sched[G.gi];
    if (!next || next.opp === undefined) return;
    var opp = G.teams[next.opp];
    if (opp && opp.conf === t.conf) {
      addLog('ev', weekNum, 'Rivalry week: <b>' + t.name + '</b> vs <b>' + opp.name + '</b>.');
    }
  });

  // 26. Senior Night (week 28-29)
  tryFire(weekNum >= 28 ? 30 : 0, function() {
    var seniors = t.rost.filter(function(p) { return p.cls === 'SR' && p.mins > 0; });
    if (seniors.length) {
      addLog('ev', weekNum, 'Senior night: ' + seniors.map(function(p) { return '<b>' + p.name + '</b>'; }).join(', ') + ' honored before the home crowd.');
    }
  });

  // 27. Weather Delay (3%)
  tryFire(3, function() {
    addLog('ev', weekNum, 'Winter storm delays team travel \u2014 players arrive fatigued for next away game.');
    G.buffs.push(applyBuff(t, 'TEAM', 'all', -1, 1));
  });

  // 28. Walk-on Hero (3%)
  tryFire(3, function() {
    var bench = t.rost.filter(function(p) { return p.mins === 0 && !p.rs; }); // redshirts stay out
    if (bench.length) {
      var p = bench[ri(0, bench.length - 1)];
      addLog('ev', weekNum, 'Walk-on <b>' + p.name + '</b> impresses in practice \u2014 earns rotation minutes next game.');
      p.mins = 8;
    }
  });

  saveState();
}
