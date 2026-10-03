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
import { moodTag, moodColors, MORALE_DEFAULT } from '../morale.js';
import { gameplanPanelHTML, handleGameplanClick } from './strategy.js';

var _dragIdx = -1;

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

function sliderBg(mins) {
  var f = Math.round(clamp(mins, 0, 40) / 40 * 100);
  return 'linear-gradient(90deg,var(--blu) 0%,var(--blu) ' + f + '%,var(--s3) ' + f + '%)';
}

function injuryOf(p) {
  var list = G.injuries || [];
  for (var k = 0; k < list.length; k++) if (list[k].playerName === p.name && list[k].weeksLeft > 0) return list[k];
  return null;
}

// Redshirt: once per career, decided before a player's 5th game of the season.
// He sits out, doesn't use a year of eligibility, and develops extra.
var RS_MAX_GAMES = 4;
function canRedshirt(p) {
  return G.phase === 'reg' && !p.rsUsed && ((p.s && p.s.gp) || 0) <= RS_MAX_GAMES;
}
function rsButton(p, i) {
  if (p.rs) return G.phase === 'reg' ? '<button class="btn-quiet btn-sm" data-rs="' + i + '">Undo redshirt</button>' : '';
  if (!canRedshirt(p)) return '';
  return '<button class="btn-quiet btn-sm" data-rs="' + i + '" title="Sit him this season and keep a year of eligibility">Redshirt</button>';
}
export function toggleRedshirt(i) {
  var t = G.teams[G.tid];
  var p = t.rost[i];
  if (!p) return;
  if (p.rs) { p.rs = false; }
  else {
    if (!canRedshirt(p)) return;
    p.rs = true;
    // He's out of the rotation: move him to the end of the bench
    t.rost.splice(i, 1); t.rost.push(p);
  }
  autoAdjustMinutes(t);
  saveState();
  renderRoster();
}

function tierOf(i) { return i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench'; }

function depthRow(p, i) {
  var tier = tierOf(i);
  var gp = p.s ? (p.s.gp || 0) : 0;
  var line = gp > 0
    ? (p.s.pts / gp).toFixed(1) + ' pts · ' + (p.s.reb / gp).toFixed(1) + ' reb · ' + (p.s.ast / gp).toFixed(1) + ' ast'
    : 'No games yet';
  var _injLine = injuryOf(p);
  if (_injLine) line = _injLine.type.charAt(0).toUpperCase() + _injLine.type.slice(1) + ', back in ' + _injLine.weeksLeft + ' wk. ' + line;
  var pot = p.pot || p.ovr;
  var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
  var benched = p.mins === 0;
  // Mood tag — roster page only, per jack (no dashboard meter)
  var _mor = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  var _mc = moodColors(_mor);
  // Only call out moods that matter; "Content" is the quiet default
  var _mt = moodTag(_mor);
  var moodPill = _mt === 'Content' ? '' : '<span class="mood-tag" style="color:' + _mc[1] + ';">' + _mt + '</span>';
  var inj = injuryOf(p);
  if (inj) moodPill += '<span class="out-tag">Out ' + inj.weeksLeft + ' wk</span>';

  var h = '<div class="depth-row ' + tier + (benched ? ' benched' : '') + '" data-row="' + i + '">'
    + '<div class="dr-top">'
    // drag handle (desktop) — nudge buttons are the touch path
    + '<div class="drag-handle" data-drag="' + i + '" role="button" tabindex="0" aria-label="Drag ' + p.name + ' to reorder (or use arrow keys)" title="Drag to reorder">☰</div>'
    + '<span class="pos-chip">' + p.pos + '</span>'
    + '<div class="dr-name">' + p.name + ' <span class="cls-txt">' + (p.rsUsed ? 'RS ' : '') + p.cls + '</span>' + moodPill
    + (p.rs ? '<span class="rs-tag">Redshirt</span>' : '')
    + '<div class="dr-sub">' + line + '</div></div>'
    + '<div class="dr-ovr"><b>' + p.ovr + '</b><small style="color:' + potCol + ';">Pot ' + pot + '</small></div>'
    + '</div>'
    + '<div class="dr-bot">'
    + (p.rs ? '<span class="rs-note">Sitting out this season, keeps a year of eligibility.</span>' : '')
    + '<input type="range" min="0" max="40" step="1" value="' + p.mins + '" data-mins="' + i + '"' + (p.rs ? ' disabled hidden' : '')
    + ' aria-label="Minutes for ' + p.name + '" style="background:' + sliderBg(p.mins) + ';">'
    + '<span class="mins-val" data-mins-val="' + i + '">' + (p.rs ? '' : p.mins) + '</span>'
    + rsButton(p, i)
    + '</div></div>';
  return h;
}

export function renderRoster() {
  var el = ge('roster-content');
  if (!el) return;
  var t = G.teams[G.tid];
  if (!t || !t.rost) return;

  var total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  var totalCol = total === 200 ? 'var(--grn2)' : 'var(--red)';

  var nOut = t.rost.filter(function(p) { return !!injuryOf(p); }).length;
  var h = gameplanPanelHTML();
  h += '<div style="margin-bottom:8px;"><div class="sec-head">Depth chart</div>'
    + '<div class="sec-sub">The top five start. Drag a player by the ☰ handle to reorder, and set minutes with the sliders.</div></div>';

  h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr);margin-bottom:4px;">'
    + '<div style="font-size:12.5px;color:var(--txt2);">Minutes <b style="font-size:14px;font-weight:600;color:' + totalCol + ';" data-min-total>' + total + '/200</b>'
    + (nOut ? ' <span style="color:var(--txt3);">(' + nOut + ' out)</span>' : '') + '</div>'
    + '<button class="btn-quiet" data-roster-auto>Auto set</button></div>';

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
    if ((m = q('[data-rs]'))) { toggleRedshirt(parseInt(m.getAttribute('data-rs'), 10)); return; }
    if (handleGameplanClick(e.target)) { renderRoster(); return; }
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
  // Reorder: press the ☰ handle and drag (mouse or touch). The row follows
  // the pointer and a line marks where it will land; release to drop.
  el.onpointerdown = function(e) {
    var hd = e.target.closest ? e.target.closest('[data-drag]') : null;
    if (hd) startPointerDrag(e, el, parseInt(hd.getAttribute('data-drag'), 10));
  };
  // Keyboard: focus a handle, arrow up/down to move one slot
  el.onkeydown = function(e) {
    var hd = e.target.closest ? e.target.closest('[data-drag]') : null;
    if (!hd) return;
    var i = parseInt(hd.getAttribute('data-drag'), 10);
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); moveTo(i, i - 1, true); }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveTo(i, i + 1, true); }
  };
}

