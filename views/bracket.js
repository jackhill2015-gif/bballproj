// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/bracket.js
//  Tournament Hub: conference tournaments, NCAA bracket,
//  scouting, results feed, cinderella watch.
//  Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { ge, clamp, getTOvr } from '../utils.js';
import { G } from '../state.js';
import { allConfDone, getUserNCAAmatchup, getUserConfMatchup, getConfRoundName } from '../tournament.js';

export function renderBracket() {
  var el = ge('bracket-content');
  if (!el) return;

  if (G.phase === 'conf_tourn' && G.confTourneys) {
    el.innerHTML = renderConfHub();
    return;
  }
  if ((G.phase === 'ncaa' || (G.bracket && G.bracket.length === 1)) && G.bracket && G.bracket.length) {
    el.innerHTML = renderNCAA_Hub();
    return;
  }
  el.innerHTML = '<div class="card" style="text-align:center;padding:48px;color:var(--txt3);">'
    + '<div style="font-size:32px;margin-bottom:8px;">🏆</div>'
    + '<div style="font-size:14px;font-weight:700;">Complete the regular season to unlock the bracket.</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

function renderConfHub() {
  var myConf = G.teams[G.tid].conf;
  var ct = G.confTourneys[myConf];
  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Conference Tournaments</div>'
    + '<div class="sec-sub">' + myConf + ' · Season ' + G.yr + '</div></div>';

  if (ct) h += renderConfBracketCard(myConf, ct, true);

  var confMatch = getUserConfMatchup();
  if (confMatch) h += renderScoutingCard(confMatch);

  var others = Object.keys(G.confTourneys).filter(function(c) { return c !== myConf; });
  if (others.length) {
    h += '<div class="sec-head" style="font-size:15px;margin-top:18px;">Around the Country</div>'
      + '<div class="grid-2">';
    others.slice(0, 8).forEach(function(c) {
      h += renderConfBracketCard(c, G.confTourneys[c], false);
    });
    h += '</div>';
    if (others.length > 8) h += '<div style="font-size:12px;color:var(--txt3);margin-top:6px;">Showing 8 of ' + others.length + ' conferences.</div>';
  }

  if (allConfDone() && (!G.bracket || !G.bracket.length)) {
    h += '<div class="card" style="text-align:center;border:2px solid var(--blu);margin-top:16px;">'
      + '<div style="font-size:14px;font-weight:900;color:var(--blu);margin-bottom:10px;">ALL CONFERENCE TOURNAMENTS COMPLETE</div>'
      + '<button class="btn btn-red" style="padding:14px 36px;font-size:14px;" data-action="build-ncaa">SELECTION SUNDAY ▶</button>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:8px;">Use the Advance button up top to build the NCAA field.</div></div>';
  }
  return h;
}

function matchupMini(t1, t2, s1, s2, winner, seeds) {
  var played = winner !== null && winner !== undefined;
  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;margin:4px 0;overflow:hidden;">';
  [{ t: t1, s: s1 }, { t: t2, s: s2 }].forEach(function(e) {
    if (!e.t) return;
    var isu = e.t.id === G.tid;
    var isWin = played && winner && winner.id === e.t.id;
    var seedNum = seeds ? seeds.findIndex(function(x) { return x.id === e.t.id; }) + 1 : '';
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:12px;'
      + (isu ? 'font-weight:800;color:var(--blu);background:var(--blu-soft);' : isWin ? 'font-weight:700;color:var(--grn2);' : 'color:var(--txt);') + '">'
      + '<span style="font-size:10px;color:var(--txt3);width:16px;font-family:var(--mono);">' + seedNum + '</span>'
      + '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + e.t.name + '</span>'
      + (played ? '<span style="font-family:var(--mono);font-weight:800;">' + e.s + '</span>' : '') + '</div>';
  });
  return h + '</div>';
}

function renderConfBracketCard(conf, ct, expanded) {
  if (!ct || !ct.rounds) return '';
  var rnames = { 1: 'R1', 2: 'QF', 3: 'SF', 4: 'FINAL' };
  var h = '<div class="card" style="padding:0;overflow:hidden;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--s2);border-bottom:1px solid var(--bdr);">'
    + '<span style="font-size:13px;font-weight:800;">' + conf + '</span>'
    + (ct.done && ct.champ
      ? '<span style="font-size:11px;font-weight:800;color:var(--gld2);">🏆 ' + ct.champ.name + '</span>'
      : '<span class="tag t-rival">Live</span>') + '</div>';

  if (expanded) {
    h += '<div style="display:flex;overflow-x:auto;padding:6px;">';
    ct.rounds.forEach(function(round, ri) {
      h += '<div style="min-width:170px;padding:4px 8px;border-right:1px solid var(--bdr);">'
        + '<div style="font-size:10px;font-weight:800;color:var(--blu);letter-spacing:1px;text-align:center;padding:4px 0;">' + (rnames[ri + 1] || 'R' + (ri + 1)) + '</div>';
      round.forEach(function(m) { h += matchupMini(m.t1, m.t2, m.s1, m.s2, m.winner, ct.seeds); });
      h += '</div>';
    });
    h += '</div>';
  } else {
    var lastRound = ct.rounds[ct.rounds.length - 1];
    var shown = 0;
    if (lastRound) lastRound.forEach(function(m) {
      if (m.winner && shown < 3) {
        shown++;
        h += '<div style="padding:6px 14px;font-size:12px;color:var(--txt2);border-top:1px solid var(--bdr);">'
          + '<b style="color:var(--txt);">' + m.winner.name + '</b> def. '
          + (m.winner.id === m.t1.id ? m.t2.name : m.t1.name)
          + ' <span style="color:var(--txt3);font-family:var(--mono);">' + m.s1 + '-' + m.s2 + '</span></div>';
      }
    });
  }
  return h + '</div>';
}

function renderScoutingCard(confMatch) {
  var m = confMatch.matchup;
  var opp = m.t1.id === G.tid ? m.t2 : m.t1;
  var wp = clamp(Math.round(50 + (getTOvr(G.teams[G.tid]) - getTOvr(opp)) * 1.3), 5, 95);
  var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
  return '<div class="matchup-card"><div class="card-title">Your next game · ' + getConfRoundName(confMatch.ct, confMatch.conf) + '</div>'
    + '<div class="matchup-opp">' + opp.name + '</div>'
    + '<div class="matchup-meta"><span class="tag t-cf">Conf Tourney</span>'
    + '<span style="color:var(--txt2);">OVR ' + getTOvr(opp) + ' · ' + opp.wins + '-' + opp.loss + '</span></div>'
    + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';font-weight:800;">' + wp + '%</span></div>'
    + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>'
    + '<div class="action-btns"><button class="btn btn-red btn-full" data-action="play" data-mode="quick">⚡ QUICK SIM</button>'
    + '<button class="btn btn-ghost btn-full" data-action="play" data-mode="live">▶ LIVE SIM</button></div></div>';
}

// ═══════════════════════════════════════════════════════════
//  NCAA TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

function renderNCAA_Hub() {
  var active = G.bracket.filter(function(b) { return b.active; });
  var rn = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16', 8: 'Elite Eight', 4: 'Final Four', 2: 'Championship', 1: 'Champion' };
  var currentRound = rn[active.length] || 'NCAA Tournament';

  // Champion screen
  if (active.length === 1) {
    var ch = active[0].team, isu = ch.id === G.tid;
    var h = '<div class="card" style="text-align:center;padding:40px 20px;border:2px solid var(--gld);">'
      + '<div style="font-size:52px;margin-bottom:8px;">🏆</div>'
      + '<div style="font-size:10px;font-weight:800;color:var(--gld2);letter-spacing:3px;margin-bottom:6px;">' + G.yr + ' NATIONAL CHAMPION</div>'
      + '<div style="font-size:34px;font-weight:900;letter-spacing:-1px;' + (isu ? 'color:var(--gld2);' : '') + '">' + ch.name + '</div>'
      + (isu ? '<div style="font-size:14px;font-weight:800;color:var(--gld2);margin-top:8px;">YOUR DYNASTY. YOUR LEGACY.</div>' : '')
      + '<div style="margin-top:18px;"><button class="btn btn-red" style="padding:12px 32px;" data-action="end-season">VIEW SEASON RECAP</button></div></div>';
    h += renderCinderellaTracker();
    h += renderResultsFeed();
    h += renderFullBracket();
    return h;
  }

  var h2 = '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
    + '<div><div class="sec-head" style="margin:0;">NCAA Tournament</div><div class="sec-sub" style="margin:2px 0 0;">March Madness ' + G.yr + '</div></div>'
    + '<div class="tag" style="background:var(--gld-soft);color:var(--gld2);font-size:11px;">' + currentRound + '</div></div></div>';

  h2 += renderCinderellaTracker();

  var um = getUserNCAAmatchup();
  if (um) {
    var uIsB1 = um.b1.team.id === G.tid;
    var ue = uIsB1 ? um.b1 : um.b2, oe = uIsB1 ? um.b2 : um.b1;
    var opp = oe.team;
    var wp = clamp(Math.round(50 + (getTOvr(ue.team) - getTOvr(opp)) * 1.3), 5, 95);
    var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
    var stars = opp.rost.filter(function(p) { return p.mins > 0; }).sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3);
    h2 += '<div class="matchup-card" style="border-left-color:var(--gld);"><div class="card-title">Scouting report · ' + currentRound + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">'
      + '<div style="flex:1;"><div style="font-size:10px;color:var(--gld2);font-weight:800;">#' + ue.seed + ' SEED</div>'
      + '<div style="font-size:20px;font-weight:900;">' + ue.team.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);">' + ue.team.wins + '-' + ue.team.loss + ' · OVR ' + getTOvr(ue.team) + '</div></div>'
      + '<div style="font-size:14px;font-weight:900;color:var(--txt3);">VS</div>'
      + '<div style="flex:1;text-align:right;"><div style="font-size:10px;color:var(--txt3);font-weight:800;">#' + oe.seed + ' SEED</div>'
      + '<div style="font-size:20px;font-weight:900;">' + opp.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + opp.wins + '-' + opp.loss + ' · OVR ' + getTOvr(opp) + '</div></div></div>'
      + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';font-weight:800;">' + wp + '%</span></div>'
      + '<div class="prob-bar" style="margin-bottom:10px;"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>';
    if (stars.length) {
      h2 += '<div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;margin-bottom:6px;">PLAYERS TO WATCH</div><div class="grid-3">';
      stars.forEach(function(p) {
        var gp = p.s.gp || 1;
        h2 += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:8px;padding:10px;text-align:center;">'
          + '<div style="font-size:12px;font-weight:800;">' + p.name + '</div>'
          + '<div style="font-size:10px;color:var(--txt3);">' + p.pos + ' · ' + p.cls + ' · OVR ' + p.ovr + '</div>'
          + '<div style="font-family:var(--mono);font-size:13px;font-weight:800;margin-top:4px;">' + (p.s.pts / gp).toFixed(1) + ' PPG</div></div>';
      });
      h2 += '</div>';
    }
    h2 += '<div class="action-btns"><button class="btn btn-red btn-full" data-action="play" data-mode="quick">⚡ QUICK SIM</button>'
      + '<button class="btn btn-ghost btn-full" data-action="play" data-mode="live">▶ LIVE SIM</button></div></div>';
  } else if (active.length > 1) {
    h2 += '<div class="card" style="text-align:center;"><div style="font-size:15px;font-weight:800;margin-bottom:6px;">Your run is over.</div>'
      + '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">Watch the rest of the tournament unfold.</div>'
      + '<button class="btn btn-red" style="padding:10px 28px;" data-action="play" data-mode="quick">SIM NEXT ROUND ▶</button></div>';
  }

  h2 += renderResultsFeed();
  h2 += renderFullBracket();
  return h2;
}

