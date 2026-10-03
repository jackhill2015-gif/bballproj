// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/dashboard.js
//  Dashboard-as-digest in the Campus Dynasty rhythm (from
//  jack's screenshots): school identity card, collapsible
//  Notifications row, Season Expectations card, game card
//  with two big blue buttons (Play Game / Sim Game), then
//  briefing, NIL shop, coach XP, award races, standings.
//  Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { ge, clamp, getTOvr, fR, fmtScore, awardScore } from '../utils.js';
import { rankMap } from '../ratings.js';
import { G } from '../state.js';
import { bracketHubHTML } from './bracket.js';
import {
  userRank, rankDelta, currentStreak, coachXpToNext,
  NIL_SHOP, shopBoughtThisWeek, teamLogo, teamColor, notifState
} from '../ui.js';

// ── Cached POY race (recomputed when week/phase changes) ──
var _raceCache = { key: '', rows: [] };
function poyRace() {
  var key = G.yr + '-' + G.gi + '-' + G.phase;
  if (_raceCache.key === key) return _raceCache.rows;
  var rows = [];
  G.teams.forEach(function(tm) {
    tm.rost.forEach(function(p) {
      var gp = p.s.gp || 0;
      if (gp < 3) return;
      rows.push({
        name: p.name, pos: p.pos, cls: p.cls, team: tm.name, tid: tm.id,
        ppg: p.s.pts / gp,
        per: awardScore(p, tm)
      });
    });
  });
  rows.sort(function(a, b) { return b.per - a.per; });
  _raceCache = { key: key, rows: rows.slice(0, 3) };
  return _raceCache.rows;
}

// ── Rivalry hooks: top conf threats + teams that beat you ──
function rivalIds() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf && x.id !== G.tid; });
  conf.sort(function(a, b) { return b.pts - a.pts; });
  var ids = {};
  conf.slice(0, 2).forEach(function(x) { ids[x.id] = 'rival'; });
  return ids;
}
function revengeIds() {
  var t = G.teams[G.tid];
  var ids = {};
  (t.sched || []).forEach(function(s) {
    if (s && s.played && s.uScore < s.oScore && s.opp !== undefined) ids[s.opp] = true;
  });
  return ids;
}

function winProb(t, opp, home) {
  var dm = DIFF_MOD[G.difficulty] || 0;
  return clamp(Math.round(50 + (getTOvr(t) + dm - getTOvr(opp)) * 1.3 + (home ? 4 : -4)), 5, 95);
}
function wpColor(wp) { return wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)'; }

// ═══════════════════════════════════════════════════════════
//  SCHOOL IDENTITY CARD (CD pattern)
// ═══════════════════════════════════════════════════════════

function moveTxt(d) {
  if (!d.prev || !d.delta) return '';
  return d.delta > 0 ? ' <span class="mv-up">▲' + d.delta + '</span>' : ' <span class="mv-dn">▼' + Math.abs(d.delta) + '</span>';
}

function renderSchoolCard() {
  var t = G.teams[G.tid];
  var netRank = userRank();
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  confTeams.sort(function(a, b) { return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts; });
  var confRank = confTeams.findIndex(function(x) { return x.id === G.tid; }) + 1;
  // Seed projection appears once the season takes shape
  var seed = G.gi >= 8 && netRank <= 64 ? Math.ceil(netRank / 4) : 0;
  var phase = { reg: 'regular season', conf_tourn: 'conference tournament', ncaa: 'NCAA tournament', offseason: 'offseason' }[G.phase] || '';
  return '<div class="dash-sum">'
    + '<div class="dash-team"><h1>' + t.name + '</h1>'
    + '<div class="sub">' + t.conf + ', ' + G.yr + ' ' + phase + '</div></div>'
    + '<div class="kv">'
    + '<div><b>' + fR(t.wins, t.loss) + '</b><span>Record</span></div>'
    + '<div><b>#' + netRank + moveTxt(rankDelta()) + '</b><span>National</span></div>'
    + '<div><b>' + confRank + '</b><span>Conference</span></div>'
    + '<div><b>' + (seed || '–') + '</b><span>Proj. seed</span></div>'
    + '</div></div>';
}

