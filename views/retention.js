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
import { noteSpend } from '../finance.js';

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

// Build this offseason's asks from the user's returning players.
// The best two returners always ask; a third from the top six asks when
// unhappy or by chance, and a fourth only when he is clearly unhappy.
export function buildRetentionAsks() {
  var t = G.teams[G.tid];
  var pool = (t.rost || []).filter(function(p) { return p.cls !== 'SR' && !p.rs; })
    .sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 6);
  var asks = [];
  pool.forEach(function(p, i) {
    var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
    var asksNow = i < 2 || (asks.length < 3 && (m < 40 || Math.random() < 0.2)) || (asks.length < 4 && m < 30);
    if (!asksNow || asks.length >= 4) return;
    var ppg = lastPpg(p);
    asks.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, pot: p.pot || p.ovr,
      ppg: ppg === null ? null : Math.round(ppg * 10) / 10,
      ask: retentionAsk(p), why: whyAsk(p, i), decision: null });
  });
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
  var r = G.retention || { asks: [] };
  var pending = retentionPending();
  var total = r.asks.reduce(function(s, a) { return s + a.ask; }, 0);
  var kept = r.asks.filter(function(a) { return a.decision === 'keep'; }).reduce(function(s, a) { return s + a.ask; }, 0);
  var t = G.teams[G.tid];

  var h = '<div class="sec-head">Player retention</div>'
    + '<div class="sec-sub" style="margin-bottom:12px;">Before the transfer portal opens, your top players want NIL deals to stay. '
    + 'Pay to keep them, or let them enter the portal. A player you let go stays if no school signs him.</div>';

  h += '<div class="stat-strip" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px;">'
    + '<div class="stat-cell"><div class="sv">' + (G.pts || 0) + '</div><div class="sl">NIL available</div></div>'
    + '<div class="stat-cell"><div class="sv">' + total + '</div><div class="sl">Total asks</div></div>'
    + '<div class="stat-cell"><div class="sv">' + kept + '</div><div class="sl">Committed</div></div></div>';

  h += '<div class="panel"><div class="panel-h"><span>NIL requests</span><small>' + (pending ? pending + ' to decide' : 'All decided') + '</small></div>'
    + '<div class="panel-b flush"><div class="tbl-wrap"><table class="ret"><thead><tr>'
    + '<th>Player</th><th class="num">OVR</th><th class="num">POT</th><th class="num hide-sm">PPG</th><th class="num">Ask</th><th>Decision</th>'
    + '</tr></thead><tbody>';
  r.asks.forEach(function(a, i) {
    var cant = a.decision !== 'keep' && (G.pts || 0) < a.ask;
    h += '<tr' + (a.decision === 'keep' ? ' class="hl"' : '') + '>'
      + '<td>' + pLink(a.name, G.tid) + ' <span style="color:var(--txt3);">' + a.pos + ' · ' + a.cls + '</span>'
      + '<div style="font-size:12px;color:var(--txt2);">' + a.why + '</div></td>'
      + '<td class="num"><b>' + a.ovr + '</b></td><td class="num">' + a.pot + '</td>'
      + '<td class="num hide-sm">' + (a.ppg === null ? '—' : a.ppg.toFixed(1)) + '</td>'
      + '<td class="num">' + a.ask + '</td>'
      + '<td><div class="ret-btns">'
      + '<button class="ret-btn' + (a.decision === 'keep' ? ' on' : '') + '" data-ret="keep" data-ri="' + i + '"' + (cant ? ' disabled title="Not enough NIL"' : '') + '>Keep</button>'
      + '<button class="ret-btn' + (a.decision === 'go' ? ' on go' : '') + '" data-ret="go" data-ri="' + i + '">Let go</button>'
      + '</div></td></tr>';
  });
  h += '</tbody></table></div></div></div>';

  h += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">'
    + '<button class="btn btn-big" data-ret-done="1"' + (pending ? ' disabled' : '') + '>'
    + (pending ? 'Decide on every request' : 'Open the transfer portal') + '</button></div>';
  h += '<div style="font-size:12px;color:var(--txt3);margin-top:8px;">Asks scale with rating and production. Happier players ask for less. '
    + t.name + ' keeps its NIL for the portal and facilities if you let players go.</div>';
  return h;
}
