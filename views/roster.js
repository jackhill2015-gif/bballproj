// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  Final: drag-drop with auto-minutes, inline slider fills
// ═══════════════════════════════════════════════════════════

import { ge, clamp } from '../utils.js';
import { G, saveState } from '../state.js';

var _dragIdx = -1;

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

export function renderRoster() {
  var el = ge('roster-content');
  if (!el) return;
  var t = G.teams[G.tid];
  if (!t || !t.rost) return;

  var total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  var totalCol = total === 200 ? 'var(--grn2)' : 'var(--danger)';

  var h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
    + '<div>'
    + '<div style="font-size:22px;font-weight:900;color:var(--g900);">Depth Chart</div>'
    + '<div style="font-size:11px;color:var(--g500);margin-top:4px;">Drag to reorder \u00b7 Top 5 = Starters \u00b7 Sliders control minutes</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="text-align:right;"><div style="font-size:9px;color:var(--g400);font-weight:700;letter-spacing:.5px;text-transform:uppercase;">TOTAL MIN</div>'
    + '<div style="font-family:var(--mono);font-size:16px;font-weight:900;color:' + totalCol + ';">' + total + '/200</div></div>'
    + '<div class="btn btn-red btn-sm" onclick="autoOptimizeRoster()">AUTO SET</div>'
    + '</div></div>';

  // Column headers
  h += '<div style="display:grid;grid-template-columns:28px 36px 1fr 50px 50px 150px;align-items:center;gap:6px;padding:6px 14px;font-size:9px;font-weight:700;color:var(--g400);letter-spacing:.5px;text-transform:uppercase;border-bottom:2px solid var(--g200);">'
    + '<div></div><div>POS</div><div>PLAYER</div><div style="text-align:center;">OVR</div><div style="text-align:center;">POT</div><div style="text-align:right;padding-right:28px;">MINUTES</div></div>';

  // Player rows
  t.rost.forEach(function(p, i) {
    var tier = i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench';

    // Section headers
    if (i === 0) h += sectHead('STARTERS', 'var(--primary)');
    else if (i === 5) h += sectHead('ROTATION', 'var(--g500)');
    else if (i === 9) h += sectHead('BENCH', 'var(--g400)');

    // Stats
    var gp = p.s ? (p.s.gp || 0) : 0;
    var ppg = gp > 0 ? (p.s.pts / gp).toFixed(1) : null;
    var rpg = gp > 0 ? (p.s.reb / gp).toFixed(1) : null;
    var apg = gp > 0 ? (p.s.ast / gp).toFixed(1) : null;

    // Colors
    var stripe = tier === 'starter' ? 'var(--primary)' : tier === 'rotation' ? 'var(--accent)' : 'transparent';
    var clsBg = { FR: '#dbeafe', SO: '#f3e8ff', JR: '#ffedd5', SR: '#fce7f3' };
    var clsCol2 = { FR: '#1e40af', SO: '#6b21a8', JR: '#9a3412', SR: '#9d174d' };
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--g400)';
    var isBenched = p.mins === 0;

    // Slider fill
    var fillPct = Math.round((p.mins / 40) * 100);
    var sliderTrackCol = tier === 'starter' ? 'var(--primary)' : tier === 'rotation' ? 'var(--accent)' : 'var(--g300)';
    var sliderBg = 'linear-gradient(90deg,' + sliderTrackCol + ' 0%,' + sliderTrackCol + ' ' + fillPct + '%,var(--g200) ' + fillPct + '%)';

    h += '<div data-idx="' + i + '" '
      + 'ondragover="rosterDragOver(event)" '
      + 'ondrop="rosterDrop(event,' + i + ')" '
      + 'style="display:grid;grid-template-columns:28px 36px 1fr 50px 50px 150px;align-items:center;gap:6px;'
      + 'padding:10px 14px;border-left:3px solid ' + stripe + ';border-bottom:1px solid var(--g100);'
      + 'transition:opacity .12s,background .1s;'
      + (isBenched ? 'opacity:.45;' : '') + '" '
      + 'onmouseover="this.style.background=\'var(--g50)\'" '
      + 'onmouseout="this.style.background=\'\'">';

    // Col 1: Drag handle
    h += '<div draggable="true" ondragstart="rosterDragStart(event,' + i + ')" style="color:var(--g300);font-size:14px;cursor:grab;user-select:none;text-align:center;transition:color .1s;" onmouseover="this.style.color=\'var(--g500)\'" onmouseout="this.style.color=\'var(--g300)\'">\u2630</div>';

    // Col 2: Position chip
    var posKey = p.pos.toLowerCase();
    var posBg = { pg: '#dbeafe', sg: '#e0f2fe', sf: '#dcfce7', pf: '#ffedd5', c: '#fef3c7' };
    var posCol = { pg: '#1e40af', sg: '#0369a1', sf: '#166534', pf: '#9a3412', c: '#92400e' };
    h += '<div><span style="display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;background:' + (posBg[posKey] || 'var(--g100)') + ';color:' + (posCol[posKey] || 'var(--g500)') + ';padding:3px 0;border-radius:4px;width:32px;">' + p.pos + '</span></div>';

    // Col 3: Name + class badge + stats
    h += '<div style="min-width:0;overflow:hidden;">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:13px;font-weight:700;color:' + (isBenched ? 'var(--g400)' : 'var(--g900)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</span>'
      + '<span style="font-size:9px;font-weight:800;color:' + (clsCol2[p.cls] || '#64748b') + ';background:' + (clsBg[p.cls] || '#f1f5f9') + ';padding:1px 6px;border-radius:3px;flex-shrink:0;">' + p.cls + '</span></div>';
    if (ppg !== null) {
      h += '<div style="font-size:10px;color:var(--g400);margin-top:2px;white-space:nowrap;font-family:var(--mono);">' + ppg + ' pts \u00b7 ' + rpg + ' reb \u00b7 ' + apg + ' ast</div>';
    }
    h += '</div>';

    // Col 4: OVR
    h += '<div style="text-align:center;">'
      + '<div style="font-family:var(--mono);font-size:16px;font-weight:900;color:var(--primary);">' + p.ovr + '</div></div>';

    // Col 5: POT
    h += '<div style="text-align:center;">'
      + '<div style="font-family:var(--mono);font-size:13px;font-weight:700;color:' + potCol + ';">' + pot + '</div></div>';

    // Col 6: Slider + minutes value
    h += '<div style="display:flex;align-items:center;gap:8px;">'
      + '<input type="range" min="0" max="40" value="' + p.mins + '" data-idx="' + i + '" '
      + 'oninput="updateMinsSlider(this)" '
      + 'style="-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;outline:none;cursor:pointer;'
      + 'background:' + sliderBg + ';">'
      + '<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:' + (p.mins > 0 ? 'var(--g900)' : 'var(--g400)') + ';width:24px;text-align:right;flex-shrink:0;">' + p.mins + '</span>'
      + '</div>';

    h += '</div>';
  });

  // Inject slider thumb styles
  if (!document.getElementById('roster-thumb-style')) {
    var style = document.createElement('style');
    style.id = 'roster-thumb-style';
    style.textContent = '#roster-content input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--primary);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.15);}'
      + '#roster-content input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--primary);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.15);}';
    document.head.appendChild(style);
  }

  el.innerHTML = h;
}

