// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/stats.js
//  League statistical leaders: PPG, RPG, APG, FG%.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

export function renderStats() {
  var players = [];
  G.teams.forEach(function(t) {
    t.rost.forEach(function(p) {
      if (p.s.gp > 0) players.push({
        p: p, team: t.name, tid: t.id, gp: p.s.gp,
        ppg: p.s.pts / p.s.gp,
        rpg: p.s.reb / p.s.gp,
        apg: p.s.ast / p.s.gp,
        spg: (typeof p.s.stl === 'number' ? p.s.stl : 0) / p.s.gp,
        bpg: (typeof p.s.blk === 'number' ? p.s.blk : 0) / p.s.gp,
        fg: p.s.fga > 0 ? p.s.fgm / p.s.fga : 0
      });
    });
  });

  function makeTable(id, arr, key, fmt) {
    var tb = ge(id);
    if (!tb) return;
    tb.innerHTML = '';
    arr.sort(function(a, b) { return b[key] - a[key]; }).slice(0, 10).forEach(function(r, i) {
      var tr = document.createElement('tr');
      var isU = r.tid === G.tid;
      if (isU) tr.className = 'hl';
      tr.innerHTML = '<td style="color:var(--txt3);font-family:monospace;">' + (i + 1) + '</td>'
        + '<td style="font-weight:600;color:' + (isU ? 'var(--red)' : '#fff') + ';">' + r.p.name + '</td>'
        + '<td style="color:var(--txt3);font-size:11px;">' + r.team + '</td>'
        + '<td style="text-align:right;font-family:monospace;font-weight:700;">' + fmt(r[key]) + '</td>';
      tb.appendChild(tr);
    });
    if (!arr.length) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="color:var(--txt3);padding:12px;">Play more games to see leaders.</td>';
      tb.appendChild(tr);
    }
  }

  makeTable('stats-ppg', players.slice(), 'ppg', function(v) { return v.toFixed(1); });
  makeTable('stats-rpg', players.slice(), 'rpg', function(v) { return v.toFixed(1); });
  makeTable('stats-apg', players.slice(), 'apg', function(v) { return v.toFixed(1); });
  makeTable('stats-fg', players.filter(function(r) { return r.p.s.fga > 10; }), 'fg', function(v) { return (v * 100).toFixed(1) + '%'; });
  makeTable('stats-spg', players.slice(), 'spg', function(v) { return v.toFixed(1); });
  makeTable('stats-bpg', players.slice(), 'bpg', function(v) { return v.toFixed(1); });
}
