// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  BBGM-style roster: reorder with arrows, position = role.
//  Top 5 = Starters, 6-9 = Rotation, 10+ = Bench.
// ═══════════════════════════════════════════════════════════

import { ge, clamp } from '../utils.js';
import { G, saveState } from '../state.js';

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
  var starterCount = Math.min(t.rost.length, 5);
  var startersWithMins = t.rost.slice(0, 5).filter(function(p) { return p.mins > 0; }).length;
  var rosterValid = totalOk && startersWithMins === 5;

  var h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;">Depth Chart</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">Use arrows to reorder. Top 5 start. Sliders set minutes.</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="font-family:monospace;font-size:14px;font-weight:800;color:' + (totalOk ? 'var(--grn2)' : '#fc8181') + ';">'
    + total + '/200' + (totalOk ? '' : ' \u26a0') + '</div>'
    + '<div class="btn btn-red btn-sm" onclick="autoOptimizeRoster()" style="font-size:11px;padding:7px 16px;">AUTO SET</div>'
    + '</div></div>';

  // Validation warnings
  if (!rosterValid) {
    h += '<div style="padding:8px 12px;margin-bottom:10px;border-radius:5px;font-size:11px;font-weight:600;'
      + 'background:rgba(229,62,62,.08);border:1px solid rgba(229,62,62,.2);color:#fc8181;">';
    var warnings = [];
    if (!totalOk) warnings.push('Minutes must total exactly 200 (currently ' + total + ')');
    if (startersWithMins < 5) warnings.push('All 5 starters need minutes assigned (' + startersWithMins + '/5 have minutes)');
    h += warnings.join(' &bull; ');
    h += '</div>';
  }

  // Column headers
  h += '<div style="display:flex;align-items:center;padding:2px 0 6px;border-bottom:1px solid var(--bdr);margin-bottom:2px;">'
    + '<div style="width:44px;"></div>'                                    // arrows
    + '<div style="width:6px;"></div>'                                     // tier stripe
    + '<div style="width:28px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;"></div>'  // class
    + '<div style="width:28px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">POS</div>'
    + '<div style="flex:1;font-size:9px;color:var(--txt3);font-weight:700;padding-left:6px;">NAME</div>'
    + '<div style="width:36px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">OVR</div>'
    + '<div style="width:36px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">POT</div>'
    + '<div style="width:100px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">PPG / RPG / APG</div>'
    + '<div style="width:110px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">MINUTES</div>'
    + '<div style="width:30px;text-align:right;font-size:9px;color:var(--txt3);font-weight:700;">MIN</div>'
    + '</div>';

  // Render each player in roster order
  t.rost.forEach(function(p, i) {
    var tier = i < 5 ? 'starter' : i < 9 ? 'rotation' : 'bench';
    var tierCol = tier === 'starter' ? 'var(--blu)' : tier === 'rotation' ? 'var(--txt3)' : 'transparent';
    var gp = p.s.gp || 0;
    var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
    var rpg = gp ? (p.s.reb / gp).toFixed(1) : '--';
    var apg = gp ? (p.s.ast / gp).toFixed(1) : '--';
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
    var clsCol = p.cls === 'FR' ? 'var(--grn2)' : p.cls === 'SO' ? 'var(--gld2)' : p.cls === 'JR' ? '#63b3ed' : 'var(--txt3)';
    var fillPct = Math.round((p.mins / 40) * 100);

    // Separator between tiers
    if (i === 5 || i === 9) {
      var sepLabel = i === 5 ? 'ROTATION' : 'BENCH';
      var sepCol = i === 5 ? 'var(--txt3)' : 'var(--txt3)';
      h += '<div style="font-size:9px;font-weight:800;color:' + sepCol + ';letter-spacing:1.5px;padding:10px 0 4px 50px;border-bottom:1px solid var(--bdr);opacity:.6;">' + sepLabel + '</div>';
    }
    if (i === 0) {
      h += '<div style="font-size:9px;font-weight:800;color:var(--blu);letter-spacing:1.5px;padding:4px 0 4px 50px;border-bottom:1px solid var(--bdr);">STARTERS</div>';
    }

    h += '<div style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.025);'
      + (tier === 'starter' ? 'background:rgba(49,130,206,.04);' : '') + '">';

    // Up/Down arrows
    h += '<div style="width:44px;display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;">'
      + '<div onclick="rosterMove(' + i + ',-1)" style="cursor:' + (i > 0 ? 'pointer' : 'default') + ';color:' + (i > 0 ? 'var(--txt2)' : 'var(--bdr2)') + ';font-size:11px;line-height:1;user-select:none;padding:2px 6px;">\u25b2</div>'
      + '<div onclick="rosterMove(' + i + ',1)" style="cursor:' + (i < t.rost.length - 1 ? 'pointer' : 'default') + ';color:' + (i < t.rost.length - 1 ? 'var(--txt2)' : 'var(--bdr2)') + ';font-size:11px;line-height:1;user-select:none;padding:2px 6px;">\u25bc</div>'
      + '</div>';

    // Tier stripe
    h += '<div style="width:4px;height:32px;border-radius:2px;background:' + tierCol + ';flex-shrink:0;margin-right:6px;"></div>';

    // Class
    h += '<div style="width:28px;text-align:center;font-size:9px;font-weight:800;color:' + clsCol + ';flex-shrink:0;">' + p.cls + '</div>';

    // Position
    h += '<div class="pos-chip">' + p.pos + '</div>';

    // Name
    h += '<div style="flex:1;min-width:0;padding-left:6px;">'
      + '<div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</div>'
      + '</div>';

    // OVR
    h += '<div style="width:36px;text-align:center;font-family:monospace;font-size:13px;font-weight:800;color:var(--red);">' + p.ovr + '</div>';

    // Potential
    h += '<div style="width:36px;text-align:center;font-family:monospace;font-size:12px;font-weight:700;color:' + potCol + ';">' + pot + '</div>';

    // Stats
    h += '<div style="width:100px;text-align:center;font-family:monospace;font-size:10px;color:var(--txt2);">'
      + ppg + ' / ' + rpg + ' / ' + apg + '</div>';

    // Slider
    h += '<div style="width:110px;display:flex;align-items:center;">'
      + '<input type="range" min="0" max="40" value="' + p.mins + '" '
      + 'class="mins-slider ' + tier + '" '
      + 'style="--fill:' + fillPct + '%;" '
      + 'data-idx="' + i + '" '
      + 'oninput="updateMinsSlider(this)">'
      + '</div>';

    // Minutes number
    h += '<div style="width:30px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:'
      + (tier === 'starter' ? '#fff' : tier === 'rotation' ? 'var(--txt2)' : 'var(--txt3)') + ';">' + p.mins + '</div>';

    h += '</div>';
  });

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  MOVE PLAYER UP/DOWN
// ═══════════════════════════════════════════════════════════

