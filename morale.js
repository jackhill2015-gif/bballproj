// ═══════════════════════════════════════════════════════════
//  HOOPS OS — morale.js
//  Ambient player morale system. No popups, no decisions —
//  pure background drama. Every player carries p.morale
//  (0-100, default 50). It drifts with results, streaks,
//  minutes-vs-quality, and class; feeds subtle sim modifiers,
//  transfer-portal probability, and a recruiting pitch bonus.
//
//  Pure functions + in-place team/player mutation. No imports
//  from game modules (avoids cycles); clamp is local.
// ═══════════════════════════════════════════════════════════

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export var MORALE_DEFAULT = 50;

// ── Mood tags (roster display only) ────────────────────────
export function moodTag(morale) {
  var m = (typeof morale === 'number') ? morale : MORALE_DEFAULT;
  if (m >= 85) return 'Locked In';
  if (m >= 70) return 'Happy';
  if (m >= 45) return 'Content';
  if (m >= 25) return 'Restless';
  return 'Checked Out';
}

// Pill colors for the roster tag: [background, text]
export function moodColors(morale) {
  var m = (typeof morale === 'number') ? morale : MORALE_DEFAULT;
  if (m >= 85) return ['#e8f2eb', '#2f6842'];  // locked in — green
  if (m >= 70) return ['#eaf0f7', '#3a5f8f'];  // happy — blue
  if (m >= 45) return ['#f0f2f5', '#5c6571'];  // content — gray
  if (m >= 25) return ['#f6f0e1', '#7a5c1b'];  // restless — amber
  return ['#f6eae8', '#a8473f'];               // checked out — red
}

// ── Sim modifier ───────────────────────────────────────────
// -2..+2 on shooting/finishing/defense, applied temporarily
// in simGame like the difficulty modifier. Subtle by design:
// a whole roster at 100 morale ≈ +2 team-wide, at 0 ≈ -2.
export function moraleAttrMod(p) {
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  return Math.round((m - 50) / 25);
}

// ── Post-game drift ────────────────────────────────────────
// Call once per team per completed game. Updates team.streak
// (positive = win streak, negative = losing streak) then
// drifts every rostered player's morale.
export function updateMoraleAfterGame(team, won) {
  if (!team) return;
  if (typeof team.streak !== 'number') team.streak = 0;
  team.streak = won
    ? (team.streak >= 0 ? team.streak + 1 : 1)
    : (team.streak <= 0 ? team.streak - 1 : -1);

  var total = team.wins + team.loss;
  var winPct = total > 0 ? team.wins / total : 0.5;
  var st = team.streak;

  (team.rost || []).forEach(function(p) {
    if (typeof p.morale !== 'number') p.morale = MORALE_DEFAULT;
    var d = 0;
    var mins = p.mins || 0;

    // Team result + streak magnitude
    if (won) {
      d += 2;
      if (st >= 3) d += 2;   // rolling
      if (st >= 6) d += 2;   // on fire
    } else {
      d -= 3;
      if (st <= -3) d -= 2;  // skid
      if (st <= -6) d -= 3;  // freefall
    }

    // Bench frustration: good player, no run
    var _o = oldOvr(p.ovr); // thresholds are on the pre-v11 overall scale
    if (_o >= 75 && mins < 12) d -= 3;
    else if (_o >= 70 && mins < 8) d -= 2;

    // Stars getting real run feel valued
    if (_o >= 78 && mins >= 25) d += 1;
    // Freshmen earning minutes
    if (p.cls === 'FR' && mins >= 15) d += 1;
    // Seniors on a contender — title-run energy
    if (p.cls === 'SR' && winPct > 0.65) d += 2;

    p.morale = clamp(Math.round(p.morale + d), 0, 100);
  });
}

// Convenience: record both sides of a finished game.
export function recordGameMorale(winner, loser) {
  updateMoraleAfterGame(winner, true);
  updateMoraleAfterGame(loser, false);
}

// ── Portal probability weight ──────────────────────────────
// Returns the entry probability for one unhappy/checked-out
// player. Lower morale → substantially more likely to bolt.
export function portalEntryChance(p) {
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  return 0.45 * (1.7 - m / 100);  // 0 → .77, 50 → .54, 100 → .32
}

// Morale-flavored portal reason (shown on the portal board).
export function moralePortalReason(p) {
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  if (m < 25) return 'Lost faith in program';
  if (oldOvr(p.ovr) >= 78 && (p.mins || 0) < 18) return 'Bigger role';
  return 'Playing time';
}

// ── Recruiting pitch ───────────────────────────────────────
// "Come start right away": true when the team has a restless
// (morale < 45) star (ovr ≥ 75) at the recruit's position —
// the pitch is that the job is opening up.
export function hasRestlessStarAt(team, pos) {
  if (!team || !team.rost || !pos) return false;
  return team.rost.some(function(pl) {
    var pm = (typeof pl.morale === 'number') ? pl.morale : MORALE_DEFAULT;
    return pl.pos === pos && oldOvr(pl.ovr) >= 75 && pm < 45;
  });
}

// Pre-v11 overall scale (copy of utils.oldOvr; this module has no imports)
function oldOvr(v) { return v <= 60 ? v : v <= 82.5 ? 60 + (v - 60) / 0.75 : 90 + (v - 82.5) / 1.35; }
