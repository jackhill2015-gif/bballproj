// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  Depth chart + minutes sliders, re-skinned into the
//  Campus Dynasty design system (mobile-first).
//
//  PHONE FIX: reorder is no longer drag-and-drop ONLY —
//  every row now has ▲/▼ nudge buttons (44px touch targets)
//  alongside the desktop drag handle. Sliders update their
//  fill + label + total in place while dragging (no
//  re-render mid-drag); the redistribution logic runs once
//  on change end, then a full re-render.
// ═══════════════════════════════════════════════════════════

import { ge, clamp } from '../utils.js';
import { G, saveState } from '../state.js';

var _dragIdx = -1;

// ── View skin (scoped) ────────────────────────────────────
function ensureSkin() {
  if (document.getElementById('roster-skin')) return;
  var s = document.createElement('style');
  s.id = 'roster-skin';
  s.textContent =
    '.depth-row{background:#fff;border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;' +
    'margin-bottom:6px;border-left:3px solid transparent;}' +
    '.depth-row.starter{border-left-color:var(--blu);}' +
    '.depth-row.rotation{border-left-color:var(--blu2);}' +
    '.depth-row.benched{opacity:.5;}' +
    '.dr-top{display:flex;align-items:center;gap:8px;}' +
    '.dr-name{flex:1;min-width:0;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.dr-sub{font-size:11px;color:var(--txt3);font-weight:500;margin-top:1px;font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.dr-ovr{text-align:right;flex-shrink:0;}' +
    '.dr-ovr b{font-family:var(--mono);font-size:18px;font-weight:900;color:var(--blu);}' +
    '.dr-ovr small{display:block;font-size:10px;color:var(--txt3);font-weight:700;}' +
    '.nudge{display:flex;gap:4px;flex-shrink:0;}' +
    '.nudge-btn{width:44px;height:44px;border-radius:8px;border:1px solid var(--bdr2);background:#fff;' +
    'font-size:15px;color:var(--txt2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
    '.nudge-btn:active{background:var(--blu-soft);border-color:var(--blu);}' +
    '.nudge-btn:disabled{opacity:.3;cursor:default;}' +
    '.drag-handle{color:var(--txt3);font-size:16px;cursor:grab;user-select:none;padding:12px 6px;flex-shrink:0;touch-action:none;}' +
    '.dr-bot{display:flex;align-items:center;gap:10px;margin-top:6px;}' +
    '.dr-bot input[type=range]{flex:1;min-height:44px;cursor:pointer;-webkit-appearance:none;appearance:none;' +
    'height:6px;border-radius:3px;outline:none;background:var(--s3);}' +
    '.mins-val{font-family:var(--mono);font-size:14px;font-weight:800;width:32px;text-align:right;flex-shrink:0;}' +
    '.tier-label{font-size:11px;font-weight:800;letter-spacing:1.5px;color:var(--txt3);text-transform:uppercase;margin:16px 0 8px;}' +
    '.tier-label:first-of-type{margin-top:4px;}' +
    '.pos-chip{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;' +
    'background:var(--blu-soft);color:var(--blu);padding:5px 0;border-radius:5px;width:38px;flex-shrink:0;}' +
    '.cls-badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;flex-shrink:0;}' +
    '@media(min-width:861px){.drag-handle{display:block;}}' +
    '#roster-content input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;' +
    'border-radius:50%;background:#fff;border:3px solid var(--blu);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2);}' +
    '#roster-content input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;' +
    'border:3px solid var(--blu);cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2);}';
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

function sliderBg(mins) {
  var f = Math.round(clamp(mins, 0, 40) / 40 * 100);
  return 'linear-gradient(90deg,var(--blu) 0%,var(--blu) ' + f + '%,var(--s3) ' + f + '%)';
}

function tierOf(i) { return i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench'; }

function depthRow(p, i) {
  var tier = tierOf(i);
  var gp = p.s ? (p.s.gp || 0) : 0;
  var line = gp > 0
    ? (p.s.pts / gp).toFixed(1) + ' pts · ' + (p.s.reb / gp).toFixed(1) + ' reb · ' + (p.s.ast / gp).toFixed(1) + ' ast'
    : 'no games yet';
  var pot = p.pot || p.ovr;
  var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
  var clsBg = { FR: '#dbeafe', SO: '#f3e8ff', JR: '#ffedd5', SR: '#fce7f3' };
  var clsTx = { FR: '#1e40af', SO: '#6b21a8', JR: '#9a3412', SR: '#9d174d' };
  var benched = p.mins === 0;

  var h = '<div class="depth-row ' + tier + (benched ? ' benched' : '') + '" data-row="' + i + '">'
    + '<div class="dr-top">'
    // drag handle (desktop) — nudge buttons are the touch path
    + '<div class="drag-handle" draggable="true" data-drag="' + i + '" aria-hidden="true" title="Drag to reorder">☰</div>'
    + '<div class="nudge" role="group" aria-label="Move ' + p.name + '">'
    + '<button class="nudge-btn" data-rmove="' + i + '" data-dir="-1" aria-label="Move ' + p.name + ' up"' + (i === 0 ? ' disabled' : '') + '>▲</button>'
    + '<button class="nudge-btn" data-rmove="' + i + '" data-dir="1" aria-label="Move ' + p.name + ' down">▼</button>'
    + '</div>'
    + '<span class="pos-chip">' + p.pos + '</span>'
    + '<div class="dr-name">' + p.name + ' <span class="cls-badge" style="background:' + (clsBg[p.cls] || '#f1f5f9') + ';color:' + (clsTx[p.cls] || '#64748b') + ';">' + p.cls + '</span>'
    + '<div class="dr-sub">' + line + '</div></div>'
    + '<div class="dr-ovr"><b>' + p.ovr + '</b><small style="color:' + potCol + ';">POT ' + pot + '</small></div>'
    + '</div>'
    + '<div class="dr-bot">'
    + '<input type="range" min="0" max="40" step="1" value="' + p.mins + '" data-mins="' + i + '"'
    + ' aria-label="Minutes for ' + p.name + '" style="background:' + sliderBg(p.mins) + ';">'
    + '<span class="mins-val" data-mins-val="' + i + '">' + p.mins + '</span>'
    + '</div></div>';
  return h;
}

export function renderRoster() {
  ensureSkin();
  var el = ge('roster-content');
  if (!el) return;
  var t = G.teams[G.tid];
  if (!t || !t.rost) return;

  var total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  var totalCol = total === 200 ? 'var(--grn2)' : 'var(--red)';

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Depth Chart</div>'
    + '<div class="sec-sub">Top 5 = starters · drag on desktop, ▲▼ buttons on touch · sliders set minutes</div></div>';

  h += '<div class="card" style="display:flex;align-items:center;justify-content:space-between;">'
    + '<div><div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;">TOTAL MINUTES</div>'
    + '<div style="font-family:var(--mono);font-size:20px;font-weight:900;color:' + totalCol + ';" data-min-total>' + total + '/200</div></div>'
    + '<button class="btn btn-red btn-sm" data-roster-auto>AUTO SET</button></div>';

  t.rost.forEach(function(p, i) {
    if (i === 0) h += '<div class="tier-label">Starters</div>';
    else if (i === 5) h += '<div class="tier-label">Rotation</div>';
    else if (i === 9) h += '<div class="tier-label">Bench</div>';
    h += depthRow(p, i);
  });

  el.innerHTML = h;
  bindRoster(el);
}

// Container-level delegation: nudge buttons, auto-set, sliders.
// Drag events are bound per-handle (draggable) below.
function bindRoster(el) {
  el.onclick = function(e) {
    var q = function(sel) { return e.target.closest ? e.target.closest(sel) : null; };
    var m;
    if ((m = q('[data-rmove]'))) {
      rosterMove(parseInt(m.getAttribute('data-rmove'), 10), parseInt(m.getAttribute('data-dir'), 10));
      return;
    }
    if (q('[data-roster-auto]')) { autoOptimizeRoster(); return; }
  };
  // In-place fill/label updates while dragging — no re-render, no logic.
  el.oninput = function(e) {
    var s = e.target.closest ? e.target.closest('[data-mins]') : null;
    if (s) rosterSliderLive(s);
  };
  // Full redistribution + re-render only when the drag ends.
  el.onchange = function(e) {
    var s = e.target.closest ? e.target.closest('[data-mins]') : null;
    if (s) rosterSliderCommit(s);
  };
  // Desktop drag-and-drop (kept alongside nudge buttons)
  el.ondragstart = function(e) {
    var hd = e.target.closest ? e.target.closest('[data-drag]') : null;
    if (hd) rosterDragStart(e, parseInt(hd.getAttribute('data-drag'), 10));
  };
  el.ondragover = function(e) {
    var row = e.target.closest ? e.target.closest('[data-row]') : null;
    if (row) rosterDragOver(e);
  };
  el.ondrop = function(e) {
    var row = e.target.closest ? e.target.closest('[data-row]') : null;
    if (row) { e.preventDefault(); rosterDrop(e, parseInt(row.getAttribute('data-row'), 10)); }
  };
}

// ═══════════════════════════════════════════════════════════
//  DRAG AND DROP — auto-adjusts minutes on tier change
//  (desktop path; touch users get the ▲▼ nudge buttons)
// ═══════════════════════════════════════════════════════════

export function rosterDragStart(e, idx) {
  _dragIdx = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '' + idx);
  }
  setTimeout(function() { if (e.target && e.target.style) e.target.style.opacity = '0.2'; }, 0);
}
window.rosterDragStart = rosterDragStart;

