// ═══════════════════════════════════════════════════════════
//  HOOPS OS — recruitpool.js
//  The high-school recruit pool and CPU recruiting classes.
//
//  The pool is about 4.2 recruits per team, enough for every program to
//  replace the players it loses (real D1 signs well over a thousand
//  high-school players a year). Its talent mirrors the league's: each
//  recruit is drawn at the level of a random program, then stars go by
//  national rank. Each recruit's rival schools are programs near his
//  level, better programs reaching down further, so prestige and recent
//  results still pull the best players.
//
//  CPU teams sign real classes: a school only signs while it has room
//  (its roster target minus returners), so nobody hoards recruits and
//  every roster ends near 13-15. Recruits left over after signing day
//  fill late holes; a generated freshman is a last resort.
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';
import { ri, oldOvr, freshS } from './utils.js';
import { genPlayer } from './simulation.js';
import { POS, RECRUIT_STATE_POOL } from './constants.js';

export var POOL_PER_TEAM = 4.2;
// Stars by national rank, per team in the league (365 teams: 25 five-stars,
// 110 four-stars, 330 three-stars, 520 two-stars, the rest one-star)
export var STAR_CUTS = [[5, 0.07], [4, 0.37], [3, 1.27], [2, 2.7]];
export var CPU_MIN_ROSTER = 13;
export var CPU_CLASS_CAP = 8; // most freshmen a school adds in one year

function shuffle(a) {
  for (var j = a.length - 1; j > 0; j--) { var k = ri(0, j); var t = a[j]; a[j] = a[k]; a[k] = t; }
  return a;
}
// Programs by recruiting pull, best first: half current strength (the
// ranking score), half school prestige, each as standard scores. A
// blueblood's down year costs it some recruits, not its place; a rising
// school climbs as it wins.
export var PULL_PRESTIGE = 0.5;
// Each school also has a good or bad recruiting year (staff, a key visit,
// a hot class), fixed for the offseason: a swing of about this many
// standard scores. It lets programs rise and fall instead of recruiting in
// the same order every year.
export var PULL_FORM = 0.35;
function recruitingForm(t) {
  var u = 0;
  for (var k = 1; k <= 3; k++) { var x = Math.sin((t.id + 1) * 12.9898 * k + G.yr * 78.233) * 43758.5453; u += x - Math.floor(x); }
  return (u - 1.5) * 2; // about -1 to 1 (sd 1)
}
export function rankedTeams() {
  var z = function(f) {
    var v = G.teams.map(f), m = v.reduce(function(a, b) { return a + b; }, 0) / Math.max(1, v.length);
    var sd = Math.sqrt(v.reduce(function(a, b) { return a + (b - m) * (b - m); }, 0) / Math.max(1, v.length)) || 1;
    return function(t) { return (f(t) - m) / sd; };
  };
  var zp = z(function(t) { return t.pts || 0; }), zs = z(function(t) { return t.schoolPrestige || 50; });
  var pull = {};
  G.teams.forEach(function(t) { pull[t.id] = (1 - PULL_PRESTIGE) * zp(t) + PULL_PRESTIGE * zs(t) + PULL_FORM * recruitingForm(t); });
  return G.teams.slice().sort(function(a, b) { return pull[b.id] - pull[a.id]; });
}
// The program rank (0 = best) a recruit this good usually signs with
export function recruitLevel(r) {
  var per = Math.max(1, (G.recruits.length || G.teams.length * POOL_PER_TEAM) / Math.max(1, G.teams.length));
  return ((r.natRank || 1) - 1) / per;
}

