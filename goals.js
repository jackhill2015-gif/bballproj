// ═══════════════════════════════════════════════════════════
//  HOOPS OS — goals.js
//  Season goals from the athletic director (three per season,
//  scaled to the program) and career achievements. Both feed the
//  trophy room. Pure game logic: reads/writes G only.
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';
import { getTOvr } from './utils.js';
import { earn } from './finance.js';

// Rewards for each goal met at season's end
export var GOAL_REWARD = { skill: 1, nil: 40 };
export var ALL_GOALS_PRESTIGE = 3;

function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function rankOf(tid) {
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  return sorted.findIndex(function(x) { return x.id === tid; }) + 1;
}

// Conference standing by conference win %, then rating (same as standings view)
export function confStanding() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  conf.sort(function(a, b) {
    return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts;
  });
  return { pos: conf.findIndex(function(x) { return x.id === G.tid; }) + 1, size: conf.length };
}

// How far the user got in March (0 = missed the field, 1 = made it,
// 2 = won a game, 3 = Sweet 16, 4 = Final Four, 5 = title game, 6 = champion)
function ncaaLevel() {
  var sa = G.seasonAchievements || {};
  if (sa.natChamp) return 6;
  if (sa.champGame) return 5;
  if (sa.finalFour) return 4;
  if (sa.sweet16) return 3;
  var tf = sa.tourneyFinish;
  if (tf && tf !== 'Round of 64' && tf !== 'Did Not Qualify' && tf !== 'Opening round') return 2;
  // still alive in the bracket and already through round one?
  if (G.phase === 'ncaa' && G.bracket && G.bracket.length) {
    var me = G.bracket.find(function(b) { return b.team && b.team.id === G.tid; });
    if (me) {
      var alive = G.bracket.filter(function(b) { return b.active; }).length;
      if (me.active && alive <= 32) return alive <= 16 ? 3 : 2;
      return 1;
    }
  }
  return sa.madeNCAA ? 1 : 0;
}
var NCAA_LABEL = ['', 'Make the NCAA tournament', 'Win an NCAA tournament game', 'Reach the Sweet 16', 'Reach the Final Four'];

// ── Goal catalog. Each goal: { id, text, target } evaluated by progress() ──
function makeGoals() {
  var t = G.teams[G.tid];
  var exp = G.expectations || { low: 12, high: 18 };
  var r = rankOf(G.tid);
  var winsTarget = clampN(Math.round(exp.low + (exp.high - exp.low) * 0.6), 8, 27);
  var goals = [{ id: 'wins', target: winsTarget, text: 'Win ' + winsTarget + ' games' }];

  // Conference goal scaled to where the roster ranks in the conference
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  var myOvr = getTOvr(t);
  var better = conf.filter(function(x) { return getTOvr(x) > myOvr; }).length;
  var confTarget = better === 0 ? 1 : better <= 2 ? 3 : Math.ceil(conf.length / 2);
  goals.push({ id: 'conf', target: confTarget,
    text: confTarget === 1 ? 'Win the ' + t.conf + ' regular season' : 'Finish top ' + confTarget + ' in the ' + t.conf });

  // Postseason or signature-win goal by national standing
  if (r <= 12) goals.push({ id: 'ncaa', target: 3, text: NCAA_LABEL[3] });
  else if (r <= 30) goals.push({ id: 'ncaa', target: 2, text: NCAA_LABEL[2] });
  else if (r <= 70) goals.push({ id: 'ncaa', target: 1, text: NCAA_LABEL[1] });
  else goals.push({ id: 'ranked', target: 1, text: 'Beat a ranked team' });
  return goals;
}

// Current season's goals, created on first look each season.
export function ensureGoals() {
  if (!G.teams || !G.teams.length || G.tid === undefined || G.tid < 0) return null;
  if (!G.goals || G.goals.yr !== G.yr || G.goals.tid !== G.tid) {
    G.goals = { yr: G.yr, tid: G.tid, list: makeGoals(), rankedWins: 0, settled: false };
  }
  return G.goals;
}

// Progress for one goal: { value, done, label }
export function progress(goal) {
  var t = G.teams[G.tid];
  var gs = G.goals || {};
  if (goal.id === 'wins') return { value: t.wins, done: t.wins >= goal.target, label: t.wins + ' of ' + goal.target };
  if (goal.id === 'conf') {
    var cs = confStanding();
    var played = t.cWins + t.cLoss;
    return { value: cs.pos, done: played >= 10 && cs.pos <= goal.target,
      label: played ? 'Currently ' + ordinal(cs.pos) + ' of ' + cs.size : 'Conference play not started' };
  }
  if (goal.id === 'ncaa') {
    var lv = ncaaLevel();
    return { value: lv, done: lv >= goal.target, label: lv >= goal.target ? 'Done' : 'Decided in March' };
  }
  if (goal.id === 'ranked') {
    var n = gs.rankedWins || 0;
    return { value: n, done: n >= goal.target, label: n ? n + ' ranked win' + (n > 1 ? 's' : '') : 'None yet' };
  }
  return { value: 0, done: false, label: '' };
}

function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