function sectHead(label, col) {
  return '<div style="padding:12px 14px 6px;font-size:10px;font-weight:800;color:' + col + ';letter-spacing:1.5px;border-bottom:2px solid ' + col + ';">' + label + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  DRAG AND DROP — auto-adjusts minutes on tier change
// ═══════════════════════════════════════════════════════════

export function rosterDragStart(e, idx) {
  _dragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '' + idx);
  setTimeout(function() { if (e.target) e.target.style.opacity = '0.2'; }, 0);
}
window.rosterDragStart = rosterDragStart;

export function rosterDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
window.rosterDragOver = rosterDragOver;

export function rosterDrop(e, dropIdx) {
  e.preventDefault();
  if (_dragIdx < 0 || _dragIdx === dropIdx) return;
  var t = G.teams[G.tid];

  var player = t.rost.splice(_dragIdx, 1)[0];
  t.rost.splice(dropIdx, 0, player);
  _dragIdx = -1;

  // Auto-adjust minutes based on new tier
  autoAdjustMinutes(t);
  saveState();
  renderRoster();
}
window.rosterDrop = rosterDrop;

function autoAdjustMinutes(t) {
  // Assign default minutes by position in list
  // Starters: 28-36, Rotation: 10-16, Bench: 0
  var targets = [];
  t.rost.forEach(function(p, i) {
    if (i < 5) targets.push({ p: p, target: 32 });
    else if (i < 9) targets.push({ p: p, target: 12 });
    else targets.push({ p: p, target: 0 });
  });

  // Only change minutes for players whose tier changed
  targets.forEach(function(entry) {
    var oldTier = entry.p.mins >= 25 ? 'starter' : entry.p.mins >= 5 ? 'rotation' : 'bench';
    var newTier = entry.target >= 25 ? 'starter' : entry.target >= 5 ? 'rotation' : 'bench';
    if (oldTier !== newTier) {
      entry.p.mins = entry.target;
    }
  });

  // Fix total to exactly 200
  var total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  var diff = 200 - total;
  if (diff !== 0 && t.rost.length >= 5) {
    // Distribute difference among starters
    var perStarter = Math.floor(Math.abs(diff) / 5);
    var remainder = Math.abs(diff) % 5;
    for (var i = 0; i < 5; i++) {
      var adj = perStarter + (i < remainder ? 1 : 0);
      t.rost[i].mins = clamp(t.rost[i].mins + (diff > 0 ? adj : -adj), 0, 40);
    }
  }
  // Final safety clamp
  total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  if (total !== 200 && t.rost[4]) {
    t.rost[4].mins = clamp(t.rost[4].mins + (200 - total), 0, 40);
  }
}

