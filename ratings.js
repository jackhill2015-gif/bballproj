// ═══════════════════════════════════════════════════════════
//  HOOPS OS — ratings.js
//  Power rating behind the national rankings, Top 25 and NCAA
//  seeding (stored on t.pts so every existing sort keeps working).
//
//  It's a strength-of-schedule-adjusted margin rating (like KenPom/NET):
//    rating = average (capped, home-adjusted) margin + average opponent rating
//  solved iteratively across the whole league, blended with a preseason
//  prior from roster strength that fades as games are played. Beating good
//  teams is worth more than beating bad ones; padding a record in a weak
//  conference no longer earns a #1 seed.
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';
import { getTOvr, oldOvr } from './utils.js';

var MARGIN_CAP = 20;      // blowouts past this don't count extra
var HCA = 3.5;            // home-court points removed from home margins
var PRIOR_GAMES = 5;      // the roster prior weighs as much as this many games
var PTS_PER_OVR = 0.55;   // preseason prior: margin points per team-ovr point
var WIN_WEIGHT = 6;       // rating points between a .500 and 1.000 team (resume)
var ITERATIONS = 40;

// Rating → the t.pts scale used across the UI (1000 = average D1 team).
function toPts(r) { return Math.round(1000 + r * 10); }

// Your coach's offense/defense skill adds points to your games (simulation.js).
// It still wins you games, but it's taken back out of the margins the
// rankings and seeding use, so it doesn't pad your power rating.
function userCoachEdge() {
  if (!G.coach) return 0;
  return Math.round((G.coach.off - 70) * 0.15) + Math.round((G.coach.def - 70) * 0.15);
}
var _edge = 0;
function addGame(games, a, b, margin, home) {
  // margin from a's point of view; home: +1 a home, -1 a away, 0 neutral
  if (a === G.tid) margin -= _edge; else if (b === G.tid) margin += _edge;
  var m = Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, margin)) - HCA * home;
  games[a].push({ opp: b, m: m });
  games[b].push({ opp: a, m: -m });
}

// Every completed game this season: regular season (from schedules — each
// game recorded once, from the home side or the lower id on neutral) plus
// conference tournament games (neutral).
function collectGames() {
  var games = G.teams.map(function() { return []; });
  _edge = userCoachEdge();
  G.teams.forEach(function(t) {
    (t.sched || []).forEach(function(s) {
      if (!s || !s.played || typeof s.opp !== 'number' || !G.teams[s.opp]) return;
      if (!s.home) return; // the home side records it
      addGame(games, t.id, s.opp, (s.uScore || 0) - (s.oScore || 0), 1);
    });
  });
  Object.keys(G.confTourneys || {}).forEach(function(conf) {
    (G.confTourneys[conf].rounds || []).forEach(function(rd) {
      rd.forEach(function(m) {
        if (!m.winner || !m.t1 || !m.t2 || typeof m.s1 !== 'number' || typeof m.s2 !== 'number') return;
        addGame(games, m.t1.id, m.t2.id, m.s1 - m.s2, 0);
      });
    });
  });
  // NCAA tournament (neutral site): teams that played round k pair up in
  // bracket order; b.sc holds each team's score by round
  // 2027 Opening Round games count too
  ((G.ncaaOpening && G.ncaaOpening.games) || []).forEach(function(g) {
    if (!g.winner || g.s1 === null || g.s1 === undefined) return;
    if (G.teams[g.t1.id] && G.teams[g.t2.id]) addGame(games, g.t1.id, g.t2.id, g.s1 - g.s2, 0);
  });
  var br = G.bracket || [];
  for (var k = 0; k < 6; k++) {
    var played = br.filter(function(b) { return b && b.team && b.sc && b.sc.length > k; });
    for (var i = 0; i + 1 < played.length; i += 2) {
      var x = played[i], y = played[i + 1];
      var ix = typeof x.team === 'number' ? x.team : x.team.id, iy = typeof y.team === 'number' ? y.team : y.team.id;
      if (G.teams[ix] && G.teams[iy]) addGame(games, ix, iy, x.sc[k] - y.sc[k], 0);
    }
  }
  return games;
}

