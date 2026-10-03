// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/bracket.js
//  Tournament Hub: conference tournaments, NCAA bracket,
//  scouting, results feed, cinderella watch.
//  Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { ge, clamp, getTOvr, fmtScore } from '../utils.js';
import { G } from '../state.js';
import { allConfDone, getUserNCAAmatchup, getUserConfMatchup, getConfRoundName } from '../tournament.js';

export function renderBracket() {
  var el = ge('bracket-content');
  if (!el) return;
  var hub = bracketHubHTML();
  el.innerHTML = hub || '<div class="empty-state">Complete the regular season to unlock the bracket.</div>';
}

// Tournament hub HTML for embedding (home page auto-swaps to this in
// tournament phases). Returns '' when no tournament is active.
export function bracketHubHTML() {
  if (G.phase === 'conf_tourn' && G.confTourneys) return renderConfHub();
  if ((G.phase === 'ncaa' || (G.bracket && G.bracket.length === 1)) && G.bracket && G.bracket.length) return renderNCAA_Hub();
  return '';
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
    h += '<div class="sec-block" style="text-align:center;margin-top:12px;">'
      + '<div style="font-size:13px;font-weight:800;margin-bottom:10px;">All conference tournaments complete</div>'
      + '<button class="btn btn-red" data-action="build-ncaa">Selection Sunday</button>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:8px;">Use the Advance button up top to build the NCAA field.</div></div>';
  }
  return h;
}

function matchupMini(t1, t2, s1, s2, winner, seeds) {
  var played = winner !== null && winner !== undefined;
  var h = '<div class="br-mini">';
  [{ t: t1, s: s1 }, { t: t2, s: s2 }].forEach(function(e) {
    if (!e.t) return;
    var isu = e.t.id === G.tid;
    var isWin = played && winner && winner.id === e.t.id;
    var seedNum = seeds ? seeds.findIndex(function(x) { return x.id === e.t.id; }) + 1 : '';
    var cls = isu ? ' is-user' : isWin ? ' winner' : '';
    h += '<div class="br-team' + cls + '">'
      + '<span class="br-seed">' + seedNum + '</span>'
      + '<span class="br-tname">' + e.t.name + '</span>'
      + (played ? '<span class="br-score">' + e.s + '</span>' : '') + '</div>';
  });
  return h + '</div>';
}

