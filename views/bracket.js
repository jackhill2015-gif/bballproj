// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/bracket.js
//  Tournament Hub: full bracket, scouting, results, box scores
// ═══════════════════════════════════════════════════════════

import { ge, clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';
import { allConfDone, getUserNCAAmatchup, getUserConfMatchup, getConfRoundName, getNCAAroundName } from '../tournament.js';

export function renderBracket() {
  var el = ge('bracket-content'); if (!el) return;

  if (G.phase === 'conf_tourn' && G.confTourneys) {
    el.innerHTML = renderConfHub();
    return;
  }

  if (G.phase === 'ncaa' && G.bracket && G.bracket.length) {
    el.innerHTML = renderNCAA_Hub();
    return;
  }

  if (G.bracket && G.bracket.length === 1) {
    el.innerHTML = renderNCAA_Hub();
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--txt3);font-size:13px;">Complete the regular season to unlock the bracket.</div>';
}

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

function renderConfHub() {
  var myConf = G.teams[G.tid].conf;
  var ct = G.confTourneys[myConf];
  var h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<div><div style="font-size:22px;font-weight:900;">Conference Tournaments</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">' + myConf + ' \u00b7 Season ' + G.yr + '</div></div>'
    + '<div style="font-size:11px;font-weight:800;color:' + (ct && ct.done ? 'var(--grn2)' : 'var(--red)') + ';letter-spacing:1px;">'
    + (ct && ct.done ? '\u2713 COMPLETE' : 'IN PROGRESS') + '</div></div>';

  // Your conference bracket
  if (ct) h += renderConfBracketCard(myConf, ct, true);

  // Your next game (if still active)
  var confMatch = getUserConfMatchup();
  if (confMatch) {
    h += renderScoutingReport(confMatch.matchup, confMatch.ct, 'conf');
  }

  // Other conferences
  var otherConfs = Object.keys(G.confTourneys).filter(function(c) { return c !== myConf; });
  if (otherConfs.length) {
    h += '<div style="font-size:16px;font-weight:900;margin:20px 0 10px;">Other Conferences</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    otherConfs.forEach(function(c) {
      h += renderConfBracketCard(c, G.confTourneys[c], false);
    });
    h += '</div>';
  }

  // Build NCAA button
  if (allConfDone() && (!G.bracket || !G.bracket.length)) {
    h += '<div style="text-align:center;margin-top:20px;padding:24px;background:linear-gradient(135deg,rgba(0,102,204,.06),rgba(214,158,46,.06));border:2px solid var(--red);border-radius:8px;">'
      + '<div style="font-size:14px;font-weight:900;color:var(--red);margin-bottom:8px;">ALL CONFERENCE TOURNAMENTS COMPLETE</div>'
      + '<div class="btn btn-red" style="display:inline-block;padding:14px 32px;font-size:14px;" onclick="buildNCAA()">SELECTION SUNDAY \u25b6</div>'
      + '</div>';
  }

  return h;
}

