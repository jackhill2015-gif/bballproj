// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/stats.js
//  League statistical leaders. Derived leaders are cached per
//  week+phase so repeated renders don't rescan ~4k players.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';
import { poyRace } from './dashboard.js';

// One leaderboard at a time, picked from a row of category chips
var _statCat = 'poy';

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
    + '<div class="sec-sub">Season ' + G.yr + ' · Top 10</div></div>';

  if (!cats[0].rows.length) {
    el.innerHTML = h + '<div class="empty-state">Play some games and the leaderboards will fill in.</div>';
    return;
  }

  h += '<div class="fbar" style="margin-bottom:10px;">'
    + '<button class="fchip' + (_statCat === 'poy' ? ' on' : '') + '" data-statcat="poy">Player of the year</button>';
  cats.forEach(function(entry) {
    h += '<button class="fchip' + (_statCat === entry.cat.id ? ' on' : '') + '" data-statcat="' + entry.cat.id + '">' + entry.cat.label.replace(' per game', '') + '</button>';
  });
  h += '</div>';

  function nameCell(r) {
    var isU = r.tid === G.tid;
    return '<td style="font-weight:600;' + (isU ? 'color:var(--blu);' : '') + '"><span class="pname" data-action="player" '
      + (r.idx !== undefined ? 'data-player="' + r.tid + ':' + r.idx + '"' : 'data-player-name="' + String(r.name).replace(/"/g, '&quot;') + '" data-tid="' + r.tid + '"')
      + ' role="button" tabindex="0">' + r.name + '</span>'
      + ' <span style="font-weight:400;color:var(--txt3);font-size:11px;">' + r.pos + ' · ' + r.cls + '</span></td>';
  }

  if (_statCat === 'poy') {
    var race = poyRace(10);
    h += '<div class="sec-block"><div class="card-title">Player of the year race</div>'
      + '<div style="font-size:12.5px;color:var(--txt2);margin-bottom:6px;">Production weighted by team success. Three games minimum.</div>'
      + '<div class="tbl-wrap"><table><thead><tr><th style="width:36px;">RK</th><th>Player</th><th>Team</th><th style="text-align:right;">PPG</th></tr></thead><tbody>';
    race.forEach(function(r, i) {
      h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '><td style="color:var(--txt3);">' + (i + 1) + '</td>' + nameCell(r)
        + '<td style="color:var(--txt3);font-size:12px;">' + r.team + '</td><td style="text-align:right;font-weight:700;">' + r.ppg.toFixed(1) + '</td></tr>';
    });
    if (!race.length) h += '<tr><td colspan="4" style="color:var(--txt3);">The race starts after three games.</td></tr>';
    h += '</tbody></table></div></div>';
  } else {
    var entry = cats.filter(function(c) { return c.cat.id === _statCat; })[0] || cats[0];
    h += '<div class="sec-block"><div class="card-title">' + entry.cat.label + '</div>'
      + '<div class="tbl-wrap"><table><thead><tr>'
      + '<th style="width:36px;">RK</th><th>Player</th><th>Team</th><th style="text-align:right;">' + entry.cat.id.toUpperCase() + '</th>'
      + '</tr></thead><tbody>';
    entry.rows.forEach(function(r, i) {
      h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '>'
        + '<td style="color:var(--txt3);">' + (i + 1) + '</td>' + nameCell(r)
        + '<td style="color:var(--txt3);font-size:12px;">' + r.team + '</td>'
        + '<td style="text-align:right;font-weight:700;">' + entry.cat.fmt(entry.cat.val(r)) + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }
  el.innerHTML = h;
  el.onclick = function(e) {
    var c = e.target.closest && e.target.closest('[data-statcat]');
    if (!c) return;
    _statCat = c.getAttribute('data-statcat');
    renderStats();
  };
}
