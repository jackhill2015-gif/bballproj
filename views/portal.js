// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/portal.js
//  Transfer portal: LOGIC (DOM-free, operates only on G) and
//  the player page (sheet). The list lives on the Build your
//  roster screen (views/build.js). Whoever enters the portal
//  leaves: signed by a school or gone to a lower level.
// ═══════════════════════════════════════════════════════════

import { oldOvr } from '../utils.js';
import { noteSpend } from '../finance.js';
import { G, saveState } from '../state.js';
import { ri, freshS, clamp, fixMins } from '../utils.js';
import { CLS, TEAM_STATES, STATE_TO_REGION, RECRUIT_STATE_POOL } from '../constants.js';
import { portalEntryChance, moralePortalReason, MORALE_DEFAULT } from '../morale.js';
import * as Battle from './battle.js';
import { playerType, typeTagsHTML, ratingBarsHTML, fitListHTML } from './scouting.js';
import { beginReport, noteSigning, openSpots, pursuitsOut } from './signings.js';
import * as Acq from './acq.js';

// Clickable player name (opens the profile; convention in views/player.js)
function pLink(name, tid) {
  return '<span class="pname" data-action="player" data-player-name="' + String(name).replace(/"/g, '&quot;') + '" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

// ── Callbacks registered by views/recruiting.js (avoids an import cycle) ──
var _ext = { render: null, toast: null, addLog: null };
export function registerPortalCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function rerender() {
  if (_ext.render) _ext.render();
  // keep the header NIL balance in step with offers
  if (typeof document !== 'undefined' && document.getElementById) {
    var nb = document.getElementById('nil-balance');
    if (nb) nb.textContent = G.pts || 0;
  }
}
function toast(m, c) { if (_ext.toast) _ext.toast(m, c); }
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }

// ═══════════════════════════════════════════════════════════
//  LOGIC — 3-stage battle system (see views/battle.js)
//  Round 1 "Initial offers": place NIL offers (concentrate or spread)
//  Round 2 "Follow-up": odds moved — raise, hold, or withdraw
//  Round 3 "Decision day": final offers, then everyone decides
// ═══════════════════════════════════════════════════════════

export var PORTAL_MAX_ENTRANTS = 160;
export var PORTAL_OFFER_STEP = 10;   // NIL per stepper click

var _nextPid = 1;
var _portalTouchedUser = false;      // user's roster poached this stage

function portalReason(p) {
  return moralePortalReason(p);
}

// ── Geo helpers (mirror recruiting.js) ──
function getTeamState(t) { return TEAM_STATES[t.name] || 'XX'; }
function getGeoBonus(ts, rs) { if (!ts || !rs || ts === 'XX') return 0; if (ts === rs) return 0.20; var tr = STATE_TO_REGION[ts], rr = STATE_TO_REGION[rs]; if (tr && tr === rr) return 0.10; return 0; }

// ── Portal economy ──
// NIL offer steppers move in PORTAL_OFFER_STEP chunks. portalCost is the
// "standard" reference offer for an entrant (shown on the row); any offer
// above 0 puts you in the race, and bigger offers bid harder.
// CPU suitors heat up as stages advance — your % decays unless you
// invest more in the follow-up round.
export function portalCost(e) {
  return 20 + Math.round(Math.max(0, oldOvr(e.ovr) - 65) * 5);
}

// Transfers are the surer, pricier path to ready players: CPU suitors back
// their offers with real money (PORTAL_MARKET; every suitor alike, so
// CPU-vs-CPU outcomes don't change) and chase elite transfers harder.
// Measured in test-harness/roster-odds.mjs.
export var PORTAL_MARKET = 1.2;

function portalEsc() {
  return [1.0, 1.2, 1.45][Math.max(0, Math.min(2, G.portalStage || 0))];
}

// Prestige gate by entrant quality (mirrors SCHOOL_RECRUIT_GATES philosophy):
// a 60-prestige school can dream about an 85 OVR transfer, but the math
// punishes it hard.
function portalGate(ovr) {
  ovr = oldOvr(ovr); // pre-v11 scale thresholds
  if (ovr >= 84) return 80;
  if (ovr >= 78) return 60;
  if (ovr >= 72) return 40;
  return 0;
}

// Assign persistent suitors to an entrant. Better entrants attract better
// programs — top-25 schools chase the 84+ guys, everyone fights over the rest.
function assignSuitors(e, maxN) {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var _o = oldOvr(e.ovr);
  var poolSize = _o >= 84 ? 25 : _o >= 79 ? 60 : _o >= 74 ? 120 : ranked.length;
  var pool = ranked.slice(0, poolSize).filter(function(t) { return t.id !== e.fromTid && t.id !== G.tid; });
  for (var j = pool.length - 1; j > 0; j--) { var k = ri(0, j); var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp; }
  e.suitors = pool.slice(0, maxN || ri(3, 6)).map(function(t) { return { tid: t.id, name: t.name }; });
}

// Defensive defaults for entrants from old saves (pre-suitor era).
function ensureEntrant(e) {
  if (!e.homeState) e.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
  if (!e.suitors) assignSuitors(e);
  if (typeof e.offer !== 'number') e.offer = 0;
  return e;
}

// Deterministic suitor bids (seeded by entrant + school, like recruiting's
// rival bids): prestige dominates, geography and entrant quality nudge it.
// Bids escalate by stage — CPU suitors heat up on their targets.
function calcSuitorBids(e) {
  var desir = 1 + Math.max(0, oldOvr(e.ovr) - 70) / 35; // elite transfers get pursued harder
  var esc = portalEsc();
  var out = [];
  (e.suitors || []).forEach(function(s) {
    var team = G.teams[s.tid];
    if (!team) return;
    var sp = team.schoolPrestige || 50;
    var seed = ((e.pid * 7 + s.tid * 13) % 100) / 100;
    var geo = getGeoBonus(getTeamState(team), e.homeState);
    var bid = (seed * 30 + 25) * (0.35 + sp / 55) * desir * (1 + geo) * esc * PORTAL_MARKET;
    out.push({ tid: s.tid, name: s.name, bid: Math.max(1, bid) });
  });
  out.sort(function(a, b) { return b.bid - a.bid; });
  return out;
}

// User's pitch strength: school prestige + NIL offer + playing time at the
// entrant's position + geography + coach recruiting chops, gated by prestige.
// Bigger offers bid harder — dump on a star or spread it around.
export function calcUserPortalBid(e) {
  var t = G.teams[G.tid];
  var sp = (t && t.schoolPrestige) || 50;
  var offer = e.offer || 0;
  var posCount = 0;
  (t.rost || []).forEach(function(p) { if (p.pos === e.pos) posCount++; });
  var ptBonus = posCount < 2 ? 30 : posCount === 2 ? 12 : posCount === 3 ? 0 : -18;
  var geo = getGeoBonus(getTeamState(t), e.homeState);
  var coachMod = 0.7 + ((G.coach ? G.coach.rec : 70) / 100) * 0.6;
  var bid = (sp + offer * 0.9 + ptBonus) * coachMod * (1 + geo);
  var gate = portalGate(e.ovr);
  if (sp < gate) {
    var deficit = gate - sp;
    bid *= Math.max(0.12, 1 - deficit / 45);
  }
  return { bid: Math.max(1, bid) };
}

// The best suitor offer he'll weigh on decision day (suitors bid hardest
// then), among schools that still have room for him
function finalBestSuitorBid(e) {
  var st = G.portalStage, best = 0;
  G.portalStage = 2;
  eligiblePortalSuitors(e).forEach(function(s) { best = Math.max(best, s.bid); });
  G.portalStage = st;
  return best;
}

// Your decision-day chance at the current offer, by the same rule as
// recruiting (your offer vs the best rival's; battle.js), so the odds you
// see are the odds you'll face at the end. inRace is false until an offer
// is placed.
export function portalChance(e) {
  ensureEntrant(e);
  var u = calcUserPortalBid(e);
  var suitors = calcSuitorBids(e);
  var p = Battle.chanceVsBest(u.bid, finalBestSuitorBid(e), Battle.PORTAL_ODDS);
  return { pct: clamp(Math.round(p * 100), 1, 99), p: p, bid: u.bid, suitors: suitors, inRace: (e.offer || 0) > 0 };
}

// Decision-day chance with nil offered (measurement and budget fit)
export function portalChanceAt(e, nil) {
  ensureEntrant(e);
  var had = e.offer;
  e.offer = nil;
  var p = nil > 0 ? Battle.chanceVsBest(calcUserPortalBid(e).bid, finalBestSuitorBid(e), Battle.PORTAL_ODDS) : 0;
  e.offer = had;
  return p;
}

// NIL to offer for an even (50%) decision-day chance, in whole offer steps.
// Infinity when no offer gets there (prestige gates).
export function nilFor50(e) {
  ensureEntrant(e);
  var had = e.offer;
  e.offer = 0; var b0 = calcUserPortalBid(e).bid;
  e.offer = 100; var b1 = calcUserPortalBid(e).bid;
  e.offer = had;
  var target = Battle.PORTAL_ODDS.even * finalBestSuitorBid(e), per = (b1 - b0) / 100;
  if (b0 >= target) return PORTAL_OFFER_STEP;
  if (!(per > 0)) return Infinity;
  return Math.max(PORTAL_OFFER_STEP, Math.ceil((target - b0) / per / PORTAL_OFFER_STEP) * PORTAL_OFFER_STEP);
}

// Weighted draw over [{key, bid}] entries.
function weightedWinner(entries) {
  var total = 0, i;
  for (i = 0; i < entries.length; i++) total += entries[i].bid;
  var roll = Math.random() * total, acc = 0;
  for (i = 0; i < entries.length; i++) { acc += entries[i].bid; if (roll <= acc) return entries[i]; }
  return entries[entries.length - 1];
}

// Build the portal class from low-minute / unhappy returners across every
// team. Entrants STAY on their rosters until picked (flagged with _portalPid),
// so a save/reload mid-portal loses nothing.
// Who enters the portal, modeled on why real players transfer:
//  - Playing time: stuck deep on the bench (most entrants)
//  - Bigger role: good enough to start elsewhere but buried on the depth chart
//  - Moving up: a standout at a weak or low-profile program chases a bigger stage
//  - Coaching change: a new coach shakes the roster loose
//  - Lost faith: low morale makes any of these likelier
// Starters at healthy programs rarely leave. If the class is over the cap,
// it's trimmed at random so the mix stays realistic (not top-heavy).
export function entryOdds(p, tm, ctx) {
  if (p.cls === 'SR' || p.rs) return null;
  if (p.keptYr === G.yr) return null; // signed a retention deal this offseason
  var m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
  var mins = p.mins || 0;
  var chance = 0, reason = 'Playing time';
  if (mins < 15 && ctx.depth > 7) chance = 0.16;
  if (mins < 18 && p.ovr >= ctx.fifthBest - 2 && ctx.depth > 5) { chance = Math.max(chance, 0.30); reason = 'Bigger role'; }
  var _po = oldOvr(p.ovr);
  if (ctx.depth <= 3 && ctx.weak && _po >= 80 && (p.cls === 'SO' || p.cls === 'JR')) {
    chance = Math.max(chance, 0.10 + (_po - 80) * 0.012); reason = 'Moving up';
  }
  if (!chance) chance = 0.015; // a contented starter, rarely
  chance *= (1.6 - m / 100);   // morale 20 → x1.4, 50 → x1.1, 80 → x0.8
  // The reason shown is the most specific one that applies
  if (m < 15 && reason === 'Playing time') reason = 'Lost faith in program';
  // A new coach shakes things loose — mostly rotation players who'd have stayed
  if (ctx.coachChange) {
    chance = Math.min(0.6, chance * 1.5 + (mins >= 15 ? 0.06 : 0));
    if (mins >= 15 || reason === 'Playing time') reason = 'Coaching change';
  }
  return { chance: Math.min(0.75, chance), reason: reason };
}

export function genPortalEntrants() {
  G.portalEntrants = [];
  _nextPid = 1;
  var rankOf = {};
  G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).forEach(function(t, i) { rankOf[t.id] = i + 1; });
  G.teams.forEach(function(tm) {
    if (!tm.rost) return;
    var byOvr = tm.rost.slice().sort(function(a, b) { return b.ovr - a.ovr; });
    var fifthBest = byOvr[4] ? byOvr[4].ovr : 0;
    var ctx0 = {
      fifthBest: fifthBest,
      weak: (tm.schoolPrestige || 50) < 45 || rankOf[tm.id] > 150,
      coachChange: !!(tm.coach && tm.coach.tenure === 0 && tm.id !== G.tid)
    };
    var cands = [], forced = [];
    tm.rost.forEach(function(p) {
      // Let go at retention: always enters
      if (p.forcePortal) { delete p.forcePortal; if (tm.id === G.tid) { forced.push({ p: p, reason: 'NIL deal', forced: true }); return; } }
      // Your players: only the ones decided on the Departures screen enter
      // (let go at retention, or not interested in returning). No surprises.
      if (tm.id === G.tid) {
        if (p.notReturningYr === G.yr) forced.push({ p: p, reason: p.notReturningWhy || 'Fresh start', forced: true });
        return;
      }
      var o = entryOdds(p, tm, Object.assign({ depth: byOvr.indexOf(p) + 1 }, ctx0));
      if (o && Math.random() < o.chance) cands.push({ p: p, reason: o.reason });
    });
    // At most 3 per team (retention let-gos always count, beyond the cap)
    forced.concat(cands).slice(0, Math.max(3, forced.length)).forEach(function(c) {
      var p = c.p;
      var pid = _nextPid++;
      p._portalPid = pid;
      G.portalEntrants.push({
        pid: pid, name: p.name, pos: p.pos, ovr: p.ovr, pot: p.pot || p.ovr, tp: p.tp, h: p.h || [], aw: p.aw || [],
        cls: p.cls, fromTid: tm.id, fromName: tm.name, mins: p.mins || 0,
        sht: p.sht, fin: p.fin, def: p.def, reb: p.reb, ply: p.ply,
        reason: c.reason, pickedBy: -1, offer: 0, forced: !!c.forced
      });
    });
  });
  // Over the cap: trim at random (keeps the talent mix), cut players stay home
  if (G.portalEntrants.length > PORTAL_MAX_ENTRANTS) {
    var list = G.portalEntrants;
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
    // retention let-gos are never trimmed
    list.sort(function(a, b) { return (b.forced ? 1 : 0) - (a.forced ? 1 : 0); });
    var cut = list.slice(PORTAL_MAX_ENTRANTS);
    G.portalEntrants = list.slice(0, PORTAL_MAX_ENTRANTS);
    var cutIds = {};
    cut.forEach(function(e) { cutIds[e.pid] = true; });
    G.teams.forEach(function(tm) {
      (tm.rost || []).forEach(function(p) { if (p._portalPid && cutIds[p._portalPid]) delete p._portalPid; });
    });
  }
  G.portalStage = 0;
  G.portalCpuTakes = {};
  G.portalUserSigns = 0;
  _portalTouchedUser = false;
  // Persistent suitor schools per entrant — the competition for each player.
  // (Entrants stay on their old rosters until claimed, so this is save-safe.)
  G.portalEntrants.forEach(function(e) {
    e.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
    assignSuitors(e);
  });
  return G.portalEntrants;
}