function renderConfBracketCard(conf, ct, expanded) {
  if (!ct || !ct.rounds) return '';
  var rnames = { 1: 'R1', 2: 'QF', 3: 'SF', 4: 'FINAL' };
  var h = '<div style="background:var(--s1);border:1px solid var(--bdr);border-radius:7px;overflow:hidden;margin-bottom:12px;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--s2);border-bottom:1px solid var(--bdr);">'
    + '<span style="font-size:12px;font-weight:800;color:var(--txt);">' + conf + '</span>';
  if (ct.done && ct.champ) {
    h += '<span style="font-size:10px;font-weight:700;color:var(--gld2);">\ud83c\udfc6 ' + ct.champ.name + '</span>';
  } else {
    h += '<span style="font-size:10px;font-weight:700;color:var(--red);">LIVE</span>';
  }
  h += '</div>';

  if (expanded) {
    // Full bracket view
    h += '<div style="display:flex;overflow-x:auto;">';
    ct.rounds.forEach(function(round, ri) {
      h += '<div style="min-width:160px;padding:6px;border-right:1px solid var(--bdr);">';
      h += '<div style="font-size:8px;font-weight:800;color:var(--red);letter-spacing:1px;text-align:center;padding:4px 0;">' + (rnames[ri + 1] || 'R' + (ri + 1)) + '</div>';
      round.forEach(function(m) {
        var played = m.winner !== null;
        h += renderMatchupMini(m.t1, m.t2, m.s1, m.s2, m.winner, ct.seeds);
      });
      h += '</div>';
    });
    h += '</div>';
  } else {
    // Compact — just show latest round results
    var lastRound = ct.rounds[ct.rounds.length - 1];
    if (lastRound) {
      lastRound.forEach(function(m) {
        if (m.winner) {
          h += '<div style="padding:4px 12px;font-size:10px;color:var(--txt2);border-bottom:1px solid rgba(0,0,0,.04);">'
            + '<span style="font-weight:700;color:var(--txt);">' + m.winner.name + '</span> def. '
            + (m.winner.id === m.t1.id ? m.t2.name : m.t1.name)
            + ' <span style="color:var(--txt3);">' + m.s1 + '-' + m.s2 + '</span></div>';
        }
      });
    }
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  NCAA TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

function renderNCAA_Hub() {
  var active = G.bracket.filter(function(b) { return b.active; });
  var rn = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16', 8: 'Elite Eight', 4: 'Final Four', 2: 'Championship', 1: 'Champion' };
  var currentRound = rn[active.length] || 'NCAA Tournament';
  var h = '';

  // Champion screen
  if (active.length === 1) {
    var ch = active[0].team; var isu = ch.id === G.tid;
    h = '<div style="text-align:center;padding:48px 32px;background:linear-gradient(180deg,rgba(214,158,46,.08),transparent);border-radius:8px;">';
    h += '<div style="font-size:64px;margin-bottom:12px;">\ud83c\udfc6</div>';
    h += '<div style="font-size:10px;font-weight:800;color:var(--gld2);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">' + G.yr + ' National Champion</div>';
    h += '<div style="font-size:40px;font-weight:900;color:' + (isu ? 'var(--gld2)' : 'var(--txt)') + ';letter-spacing:-1px;margin-bottom:6px;">' + ch.name + '</div>';
    if (isu) h += '<div style="font-size:15px;font-weight:800;color:var(--gld2);margin-bottom:24px;">YOUR DYNASTY. YOUR LEGACY.</div>';
    h += '<div class="btn btn-red" style="display:inline-block;padding:12px 28px;font-size:13px;" onclick="endSeason()">VIEW SEASON RECAP</div>';
    h += '</div>';
    h += renderFullBracket();
    return h;
  }

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<div><div style="font-size:22px;font-weight:900;">NCAA Tournament</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">March Madness ' + G.yr + '</div></div>'
    + '<div style="font-size:12px;font-weight:800;color:var(--red);letter-spacing:1px;text-transform:uppercase;background:rgba(0,102,204,.06);padding:6px 12px;border-radius:4px;">' + currentRound + '</div></div>';

  // Your matchup scouting report
  var userMatch = getUserNCAAmatchup();
  if (userMatch) {
    h += renderNCAAScoutingReport(userMatch, currentRound);
  } else if (active.length > 1) {
    h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:20px;margin-bottom:16px;text-align:center;">'
      + '<div style="font-size:13px;color:var(--txt2);margin-bottom:10px;">Your tournament run is over. Simming remaining games...</div>'
      + '<div class="btn btn-red" style="display:inline-block;padding:10px 24px;" onclick="simNCAAround()">SIM NEXT ROUND</div></div>';
  }

  // Upsets / Results Feed
  h += renderResultsFeed();

  // Full bracket
  h += renderFullBracket();

  return h;
}

function renderNCAAScoutingReport(match, roundName) {
  var b1 = match.b1, b2 = match.b2;
  var uIsB1 = b1.team.id === G.tid;
  var uTeam = uIsB1 ? b1 : b2, oppEntry = uIsB1 ? b2 : b1;
  var opp = oppEntry.team;
  var wp = clamp(50 + (getTOvr(uTeam.team) - getTOvr(opp)) * 1.3, 5, 95);
  var wpCol = wp >= 50 ? 'var(--grn)' : '#dc2626';

  // Find opponent's top 3 players by OVR
  var oppStars = opp.rost.filter(function(p) { return p.mins > 0; }).sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3);

  var h = '<div style="background:linear-gradient(135deg,rgba(214,158,46,.06),rgba(0,102,204,.04));border:2px solid var(--gld);border-radius:8px;padding:20px;margin-bottom:16px;">';
  h += '<div style="font-size:9px;font-weight:800;color:var(--gld2);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">SCOUTING REPORT \u2014 ' + roundName + '</div>';

  // Matchup header
  h += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">';
  h += '<div style="flex:1;"><div style="font-size:10px;color:var(--gld2);font-weight:700;">#' + uTeam.seed + ' seed</div>'
    + '<div style="font-size:24px;font-weight:900;color:var(--txt);">' + uTeam.team.name + '</div>'
    + '<div style="font-size:11px;color:var(--txt2);">' + uTeam.team.wins + '-' + uTeam.team.loss + ' \u00b7 OVR ' + getTOvr(uTeam.team) + '</div></div>';
  h += '<div style="font-size:16px;font-weight:900;color:var(--txt3);">VS</div>';
  h += '<div style="flex:1;text-align:right;"><div style="font-size:10px;color:var(--txt2);font-weight:700;">#' + oppEntry.seed + ' seed</div>'
    + '<div style="font-size:24px;font-weight:900;color:var(--txt2);">' + opp.name + '</div>'
    + '<div style="font-size:11px;color:var(--txt3);">' + opp.wins + '-' + opp.loss + ' \u00b7 OVR ' + getTOvr(opp) + '</div></div>';
  h += '</div>';

  // Win probability bar
  h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);margin-bottom:4px;">'
    + '<span>Win Probability</span><span style="color:' + wpCol + ';font-weight:700;">' + Math.round(wp) + '%</span></div>'
    + '<div style="height:6px;background:var(--bdr2);border-radius:3px;overflow:hidden;margin-bottom:12px;">'
    + '<div style="height:100%;width:' + Math.round(wp) + '%;background:' + wpCol + ';border-radius:3px;"></div></div>';

  // Opponent key players
  if (oppStars.length) {
    h += '<div style="font-size:9px;font-weight:700;color:var(--txt3);letter-spacing:1px;margin-bottom:6px;">PLAYERS TO WATCH</div>';
    h += '<div style="display:flex;gap:8px;">';
    oppStars.forEach(function(p) {
      var gp = p.s.gp || 1;
      var ppg = (p.s.pts / gp).toFixed(1);
      h += '<div style="flex:1;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;padding:8px;text-align:center;">'
        + '<div style="font-size:11px;font-weight:700;color:var(--txt);">' + p.name + '</div>'
        + '<div style="font-size:9px;color:var(--txt3);">' + p.pos + ' \u00b7 ' + p.cls + '</div>'
        + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--red);margin-top:4px;">' + p.ovr + '</div>'
        + '<div style="font-size:9px;color:var(--txt2);">' + ppg + ' PPG</div></div>';
    });
    h += '</div>';
  }

  // Action buttons
  h += '<div style="display:flex;gap:8px;margin-top:14px;">'
    + '<div class="btn btn-red btn-full" onclick="doPlay(\'quick\')">\u26a1 QUICK SIM</div>'
    + '<div class="btn btn-ghost btn-full" onclick="doPlay(\'live\')">\u25b6 LIVE SIM</div></div>';
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  RESULTS FEED (upsets, scores from other games)
// ═══════════════════════════════════════════════════════════

