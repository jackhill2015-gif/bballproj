// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/retention.js
//  Player retention (NIL step 2). Before the transfer portal opens,
//  2–4 of your best returning players ask for an NIL deal to stay.
//    Keep    — pay the ask now: he will not enter the portal this year
//    Let go  — he enters the portal (if nobody signs him, he stays)
//  Flow: turnover → proceedToRecruiting → 'retention' (when there are
//  asks) → finishRetention → portal. Ledger bucket: 'retention'.
//  State: G.retention = { yr, asks: [{ name, pos, cls, ovr, pot, ppg,
//  ask, why, decision: null | 'keep' | 'go' }] }
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { oldOvr } from '../utils.js';
import { noteSpend, totals } from '../finance.js';

// One decimal, or a dash when a player has no stats (redshirts, no minutes)
function f1(v) { return typeof v === 'number' && isFinite(v) ? v.toFixed(1) : '–'; }

var MORALE_DEFAULT = 50;

function round5(v) { return Math.round(v / 5) * 5; }

function pLink(name, tid) {
  return '<span class="pname" data-action="player" data-player-name="' + String(name).replace(/"/g, '&quot;') + '" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

function lastPpg(p) {
  var h = p.h || [];
  for (var i = h.length - 1; i >= 0; i--) {
    if (h[i][0] === G.yr && h[i][3] > 0) return h[i][4] / h[i][3];
  }
  return null;
}

// What a player asks to stay: scales with how good he is, softened by
// morale (happy players take less), with a premium for big producers.
export function retentionAsk(p) {
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  var base = 15 + Math.max(0, oldOvr(p.ovr) - 65) * 3;
  var moraleF = 1.25 - m / 200;              // morale 20 → 1.15, 50 → 1.0, 90 → 0.8
  var ppg = lastPpg(p) || 0;
  var prod = ppg >= 15 ? 1.15 : ppg >= 10 ? 1.05 : 1;
  // Bigger programs, bigger NIL market (prestige 30 → x0.84, 90 → x1.32)
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var market = 0.6 + sp / 125;
  return Math.max(25, Math.min(200, round5(base * moraleF * prod * market)));
}

function whyAsk(p, rank) {
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  var ppg = lastPpg(p) || 0;
  if (m < 35) return 'Unhappy with his role';
  if (rank === 0) return 'Best player on the roster';
  if (ppg >= 12) return 'Led the team in production';
  if ((p.pot || p.ovr) - p.ovr >= 6) return 'Knows his upside';
  return 'Other schools are calling';
}

function seasonLine(p) {
  var s = p.s || {}, gp = s.gp || 0;
  if (!gp) return null;
  return { ppg: Math.round(s.pts / gp * 10) / 10, rpg: Math.round(s.reb / gp * 10) / 10, apg: Math.round(s.ast / gp * 10) / 10 };
}

// Players who won't negotiate ("not interested in returning"), decided on
// the Departures screen so nothing surprises you later.
//  - Playing time sets each player's odds: starters almost never leave,
//    rotation players rarely, bench players who are good enough to play but
//    don't (within 2 of your 5th-best) are the likeliest. Morale scales it.
//  - Team performance scales the whole roster: a winning season and an NCAA
//    bid keep players home; a losing or disappointing one shakes them loose.
//  - How many can leave: 1 after a strong season, up to 2 after an average
//    one, up to 3 after a bad one.
export function seasonPull() {
  var t = G.teams[G.tid] || {};
  var gp = (t.wins || 0) + (t.loss || 0);
  var wp = gp ? t.wins / gp : 0.5;
  var sa = G.seasonAchievements || {};
  var f = 1.6 - Math.max(0, Math.min(1, (wp - 0.3) / 0.5)) * 1.1;   // .300 → 1.6, .550 → 1.05, .800 → 0.5
  if (sa.madeNCAA) f *= 0.85;
  if (sa.sweet16) f *= 0.85;
  if (G.coach && G.coach.hotSeat) f *= 1.15;                        // a disappointing season
  return Math.max(0.4, Math.min(1.8, f));
}
function leaveOdds(p, t, fifthBest, pull) {
  if (p.cls === 'SR' || p.rs) return null;
  var mins = p.mins || 0, m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  var deserves = p.ovr >= fifthBest - 2;
  var base, why;
  if (mins >= 25) { base = 0.008; why = 'Wants a fresh start'; }
  else if (mins >= 15) { base = 0.04; why = deserves ? 'Wants a bigger role' : 'Wants more minutes'; }
  else if (mins >= 5) { base = deserves ? 0.14 : 0.03; why = deserves ? 'Wants a bigger role' : 'Wants more minutes'; }
  else { base = deserves ? 0.17 : 0.035; why = deserves ? 'Stuck on the bench' : 'Wants more minutes'; }
  if (pull >= 1.3 && mins >= 15) why = 'Tired of losing';
  if (m < 35) why = 'Unhappy with his role';
  var chance = base * pull * (1.6 - m / 100);                      // morale 20 → x1.4, 50 → x1.1, 80 → x0.8
  return { chance: Math.min(0.6, chance), why: why };
}
export function rollNotReturning() {
  var t = G.teams[G.tid];
  if (!t) return [];
  var byOvr = t.rost.slice().sort(function(a, b) { return b.ovr - a.ovr; });
  var fifthBest = byOvr[4] ? byOvr[4].ovr : 0;
  var pull = seasonPull();
  var cap = pull <= 0.8 ? 1 : pull <= 1.25 ? 2 : 3;
  var hits = [];
  t.rost.forEach(function(p) {
    var o = leaveOdds(p, t, fifthBest, pull);
    if (o && Math.random() < o.chance) hits.push({ p: p, why: o.why, c: o.chance });
  });
  hits.sort(function(a, b) { return b.c - a.c; });
  return hits.slice(0, cap).map(function(h) {
    h.p.notReturningYr = G.yr; h.p.notReturningWhy = h.why;
    return h.p;
  });
}

// Build this offseason's asks from the user's returning players.
// The best two returners always ask; a third from the top six asks when
// unhappy or by chance, and a fourth only when he is clearly unhappy.
export function buildRetentionAsks() {
  var t = G.teams[G.tid];
  var pool = (t.rost || []).filter(function(p) { return p.cls !== 'SR' && !p.rs && p.notReturningYr !== G.yr; })
    .sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 6);
  var asks = [];
  pool.forEach(function(p, i) {
    var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
    var asksNow = i < 2 || (asks.length < 3 && (m < 40 || Math.random() < 0.2)) || (asks.length < 4 && m < 30);
    if (!asksNow || asks.length >= 4) return;
    var ppg = lastPpg(p), sl = seasonLine(p);
    asks.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, pot: p.pot || p.ovr,
      ppg: sl ? sl.ppg : (ppg === null ? null : Math.round(ppg * 10) / 10), rpg: sl ? sl.rpg : null, apg: sl ? sl.apg : null,
      ask: retentionAsk(p), why: whyAsk(p, i), decision: null });
  });
  // Keeping everyone should be possible but expensive: the combined asks
  // never exceed 75% of what the program brought in this season
  var cap = Math.floor(totals().income * 0.75); // at most 75%: round down
  var sum = asks.reduce(function(s, a) { return s + a.ask; }, 0);
  if (cap > 0 && sum > cap) {
    var f = cap / sum;
    asks.forEach(function(a) { a.ask = Math.max(25, Math.floor(a.ask * f / 5) * 5); });
  }
  G.retention = { yr: G.yr, asks: asks };
  return asks;
}

