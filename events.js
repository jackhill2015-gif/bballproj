// ═══════════════════════════════════════════════════════════
//  HOOPS OS — events.js
//  Mid-season events: injuries, streaks, drama, recruiting, national
// ═══════════════════════════════════════════════════════════

import { ri, clamp } from './utils.js';
import { G, saveState } from './state.js';
import { addLog, toast } from './ui.js';

export function rollEvents(weekNum) {
  if (!G.injuries) G.injuries = [];
  if (!G.buffs) G.buffs = [];
  if (typeof G.nextHomeBonus !== 'number') G.nextHomeBonus = 0;

  var t = G.teams[G.tid];
  if (!t || !t.rost) return;

  // ── Tick down injuries ──
  for (var i = G.injuries.length - 1; i >= 0; i--) {
    G.injuries[i].weeksLeft--;
    if (G.injuries[i].weeksLeft <= 0) {
      var rp = null;
      t.rost.forEach(function(p) { if (p.name === G.injuries[i].playerName) rp = p; });
      if (rp) {
        rp.mins = G.injuries[i].origMins || 20;
        addLog('ev', weekNum, '\u2705 <b>' + rp.name + '</b> has been cleared to play and returns to the lineup.');
        toast(rp.name + ' is back!', 'var(--grn)');
      }
      G.injuries.splice(i, 1);
    }
  }

  // ── Tick down buffs/debuffs ──
  for (var j = G.buffs.length - 1; j >= 0; j--) {
    G.buffs[j].gamesLeft--;
    if (G.buffs[j].gamesLeft <= 0) {
      var bp = null;
      var bf = G.buffs[j];
      if (bf.playerName === 'TEAM') {
        t.rost.forEach(function(p) {
          if (p.mins > 0) { p.sht -= bf.mod; p.fin -= bf.mod; p.def -= bf.mod; }
        });
      } else {
        t.rost.forEach(function(p) { if (p.name === bf.playerName) bp = p; });
        if (bp && bf.attr) bp[bf.attr] = clamp((bp[bf.attr] || 70) - bf.mod, 30, 99);
      }
      G.buffs.splice(j, 1);
    }
  }

  // ── Roll new events (max 2 per week) ──
  var fired = 0;
  function tryFire(chance, fn) {
    if (fired >= 2) return;
    if (ri(1, 100) <= chance) { fn(); fired++; }
  }

  var active = t.rost.filter(function(p) { return p.mins > 0; });
  var starters = t.rost.slice(0, 5);
  if (!active.length) return;

  // Rankings
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var netRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var played = t.sched.filter(function(s) { return s && s.played; });
  var lastGame = played.length ? played[played.length - 1] : null;
  var lastWin = lastGame ? lastGame.uScore > lastGame.oScore : false;

  // ── PLAYER EVENTS ──

  // 1. Injury (15%)
  tryFire(15, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    var types = ['sprained ankle', 'broken finger', 'concussion', 'hamstring strain', 'knee contusion', 'shoulder sprain'];
    var type = types[ri(0, types.length - 1)];
    var weeks = ri(2, 4);
    G.injuries.push({ playerName: p.name, type: type, weeksLeft: weeks, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '\ud83d\udea8 <b>' + p.name + '</b> (' + p.pos + ') suffers a <b>' + type + '</b> \u2014 out ' + weeks + ' weeks.');
    toast(p.name + ' injured!', '#fc8181');
  });

  // 2. Hot Streak (12%)
  tryFire(12, function() {
    var p = starters[ri(0, starters.length - 1)];
    p.sht = clamp(p.sht + 5, 30, 99);
    G.buffs.push({ playerName: p.name, attr: 'sht', mod: 5, gamesLeft: 3 });
    addLog('ev', weekNum, '\ud83d\udd25 <b>' + p.name + '</b> is ON FIRE \u2014 shooting boosted for the next 3 games.');
    toast(p.name + ' hot streak!', 'var(--gld)');
  });

  // 3. Cold Streak (10%)
  tryFire(10, function() {
    var p = starters[ri(0, starters.length - 1)];
    p.sht = clamp(p.sht - 5, 30, 99);
    G.buffs.push({ playerName: p.name, attr: 'sht', mod: -5, gamesLeft: 3 });
    addLog('ev', weekNum, '\u2744\ufe0f <b>' + p.name + '</b> is ice cold \u2014 struggling from the field for 3 games.');
    toast(p.name + ' slumping', 'var(--txt3)');
  });

  // 4. Academic Suspension (6%)
  tryFire(6, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    G.injuries.push({ playerName: p.name, type: 'Academic', weeksLeft: 2, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '\ud83d\udcda <b>' + p.name + '</b> ruled academically ineligible \u2014 out 2 games.');
    toast(p.name + ' suspended', '#fc8181');
  });

  // 5. Player of the Week (20% — log only)
  tryFire(20, function() {
    var best = null; var bestPpg = 0;
    starters.forEach(function(p) {
      var gp = p.s.gp || 1;
      var ppg = p.s.pts / gp;
      if (ppg > bestPpg) { bestPpg = ppg; best = p; }
    });
    if (best) addLog('ev', weekNum, '\u2b50 <b>' + best.name + '</b> named ' + t.conf + ' Player of the Week (' + bestPpg.toFixed(1) + ' PPG).');
  });

  // 6. Off-Court Issue (4%)
  tryFire(4, function() {
    var p = active[ri(0, active.length - 1)];
    var already = G.injuries.find(function(inj) { return inj.playerName === p.name; });
    if (already) return;
    G.injuries.push({ playerName: p.name, type: 'Suspension', weeksLeft: 1, origMins: p.mins });
    p.mins = 0;
    addLog('ev', weekNum, '\u26a0\ufe0f <b>' + p.name + '</b> suspended 1 game for off-court conduct.');
  });

  // ── TEAM EVENTS ──

  // 7. Chemistry Boost (8%)
  tryFire(8, function() {
    t.rost.forEach(function(p) {
      if (p.mins > 0) { p.sht = clamp(p.sht + 2, 30, 99); p.fin = clamp(p.fin + 2, 30, 99); p.def = clamp(p.def + 2, 30, 99); }
    });
    G.buffs.push({ playerName: 'TEAM', attr: 'all', mod: 2, gamesLeft: 2 });
    addLog('ev', weekNum, '\ud83e\udd1d Team chemistry surging \u2014 all attributes +2 for next 2 games.');
    toast('Chemistry boost!', 'var(--grn)');
  });

  // 8. Locker Room Drama (5%)
  tryFire(5, function() {
    t.rost.forEach(function(p) {
      if (p.mins > 0) { p.sht = clamp(p.sht - 2, 30, 99); p.fin = clamp(p.fin - 2, 30, 99); p.def = clamp(p.def - 2, 30, 99); }
    });
    G.buffs.push({ playerName: 'TEAM', attr: 'all', mod: -2, gamesLeft: 2 });
    addLog('ev', weekNum, '\ud83d\udca2 Locker room tension after ' + (lastWin ? 'a close call' : 'tough loss') + ' \u2014 team distracted for 2 games.');
    toast('Locker room drama', '#fc8181');
  });

  // 9. Sellout Crowd (10%)
  tryFire(10, function() {
    G.nextHomeBonus = 3;
    addLog('ev', weekNum, '\ud83c\udfdf\ufe0f Sellout crowd expected for the next home game \u2014 electric atmosphere.');
    toast('Sellout incoming!', 'var(--grn)');
  });

  // 10. ESPN GameDay (5% — only if top 25)
  tryFire(netRank <= 25 ? 15 : 0, function() {
    addLog('ev', weekNum, '\ud83d\udcfa ESPN College GameDay is coming to ' + t.name + '! National spotlight on the program.');
    toast('GameDay!', 'var(--gld)');
  });

  // ── COACHING EVENTS ──

  // 11. Coach of the Week (conditional)
  var recentWins = played.slice(-3).filter(function(g) { return g.uScore > g.oScore; }).length;
  tryFire(recentWins >= 3 ? 40 : 0, function() {
    addLog('ev', weekNum, '\ud83c\udfc6 Coach <b>' + G.coach.firstName + ' ' + G.coach.lastName + '</b> named ' + t.conf + ' Coach of the Week after 3 straight wins.');
  });

  // 12. AD Meeting — hot seat warning
  tryFire(G.coach.hotSeat ? 25 : 0, function() {
    addLog('ev', weekNum, '\ud83d\udce2 Called into the AD\'s office. "We need to see improvement. The fanbase is restless."');
    toast('AD meeting...', '#fc8181');
  });

  // 13. Booster Pressure (if losing record)
  tryFire(t.loss > t.wins && weekNum > 10 ? 15 : 0, function() {
    addLog('ev', weekNum, '\ud83d\udcb0 Boosters are getting impatient with the ' + t.wins + '-' + t.loss + ' record. Pressure mounting.');
  });

  // 14. Poaching Rumors (if doing well)
  tryFire(t.wins > 15 && G.coach.off >= 75 ? 8 : 0, function() {
    addLog('ev', weekNum, '\ud83d\udc40 Rumors swirling: Power conference programs have ' + G.coach.firstName + ' ' + G.coach.lastName + ' on their shortlist.');
  });

  // ── RECRUITING ──

  // 15. Recruit Visit (12%)
  tryFire(12, function() {
    if (!G.recruits || !G.recruits.length) return;
    var open = G.recruits.filter(function(r) { return r.status === 'open'; });
    if (!open.length) return;
    var r = open[ri(0, open.length - 1)];
    r.interest = Math.min(100, (r.interest || 0) + ri(10, 20));
    addLog('ev', weekNum, '\ud83c\udf1f Recruit <b>' + r.name + '</b> (' + r.stars + '\u2605 ' + r.pos + ') had a great campus visit. Interest up!');
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
      var rivalTid = r.rivals[ri(0, r.rivals.length - 1)];
      var rivalTeam = G.teams[rivalTid];
      r.status = 'gone'; r.signed = rivalTid;
      addLog('ev', weekNum, '\ud83d\udcac <b>' + r.name + '</b> (' + r.stars + '\u2605) commits to <b>' + (rivalTeam ? rivalTeam.name : 'a rival') + '</b>. Tough loss on the trail.');
    }
  });

  // ── NATIONAL ──

  // 17. Major Upset (10%)
  tryFire(10, function() {
    var top10 = natSorted.slice(0, 10);
    var upset = top10[ri(0, top10.length - 1)];
    var rank = natSorted.indexOf(upset) + 1;
    addLog('ev', weekNum, '\ud83d\ude31 UPSET ALERT: #' + rank + ' <b>' + upset.name + '</b> falls to an unranked opponent! Chaos in the bracket.');
  });

  // 18. Bracketology Update (15%)
  tryFire(weekNum >= 15 ? 15 : 0, function() {
    var seed = netRank <= 4 ? 1 : netRank <= 8 ? 2 : netRank <= 16 ? ri(3, 4) : netRank <= 32 ? ri(5, 8) : netRank <= 64 ? ri(9, 12) : 0;
    if (seed > 0) {
      addLog('ev', weekNum, '\ud83d\udcca ESPN Bracketology: <b>' + t.name + '</b> projected as a <b>#' + seed + ' seed</b>.');
    } else {
      addLog('ev', weekNum, '\ud83d\udcca ESPN Bracketology: <b>' + t.name + '</b> currently on the outside looking in.');
    }
  });

  // 19. Conference Standings (10%)
  tryFire(10, function() {
    var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
    conf.sort(function(a, b) { return b.cWins - a.cWins || b.pts - a.pts; });
    var pos = conf.findIndex(function(x) { return x.id === G.tid; }) + 1;
    addLog('ev', weekNum, '\ud83d\udcc8 ' + t.conf + ' standings update: <b>' + t.name + '</b> sits at <b>#' + pos + '</b> in the conference.');
  });

  // ── CREATIVE EXTRAS ──

  // 20. Video Game Distraction (5%)
  tryFire(5, function() {
    var p = active[ri(0, active.length - 1)];
    p.sht = clamp(p.sht - 3, 30, 99);
    G.buffs.push({ playerName: p.name, attr: 'sht', mod: -3, gamesLeft: 1 });
    addLog('ev', weekNum, '\ud83c\udfae <b>' + p.name + '</b> was up all night before a game release. Shooting \u22123 next game.');
  });

  // 21. Transfer Portal Threat (4%)
  tryFire(4, function() {
    var bench = t.rost.filter(function(p) { return p.mins === 0 || p.mins < 5; });
    if (bench.length) {
      var p = bench[ri(0, bench.length - 1)];
      addLog('ev', weekNum, '\ud83d\udce4 <b>' + p.name + '</b> is reportedly unhappy with playing time and exploring the transfer portal.');
    }
  });

  // 22. Sneaker Deal (3%)
  tryFire(3, function() {
    addLog('ev', weekNum, '\ud83d\udc5f New sneaker deal announced for ' + t.name + '! Morale boost across the roster.');
    toast('Sneaker deal!', 'var(--gld)');
  });

  // 23. Flu Game (6%)
  tryFire(6, function() {
    var p = starters[ri(0, starters.length - 1)];
    p.fin = clamp(p.fin - 4, 30, 99);
    G.buffs.push({ playerName: p.name, attr: 'fin', mod: -4, gamesLeft: 1 });
    addLog('ev', weekNum, '\ud83e\udd12 <b>' + p.name + '</b> battling illness \u2014 playing through it but finishing \u22124 next game.');
  });

  // 24. Freshman Breakout (8% — only freshmen)
  tryFire(8, function() {
    var freshmen = t.rost.filter(function(p) { return p.cls === 'FR' && p.mins > 0; });
    if (freshmen.length) {
      var p = freshmen[ri(0, freshmen.length - 1)];
      p.sht = clamp(p.sht + 3, 30, 99);
      p.fin = clamp(p.fin + 3, 30, 99);
      G.buffs.push({ playerName: p.name, attr: 'sht', mod: 3, gamesLeft: 4 });
      G.buffs.push({ playerName: p.name, attr: 'fin', mod: 3, gamesLeft: 4 });
      addLog('ev', weekNum, '\ud83c\udf1f Freshman <b>' + p.name + '</b> is having a breakout stretch \u2014 boosted for 4 games!');
      toast(p.name + ' breakout!', 'var(--grn)');
    }
  });

  // 25. Rivalry Hype (conditional)
  tryFire(weekNum >= 10 ? 8 : 0, function() {
    var next = t.sched[G.gi];
    if (!next || next.opp === undefined) return;
    var opp = G.teams[next.opp];
    if (opp && opp.conf === t.conf) {
      addLog('ev', weekNum, '\ud83d\udd25 Rivalry week: <b>' + t.name + '</b> vs <b>' + opp.name + '</b> is the talk of the conference.');
    }
  });

  // 26. Senior Night (week 28-29)
  tryFire(weekNum >= 28 ? 30 : 0, function() {
    var seniors = t.rost.filter(function(p) { return p.cls === 'SR' && p.mins > 0; });
    if (seniors.length) {
      addLog('ev', weekNum, '\ud83c\udf93 Senior Night: ' + seniors.map(function(p) { return '<b>' + p.name + '</b>'; }).join(', ') + ' honored before the home crowd.');
    }
  });

  // 27. Weather Delay (3%)
  tryFire(3, function() {
    addLog('ev', weekNum, '\u2744\ufe0f Winter storm delays team travel \u2014 players arrive fatigued for next away game.');
    t.rost.forEach(function(p) { if (p.mins > 0) { p.fin = clamp(p.fin - 1, 30, 99); } });
    G.buffs.push({ playerName: 'TEAM', attr: 'all', mod: -1, gamesLeft: 1 });
  });

  // 28. Walk-on Hero (3%)
  tryFire(3, function() {
    var bench = t.rost.filter(function(p) { return p.mins === 0; });
    if (bench.length) {
      var p = bench[ri(0, bench.length - 1)];
      addLog('ev', weekNum, '\ud83c\udf1f Walk-on <b>' + p.name + '</b> impresses in practice \u2014 earns rotation minutes next game.');
      p.mins = 8;
    }
  });

  saveState();
}
