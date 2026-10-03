// ═══════════════════════════════════════════════════════════
//  HOOPS OS — facilities.js
//  Three upgrade tracks paid with NIL. Each level is a small,
//  permanent edge for the program you're coaching:
//    Practice facility — players develop faster in the offseason
//    Arena             — stronger home court + more weekly NIL
//    Training room     — injured players return sooner
//  Facilities belong to the school; take a new job and you start
//  over with that school's (CPU-built) level.
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';

export var FACILITY_MAX = 5;
export var FACILITIES = [
  { id: 'practice', name: 'Practice facility', effect: function(l) { return l ? '+' + l + ' development each offseason' : 'No bonus yet'; } },
  { id: 'arena', name: 'Arena', effect: function(l) { return l ? 'Home court +' + (l * 0.5).toFixed(1) + ', +' + (l * 3) + ' NIL a week' : 'No bonus yet'; } },
  { id: 'training', name: 'Training room', effect: function(l) { return l ? (l * 15) + '% chance each week an injured player heals faster' : 'No bonus yet'; } }
];

// Cost of the next level (NIL)
export function upgradeCost(level) { return 120 + level * 90; }

// Facilities are stored per school id so changing jobs is handled cleanly.
// A CPU program's starting level comes from its prestige.
export function facilitiesFor(tid) {
  if (!G.facilities || typeof G.facilities !== 'object') G.facilities = {};
  if (!G.facilities[tid]) {
    var t = G.teams[tid];
    var base = Math.max(0, Math.min(3, Math.floor(((t && t.schoolPrestige) || 50) / 25) - 1));
    G.facilities[tid] = { practice: base, arena: base, training: base };
  }
  return G.facilities[tid];
}
export function myFacilities() { return facilitiesFor(G.tid); }

export function upgradeFacility(id) {
  var f = myFacilities();
  var lvl = f[id] || 0;
  if (lvl >= FACILITY_MAX) return { ok: false, msg: 'Already at the top level.' };
  var cost = upgradeCost(lvl);
  if ((G.pts || 0) < cost) return { ok: false, msg: 'Not enough NIL (' + cost + ' needed).' };
  G.pts -= cost;
  f[id] = lvl + 1;
  return { ok: true, cost: cost, level: f[id] };
}

// ── Effects (read by the engine) ──
export function practiceBonus(tid) { return facilitiesFor(tid).practice || 0; }       // growth points
export function arenaBonus(tid) { return (facilitiesFor(tid).arena || 0) * 0.5; }      // shooting % at home
export function arenaNil(tid) { return (facilitiesFor(tid).arena || 0) * 3; }         // NIL per week
export function trainingChance(tid) { return (facilitiesFor(tid).training || 0) * 0.15; }