export function rosterMove(idx, dir) {
  var t = G.teams[G.tid];
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= t.rost.length) return;

  // Swap
  var temp = t.rost[idx];
  t.rost[idx] = t.rost[newIdx];
  t.rost[newIdx] = temp;

  saveState();
  renderRoster();
}

window.rosterMove = rosterMove;

// ═══════════════════════════════════════════════════════════
//  SLIDER HANDLER
// ═══════════════════════════════════════════════════════════

export function updateMinsSlider(input) {
  var idx = parseInt(input.getAttribute('data-idx'));
  var val = clamp(parseInt(input.value) || 0, 0, 40);
  var t = G.teams[G.tid];
  var p = t.rost[idx];
  if (!p) return;

  // Hard cap: calculate what total would be with new value
  var oldVal = p.mins;
  var currentTotal = t.rost.reduce(function(s, pl) { return s + pl.mins; }, 0);
  var newTotal = currentTotal - oldVal + val;

  // If going up and would exceed 200, clamp to what's available
  if (val > oldVal && newTotal > 200) {
    var available = 200 - (currentTotal - oldVal);
    val = Math.max(0, available);
    input.value = val;
  }

  p.mins = val;
  input.style.setProperty('--fill', Math.round((val / 40) * 100) + '%');

  saveState();
  clearTimeout(window._rosterRenderTimeout);
  window._rosterRenderTimeout = setTimeout(renderRoster, 400);
}

window.updateMinsSlider = updateMinsSlider;

// ═══════════════════════════════════════════════════════════
//  AUTO-OPTIMIZE
//  Sorts by OVR, assigns starter/rotation/bench minutes.
// ═══════════════════════════════════════════════════════════

export function autoOptimizeRoster() {
  var t = G.teams[G.tid];

  // Sort roster by OVR descending — this determines order
  t.rost.sort(function(a, b) { return b.ovr - a.ovr; });

  // Assign minutes by position in list
  t.rost.forEach(function(p, i) {
    if (i < 5) p.mins = 32;          // Starters
    else if (i < 9) p.mins = 12;     // Rotation
    else p.mins = 0;                  // Bench
  });

  // Fix to 200
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

export function updateMins(input) {
  updateMinsSlider(input);
}