// Entrants sorted best-first (rendering consumes this). Also backfills
// suitor/homeState fields for entrants from pre-suitor saves.
export function portalBoard() {
  var list = (G.portalEntrants || []).slice();
  list.forEach(ensureEntrant);
  return list.sort(function(a, b) { return b.ovr - a.ovr; });
}

function findEntrant(pid) {
  var list = G.portalEntrants || [];
  for (var i = 0; i < list.length; i++) if (list[i].pid === pid) return { e: list[i], i: i };
  return null;
}

// Remove the entrant from their old roster; returns the removed player (or null).
function takeFromOldRoster(e) {
  var ot = G.teams[e.fromTid];
  if (!ot || !ot.rost) return null;
  for (var i = 0; i < ot.rost.length; i++) {
    if (ot.rost[i]._portalPid === e.pid) return ot.rost.splice(i, 1)[0];
  }
  return null;
}

function entrantToPlayer(e) {
  return {
    name: e.name, pos: e.pos, cls: e.cls, mins: 0,
    sht: e.sht, fin: e.fin, def: e.def, reb: e.reb, ply: e.ply,
    ovr: e.ovr, pot: e.pot, tp: e.tp, s: freshS(), transfer: true,
    h: e.h || [], aw: e.aw || []
  };
}

// ── Offer management ──
// NIL offers are escrowed per entrant (deducted from G.pts up front).
// Adding is always free; pulling out after the Open stage sinks 25% —
// pivoting has a cost.
// A new offer needs a free spot: open spots minus everyone you're already
// going after (transfers and recruits share the spots)
function canStartOffer() { return pursuitsOut() < openSpots(); }