// ═══════════════════════════════════════════════════════════
//  DRAG AND DROP — auto-adjusts minutes on tier change
//  (pointer drag on the ☰ handle — mouse and touch)
// ═══════════════════════════════════════════════════════════

function moveTo(from, to, refocus) {
  var t = G.teams[G.tid];
  if (to < 0 || to >= t.rost.length || to === from) return;
  var player = t.rost.splice(from, 1)[0];
  t.rost.splice(to, 0, player);
  autoAdjustMinutes(t);
  saveState();
  renderRoster();
  if (refocus) {
    var h = document.querySelector('#roster-content [data-drag="' + to + '"]');
    if (h && h.focus) h.focus();
  }
}

function startPointerDrag(e, container, idx) {
  var rows = Array.prototype.slice.call(container.querySelectorAll('.depth-row'));
  var row = rows[idx];
  if (!row) return;
  e.preventDefault();
  var startY = e.clientY;
  var rects = rows.map(function(r) { return r.getBoundingClientRect(); });
  var target = idx;
  var marker = document.createElement('div');
  marker.className = 'drop-line';
  row.classList.add('dragging');
  if (e.target.setPointerCapture) { try { e.target.setPointerCapture(e.pointerId); } catch (err) {} }

  var others = rows.filter(function(r, k) { return k !== idx; });
  var otherRects = rects.filter(function(r, k) { return k !== idx; });
  function onMove(ev) {
    row.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
    // New index = how many other rows sit above the pointer
    var slot = 0;
    for (var k = 0; k < otherRects.length; k++) {
      if (ev.clientY > otherRects[k].top + otherRects[k].height / 2) slot = k + 1;
    }
    target = slot;
    if (target === idx) { if (marker.parentNode) marker.parentNode.removeChild(marker); return; }
    if (slot >= others.length) others[others.length - 1].parentNode.insertBefore(marker, others[others.length - 1].nextSibling);
    else others[slot].parentNode.insertBefore(marker, others[slot]);
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    row.classList.remove('dragging');
    row.style.transform = '';
    if (marker.parentNode) marker.parentNode.removeChild(marker);
    if (target !== idx) moveTo(idx, target);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

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
  var slot = 0; // redshirts don't count toward starters/rotation
  t.rost.forEach(function(p) {
    if (p.rs) { p.mins = 0; return; }
    if (slot < 5) targets.push({ p: p, target: 32 });
    else if (slot < 9) targets.push({ p: p, target: 12 });
    else targets.push({ p: p, target: 0 });
    slot++;
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
    var starters = t.rost.filter(function(p) { return !p.rs; }).slice(0, 5);
    for (var i = 0; i < starters.length; i++) {
      var adj = perStarter + (i < remainder ? 1 : 0);
      starters[i].mins = clamp(starters[i].mins + (diff > 0 ? adj : -adj), 0, 40);
    }
  }
  // Final safety clamp
  total = t.rost.reduce(function(s, p) { return s + p.mins; }, 0);
  var last = t.rost.filter(function(p) { return !p.rs; })[4];
  if (total !== 200 && last) {
    last.mins = clamp(last.mins + (200 - total), 0, 40);
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
    if (i !== idx && pl.pos === p.pos && !pl.rs) samePos.push(pl);
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
        if (i === idx || needed <= 0 || pl.mins <= 0 || pl.rs) return;
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
        if (i === idx || freed <= 0 || pl.rs) return;
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
  t.rost.sort(function(a, b) { return ((a.rs ? 1 : 0) - (b.rs ? 1 : 0)) || (b.ovr - a.ovr); });
  t.rost.forEach(function(p, i) {
    if (p.rs) p.mins = 0;
    else if (i < 5) p.mins = 32;
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
