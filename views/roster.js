// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  Drag-and-drop depth chart with smart minute redistribution
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
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;">Depth Chart</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">Drag players to reorder. Top 5 start. Adjust minutes with sliders.</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="font-family:monospace;font-size:14px;font-weight:800;color:' + (totalOk ? 'var(--grn2)' : '#fc8181') + ';">'
    + total + '/200' + (totalOk ? ' \u2713' : ' \u26a0') + '</div>'
    + '<div class="btn btn-red btn-sm" onclick="autoOptimizeRoster()" style="font-size:11px;padding:7px 16px;">AUTO SET</div>'
    + '</div></div>';

  // Column headers
  h += '<div style="display:flex;align-items:center;padding:4px 12px 6px;font-size:9px;font-weight:700;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;">'
    + '<div style="width:32px;"></div>'
    + '<div style="width:32px;">POS</div>'
    + '<div style="flex:1;">PLAYER</div>'
    + '<div style="width:36px;text-align:center;">OVR</div>'
    + '<div style="width:36px;text-align:center;">POT</div>'
    + '<div style="width:100px;text-align:center;">STATS</div>'
    + '<div style="width:140px;text-align:center;">MINUTES</div>'
    + '</div>';

  // Player rows
  t.rost.forEach(function(p, i) {
    var tier = i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench';
    var gp = p.s.gp || 0;
    var ppg = gp > 0 ? (p.s.pts / gp).toFixed(1) : '--';
    var rpg = gp > 0 ? (p.s.reb / gp).toFixed(1) : '--';
    var apg = gp > 0 ? (p.s.ast / gp).toFixed(1) : '--';

    // Section headers
    if (i === 0) h += renderSectionHeader('STARTERS', 'var(--red)');
    else if (i === 5) h += renderSectionHeader('ROTATION', 'var(--txt3)');
    else if (i === 9) h += renderSectionHeader('BENCH', 'var(--txt3)');

    // Tier stripe color
    var stripeCol = tier === 'starter' ? 'var(--red)' : tier === 'rotation' ? 'var(--bdr2)' : 'transparent';

    // Class color
    var clsCol = p.cls === 'FR' ? 'var(--grn2)' : p.cls === 'SO' ? 'var(--gld2)' : p.cls === 'JR' ? '#63b3ed' : 'var(--txt3)';

    // Potential color
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';

    // Slider fill
    var fillPct = Math.round((p.mins / 40) * 100);

    h += '<div draggable="true" data-idx="' + i + '" ondragstart="rosterDragStart(event,' + i + ')" ondragover="rosterDragOver(event)" ondrop="rosterDrop(event,' + i + ')" style="display:flex;align-items:center;padding:8px 12px;border-left:3px solid ' + stripeCol + ';border-bottom:1px solid rgba(255,255,255,.03);cursor:grab;transition:background .1s;' + (tier === 'bench' && p.mins === 0 ? 'opacity:.5;' : '') + '" onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">';

    // Drag handle
    h += '<div style="width:32px;color:var(--txt3);font-size:12px;flex-shrink:0;cursor:grab;">\u2630</div>';

    // Position chip
    h += '<div style="width:32px;flex-shrink:0;"><span style="font-size:9px;font-weight:800;background:var(--s3);color:var(--txt2);padding:2px 6px;border-radius:3px;">' + p.pos + '</span></div>';

    // Player name + class
    h += '<div style="flex:1;min-width:0;">'
      + '<span style="font-size:12px;font-weight:700;color:#fff;">' + p.name + '</span>'
      + ' <span style="font-size:9px;font-weight:800;color:' + clsCol + ';">' + p.cls + '</span>'
      + '</div>';

    // OVR
    h += '<div style="width:36px;text-align:center;font-family:monospace;font-size:13px;font-weight:900;color:var(--red);flex-shrink:0;">' + p.ovr + '</div>';

    // POT
    h += '<div style="width:36px;text-align:center;font-family:monospace;font-size:12px;font-weight:700;color:' + potCol + ';flex-shrink:0;">' + pot + '</div>';

    // Stats (PPG/RPG/APG)
    h += '<div style="width:100px;text-align:center;font-size:10px;color:var(--txt2);flex-shrink:0;">' + ppg + ' / ' + rpg + ' / ' + apg + '</div>';

    // Minutes slider
    h += '<div style="width:140px;display:flex;align-items:center;gap:6px;flex-shrink:0;">'
      + '<input type="range" min="0" max="40" value="' + p.mins + '" data-idx="' + i + '" oninput="updateMinsSlider(this)" class="mins-slider" style="flex:1;--fill:' + fillPct + '%;">'
      + '</div>';

    h += '</div>';
  });

  el.innerHTML = h;
}

