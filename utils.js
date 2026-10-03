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

export function fR(w, l) {
  return w + '\u2013' + l;   // en-dash, matches original
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
// pick(array, ...args) — picks a random element from array; if it's a function,
// calls it with args (commentary templates), otherwise returns it as-is
// (e.g. pick(['man','2-3']) for scheme selection).
export function pick(arr) {
  var a = Array.prototype.slice.call(arguments, 1);
  var el = arr[ri(0, arr.length - 1)];
  return (typeof el === 'function') ? el.apply(null, a) : el;
}

// ── Tier Lookup ──────────────────────────────────────────
export function getTier(ovr) {
  for (var i = 0; i < TIERS.length; i++) {
    if (ovr >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[4];
}

// ── Player / Team Rating ─────────────────────────────────
// ── Overall rating scale ─────────────────────────────────
// The five skill ratings (sht fin def reb ply) drive the game engine and are
// unchanged. Overall is a weighted average of them, shown on a tighter scale
// so 90+ is rare and 99 is close to unreachable:
//   up to 60: unchanged · 60-90: compressed (x0.75) · above 90: a little steeper
// Rules that depend on overall convert back with oldOvr(), so game balance is
// identical to before the rescale (save v11).
export function rawOvr(p) {
  if (p.pos === 'PG') return p.sht * 0.25 + p.fin * 0.20 + p.def * 0.15 + p.reb * 0.10 + p.ply * 0.30;
  if (p.pos === 'SG') return p.sht * 0.30 + p.fin * 0.25 + p.def * 0.15 + p.reb * 0.15 + p.ply * 0.15;
  if (p.pos === 'SF') return p.sht * 0.22 + p.fin * 0.22 + p.def * 0.22 + p.reb * 0.17 + p.ply * 0.17;
  if (p.pos === 'PF') return p.sht * 0.15 + p.fin * 0.25 + p.def * 0.25 + p.reb * 0.25 + p.ply * 0.10;
  if (p.pos === 'C')  return p.sht * 0.10 + p.fin * 0.24 + p.def * 0.28 + p.reb * 0.28 + p.ply * 0.10;
  return p.sht * 0.22 + p.fin * 0.22 + p.def * 0.22 + p.reb * 0.17 + p.ply * 0.17;
}
export function scaleOvr(a) {
  var v = a <= 60 ? a : 60 + (a - 60) * 0.75 + (a > 90 ? (a - 90) * 0.6 : 0);
  return Math.max(1, Math.min(99, Math.round(v)));
}
// Inverse of scaleOvr (unrounded): new-scale overall -> old-scale overall
export function oldOvr(v) {
  if (v <= 60) return v;
  if (v <= 82.5) return 60 + (v - 60) / 0.75;
  return 90 + (v - 82.5) / 1.35;
}
export function getOvr(p) { return scaleOvr(rawOvr(p)); }

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
  // M9: 3PT/FT/TO splits + offensive rebounds wired through both sim paths so
  // the engine can be calibrated against real D1 bands (3P%, 3PA rate, FT%,
  // TO%, OR%). oreb is a subset of reb (kept separate for OR% measurement).
  return { gp: 0, pts: 0, reb: 0, oreb: 0, ast: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 0, stl: 0, blk: 0 };
}

// ── Team Style / Identity ────────────────────────────────
export function getTeamStyle(conf, ovr) {
  // Scheme identities (Campus Dynasty parity). Every team — CPU included —
  // gets an offensive and defensive scheme with REAL sim effects (see
  // simulation.js: schemePaceMod/schemeThreeMod/shooterWeight/runOnePoss).
  // Stored on team as t.strat = { off, def, identity }.
  var c = (conf || '').toLowerCase();
  var off = pick(['balanced', 'balanced', 'motion', 'drive', 'set', 'early']);
  var def = pick(['man', 'man', 'man', '2-3', '3-2', '1-3-1', 'box1']);
  // conference flavor
  if (c === 'acc' || c === 'big ten') {
    off = pick(['set', 'set', 'balanced', 'motion']); def = pick(['man', 'man', '3-2', '2-3']);
  } else if (c === 'big 12' || c === 'sec') {
    off = pick(['early', 'early', 'drive', 'balanced']); def = pick(['man', 'man', '1-3-1', 'box1']);
  } else if (c === 'big east') {
    off = pick(['set', 'drive', 'balanced', 'balanced']); def = pick(['man', 'man', '2-3']);
  } else if (c === 'wcc' || c === 'a-10' || c === 'mw' || c === 'mountain west') {
    off = pick(['early', 'motion', 'balanced', 'drive']); def = pick(['man', 'man', '1-3-1', '3-2']);
  } else if (ovr < 70) {
    off = pick(['early', 'motion', 'balanced']); def = pick(['2-3', '2-3', '1-3-1', 'man']);
  }
  if (ovr > 90 && ri(1, 100) <= 40) { off = 'balanced'; def = 'man'; }
  var onames = { balanced: 'Balanced', motion: 'Motion', drive: 'Drive & Kick', set: 'Set Play', early: 'Early Offense' };
  var dnames = { 'man': 'Man-to-Man', '2-3': '2-3 Zone', '3-2': '3-2 Zone', '1-3-1': '1-3-1 Zone', 'box1': 'Box-and-One' };
  return { off: off, def: def, identity: onames[off] + ' / ' + dnames[def] };
}

// ── Season awards (shared by the recap view and the record book) ──
// Award score: scoring first; boards and dimes count but don't dominate (raw
// pts+reb+ast handed every award to rebounders), plus a nudge for winning.
export function awardScore(p, t) {
  var gp = p.s.gp || 0;
  if (!gp) return 0;
  return (p.s.pts + p.s.reb * 0.45 + p.s.ast * 0.7) / gp
    + (t.wins / Math.max(1, t.wins + t.loss)) * 4;
}

// A real five: two guards, two forwards, one center, best available by
// .per (callers pass a list sorted best-first). Falls back to the best
// remaining player if a position group runs short. Returned best-first.
export function pickPositionalTeam(sorted, posOf) {
  posOf = posOf || function(x) { return x.pos; };
  var slots = { G: 2, F: 2, C: 1 };
  var grp = function(pos) { return (pos === 'PG' || pos === 'SG') ? 'G' : (pos === 'SF' || pos === 'PF') ? 'F' : 'C'; };
  var team = [];
  sorted.forEach(function(x) {
    var g = grp(posOf(x));
    if (team.length < 5 && slots[g] > 0) { slots[g]--; team.push(x); }
  });
  for (var i = 0; team.length < 5 && i < sorted.length; i++) {
    if (team.indexOf(sorted[i]) < 0) team.push(sorted[i]);
  }
  return team.sort(function(a, b) { return b.per - a.per; });
}

// Scores read winner-first, like a box score line: "W 78-71", "L 72-60".
export function fmtScore(a, b, sep) {
  sep = sep || '\u2013';
  return Math.max(a, b) + sep + Math.min(a, b);
}

// Win probability shown before a game (percent). Team overalls on the
// display scale; homeAdj: +4 home, -4 away, 0 neutral; dm: difficulty edge.
export function winProb(myOvr, oppOvr, homeAdj, dm) {
  var p = Math.round(50 + (oldOvr(myOvr) + (dm || 0) - oldOvr(oppOvr)) * 1.3 + (homeAdj || 0));
  return Math.max(5, Math.min(95, p));
}
