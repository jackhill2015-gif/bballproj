// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/stats.js
//  League statistical leaders. Derived leaders are cached per
//  week+phase so repeated renders don't rescan ~4k players.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

var _cache = { key: '', cats: null };

var CATS = [
  { id: 'ppg', label: 'Points per game', min: 0, val: function(r) { return r.ppg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'rpg', label: 'Rebounds per game', min: 0, val: function(r) { return r.rpg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'apg', label: 'Assists per game', min: 0, val: function(r) { return r.apg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'fg', label: 'Field goal %', minFga: 10, val: function(r) { return r.fg; }, fmt: function(v) { return (v * 100).toFixed(1) + '%'; } },
  { id: 'spg', label: 'Steals per game', min: 0, val: function(r) { return r.spg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'bpg', label: 'Blocks per game', min: 0, val: function(r) { return r.bpg; }, fmt: function(v) { return v.toFixed(1); } }
];

function computeLeaders() {
  var key = G.yr + '-' + G.gi + '-' + G.phase + '-' + G.teams.length;
  if (_cache.key === key && _cache.cats) return _cache.cats;

  var players = [];
  G.teams.forEach(function(t) {
    t.rost.forEach(function(p, pi) {
      if (!(p.s.gp > 0)) return;
      players.push({
        name: p.name, pos: p.pos, cls: p.cls, team: t.name, tid: t.id, idx: pi, gp: p.s.gp,
        ppg: p.s.pts / p.s.gp,
        rpg: p.s.reb / p.s.gp,
        apg: p.s.ast / p.s.gp,
        spg: (typeof p.s.stl === 'number' ? p.s.stl : 0) / p.s.gp,
        bpg: (typeof p.s.blk === 'number' ? p.s.blk : 0) / p.s.gp,
        fg: p.s.fga > 0 ? p.s.fgm / p.s.fga : 0,
        fga: p.s.fga
      });
    });
  });

  // Top 10 per category in one pass (no full sort of ~4,700 players)
  var cats = CATS.map(function(c) {
    var top = [];
    for (var i = 0; i < players.length; i++) {
      var r = players[i];
      if (c.minFga && r.fga < c.minFga) continue;
      var v = c.val(r);
      if (top.length === 10 && v <= c.val(top[9])) continue;
      var j = top.length < 10 ? top.length : 9;
      top[j] = r;
      while (j > 0 && c.val(top[j - 1]) < v) { top[j] = top[j - 1]; top[j - 1] = r; j--; }
    }
    return { cat: c, rows: top };
  });

  _cache = { key: key, cats: cats };
  return cats;
}

export function renderStats() {
  var el = ge('stats-content');
  if (!el) return;
  var cats = computeLeaders();

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">League leaders</div>'
    + '<div class="sec-sub">Season ' + G.yr + ' · Top 10 in each category</div></div>';

  if (!cats[0].rows.length) {
    el.innerHTML = h + '<div class="empty-state">Play some games and the leaderboards will fill in.</div>';
    return;
  }

  h += '<div class="grid-2">';
  cats.forEach(function(entry) {
    h += '<div class="sec-block"><div class="card-title">' + entry.cat.label + '</div>'
      + '<div class="tbl-wrap"><table><thead><tr>'
      + '<th style="width:36px;">RK</th><th>Player</th><th>Team</th><th style="text-align:right;">' + entry.cat.id.toUpperCase() + '</th>'
      + '</tr></thead><tbody>';
    entry.rows.forEach(function(r, i) {
      var isU = r.tid === G.tid;
      h += '<tr' + (isU ? ' class="hl"' : '') + '>'
        + '<td style="color:var(--txt3);font-family:var(--mono);">' + (i + 1) + '</td>'
        + '<td style="font-weight:600;' + (isU ? 'color:var(--blu);' : '') + '"><span class="pname" data-action="player" data-player="' + r.tid + ':' + r.idx + '" role="button" tabindex="0">' + r.name + '</span>'
        + ' <span style="font-weight:400;color:var(--txt3);font-size:11px;">' + r.pos + ' · ' + r.cls + '</span></td>'
        + '<td style="color:var(--txt3);font-size:12px;">' + r.team + '</td>'
        + '<td style="text-align:right;font-family:var(--mono);font-weight:800;">' + entry.cat.fmt(entry.cat.val(r)) + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  });
  h += '</div>';
  el.innerHTML = h;
}