// NCAA tournament wins this season (final rankings reward a deep run)
function ncaaWins() {
  var w = {};
  (G.bracket || []).forEach(function(b) {
    if (!b || !b.team || !b.sc || !b.sc.length) return;
    var id = typeof b.team === 'number' ? b.team : b.team.id;
    w[id] = b.active ? b.sc.length : b.sc.length - 1;
  });
  return w;
}
var NCAA_WIN_CREDIT = 1.5; // ranking points per NCAA tournament win

function rosterTalent(t) {
  var top = t.rost.filter(function(p) { return !p.rs; }).map(function(p) { return p.ovr; }).sort(function(a, b) { return b - a; }).slice(0, 9);
  if (!top.length) return getTOvr(t);
  var w = 0, sum = 0;
  top.forEach(function(o, i) { var k = i < 5 ? 30 : 12; sum += o * k; w += k; });
  return sum / w;
}

export function recomputeRatings() {
  var n = G.teams.length;
  if (!n) return;
  // Preseason prior = roster talent (best nine by rating, starter-weighted),
  // not the current minutes, so a team's ranking reflects who it signed
  // even before the depth chart is set
  var ovr = G.teams.map(function(t) { return t.rost && t.rost.length ? oldOvr(rosterTalent(t)) : (t.baseOvr || 70); });
  var meanOvr = ovr.reduce(function(a, b) { return a + b; }, 0) / n;
  var prior = ovr.map(function(o) { return (o - meanOvr) * PTS_PER_OVR; });
  var games = collectGames();

  var r = prior.slice();
  for (var it = 0; it < ITERATIONS; it++) {
    var next = new Array(n);
    for (var i = 0; i < n; i++) {
      var g = games[i], sum = PRIOR_GAMES * prior[i];
      for (var k = 0; k < g.length; k++) sum += g[k].m + r[g[k].opp];
      next[i] = sum / (g.length + PRIOR_GAMES);
    }
    // keep the league centered on 0
    var mean = next.reduce(function(a, b) { return a + b; }, 0) / n;
    for (var j = 0; j < n; j++) next[j] -= mean;
    r = next;
  }

  var nw = ncaaWins();
  G.teams.forEach(function(t, i) {
    var gp = (t.wins || 0) + (t.loss || 0);
    var winPct = gp ? t.wins / gp : 0.5;
    t.rating = Math.round(r[i] * 10) / 10;           // pure efficiency margin
    t.pts = toPts(r[i] + (winPct - 0.5) * WIN_WEIGHT + (nw[t.id] || 0) * NCAA_WIN_CREDIT); // ranking score
  });
}

// Selection committee resume for NCAA at-large picks and seeding: the
// ranking score plus a little extra credit for winning games.
// Selection committee resume: power rating plus a real weight on record.
// 0.6 win pct is worth +20 (2 points of margin), 0.8 is +60. An 18-13
// power-conference team now lands around the 8-11 line, not a 3 seed.
export var RESUME_RECORD_WEIGHT = 200;
export function resumeScore(t) {
  var gp = (t.wins || 0) + (t.loss || 0);
  var winPct = gp ? t.wins / gp : 0;
  return (t.pts || 0) + Math.round((winPct - 0.5) * RESUME_RECORD_WEIGHT);
}

// Remember every team's current poll position (called right before the
// weekly recompute) so the UI can show movement arrows that survive
// re-renders and reloads.
export function snapshotRanks() {
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  sorted.forEach(function(t, i) { t.lastRank = i + 1; });
}

// Current rank map (id → 1-based rank) and movement since last week.
export function rankMap() {
  var m = {};
  G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).forEach(function(t, i) { m[t.id] = i + 1; });
  return m;
}