export function rosterMove(idx, dir) {
  var t = G.teams[G.tid];
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= t.rost.length) return;
  var temp = t.rost[idx];
  t.rost[idx] = t.rost[newIdx];
  t.rost[newIdx] = temp;
  autoAdjustMinutes(t);
  saveState();
  renderRoster();
}
window.rosterMove = rosterMove;

// ═══════════════════════════════════════════════════════════
//  SMART SLIDER — redistributes by position
// ═══════════════════════════════════════════════════════════

export function updateMinsSlider(input) {
  var idx = parseInt(input.getAttribute('data-idx'));
  var val = clamp(parseInt(input.value) || 0, 0, 40);
  var t = G.teams[G.tid];
  var p = t.rost[idx];
  if (!p) return;

  var oldVal = p.mins;
  var delta = val - oldVal;
  if (delta === 0) return;

  // Find same-position players
  var samePos = [];
  t.rost.forEach(function(pl, i) {
    if (i !== idx && pl.pos === p.pos) samePos.push(pl);
  });

  if (delta > 0) {
    var needed = delta;
    // Take from same-pos first (lowest mins first)
    samePos.sort(function(a, b) { return a.mins - b.mins; });
    samePos.forEach(function(sp) {
      if (needed <= 0) return;
      var take = Math.min(sp.mins, needed);
      sp.mins -= take; needed -= take;
    });
    // Then from anyone
    if (needed > 0) {
      t.rost.forEach(function(pl, i) {
        if (i === idx || needed <= 0 || pl.mins <= 0) return;
        var take = Math.min(pl.mins, needed);
        pl.mins -= take; needed -= take;
      });
    }
    val = oldVal + (delta - needed);
  } else {
    var freed = -delta;
    // Give to same-pos (highest OVR first)
    samePos.sort(function(a, b) { return b.ovr - a.ovr; });
    samePos.forEach(function(sp) {
      if (freed <= 0) return;
      var give = Math.min(40 - sp.mins, freed);
      sp.mins += give; freed -= give;
    });
    // Then to anyone
    if (freed > 0) {
      t.rost.forEach(function(pl, i) {
        if (i === idx || freed <= 0) return;
        var give = Math.min(40 - pl.mins, freed);
        pl.mins += give; freed -= give;
      });
    }
  }

  p.mins = val;
  saveState();
  clearTimeout(window._rosterRenderTimeout);
  window._rosterRenderTimeout = setTimeout(renderRoster, 200);
}
window.updateMinsSlider = updateMinsSlider;

// ═══════════════════════════════════════════════════════════
//  AUTO-OPTIMIZE
// ═══════════════════════════════════════════════════════════

export function autoOptimizeRoster() {
  var t = G.teams[G.tid];
  t.rost.sort(function(a, b) { return b.ovr - a.ovr; });
  t.rost.forEach(function(p, i) {
    if (i < 5) p.mins = 32;
    else if (i < 9) p.mins = 12;
    else p.mins = 0;
  });
  var total = t.rost.reduce(function(a, b) { return a + b.mins; }, 0);
  var diff = 200 - total;
  if (t.rost[4]) t.rost[4].mins = clamp(t.rost[4].mins + diff, 0, 40);
  saveState();
  renderRoster();
}
window.autoOptimizeRoster = autoOptimizeRoster;

export function updateMins(input) { updateMinsSlider(input); }
