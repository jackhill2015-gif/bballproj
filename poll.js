// ═══════════════════════════════════════════════════════════
//  HOOPS OS — poll.js
//  The AP-style Top 25 the player sees as "the rankings". Separate from
//  the efficiency rating in ratings.js (t.pts), which still drives NCAA
//  selection, seeding and everything that needs team strength.
//
//  Voters update the poll every other game week (about the games a real
//  poll week covers), moving teams by what they did, not re-sorting a
//  formula: losses cost spots (more to unranked teams and at home, less
//  for the very top), wins over ranked teams earn spots, and a pull toward
//  resume quality that grows through the season keeps the poll honest (on
//  Selection Sunday voters land close to the committee's order). Unranked
//  teams enter from a "receiving votes" pool.
//  Tuned to 10 seasons of real AP polls: research/rankings/findings.md.
//
//  Save: G.poll = { yr, n, kind, gi, ids[25], rv[<=10], prev[25] }.
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';
import { resumeScore } from './ratings.js';

export var POLL_EVERY = 2;   // game weeks per poll
var RV_SIZE = 10;

// Voter behavior (spots in the poll); see findings.md "Rules"
export var VOTE = {
  lossUnranked: 8.5, loss1125: 6.5, lossTop10: 4.5, // per loss, by opponent's rank
  siteHome: 1.19, siteNeutral: 1.05, siteRoad: 0.77,  // where the loss happened
  topBandScale: 0.12,  // ranks 1-5 fall far less than everyone else (see findings: parity)
  winTop10: 1, win1125: 0.6, winUnranked: 0,          // per win
  roadWin: 0.1,        // extra for a road win
  unbeaten: 0,         // unbeaten after the week, with a win
  meritPull: 0.12,     // share of the gap to the strength order closed each poll
  meritRamp: 3,        // ... and (1 + ramp) times that by the last week
  selPull: 0.5,        // Selection Sunday: share of the gap to the committee's resume order closed
  noise: 1,            // voter spread (spots, sd)
  topNoise: 0.1,       // the top 5 are steadier
  entrySpacing: 1.8,   // spots between unranked teams waiting in line
  brand: 3.5,          // efficiency points per prestige point below brandBar
  brandBar: 68,        // programs below this prestige get less benefit of the doubt
  record: 100,         // efficiency points per 1.000 of win pct in the strength order
  secondLoss: 0.9      // a second loss in the same week costs 0.9 of the first
};

// Preseason weights (z-scores): roster talent, last season's finish, brand
export var PRESEASON = { talent: 1.0, lastFinal: 0.55, brand: 1.25, noise: 0.2 };

var _hooks = [];
// Calibration and tests watch every poll (ids before/after and each team's games)
export function onPoll(cb) { _hooks.push(cb); return function() { _hooks = _hooks.filter(function(h) { return h !== cb; }); }; }

function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ── Reading the poll ──
export function pollRank(tid) {
  var p = G.poll;
  if (!p || !p.ids) return 0;
  var i = p.ids.indexOf(tid);
  return i >= 0 ? i + 1 : 0;
}
export function pollPrevRank(tid) {
  var p = G.poll;
  if (!p || !p.prev) return 0;
  var i = p.prev.indexOf(tid);
  return i >= 0 ? i + 1 : 0;
}
export function pollRankMap() {
  var m = {};
  ((G.poll && G.poll.ids) || []).forEach(function(id, i) { m[id] = i + 1; });
  return m;
}
export function pollTeams() { return ((G.poll && G.poll.ids) || []).map(function(id) { return G.teams[id]; }).filter(Boolean); }
export function receivingVotes() { return ((G.poll && G.poll.rv) || []).map(function(id) { return G.teams[id]; }).filter(Boolean); }
// "#7 " before a ranked team's name, "" otherwise
export function rankTag(tid) { var r = pollRank(tid); return r ? '#' + r + ' ' : ''; }
export function pollLabel() {
  var p = G.poll;
  if (!p) return '';
  if (p.kind === 'pre') return 'Preseason poll';
  if (p.kind === 'sel') return 'Selection Sunday poll';
  if (p.kind === 'final') return 'Final poll';
  return 'Poll week ' + p.n;
}

// Strength order voters drift toward: the efficiency rating (t.pts, which
// already includes a little for record), plus program brand. A record built
// in a weak league doesn't impress voters much.
function voterKey(t) {
  var gp = (t.wins || 0) + (t.loss || 0);
  // brand only holds back lesser-known programs; among big names, results decide
  return (t.pts || 1000) + VOTE.brand * Math.min(0, (t.schoolPrestige || 50) - VOTE.brandBar) + VOTE.record * ((gp ? t.wins / gp : 0.5) - 0.5);
}
function meritOrder(key) {
  var s = G.teams.slice().sort(function(a, b) { return key(b) - key(a); });
  var m = {};
  s.forEach(function(t, i) { m[t.id] = i + 1; });
  return m;
}