function renderConfBracketCard(conf, ct, expanded) {
  if (!ct || !ct.rounds) return '';
  var rnames = { 1: 'R1', 2: 'QF', 3: 'SF', 4: 'FINAL' };
  var h = '<div class="br-region">'
    + '<div class="br-region-head">'
    + '<span class="br-region-name">' + conf + '</span>'
    + (ct.done && ct.champ
      ? '<span class="br-region-meta">Champ: <b>' + ct.champ.name + '</b></span>'
      : '<span class="tag t-rival">Live</span>') + '</div>';

  if (expanded) {
    h += '<div style="display:flex;overflow-x:auto;">';
    ct.rounds.forEach(function(round, ri) {
      h += '<div class="br-round-col">'
        + '<div class="br-round-name">' + (rnames[ri + 1] || 'R' + (ri + 1)) + '</div>';
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
        h += '<div class="br-result">'
          + '<span><b>' + m.winner.name + '</b> def. '
          + (m.winner.id === m.t1.id ? m.t2.name : m.t1.name) + '</span>'
          + '<span class="br-score" style="color:var(--txt3);">' + fmtScore(m.s1, m.s2, '-') + '</span></div>';
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
  return '<div class="sec-block"><div class="card-title">Your next game · ' + getConfRoundName(confMatch.ct, confMatch.conf) + '</div>'
    + '<div class="matchup-opp">' + opp.name + '</div>'
    + '<div class="matchup-meta"><span class="tag t-cf">Conf Tourney</span>'
    + '<span>OVR ' + getTOvr(opp) + ' · ' + opp.wins + '-' + opp.loss + '</span></div>'
    + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';font-weight:800;">' + wp + '%</span></div>'
    + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>'
    + '<div class="action-btns"><button class="btn btn-red btn-full" data-action="play" data-mode="quick">QUICK SIM</button>'
    + '<button class="btn btn-ghost btn-full" data-action="play" data-mode="live">LIVE SIM</button></div></div>';
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
    var h = '<div class="br-champ">'
      + '<div class="br-champ-kicker">' + G.yr + ' National Champion</div>'
      + '<div class="br-champ-team' + (isu ? ' is-user' : '') + '">' + ch.name + '</div>'
      + (isu ? '<div class="br-champ-sub">Your dynasty. Your legacy.</div>' : '')
      + '<div style="margin-top:14px;"><button class="btn btn-red" data-action="end-season">View Season Recap</button></div></div>';
    h += renderCinderellaTracker();
    h += renderResultsFeed();
    h += renderFullBracket();
    return h;
  }

  var h2 = '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">'
    + '<div><div class="sec-head" style="margin:0;">NCAA Tournament</div><div class="sec-sub" style="margin:2px 0 0;">March Madness ' + G.yr + '</div></div>'
    + '<span class="tag">' + currentRound + '</span></div></div>';

  h2 += renderCinderellaTracker();

  var um = getUserNCAAmatchup();
  if (um) {
    var uIsB1 = um.b1.team.id === G.tid;
    var ue = uIsB1 ? um.b1 : um.b2, oe = uIsB1 ? um.b2 : um.b1;
    var opp = oe.team;
    var wp = clamp(Math.round(50 + (getTOvr(ue.team) - getTOvr(opp)) * 1.3), 5, 95);
    var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
    var stars = opp.rost.filter(function(p) { return p.mins > 0; }).sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3);
    h2 += '<div class="sec-block"><div class="card-title">Scouting report · ' + currentRound + '</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;">'
      + '<div style="flex:1;min-width:0;"><div class="sc-lab">#' + ue.seed + ' seed</div>'
      + '<div class="matchup-opp" style="font-size:16px;">' + ue.team.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + ue.team.wins + '-' + ue.team.loss + ' · OVR ' + getTOvr(ue.team) + '</div></div>'
      + '<div style="font-size:11px;font-weight:800;color:var(--txt3);">VS</div>'
      + '<div style="flex:1;min-width:0;text-align:right;"><div class="sc-lab">#' + oe.seed + ' seed</div>'
      + '<div class="matchup-opp" style="font-size:16px;">' + opp.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + opp.wins + '-' + opp.loss + ' · OVR ' + getTOvr(opp) + '</div></div></div>'
      + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';font-weight:800;">' + wp + '%</span></div>'
      + '<div class="prob-bar" style="margin-bottom:8px;"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>';
    if (stars.length) {
      h2 += '<div class="card-title" style="margin-top:10px;">Players to watch</div>';
      stars.forEach(function(p) {
        var gp = p.s.gp || 1;
        h2 += '<div class="leader-row"><div class="leader-name">' + p.name
          + '<small>' + p.pos + ' · ' + p.cls + ' · OVR ' + p.ovr + '</small></div>'
          + '<div class="leader-val">' + (p.s.pts / gp).toFixed(1) + ' ppg</div></div>';
      });
    }
    h2 += '<div class="action-btns"><button class="btn btn-red btn-full" data-action="play" data-mode="quick">QUICK SIM</button>'
      + '<button class="btn btn-ghost btn-full" data-action="play" data-mode="live">LIVE SIM</button></div></div>';
  } else if (active.length > 1) {
    h2 += '<div class="sec-block" style="text-align:center;"><div style="font-size:14px;font-weight:800;margin-bottom:4px;">Your run is over.</div>'
      + '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px;">Watch the rest of the tournament unfold.</div>'
      + '<button class="btn btn-red" data-action="play" data-mode="quick">Sim Next Round</button></div>';
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

  var h = '<div class="card-title" style="margin-top:16px;">Latest Results</div>';
  results.slice(0, 8).forEach(function(r) {
    var isU = r.winner.team.id === G.tid || r.loser.team.id === G.tid;
    h += '<div class="br-result' + (isU ? ' hl-row' : '') + '">'
      + '<span><span class="br-seed">#' + r.winner.seed + '</span> <b>' + r.winner.team.name + '</b>'
      + ' <span class="br-score">' + r.winner.score + '</span>'
      + (r.isUpset ? ' <span class="tag t-rival">Upset</span>' : '') + '</span>'
      + '<span style="color:var(--txt3);"><span class="br-seed">#' + r.loser.seed + '</span> ' + r.loser.team.name
      + ' <span class="br-score">' + r.loser.score + '</span></span></div>';
  });
  return h;
}

function renderCinderellaTracker() {
  if (!G.cinderellas || !G.cinderellas.length) return '';
  var active = G.bracket.filter(function(b) { return b.active; });
  var alive = G.cinderellas.filter(function(c) {
    return active.some(function(b) { return b.team.id === c.tid; });
  });
  if (!alive.length) return '';
  var h = '<div class="sec-block"><div class="card-title">Cinderella Watch</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
  alive.forEach(function(c) {
    var isU = c.tid === G.tid;
    h += '<span class="tag' + (isU ? ' t-home' : '') + '">#' + c.seed + ' ' + c.name + '</span>';
  });
  return h + '</div></div>';
}

function renderFullBracket() {
  var regions = ['East', 'West', 'South', 'Midwest'];
  var h = '<div class="card-title" style="margin-top:16px;">Full Bracket</div><div class="grid-2">';
  for (var r = 0; r < 4; r++) {
    var regionTeams = G.bracket.slice(r * 16, r * 16 + 16);
    if (!regionTeams.length) continue;
    var alive = regionTeams.filter(function(b) { return b.active; });
    h += '<div class="br-region">'
      + '<div class="br-region-head">'
      + '<span class="br-region-name">' + regions[r] + '</span>'
      + '<span class="br-region-meta">' + (alive.length === 1 ? alive[0].team.name + ' advances' : alive.length + ' alive') + '</span></div>';
    for (var i = 0; i < regionTeams.length - 1; i += 2) {
      var b1 = regionTeams[i], b2 = regionTeams[i + 1];
      if (!b1 || !b2) continue;
      var played = b1.score !== null && b1.score !== undefined;
      h += '<div class="br-match">';
      [b1, b2].forEach(function(b) {
        var isu = b.team.id === G.tid;
        var cls = isu ? ' is-user' : played ? (b.won ? ' winner' : ' loser') : '';
        h += '<div class="br-team' + cls + '">'
          + '<span class="br-seed">' + b.seed + '</span>'
          + '<span class="br-tname">' + b.team.name + '</span>'
          + (played ? '<span class="br-score">' + b.score + '</span>' : (!b.active ? '<span class="out">Out</span>' : ''))
          + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  return h + '</div>';
}