function renderResultsFeed() {
  var results = [];
  for (var i = 0; i < G.bracket.length - 1; i += 2) {
    var b1 = G.bracket[i], b2 = G.bracket[i + 1];
    if (b1.score === null || b1.score === undefined || b2.score === null || b2.score === undefined) continue;
    var winner = b1.won ? b1 : b2, loser = b1.won ? b2 : b1;
    results.push({ winner: winner, loser: loser, isUpset: winner.seed > loser.seed + 4 });
  }
  if (!results.length) return '';
  results.sort(function(a, b) { return (b.isUpset ? 1 : 0) - (a.isUpset ? 1 : 0); });

  var h = '<div class="sec-head" style="font-size:15px;margin-top:18px;">Latest Results</div><div class="grid-2">';
  results.slice(0, 8).forEach(function(r) {
    var isU = r.winner.team.id === G.tid || r.loser.team.id === G.tid;
    h += '<div class="card" style="padding:10px 12px;margin-bottom:0;' + (isU ? 'border-left:4px solid var(--blu);' : '') + '">'
      + (r.isUpset ? '<div class="tag t-rival" style="margin-bottom:4px;">😱 Upset</div>' : '')
      + '<div style="display:flex;justify-content:space-between;font-size:12px;">'
      + '<span><span style="color:var(--txt3);font-family:var(--mono);font-size:10px;">#' + r.winner.seed + '</span> <b style="color:var(--grn2);">' + r.winner.team.name + '</b> <span style="font-family:var(--mono);">' + r.winner.score + '</span></span>'
      + '<span><span style="color:var(--txt3);font-family:var(--mono);font-size:10px;">#' + r.loser.seed + '</span> <span style="color:var(--txt3);">' + r.loser.team.name + '</span> <span style="font-family:var(--mono);color:var(--txt3);">' + r.loser.score + '</span></span>'
      + '</div></div>';
  });
  return h + '</div>';
}

