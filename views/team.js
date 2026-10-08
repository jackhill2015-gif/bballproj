// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/team.js
//  Team page overlay + game detail sheet.
//
//  CLICK CONVENTION (mirrors views/player.js):
//    <span class="tname-link" data-action="team" data-tid="<tid>"
//      role="button" tabindex="0">Name</span>
//  ui.js handleAction has a single 'team' case that reads data-tid
//  and calls openTeamPage(tid). The page opens in the generic
//  sheet (views/sheet.js), closed via Close / Escape / backdrop.
//  "tid" is the team id (G.teams[tid]).
//
//  GAME DETAIL (from the schedule):
//    <div class="sched-row ..." data-action="game" data-week="<w]">
//  ui.js handleAction has a single 'game' case that reads data-week
//  and calls openGameDetail(week) against the user's schedule.
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { pollRank } from '../poll.js';
import { fmtScore } from '../utils.js';
import { openSheet } from './sheet.js';
import { playerType } from './scouting.js';
import { playerFaceSmallHTML } from './faces.js';

function esc(s) {
  return String(s).replace(/"/g, '&quot;');
}

// Team name link (same shape as the player pLink convention).
export function teamLink(tid, name) {
  return '<span class="tname-link" data-action="team" data-tid="' + tid
    + '" role="button" tabindex="0">' + name + '</span>';
}

function playerLink(tid, idx, name) {
  return '<span class="pname" data-action="player" data-player="' + tid + ':' + idx
    + '" role="button" tabindex="0">' + name + '</span>';
}

// Top 25 rank (poll.js), 0 when unranked
function natRank(tid) { return pollRank(tid); }

function coachName(t) {
  if (t.coach && (t.coach.firstName || t.coach.lastName)) {
    return (t.coach.firstName + ' ' + t.coach.lastName).trim();
  }
  return '—';
}

function statStrip(cells) {
  var h = '<div class="stat-strip" style="grid-template-columns:repeat(' + cells.length + ',1fr);">';
  cells.forEach(function(c) {
    h += '<div class="stat-cell"><div class="sv">' + c.v + '</div><div class="sl">' + c.l + '</div></div>';
  });
  return h + '</div>';
}

// Top N scorers by points per game from current-season stats (p.s).
function teamLeaders(t, n) {
  var rows = [];
  (t.rost || []).forEach(function(p, pi) {
    if (p.s && p.s.gp > 0) rows.push({ p: p, pi: pi, ppg: p.s.pts / p.s.gp });
  });
  rows.sort(function(a, b) { return b.ppg - a.ppg; });
  return rows.slice(0, n || 3);
}

function teamHTML(t) {
  var rank = natRank(t.id);
  var h = '<div class="pf-top"><div class="pf-name">' + t.name + '</div>'
    + '<div class="pf-sub">' + t.conf + ' · Coach ' + esc(coachName(t)) + '</div></div>';

  h += statStrip([
    { v: t.wins + '-' + t.loss, l: 'Overall' },
    { v: (t.cWins || 0) + '-' + (t.cLoss || 0), l: 'Conference' },
    { v: rank > 0 ? '#' + rank : 'NR', l: 'Top 25' },
    { v: Math.round(t.schoolPrestige || 50), l: 'Prestige' }
  ]);

  // Roster
  h += '<div class="sec-head" style="margin-top:14px;">Roster</div>';
  var rost = t.rost || [];
  if (!rost.length) {
    h += '<div class="empty-state">No roster data.</div>';
  } else {
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Pos</th><th>Class</th>'
      + '<th class="num">OVR</th><th>Type</th></tr></thead><tbody>';
    rost.forEach(function(p, pi) {
      h += '<tr><td>' + playerLink(t.id, pi, p.name) + '</td>'
        + '<td>' + p.pos + '</td><td>' + p.cls + '</td>'
        + '<td class="num"><b>' + p.ovr + '</b></td>'
        + '<td style="color:var(--txt3);font-size:12px;">' + playerType(p) + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }

  // Season results
  h += '<div class="sec-head" style="margin-top:14px;">Results</div>';
  var games = (t.sched || []).map(function(g, w) { return { g: g, w: w }; })
    .filter(function(x) { return x.g && x.g.played && x.g.opp !== undefined && x.g.opp !== null && G.teams[x.g.opp]; });
  if (!games.length) {
    h += '<div class="empty-state">No games played yet.</div>';
  } else {
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Wk</th><th>Opponent</th>'
      + '<th></th><th class="num">Score</th></tr></thead><tbody>';
    games.forEach(function(x) {
      var g = x.g, opp = G.teams[g.opp];
      var win = g.uScore > g.oScore;
      h += '<tr><td class="num">' + (x.w + 1) + '</td>'
        + '<td>' + (g.home ? 'vs ' : 'at ') + teamLink(opp.id, opp.name) + '</td>'
        + '<td><span class="badge ' + (win ? 'w' : 'l') + '">' + (win ? 'W' : 'L') + '</span></td>'
        + '<td class="num">' + fmtScore(g.uScore, g.oScore) + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  return h;
}

export function openTeamPage(tid) {
  var t = G.teams[tid];
  if (!t) {
    openSheet('<div class="empty-state">That team is no longer in the league.</div>', 'Team');
    return;
  }
  openSheet(teamHTML(t), t.name);
}

// Called from ui.js handleAction 'team' case.
export function openTeamFromEl(el) {
  openTeamPage(el.getAttribute('data-tid'));
}

// ── Game detail sheet (from the schedule) ──
// Schedule entries store {opp, home, conf, played, uScore, oScore} —
// no per-game player lines, so the sheet shows the final plus each
// team's current season scoring leaders instead of a box score.
function leaderRows(t) {
  var ls = teamLeaders(t, 3);
  if (!ls.length) return '<div class="empty-state">No stats yet.</div>';
  var h = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th class="num">PPG</th></tr></thead><tbody>';
  ls.forEach(function(r) {
    h += '<tr><td>' + playerFaceSmallHTML(r.p, t.name) + playerLink(t.id, r.pi, r.p.name) + '</td>'
      + '<td class="num">' + r.ppg.toFixed(1) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}

export function openGameDetail(week) {
  var me = G.teams[G.tid];
  var g = me && me.sched ? me.sched[week] : null;
  var opp = g ? G.teams[g.opp] : null;
  if (!g || !g.played || !opp) {
    openSheet('<div class="empty-state">No result for that game yet.</div>', 'Game');
    return;
  }
  var win = g.uScore > g.oScore;
  var h = '<div style="text-align:center;margin-bottom:12px;">'
    + '<div style="font-size:13px;color:var(--txt3);">Week ' + (week + 1) + ' · ' + (g.home ? 'Home' : 'Away')
    + (g.conf ? ' · ' + me.conf : '') + '</div>'
    + '<div style="font-size:26px;font-weight:800;margin:6px 0;font-family:var(--mono);">'
    + fmtScore(g.uScore, g.oScore) + '</div>'
    + '<div><span class="badge ' + (win ? 'w' : 'l') + '">' + (win ? 'W' : 'L') + '</span>'
    + ' <span style="font-weight:700;">' + me.name + '</span>'
    + ' <span style="color:var(--txt3);">vs</span> '
    + teamLink(opp.id, opp.name) + '</div></div>';

  if (g.box) {
    // Box score saved with the game (season.js recordResult): [name, pos, pts, reb, ast, stl, blk]
    // Look up class year from the roster so the face seed matches the player's other faces.
    var faceFor = function(team, name) {
      var found = null;
      (team.rost || []).forEach(function(pl) { if (pl.name === name) found = pl; });
      return playerFaceSmallHTML(found || { name: name, cls: 'HS' }, team.name);
    };
    var boxTbl = function(team, rows) {
      var t = '<div class="sec-head" style="margin-top:10px;">' + team.name + '</div><div class="tbl-wrap"><table><thead><tr>'
        + '<th>Player</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th><th class="num">STL</th><th class="num">BLK</th></tr></thead><tbody>';
      rows.forEach(function(r) {
        t += '<tr><td>' + faceFor(team, r[0]) + esc(r[0]) + ' <span style="color:var(--txt3);font-size:11px;">' + r[1] + '</span></td>'
          + '<td class="num"><b>' + r[2] + '</b></td><td class="num">' + r[3] + '</td><td class="num">' + r[4] + '</td><td class="num">' + r[5] + '</td><td class="num">' + r[6] + '</td></tr>';
      });
      return t + '</tbody></table></div>';
    };
    h += boxTbl(me, g.box.u || []) + boxTbl(opp, g.box.o || []);
  } else {
    h += '<div class="sec-head">' + me.name + ' leaders</div>' + leaderRows(me);
    h += '<div class="sec-head" style="margin-top:14px;">' + opp.name + ' leaders</div>' + leaderRows(opp);
    h += '<div style="font-size:12px;color:var(--txt3);margin-top:10px;">Season scoring leaders. Box scores are saved for games played from now on.</div>';
  }
  openSheet(h, 'Game detail');
}

// Called from ui.js handleAction 'game' case.
export function openGameDetailFromEl(el) {
  openGameDetail(parseInt(el.getAttribute('data-week'), 10));
}