export function adjustOffer(pid, delta) {
  var t = G.teams[G.tid];
  var f = findEntrant(pid);
  if (!f || f.e.pickedBy !== -1) return false;
  if (f.e.fromTid === G.tid) { toast("You can't offer your own transfer.", 'var(--gld)'); return false; }
  var e = ensureEntrant(f.e);
  var cur = e.offer || 0;
  var nv = cur + delta;
  if (nv < 0) return false;
  if (delta > 0) {
    if (!t || openSpots() <= 0) { toast('Your roster is full for next season.', 'var(--gld)'); return false; }
    if (cur === 0 && !canStartOffer()) {
      var os = openSpots();
      toast('You have ' + os + ' open spot' + (os !== 1 ? 's' : '') + ' and someone in the running for each. Drop one to offer someone else.', 'var(--gld)');
      return false;
    }
    if ((G.pts || 0) < delta) { toast('Not enough NIL (' + delta + ' needed).', 'var(--gld)'); return false; }
    G.pts -= delta;
    noteSpend('portal', delta);
  } else if (delta < 0) {
    var back = (G.portalStage || 0) >= 1 ? Math.round(-delta * Battle.PIVOT_REFUND) : -delta;
    G.pts += back;
    noteSpend('portal', -back);
    if (back < -delta) toast('Offer reduced. ' + (-delta - back) + ' NIL not refunded.', 'var(--gld)');
  }
  e.offer = nv;
  saveState();
  rerender();
  return true;
}
window.adjustOffer = adjustOffer;

