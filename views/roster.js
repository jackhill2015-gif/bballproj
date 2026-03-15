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
  var totalOk = total === 200;

  var h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
    + '<div>'
    + '<div style="font-size:20px;font-weight:900;">Depth Chart</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:3px;">Drag to reorder \u00b7 Top 5 = Starters \u00b7 Sliders control minutes</div>'
    + '</div>'
    + '<div class="btn btn-red" onclick="autoOptimizeRoster()" style="font-size:11px;padding:8px 20px;font-weight:800;">AUTO SET</div>'
    + '</div>';

  // Player rows
  t.rost.forEach(function(p, i) {
    var tier = i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench';

    // Section headers
    if (i === 0) h += sectHead('STARTERS', 'var(--red)');
    else if (i === 5) h += sectHead('ROTATION', 'var(--txt2)');
    else if (i === 9) h += sectHead('BENCH', 'var(--txt3)');

    // Stats
    var gp = p.s ? (p.s.gp || 0) : 0;
    var ppg = gp > 0 ? (p.s.pts / gp).toFixed(1) : null;
    var rpg = gp > 0 ? (p.s.reb / gp).toFixed(1) : null;
    var apg = gp > 0 ? (p.s.ast / gp).toFixed(1) : null;

    // Colors
    var stripe = tier === 'starter' ? 'var(--red)' : tier === 'rotation' ? 'var(--bdr2)' : 'transparent';
    var clsMap = { FR: '#48bb78', SO: '#ecc94b', JR: '#63b3ed', SR: '#a0aec0' };
    var clsCol = clsMap[p.cls] || '#a0aec0';
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? '#48bb78' : pot > p.ovr + 3 ? '#ecc94b' : 'var(--txt3)';
    var isBenched = p.mins === 0;

    // Slider fill — compute inline background gradient since CSS var approach is broken
    var fillPct = Math.round((p.mins / 40) * 100);
    var sliderTrackCol = tier === 'starter' ? 'var(--red)' : tier === 'rotation' ? '#718096' : '#4a5568';
    var sliderBg = 'linear-gradient(90deg,' + sliderTrackCol + ' 0%,' + sliderTrackCol + ' ' + fillPct + '%,var(--bdr2) ' + fillPct + '%)';

    h += '<div data-idx="' + i + '" '
      + 'ondragover="rosterDragOver(event)" '
      + 'ondrop="rosterDrop(event,' + i + ')" '
      + 'style="display:grid;grid-template-columns:24px 38px 1fr 42px 42px 130px;align-items:center;gap:4px;'
      + 'padding:9px 12px;border-left:3px solid ' + stripe + ';border-bottom:1px solid rgba(255,255,255,.025);'
      + 'transition:opacity .12s,background .1s;'
      + (isBenched ? 'opacity:.35;' : '') + '" '
      + 'onmouseover="this.style.background=\'rgba(255,255,255,.025)\'" '
      + 'onmouseout="this.style.background=\'\'">';

    // Col 1: Drag handle — THIS is the only draggable element
    h += '<div draggable="true" ondragstart="rosterDragStart(event,' + i + ')" style="color:var(--txt3);font-size:12px;cursor:grab;user-select:none;text-align:center;">\u2630</div>';

    // Col 2: Position chip
    h += '<div><span style="display:inline-block;font-size:9px;font-weight:800;background:var(--s3);color:var(--txt);padding:3px 7px;border-radius:4px;text-align:center;min-width:28px;">' + p.pos + '</span></div>';

    // Col 3: Name + class + stats
    h += '<div style="min-width:0;overflow:hidden;">'
      + '<div style="display:flex;align-items:center;gap:5px;">'
      + '<span style="font-size:13px;font-weight:700;color:' + (isBenched ? 'var(--txt3)' : '#fff') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</span>'
      + '<span style="font-size:8px;font-weight:800;color:' + clsCol + ';background:' + clsCol + '18;padding:1px 5px;border-radius:3px;flex-shrink:0;">' + p.cls + '</span></div>';
    if (ppg !== null) {
      h += '<div style="font-size:10px;color:var(--txt3);margin-top:1px;white-space:nowrap;">' + ppg + ' pts \u00b7 ' + rpg + ' reb \u00b7 ' + apg + ' ast</div>';
    }
    h += '</div>';

    // Col 4: OVR
    h += '<div style="text-align:center;">'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:15px;font-weight:900;color:var(--red);">' + p.ovr + '</div></div>';

    // Col 5: POT
    h += '<div style="text-align:center;">'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:13px;font-weight:700;color:' + potCol + ';">' + pot + '</div></div>';

    // Col 6: Slider with inline fill
    h += '<div style="display:flex;align-items:center;gap:6px;">'
      + '<input type="range" min="0" max="40" value="' + p.mins + '" data-idx="' + i + '" '
      + 'oninput="updateMinsSlider(this)" '
      + 'style="-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;outline:none;cursor:pointer;'
      + 'background:' + sliderBg + ';">'
      + '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:700;color:' + (p.mins > 0 ? '#fff' : 'var(--txt3)') + ';width:22px;text-align:right;flex-shrink:0;">' + p.mins + '</span>'
      + '</div>';

    h += '</div>';
  });

  // Inject slider thumb styles if not already present
  if (!document.getElementById('roster-thumb-style')) {
    var style = document.createElement('style');
    style.id = 'roster-thumb-style';
    style.textContent = '#roster-content input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--red);cursor:pointer;}'
      + '#roster-content input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--red);cursor:pointer;}';
    document.head.appendChild(style);
  }

  el.innerHTML = h;
}

function sectHead(label, col) {
  return '<div style="padding:10px 12px 5px;font-size:10px;font-weight:800;color:' + col + ';letter-spacing:1.5px;border-bottom:1px solid ' + col + ';">' + label + '</div>';
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
