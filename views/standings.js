// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  Two tabs: national Top 25, and one conference at a time
//  (yours by default, any other from the dropdown)
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';
import { pollTeams, pollRank, pollPrevRank, receivingVotes, pollLabel } from '../poll.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

// Team name link (same shape as the player pLink convention).
function tLink(tid, name) {
  return '<span class="tname-link" data-action="team" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

// Movement since the previous poll (poll.js keeps last poll's 25)
function moveCell(tid, rank) {
  if (!G.poll || G.poll.kind === 'pre') return '<span style="color:var(--txt3);">–</span>';
  var prev = pollPrevRank(tid);
  if (!prev) return '<span class="mv-new">New</span>';
  var d = prev - rank;
  if (d > 0) return '<span class="mv-up">▲' + d + '</span>';
  if (d < 0) return '<span class="mv-dn">▼' + (-d) + '</span>';
  return '<span style="color:var(--txt3);">–</span>';
}

// Tab + conference persist across visits via ui-prefs (localStorage only).
// A stored conference that no longer exists falls back to yours in confHTML.
var _prefs = getUiPrefs('rankings');
var _tab = _prefs.tab, _conf = _prefs.conf;

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;

  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var h = '<div class="fbar" style="margin-bottom:12px;">'
    + '<button class="fchip' + (_tab === 'nat' ? ' on' : '') + '" data-stab="nat">Top 25</button>'
    + '<button class="fchip' + (_tab === 'conf' ? ' on' : '') + '" data-stab="conf">Conference standings</button></div>';
  if (_tab === 'conf') { el.innerHTML = h + confHTML(natSorted); bindStandings(el); return; }

  // ── National Top 25: the voters' poll (poll.js). NET = efficiency rank,
  // what the NCAA committee seeds on (ratings.js). ──
  var netRank = {};
  natSorted.forEach(function(t, i) { netRank[t.id] = i + 1; });
  h += '<div style="margin-bottom:16px;">'
    + '<div class="sec-head">Top 25</div>'
    + '<div class="sec-sub">' + pollLabel() + '. Voted every other week; arrows show movement since the last poll. NET is the efficiency rank the NCAA committee seeds on.</div>'
    + '<div class="tbl-wrap"><table class="tbl stbl">'
    + '<thead><tr><th>#</th><th>Team</th><th>Conf</th><th class="num">Record</th><th class="num" title="Efficiency (NET-style) rank">NET</th><th class="num">Chg</th></tr></thead><tbody>';

  function row(t, rk, extra) {
    var isU = t.id === G.tid;
    return '<tr class="' + (isU ? 'hl' : '') + (extra ? ' user-extra' : '') + '">'
      + '<td class="num rk">' + (rk || '–') + '</td>'
      + '<td class="tname' + (isU ? ' u' : '') + '">' + tLink(t.id, t.name) + '</td>'
      + '<td class="dim">' + t.conf + '</td>'
      + '<td class="num">' + t.wins + '-' + t.loss + '</td>'
      + '<td class="num dim">' + netRank[t.id] + '</td>'
      + '<td class="num">' + (rk ? moveCell(t.id, rk) : '') + '</td>'
      + '</tr>';
  }
  pollTeams().forEach(function(t, i) { h += row(t, i + 1, false); });
  // Your team below the poll when unranked
  if (!pollRank(G.tid)) h += row(G.teams[G.tid], 0, true);
  h += '</tbody></table></div>';
  var rv = receivingVotes();
  if (rv.length) {
    h += '<div class="rv-line"><b>Others receiving votes:</b> ' + rv.map(function(t) {
      return '<span class="' + (t.id === G.tid ? 'rv-u' : '') + '">' + tLink(t.id, t.name) + ' ' + t.wins + '-' + t.loss + '</span>';
    }).join(', ') + '.</div>';
  }
  h += '</div>';


  el.innerHTML = h;
  bindStandings(el);
}


function bindStandings(el) {
  el.onclick = function(e) {
    var b = e.target.closest && e.target.closest('[data-stab]');
    if (b) { _tab = b.getAttribute('data-stab'); setUiPrefs('rankings', { tab: _tab, conf: _conf }); renderStandings(); }
  };
  el.onchange = function(e) {
    if (e.target && e.target.id === 'conf-pick') { _conf = e.target.value; setUiPrefs('rankings', { tab: _tab, conf: _conf }); renderStandings(); }
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
  h += '<div class="tbl-wrap"><table class="tbl stbl"><thead><tr><th>#</th><th>Team</th><th class="num">Conf</th><th class="num" title="Games behind">GB</th><th class="num">Overall</th><th class="num" title="Efficiency (NET-style) rank">NET</th></tr></thead><tbody>';
  teams.forEach(function(t, i) {
    var isU = t.id === G.tid;
    var gb = lead ? ((lead.cWins - t.cWins) + (t.cLoss - lead.cLoss)) / 2 : 0;
    h += '<tr' + (isU ? ' class="hl"' : '') + '>'
      + '<td class="num rk">' + (i + 1) + '</td>'
      + '<td class="tname' + (isU ? ' u' : '') + '">' + (pollRank(t.id) ? '<span class="rk-tag">' + pollRank(t.id) + '</span>' : '') + tLink(t.id, t.name) + '</td>'
      + '<td class="num">' + t.cWins + '-' + t.cLoss + '</td>'
      + '<td class="num dim">' + (gb <= 0 ? '–' : (gb % 1 ? gb.toFixed(1) : gb)) + '</td>'
      + '<td class="num">' + t.wins + '-' + t.loss + '</td>'
      + '<td class="num dim">' + rankOf[t.id] + '</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
