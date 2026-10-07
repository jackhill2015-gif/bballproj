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
import { ge, clamp, getTOvr, fR, fmtScore, awardScore, winProb as sharedWinProb } from '../utils.js';
import { rankMap } from '../ratings.js';
import { ensureGoals, progress, GOAL_REWARD } from '../goals.js';
import { FACILITIES, FACILITY_MAX, myFacilities, upgradeCost } from '../facilities.js';
import { STREAMS, BUCKETS, ledger, totals, committed } from '../finance.js';
import { G } from '../state.js';
import { bracketHubHTML, bindBracket, scrollBracketToRound } from './bracket.js';
import { offseasonMovesHTML } from './signings.js';
import {
  userRank, rankDelta, currentStreak, coachXpToNext,
  NIL_SHOP, shopBoughtThisWeek, teamLogo, teamColor, notifState
} from '../ui.js';

// Clickable player name (opens the profile; convention in views/player.js)
function pLink(name, tid) {
  return '<span class="pname" data-action="player" data-player-name="' + String(name).replace(/"/g, '&quot;') + '" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

// Clickable team name (opens the team page; convention in views/team.js)
function tLink(tid, name) {
  return '<span class="tname-link" data-action="team" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}


// ── Cached POY race (recomputed when week/phase changes) ──
var _raceCache = { key: '', rows: [] };
export function poyRace(n) {
  var key = G.yr + '-' + G.gi + '-' + G.phase;
  if (_raceCache.key === key) return _raceCache.rows.slice(0, n || 3);
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
  _raceCache = { key: key, rows: rows.slice(0, 10) };
  return _raceCache.rows.slice(0, n || 3);
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
  return sharedWinProb(getTOvr(t), getTOvr(opp), home ? 4 : -4, dm);
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
  if (!r || G.phase === 'offseason' || (r.yr && r.yr !== G.yr)) return '';
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
  var logs = (G.logs || []).slice(0, 5);
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
  // Keep it to one short line; the danger line only shows when it matters
  var detail = gp === 0 ? '' : (cls === 'safe' ? 'on pace for ' + proj : 'on pace for ' + proj + ', at risk under ' + exp.danger);
  return '<div class="exp-line" style="border:none;padding:6px 0 0;">Expected <b>' + exp.low + '–' + exp.high + ' wins</b>'
    + (exp.ncaa ? ' and an NCAA bid' : '') + ' · '
    + '<span class="' + cls + '">' + job + '</span>'
    + (detail ? ' <span style="color:var(--txt3);">· ' + detail + '</span>' : '') + '</div>';
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
      var body = '<div class="ng-row"><div class="ng-opp">' + (ng.home ? 'vs ' : 'at ') + (rk[no.id] <= 25 ? '#' + rk[no.id] + ' ' : '') + tLink(no.id, no.name) + flags + '</div>'
        + '<div class="ng-meta">' + no.wins + '-' + no.loss + ', OVR ' + getTOvr(no) + '</div></div>'
        + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(wp) + ';font-weight:600;">' + wp + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + wpColor(wp) + ';"></div></div>'
        + buttons()
        + '<div style="display:flex;gap:16px;margin-top:2px;">'
        + '<button class="btn-quiet" style="padding-left:0;" data-action="nav" data-view="roster">Edit gameplan</button>'
        + '<button class="btn-quiet" style="padding-left:0;" data-action="nav" data-view="program">Boosts</button></div>'
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
    + '<button class="btn-big" data-action="nav" data-view="offseason">Begin offseason</button>');
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
  rows += '<div class="brief-row"><span><b>' + (G.pts || 0) + ' NIL</b> in the budget.</span></div>';
  return '<div class="brief-card"><div class="bk">Week ' + (G.gi + 1) + ' Briefing</div>' + rows + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  NIL BOOST SHOP
// ═══════════════════════════════════════════════════════════

function renderGoals() {
  var gs = ensureGoals();
  if (!gs) return '';
  var h = '<table><tbody>';
  gs.list.forEach(function(g) {
    var pr = progress(g);
    h += '<tr><td style="width:22px;color:' + (pr.done ? 'var(--grn2)' : 'var(--txt3)') + ';">' + (pr.done ? '✓' : '○') + '</td>'
      + '<td>' + g.text + '<div style="font-size:12px;color:var(--txt3);">' + pr.label + '</div></td></tr>';
  });
  h += '</tbody></table><div style="font-size:12px;color:var(--txt3);padding:6px 10px 8px;">Each goal met: +' + GOAL_REWARD.skill + ' skill point and +' + GOAL_REWARD.nil + ' NIL. All three also raise school prestige.</div>';
  return panel('Season goals', h, { flush: true, right: 'From the athletic director' });
}

function renderFinances() {
  var l = ledger(), tot = totals(l), com = committed();
  var NOTE = {
    gate: l.notes.gate || 'Paid after each home game',
    donors: l.notes.donors || 'Paid each offseason, before the transfer portal',
    tv: l.notes.tv || 'Paid after week 1',
    tourney: l.notes.tourney || 'Each NCAA tournament win pays, more each round',
    ad: l.notes.ad || 'Season goals met, paid at season end'
  };
  var h = '<div class="kv" style="padding:8px 10px 6px;"><div><b>' + (G.pts || 0) + '</b><span>Budget</span></div>'
    + '<div><b>' + tot.income + '</b><span>Earned this season</span></div>'
    + '<div><b>' + tot.spend + '</b><span>Spent</span></div>'
    + (com ? '<div><b>' + com + '</b><span>Committed</span></div>' : '') + '</div>';
  h += '<table><tbody>';
  STREAMS.forEach(function(s) {
    h += '<tr><td>' + s[1] + '<div style="font-size:11.5px;color:var(--txt3);">' + NOTE[s[0]] + '</div></td><td class="num">' + (l.income[s[0]] ? '+' + l.income[s[0]] : '–') + '</td></tr>';
  });
  BUCKETS.forEach(function(b) {
    if (!l.spend[b[0]]) return;
    h += '<tr><td style="color:var(--txt2);">' + b[1] + '</td><td class="num" style="color:var(--txt2);">−' + l.spend[b[0]] + '</td></tr>';
  });
  h += '</tbody></table>';
  return panel('Program finances', h, { flush: true, right: G.yr + ' season, NIL' });
}

function renderFacilities() {
  var f = myFacilities();
  var h = '';
  FACILITIES.forEach(function(x) {
    var lvl = f[x.id] || 0, cost = upgradeCost(lvl);
    var maxed = lvl >= FACILITY_MAX;
    h += '<div class="shop-item"><div class="si-body"><div class="si-name">' + x.name + ' <span style="color:var(--txt3);font-weight:400;">Level ' + lvl + ' of ' + FACILITY_MAX + '</span></div>'
      + '<div class="si-desc">' + x.effect(lvl) + '</div></div>'
      + (maxed ? '<div style="font-size:12px;color:var(--txt3);width:92px;text-align:right;">Maxed</div>'
        : '<button class="btn-quiet" style="width:92px;text-align:right;" data-action="fac-up" data-fac="' + x.id + '"' + ((G.pts || 0) < cost ? ' disabled' : '') + '>Upgrade ' + cost + '</button>')
      + '</div>';
  });
  return panel('Facilities', h, { right: (G.pts || 0) + ' NIL available' });
}

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
  h += '<div style="font-size:12px;color:var(--txt3);padding-top:6px;">One of each per week.</div>';
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
  body += '<button class="btn-quiet" style="padding-left:0;margin-top:4px;" data-action="nav" data-view="trophies">Trophy room</button>';
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
    h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + pLink(r.name, r.tid) + ' <span style="color:var(--txt3);">' + r.pos + '</span></td>'
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
    h += '<tr' + (tm.id === G.tid ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + tLink(tm.id, tm.name) + '</td>'
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
    if (hub) { el.innerHTML = hub; bindBracket(el, renderDashboard); scrollBracketToRound(el); return; }
  }

  // Home is "what's next": record, last result, the next game, goals,
  // conference race and news. Money, boosts, facilities and the coach
  // live on the Program screen; the POY race lives in Stats.
  var h = '';
  h += renderSchoolCard();
  h += renderLastFinal();
  h += '<div class="grid-2">';
  h += '<div>' + renderGameCard() + offseasonMovesHTML() + renderGoals() + '</div>';
  h += '<div>' + renderMiniStandings() + renderNotifications() + '</div>';
  h += '</div>';

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  PROGRAM — the athletic department office: budget, boosts,
//  facilities, coach. Same panels that used to sit on Home.
// ═══════════════════════════════════════════════════════════

export function renderProgram() {
  var el = ge('program-content');
  if (!el || !G.teams || !G.teams[G.tid]) return;
  var t = G.teams[G.tid];
  var h = '<div class="sec-head">' + t.name + ' program</div>'
    + '<div class="sec-sub" style="margin-bottom:12px;">NIL budget, boosts, facilities and your coaching career.</div>';
  h += '<div class="grid-2">';
  h += '<div>' + renderFinances() + (G.phase === 'offseason' ? '' : renderShop()) + '</div>';
  h += '<div>' + renderFacilities() + renderCoach() + '</div>';
  h += '</div>';
  el.innerHTML = h;
}

// Kept for main.js import compat (unused by the new dashboard).
export function renderStatsBanner() { return ''; }
