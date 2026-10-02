// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/dashboard.js
//  Dashboard-as-digest: identity strip, weekly briefing,
//  next-game card (rivalry hooks), NIL boost shop, coach XP,
//  award races, headlines. Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { ge, clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';
import { getUserConfMatchup, getUserNCAAmatchup, getConfRoundName } from '../tournament.js';
import { userRank, rankDelta, currentStreak, coachXpToNext, NIL_SHOP, shopBoughtThisWeek } from '../ui.js';

// ── Cached POY race (recomputed when week/phase changes) ──
var _raceCache = { key: '', rows: [] };
function poyRace() {
  var key = G.yr + '-' + G.gi + '-' + G.phase;
  if (_raceCache.key === key) return _raceCache.rows;
  var rows = [];
  G.teams.forEach(function(tm) {
    tm.rost.forEach(function(p) {
      var gp = p.s.gp || 0;
      if (gp < 8) return;
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
function gameFlags(oppId) {
  var r = rivalIds(), rev = revengeIds();
  var h = '';
  if (r[oppId]) h += '<span class="tag t-rival">🏆 Rivalry</span>';
  if (rev[oppId]) h += '<span class="tag t-revenge">😤 Revenge</span>';
  return h;
}

function winProb(t, opp, home) {
  var dm = DIFF_MOD[G.difficulty] || 0;
  return clamp(Math.round(50 + (getTOvr(t) + dm - getTOvr(opp)) * 1.3 + (home ? 4 : -4)), 5, 95);
}
function wpColor(wp) { return wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)'; }

function rankArrowHTML() {
  var d = rankDelta();
  if (!d.prev) return '';
  if (d.delta > 0) return ' <span class="arrow-up">▲' + d.delta + '</span>';
  if (d.delta < 0) return ' <span class="arrow-dn">▼' + Math.abs(d.delta) + '</span>';
  return ' <span class="arrow-flat">–</span>';
}

// ═══════════════════════════════════════════════════════════
//  STAT STRIP (kept as a named export for main.js compat)
// ═══════════════════════════════════════════════════════════

export function renderStatsBanner() {
  var t = G.teams[G.tid];
  var netRank = userRank();
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  confTeams.sort(function(a, b) { return (b.cWins / Math.max(1, b.cWins + b.cLoss)) - (a.cWins / Math.max(1, a.cWins + a.cLoss)) || b.pts - a.pts; });
  var confRank = confTeams.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var st = currentStreak();
  var streakTxt = st > 0 ? 'W' + st : st < 0 ? 'L' + Math.abs(st) : '–';
  var seed = netRank <= 64 ? Math.ceil(netRank / 4) : 0;
  var pulse = seed >= 1 && seed <= 4 ? 'LOCK' : seed <= 8 ? 'BUBBLE IN' : seed <= 16 ? 'IN' : 'OUT';
  var pulseCol = seed >= 1 && seed <= 4 ? 'var(--grn2)' : seed <= 8 ? 'var(--gld2)' : seed <= 16 ? 'var(--txt2)' : 'var(--txt3)';

  var cells = [
    { l: 'Overall', v: fR(t.wins, t.loss) },
    { l: t.conf, v: fR(t.cWins, t.cLoss) },
    { l: 'NET Rank', v: '#' + netRank + rankArrowHTML(), hot: netRank <= 25 },
    { l: 'Conf Rank', v: '#' + confRank + '/' + confTeams.length },
    { l: 'Streak', v: streakTxt, hot: st >= 3 },
    { l: 'Seed Pulse', v: (seed ? '#' + seed : '—') + ' <span style="font-size:9px;font-weight:800;color:' + pulseCol + ';">' + pulse + '</span>' }
  ];
  var h = '<div class="stat-strip">';
  cells.forEach(function(c) {
    h += '<div class="stat-cell' + (c.hot ? ' hot' : '') + '"><div class="sv">' + c.v + '</div><div class="sl">' + c.l + '</div></div>';
  });
  return h + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  WEEKLY BRIEFING (P2: rank move, scout note, headline, nudge)
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
  } else {
    rows += '<div class="brief-row"><span class="bi">🔍</span><span>Bye week — rest up and hit the film room.</span></div>';
  }
  var hl = (G.logs || [])[0];
  if (hl) rows += '<div class="brief-row"><span class="bi">📰</span><span>' + hl.text.replace(/<[^>]*>/g, '').slice(0, 90) + '</span></div>';
  rows += '<div class="brief-row"><span class="bi">💰</span><span><b>' + (G.pts || 0) + ' NIL</b> in the bank — spend it in the boost shop below.</span></div>';
  return '<div class="brief-card"><div class="bk">Week ' + (G.gi + 1) + ' Briefing</div>' + rows + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  NEXT-GAME CARD
// ═══════════════════════════════════════════════════════════

function renderGameCard() {
  var t = G.teams[G.tid];
  var h = '';

  function simButtons(modePrefix) {
    return '<div class="action-btns">'
      + '<button class="btn btn-red btn-full" data-action="play" data-mode="quick">⚡ QUICK SIM</button>'
      + '<button class="btn btn-ghost btn-full" data-action="play" data-mode="live">▶ LIVE SIM</button></div>';
  }
  function oppLine(opp, home, seedTxt) {
    var oppRank = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === opp.id; }) + 1;
    var rankStr = oppRank <= 25 ? '<span style="font-size:12px;color:var(--gld2);font-weight:800;">#' + oppRank + ' </span>' : '';
    var wp = winProb(t, opp, home);
    return '<div class="matchup-opp">' + rankStr + opp.name + '</div>'
      + '<div class="matchup-meta">'
      + '<span class="tag ' + (home ? 't-home' : 't-away') + '">' + (home ? 'Home' : 'Away') + '</span>'
      + (seedTxt ? '<span class="tag t-cf">' + seedTxt + '</span>' : '')
      + gameFlags(opp.id)
      + '<span style="color:var(--txt2);">OVR ' + getTOvr(opp) + ' · ' + opp.wins + '-' + opp.loss + '</span></div>'
      + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(wp) + ';font-weight:800;">' + wp + '%</span></div>'
      + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + wpColor(wp) + ';"></div></div>';
  }

  if (G.phase === 'reg' && G.gi < 30) {
    var ng = t.sched[G.gi];
    var no = ng && ng.opp !== undefined && ng.opp !== null ? G.teams[ng.opp] : null;
    if (ng && no) {
      var flags = gameFlags(no.id);
      h += '<div class="matchup-card"><div class="card-title">Game ' + (G.gi + 1) + ' of 30' + (ng.conf ? ' · ' + t.conf : ' · Non-conf') + '</div>'
        + oppLine(no, ng.home) + simButtons() + '</div>';
    } else {
      h += '<div class="matchup-card"><div class="card-title">Game ' + (G.gi + 1) + ' of 30</div>'
        + '<div style="font-size:14px;font-weight:700;">Bye week</div>'
        + '<div class="action-btns"><button class="btn btn-red btn-full" data-action="play" data-mode="quick">▶ SIM WEEK</button></div></div>';
    }
  } else if (G.phase === 'reg') {
    h += '<div class="matchup-card"><div class="card-title">Regular season complete</div>'
      + '<button class="btn btn-red btn-full" data-action="play" data-mode="quick">BEGIN CONFERENCE TOURNAMENT</button></div>';
  } else if (G.phase === 'conf_tourn') {
    var cm = getUserConfMatchup();
    if (cm) {
      var m = cm.matchup;
      var opp = m.t1.id === G.tid ? m.t2 : m.t1;
      var seeds = cm.ct.seeds || [];
      var us = seeds.findIndex(function(x) { return x.id === G.tid; }) + 1;
      var os = seeds.findIndex(function(x) { return x.id === opp.id; }) + 1;
      h += '<div class="matchup-card" style="border-left-color:var(--gld);"><div class="card-title">' + getConfRoundName(cm.ct, cm.conf) + ' · You are #' + us + '</div>'
        + '<div class="matchup-opp">#' + os + ' ' + opp.name + '</div>'
        + '<div class="matchup-meta"><span class="tag t-cf">Conf Tourney</span>' + gameFlags(opp.id)
        + '<span style="color:var(--txt2);">OVR ' + getTOvr(opp) + ' · ' + opp.wins + '-' + opp.loss + '</span></div>'
        + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(winProb(t, opp, true)) + ';font-weight:800;">' + winProb(t, opp, true) + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + winProb(t, opp, true) + '%;background:' + wpColor(winProb(t, opp, true)) + ';"></div></div>'
        + simButtons() + '</div>';
    } else {
      h += '<div class="matchup-card"><div class="card-title">Conference tournament</div>'
        + '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px;">Your run is over. Simming the rest of the field…</div>'
        + '<button class="btn btn-red btn-full" data-action="play" data-mode="quick">ADVANCE</button></div>';
    }
  } else if (G.phase === 'ncaa') {
    var nm = getUserNCAAmatchup();
    if (nm) {
      var uIsB1 = nm.b1.team.id === G.tid;
      var ue = uIsB1 ? nm.b1 : nm.b2, oe = uIsB1 ? nm.b2 : nm.b1;
      var nopp = oe.team;
      var nwp = winProb(t, nopp, true);
      h += '<div class="matchup-card" style="border-left-color:var(--gld);"><div class="card-title">March Madness · You are #' + ue.seed + '</div>'
        + '<div class="matchup-opp">#' + oe.seed + ' ' + nopp.name + '</div>'
        + '<div class="matchup-meta"><span class="tag t-cf">NCAA Tournament</span>' + gameFlags(nopp.id)
        + '<span style="color:var(--txt2);">OVR ' + getTOvr(nopp) + ' · ' + nopp.wins + '-' + nopp.loss + '</span></div>'
        + '<div class="prob-row"><span>Win probability</span><span style="color:' + wpColor(nwp) + ';font-weight:800;">' + nwp + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + nwp + '%;background:' + wpColor(nwp) + ';"></div></div>'
        + simButtons() + '</div>';
    } else {
      h += '<div class="matchup-card"><div class="card-title">NCAA Tournament</div>'
        + '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px;">Your run is over. Watch the rest unfold.</div>'
        + '<button class="btn btn-red btn-full" data-action="play" data-mode="quick">SIM NEXT ROUND</button></div>';
    }
  } else if (G.phase === 'offseason') {
    h += '<div class="matchup-card"><div class="card-title">Offseason</div>'
      + '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px;">Recruit, develop, and reload for next season.</div>'
      + '<button class="btn btn-red btn-full" data-action="nav" data-view="offseason">OPEN OFFSEASON HQ</button></div>';
  }
  return h;
}

// ═══════════════════════════════════════════════════════════
//  NIL BOOST SHOP (P2)
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
//  COACH CARD + XP BAR (P2)
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
    + '<div class="xp-lbl"><span>Wins, upsets & titles earn XP</span><span>Level-up: +1 all attrs</span></div></div>'
    + '<div class="grid-2" style="grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">';
  [['off', 'OFF'], ['def', 'DEF'], ['dev', 'DEV'], ['rec', 'REC']].forEach(function(r) {
    h += '<div style="text-align:center;padding:6px;background:var(--s2);border-radius:6px;">'
      + '<div style="font-family:var(--mono);font-size:16px;font-weight:900;color:var(--blu);">' + (c[r[0]] || 70) + '</div>'
      + '<div style="font-size:9px;color:var(--txt3);font-weight:700;">' + r[1] + '</div></div>';
  });
  return h + '</div></div>';
}

// ═══════════════════════════════════════════════════════════
//  AWARD RACES (P2: POY watch, user's players flagged)
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

// ═══════════════════════════════════════════════════════════
//  HEADLINES + MINI STANDINGS
// ═══════════════════════════════════════════════════════════

function renderHeadlines() {
  var logs = (G.logs || []).slice(0, 6);
  var h = '<div class="card"><div class="card-title">📰 Headlines</div>';
  if (!logs.length) return h + '<div style="font-size:12px;color:var(--txt3);">No news yet — sim your first game.</div></div>';
  logs.forEach(function(lg) {
    var badge = lg.type === 'w' ? 'W' : lg.type === 'l' ? 'L' : '•';
    h += '<div class="headline"><span class="hbadge ' + lg.type + '">' + badge + '</span><span>' + lg.text + '</span></div>';
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

function renderExpectations() {
  var exp = G.expectations;
  if (!exp) return '';
  var wins = G.teams[G.tid].wins;
  var pct = clamp(Math.round(wins / Math.max(1, exp.high) * 100), 0, 100);
  var col = wins >= exp.low ? 'var(--grn2)' : wins >= exp.danger ? 'var(--gld2)' : 'var(--red)';
  return '<div class="card"><div class="card-title">🎯 Season Expectations</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">'
    + '<span style="color:var(--txt2);">Target ' + exp.low + '–' + exp.high + ' wins</span>'
    + '<span style="font-weight:800;color:' + col + ';">' + wins + ' W</span></div>'
    + '<div class="xp-bar"><div class="xp-fill" style="width:' + pct + '%;background:' + col + ';"></div></div></div>';
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

  var h = '';
  h += '<div style="margin-bottom:14px;"><div class="sec-head">' + t.name + '</div>'
    + '<div class="sec-sub">' + t.conf + ' · Season ' + G.yr + ' · Prestige ' + (t.schoolPrestige || '—') + '</div></div>';

  h += renderStatsBanner();
  h += renderBriefing();

  h += '<div class="grid-2">';
  h += '<div>' + renderGameCard() + renderCoach() + '</div>';
  h += '<div>' + renderShop() + renderRaces() + renderExpectations() + renderMiniStandings() + renderHeadlines() + '</div>';
  h += '</div>';

  el.innerHTML = h;
}
