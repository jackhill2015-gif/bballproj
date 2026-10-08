// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/stats.js
//  League statistical leaders. Derived leaders are cached per
//  week+phase so repeated renders don't rescan ~4k players.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';
import { poyRace, poyUserBest } from './dashboard.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

// One leaderboard at a time, picked from a row of category chips.
// Category persists across visits via ui-prefs (localStorage only).
var _statCat = getUiPrefs('stats').category;

var _cache = { key: '', cats: null };

var CATS = [
  { id: 'ppg', label: 'Points per game', min: 0, val: function(r) { return r.ppg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'rpg', label: 'Rebounds per game', min: 0, val: function(r) { return r.rpg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'apg', label: 'Assists per game', min: 0, val: function(r) { return r.apg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'fg', label: 'Field goal %', minFga: 1, val: function(r) { return r.fg; }, fmt: function(v) { return (v * 100).toFixed(1) + '%'; } },
  { id: 'spg', label: 'Steals per game', min: 0, val: function(r) { return r.spg; }, fmt: function(v) { return v.toFixed(1); } },
  { id: 'bpg', label: 'Blocks per game', min: 0, val: function(r) { return r.bpg; }, fmt: function(v) { return v.toFixed(1); } }
];

function computeLeaders() {
  var key = G.yr + '-' + G.gi + '-' + G.phase + '-' + G.teams.length;
  if (_cache.key === key && _cache.cats) return _cache.cats;
  _cache = { key: '', cats: null };

  // Qualified: played in 75% of the games (the NCAA's rule), so a hot
  // first week or a player who barely plays can't top the list
  var maxGp = 0;
  G.teams.forEach(function(t) { t.rost.forEach(function(p) { if ((p.s.gp || 0) > maxGp) maxGp = p.s.gp; }); });
  var minGp = Math.max(1, Math.ceil(maxGp * 0.75));
  var players = [];
  G.teams.forEach(function(t) {
    t.rost.forEach(function(p, pi) {
      if (!(p.s.gp >= minGp)) return;
      players.push({
        name: p.name, pos: p.pos, cls: p.cls, team: t.name, tid: t.id, idx: pi, gp: p.s.gp,
        ppg: p.s.pts / p.s.gp,
        rpg: p.s.reb / p.s.gp,
        apg: p.s.ast / p.s.gp,
        spg: (typeof p.s.stl === 'number' ? p.s.stl : 0) / p.s.gp,
        bpg: (typeof p.s.blk === 'number' ? p.s.blk : 0) / p.s.gp,
        fg: p.s.fga > 0 ? p.s.fgm / p.s.fga : 0,
        // FG% needs 4 attempts a game to qualify
        fga: p.s.fga >= 4 * p.s.gp ? p.s.fga : 0
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
    // your best player in this category, with his national rank
    var mine = null, rank = 0;
    players.forEach(function(r) {
      if (r.tid !== G.tid || (c.minFga && r.fga < c.minFga)) return;
      if (!mine || c.val(r) > c.val(mine)) mine = r;
    });
    if (mine) {
      var mv = c.val(mine);
      rank = 1;
      players.forEach(function(r) { if (!(c.minFga && r.fga < c.minFga) && c.val(r) > mv) rank++; });
    }
    return { cat: c, rows: top, mine: mine, mineRank: rank };
  });
  var n20 = players.filter(function(r) { return r.ppg >= 20; }).length;

  _cache = { key: key, cats: cats, minGp: minGp, n20: n20 };
  return cats;
}

export function renderStats() {
  var el = ge('stats-content');
  if (!el) return;
  var cats = computeLeaders();

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">League leaders</div>'
    + '<div class="sec-sub">Season ' + G.yr + ' · Top 10 · at least ' + (_cache.minGp || 1) + ' game' + ((_cache.minGp || 1) === 1 ? '' : 's') + ' played</div></div>';

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

  // sub: a second line under the name (team, record)
  function nameCell(r, sub) {
    var isU = r.tid === G.tid;
    return '<td style="font-weight:600;' + (isU ? 'color:var(--blu);' : '') + '"><span class="pname" data-action="player" '
      + (r.idx !== undefined ? 'data-player="' + r.tid + ':' + r.idx + '"' : 'data-player-name="' + String(r.name).replace(/"/g, '&quot;') + '" data-tid="' + r.tid + '"')
      + ' role="button" tabindex="0">' + r.name + '</span>'
      + ' <span style="font-weight:400;color:var(--txt3);font-size:11px;">' + r.pos + ' · ' + r.cls + '</span>'
      + (sub ? '<div style="font-weight:400;color:var(--txt3);font-size:11.5px;">' + sub + '</div>' : '') + '</td>';
  }

  if (_statCat === 'poy') {
    var race = poyRace(10), ub = poyUserBest();
    var poyRow = function(r, rk) {
      return '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '><td style="color:var(--txt3);">' + rk + '</td>'
        + nameCell(r, r.team + ' (' + r.rec + ')')
        + '<td class="num" style="font-weight:700;">' + r.ppg.toFixed(1) + '</td><td class="num">' + r.rpg.toFixed(1) + '</td><td class="num">' + r.apg.toFixed(1) + '</td></tr>';
    };
    h += '<div class="sec-block"><div class="card-title">Player of the year race</div>'
      + '<div style="font-size:12.5px;color:var(--txt2);margin-bottom:6px;">Production weighted by team success. Three games minimum.</div>'
      + '<div class="tbl-wrap"><table><thead><tr><th style="width:36px;" title="Rank">RK</th><th>Player</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th></tr></thead><tbody>';
    race.forEach(function(r, i) { h += poyRow(r, i + 1); });
    if (ub && ub.rank > race.length) h += '<tr class="sep"><td colspan="5"></td></tr>' + poyRow(ub.row, ub.rank);
    if (!race.length) h += '<tr><td colspan="5" style="color:var(--txt3);">The race starts after three games.</td></tr>';
    h += '</tbody></table></div></div>';
  } else {
    var entry = cats.filter(function(c) { return c.cat.id === _statCat; })[0] || cats[0];
    h += '<div class="sec-block"><div class="card-title">' + entry.cat.label + '</div>'
      + (entry.cat.id === 'ppg' ? '<div style="font-size:12.5px;color:var(--txt2);margin-bottom:6px;">' + _cache.n20 + ' player' + (_cache.n20 === 1 ? '' : 's') + ' averaging 20 or more.</div>' : '')
      + '<div class="tbl-wrap"><table><thead><tr>'
      + '<th style="width:36px;" title="Rank">RK</th><th>Player</th><th>Team</th><th style="text-align:right;">' + entry.cat.id.toUpperCase() + '</th>'
      + '</tr></thead><tbody>';
    entry.rows.forEach(function(r, i) {
      h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '>'
        + '<td style="color:var(--txt3);">' + (i + 1) + '</td>' + nameCell(r)
        + '<td style="color:var(--txt3);font-size:12px;">' + r.team + '</td>'
        + '<td style="text-align:right;font-weight:700;">' + entry.cat.fmt(entry.cat.val(r)) + '</td></tr>';
    });
    if (entry.mine && entry.mineRank > entry.rows.length) {
      var m = entry.mine;
      h += '<tr class="sep"><td colspan="4"></td></tr><tr class="hl"><td style="color:var(--txt3);">' + entry.mineRank + '</td>' + nameCell(m)
        + '<td style="color:var(--txt3);font-size:12px;">' + m.team + '</td>'
        + '<td style="text-align:right;font-weight:700;">' + entry.cat.fmt(entry.cat.val(m)) + '</td></tr>';
    }
    h += '</tbody></table></div></div>';
  }
  el.innerHTML = h;
  el.onclick = function(e) {
    var c = e.target.closest && e.target.closest('[data-statcat]');
    if (!c) return;
    _statCat = c.getAttribute('data-statcat');
    setUiPrefs('stats', { category: _statCat });
    renderStats();
  };
}