// Pivot: pull out of a lost cause entirely (partial refund after Open stage).
export function pivotOffer(pid) {
  var f = findEntrant(pid);
  if (!f || f.e.pickedBy !== -1) return false;
  var e = ensureEntrant(f.e);
  if ((e.offer || 0) <= 0) return false;
  return adjustOffer(pid, -(e.offer || 0));
}
window.pivotOffer = pivotOffer;

// ── Awards ──
function removeEntrant(e) {
  var list = G.portalEntrants || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].pid === e.pid) { list.splice(i, 1); return; }
  }
}

// Nobody signed him: he leaves for a lower level (off the game's rosters).
// Whoever enters the portal is gone for good, so the open spots you see
// during the offseason are exact.
function releaseUnclaimed(e) {
  if (e.fromTid === G.tid) noteSigning('portal', e, 'left', 'A lower level');
  else if (e._mine && !e._full) noteSigning('portal', e, 'other', 'A lower level');
  var ot = G.teams[e.fromTid];
  if (takeFromOldRoster(e) && ot && ot.rost) fixMins(ot.rost);
  removeEntrant(e);
}

function awardPortalToUser(e, early) {
  var t = G.teams[G.tid];
  if (!t || openSpots() <= 0) {
    // Roster filled mid-battle — refund the escrowed offer instead.
    if (!e._full) { e._full = true; noteSigning('portal', e, 'full'); }
    var _off = e.offer || 0; G.pts += _off; noteSpend('portal', -_off); e.offer = 0; return false;
  }
  e.pickedBy = G.tid;
  takeFromOldRoster(e);
  var np = entrantToPlayer(e);
  np.portalYr = G.yr;
  t.rost.push(np);
  e.offer = 0;
  G.portalUserSigns = (G.portalUserSigns || 0) + 1;
  noteSigning('portal', e, 'you', null, early);
  removeEntrant(e);
  addLog('ev', G.gi, '<b>' + np.name + '</b> (' + np.pos + ', ' + np.ovr + ' OVR) transfers in from ' + e.fromName + (early ? ' <b>(early)</b>' : '') + '.');
  toast(np.name + ' commits from the portal' + (early ? ' early!' : '!'), 'var(--grn)');
  return true;
}

