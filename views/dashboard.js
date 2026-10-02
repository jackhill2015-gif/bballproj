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
import { ge, clamp, getTOvr, fR } from '../utils.js';
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
        per: (p.s.pts + p.s.reb + p.s.ast) / gp
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

function renderSchoolCard() {
  var t = G.teams[G.tid];
  var netRank = userRank();
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  confTeams.sort(function(a, b) { return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts; });
  var confRank = confTeams.findIndex(function(x) { return x.id === G.tid; }) + 1;
  // Seed projection appears once the season takes shape (CD shows N/A early)
  var seed = G.gi >= 8 && netRank <= 64 ? Math.ceil(netRank / 4) : 0;

  var d = rankDelta();
  var arrow = '';
  if (d.prev) {
    arrow = d.delta > 0 ? ' <span class="arrow-up">▲' + d.delta + '</span>'
      : d.delta < 0 ? ' <span class="arrow-dn">▼' + Math.abs(d.delta) + '</span>' : '';
  }

  return '<div class="card school-card">'
    + '<div class="sc-top">' + teamLogo(t.name, 'lg')
    + '<div class="sc-id"><div class="sc-name">' + t.name + '</div></div>'
    + '<div class="sc-conf">' + t.conf + '</div></div>'
    + '<div class="sc-record">' + fR(t.wins, t.loss) + '</div>'
    + '<div class="sc-cols">'
    + '<div><div class="sc-lab">National</div><div class="sc-val">' + netRank + arrow + '</div></div>'
    + '<div><div class="sc-lab">Conference</div><div class="sc-val">' + confRank + '</div></div>'
    + '<div><div class="sc-lab">Seed</div><div class="sc-val">' + (seed || 'N/A') + '</div></div>'
    + '</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  NOTIFICATIONS (collapsible row, CD pattern)
// ═══════════════════════════════════════════════════════════

function renderNotifications() {
  var ns = notifState();
  var h = '<div class="card notif-card" data-action="notif-toggle" role="button" tabindex="0" aria-expanded="' + ns.open + '">'
    + '<div class="notif-row"><span class="ni">🔔</span><span class="notif-label">Notifications</span>'
    + (ns.unread ? '<span class="notif-badge">' + ns.unread + '</span>' : '')
    + '<span class="notif-chev">' + (ns.open ? '▲' : '▼') + '</span></div>';
  if (ns.open) {
    h += '<div class="notif-body">';
    var logs = (G.logs || []).slice(0, 10);
    if (!logs.length) h += '<div style="font-size:13px;color:var(--txt3);padding:8px 0;">Nothing yet — sim your first game.</div>';
    logs.forEach(function(lg) {
      var badge = lg.type === 'w' ? 'W' : lg.type === 'l' ? 'L' : '•';
      h += '<div class="headline"><span class="hbadge ' + lg.type + '">' + badge + '</span><span>' + lg.text + '</span></div>';
    });
    h += '</div>';
  }
  return h + '</div>';
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
  var job, cls;
  if (c.hotSeat) {
    job = '🔥 HOT SEAT';
    cls = 'danger';
  } else if (wins < exp.danger) {
    job = '⚠️ Job in danger';
    cls = 'warn';
  } else if (wins < exp.low) {
    job = '😐 Below expectations';
    cls = 'warn';
  } else {
    job = '✅ Job safe';
    cls = 'safe';
  }
  return '<div class="card exp-card">'
    + '<div class="exp-record">Record: ' + exp.low + '–' + exp.high + '</div>'
    + '<div class="exp-label">Season Expectations</div>'
    + '<div class="exp-job ' + cls + '">' + job
    + '<small>' + wins + ' wins so far · firing line: under ' + exp.danger + ' wins</small></div></div>';
}

// ═══════════════════════════════════════════════════════════
//  GAME CARD — two big blue buttons (CD pattern)
// ═══════════════════════════════════════════════════════════

function renderGameCard() {
  var t = G.teams[G.tid];

  function bigButtons() {
    return '<div class="big-btn-row">'
      + '<button class="btn-big" data-action="play" data-mode="live">▶ Play Game</button>'
      + '<button class="btn-big" data-action="play" data-mode="quick">⏩ Sim Game</button></div>';
  }

  if (G.phase === 'reg' && G.gi < 30) {
    var ng = t.sched[G.gi];
    var no = ng && ng.opp !== undefined && ng.opp !== null ? G.teams[ng.opp] : null;
    if (ng && no) {
      var wp = winProb(t, no, ng.home);
      var r = rivalIds(), rev = revengeIds();
      var flags = (r[no.id] ? '<span class="tag t-rival">🏆 Rivalry</span> ' : '')
        + (rev[no.id] ? '<span class="tag t-revenge">😤 Revenge</span>' : '');
      return '<div class="card game-card">'
        + '<div class="gc-opp-row">' + teamLogo(no.name)
        + '<div class="gc-opp-id"><div class="gc-opp-name">' + (ng.home ? 'vs ' : '@ ') + no.name + '</div>'
        + '<div class="gc-opp-sub">Week ' + (G.gi + 1) + ' · ' + (ng.conf ? t.conf : 'Non-conference') + '</div></div>'
        + '<div class="gc-opp-rec">' + no.wins + '-' + no.loss + '</div></div>'
        + (flags ? '<div style="margin-top:10px;">' + flags + '</div>' : '')
        + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(wp) + ';font-weight:800;">' + wp + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + wpColor(wp) + ';"></div></div>'
        + bigButtons()
        + '<button class="btn btn-ghost btn-sm btn-full" style="margin-top:8px;" data-action="nav" data-view="strategy">🧠 GAMEPLAN</button></div>';
    }
    return '<div class="card game-card"><div class="gc-opp-name">Bye week</div>'
      + '<div class="gc-opp-sub">Week ' + (G.gi + 1) + ' — rest up.</div>'
      + '<div class="big-btn-row"><button class="btn-big" data-action="play" data-mode="quick">▶ Sim Week</button></div></div>';
  }

  if (G.phase === 'reg') {
    return '<div class="card game-card"><div class="card-title">Regular season complete</div>'
      + '<button class="btn btn-red btn-full" data-action="play" data-mode="quick">BEGIN CONFERENCE TOURNAMENT</button></div>';
  }

  return '<div class="card game-card"><div class="card-title">Offseason</div>'
    + '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px;">Recruit, develop, and reload for next season.</div>'
    + '<button class="btn btn-red btn-full" data-action="nav" data-view="offseason">OPEN OFFSEASON HQ</button></div>';
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
    rows += '<div class="brief-row"><span class="bi">📈</span><span>NET rank ' + mv + ' after last week.</span></div>';
  }
  var ng = t.sched[G.gi];
  if (ng && ng.opp !== undefined && ng.opp !== null && !ng.played) {
    var opp = G.teams[ng.opp];
    if (opp) {
      var oppRank = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === opp.id; }) + 1;
      var scout = oppRank <= 25 ? 'Ranked #' + oppRank + ' — bring your best.' : oppRank <= 64 ? 'A winnable resume game.' : 'Take care of business.';
      rows += '<div class="brief-row"><span class="bi">🔍</span><span>Scout: <b>' + (ng.home ? 'vs' : '@') + ' ' + opp.name + '</b> (' + opp.wins + '-' + opp.loss + '). ' + scout + '</span></div>';
    }
  }
  rows += '<div class="brief-row"><span class="bi">💰</span><span><b>' + (G.pts || 0) + ' NIL</b> in the bank — spend it in the boost shop below.</span></div>';
  return '<div class="brief-card"><div class="bk">Week ' + (G.gi + 1) + ' Briefing</div>' + rows + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  NIL BOOST SHOP