// The last final stays visible until the next game is played.
var _lastFinalKey = '';
function renderLastFinal() {
  var r = G.lastResult;
  if (!r || G.phase === 'offseason') return '';
  var opp = G.teams[r.oppId];
  if (!opp) return '';
  var key = G.yr + ':' + r.wk + ':' + r.oppId + ':' + r.u + '-' + r.o;
  var fresh = key !== _lastFinalKey; _lastFinalKey = key;
  var where = r.home === null ? 'vs' : (r.home ? 'vs' : 'at');
  return '<div class="final-line ' + (r.won ? 'w' : 'l') + (fresh ? ' fresh' : '') + '">'
    + '<span class="fl-res">Final: ' + (r.won ? 'W' : 'L') + ' ' + fmtScore(r.u, r.o) + '</span>'
    + '<span>' + where + ' ' + opp.name + ' (' + opp.wins + '-' + opp.loss + ')</span>'
    + '<span class="fl-meta">' + r.label + '</span></div>';
}

function panel(title, body, opts) {
  opts = opts || {};
  return '<div class="panel"><div class="panel-h"><span>' + title + '</span>' + (opts.right ? '<small>' + opts.right + '</small>' : '') + '</div>'
    + '<div class="panel-b' + (opts.flush ? ' flush' : '') + '">' + body + '</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  NOTIFICATIONS (collapsible row, CD pattern)
// ═══════════════════════════════════════════════════════════

function renderNotifications() {
  var logs = (G.logs || []).slice(0, 6);
  var body = '';
  if (!logs.length) body = '<div style="color:var(--txt3);padding:2px 0;">Nothing yet. Results and news show up here.</div>';
  logs.forEach(function(lg) {
    var badge = lg.type === 'w' ? 'W' : lg.type === 'l' ? 'L' : '';
    body += '<div class="headline">' + (badge ? '<span class="hbadge ' + lg.type + '">' + badge + '</span>' : '<span class="hbadge dot"></span>') + '<span>' + lg.text + '</span></div>';
  });
  return panel('News', body);
}

// ═══════════════════════════════════════════════════════════
//  SEASON EXPECTATIONS (CD card + visible hot-seat tie-in)
// ═══════════════════════════════════════════════════════════

function renderExpectations() {
  var exp = G.expectations;
  var t = G.teams[G.tid];
  var c = G.coach;
  if (!exp) return '';
  var wins = t.wins;
  var gp = t.wins + t.loss;
  var total = (t.sched || []).filter(function(s) { return !!s; }).length || 30;
  // Judge the season by its pace, not raw wins — at 0-0 nobody is in danger.
  // Early on the projection leans on expectations, then on actual results.
  var expPct = ((exp.low + exp.high) / 2) / total;
  var pacePct = (wins + 4 * expPct) / (gp + 4);
  var proj = Math.round(wins + Math.max(0, total - gp) * pacePct);
  var job, cls;
  if (c.hotSeat) {
    job = 'Hot seat';
    cls = 'danger';
  } else if (gp === 0) {
    job = 'Season not started';
    cls = 'safe';
  } else if (proj < exp.danger) {
    job = 'Job in danger';
    cls = 'warn';
  } else if (proj < exp.low) {
    job = 'Below expectations';
    cls = 'warn';
  } else {
    job = 'Job safe';
    cls = 'safe';
  }
  var detail = gp === 0
    ? 'job at risk under ' + exp.danger + ' wins'
    : 'on pace for ' + proj + ', job at risk under ' + exp.danger;
  return '<div class="exp-line" style="border:none;padding:6px 0 0;">Expected <b>' + exp.low + '–' + exp.high + ' wins</b>. '
    + '<span class="' + cls + '">' + job + '</span>'
    + ' <span style="color:var(--txt3);">(' + detail + ')</span></div>';
}

// ═══════════════════════════════════════════════════════════
//  GAME CARD — two big blue buttons (CD pattern)
// ═══════════════════════════════════════════════════════════

function renderGameCard() {
  var t = G.teams[G.tid];
  function buttons(simLabel) {
    return '<div class="big-btn-row">'
      + '<button class="btn-big" data-action="play" data-mode="quick">' + (simLabel || 'Sim game') + '</button>'
      + '<button class="btn-big secondary" data-action="play" data-mode="live">Watch game</button></div>';
  }
  if (G.phase === 'reg' && G.gi < 30) {
    var ng = t.sched[G.gi];
    var no = ng && ng.opp !== undefined && ng.opp !== null ? G.teams[ng.opp] : null;
    if (ng && no) {
      var wp = winProb(t, no, ng.home);
      var rk = rankMap();
      var r = rivalIds(), rev = revengeIds();
      var flags = (r[no.id] ? ' <span class="tag t-rival">Rival</span>' : '') + (rev[no.id] ? ' <span class="tag t-revenge">Revenge</span>' : '');
      var body = '<div class="ng-row"><div class="ng-opp">' + (ng.home ? 'vs ' : 'at ') + (rk[no.id] <= 25 ? '#' + rk[no.id] + ' ' : '') + no.name + flags + '</div>'
        + '<div class="ng-meta">' + no.wins + '-' + no.loss + ', OVR ' + getTOvr(no) + '</div></div>'
        + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(wp) + ';font-weight:600;">' + wp + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + wpColor(wp) + ';"></div></div>'
        + buttons()
        + '<button class="btn-quiet" style="margin-top:2px;padding-left:0;" data-action="nav" data-view="strategy">Edit gameplan</button>'
        + renderExpectations();
      return panel('Next game', body, { right: 'Week ' + (G.gi + 1) + ', ' + (ng.conf ? t.conf : 'non-conference') });
    }
    return panel('Bye week', '<div class="ng-meta">No game in week ' + (G.gi + 1) + '.</div>'
      + '<div class="big-btn-row"><button class="btn-big" data-action="play" data-mode="quick">Sim week</button></div>' + renderExpectations());
  }
  if (G.phase === 'reg') {
    return panel('Regular season complete', '<button class="btn-big" data-action="play" data-mode="quick">Start conference tournament</button>');
  }
  return panel('Offseason', '<div style="color:var(--txt2);margin-bottom:8px;">Recruit, develop and set the roster for next season.</div>'
    + '<button class="btn-big" data-action="nav" data-view="offseason">Open offseason</button>');
}

// ═══════════════════════════════════════════════════════════
//  WEEKLY BRIEFING
// ═══════════════════════════════════════════════════════════

function renderBriefing() {
  if (G.phase !== 'reg') return '';
  var t = G.teams[G.tid];
  var rows = '';
  var d = rankDelta();
  if (d.prev) {
    var mv = d.delta > 0 ? 'up <b>' + d.delta + '</b> to <b>#' + d.cur + '</b>' : d.delta < 0 ? 'down <b>' + Math.abs(d.delta) + '</b> to <b>#' + d.cur + '</b>' : 'holding at <b>#' + d.cur + '</b>';
    rows += '<div class="brief-row"><span>NET rank ' + mv + ' after last week.</span></div>';
  }
  var ng = t.sched[G.gi];
  if (ng && ng.opp !== undefined && ng.opp !== null && !ng.played) {
    var opp = G.teams[ng.opp];
    if (opp) {
      var oppRank = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === opp.id; }) + 1;
      var scout = oppRank <= 25 ? 'Ranked #' + oppRank + ' — bring your best.' : oppRank <= 64 ? 'A winnable resume game.' : 'Take care of business.';
      rows += '<div class="brief-row"><span>Scout: <b>' + (ng.home ? 'vs' : '@') + ' ' + opp.name + '</b> (' + opp.wins + '-' + opp.loss + '). ' + scout + '</span></div>';
    }
  }
  rows += '<div class="brief-row"><span><b>' + (G.pts || 0) + ' NIL</b> in the bank — spend it in the boost shop below.</span></div>';
  return '<div class="brief-card"><div class="bk">Week ' + (G.gi + 1) + ' Briefing</div>' + rows + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  NIL BOOST SHOP
