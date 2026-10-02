// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/strategy.js
//  Pre-game strategy HQ: Schemes / Rotation / Usage tabs.
//  Mirrors the Campus Dynasty Strategy screen rhythm from
//  jack's screenshots: bold name + one-line gray description
//  + blue circular checkmark on the selected scheme.
//  Live games are watch-only — ALL coaching happens here.
// ═══════════════════════════════════════════════════════════

import { ge, clamp } from '../utils.js';
import { G, saveState } from '../state.js';
import { toast, navTo } from '../ui.js';

// ── Scheme catalog (jack's Campus Dynasty reference) ─────
var OFFENSE = [
  { name: 'Balanced', desc: 'Balance offensive attack' },
  { name: 'Motion', desc: 'Utilize everyone to create open shots' },
  { name: 'Drive', desc: 'Run through your point guard' },
  { name: 'Set', desc: 'Slow-paced, post-focused' },
  { name: 'Early', desc: 'Fast-paced, perimeter focused' }
];
var DEFENSE = [
  { name: 'Man-to-Man', desc: 'Traditional man-to-man' },
  { name: '2-3 Zone', desc: 'Eliminate inside threats' },
  { name: '3-2 Zone', desc: 'Eliminate outside threats' },
  { name: '1-3-1 Zone', desc: 'Pressure guards' },
  { name: 'Box-and-One', desc: 'Lock down opposing star' }
];

// Map CD scheme names onto the sim's existing strat fields so
// picks have immediate effect. The CD name is stored as the
// source of truth (t.strat.offScheme / defScheme) for the
// sim agent to consume directly later.
var OFF_MAP = {
  'Balanced': { focus: 'balanced', pace: 'balanced' },
  'Motion': { focus: 'balanced', pace: 'balanced' },
  'Drive': { focus: 'perimeter', pace: 'fast' },
  'Set': { focus: 'paint', pace: 'slow' },
  'Early': { focus: 'perimeter', pace: 'fast' }
};
var DEF_MAP = {
  'Man-to-Man': 'man',
  '2-3 Zone': 'zone',
  '3-2 Zone': 'zone',
  '1-3-1 Zone': 'zone',
  'Box-and-One': 'box'
};

// Default usage by position (0-100). A standard five-man
// lineup sums to ~100 = share of offensive possessions.
var USAGE_DEFAULT = { PG: 24, SG: 22, SF: 20, PF: 18, C: 16 };

var _tab = 'schemes';

function ensureDefaults(t) {
  if (!t.strat) t.strat = {};
  if (!t.strat.offScheme) t.strat.offScheme = 'Motion';
  if (!t.strat.defScheme) t.strat.defScheme = '2-3 Zone';
  applySchemeMap(t);
  t.rost.forEach(function(p) {
    if (typeof p.usage !== 'number') p.usage = USAGE_DEFAULT[p.pos] || 20;
  });
}

function applySchemeMap(t) {
  var om = OFF_MAP[t.strat.offScheme];
  if (om) { t.strat.focus = om.focus; t.strat.pace = om.pace; }
  var dm = DEF_MAP[t.strat.defScheme];
  if (dm) t.strat.def = dm;
}

export function setStrategyTab(tab) { _tab = tab; renderStrategy(); }

function tabBar() {
  var tabs = [['schemes', 'Schemes'], ['rotation', 'Rotation'], ['usage', 'Usage']];
  var h = '<div class="strat-tabs" role="tablist" aria-label="Strategy sections">';
  tabs.forEach(function(t) {
    h += '<button class="strat-tab' + (_tab === t[0] ? ' on' : '') + '" role="tab" data-stab="' + t[0] + '">' + t[1] + '</button>';
  });
  return h + '</div>';
}

function schemeRows(list, kind, picked) {
  var h = '';
  list.forEach(function(s) {
    var isP = picked === s.name;
    h += '<button class="scheme-row' + (isP ? ' picked' : '') + '" data-spick="' + kind + '" data-sname="' + s.name + '">'
      + '<span class="sm-body"><span class="sm-name">' + s.name + '</span>'
      + '<span class="sm-desc" style="display:block;">' + s.desc + '</span></span>'
      + '<span class="scheme-check">' + (isP ? '✓' : '') + '</span></button>';
  });
  return h;
}

function schemesTab(t) {
  return '<div class="strat-sec-label">Offense</div>'
    + schemeRows(OFFENSE, 'off', t.strat.offScheme)
    + '<div class="strat-sec-label">Defense</div>'
    + schemeRows(DEFENSE, 'def', t.strat.defScheme)
    + '<div style="font-size:12px;color:var(--txt3);margin-top:12px;">Applies to your next game. Live games are watch-only — set your identity here.</div>';
}