function awardPortalToTeam(e, tid) {
  var wt = G.teams[tid];
  if (!wt) return false;
  if (e.fromTid === G.tid) noteSigning('portal', e, 'left', wt.name);
  else if (!e._full && (e._mine || (e.offer || 0) > 0)) noteSigning('portal', e, 'other', wt.name);
  // Lost him to another school: any NIL you had offered comes back in full
  if ((e.offer || 0) > 0) {
    var _back = e.offer; e.offer = 0;
    G.pts = (G.pts || 0) + _back; noteSpend('portal', -_back);
    toast(e.name + ' signed with ' + wt.name + '. Your ' + _back + ' NIL offer was refunded.');
  }
  e.pickedBy = tid;
  G.portalCpuTakes = G.portalCpuTakes || {};
  G.portalCpuTakes[tid] = (G.portalCpuTakes[tid] || 0) + 1;
  var taken = takeFromOldRoster(e);
  if (taken && e.fromTid === G.tid) _portalTouchedUser = true;
  var np = entrantToPlayer(e);
  np.portalYr = G.yr;
  wt.rost.push(np);
  removeEntrant(e);
  return true;
}

// CPU suitors with room and need. Teams only take transfers they actually
// have room for next season (under 15, fewer than 3 portal takes, and either
// a thin roster or a positional need / elite talent). Room counts next
// season's roster: seniors and portal entrants are leaving.
function nextSeasonPlayers(t) {
  return (t.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs) && !p._portalPid && p._draftYr !== G.yr; });
}
function eligiblePortalSuitors(e) {
  return calcSuitorBids(e).filter(function(s) {
    var wt = G.teams[s.tid];
    if (!wt || wt.id === G.tid) return false;
    var nxt = nextSeasonPlayers(wt);
    if (nxt.length >= 15) return false;
    if (((G.portalCpuTakes || {})[wt.id] || 0) >= 3) return false;
    if (nxt.length < 13) return true;
    var pc = 0;
    nxt.forEach(function(p) { if (p.pos === e.pos) pc++; });
    return pc < 2 || oldOvr(e.ovr) >= 82;
  });
}

function drawPortalWinner(e) {
  var entries = eligiblePortalSuitors(e).map(function(s) { return { key: s.tid, bid: s.bid, name: s.name }; });
  return entries.length ? weightedWinner(entries) : null;
}

// ── Early-decision round (stages 1→2 and 2→3) ──
function portalEarlyRound(decideFrac) {
  return Battle.runEarlyRound({
    targets: portalBoard(),
    isOpen: function(e) { return e.pickedBy === -1; },
    decideFrac: decideFrac,
    invested: function(e) { return (e.offer || 0) > 0; },
    userLead: function(e) {
      var ch = portalChance(e), tot = 0, best = 0, i;
      for (i = 0; i < ch.suitors.length; i++) { tot += ch.suitors[i].bid; best = Math.max(best, ch.suitors[i].bid); }
      return ch.pct - (tot > 0 ? (100 - ch.pct) * best / tot : 0);
    },
    contention: function(e) { return (e.offer || 0) + e.ovr; },
    cpuLead: function(e) {
      var bids = calcSuitorBids(e), tot = 0, i;
      for (i = 0; i < bids.length; i++) tot += bids[i].bid;
      if (tot <= 0) return 0;
      if (bids.length < 2) return 100;
      return (bids[0].bid - bids[1].bid) / tot * 100;
    },
    userSign: function(e) { awardPortalToUser(e, true); },
    cpuSign: function(e) {
      var w = drawPortalWinner(e);
      if (w && w.key !== 'user') {
        awardPortalToTeam(e, w.key);
        addLog('ev', G.gi, '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ' OVR) signed early with <b>' + w.name + '</b>.');
      }
    }
  });
}

