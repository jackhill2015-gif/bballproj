// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  National Top 25 + all conference standings
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;

  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var h = '';

  // ── National Top 25 ──
  h += '<div style="margin-bottom:20px;">'
    + '<div class="sec-head">National Rankings</div>'
    + '<div class="rk-table">'
    + '<div class="rk-head"><div>RK</div><div>TEAM</div><div>CONF</div><div>RECORD</div><div>CONF</div><div>WIN%</div></div>';

  natSorted.slice(0, 25).forEach(function(t, i) {
    var isU = t.id === G.tid;
    var total = t.wins + t.loss;
    var winPct = total > 0 ? (t.wins / total * 100).toFixed(0) : '--';
    h += '<div class="rk-row' + (isU ? ' is-user' : '') + '">'
      + '<div class="rk-num">' + (i + 1) + '</div>'
      + '<div class="rk-team">' + t.name + '</div>'
      + '<div class="rk-sub">' + t.conf + '</div>'
      + '<div class="num">' + t.wins + '-' + t.loss + '</div>'
      + '<div class="num">' + t.cWins + '-' + t.cLoss + '</div>'
      + '<div class="num">' + winPct + '%</div>'
      + '</div>';
  });

  // Show user's rank if not in top 25
  var userRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  if (userRank > 25) {
    var ut = G.teams[G.tid];
    var utTotal = ut.wins + ut.loss;
    var utPct = utTotal > 0 ? (ut.wins / utTotal * 100).toFixed(0) : '--';
    h += '<div class="rk-row is-user rk-user-extra">'
      + '<div class="rk-num">' + userRank + '</div>'
      + '<div class="rk-team">' + ut.name + '</div>'
      + '<div class="rk-sub">' + ut.conf + '</div>'
      + '<div class="num">' + ut.wins + '-' + ut.loss + '</div>'
      + '<div class="num">' + ut.cWins + '-' + ut.cLoss + '</div>'
      + '<div class="num">' + utPct + '%</div>'
      + '</div>';
  }
  h += '</div></div>';

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