export function retentionPending() {
  var r = G.retention;
  if (!r || r.yr !== G.yr) return 0;
  return r.asks.filter(function(a) { return !a.decision; }).length;
}

function findPlayer(name) {
  var t = G.teams[G.tid];
  for (var i = 0; i < t.rost.length; i++) if (t.rost[i].name === name) return t.rost[i];
  return null;
}

// Keep or let go one player. Paying happens immediately; switching a
// "keep" to "let go" refunds the deal.
export function decideRetention(i, choice) {
  var r = G.retention; if (!r) return { ok: false };
  var a = r.asks[i]; if (!a || a.decision === choice) return { ok: false };
  // Change: back to undecided (a kept deal is refunded)
  if (choice === 'undo') {
    if (!a.decision) return { ok: false };
    if (a.decision === 'keep') { G.pts = (G.pts || 0) + a.ask; noteSpend('retention', -a.ask); }
    a.decision = null;
    return { ok: true };
  }
  if (choice === 'keep') {
    if ((G.pts || 0) < a.ask) return { ok: false, msg: 'Not enough NIL (' + a.ask + ' needed).' };
    G.pts -= a.ask; noteSpend('retention', a.ask);
  } else if (a.decision === 'keep') {
    G.pts = (G.pts || 0) + a.ask; noteSpend('retention', -a.ask);
  }
  a.decision = choice;
  return { ok: true, msg: choice === 'keep' ? a.name + ' is staying (' + a.ask + ' NIL)' : a.name + ' will enter the transfer portal' };
}

