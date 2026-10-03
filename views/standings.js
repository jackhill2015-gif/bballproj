// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  Two tabs: national Top 25, and one conference at a time
//  (yours by default, any other from the dropdown)
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

var _tab = 'nat', _conf = null;

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;

  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var h = '<div class="fbar" style="margin-bottom:12px;">'
    + '<button class="fchip' + (_tab === 'nat' ? ' on' : '') + '" data-stab="nat">National top 25</button>'
    + '<button class="fchip' + (_tab === 'conf' ? ' on' : '') + '" data-stab="conf">Conference standings</button></div>';
  if (_tab === 'conf') { el.innerHTML = h + confHTML(natSorted); bindStandings(el); return; }

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

  el.innerHTML = h;
  bindStandings(el);
}


function bindStandings(el) {
  el.onclick = function(e) {
    var b = e.target.closest && e.target.closest('[data-stab]');
    if (b) { _tab = b.getAttribute('data-stab'); renderStandings(); }
  };
  el.onchange = function(e) {
    if (e.target && e.target.id === 'conf-pick') { _conf = e.target.value; renderStandings(); }
  };
}

function confHTML(natSorted) {
  var rankOf = {};
  natSorted.forEach(function(t, i) { rankOf[t.id] = i + 1; });
  var confs = {};
  G.teams.forEach(function(t) { if (!confs[t.conf]) confs[t.conf] = []; confs[t.conf].push(t); });
  var power = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var names = Object.keys(confs).sort(function(a, b) {
    var ai = power.indexOf(a), bi = power.indexOf(b);
    if (ai < 0) ai = 99; if (bi < 0) bi = 99;
    return ai - bi || a.localeCompare(b);
  });
  var userConf = G.teams[G.tid].conf;
  if (!_conf || !confs[_conf]) _conf = userConf;

  var h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
    + '<label for="conf-pick" style="font-size:12.5px;color:var(--txt3);">Conference</label>'
    + '<select id="conf-pick" class="sel">';
  names.forEach(function(c) {
    h += '<option value="' + c + '"' + (c === _conf ? ' selected' : '') + '>' + c + (c === userConf ? ' (yours)' : '') + '</option>';
  });
  h += '</select></div>';

  var confPct = function(t) { var g = t.cWins + t.cLoss; return g > 0 ? t.cWins / g : 0; };
  var teams = confs[_conf].slice().sort(function(a, b) { return confPct(b) - confPct(a) || b.cWins - a.cWins || b.pts - a.pts; });
  var lead = teams.length ? teams[0] : null;
  h += '<div class="tbl-wrap"><table class="tbl stbl"><thead><tr><th>#</th><th>Team</th><th class="num">Conf</th><th class="num">GB</th><th class="num">Overall</th><th class="num">Natl</th></tr></thead><tbody>';
  teams.forEach(function(t, i) {
    var isU = t.id === G.tid;
    var gb = lead ? ((lead.cWins - t.cWins) + (t.cLoss - lead.cLoss)) / 2 : 0;
    h += '<tr' + (isU ? ' class="hl"' : '') + '>'
      + '<td class="num rk">' + (i + 1) + '</td>'
      + '<td class="tname' + (isU ? ' u' : '') + '">' + t.name + '</td>'
      + '<td class="num">' + t.cWins + '-' + t.cLoss + '</td>'
      + '<td class="num dim">' + (gb <= 0 ? '–' : (gb % 1 ? gb.toFixed(1) : gb)) + '</td>'
      + '<td class="num">' + t.wins + '-' + t.loss + '</td>'
      + '<td class="num dim">' + rankOf[t.id] + '</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