// Called from recordResult for every user game
export function noteUserResult(opp, won) {
  var gs = ensureGoals();
  if (!gs || !won || !opp) return;
  var r = rankOf(opp.id);
  if (r <= 25) {
    gs.rankedWins = (gs.rankedWins || 0) + 1;
    unlock('ranked_win', 'Beat a ranked team');
    if (r <= 10) unlock('top10_win', 'Beat a top-10 team');
    if (r === 1) unlock('beat_no1', 'Beat the #1 team in the country');
  }
}

// Settle goals at the end of the season. Returns { met, total, rewards }.
export function settleGoals() {
  var gs = ensureGoals();
  if (!gs || gs.settled) return null;
  var met = gs.list.filter(function(g) { return progress(g).done; });
  gs.settled = true;
  gs.results = gs.list.map(function(g) { return { text: g.text, done: progress(g).done }; });
  var nil = earn('ad', met.length * GOAL_REWARD.nil, met.length + ' of ' + gs.list.length + ' season goals met');
  var t = G.teams[G.tid];
  if (met.length === gs.list.length) {
    t.schoolPrestige = Math.min(100, (t.schoolPrestige || 50) + ALL_GOALS_PRESTIGE);
    unlock('all_goals', 'Meet all three season goals');
  }
  if (!G.goalHistory) G.goalHistory = [];
  G.goalHistory.push({ yr: gs.yr, school: t.name, met: met.length, total: gs.list.length, results: gs.results });
  return { met: met.length, total: gs.list.length, skill: met.length * GOAL_REWARD.skill, nil: nil };
}

// ═══════════════════════════════════════════════════════════
//  ACHIEVEMENTS — unlocked once per career, shown in the trophy room
// ═══════════════════════════════════════════════════════════

export var ACHIEVEMENTS = [
  ['first_win', 'First win'],
  ['ranked_win', 'Beat a ranked team'],
  ['top10_win', 'Beat a top-10 team'],
  ['beat_no1', 'Beat the #1 team in the country'],
  ['top25', 'Crack the Top 25'],
  ['no1', 'Reach #1 in the national rankings'],
  ['twenty_wins', 'Win 20 games in a season'],
  ['thirty_wins', 'Win 30 games in a season'],
  ['conf_reg', 'Win the conference regular season'],
  ['conf_tourney', 'Win the conference tournament'],
  ['ncaa', 'Make the NCAA tournament'],
  ['sweet16', 'Reach the Sweet 16'],
  ['final_four', 'Reach the Final Four'],
  ['title', 'Win the national championship'],
  ['repeat', 'Win back-to-back national championships'],
  ['cinderella', 'Reach the Sweet 16 as a 10 seed or worse'],
  ['all_goals', 'Meet all three season goals'],
  ['builder', 'Make the NCAA tournament at a school with prestige under 40'],
  ['wins100', 'Win 100 career games'],
  ['wins300', 'Win 300 career games']
];

export function unlock(id, label) {
  if (!G.achievements) G.achievements = {};
  if (G.achievements[id]) return false;
  G.achievements[id] = { yr: G.yr, school: G.teams[G.tid] ? G.teams[G.tid].name : '' };
  if (typeof window !== 'undefined' && window._hoopsToast) window._hoopsToast('Achievement: ' + (label || id));
  return true;
}

// State-based checks (cheap): run after each week and at season's end.
export function checkAchievements() {
  if (!G.teams || !G.teams[G.tid]) return;
  var t = G.teams[G.tid];
  if (t.wins >= 1) unlock('first_win', 'First win');
  var r = rankOf(G.tid);
  if (G.phase !== 'offseason' && t.wins + t.loss > 0) {
    if (r <= 25) unlock('top25', 'Crack the Top 25');
    if (r === 1) unlock('no1', 'Reach #1 in the national rankings');
  }
  if (t.wins >= 20) unlock('twenty_wins', 'Win 20 games in a season');
  if (t.wins >= 30) unlock('thirty_wins', 'Win 30 games in a season');
  var c = G.coach || {};
  if ((c.careerWins || 0) + (G.phase !== 'offseason' ? t.wins : 0) >= 100) unlock('wins100', 'Win 100 career games');
  if ((c.careerWins || 0) + (G.phase !== 'offseason' ? t.wins : 0) >= 300) unlock('wins300', 'Win 300 career games');
  var sa = G.seasonAchievements || {};
  if (sa.confTitleThisYear) unlock('conf_tourney', 'Win the conference tournament');
  if (sa.madeNCAA) {
    unlock('ncaa', 'Make the NCAA tournament');
    if ((t.schoolPrestige || 50) < 40) unlock('builder', 'Make the NCAA tournament at a low-prestige school');
  }
  if (sa.sweet16) unlock('sweet16', 'Reach the Sweet 16');
  if (sa.finalFour) unlock('final_four', 'Reach the Final Four');
  if (sa.natChamp) {
    unlock('title', 'Win the national championship');
    var prev = (G.leagueChamps || []).find(function(x) { return x.year === G.yr - 1; });
    if (prev && prev.tid === G.tid) unlock('repeat', 'Win back-to-back national championships');
  }
  if (sa.sweet16 && G.bracket) {
    var me = G.bracket.find(function(b) { return b.team && b.team.id === G.tid; });
    if (me && me.seed >= 10) unlock('cinderella', 'Reach the Sweet 16 as a 10 seed or worse');
  }
  if (G.phase !== 'reg' && t.cWins + t.cLoss >= 10 && confStanding().pos === 1) unlock('conf_reg', 'Win the conference regular season');
}
