// ═══════════════════════════════════════════════════════════
//  HOOPS OS — utils.js
//  Pure helpers. No DOM. No state mutation.
//  Everything here is deterministic or uses only Math.random.
// ═══════════════════════════════════════════════════════════

import { FN, LN, TIERS, CLS } from './constants.js';

// ── Math / Formatting ────────────────────────────────────
export function ri(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function pct(a, b) {
  return b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '--';
}

export function fR(w, l) {
  return w + '\u2013' + l;   // en-dash, matches original
}

export function fmtR(w, l) {
  return w + '-' + l;
}

export function ord(n) {
  return n + ([, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th');
}

// ── DOM Shortcuts ────────────────────────────────────────
// These touch the DOM but are pure "write to element" helpers
// with no dependency on game state.
export function ge(id) {
  return document.getElementById(id);
}

export function txt(id, v) {
  var e = ge(id);
  if (e) e.textContent = v;
}

export function html(id, v) {
  var e = ge(id);
  if (e) e.innerHTML = v;
}

// ── Name Generator ───────────────────────────────────────
export function gn() {
  return FN[ri(0, FN.length - 1)] + ' ' + LN[ri(0, LN.length - 1)];
}

// ── Commentary Picker ────────────────────────────────────
// pick(array, ...args) — picks a random function from array and calls it
export function pick(arr) {
  var a = Array.prototype.slice.call(arguments, 1);
  return arr[ri(0, arr.length - 1)].apply(null, a);
}

// ── Tier Lookup ──────────────────────────────────────────
export function getTier(ovr) {
  for (var i = 0; i < TIERS.length; i++) {
    if (ovr >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[4];
}

// ── Player / Team Rating ─────────────────────────────────
export function getOvr(p) {
  return Math.round(p.sht * 0.28 + p.fin * 0.22 + p.def * 0.22 + p.reb * 0.12 + p.ply * 0.16);
}

export function getTOvr(t) {
  var act = t.rost.filter(function(p) { return p.mins > 0; });
  if (!act.length) {
    return Math.round(
      t.rost.reduce(function(a, b) { return a + b.ovr; }, 0) /
      Math.max(1, t.rost.length)
    );
  }
  var wt = 0, m = 0;
  act.forEach(function(p) { wt += p.ovr * p.mins; m += p.mins; });
  return Math.round(wt / m);
}

// ── Roster Helpers ───────────────────────────────────────
export function fixMins(rost) {
  rost.forEach(function(p, i) { p.mins = i < 5 ? 30 : i < 9 ? 12 : 0; });
  var diff = 200 - rost.reduce(function(a, b) { return a + b.mins; }, 0);
  if (rost[4]) rost[4].mins = Math.max(1, rost[4].mins + diff);
}

export function freshS() {
  return { gp: 0, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, stl: 0, blk: 0 };
}

// ── Team Style / Identity ────────────────────────────────
export function getTeamStyle(conf, ovr) {
  var c = conf.toLowerCase();
  var style = { pace: 'balanced', focus: 'balanced', def: 'man', identity: 'Standard' };

  if (c === 'acc' || c === 'big ten') {
    style.pace = 'slow'; style.def = 'man'; style.identity = 'Hardwood Grind';
    style.focus = ovr > 82 ? 'perimeter' : 'balanced';
  } else if (c === 'big 12' || c === 'sec') {
    style.pace = 'fast'; style.focus = 'paint'; style.def = 'press'; style.identity = 'Power & Pressure';
  } else if (c === 'wcc' || c === 'a-10') {
    style.pace = 'fast'; style.focus = 'perimeter'; style.def = 'man'; style.identity = 'Run & Gun';
  } else if (c === 'mw' || c === 'mountain west') {
    style.pace = 'fast'; style.focus = 'perimeter'; style.def = 'man'; style.identity = 'Run & Gun';
  } else if (c === 'big east') {
    style.pace = 'slow'; style.focus = 'paint'; style.def = 'man'; style.identity = 'Physical East';
  } else if (ovr < 70) {
    style.pace = 'slow'; style.focus = 'perimeter'; style.def = 'zone'; style.identity = 'Cinderella Tactics';
  } else if (ovr < 78) {
    style.pace = 'balanced'; style.focus = 'perimeter'; style.def = 'zone'; style.identity = 'Grind & Grind';
  }
  if (ovr > 90) { style.identity = 'The Machine'; style.focus = 'balanced'; }
  return style;
}