function setPoll(ids, rv, kind) {
  var prev = G.poll && G.poll.ids ? G.poll.ids.slice() : [];
  var n = kind === 'pre' ? 1 : ((G.poll && G.poll.yr === G.yr ? G.poll.n : 0) + 1);
  G.poll = { yr: G.yr, n: n, kind: kind, gi: G.gi, ids: ids.slice(0, 25), rv: rv.slice(0, RV_SIZE), prev: kind === 'pre' ? [] : prev };
}

// ── Preseason: talent, last season's final poll, program brand ──
export function buildPreseasonPoll() {
  var teams = G.teams;
  if (!teams || !teams.length) return;
  var lastFinal = {};
  if (G.poll && G.poll.kind === 'final' && G.poll.yr === G.yr - 1) G.poll.ids.forEach(function(id, i) { lastFinal[id] = 26 - (i + 1); });
  function z(arr) {
    var m = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    var sd = Math.sqrt(arr.reduce(function(a, b) { return a + (b - m) * (b - m); }, 0) / arr.length) || 1;
    return arr.map(function(x) { return (x - m) / sd; });
  }
  var tal = z(teams.map(function(t) { return t.pts || 1000; }));          // preseason pts = roster talent prior
  var fin = z(teams.map(function(t) { return lastFinal[t.id] || 0; }));
  var brand = z(teams.map(function(t) { return t.schoolPrestige || 50; }));
  var score = teams.map(function(t, i) {
    return PRESEASON.talent * tal[i] + PRESEASON.lastFinal * fin[i] + PRESEASON.brand * brand[i] + PRESEASON.noise * gauss();
  });
  var order = teams.map(function(t, i) { return i; }).sort(function(a, b) { return score[b] - score[a]; });
  var ids = order.map(function(i) { return teams[i].id; });
  G.poll = null; // a new season starts its own poll history
  setPoll(ids.slice(0, 25), ids.slice(25, 25 + RV_SIZE), 'pre');
  _hooks.forEach(function(h) { h({ kind: 'pre', ids: G.poll.ids.slice() }); });
}

// Each team's games since the last poll: regular season weeks [from, to)
// plus finished conference tournament games when asked
function windowResults(from, to, withConfTourney) {
  var res = {};
  function add(tid, oppId, won, site) { (res[tid] = res[tid] || []).push({ opp: oppId, won: won, site: site }); }
  G.teams.forEach(function(t) {
    for (var w = from; w < to; w++) {
      var s = t.sched && t.sched[w];
      if (!s || !s.played || typeof s.opp !== 'number') continue;
      add(t.id, s.opp, s.uScore > s.oScore, s.home ? 'H' : 'A');
    }
  });
  if (withConfTourney) {
    Object.keys(G.confTourneys || {}).forEach(function(conf) {
      (G.confTourneys[conf].rounds || []).forEach(function(rd) {
        rd.forEach(function(m) {
          if (!m.winner || !m.t1 || !m.t2 || typeof m.s1 !== 'number') return;
          var site1 = m.campus ? 'H' : 'N', site2 = m.campus ? 'A' : 'N';
          add(m.t1.id, m.t2.id, m.winner.id === m.t1.id, site1);
          add(m.t2.id, m.t1.id, m.winner.id === m.t2.id, site2);
        });
      });
    });
  }
  return res;
}

// One voter week: move every team by its results, then re-rank
function voterUpdate(res, kind) {
  var cur = G.poll && G.poll.ids ? G.poll.ids : [];
  var rv = G.poll && G.poll.rv ? G.poll.rv : [];
  var rankNow = {};
  cur.forEach(function(id, i) { rankNow[id] = i + 1; });
  // on Selection Sunday voters land close to the committee's own order
  var merit = meritOrder(kind === 'sel' ? resumeScore : voterKey);
  // Unranked teams line up behind #25: last week's receiving-votes order
  // first, then by resume
  var line = {};
  var k = 0;
  rv.forEach(function(id) { if (!rankNow[id]) line[id] = 26 + VOTE.entrySpacing * (k++); });
  G.teams.slice().sort(function(a, b) { return merit[a.id] - merit[b.id]; }).forEach(function(t) {
    if (!rankNow[t.id] && line[t.id] === undefined) line[t.id] = 26 + VOTE.entrySpacing * (k++);
  });
  var lossesSoFar = {};
  G.teams.forEach(function(t) { lossesSoFar[t.id] = t.loss || 0; });
  var standing = {};
  G.teams.forEach(function(t) {
    var r = rankNow[t.id] || line[t.id];
    var s = r;
    var games = res[t.id] || [];
    var won = 0, lost = 0;
    games.forEach(function(g) {
      var or = rankNow[g.opp] || 0;
      if (g.won) {
        won++;
        s -= or && or <= 10 ? VOTE.winTop10 : or ? VOTE.win1125 : VOTE.winUnranked;
        if (g.site === 'A') s -= VOTE.roadWin;
      } else {
        var L = or && or <= 10 ? VOTE.lossTop10 : or ? VOTE.loss1125 : VOTE.lossUnranked;
        L *= g.site === 'H' ? VOTE.siteHome : g.site === 'A' ? VOTE.siteRoad : VOTE.siteNeutral;
        if (rankNow[t.id] && rankNow[t.id] <= 5) L *= VOTE.topBandScale;
        if (lost++) L *= VOTE.secondLoss;
        s += L;
      }
    });
    if (won && !lossesSoFar[t.id]) s -= VOTE.unbeaten;
    // drift toward the resume order (voters notice who's really good)
    // (the pull grows through the season: by March voters and the committee agree)
    var pull = kind === 'sel' ? VOTE.selPull : VOTE.meritPull * (1 + VOTE.meritRamp * Math.min(G.gi, 30) / 30);
    s += pull * (Math.min(merit[t.id], 40) - s);
    if (games.length) s += (rankNow[t.id] && rankNow[t.id] <= 5 ? VOTE.topNoise : VOTE.noise) * gauss();
    standing[t.id] = s;
  });
  var order = G.teams.map(function(t) { return t.id; }).sort(function(a, b) {
    return standing[a] - standing[b] || (rankNow[a] || 99) - (rankNow[b] || 99) || merit[a] - merit[b];
  });
  var before = cur.slice();
  setPoll(order.slice(0, 25), order.slice(25, 25 + RV_SIZE), kind);
  _hooks.forEach(function(h) { h({ kind: kind, before: before, ids: G.poll.ids.slice(), res: res }); });
}