// Mark players before the portal is generated (portal.js reads these)
export function applyRetention() {
  var r = G.retention; if (!r || r.yr !== G.yr) return;
  r.asks.forEach(function(a) {
    var p = findPlayer(a.name); if (!p) return;
    if (a.decision === 'keep') {
      p.keptYr = G.yr;
      p.morale = Math.min(100, ((typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT) + 10);
    } else {
      p.forcePortal = true;
    }
  });
}

export function renderRetention() {
  var r = (G.retention && G.retention.yr === G.yr) ? G.retention : { asks: [] };
  var total = r.asks.reduce(function(s, a) { return s + a.ask; }, 0);
  var kept = r.asks.filter(function(a) { return a.decision === 'keep'; }).reduce(function(s, a) { return s + a.ask; }, 0);
  var t = G.teams[G.tid];
  var dep = G.departingPlayers || [];
  var notBack = (t.rost || []).filter(function(p) { return p.notReturningYr === G.yr; });
  var returning = (t.rost || []).length - notBack.length;
  var openSpots = Math.max(0, 15 - returning);
  var nilAvail = G.pts || 0;

  var h = '<div class="dep-wrap"><div class="acq-head"><div class="acq-title">Departures</div>'
    + '<div class="acq-line"><span>Who is leaving, and who wants an NIL deal to stay</span></div></div>';
  // Top summary
  h += '<div class="dep-sum"><div class="dep-stat"><b>' + openSpots + '</b><span>open spots</span></div>'
    + '<div class="dep-stat"><b>' + nilAvail + '</b><span>NIL available</span></div>'
    + '<div class="dep-stat"><b>' + total + '</b><span>total asks' + (kept ? ' · ' + kept + ' committed' : '') + '</span></div></div>';

  // ── NIL asks: table (700px+) and cards (under 700px) ──
  h += '<div class="dep-sec">NIL requests</div>';
  if (!r.asks.length) {
    h += '<div class="sg-none dep-empty">No one asked for an NIL deal this year.</div>';
  } else {
    h += nilTable(r.asks, nilAvail);
    h += nilCards(r.asks, nilAvail, total);
  }

  // ── Departing: table rows (700px+) and quiet list (under 700px) ──
  h += '<div class="dep-sec">Departing</div>';
  if (!dep.length && !notBack.length) {
    h += '<div class="sg-none dep-empty">Nobody is leaving this year.</div>';
  } else {
    h += '<div class="tbl-wrap dep-table-wrap"><table class="dep-table"><thead><tr>'
      + '<th class="st-name">Player</th><th>Pos</th><th>Class</th><th class="num">OVR</th><th class="num">POT</th>'
      + '<th class="num">MIN</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th>'
      + '<th>Status</th><th class="num">NIL ask</th><th></th>'
      + '</tr></thead><tbody>';
    h += depTableRows(dep, true);
    h += depTableRows(notBack, false, true);
    h += '</tbody></table></div>';
    h += depList(dep, notBack);
  }

  h += '<div class="dep-note">Pay to keep a player, or let him enter the transfer portal (he stays if no school signs him).</div>';
  h += '<div class="acq-sticky"><button class="btn-big btn-full" data-ret-done="1">Open the transfer portal</button></div></div>';
  return h;
}

// One decimal, or a dash for a player with no season stats
function fmt1(v) { return typeof v === 'number' ? v.toFixed(1) : '—'; }

// NIL asks as a table (Basketball GM layout, 700px+)
function nilTable(asks, nilAvail) {
  var h = '<div class="tbl-wrap dep-table-wrap"><table class="dep-table"><thead><tr>'
    + '<th class="st-name">Player</th><th>Pos</th><th>Class</th><th class="num">OVR</th><th class="num">POT</th>'
    + '<th class="num">MIN</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th>'
    + '<th>Status</th><th class="num">NIL ask</th><th></th></tr></thead><tbody>';
  asks.forEach(function(a, i) {
    var p = findPlayer(a.name);
    var mins = p ? (p.mins || 0) : 0;
    var cant = a.decision !== 'keep' && nilAvail < a.ask;
    var status = a.decision === 'keep' ? '<span class="ret-done">Staying</span>'
      : a.decision === 'go' ? '<span class="ret-done go">Entering the portal</span>'
      : a.why;
    var actions = a.decision === 'keep' || a.decision === 'go'
      ? '<button class="btn-quiet btn-sm ret-change" data-ret="undo" data-ri="' + i + '">Change</button>'
      : '<button class="ret-btn" data-ret="keep" data-ri="' + i + '"' + (cant ? ' disabled title="Not enough NIL"' : '') + '>Keep</button>'
        + '<button class="ret-btn" data-ret="go" data-ri="' + i + '">Let go</button>';
    h += '<tr class="ret-row' + (a.decision === 'keep' ? ' kept' : a.decision === 'go' ? ' gone' : '') + '">'
      + '<td class="st-name">' + pLink(a.name, G.tid) + '</td>'
      + '<td>' + a.pos + '</td><td>' + a.cls + '</td>'
      + '<td class="num"><b>' + a.ovr + '</b></td><td class="num">' + (a.pot || a.ovr) + '</td>'
      + '<td class="num">' + mins + '</td>'
<<<<<<< Updated upstream
      + '<td class="num">' + fmt1(a.ppg) + '</td>'
      + '<td class="num">' + fmt1(a.rpg) + '</td>'
      + '<td class="num">' + fmt1(a.apg) + '</td>'
=======
      + '<td class="num">' + f1(a.ppg) + '</td>'
      + '<td class="num">' + f1(a.rpg) + '</td>'
      + '<td class="num">' + f1(a.apg) + '</td>'
>>>>>>> Stashed changes
      + '<td class="dep-status">' + status + '</td>'
      + '<td class="num"><b>' + a.ask + '</b></td>'
      + '<td class="dep-actions">' + actions + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}

// NIL asks as decision cards (under 700px)
function nilCards(asks, nilAvail, total) {
  var h = '<div class="nil-cards">';
  asks.forEach(function(a, i) {
    var cant = a.decision !== 'keep' && nilAvail < a.ask;
    if (a.decision === 'keep' || a.decision === 'go') {
      // Collapsed after decision
      var label = a.decision === 'keep' ? 'Staying' : 'Entering the portal';
      h += '<div class="nil-card decided"><span class="nil-done">' + a.name + ' — ' + label + ' (' + a.ask + ' NIL)</span>'
        + '<button class="btn-quiet btn-sm ret-change" data-ret="undo" data-ri="' + i + '">Change</button></div>';
    } else {
      var pct = total > 0 ? Math.round(a.ask / total * 100) : 0;
      h += '<div class="nil-card">'
        + '<div class="nil-head"><div>'
        + '<div class="nil-name">' + pLink(a.name, G.tid) + '</div>'
<<<<<<< Updated upstream
        + '<div class="nil-sub">' + a.pos + ' · ' + a.ovr + ' OVR' + (a.ppg != null ? ' · ' + a.ppg.toFixed(1) + ' PPG' : '') + '</div>'
=======
        + '<div class="nil-sub">' + a.pos + ' · ' + a.ovr + ' OVR · ' + f1(a.ppg) + ' PPG</div>'
>>>>>>> Stashed changes
        + '<div class="nil-why">' + a.why + '</div>'
        + '</div><div class="nil-ask"><b>' + a.ask + '</b><span>NIL</span></div></div>'
        + '<div class="nil-budget"><div class="nil-fill" style="width:' + Math.min(100, pct) + '%;"></div></div>'
        + '<div class="nil-actions">'
        + '<button class="btn-big" data-ret="keep" data-ri="' + i + '"' + (cant ? ' disabled title="Not enough NIL"' : '') + '>Keep</button>'
        + '<button class="btn-big secondary" data-ret="go" data-ri="' + i + '">Let go</button>'
        + '</div></div>';
    }
  });
  return h + '</div>';
}

// Departing players as table rows (for the 700px+ table)
function depTableRows(list, isDep, isNotBack) {
  var h = '';
  list.forEach(function(d) {
    if (isDep) {
      var reason = d.reason === 'Graduated' ? 'Graduated'
        : d.reason === 'Drafted' ? 'Drafted' + (d.pick ? ', pick ' + d.pick : '')
        : 'Declared for the draft';
      h += '<tr class="dep-gone">'
        + '<td class="st-name">' + d.name + '</td>'
        + '<td>' + d.pos + '</td><td>' + d.cls + '</td>'
        + '<td class="num"><b>' + d.ovr + '</b></td><td class="num">–</td><td class="num">–</td>'
        + '<td class="num">' + d.ppg + '</td><td class="num">' + d.rpg + '</td><td class="num">' + d.apg + '</td>'
        + '<td class="dep-status"><span class="dep-reason">' + reason + '</span></td>'
        + '<td class="num">–</td><td class="dep-actions"></td></tr>';
    } else if (isNotBack) {
      var sl = seasonLine(d);
      var why = (d.notReturningWhy || 'Wants a fresh start');
      why = why.charAt(0).toUpperCase() + why.slice(1);
      // No season line = didn't play (redshirt/deep bench); show reason only, no fake stats
      var pts = sl ? f1(sl.ppg) : '';
      var reb = sl ? f1(sl.rpg) : '';
      var ast = sl ? f1(sl.apg) : '';
      h += '<tr class="dep-gone">'
        + '<td class="st-name">' + pLink(d.name, G.tid) + '</td>'
        + '<td>' + d.pos + '</td><td>' + d.cls + '</td>'
        + '<td class="num"><b>' + d.ovr + '</b></td><td class="num">' + (d.pot || d.ovr) + '</td><td class="num">' + (d.mins || 0) + '</td>'
        + '<td class="num">' + pts + '</td>'
        + '<td class="num">' + reb + '</td>'
        + '<td class="num">' + ast + '</td>'
        + '<td class="dep-status"><span class="dep-reason">' + why + '</span></td>'
        + '<td class="num">–</td><td class="dep-actions"></td></tr>';
    }
  });
  return h;
}

// Departing players as a quiet list (under 700px): "Name · Reason · stats"
function depList(dep, notBack) {
  var h = '<div class="dep-list">';
  dep.forEach(function(d) {
    var reason = d.reason === 'Graduated' ? 'Graduated'
      : d.reason === 'Drafted' ? 'Drafted' + (d.pick ? ' (pick ' + d.pick + ')' : '')
      : 'Declared for the draft';
    var stats = (d.ppg !== undefined) ? ' · ' + d.ppg + ' pts, ' + d.rpg + ' reb, ' + d.apg + ' ast' : '';
    h += '<div class="dep-item"><span class="dep-name">' + d.name + '</span><span class="dep-why">' + reason + stats + '</span></div>';
  });
  notBack.forEach(function(p) {
    var sl = seasonLine(p);
    var why = (p.notReturningWhy || 'Wants a fresh start');
    why = why.charAt(0).toUpperCase() + why.slice(1);
    var stats = sl ? ' · ' + f1(sl.ppg) + ' pts, ' + f1(sl.rpg) + ' reb, ' + f1(sl.apg) + ' ast' : '';
    h += '<div class="dep-item"><span class="dep-name">' + pLink(p.name, G.tid) + '</span><span class="dep-why">' + why + stats + '</span></div>';
  });
  return h + '</div>';
}