// Talent: POOL_CORE recruits per team at that school's level, pulled a
// little toward the middle (POOL_SPREAD) because the best recruits end up at
// the best programs, which widens the gap between them; the rest are extra
// recruits at the level of the weakest quarter of the league, so every
// school can fill its class without the pool's average drifting up.
export var POOL_CORE = 3.6, POOL_SPREAD = 0.85;
export function genRecruitPool() {
  var nt = G.teams.length, n = Math.round(nt * POOL_PER_TEAM);
  // Old saves with thin rosters need more: at least 15% over every class
  var demand = G.teams.reduce(function(a, t) { return a + (t.id === G.tid ? 4 : cpuClassSize(t)); }, 0);
  n = Math.max(n, Math.round(demand * 1.15));
  var bases = G.teams.map(function(t) { return t.baseOvr || 66; }).sort(function(a, b) { return a - b; });
  var avg = bases.reduce(function(a, b) { return a + b; }, 0) / Math.max(1, nt);
  var core = Math.round(nt * POOL_CORE), low = Math.max(1, Math.floor(nt / 4));
  var list = [];
  for (var i = 0; i < n; i++) {
    var tb = i < core ? bases[i % nt] : bases[ri(0, low - 1)];
    var base = Math.round(avg + (tb - avg) * POOL_SPREAD) + ri(-2, 2);
    var r = genPlayer(base, POS[ri(0, 4)], 'FR');
    r.interest = ri(0, 25); r.signed = -1; r.points = 0; r.status = 'open';
    r.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
    list.push(r);
  }
  list.sort(function(a, b) { return b.ovr - a.ovr; });
  var nt = G.teams.length, posCount = {};
  list.forEach(function(r, idx) {
    r.id = idx; r.natRank = idx + 1;
    r.stars = 1;
    for (var s = 0; s < STAR_CUTS.length; s++) if (idx < Math.round(STAR_CUTS[s][1] * nt)) { r.stars = STAR_CUTS[s][0]; break; }
    posCount[r.pos] = (posCount[r.pos] || 0) + 1;
    r.posRank = posCount[r.pos];
  });
  G.recruits = list;
  // Rival schools: 3-5 programs around his level. A recruit who usually
  // lands at the #40 program hears from roughly #18-#72.
  var ranked = rankedTeams().filter(function(t) { return t.id !== G.tid; });
  list.forEach(function(r) {
    var lvl = recruitLevel(r);
    var lo = Math.max(0, Math.floor(lvl * 0.5) - 2);
    var hi = Math.min(ranked.length, Math.ceil(lvl * 1.5) + 12);
    r.rivals = shuffle(ranked.slice(lo, hi)).slice(0, ri(3, 5)).map(function(t) { return { tid: t.id, name: t.name }; });
  });
  return list;
}

// ── CPU class room ──
// Each CPU school aims for 13-15 players (varies by school and year).
export function cpuTarget(t) { return 13 + ((t.id * 7 + G.yr) % 3); }
function returners(t) {
  return (t.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs) && p._draftYr !== G.yr; }).length;
}
// Class size a CPU school signs this year: halfway between what it loses
// and an even class (target / 4), so one big senior class doesn't come back
// as a big freshman class every four years; the roster absorbs the
// difference, always ending at 13-15.
export function cpuClassSize(t) {
  var ret = returners(t), tgt = cpuTarget(t);
  var n = Math.round(((tgt - ret) + tgt / 4) / 2);
  return Math.max(Math.max(0, CPU_MIN_ROSTER - ret), Math.min(n, 15 - ret));
}
// Spots each CPU school still has for this year's class, minus who already
// signed.
export function cpuRoomMap() {
  var room = {};
  G.teams.forEach(function(t) {
    if (t.id === G.tid) return;
    room[t.id] = cpuClassSize(t);
  });
  (G.recruits || []).forEach(function(r) {
    if (r.signed >= 0 && room[r.signed] !== undefined) room[r.signed]--;
  });
  return room;
}

// Where a recruit the user didn't land signs. bids: the CPU schools in his
// race ({ tid, name, bid }). mode 'weighted' draws by bid (early signings),
// 'best' takes the top bid (signing day). Only schools with room count; if
// none of his suitors has room he signs with the nearest program at his
// level that does. Updates room. Returns { tid, name } or null.
export function cpuLanding(r, bids, room, mode, ranked) {
  var open = (bids || []).filter(function(s) { return (room[s.tid] || 0) > 0; });
  var win = null, i;
  if (open.length) {
    if (mode === 'best') {
      win = open[0];
      for (i = 1; i < open.length; i++) if (open[i].bid > win.bid) win = open[i];
    } else {
      var tot = 0; for (i = 0; i < open.length; i++) tot += open[i].bid;
      var roll = Math.random() * tot, acc = 0; win = open[0];
      for (i = 0; i < open.length; i++) { acc += open[i].bid; if (roll <= acc) { win = open[i]; break; } }
    }
    win = { tid: win.tid, name: win.name };
  } else {
    var list = (ranked || rankedTeams()).filter(function(t) { return t.id !== G.tid; });
    var at = Math.min(list.length - 1, Math.round(recruitLevel(r)));
    for (var d = 0; d < list.length && !win; d++) {
      var a = list[at + d], b = list[at - d];
      if (a && (room[a.id] || 0) > 0) win = { tid: a.id, name: a.name };
      else if (b && d && (room[b.id] || 0) > 0) win = { tid: b.id, name: b.name };
    }
  }
  if (win) room[win.tid] = (room[win.tid] || 0) - 1;
  return win;
}

