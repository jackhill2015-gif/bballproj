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
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;">'
    + '<div>'
    + '<div style="font-size:22px;font-weight:900;letter-spacing:-.5px;">' + t.name + ' Roster</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:4px;">Drag to reorder \u00b7 Top 5 start \u00b7 Sliders set minutes \u00b7 Minutes auto-balance by position</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:14px;">'
    + '<div style="font-family:monospace;font-size:16px;font-weight:900;color:' + (totalOk ? 'var(--grn2)' : '#fc8181') + ';">'
    + total + '/200 ' + (totalOk ? '\u2713' : '\u26a0') + '</div>'
    + '<div class="btn btn-red" onclick="autoOptimizeRoster()" style="font-size:11px;padding:8px 20px;font-weight:800;">AUTO SET</div>'
    + '</div></div>';

  // Team summary bar
  var avgOvr = Math.round(t.rost.reduce(function(s, p) { return s + p.ovr; }, 0) / t.rost.length);
  var frCount = t.rost.filter(function(p) { return p.cls === 'FR'; }).length;
  var soCount = t.rost.filter(function(p) { return p.cls === 'SO'; }).length;
  var jrCount = t.rost.filter(function(p) { return p.cls === 'JR'; }).length;
  var srCount = t.rost.filter(function(p) { return p.cls === 'SR'; }).length;

  h += '<div style="display:flex;gap:12px;margin-bottom:14px;">'
    + '<div style="padding:8px 14px;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;font-size:11px;">'
    + '<span style="color:var(--txt3);">AVG OVR</span> <span style="font-weight:800;color:var(--red);font-family:monospace;">' + avgOvr + '</span></div>'
    + '<div style="padding:8px 14px;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;font-size:11px;">'
    + '<span style="color:var(--grn2);font-weight:700;">' + frCount + ' FR</span>'
    + ' <span style="color:var(--gld2);font-weight:700;">' + soCount + ' SO</span>'
    + ' <span style="color:#63b3ed;font-weight:700;">' + jrCount + ' JR</span>'
    + ' <span style="color:var(--txt3);font-weight:700;">' + srCount + ' SR</span></div>'
    + '<div style="padding:8px 14px;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;font-size:11px;">'
    + '<span style="color:var(--txt3);">ROSTER</span> <span style="font-weight:800;color:#fff;">' + t.rost.length + ' players</span></div>'
    + '</div>';

  // Player list
  t.rost.forEach(function(p, i) {
    var tier = i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench';
    var gp = p.s.gp || 0;
    var ppg = gp > 0 ? (p.s.pts / gp).toFixed(1) : '0.0';
    var rpg = gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0';
    var apg = gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0';

    // Section headers
    if (i === 0) h += sectionHead('STARTERS', '5 players \u00b7 ' + t.rost.slice(0, 5).reduce(function(s, x) { return s + x.mins; }, 0) + ' min', 'var(--red)');
    else if (i === 5) h += sectionHead('ROTATION', '4 players \u00b7 ' + t.rost.slice(5, 9).reduce(function(s, x) { return s + x.mins; }, 0) + ' min', 'var(--blu)');
    else if (i === 9) h += sectionHead('BENCH', (t.rost.length - 9) + ' players \u00b7 ' + t.rost.slice(9).reduce(function(s, x) { return s + x.mins; }, 0) + ' min', 'var(--txt3)');

    // Colors
    var clsColors = { FR: 'var(--grn2)', SO: 'var(--gld2)', JR: '#63b3ed', SR: 'var(--txt3)' };
    var clsCol = clsColors[p.cls] || 'var(--txt3)';
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
    var stripeCol = tier === 'starter' ? 'var(--red)' : tier === 'rotation' ? 'var(--blu)' : 'var(--bdr)';
    var fillPct = Math.round((p.mins / 40) * 100);
    var isBench0 = tier === 'bench' && p.mins === 0;

    h += '<div draggable="true" data-idx="' + i + '" ondragstart="rosterDragStart(event,' + i + ')" ondragover="rosterDragOver(event)" ondrop="rosterDrop(event,' + i + ')" '
      + 'style="display:grid;grid-template-columns:24px 36px 1fr 40px 40px 130px 160px;align-items:center;gap:8px;padding:10px 12px;border-left:3px solid ' + stripeCol + ';border-bottom:1px solid rgba(255,255,255,.03);cursor:grab;transition:all .1s;'
      + (isBench0 ? 'opacity:.45;' : '') + '" '
      + 'onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">';

    // Drag handle
    h += '<div style="color:var(--txt3);font-size:14px;cursor:grab;text-align:center;">\u2630</div>';

    // Position chip
    h += '<div><span style="font-size:9px;font-weight:800;background:var(--s3);color:var(--txt2);padding:3px 7px;border-radius:3px;display:inline-block;">' + p.pos + '</span></div>';

    // Player info (name + class + role)
    var roleBadge = tier === 'starter' ? '<span style="font-size:8px;font-weight:800;color:var(--red);background:rgba(0,102,204,.1);padding:1px 5px;border-radius:2px;margin-left:6px;">START</span>'
      : tier === 'rotation' ? '<span style="font-size:8px;font-weight:800;color:var(--blu);background:rgba(74,158,237,.1);padding:1px 5px;border-radius:2px;margin-left:6px;">ROT</span>'
      : '';
    h += '<div style="min-width:0;">'
      + '<div style="display:flex;align-items:center;">'
      + '<span style="font-size:13px;font-weight:700;color:' + (isBench0 ? 'var(--txt3)' : '#fff') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</span>'
      + roleBadge
      + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">'
      + '<span style="color:' + clsCol + ';font-weight:700;">' + p.cls + '</span>'
      + ' \u00b7 ' + ppg + ' ppg \u00b7 ' + rpg + ' rpg \u00b7 ' + apg + ' apg'
      + '</div></div>';

    // OVR
    h += '<div style="text-align:center;"><div style="font-family:monospace;font-size:16px;font-weight:900;color:var(--red);">' + p.ovr + '</div>'
      + '<div style="font-size:8px;color:var(--txt3);">OVR</div></div>';

    // POT
    h += '<div style="text-align:center;"><div style="font-family:monospace;font-size:14px;font-weight:800;color:' + potCol + ';">' + pot + '</div>'
      + '<div style="font-size:8px;color:var(--txt3);">POT</div></div>';

    // Minutes display (number + mini bar)
    h += '<div style="text-align:center;">'
      + '<div style="font-family:monospace;font-size:18px;font-weight:900;color:' + (tier === 'starter' ? '#fff' : tier === 'rotation' ? 'var(--txt2)' : 'var(--txt3)') + ';">' + p.mins + '</div>'
      + '<div style="height:3px;background:var(--bdr2);border-radius:2px;margin-top:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + fillPct + '%;background:' + stripeCol + ';border-radius:2px;"></div></div>'
      + '<div style="font-size:8px;color:var(--txt3);margin-top:1px;">MIN</div></div>';

    // Slider
    h += '<div style="display:flex;align-items:center;padding:0 4px;">'
      + '<input type="range" min="0" max="40" value="' + p.mins + '" data-idx="' + i + '" oninput="updateMinsSlider(this)" class="mins-slider ' + tier + '" style="width:100%;--fill:' + fillPct + '%;">'
      + '</div>';

    h += '</div>';
  });

  el.innerHTML = h;
}