// ── Late entries: if the user's board is thin on Signing Day, 1-2
// overlooked bench players enter the portal late ──
function maybeLatePortalEntries() {
  var signs = G.portalUserSigns || 0;
  var openOffers = (G.portalEntrants || []).filter(function(e) { return e.pickedBy === -1 && (e.offer || 0) > 0; }).length;
  if (!Battle.boardIsThin(signs, openOffers)) return;
  var maxPid = 0;
  (G.portalEntrants || []).forEach(function(e) { if (e.pid > maxPid) maxPid = e.pid; });
  _nextPid = Math.max(_nextPid, maxPid + 1);
  var cands = [];
  G.teams.forEach(function(tm) {
    (tm.rost || []).forEach(function(p) {
      if (p.cls === 'SR' || p._portalPid) return;
      if ((p.mins || 0) > 8) return;
      if (oldOvr(p.ovr) < 64 || oldOvr(p.ovr) > 80) return;
      cands.push({ tm: tm, p: p });
    });
  });
  cands.sort(function(a, b) { return b.p.ovr - a.p.ovr; });
  var added = 0;
  for (var i = 0; i < cands.length && added < 2; i++) {
    var c = cands[i], dup = false, k;
    for (k = 0; k < (G.portalEntrants || []).length; k++) {
      var x = G.portalEntrants[k];
      if (x.name === c.p.name && x.fromTid === c.tm.id) { dup = true; break; }
    }
    if (dup) continue;
    var pid = _nextPid++;
    c.p._portalPid = pid;
    var e = {
      pid: pid, name: c.p.name, pos: c.p.pos, ovr: c.p.ovr, pot: c.p.pot || c.p.ovr,
      cls: c.p.cls, fromTid: c.tm.id, fromName: c.tm.name, mins: c.p.mins || 0,
      sht: c.p.sht, fin: c.p.fin, def: c.p.def, reb: c.p.reb, ply: c.p.ply,
      reason: 'Late entry', pickedBy: -1, offer: 0, late: true,
      homeState: RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)]
    };
    assignSuitors(e, 3); // small, overlooked pool
    G.portalEntrants.push(e);
    added++;
  }
  if (added) {
    addLog('ev', G.gi, '<b>' + added + ' late entr' + (added > 1 ? 'ies hit' : 'y hits') + ' the portal</b> — overlooked players looking for a home.');
    toast('Late portal entries: ' + added + ' new transfer' + (added > 1 ? 's' : '') + ' available.', 'var(--blu)');
  }
}

// ── Stage advancement ──
// One round of early decisions (Initial offers → Follow-up → Decision day).
// report: start a fresh "Round results" report (the Build your roster
// screen starts one report for the portal and recruiting together).
// Returns { userSigned, cpuSigned, stayed }.
export function portalRound(report) {
  var stage = G.portalStage || 0;
  // Snapshot trends BEFORE CPU escalation so Vibe Check shows movement.
  portalBoard().forEach(function(e) {
    if (e.pickedBy === -1) e._prevPct = portalChance(e).pct;
  });
  _portalTouchedUser = false;
  G.portalStage = stage + 1;
  if (report) beginReport('portal', 'Transfer portal, ' + Battle.ACQ_STAGES[stage].name.toLowerCase());
  var res = portalEarlyRound(Battle.ACQ_STAGES[stage].decideFrac);
  // Late entries surface after the round, so you see them on decision day
  if (G.portalStage === 2) maybeLatePortalEntries();
  if (_portalTouchedUser) { var t = G.teams[G.tid]; if (t) fixMins(t.rost); }
  return res;
}
export function advancePortalStage() {
  var stage = G.portalStage || 0;
  if (stage >= 2) { finalizePortal(); return; }
  var res = portalRound(true);
  var parts = [];
  if (res.userSigned.length) parts.push(res.userSigned.length + ' commit' + (res.userSigned.length > 1 ? 's' : '') + ' early');
  if (res.cpuSigned.length) parts.push(res.cpuSigned.length + ' signed elsewhere');
  parts.push(portalBoard().filter(function(e) { return e.pickedBy === -1; }).length + ' still available');
  toast(Battle.ACQ_STAGES[G.portalStage].name + ': ' + parts.join(' · '), res.userSigned.length ? 'var(--grn)' : 'var(--gld)');
  // Anything involving you this round shows up on Targets (green / red)
  saveState(); rerender();
}
window.advancePortalStage = advancePortalStage;