// ═══════════════════════════════════════════════════════════

function renderShop() {
  var bought = shopBoughtThisWeek();
  var h = '<div class="card"><div class="card-title">💰 NIL Boost Shop <span style="float:right;color:#7a5a10;">' + (G.pts || 0) + ' PTS</span></div>';
  NIL_SHOP.forEach(function(item) {
    var isB = !!bought[item.id];
    h += '<div class="shop-item' + (isB ? ' bought' : '') + '">'
      + '<div class="si-ico">' + item.ico + '</div>'
      + '<div class="si-body"><div class="si-name">' + item.name + '</div><div class="si-desc">' + item.desc + '</div></div>'
      + '<div style="text-align:right;"><div class="si-cost">' + item.cost + ' pts</div>'
      + (isB ? '<div style="font-size:10px;color:var(--grn2);font-weight:800;">ACTIVE ✓</div>'
             : '<button class="btn btn-sm btn-ghost" style="margin-top:4px;" data-action="nil-buy" data-item="' + item.id + '">BUY</button>')
      + '</div></div>';
  });
  h += '<div style="font-size:11px;color:var(--txt3);">One of each per week. Earn NIL by winning — ranked teams earn more.</div></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  COACH CARD + XP BAR
// ═══════════════════════════════════════════════════════════

function renderCoach() {
  var c = G.coach;
  if (!c || !c.firstName) return '';
  var lvl = c.level || 1, xp = c.xp || 0, need = coachXpToNext();
  var pct = clamp(Math.round(xp / need * 100), 0, 100);
  var hot = c.hotSeat ? ' <span class="tag t-rival">Hot Seat</span>' : '';
  var h = '<div class="card"><div class="card-title">Coach</div>'
    + '<div style="font-size:15px;font-weight:900;">' + c.firstName + ' ' + c.lastName + hot + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin:2px 0 8px;">Year ' + (c.tenure + 1) + ' · Career ' + c.careerWins + '-' + c.careerLoss + '</div>'
    + '<div class="xp-wrap"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">'
    + '<span style="font-weight:800;color:var(--blu);">LEVEL ' + lvl + '</span><span style="color:var(--txt3);">' + xp + ' / ' + need + ' XP</span></div>'
    + '<div class="xp-bar"><div class="xp-fill" style="width:' + pct + '%;"></div></div>'
    + '<div class="xp-lbl"><span>Wins, upsets & titles earn XP</span><span>Level-up: +1 all attrs</span></div></div></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  AWARD RACES
// ═══════════════════════════════════════════════════════════

function renderRaces() {
  var rows = poyRace();
  if (!rows.length) return '';
  var h = '<div class="card"><div class="card-title">⭐ POY Watch</div>';
  rows.forEach(function(r, i) {
    var yours = r.tid === G.tid;
    h += '<div class="leader-row"><div class="leader-rank">' + (i + 1) + '</div>'
      + '<div class="leader-name">' + r.name + (yours ? ' <span class="yours-pill">YOURS</span>' : '')
      + '<small>' + r.pos + ' · ' + r.cls + ' · ' + r.team + '</small></div>'
      + '<div class="leader-val">' + r.ppg.toFixed(1) + '</div></div>';
  });
  return h + '</div>';
}

function renderMiniStandings() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  conf.sort(function(a, b) { return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts; });
  var h = '<div class="card"><div class="card-title">' + t.conf + ' Standings</div>';
  conf.slice(0, 8).forEach(function(tm, i) {
    var isU = tm.id === G.tid;
    h += '<div class="leader-row"' + (isU ? ' style="background:var(--blu-soft);border-radius:6px;padding-left:8px;padding-right:8px;"' : '') + '>'
      + '<div class="leader-rank">' + (i + 1) + '</div>'
      + '<div class="leader-name"' + (isU ? ' style="font-weight:900;color:var(--blu);"' : '') + '>' + tm.name + '</div>'
      + '<div style="font-family:var(--mono);font-size:12px;color:var(--txt3);">' + tm.cWins + '-' + tm.cLoss + '</div></div>';
  });
  return h + '</div>';
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
  h += renderNotifications();
  h += renderExpectations();
  h += renderGameCard();
  h += renderBriefing();

  h += '<div class="grid-2">';
  h += '<div>' + renderShop() + renderCoach() + '</div>';
  h += '<div>' + renderRaces() + renderMiniStandings() + '</div>';
  h += '</div>';

  el.innerHTML = h;
}

// Kept for main.js import compat (unused by the new dashboard).
export function renderStatsBanner() { return ''; }
