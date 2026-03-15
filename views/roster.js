// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/roster.js
//  Roster management: 3-tier depth chart with sliders,
//  OVR + Potential, per-game stats, auto-optimize.
// ═══════════════════════════════════════════════════════════

import { ge, txt, clamp, getOvr } from '../utils.js';
import { G, saveState } from '../state.js';

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

export function renderRoster() {
  var el = ge('roster-content');
  if (!el) return;
  var t = G.teams[G.tid];
  if (!t) return;

  var sorted = t.rost.slice().sort(function(a, b) { return b.mins - a.mins; });
  var total = t.rost.reduce(function(a, b) { return a + b.mins; }, 0);
  var totalOk = total === 200;

  // 3-tier split
  var starters = sorted.filter(function(p) { return p.mins >= 25; });
  var rotation = sorted.filter(function(p) { return p.mins >= 8 && p.mins < 25; });
  var bench    = sorted.filter(function(p) { return p.mins < 8; });

  var h = '';

  // ── Header ──
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;">Depth Chart</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">Drag sliders to set minutes. Total must equal 200.</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;">'
    + '<div style="font-family:monospace;font-size:14px;font-weight:800;color:' + (totalOk ? 'var(--grn2)' : '#fc8181') + ';">'
    + total + '/200' + (totalOk ? '' : ' \u26a0') + '</div>'
    + '<div class="btn btn-ghost btn-sm" onclick="autoOptimizeRoster()" style="font-size:10px;">AUTO SET</div>'
    + '</div></div>';

  // ── Table header ──
  h += '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;margin-bottom:2px;">'
    + '<div style="width:28px;"></div>'
    + '<div style="width:26px;"></div>'
    + '<div style="flex:1;font-size:9px;color:var(--txt3);font-weight:700;letter-spacing:.5px;">PLAYER</div>'
    + '<div style="width:34px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">OVR</div>'
    + '<div style="width:34px;text-align:center;font-size:9px;color:var(--txt3);font-weight:700;">POT</div>'
    + '<div style="width:110px;font-size:9px;color:var(--txt3);font-weight:700;text-align:center;">PPG / RPG / APG</div>'
    + '<div style="width:120px;font-size:9px;color:var(--txt3);font-weight:700;text-align:center;">MINUTES</div>'
    + '<div style="width:30px;text-align:right;font-size:9px;color:var(--txt3);font-weight:700;">MIN</div>'
    + '</div>';

  // ── Render tier ──
  function renderTier(label, labelCol, players, tierClass) {
    h += '<div style="margin-bottom:4px;">';
    h += '<div style="font-size:10px;font-weight:800;color:' + labelCol + ';letter-spacing:1.5px;text-transform:uppercase;padding:8px 10px 4px;border-bottom:1px solid var(--bdr);">' + label + '</div>';

    if (!players.length) {
      h += '<div style="padding:8px 10px;font-size:11px;color:var(--txt3);font-style:italic;">No players in this tier</div>';
    }

    players.forEach(function(p) {
      var gp = p.s.gp || 0;
      var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
      var rpg = gp ? (p.s.reb / gp).toFixed(1) : '--';
      var apg = gp ? (p.s.ast / gp).toFixed(1) : '--';
      var pot = p.pot || p.ovr;
      var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
      var fillPct = Math.round((p.mins / 40) * 100);
      var idx = t.rost.indexOf(p);

      h += '<div class="player-row-edit">';

      // Class badge
      h += '<div style="width:28px;text-align:center;flex-shrink:0;">'
        + '<div style="font-size:9px;font-weight:800;color:' + (p.cls === 'FR' ? 'var(--grn2)' : p.cls === 'SO' ? 'var(--gld2)' : p.cls === 'JR' ? 'var(--blu2)' : 'var(--txt3)') + ';">' + p.cls + '</div>'
        + '</div>';

      // Position chip
      h += '<div class="pos-chip">' + p.pos + '</div>';

      // Name
      h += '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</div>'
        + '</div>';

      // OVR
      h += '<div style="width:34px;text-align:center;font-family:monospace;font-size:13px;font-weight:800;color:var(--red);">' + p.ovr + '</div>';

      // Potential
      h += '<div style="width:34px;text-align:center;font-family:monospace;font-size:12px;font-weight:700;color:' + potCol + ';">' + pot + '</div>';

      // Stats
      h += '<div style="width:110px;text-align:center;font-family:monospace;font-size:11px;color:var(--txt2);">'
        + ppg + ' / ' + rpg + ' / ' + apg
        + '</div>';

      // Slider
      h += '<div style="width:120px;display:flex;align-items:center;">'
        + '<input type="range" min="0" max="40" value="' + p.mins + '" '
        + 'class="mins-slider ' + tierClass + '" '
        + 'style="--fill:' + fillPct + '%;" '
        + 'data-idx="' + idx + '" '
        + 'oninput="updateMinsSlider(this)">'
        + '</div>';

      // Minutes number
      h += '<div style="width:30px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:' + (p.mins >= 25 ? '#fff' : p.mins >= 8 ? 'var(--txt2)' : 'var(--txt3)') + ';">' + p.mins + '</div>';

      h += '</div>';
    });
    h += '</div>';
  }

  renderTier('Starters', 'var(--blu)', starters, 'starter');
  renderTier('Rotation', 'var(--txt2)', rotation, 'rotation');
  renderTier('Bench', 'var(--txt3)', bench, 'bench');

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  SLIDER HANDLER
// ═══════════════════════════════════════════════════════════

export function updateMinsSlider(input) {
  var idx = parseInt(input.getAttribute('data-idx'));
  var val = clamp(parseInt(input.value) || 0, 0, 40);
  var t = G.teams[G.tid];
  var p = t.rost[idx];
  if (p) p.mins = val;

  // Update slider fill visually
  input.style.setProperty('--fill', Math.round((val / 40) * 100) + '%');

  saveState();
  // Debounced re-render so tiers update as you drag
  clearTimeout(window._rosterRenderTimeout);
  window._rosterRenderTimeout = setTimeout(renderRoster, 300);
}

window.updateMinsSlider = updateMinsSlider;

// ═══════════════════════════════════════════════════════════
//  AUTO-OPTIMIZE
//  Assigns minutes by OVR, 5 starters ~30min, 4 rotation ~12min
// ═══════════════════════════════════════════════════════════

export function autoOptimizeRoster() {
  var t = G.teams[G.tid];
  var sorted = t.rost.slice().sort(function(a, b) { return b.ovr - a.ovr; });

  sorted.forEach(function(p, i) {
    if (i < 5) p.mins = 30;          // Starters
    else if (i < 9) p.mins = 12;     // Rotation
    else p.mins = 0;                  // Bench
  });

  // Fix to exactly 200
  var total = t.rost.reduce(function(a, b) { return a + b.mins; }, 0);
  var diff = 200 - total;
  if (sorted[4]) sorted[4].mins = Math.max(1, sorted[4].mins + diff);

  saveState();
  renderRoster();
}

window.autoOptimizeRoster = autoOptimizeRoster;

// ═══════════════════════════════════════════════════════════
//  LEGACY — kept for backward compat
// ═══════════════════════════════════════════════════════════

export function updateMins(input) {
  var val = clamp(parseInt(input.value) || 0, 0, 40);
  input.value = val;
  var idx = parseInt(input.getAttribute('data-idx') || input.getAttribute('data-pid'));
  var t = G.teams[G.tid];
  if (t.rost[idx]) t.rost[idx].mins = val;
  saveState();
  renderRoster();
}