// After each regular-season game week: a new poll every POLL_EVERY weeks
export function maybeWeeklyPoll() {
  if (!G.poll || G.poll.yr !== G.yr) ensurePoll();
  if (G.phase !== 'reg' || G.gi % POLL_EVERY !== 0 || G.gi === 0) return false;
  var from = G.poll.kind === 'pre' ? 0 : G.poll.gi;
  voterUpdate(windowResults(from, G.gi, false), 'reg');
  return true;
}

// After the conference tournaments, before the field is picked
export function selectionSundayPoll() {
  if (!G.poll || G.poll.yr !== G.yr) ensurePoll();
  if (G.poll.kind === 'sel' || G.poll.kind === 'final') return;
  var from = G.poll.kind === 'pre' ? 0 : G.poll.gi;
  voterUpdate(windowResults(from, 30, true), 'sel');
}

// After the NCAA tournament: the champion is #1, deep runs rise
export function finalPoll() {
  if (!G.poll || G.poll.yr !== G.yr) ensurePoll();
  if (G.poll.kind === 'final') return;
  var cur = G.poll.ids.slice(), rv = G.poll.rv || [];
  var wins = {}, inField = {}, champ = null;
  (G.bracket || []).forEach(function(b) {
    if (!b || !b.team || !b.sc) return;
    var id = typeof b.team === 'number' ? b.team : b.team.id;
    inField[id] = true;
    wins[id] = b.active ? b.sc.length : Math.max(0, b.sc.length - 1);
    if (b.active && b.sc.length >= 6) champ = id;
  });
  var still = (G.bracket || []).filter(function(b) { return b.active; });
  if (still.length === 1) champ = typeof still[0].team === 'number' ? still[0].team : still[0].team.id;
  var merit = meritOrder(voterKey);
  var standing = {};
  var rank = {};
  cur.forEach(function(id, i) { rank[id] = i + 1; });
  rv.forEach(function(id, i) { if (!rank[id]) rank[id] = 26 + i; });
  G.teams.forEach(function(t) {
    var r = rank[t.id] || 26 + Math.min(merit[t.id], 60) * 0.3;
    var w = wins[t.id] || 0;
    // each round won lifts a team; an early exit for a ranked team costs a little
    var s = r - 3.2 * w;
    if (inField[t.id] && w === 0 && r <= 16) s += 2.5;
    standing[t.id] = s;
  });
  var order = G.teams.map(function(t) { return t.id; }).sort(function(a, b) { return standing[a] - standing[b] || (rank[a] || 99) - (rank[b] || 99); });
  if (champ !== null) order = [champ].concat(order.filter(function(id) { return id !== champ; }));
  var before = cur.slice();
  setPoll(order.slice(0, 25), order.slice(25, 25 + RV_SIZE), 'final');
  _hooks.forEach(function(h) { h({ kind: 'final', before: before, ids: G.poll.ids.slice() }); });
}

// Old saves (no poll yet) or a missing poll: start from the efficiency order
export function ensurePoll() {
  if (G.poll && G.poll.yr === G.yr && G.poll.ids && G.poll.ids.length) return;
  var m = meritOrder(voterKey);
  var s = G.teams.map(function(t) { return t.id; }).sort(function(a, b) { return m[a] - m[b]; });
  G.poll = { yr: G.yr, n: 1, kind: G.gi > 0 ? 'reg' : 'pre', gi: G.gi - (G.gi % POLL_EVERY), ids: s.slice(0, 25), rv: s.slice(25, 25 + RV_SIZE), prev: [] };
}