// ═══════════════════════════════════════════════════════════

function renderShop() {
  var bought = shopBoughtThisWeek();
  var h = '';
  NIL_SHOP.forEach(function(item) {
    var isB = !!bought[item.id];
    h += '<div class="shop-item' + (isB ? ' bought' : '') + '">'
      + '<div class="si-body"><div class="si-name">' + item.name + '</div><div class="si-desc">' + item.desc + '</div></div>'
      + '<div class="si-cost">' + item.cost + '</div>'
      + (isB ? '<div style="font-size:12px;color:var(--grn2);width:56px;text-align:right;">Active</div>'
             : '<button class="btn-quiet" style="width:56px;text-align:right;" data-action="nil-buy" data-item="' + item.id + '">Buy</button>')
      + '</div>';
  });
  h += '<div style="font-size:12px;color:var(--txt3);padding-top:6px;">One of each per week. Winning earns NIL; ranked teams earn more.</div>';
  return panel('NIL boosts', h, { right: (G.pts || 0) + ' available' });
}

// ═══════════════════════════════════════════════════════════
//  COACH CARD + XP BAR
// ═══════════════════════════════════════════════════════════

function renderCoach() {
  var c = G.coach;
  if (!c || !c.firstName) return '';
  var lvl = c.level || 1, xp = c.xp || 0, need = coachXpToNext();
  var pct = clamp(Math.round(xp / need * 100), 0, 100);
  var hot = c.hotSeat ? ' <span class="tag t-rival">Hot seat</span>' : '';
  var body = '<div style="font-weight:600;">' + c.firstName + ' ' + c.lastName + hot + '</div>'
    + '<div style="font-size:12.5px;color:var(--txt2);margin:1px 0 8px;">Year ' + (c.tenure + 1) + ', career ' + c.careerWins + '-' + c.careerLoss + '</div>'
    + '<div class="xp-bar"><div class="xp-fill" style="width:' + pct + '%;"></div></div>'
    + '<div class="xp-lbl"><span>Level ' + lvl + '</span><span>' + xp + ' / ' + need + ' XP</span></div>';
  return panel('Coach', body);
}