// ── Decision day: every remaining entrant decides ──
// Whoever nobody signs leaves for a lower level. Returns { won, lost }.
export function portalDecide(report) {
  _portalTouchedUser = false;
  if (report) beginReport('portal', 'Transfer portal, decision day');
  var list = portalBoard().filter(function(e) { return e.pickedBy === -1; });
  list.sort(function(a, b) { return b.ovr - a.ovr; });
  var won = 0, lost = 0;
  list.forEach(function(e) {
    if ((e.offer || 0) > 0) {
      var w = Math.random() < portalChance(e).p ? { key: 'user' } : drawPortalWinner(e);
      if (w && w.key === 'user') { if (awardPortalToUser(e, false)) won++; }
      else {
        e._mine = true; // you pursued him (for the round report)
        var off = e.offer || 0; e.offer = 0;
        G.pts += off; // refund on loss — matches recruiting point refunds
        noteSpend('portal', -off);
        if (w && w.key !== 'user') {
          awardPortalToTeam(e, w.key);
          addLog('ev', G.gi, '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ' OVR) chose <b>' + w.name + '</b> over you.');
        } else {
          releaseUnclaimed(e); // nobody with room wanted him: a lower level
        }
        lost++;
      }
    } else {
      var w2 = drawPortalWinner(e);
      if (w2 && w2.key !== 'user') awardPortalToTeam(e, w2.key);
      else releaseUnclaimed(e);
    }
  });
  if (_portalTouchedUser) { var t = G.teams[G.tid]; if (t) fixMins(t.rost); }
  G.portalStage = 3; // closed
  return { won: won, lost: lost };
}
export function finalizePortal() {
  var r = portalDecide(true);
  var msg = 'Portal closed: ' + r.won + ' transfer' + (r.won === 1 ? '' : 's') + ' in'
    + (r.lost ? ' · ' + r.lost + ' chose elsewhere' : '');
  toast(msg, r.won ? 'var(--grn)' : 'var(--gld)');
  addLog('ev', G.gi, '<b>Transfer portal closes.</b> ' + msg + '.');
  saveState();
  advanceFromPortal();
}

// Portal closed: recruiting carries on on Build your roster
export function advanceFromPortal() {
  G.offseasonStep = 'build';
  saveState(); rerender();
}
window.advanceFromPortal = advanceFromPortal;

// Global CPU resolution for the remaining portal pool (called once from
// doOffseason). Every entrant resolves through its suitor field — no more
// best-available-in-team-ID-order. Top transfers land at prestigious programs;
// small schools get the leftovers. Teams only take transfers they actually
// have room for (roster < 15, fewer than 3 portal takes, and either a thin
// roster or a positional need). Unclaimed entrants leave for a lower level.
export function resolvePortalCPU() {
  var touchedUser = false;
  var takes = {}, gone = [];
  var list = portalBoard(); // best-first; also ensures entrant fields
  list.forEach(function(e) {
    if (e.pickedBy !== -1) return;
    var suitors = calcSuitorBids(e).filter(function(s) {
      var wt = G.teams[s.tid];
      if (!wt || wt.id === G.tid || wt.rost.length >= 15) return false;
      if ((takes[wt.id] || 0) >= 3) return false;
      // Only take transfers you need: room on the roster, a hole at the
      // position, or an elite talent worth making room for.
      if (wt.rost.length < 13) return true;
      var pc = 0;
      wt.rost.forEach(function(p) { if (p.pos === e.pos) pc++; });
      return pc < 2 || oldOvr(e.ovr) >= 82;
    });
    if (!suitors.length) { gone.push(e); return; } // nobody with room: a lower level
    var win = weightedWinner(suitors.map(function(s) { return { key: s.tid, bid: s.bid, name: s.name }; }));
    var wt = G.teams[win.key];
    if (!wt) return;
    takes[wt.id] = (takes[wt.id] || 0) + 1;
    e.pickedBy = wt.id;
    var taken = takeFromOldRoster(e);
    if (taken && e.fromTid === G.tid) touchedUser = true;
    var np = entrantToPlayer(e);
    if (taken && taken.cls !== e.cls) {
      np.cls = taken.cls; // old roster already aged this player in doOffseason — don't age twice
    } else {
      var ci = CLS.indexOf(np.cls);            // transfers age up like everyone else
      if (ci >= 0 && ci < 3) np.cls = CLS[ci + 1];
    }
    wt.rost.push(np);
  });
  gone.forEach(function(e) { if (takeFromOldRoster(e) && e.fromTid === G.tid) touchedUser = true; });
  G.portalEntrants = [];
  return touchedUser;
}
window._resolvePortalCPU = resolvePortalCPU;

// Clear all portal flags/state at the end of the offseason
export function clearPortalState() {
  G.teams.forEach(function(tm) {
    (tm.rost || []).forEach(function(p) { if (p._portalPid) delete p._portalPid; });
  });
  G.portalEntrants = [];
  G.portalStage = 0; G.portalCpuTakes = {}; G.portalUserSigns = 0;
}
window._clearPortalState = clearPortalState;

// ═══════════════════════════════════════════════════════════
//  PLAYER PAGE (sheet) — opened from Build your roster
//  (views/build.js); clicks are bound by views/recruiting.js,
//  which owns the #offseason-content container
// ═══════════════════════════════════════════════════════════

// The entrant's season line, read off the player still sitting on his old roster.
export function entrantStats(e) {
  var ot = G.teams[e.fromTid];
  var p = ot && (ot.rost || []).find(function(x) { return x._portalPid === e.pid; });
  if (!p || !p.s || !p.s.gp) return null;
  var gp = p.s.gp;
  return { gp: gp, ppg: p.s.pts / gp, rpg: p.s.reb / gp, apg: p.s.ast / gp, fg: p.s.fga ? p.s.fgm / p.s.fga : 0 };
}