// A signed recruit becomes a freshman on his new roster (keeps stars and
// signed, like your own signees; the recruiting race is dropped)
export function recruitToPlayer(r) {
  var p = JSON.parse(JSON.stringify(r));
  delete p.rivals; delete p.points; delete p._schools; delete p._schoolsPhase;
  p.cls = 'FR'; p.mins = 0;
  return p;
}

// Late signings: CPU schools still owed players (need: tid -> count) sign
// the best recruits nobody took, best programs first with a little shuffle.
// Returns the number signed.
export function fillCpuClasses(need, freshS) {
  var needy = rankedTeams().filter(function(t) {
    if (t.id === G.tid) return false;
    var fr = t.rost.filter(function(p) { return p.cls === 'FR' && p.stars !== undefined; }).length;
    need[t.id] = Math.min(need[t.id] || 0, CPU_CLASS_CAP - fr, 15 - t.rost.length);
    return need[t.id] > 0;
  });
  if (!needy.length) return 0;
  var left = (G.recruits || []).filter(function(r) {
    return r.status !== 'committed' && !(r.signed >= 0 && G.teams[r.signed]);
  }).sort(function(a, b) { return b.ovr - a.ovr; });
  var n = 0;
  for (var i = 0; i < left.length && needy.length; i++) {
    var t = needy[ri(0, Math.min(needy.length, 6) - 1)];
    var r = left[i];
    r.signed = t.id; r.status = 'gone'; r.goneTo = t.name;
    var p = recruitToPlayer(r); p.s = freshS();
    t.rost.push(p); n++;
    if (--need[t.id] <= 0) needy.splice(needy.indexOf(t), 1);
  }
  return n;
}

// ── Class balance ──
// If next season's returning classes across CPU rosters are uneven (a save
// from before the full recruit pool has one class at a quarter of the
// others, and short rosters), schools add junior college transfers in the
// thin classes, about at their returners' level, so the league's classes even
// out instead of echoing every four years. In a normal league this does
// nothing. Runs at the start of the offseason (after the draft). Returns the
// number added.
export var CLASS_BALANCE_TOL = 0.85; // act when a class is under 85% of even
export function balanceCpuClasses() {
  var cpu = G.teams.filter(function(t) { return t.id !== G.tid; });
  var back = function(p) { return !(p.cls === 'SR' && !p.rs) && p._draftYr !== G.yr; };
  var cnt = { FR: 0, SO: 0, JR: 0 }, even = 0;
  cpu.forEach(function(t) {
    even += cpuTarget(t) / 4;
    t.rost.forEach(function(p) { if (back(p) && cnt[p.cls] !== undefined) cnt[p.cls]++; });
  });
  var added = 0;
  ['FR', 'SO', 'JR'].forEach(function(cls) {
    if (cnt[cls] >= CLASS_BALANCE_TOL * even) return;
    var want = Math.round(0.95 * even - cnt[cls]);
    // schools with the most room first, leaving room for a freshman class
    var room = function(t) { return cpuTarget(t) - 3 - t.rost.filter(back).length; };
    while (want > 0) {
      var best = null, br = 0;
      cpu.forEach(function(t) { var r = room(t); if (r > br) { br = r; best = t; } });
      if (!best) break;
      var ret = best.rost.filter(back);
      var avg = ret.length ? ret.reduce(function(a, p) { return a + p.ovr; }, 0) / ret.length : 66;
      var pc = {}; ret.forEach(function(p) { pc[p.pos] = (pc[p.pos] || 0) + 1; });
      var pos = POS.slice().sort(function(a, b) { return (pc[a] || 0) - (pc[b] || 0); })[0];
      var np = genPlayer(Math.round(oldOvr(avg)) - 4, pos, cls);
      np.s = freshS(); np.transfer = true; np.juco = true;
      best.rost.push(np); added++; want--;
    }
  });
  return added;
}
