// ═══════════════════════════════════════════════════════════
//  HOOPS OS — finance.js
//  Program money (NIL budget). Every unit has a visible cause:
//    Ticket sales      — each home game (form, prestige, arena)
//    Donor collective  — each offseason (prestige, last season's finish)
//    Conference TV     — once a season, week 1 (conference strength)
//    Tournament runs   — each NCAA tournament win, more per round
//    AD bonuses        — season goals met (goals.js)
//  Spending: transfer portal offers, facilities, boosts.
//  G.pts stays the single budget number; this module keeps the
//  season ledger that explains it. Design: research/nil-money-design.md
// ═══════════════════════════════════════════════════════════

import { G } from './state.js';

export var STREAMS = [
  ['gate', 'Ticket sales'],
  ['donors', 'Donor collective'],
  ['tv', 'Conference TV share'],
  ['tourney', 'Tournament payouts'],
  ['ad', 'Athletic director bonuses']
];
export var BUCKETS = [
  ['retention', 'Player retention'],
  ['portal', 'Transfer portal offers'],
  ['facilities', 'Facilities'],
  ['boosts', 'Boosts']
];

// Per-round NCAA payouts (a win in that round): R64, R32, S16, E8, F4, title
export var TOURNEY_PAY = [20, 30, 45, 65, 90, 130];
var GATE_BASE = 12;

function emptyLedger(yr) {
  var inc = {}, sp = {};
  STREAMS.forEach(function(s) { inc[s[0]] = 0; });
  BUCKETS.forEach(function(b) { sp[b[0]] = 0; });
  return { yr: yr, income: inc, spend: sp, homeGames: 0, notes: {} };
}

// The ledger for the current season (rolls over automatically)
export function ledger() {
  if (!G.finance || typeof G.finance !== 'object') G.finance = { cur: null, last: null };
  var f = G.finance;
  if (!f.cur) f.cur = emptyLedger(G.yr);
  if (f.cur.yr !== G.yr) { f.last = f.cur; f.cur = emptyLedger(G.yr); }
  return f.cur;
}

export function earn(stream, amount, note) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return 0;
  var l = ledger();
  l.income[stream] = (l.income[stream] || 0) + amount;
  if (note) l.notes[stream] = note;
  G.pts = (G.pts || 0) + amount;
  return amount;
}

// Record a spend (or a refund, as a negative amount). Callers move G.pts.
export function noteSpend(bucket, amount) {
  var l = ledger();
  l.spend[bucket] = (l.spend[bucket] || 0) + Math.round(amount || 0);
}

export function totals(l) {
  l = l || ledger();
  var inc = 0, sp = 0;
  Object.keys(l.income).forEach(function(k) { inc += l.income[k]; });
  Object.keys(l.spend).forEach(function(k) { sp += l.spend[k]; });
  return { income: inc, spend: sp, net: inc - sp };
}

// NIL tied up right now: open transfer portal offers
export function committed() {
  return (G.portalEntrants || []).reduce(function(s, e) { return s + (e.pickedBy === -1 ? (e.offer || 0) : 0); }, 0);
}

// ── Streams ─────────────────────────────────────────────

// Recent form: share of the last five results won (0.7 cold … 1.3 hot)
function formMult() {
  var t = G.teams[G.tid], played = (t.sched || []).filter(function(s) { return s && s.played; }).slice(-5);
  if (!played.length) return 1;
  var w = played.filter(function(s) { return s.uScore > s.oScore; }).length / played.length;
  return 0.7 + w * 0.6;
}

// After each user home game. arenaLevel comes from facilities (0-5).
export function payGate(arenaLevel) {
  var t = G.teams[G.tid];
  var sp = t.schoolPrestige || 50;
  var amt = GATE_BASE * (0.6 + sp / 100) * formMult() * (1 + 0.12 * (arenaLevel || 0));
  var l = ledger(); l.homeGames++;
  return earn('gate', amt, l.homeGames + ' home game' + (l.homeGames > 1 ? 's' : '') + ' so far');
}

// Conference strength → TV share, paid once in week 1
export function payTvShare() {
  var l = ledger();
  if (l.tvPaid) return 0;
  l.tvPaid = true;
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  var avg = conf.reduce(function(s, x) { return s + (x.schoolPrestige || 50); }, 0) / Math.max(1, conf.length);
  // Power conferences carry the big media deals; everyone else scales with
  // how strong their league is
  var POWER = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var amt = POWER.indexOf(t.conf) >= 0 ? 120 : Math.max(40, Math.min(90, 40 + (avg - 40) * 1.5));
  return earn('tv', amt, t.conf + ' share');
}

// Donor check, each offseason, from prestige and how the season went
export function payDonors() {
  var l = ledger();
  if (l.donorsPaid) return 0;
  l.donorsPaid = true;
  var t = G.teams[G.tid];
  var sp = t.schoolPrestige || 50;
  var sa = G.seasonAchievements || {};
  var mult = sa.natChamp ? 1.6 : sa.finalFour ? 1.4 : sa.sweet16 ? 1.25 : sa.madeNCAA ? 1.1 : 0.9;
  var amt = Math.max(60, Math.min(240, (40 + sp * 1.2) * mult));
  var why = sa.natChamp ? 'national title run' : sa.finalFour ? 'Final Four run' : sa.sweet16 ? 'Sweet 16 run' : sa.madeNCAA ? 'NCAA appearance' : 'no NCAA bid';
  return earn('donors', amt, 'Last check: ' + Math.round(amt) + ' (' + why + ')');
}

// One NCAA tournament win; round index 0 = round of 64 … 5 = title game
export function payTourneyWin(roundIdx) {
  var amt = TOURNEY_PAY[Math.max(0, Math.min(5, roundIdx))];
  return earn('tourney', amt, 'NCAA wins pay more each round');
}