function renderCinderellaTracker() {
  if (!G.cinderellas || !G.cinderellas.length) return '';
  var active = G.bracket.filter(function(b) { return b.active; });
  var alive = G.cinderellas.filter(function(c) {
    return active.some(function(b) { return b.team.id === c.tid; });
  });
  if (!alive.length) return '';
  var h = '<div class="card" style="border:1px solid var(--gld);"><div class="card-title" style="color:var(--gld2);">👠 Cinderella Watch</div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
  alive.forEach(function(c) {
    var isU = c.tid === G.tid;
    h += '<div class="tag" style="' + (isU ? 'background:var(--gld-soft);color:var(--gld2);' : 'background:var(--s2);color:var(--txt2);border:1px solid var(--bdr);') + '">#' + c.seed + ' ' + c.name + '</div>';
  });
  return h + '</div></div>';
}

function renderFullBracket() {
  var regions = ['East', 'West', 'South', 'Midwest'];
  var h = '<div class="sec-head" style="font-size:15px;margin-top:18px;">Full Bracket</div><div class="grid-2">';
  for (var r = 0; r < 4; r++) {
    var regionTeams = G.bracket.slice(r * 16, r * 16 + 16);
    if (!regionTeams.length) continue;
    var alive = regionTeams.filter(function(b) { return b.active; });
    h += '<div class="card" style="padding:0;overflow:hidden;">'
      + '<div style="padding:10px 14px;background:var(--s2);border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:12px;font-weight:800;letter-spacing:1px;">' + regions[r].toUpperCase() + '</span>'
      + '<span style="font-size:10px;color:var(--txt3);">' + (alive.length === 1 ? '✓ ' + alive[0].team.name : alive.length + ' left') + '</span></div>';
    for (var i = 0; i < regionTeams.length - 1; i += 2) {
      var b1 = regionTeams[i], b2 = regionTeams[i + 1];
      if (!b1 || !b2) continue;
      var played = b1.score !== null && b1.score !== undefined;
      h += '<div style="border-bottom:1px solid var(--bdr);">';
      [b1, b2].forEach(function(b) {
        var isu = b.team.id === G.tid;
        var st = played ? (b.won ? 'color:var(--grn2);font-weight:800;' : 'color:var(--txt3);text-decoration:line-through;') : (isu ? 'color:var(--blu);font-weight:800;' : '');
        h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;' + st + (isu && !played ? 'background:var(--blu-soft);' : '') + '">'
          + '<span style="font-family:var(--mono);font-size:10px;color:var(--txt3);width:18px;">' + b.seed + '</span>'
          + '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + b.team.name + '</span>'
          + (played ? '<span style="font-family:var(--mono);font-weight:800;">' + b.score + '</span>' : (!b.active ? '<span style="font-size:10px;color:var(--txt3);">OUT</span>' : ''))
          + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  return h + '</div>';
}