// ═══════════════════════════════════════════════════════════
//  AWARD RACES
// ═══════════════════════════════════════════════════════════

function renderRaces() {
  var rows = poyRace();
  if (!rows.length) return '';
  var h = '<table><thead><tr><th>#</th><th>Player</th><th>Team</th><th class="num">PPG</th></tr></thead><tbody>';
  rows.forEach(function(r, i) {
    h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + r.name + ' <span style="color:var(--txt3);">' + r.pos + '</span></td>'
      + '<td>' + r.team + '</td><td class="num">' + r.ppg.toFixed(1) + '</td></tr>';
  });
  return panel('Player of the year watch', h + '</tbody></table>', { flush: true });
}

function renderMiniStandings() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  conf.sort(function(a, b) { return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts; });
  var h = '<table><thead><tr><th>#</th><th>Team</th><th class="num">Conf</th><th class="num">Overall</th></tr></thead><tbody>';
  conf.slice(0, 8).forEach(function(tm, i) {
    h += '<tr' + (tm.id === G.tid ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + tm.name + '</td>'
      + '<td class="num">' + tm.cWins + '-' + tm.cLoss + '</td><td class="num">' + tm.wins + '-' + tm.loss + '</td></tr>';
  });
  return panel(t.conf + ' standings', h + '</tbody></table>', { flush: true });
}

// ═══════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

export function renderDashboard() {
  var el = ge('dash-content');
  if (!el) return;
  if (!G.teams || !G.teams.length) {
    el.innerHTML = '<div style="padding:40px;color:var(--txt3);text-align:center;">Loading…</div>';
    return;
  }
  var t = G.teams[G.tid];
  if (!t) return;

  // Tournament immersion: when the postseason begins, the home page swaps
  // to the tournament bracket view (user's games highlighted) instead of
  // the regular-season dashboard. Falls back to the dashboard if no
  // tournament data is present yet. New season (phase 'reg') reverts.
  if (G.phase === 'conf_tourn' || G.phase === 'ncaa') {
    var hub = bracketHubHTML();
    if (hub) { el.innerHTML = hub; return; }
  }

  var h = '';
  h += renderSchoolCard();
  h += renderLastFinal();
  h += '<div class="grid-2">';
  h += '<div>' + renderGameCard() + renderNotifications() + renderShop() + '</div>';
  h += '<div>' + renderMiniStandings() + renderRaces() + renderCoach() + '</div>';
  h += '</div>';

  el.innerHTML = h;
}

// Kept for main.js import compat (unused by the new dashboard).
export function renderStatsBanner() { return ''; }