function renderResultsFeed() {
  // Find completed games this round
  var results = [];
  for (var i = 0; i < G.bracket.length - 1; i += 2) {
    var b1 = G.bracket[i], b2 = G.bracket[i + 1];
    if (b1.score !== null && b2.score !== null) {
      var winner = b1.won ? b1 : b2;
      var loser = b1.won ? b2 : b1;
      var isUpset = winner.seed > loser.seed + 4;
      results.push({ winner: winner, loser: loser, isUpset: isUpset });
    }
  }

  if (!results.length) return '';

  // Sort upsets first
  results.sort(function(a, b) { return (b.isUpset ? 1 : 0) - (a.isUpset ? 1 : 0); });

  var h = '<div style="margin-bottom:16px;">';
  h += '<div style="font-size:14px;font-weight:900;margin-bottom:8px;">Results</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
  results.slice(0, 8).forEach(function(r) {
    var isUserGame = r.winner.team.id === G.tid || r.loser.team.id === G.tid;
    h += '<div style="background:var(--s1);border:1px solid ' + (r.isUpset ? 'var(--gld)' : 'var(--bdr)') + ';border-radius:5px;padding:8px 10px;'
      + (isUserGame ? 'border-left:3px solid var(--red);' : '') + '">';
    if (r.isUpset) h += '<div style="font-size:8px;font-weight:800;color:var(--gld2);letter-spacing:1px;margin-bottom:2px;">\ud83d\ude31 UPSET</div>';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<div style="font-size:11px;">'
      + '<span style="font-size:9px;color:var(--txt3);">#' + r.winner.seed + '</span> '
      + '<span style="font-weight:700;color:var(--grn2);">' + r.winner.team.name + '</span>'
      + ' <span style="font-family:monospace;font-size:10px;color:var(--txt2);">' + r.winner.score + '</span></div>'
      + '<div style="font-size:11px;">'
      + '<span style="font-size:9px;color:var(--txt3);">#' + r.loser.seed + '</span> '
      + '<span style="color:var(--txt3);">' + r.loser.team.name + '</span>'
      + ' <span style="font-family:monospace;font-size:10px;color:var(--txt3);">' + r.loser.score + '</span></div>'
      + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  FULL 64-TEAM BRACKET (4 regions)
// ═══════════════════════════════════════════════════════════

function renderFullBracket() {
  var regions = ['East', 'West', 'South', 'Midwest'];
  var h = '<div style="font-size:14px;font-weight:900;margin:16px 0 8px;">Full Bracket</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

  for (var r = 0; r < 4; r++) {
    var regionStart = r * 16;
    var regionTeams = G.bracket.slice(regionStart, regionStart + 16);
    if (!regionTeams.length) continue;

    h += '<div style="background:var(--s1);border:1px solid var(--bdr);border-radius:7px;overflow:hidden;">';
    h += '<div style="padding:8px 12px;background:var(--s2);border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:11px;font-weight:800;color:var(--txt);letter-spacing:1px;text-transform:uppercase;">' + regions[r] + ' Region</span>';

    // Region winner
    var regionWinner = null;
    regionTeams.forEach(function(b) { if (b.active && b.won) regionWinner = b; });
    var activeInRegion = regionTeams.filter(function(b) { return b.active; });
    if (activeInRegion.length === 1) {
      h += '<span style="font-size:9px;font-weight:700;color:var(--grn2);">\u2713 ' + activeInRegion[0].team.name + '</span>';
    } else {
      h += '<span style="font-size:9px;color:var(--txt3);">' + activeInRegion.length + ' teams left</span>';
    }
    h += '</div>';

    // Matchup pairs
    for (var i = 0; i < regionTeams.length - 1; i += 2) {
      var b1 = regionTeams[i], b2 = regionTeams[i + 1];
      if (!b1 || !b2) continue;
      var played = b1.score !== null;
      h += '<div style="border-bottom:1px solid rgba(0,0,0,.04);">';
      [b1, b2].forEach(function(b, idx) {
        var isu = b.team.id === G.tid;
        var isWin = played && b.won;
        var isLose = played && !b.won;
        h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:11px;font-weight:600;'
          + (isu ? 'background:rgba(214,158,46,.08);border-left:3px solid var(--gld);' : 'border-left:3px solid transparent;')
          + (isWin ? 'color:var(--grn2);' : isLose ? 'color:var(--txt3);text-decoration:line-through;opacity:.6;' : isu ? 'color:var(--gld2);' : 'color:var(--txt);')
          + (idx === 0 ? 'border-bottom:1px solid rgba(0,0,0,.03);' : '') + '">'
          + '<span style="font-size:9px;font-family:monospace;color:' + (isu ? 'var(--gld2)' : 'var(--txt3)') + ';width:16px;text-align:right;flex-shrink:0;">' + b.seed + '</span>'
          + '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + b.team.name + '</span>';
        if (played) h += '<span style="font-family:monospace;font-size:11px;font-weight:700;">' + b.score + '</span>';
        if (!b.active && !played) h += '<span style="font-size:9px;color:var(--txt3);">OUT</span>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function renderMatchupMini(t1, t2, s1, s2, winner, seeds) {
  var played = winner !== null;
  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:3px;margin:2px 0;overflow:hidden;">';
  [{ t: t1, s: s1 }, { t: t2, s: s2 }].forEach(function(entry) {
    var isu = entry.t.id === G.tid;
    var isWin = played && winner && winner.id === entry.t.id;
    var isLose = played && !isWin;
    var seedNum = seeds ? seeds.findIndex(function(x) { return x.id === entry.t.id; }) + 1 : '';
    h += '<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:10px;'
      + (isu ? 'font-weight:800;color:var(--gld2);' : isWin ? 'font-weight:700;color:var(--grn2);' : isLose ? 'color:var(--txt3);' : 'color:var(--txt);')
      + 'border-bottom:1px solid rgba(0,0,0,.03);">'
      + '<span style="font-size:8px;color:var(--txt3);width:12px;">' + seedNum + '</span>'
      + '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + entry.t.name + '</span>';
    if (played) h += '<span style="font-family:monospace;font-weight:700;">' + entry.s + '</span>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function renderScoutingReport(matchup, ct, type) {
  var m = matchup;
  var userIsT1 = m.t1.id === G.tid;
  var opp = userIsT1 ? m.t2 : m.t1;
  var wp = clamp(50 + (getTOvr(G.teams[G.tid]) - getTOvr(opp)) * 1.3, 5, 95);
  var wpCol = wp >= 50 ? 'var(--grn)' : '#dc2626';

  var h = '<div style="background:var(--s1);border:2px solid var(--red);border-radius:8px;padding:16px;margin-bottom:16px;">';
  h += '<div style="font-size:9px;font-weight:800;color:var(--red);letter-spacing:2px;margin-bottom:10px;">YOUR NEXT GAME</div>';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
    + '<div style="font-size:20px;font-weight:900;color:var(--txt);">' + G.teams[G.tid].name + '</div>'
    + '<div style="font-size:14px;font-weight:900;color:var(--txt3);">vs</div>'
    + '<div style="font-size:20px;font-weight:900;color:var(--txt2);">' + opp.name + '</div></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);margin-bottom:4px;">'
    + '<span>Win Probability</span><span style="color:' + wpCol + ';font-weight:700;">' + Math.round(wp) + '%</span></div>'
    + '<div style="height:5px;background:var(--bdr2);border-radius:3px;overflow:hidden;margin-bottom:12px;">'
    + '<div style="height:100%;width:' + Math.round(wp) + '%;background:' + wpCol + ';border-radius:3px;"></div></div>';
  h += '<div style="display:flex;gap:8px;">'
    + '<div class="btn btn-red btn-full" onclick="doPlay(\'quick\')">\u26a1 QUICK SIM</div>'
    + '<div class="btn btn-ghost btn-full" onclick="doPlay(\'live\')">\u25b6 LIVE SIM</div></div>';
  h += '</div>';
  return h;
}
