// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  National Top 25 + all conference standings
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

function fmtRating(t) {
  var r = typeof t.rating === 'number' ? t.rating : 0;
  return (r > 0 ? '+' : '') + r.toFixed(1);
}
function moveCell(t, rank) {
  if (!t.lastRank) return '<span style="color:var(--txt3);">–</span>';
  var d = t.lastRank - rank;
  if (d > 0) return '<span class="mv-up">▲' + d + '</span>';
  if (d < 0) return '<span class="mv-dn">▼' + (-d) + '</span>';
  return '<span style="color:var(--txt3);">–</span>';
}

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;

  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var h = '';

  // ── National Top 25 — real table (no div-grid overflow traps) ──
  h += '<div style="margin-bottom:16px;">'
    + '<div class="sec-head">National rankings</div>'
    + '<div class="sec-sub">Power rating adjusted for schedule strength. Arrows show movement since last week.</div>'
    + '<div class="tbl-wrap"><table class="tbl stbl">'
    + '<thead><tr><th>#</th><th>Team</th><th>Conf</th><th class="num">Record</th><th class="num">Rtg</th><th class="num">Chg</th></tr></thead><tbody>';

  natSorted.slice(0, 25).forEach(function(t, i) {
    var isU = t.id === G.tid;
    var total = t.wins + t.loss;
    var winPct = total > 0 ? (t.wins / total * 100).toFixed(0) : '--';
    h += '<tr' + (isU ? ' class="hl"' : '') + '>'
      + '<td class="num rk">' + (i + 1) + '</td>'
      + '<td class="tname' + (isU ? ' u' : '') + '">' + t.name + '</td>'
      + '<td class="dim">' + t.conf + '</td>'
      + '<td class="num">' + t.wins + '-' + t.loss + '</td>'
      + '<td class="num">' + fmtRating(t) + '</td>'
      + '<td class="num">' + moveCell(t, i + 1) + '</td>'
      + '</tr>';
  });

  // Show user's rank if not in top 25
  var userRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  if (userRank > 25) {
    var ut = G.teams[G.tid];
    var utTotal = ut.wins + ut.loss;
    var utPct = utTotal > 0 ? (ut.wins / utTotal * 100).toFixed(0) : '--';
    h += '<tr class="hl user-extra">'
      + '<td class="num rk">' + userRank + '</td>'
      + '<td class="tname u">' + ut.name + '</td>'
      + '<td class="dim">' + ut.conf + '</td>'
      + '<td class="num">' + ut.wins + '-' + ut.loss + '</td>'
      + '<td class="num">' + fmtRating(ut) + '</td>'
      + '<td class="num">' + moveCell(ut, userRank) + '</td>'
      + '</tr>';
  }
  h += '</tbody></table></div></div>';

  // ── Conference Standings ──
  var confs = {};
  G.teams.forEach(function(t) { if (!confs[t.conf]) confs[t.conf] = []; confs[t.conf].push(t); });
  var power = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var confNames = Object.keys(confs).sort(function(a, b) {
    var ai = power.indexOf(a), bi = power.indexOf(b);
    if (ai < 0) ai = 99; if (bi < 0) bi = 99;
    return ai - bi || a.localeCompare(b);
  });

  // User's conference first
  var userConf = G.teams[G.tid].conf;
  var sortedConfs = [userConf].concat(confNames.filter(function(c) { return c !== userConf; }));

  h += '<div class="sec-head">Conference Standings</div>';
  h += '<div class="grid-2">';

  sortedConfs.forEach(function(conf) {
    // sort by conference WIN PCT, not raw wins
    var confPct = function(t) { var g = t.cWins + t.cLoss; return g > 0 ? t.cWins / g : 0; };
    var teams = confs[conf].slice().sort(function(a, b) { return confPct(b) - confPct(a) || b.cWins - a.cWins || b.pts - a.pts; });
    var leaderWins = teams.length ? teams[0].cWins : 0;
    var isUserConf = conf === userConf;

    h += '<div class="cf-table">'
      + '<div class="cf-head">'
      + '<span class="cf-name">' + conf + '</span><span class="cf-count">' + teams.length + ' teams</span></div>';

    teams.forEach(function(t, i) {
      var isU = t.id === G.tid;
      var gb = leaderWins - t.cWins;
      h += '<div class="cf-row' + (isU ? ' is-user' : '') + '">'
        + '<div class="cf-l"><span class="cf-num">' + (i + 1) + '</span>'
        + '<span class="cf-team">' + t.name + '</span></div>'
        + '<div class="cf-r">'
        + '<span>' + t.cWins + '-' + t.cLoss + '</span>'
        + '<span class="cf-gb">' + (gb === 0 ? '-' : gb) + '</span>'
        + '</div></div>';
    });
    h += '</div>';
  });
  h += '</div>';

  el.innerHTML = h;
}
