// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  Roster / depth chart view with editable minutes.
// ═══════════════════════════════════════════════════════════

import { ge, txt, clamp } from '../utils.js';
import { G, saveState } from '../state.js';

// ── Roster View ──────────────────────────────────────────
export function renderRoster() {
  var t = G.teams[G.tid];
  var sorted = t.rost.slice().sort(function(a, b) { return b.mins - a.mins; });
  var starters = sorted.filter(function(p) { return p.mins >= 20; });
  var bench = sorted.filter(function(p) { return p.mins > 0 && p.mins < 20; });
  var total = t.rost.reduce(function(a, b) { return a + b.mins; }, 0);
  txt('roster-mins-total', 'Total mins: ' + total + '/200');

  function makeRow(p) {
    var div = document.createElement('div');
    div.className = 'player-row-edit';
    var gp = p.s.gp || 0;
    var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
    div.innerHTML = '<div class="pos-chip">' + p.pos + '</div>'
      + '<div class="player-name">' + p.name + ' <span style="font-size:10px;color:var(--txt3);">' + p.cls + '</span></div>'
      + '<div style="font-size:10px;color:var(--txt2);font-family:monospace;margin-right:6px;">' + ppg + ' PPG</div>'
      + '<div class="player-ovr">' + p.ovr + '</div>'
      + '<input class="mins-input" type="number" min="0" max="40" value="' + p.mins + '" data-pid="' + p.id + '" oninput="updateMins(this)">'
      + '<div style="font-size:9px;font-weight:700;color:' + (p.mins >= 20 ? 'var(--grn2)' : 'var(--txt3)') + ';width:44px;text-align:center;">' + (p.mins >= 20 ? 'START' : 'BENCH') + '</div>';
    return div;
  }

  var sc = ge('roster-starters');
  sc.innerHTML = '';
  starters.forEach(function(p) { sc.appendChild(makeRow(p)); });

  var bc = ge('roster-bench');
  bc.innerHTML = '';
  bench.forEach(function(p) { bc.appendChild(makeRow(p)); });
}

// ── Minutes Editor ───────────────────────────────────────
export function updateMins(input) {
  var pid = parseInt(input.getAttribute('data-pid'));
  var val = clamp(parseInt(input.value) || 0, 0, 40);
  input.value = val;
  var t = G.teams[G.tid];
  var p = t.rost.find(function(x) { return x.id === pid; });
  if (p) p.mins = val;
  var total = t.rost.reduce(function(a, b) { return a + b.mins; }, 0);
  txt('roster-mins-total', 'Total mins: ' + total + '/200' + (total !== 200 ? ' \u26a0' : ''));
  saveState();
}