export function rosterDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}
window.rosterDragOver = rosterDragOver;

export function rosterDrop(e, dropIdx) {
  if (e.preventDefault) e.preventDefault();
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

// Nudge-button reorder (touch path) — same tier/minute logic as drag.
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
//  MINUTES SLIDERS
//  Live drag: in-place fill + label + total (no logic, no
//  re-render). Change end: full redistribution (R8 minutes
//  conservation) + save + re-render.
// ═══════════════════════════════════════════════════════════

// In-place visual update while dragging. Pure presentation.
export function rosterSliderLive(input) {
  var idx = parseInt(input.getAttribute('data-mins'), 10);
  var val = clamp(parseInt(input.value, 10) || 0, 0, 40);
  var t = G.teams[G.tid];
  var p = t && t.rost[idx];
  if (!p) return;
  input.style.background = sliderBg(val);
  var el = ge('roster-content');
  if (el && el.querySelector) {
    var lab = el.querySelector('[data-mins-val="' + idx + '"]');
    if (lab) lab.textContent = val;
    // Show the live total without committing: everyone else's
    // committed minutes + this slider's in-flight value.
    var total = t.rost.reduce(function(s, pl, i) { return s + (i === idx ? val : pl.mins); }, 0);
    var tot = el.querySelector('[data-min-total]');
    if (tot) {
      tot.textContent = total + '/200';
      tot.style.color = total === 200 ? 'var(--grn2)' : 'var(--red)';
    }
  }
}

// Commit on change end: redistribute, save, re-render.
export function rosterSliderCommit(input) {
  var idx = parseInt(input.getAttribute('data-mins'), 10);
  var val = clamp(parseInt(input.value, 10) || 0, 0, 40);
  applyMinsRedistribution(idx, val);
  saveState();
  renderRoster();
}

// The redistribution logic (was inline in updateMinsSlider).
// R8: minutes are conserved — a player only shrinks by what
// could actually be redistributed elsewhere.
function applyMinsRedistribution(idx, val) {
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
    var origFreed = -delta;
    var freed = origFreed;
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
    // R8: only shrink by what could actually be redistributed — never silently drop minutes
    val = oldVal - (origFreed - freed);
  }

  p.mins = val;
}

// Kept export (main.js bridge + updateMins): apply immediately.
export function updateMinsSlider(input) {
  var idx = parseInt(input.getAttribute('data-mins') || input.getAttribute('data-idx'), 10);
  var val = clamp(parseInt(input.value, 10) || 0, 0, 40);
  applyMinsRedistribution(idx, val);
  saveState();
  renderRoster();
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
