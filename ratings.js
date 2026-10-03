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
import { getTOvr } from './utils.js';

var MARGIN_CAP = 20;      // blowouts past this don't count extra
var HCA = 3.5;            // home-court points removed from home margins
var PRIOR_GAMES = 5;      // the roster prior weighs as much as this many games
var PTS_PER_OVR = 0.55;   // preseason prior: margin points per team-ovr point
var WIN_WEIGHT = 6;       // rating points between a .500 and 1.000 team (resume)
var ITERATIONS = 40;

// Rating → the t.pts scale used across the UI (1000 = average D1 team).
function toPts(r) { return Math.round(1000 + r * 10); }

function addGame(games, a, b, margin, home) {
  // margin from a's point of view; home: +1 a home, -1 a away, 0 neutral
  var m = Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, margin)) - HCA * home;
  games[a].push({ opp: b, m: m });
  games[b].push({ opp: a, m: -m });
}

// Every completed game this season: regular season (from schedules — each
// game recorded once, from the home side or the lower id on neutral) plus
// conference tournament games (neutral).
function collectGames() {
  var games = G.teams.map(function() { return []; });
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
  return games;
}

export function recomputeRatings() {
  var n = G.teams.length;
  if (!n) return;
  var ovr = G.teams.map(function(t) { return t.rost && t.rost.length ? getTOvr(t) : (t.baseOvr || 70); });
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

  G.teams.forEach(function(t, i) {
    var gp = (t.wins || 0) + (t.loss || 0);
    var winPct = gp ? t.wins / gp : 0.5;
    t.rating = Math.round(r[i] * 10) / 10;           // pure efficiency margin
    t.pts = toPts(r[i] + (winPct - 0.5) * WIN_WEIGHT); // ranking score
  });
}

// Selection committee resume for NCAA at-large picks and seeding: the
// ranking score plus a little extra credit for winning games.
export function resumeScore(t) {
  var gp = (t.wins || 0) + (t.loss || 0);
  var winPct = gp ? t.wins / gp : 0;
  return (t.pts || 0) + Math.round((winPct - 0.5) * 30);
}