function renderSectionHeader(label, col) {
  return '<div style="font-size:10px;font-weight:800;color:' + col + ';letter-spacing:1.5px;text-transform:uppercase;padding:10px 12px 4px;">' + label + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  DRAG AND DROP
// ═══════════════════════════════════════════════════════════

export function rosterDragStart(e, idx) {
  _dragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx);
  // Style the dragged element
  setTimeout(function() {
    if (e.target) e.target.style.opacity = '0.4';
  }, 0);
}
window.rosterDragStart = rosterDragStart;

export function rosterDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
window.rosterDragOver = rosterDragOver;

export function rosterDrop(e, dropIdx) {
  e.preventDefault();
  if (_dragIdx < 0 || _dragIdx === dropIdx) return;
  var t = G.teams[G.tid];

  // Remove player from old position and insert at new position
  var player = t.rost.splice(_dragIdx, 1)[0];
  t.rost.splice(dropIdx, 0, player);

  _dragIdx = -1;
  saveState();
  renderRoster();
}
window.rosterDrop = rosterDrop;

// Legacy arrow move (kept for backward compat)
export function rosterMove(idx, dir) {
  var t = G.teams[G.tid];
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= t.rost.length) return;
  var temp = t.rost[idx];
  t.rost[idx] = t.rost[newIdx];
  t.rost[newIdx] = temp;
  saveState();
  renderRoster();
}
window.rosterMove = rosterMove;

// ═══════════════════════════════════════════════════════════
//  SMART SLIDER — redistributes minutes by position
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

  // Find other players at the SAME position to redistribute
  var samePos = [];
  t.rost.forEach(function(pl, i) {
    if (i !== idx && pl.pos === p.pos) samePos.push({ player: pl, idx: i });
  });

  if (delta > 0) {
    // Increasing — need to take minutes from same-position players
    var needed = delta;
    // First try to take from bench players at same position
    samePos.sort(function(a, b) { return a.player.mins - b.player.mins; });
    samePos.forEach(function(sp) {
      if (needed <= 0) return;
      var canTake = Math.min(sp.player.mins, needed);
      sp.player.mins -= canTake;
      needed -= canTake;
    });
    // If still need more, take from any player with minutes
    if (needed > 0) {
      var others = [];
      t.rost.forEach(function(pl, i) {
        if (i !== idx && pl.mins > 0) others.push(pl);
      });
      others.sort(function(a, b) { return a.mins - b.mins; });
      others.forEach(function(pl) {
        if (needed <= 0) return;
        var canTake = Math.min(pl.mins, needed);
        pl.mins -= canTake;
        needed -= canTake;
      });
    }
    // If STILL not enough, cap the increase
    val = oldVal + (delta - needed);
  } else {
    // Decreasing — give minutes to same-position players
    var freed = -delta;
    // Give to the highest-OVR same-position player who isn't maxed
    samePos.sort(function(a, b) { return b.player.ovr - a.player.ovr; });
    samePos.forEach(function(sp) {
      if (freed <= 0) return;
      var canGive = Math.min(40 - sp.player.mins, freed);
      sp.player.mins += canGive;
      freed -= canGive;
    });
    // If same-position can't absorb, give to highest OVR available
    if (freed > 0) {
      var others2 = [];
      t.rost.forEach(function(pl, i) {
        if (i !== idx) others2.push(pl);
      });
      others2.sort(function(a, b) { return b.ovr - a.ovr; });
      others2.forEach(function(pl) {
        if (freed <= 0) return;
        var canGive = Math.min(40 - pl.mins, freed);
        pl.mins += canGive;
        freed -= canGive;
      });
    }
  }

  p.mins = val;
  input.style.setProperty('--fill', Math.round((val / 40) * 100) + '%');

  saveState();
  clearTimeout(window._rosterRenderTimeout);
  window._rosterRenderTimeout = setTimeout(renderRoster, 300);
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
  if (t.rost[4]) t.rost[4].mins = Math.max(1, t.rost[4].mins + diff);
  saveState();
  renderRoster();
}
window.autoOptimizeRoster = autoOptimizeRoster;

// ═══════════════════════════════════════════════════════════
//  LEGACY
// ═══════════════════════════════════════════════════════════
export function updateMins(input) { updateMinsSlider(input); }