function rotationTab(t) {
  var order = t.rost.slice().sort(function(a, b) { return b.mins - a.mins; });
  var h = '<div class="strat-sec-label">Starters</div>';
  order.slice(0, 5).forEach(function(p, i) {
    h += rotRow(i + 1, p);
  });
  h += '<div class="strat-sec-label">Bench</div>';
  order.slice(5, 9).forEach(function(p, i) {
    h += rotRow(i + 6, p);
  });
  var rest = order.slice(9);
  if (rest.length) {
    h += '<div class="strat-sec-label">Reserves</div>';
    rest.forEach(function(p, i) { h += rotRow(i + 10, p); });
  }
  h += '<button class="btn btn-ghost btn-full" style="margin-top:12px;" data-snav="roster">EDIT MINUTES IN ROSTER VIEW</button>';
  return h;
}

function rotRow(n, p) {
  return '<div class="rot-row"><div class="rot-rank">' + n + '</div>'
    + '<div class="rot-name">' + p.name + ' <span style="font-weight:400;color:var(--txt3);font-size:11px;">' + p.pos + ' · OVR ' + p.ovr + '</span></div>'
    + '<div class="rot-meta">' + p.mins + ' min</div></div>';
}

function usageTab(t) {
  var order = t.rost.slice().sort(function(a, b) { return b.mins - a.mins; });
  var total = t.rost.reduce(function(s, p) { return s + (p.usage || 0); }, 0);
  var h = '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px;">Share of offensive possessions each player consumes while on the floor. Aim for your main five to total ~100.</div>';
  order.forEach(function(p) {
    var u = clamp(Math.round(p.usage || 0), 0, 100);
    h += '<div class="usage-row" data-urow="' + p.name + '">'
      + '<div class="u-id"><div class="u-name">' + p.name + '</div>'
      + '<div class="u-sub">' + p.pos + ' · ' + p.cls + ' · ' + p.mins + ' min</div></div>'
      + '<input type="range" min="0" max="100" value="' + u + '" data-usage="' + p.name + '" aria-label="Usage for ' + p.name + '">'
      + '<div class="u-val" data-uval="' + p.name + '">' + u + '</div></div>';
  });
  h += '<div class="usage-total"><span>Roster total</span><b style="font-family:var(--mono);" data-utotal>' + total + '</b></div>'
    + '<button class="btn btn-ghost btn-full" data-sreset>RESET TO DEFAULTS</button>';
  return h;
}

export function renderStrategy() {
  var el = ge('strategy-content');
  if (!el) return;
  var t = G.teams[G.tid];
  if (!t) return;
  ensureDefaults(t);

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Strategy</div>'
    + '<div class="sec-sub">' + t.name + ' · set your identity before tip-off</div></div>';
  h += tabBar();
  if (_tab === 'schemes') h += schemesTab(t);
  else if (_tab === 'rotation') h += rotationTab(t);
  else h += usageTab(t);
  el.innerHTML = h;
  bindContainer(el, t);
}

function findPlayer(t, name) {
  for (var i = 0; i < t.rost.length; i++) if (t.rost[i].name === name) return t.rost[i];
  return null;
}

function bindContainer(el, t) {
  // Container-level delegation: no inline handlers, no per-row listeners.
  el.onclick = function(e) {
    var stab = e.target.closest ? e.target.closest('[data-stab]') : null;
    if (stab) { setStrategyTab(stab.getAttribute('data-stab')); return; }
    var sp = e.target.closest ? e.target.closest('[data-spick]') : null;
    if (sp) {
      var kind = sp.getAttribute('data-spick'), name = sp.getAttribute('data-sname');
      if (kind === 'off') t.strat.offScheme = name;
      else t.strat.defScheme = name;
      applySchemeMap(t);
      saveState();
      toast((kind === 'off' ? 'Offense' : 'Defense') + ': ' + name, 'var(--blu)');
      renderStrategy();
      return;
    }
    var sn = e.target.closest ? e.target.closest('[data-snav]') : null;
    if (sn) { navTo(sn.getAttribute('data-snav')); return; }
    if (e.target.closest && e.target.closest('[data-sreset]')) {
      t.rost.forEach(function(p) { p.usage = USAGE_DEFAULT[p.pos] || 20; });
      saveState();
      renderStrategy();
      return;
    }
  };
  el.oninput = function(e) {
    var s = e.target.closest ? e.target.closest('[data-usage]') : null;
    if (!s) return;
    var p = findPlayer(t, s.getAttribute('data-usage'));
    if (!p) return;
    p.usage = clamp(parseInt(s.value, 10) || 0, 0, 100);
    // In-place label update — no re-render while dragging.
    var lab = el.querySelector('[data-uval="' + p.name + '"]');
    if (lab) lab.textContent = p.usage;
    var tot = el.querySelector('[data-utotal]');
    if (tot) tot.textContent = t.rost.reduce(function(sum, x) { return sum + (x.usage || 0); }, 0);
  };
  el.onchange = function(e) {
    if (e.target.closest && e.target.closest('[data-usage]')) saveState();
  };
}