// Your chance, then the schools chasing him splitting the rest by offer
function schoolOdds(e) {
  var ch = portalChance(e), tot = 0;
  ch.suitors.forEach(function(x) { tot += x.bid; });
  var rows = ch.suitors.map(function(x) { return { name: x.name, pct: Math.round((100 - ch.pct) * x.bid / Math.max(1, tot)), me: false }; });
  rows.push({ name: G.teams[G.tid].name + (e.offer ? '' : ' (no offer yet)'), pct: e.offer ? ch.pct : 0, me: true });
  return rows.sort(function(a, b) { return b.pct - a.pct; });
}

function offerControl(e, stage) {
  var offer = e.offer || 0, nil = G.pts || 0;
  var blocked = offer === 0 && !canStartOffer();
  var canSub = offer > 0, canAdd = nil >= PORTAL_OFFER_STEP && !blocked;
  return '<div class="pp-offer"><div class="pp-offer-l"><span>Your NIL offer</span><div class="bt-offer">'
    + '<button class="stepper' + (canSub ? '' : ' off') + '" data-poff-dec="' + e.pid + '" aria-label="Lower offer">−</button>'
    + '<span class="offer-v' + (offer ? ' on' : '') + '">' + offer + '</span>'
    + '<button class="stepper plus' + (canAdd ? '' : ' off') + '" data-poff-inc="' + e.pid + '" aria-label="Raise offer">+</button></div></div>'
    + '<div class="pp-offer-r"><span>' + Battle.favoredLine(nilFor50(e), 'NIL', offer) + '</span><span>' + nil + ' NIL available</span>'
    + (offer > 0 ? '<span>Your odds: <b>' + portalChance(e).pct + '%</b></span>' : '')
    + (offer > 0 && stage >= 1 ? '<button class="btn-quiet btn-sm" data-ppivot="' + e.pid + '">Withdraw (75% back)</button>' : '')
    + '</div></div>'
    + (blocked ? '<div class="tg-note" style="margin:-4px 0 10px;">' + (openSpots() ? 'Every open spot (' + openSpots() + ') has someone in the running. Drop one to offer him.' : 'Your roster is full for next season.') + '</div>' : '');
}

function portalPage(st) {
  var f = findEntrant(st.id);
  if (!f) return { title: 'Transfer portal', html: Acq.empty('He has already decided. See Targets for the result.') };
  var e = ensureEntrant(f.e), stage = G.portalStage || 0, stats = entrantStats(e);
  var left = { FR: 3, SO: 2, JR: 1, SR: 0 }[e.cls];
  var h = Acq.pageTop(e.name, e.pos + ' · ' + e.cls + ' · from ' + e.fromName, e.ovr, e.pot || e.ovr, '', e);
  h += Acq.pageTabs([{ id: 'overview', label: 'Overview' }, { id: 'ratings', label: 'Ratings' }, { id: 'schools', label: 'Odds' }], st.tab);
  if (st.tab === 'ratings') {
    h += typeTagsHTML(e) + ratingBarsHTML(e);
    h += '<div class="scout-stats">'
      + '<span><b>' + (stats ? stats.ppg.toFixed(1) : '–') + '</b> ppg</span><span><b>' + (stats ? stats.rpg.toFixed(1) : '–') + '</b> rpg</span>'
      + '<span><b>' + (stats ? stats.apg.toFixed(1) : '–') + '</b> apg</span><span><b>' + (stats ? (stats.fg * 100).toFixed(1) + '%' : '–') + '</b> FG</span>'
      + '<span><b>' + (stats ? stats.gp : 0) + '</b> games last season</span></div>';
  } else if (st.tab === 'schools') {
    h += '<div class="pp-note" style="margin-bottom:10px;">Where he is headed on decision day as things stand. Your number is your real chance to sign him; '
      + 'the schools chasing him split the rest by their offers. ' + (e.offer ? 'Raise your offer to move up.' : 'Make an offer to get in the race.') + '</div>';
    schoolOdds(e).forEach(function(x) {
      h += '<div class="school-row"><div class="school-name" style="' + (x.me ? 'color:var(--blu);font-weight:600;' : '') + '">' + x.name + '</div>'
        + '<div class="school-bar"><div class="school-fill" style="width:' + x.pct + '%;background:' + (x.me ? 'var(--blu)' : 'var(--bdr2)') + ';"></div></div>'
        + '<div class="school-pct">' + x.pct + '%</div></div>';
    });
  } else {
    h += offerControl(e, stage);
    h += '<div class="pp-sec"><div class="scout-type">' + playerType(e) + '</div>'
      + '<div class="pp-note">Leaving ' + e.fromName + ': ' + e.reason.toLowerCase() + '. '
      + (left === undefined ? '' : (left > 0 ? left + ' season' + (left > 1 ? 's' : '') + ' of eligibility left after this one.' : 'Final season.')) + '</div></div>';
    h += '<div class="pp-sec"><div class="card-title">Fit with ' + G.teams[G.tid].name + ' next season</div>' + fitListHTML(e) + '</div>';
  }
  return { title: 'Transfer portal', html: h };
}

Acq.registerSheet('portal', portalPage);
export function openPortalPage(pid) { Acq.openPage('portal', pid); }

