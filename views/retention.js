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
  var cap = Math.round(totals().income * 0.75);
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
  var pending = retentionPending();
  var total = r.asks.reduce(function(s, a) { return s + a.ask; }, 0);
  var kept = r.asks.filter(function(a) { return a.decision === 'keep'; }).reduce(function(s, a) { return s + a.ask; }, 0);
  var t = G.teams[G.tid];
  var dep = G.departingPlayers || [];
  var notBack = (t.rost || []).filter(function(p) { return p.notReturningYr === G.yr; });
  var returning = (t.rost || []).length - notBack.length;
  var pc = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  (t.rost || []).forEach(function(p) { if (pc.hasOwnProperty(p.pos)) pc[p.pos]++; });
  var needs = Object.keys(pc).filter(function(k) { return pc[k] < 2; });

  var h = '<div class="dep-wrap"><div class="acq-head"><div class="acq-title">Departures</div>'
    + '<div class="acq-line"><span>Who is leaving, and who wants an NIL deal to stay</span></div></div>';
  h += '<div class="dep-sum"><div class="dep-stat"><b>' + (dep.length + notBack.length) + '</b><span>leaving</span></div>'
    + '<div class="dep-stat"><b>' + returning + '</b><span>returning</span></div>'
    + '<div class="dep-stat"><b>' + Math.max(0, 15 - returning) + '</b><span>open spots</span></div>'
    + (needs.length ? '<div class="dep-stat dep-thin"><span>Thin at</span><b>' + needs.join(', ') + '</b></div>' : '') + '</div>';

  // Leaving
  h += '<div class="dep-sec">Leaving</div><div class="acq-list">';
  if (!dep.length && !notBack.length) h += '<div class="sg-none dep-empty">Nobody is leaving this year.</div>';
  dep.forEach(function(d) {
    h += '<div class="acq-row dep-row"><div class="acq-main"><div class="acq-name">' + d.name + ' <span class="acq-cls">' + d.pos + ' · ' + d.cls + '</span></div>'
      + '<div class="acq-sub">' + d.ppg + ' ppg · ' + d.rpg + ' rpg · ' + (d.apg || '0.0') + ' apg</div></div>'
      + '<div class="acq-right"><div class="acq-big">' + d.ovr + '</div><div class="acq-small">' + (d.reason === 'Graduated' ? 'Graduated' : d.reason === 'Drafted' ? 'Drafted' + (d.pick ? ', pick ' + d.pick : '') : 'Declared for the draft') + '</div></div></div>';
  });
  notBack.forEach(function(p) {
    var sl = seasonLine(p);
    h += '<div class="acq-row dep-row"><div class="acq-main"><div class="acq-name">' + pLink(p.name, G.tid) + ' <span class="acq-cls">' + p.pos + ' · ' + p.cls + '</span></div>'
      + '<div class="acq-sub">' + (sl ? sl.ppg.toFixed(1) + ' ppg · ' + sl.rpg.toFixed(1) + ' rpg · ' + sl.apg.toFixed(1) + ' apg · ' : '') + (p.notReturningWhy || 'Wants a fresh start').toLowerCase().replace(/^./, function(c) { return c.toUpperCase(); }) + '</div></div>'
      + '<div class="acq-right"><div class="acq-big">' + p.ovr + '</div><div class="acq-small">Not interested in returning</div></div></div>';
  });
  h += '</div>';

  // NIL requests
  h += '<div class="dep-sec">NIL requests</div>';
  if (!r.asks.length) {
    h += '<div class="sg-none dep-empty">No one asked for an NIL deal this year.</div>';
  } else {
    h += '<div class="dep-note">Pay to keep a player, or let him enter the transfer portal (he stays if no school signs him). '
      + '<b>' + (G.pts || 0) + '</b> NIL available · asks total ' + total + (kept ? ' · committed ' + kept : '') + '</div><div class="acq-list">';
    r.asks.forEach(function(a, i) {
      var cant = a.decision !== 'keep' && (G.pts || 0) < a.ask;
      h += '<div class="ret-row' + (a.decision === 'keep' ? ' kept' : a.decision === 'go' ? ' gone' : '') + '">'
        + '<div class="acq-main"><div class="acq-name">' + pLink(a.name, G.tid) + ' <span class="acq-cls">' + a.pos + ' · ' + a.cls + ' · ' + a.ovr + '</span></div>'
        + '<div class="acq-sub">' + a.why + (a.ppg !== null ? ' · ' + a.ppg.toFixed(1) + ' ppg' : '') + (a.rpg !== null && a.rpg !== undefined ? ' · ' + a.rpg.toFixed(1) + ' rpg · ' + a.apg.toFixed(1) + ' apg' : '') + '</div></div>'
        + '<div class="ret-side"><div class="ret-ask">' + a.ask + ' <span>NIL</span></div><div class="ret-btns">'
        + '<button class="ret-btn' + (a.decision === 'keep' ? ' on' : '') + '" data-ret="keep" data-ri="' + i + '"' + (cant ? ' disabled title="Not enough NIL"' : '') + '>Keep</button>'
        + '<button class="ret-btn' + (a.decision === 'go' ? ' on go' : '') + '" data-ret="go" data-ri="' + i + '">Let go</button>'
        + '</div></div></div>';
    });
    h += '</div>';
  }

  h += '<div class="acq-sticky"><button class="btn-big btn-full" data-ret-done="1">Open the transfer portal</button></div></div>';
  return h;
}