function sectionHead(label, sub, col) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 12px 6px;border-bottom:1px solid ' + col + ';">'
    + '<div style="font-size:11px;font-weight:800;color:' + col + ';letter-spacing:1.5px;text-transform:uppercase;">' + label + '</div>'
    + '<div style="font-size:10px;color:var(--txt3);">' + sub + '</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  DRAG AND DROP
// ═══════════════════════════════════════════════════════════

export function rosterDragStart(e, idx) {
  _dragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx.toString());
  setTimeout(function() {
    if (e.target && e.target.style) e.target.style.opacity = '0.3';
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
  var player = t.rost.splice(_dragIdx, 1)[0];
  t.rost.splice(dropIdx, 0, player);
  _dragIdx = -1;
  saveState();
  renderRoster();
}
window.rosterDrop = rosterDrop;

export function rosterMove(idx, dir) {
  var t = G.teams[G.tid];
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= t.rost.length) return;
  var temp = t.rost[idx]; t.rost[idx] = t.rost[newIdx]; t.rost[newIdx] = temp;
  saveState(); renderRoster();
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

  // Find same-position players for smart redistribution
  var samePos = [];
  t.rost.forEach(function(pl, i) {
    if (i !== idx && pl.pos === p.pos) samePos.push(pl);
  });

  if (delta > 0) {
    // Taking minutes — first from same position (lowest OVR first)
    var needed = delta;
    samePos.sort(function(a, b) { return a.ovr - b.ovr; });
    samePos.forEach(function(sp) {
      if (needed <= 0) return;
      var take = Math.min(sp.mins, needed);
      sp.mins -= take; needed -= take;
    });
    // If still short, take from anyone (lowest mins first)
    if (needed > 0) {
      var all = [];
      t.rost.forEach(function(pl, i) { if (i !== idx && pl.mins > 0) all.push(pl); });
      all.sort(function(a, b) { return a.mins - b.mins; });
      all.forEach(function(pl) {
        if (needed <= 0) return;
        var take = Math.min(pl.mins, needed);
        pl.mins -= take; needed -= take;
      });
    }
    val = oldVal + (delta - needed);
  } else {
    // Giving minutes — to same position (highest OVR first)
    var freed = -delta;
    samePos.sort(function(a, b) { return b.ovr - a.ovr; });
    samePos.forEach(function(sp) {
      if (freed <= 0) return;
      var give = Math.min(40 - sp.mins, freed);
      sp.mins += give; freed -= give;
    });
    // If can't absorb, give to highest OVR anyone
    if (freed > 0) {
      var all2 = [];
      t.rost.forEach(function(pl, i) { if (i !== idx) all2.push(pl); });
      all2.sort(function(a, b) { return b.ovr - a.ovr; });
      all2.forEach(function(pl) {
        if (freed <= 0) return;
        var give = Math.min(40 - pl.mins, freed);
        pl.mins += give; freed -= give;
      });
    }
  }

  p.mins = val;
  saveState();
  clearTimeout(window._rosterRenderTimeout);
  window._rosterRenderTimeout = setTimeout(renderRoster, 250);
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
  saveState(); renderRoster();
}
window.autoOptimizeRoster = autoOptimizeRoster;

export function updateMins(input) { updateMinsSlider(input); }
