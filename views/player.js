// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/player.js
//  Player profile overlay.
//
//  CLICK CONVENTION (shared with Claude — apply the same attribute on
//  portal / recruiting / dashboard screens):
//    Preferred:  <span class="pname" data-action="player"
//                  data-player="<tid>:<roster index>"
//                  role="button" tabindex="0">Name</span>
//    Fallback (no roster index handy, e.g. awards/history):
//                <span class="pname" data-action="player"
//                  data-player-name="Full Name" data-tid="<tid>"
//                  role="button" tabindex="0">Name</span>
//  ui.js handleAction has a single 'player' case that reads
//  data-player first, then data-player-name + data-tid, and calls
//  openPlayerProfile(tid, idxOrName). The profile opens in the
//  generic sheet (views/sheet.js), closed via Close / Escape / backdrop.
//  "tid" is the team id (G.teams[tid]); index is the roster slot.
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { openSheet } from './sheet.js';
import { playerType, strengthsAndWeaknesses } from './scouting.js';
import { playerFaceHTML } from './faces.js';

var RATING_LABELS = [
  ['sht', 'Shooting'],
  ['fin', 'Finishing'],
  ['def', 'Defense'],
  ['reb', 'Rebounding'],
  ['ply', 'Playmaking']
];

// p.h row layout (season.js): [yr, tid, ovr, gp, pts, reb, ast, stl, blk]
function perGame(tot, gp) {
  if (!(gp > 0)) return '—';
  return (tot / gp).toFixed(1);
}

function resolvePlayer(tid, idxOrName) {
  var t = G.teams[tid];
  if (!t || !t.rost) return { gone: true };
  var p = null;
  if (idxOrName !== null && idxOrName !== undefined && idxOrName !== '') {
    var i = parseInt(idxOrName, 10);
    if (!isNaN(i) && t.rost[i]) p = t.rost[i];
  }
  if (!p && typeof idxOrName === 'string' && idxOrName) {
    for (var k = 0; k < t.rost.length; k++) {
      if (t.rost[k].name === idxOrName) { p = t.rost[k]; break; }
    }
  }
  if (!p) return { gone: true };
  return { team: t, player: p };
}

function statStrip(cells) {
  var h = '<div class="stat-strip" style="grid-template-columns:repeat(' + cells.length + ',1fr);">';
  cells.forEach(function(c) {
    h += '<div class="stat-cell"><div class="sv">' + c.v + '</div><div class="sl">' + c.l + '</div></div>';
  });
  return h + '</div>';
}

function profileHTML(t, p) {
  var cls = p.cls + (p.rsUsed ? ' (RS)' : '');
  var sub = p.pos + ' · ' + cls + ' · ' + t.name
    + (p.rs ? ' · <span class="tag t-home">Redshirting</span>' : '');
  var h = '<div class="pf-top pf-with-face">' + playerFaceHTML(p, t.name)
    + '<div><div class="pf-name">' + p.name + '</div>'
    + '<div class="pf-sub">' + sub + '</div>'
    + '<div class="pf-ovr"><b>' + p.ovr + '</b> OVR <span class="dim">· ' + (p.pot || p.ovr) + ' POT</span></div></div></div>';

  // Player type + strengths/weaknesses (views/scouting.js, read-only)
  var sw = strengthsAndWeaknesses(p);
  var swTags = sw.strengths.map(function(s) { return '<span class="sc-tag up">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>'; }).join('')
    + sw.weaknesses.map(function(s) { return '<span class="sc-tag dn">Weak ' + s + '</span>'; }).join('');
  h += '<div class="scout-type">' + playerType(p) + '</div>'
    + '<div class="scout-tags">' + (swTags || '<span class="sc-tag">No standout skills or holes</span>') + '</div>';

  // Ratings (bar rows — same .sc-bar markup as views/scouting.js scoutingHTML)
  var bars = '';
  RATING_LABELS.forEach(function(r) {
    var v = typeof p[r[0]] === 'number' ? p[r[0]] : 0;
    var w = Math.max(4, Math.min(100, (v - 35) / 64 * 100));
    var col = v >= 85 ? 'var(--grn2)' : v >= 70 ? 'var(--blu)' : v >= 58 ? 'var(--txt3)' : 'var(--red)';
    bars += '<div class="sc-bar"><span class="sc-bl">' + r[1] + '</span>'
      + '<span class="sc-track"><span style="width:' + w + '%;background:' + col + ';"></span></span><b>' + v + '</b></div>';
  });
  h += '<div class="panel"><div class="panel-h"><span>Ratings</span></div><div class="panel-b">' + bars + '</div></div>';

  // Current season per-game
  var s = p.s || {};
  var gp = s.gp || 0;
  h += '<div class="panel"><div class="panel-h"><span>This season</span><small>' + G.yr + '</small></div>'
    + '<div class="panel-b">' + statStrip([
      { l: 'GP', v: gp },
      { l: 'PPG', v: perGame(s.pts || 0, gp) },
      { l: 'RPG', v: perGame(s.reb || 0, gp) },
      { l: 'APG', v: perGame(s.ast || 0, gp) },
      { l: 'SPG', v: perGame(s.stl || 0, gp) },
      { l: 'BPG', v: perGame(s.blk || 0, gp) }
    ]) + '</div></div>';

  // Career, season by season (from p.h)
  var rows = (p.h || []).slice().sort(function(a, b) { return b[0] - a[0]; });
  h += '<div class="panel"><div class="panel-h"><span>Career</span></div><div class="panel-b flush">';
  if (!rows.length) {
    h += '<div class="empty-state">No completed seasons yet.</div>';
  } else {
    h += '<div class="tbl-wrap"><table><thead><tr><th>Year</th><th>School</th>'
      + '<th class="num">OVR</th><th class="num">GP</th><th class="num">PPG</th>'
      + '<th class="num">RPG</th><th class="num">APG</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      var st = G.teams[r[1]];
      h += '<tr><td>' + r[0] + '</td><td>' + (st ? st.name : '—') + '</td>'
        + '<td class="num">' + r[2] + '</td><td class="num">' + r[3] + '</td>'
        + '<td class="num">' + perGame(r[4], r[3]) + '</td>'
        + '<td class="num">' + perGame(r[5], r[3]) + '</td>'
        + '<td class="num">' + perGame(r[6], r[3]) + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div></div>';

  // Awards
  var aw = p.aw || [];
  h += '<div class="panel"><div class="panel-h"><span>Awards</span></div><div class="panel-b flush">';
  if (!aw.length) {
    h += '<div class="empty-state">No awards yet.</div>';
  } else {
    h += '<div class="tbl-wrap"><table><tbody>';
    aw.forEach(function(a) {
      h += '<tr><td class="tname">' + a + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div></div>';
  return h;
}

export function openPlayerProfile(tid, idxOrName) {
  var r = resolvePlayer(tid, idxOrName);
  if (r.gone) {
    openSheet('<div class="empty-state">That player is no longer in the league.</div>', 'Player');
    return;
  }
  openSheet(profileHTML(r.team, r.player), r.player.name);
}

// Called from ui.js handleAction 'player' case.
export function openPlayerFromEl(el) {
  var pv = el.getAttribute('data-player');
  if (pv) {
    var parts = pv.split(':');
    openPlayerProfile(parts[0], parts[1]);
  } else {
    openPlayerProfile(el.getAttribute('data-tid'), el.getAttribute('data-player-name'));
  }
}
