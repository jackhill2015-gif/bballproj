// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/portal.js
//  Transfer portal: LOGIC (DOM-free, operates only on G) +
//  RENDERING (new design-system skin: scheme-row rhythm,
//  bold name + gray description rows, blue accents).
//  Re-skinned into the Campus Dynasty design system; every
//  logic function keeps its name/signature/behavior.
// ═══════════════════════════════════════════════════════════

import { G, saveState } from '../state.js';
import { ri, freshS, clamp, fixMins } from '../utils.js';
import { CLS, TEAM_STATES, STATE_TO_REGION, RECRUIT_STATE_POOL } from '../constants.js';
import { portalEntryChance, moralePortalReason, MORALE_DEFAULT } from '../morale.js';
import { teamLogo } from '../ui.js';
import * as Battle from './battle.js';

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
  return 20 + Math.max(0, e.ovr - 65) * 5;
}

function portalEsc() {
  return [1.0, 1.2, 1.45][Math.max(0, Math.min(2, G.portalStage || 0))];
}

// Prestige gate by entrant quality (mirrors SCHOOL_RECRUIT_GATES philosophy):
// a 60-prestige school can dream about an 85 OVR transfer, but the math
// punishes it hard.
function portalGate(ovr) {
  if (ovr >= 84) return 80;
  if (ovr >= 78) return 60;
  if (ovr >= 72) return 40;
  return 0;
}

// Assign persistent suitors to an entrant. Better entrants attract better
// programs — top-25 schools chase the 84+ guys, everyone fights over the rest.
function assignSuitors(e, maxN) {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var poolSize = e.ovr >= 84 ? 25 : e.ovr >= 79 ? 60 : e.ovr >= 74 ? 120 : ranked.length;
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
  var desir = 1 + Math.max(0, e.ovr - 70) / 60; // elite transfers get pursued harder
  var esc = portalEsc();
  var out = [];
  (e.suitors || []).forEach(function(s) {
    var team = G.teams[s.tid];
    if (!team) return;
    var sp = team.schoolPrestige || 50;
    var seed = ((e.pid * 7 + s.tid * 13) % 100) / 100;
    var geo = getGeoBonus(getTeamState(team), e.homeState);
    var bid = (seed * 30 + 25) * (0.35 + sp / 55) * desir * (1 + geo) * esc;
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

// User's win % against the suitor field at the current offer, shown BEFORE
// committing. inRace is false until an offer is placed.
export function portalChance(e) {
  ensureEntrant(e);
  var u = calcUserPortalBid(e);
  var suitors = calcSuitorBids(e);
  var total = u.bid;
  suitors.forEach(function(s) { total += s.bid; });
  var pct = total > 0 ? Math.round(u.bid / total * 100) : 50;
  return { pct: clamp(pct, 1, 99), bid: u.bid, suitors: suitors, inRace: (e.offer || 0) > 0 };
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
export function genPortalEntrants() {
  G.portalEntrants = [];
  _nextPid = 1;
  G.teams.forEach(function(tm) {
    if (!tm.rost) return;
    var count = 0;
    tm.rost.forEach(function(p) {
      if (p.cls === 'SR') return;              // seniors already departing
      if (count >= 3) return;                  // max 3 entrants per team
      if ((p.mins || 0) >= 18) {
        // Rotation players stay put — unless they're checked out (morale < 25)
        var _m = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
        if (_m >= 25) return;
      }
      var unhappy = p.mins <= 10 || (p.ovr >= 78 && p.mins < 18) || (p.cls === 'FR' && p.mins <= 8);
      if (!unhappy) {
        var _m2 = (typeof p.morale === 'number') ? p.morale : MORALE_DEFAULT;
        if (_m2 >= 25) return;                 // content players with minutes stay
      }
      // Morale-weighted: lower morale → substantially more likely to enter
      if (Math.random() > portalEntryChance(p)) return;
      var pid = _nextPid++;
      p._portalPid = pid;
      G.portalEntrants.push({
        pid: pid, name: p.name, pos: p.pos, ovr: p.ovr, pot: p.pot || p.ovr,
        cls: p.cls, fromTid: tm.id, fromName: tm.name, mins: p.mins || 0,
        sht: p.sht, fin: p.fin, def: p.def, reb: p.reb, ply: p.ply,
        reason: portalReason(p), pickedBy: -1, offer: 0
      });
      count++;
    });
  });
  // Cap total entrants, preferring higher OVR; cut players keep their roster spot
  if (G.portalEntrants.length > PORTAL_MAX_ENTRANTS) {
    G.portalEntrants.sort(function(a, b) { return b.ovr - a.ovr; });
    var cut = G.portalEntrants.slice(PORTAL_MAX_ENTRANTS);
    G.portalEntrants = G.portalEntrants.slice(0, PORTAL_MAX_ENTRANTS);
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
    ovr: e.ovr, pot: e.pot, s: freshS(), transfer: true
  };
}

// ── Offer management ──
// NIL offers are escrowed per entrant (deducted from G.pts up front).
// Adding is always free; pulling out after the Open stage sinks 25% —
// pivoting has a cost.
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
    if (!t || t.rost.length >= 15) { toast('Roster is full (15).', 'var(--gld)'); return false; }
    if ((G.pts || 0) < delta) { toast('Not enough NIL (' + delta + ' needed).', 'var(--gld)'); return false; }
    G.pts -= delta;
  } else if (delta < 0) {
    var back = (G.portalStage || 0) >= 1 ? Math.round(-delta * Battle.PIVOT_REFUND) : -delta;
    G.pts += back;
    if (back < -delta) toast('Offer reduced. ' + (-delta - back) + ' NIL not refunded.', 'var(--gld)');
  }
  e.offer = nv;
  saveState(); rerender();
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

// Release an unclaimed entrant: drop them from the pool AND clear the
// _portalPid flag off their roster player, so no flags leak onto rosters.
function releaseUnclaimed(e) {
  var ot = G.teams[e.fromTid];
  if (ot && ot.rost) {
    for (var i = 0; i < ot.rost.length; i++) {
      if (ot.rost[i]._portalPid === e.pid) { delete ot.rost[i]._portalPid; break; }
    }
  }
  removeEntrant(e);
}

function awardPortalToUser(e, early) {
  var t = G.teams[G.tid];
  if (!t || t.rost.length >= 15) {
    // Roster filled mid-battle — refund the escrowed offer instead.
    G.pts += (e.offer || 0); e.offer = 0; return false;
  }
  e.pickedBy = G.tid;
  takeFromOldRoster(e);
  var np = entrantToPlayer(e);
  np.portalYr = G.yr;
  t.rost.push(np);
  e.offer = 0;
  G.portalUserSigns = (G.portalUserSigns || 0) + 1;
  removeEntrant(e);
  addLog('ev', G.gi, '<b>' + np.name + '</b> (' + np.pos + ', ' + np.ovr + ' OVR) transfers in from ' + e.fromName + (early ? ' <b>(early)</b>' : '') + '.');
  toast(np.name + ' commits from the portal' + (early ? ' early!' : '!'), 'var(--grn)');
  return true;
}

function awardPortalToTeam(e, tid) {
  var wt = G.teams[tid];
  if (!wt) return false;
  e.pickedBy = tid;
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
// have room for (roster < 15, fewer than 3 portal takes, and either a thin
// roster or a positional need / elite talent).
function eligiblePortalSuitors(e) {
  return calcSuitorBids(e).filter(function(s) {
    var wt = G.teams[s.tid];
    if (!wt || wt.id === G.tid || wt.rost.length >= 15) return false;
    if ((G.portalCpuTakes[wt.id] || 0) >= 3) return false;
    if (wt.rost.length < 13) return true;
    var pc = 0;
    wt.rost.forEach(function(p) { if (p.pos === e.pos) pc++; });
    return pc < 2 || e.ovr >= 82;
  });
}

function drawPortalWinner(e, includeUser) {
  var entries = [];
  if (includeUser) {
    var u = calcUserPortalBid(e);
    entries.push({ key: 'user', bid: u.bid });
  }
  eligiblePortalSuitors(e).forEach(function(s) {
    entries.push({ key: s.tid, bid: s.bid, name: s.name });
  });
  if (!entries.length) return null;
  return weightedWinner(entries);
}

// ── Early-decision round (stages 1→2 and 2→3) ──
function portalEarlyRound(decideFrac) {
  return Battle.runEarlyRound({
    targets: portalBoard(),
    isOpen: function(e) { return e.pickedBy === -1; },
    decideFrac: decideFrac,
    invested: function(e) { return (e.offer || 0) > 0; },
    userLead: function(e) {
      var ch = portalChance(e);
      var tot = ch.bid, i, best = 0;
      for (i = 0; i < ch.suitors.length; i++) { tot += ch.suitors[i].bid; best = Math.max(best, ch.suitors[i].bid); }
      if (tot <= 0) return 0;
      return (ch.bid - best) / tot * 100;
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
      var w = drawPortalWinner(e, false);
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
      if (p.ovr < 64 || p.ovr > 80) return;
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

// ── Stage advancement: one button per stage ──
export function advancePortalStage() {
  var stage = G.portalStage || 0;
  if (stage >= 2) { finalizePortal(); return; }
  // Snapshot trends BEFORE CPU escalation so Vibe Check shows movement.
  portalBoard().forEach(function(e) {
    if (e.pickedBy === -1) e._prevPct = portalChance(e).pct;
  });
  _portalTouchedUser = false;
  G.portalStage = stage + 1;
  if (G.portalStage === 2) maybeLatePortalEntries();
  var res = portalEarlyRound(Battle.ACQ_STAGES[stage].decideFrac);
  var parts = [];
  if (res.userSigned.length) parts.push(res.userSigned.length + ' commit' + (res.userSigned.length > 1 ? 's' : '') + ' early');
  if (res.cpuSigned.length) parts.push(res.cpuSigned.length + ' signed elsewhere');
  parts.push(portalBoard().filter(function(e) { return e.pickedBy === -1; }).length + ' still available');
  toast(Battle.ACQ_STAGES[G.portalStage].name + ': ' + parts.join(' · '), res.userSigned.length ? 'var(--grn)' : 'var(--gld)');
  if (_portalTouchedUser) { var t = G.teams[G.tid]; if (t) fixMins(t.rost); }
  saveState(); rerender();
}
window.advancePortalStage = advancePortalStage;

// ── Signing Day: every remaining entrant decides ──
export function finalizePortal() {
  _portalTouchedUser = false;
  var list = portalBoard().filter(function(e) { return e.pickedBy === -1; });
  list.sort(function(a, b) { return b.ovr - a.ovr; });
  var won = 0, lost = 0;
  list.forEach(function(e) {
    if ((e.offer || 0) > 0) {
      var w = drawPortalWinner(e, true);
      if (w && w.key === 'user') { if (awardPortalToUser(e, false)) won++; }
      else {
        var off = e.offer || 0; e.offer = 0;
        G.pts += off; // refund on loss — matches recruiting point refunds
        if (w && w.key !== 'user') {
          awardPortalToTeam(e, w.key);
          addLog('ev', G.gi, '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ' OVR) chose <b>' + w.name + '</b> over you.');
        } else {
          releaseUnclaimed(e); // nobody with room wanted them — they stay put
        }
        lost++;
      }
    } else {
      var w2 = drawPortalWinner(e, false);
      if (w2 && w2.key !== 'user') awardPortalToTeam(e, w2.key);
      else releaseUnclaimed(e);
    }
  });
  if (_portalTouchedUser) { var t = G.teams[G.tid]; if (t) fixMins(t.rost); }
  var msg = 'Portal closed: ' + won + ' transfer' + (won === 1 ? '' : 's') + ' in'
    + (lost ? ' · ' + lost + ' chose elsewhere' : '');
  toast(msg, won ? 'var(--grn)' : 'var(--gld)');
  addLog('ev', G.gi, '<b>Transfer portal closes.</b> ' + msg + '.');
  saveState();
  advanceFromPortal();
}

// Leave the portal step and continue to recruiting
export function advanceFromPortal() {
  G.offseasonStep = 'recruiting';
  saveState(); rerender();
}
window.advanceFromPortal = advanceFromPortal;

// Global CPU resolution for the remaining portal pool (called once from
// doOffseason). Every entrant resolves through its suitor field — no more
// best-available-in-team-ID-order. Top transfers land at prestigious programs;
// small schools get the leftovers. Teams only take transfers they actually
// have room for (roster < 15, fewer than 3 portal takes, and either a thin
// roster or a positional need). Unclaimed entrants stay on their old rosters.
export function resolvePortalCPU() {
  var touchedUser = false;
  var takes = {};
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
      return pc < 2 || e.ovr >= 82;
    });
    if (!suitors.length) return; // nobody with room wanted them — they stay
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
  G.portalEntrants = (G.portalEntrants || []).filter(function(x) { return x.pickedBy === -1; });
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
//  RENDERING — new design-system skin
//  (delegation is bound by views/recruiting.js, which owns the
//  #offseason-content container this HTML is injected into)
// ═══════════════════════════════════════════════════════════

function chanceColor(pct) {
  return pct >= 60 ? 'var(--grn2)' : pct >= 30 ? 'var(--gld2)' : 'var(--red)';
}

// ── Board view state (filters + sort). Not saved: it's a view preference.
var _pf = { pos: 'All', tier: 'all', mine: false, sort: 'ovr', dir: -1 };
var TIERS = [
  { id: 'all', label: 'All', test: function() { return true; } },
  { id: 'a', label: '90+', test: function(e) { return e.ovr >= 90; } },
  { id: 'b', label: '85–89', test: function(e) { return e.ovr >= 85 && e.ovr < 90; } },
  { id: 'c', label: '80–84', test: function(e) { return e.ovr >= 80 && e.ovr < 85; } },
  { id: 'd', label: '75–79', test: function(e) { return e.ovr >= 75 && e.ovr < 80; } },
  { id: 'e', label: 'Under 75', test: function(e) { return e.ovr < 75; } }
];
export function setPortalFilter(key, val) {
  if (key === 'sort') {
    if (_pf.sort === val) _pf.dir = -_pf.dir; else { _pf.sort = val; _pf.dir = val === 'name' || val === 'pos' ? 1 : -1; }
  } else if (key === 'mine') _pf.mine = !_pf.mine;
  else _pf[key] = val;
  rerender();
}

function sortVal(e, ch) {
  switch (_pf.sort) {
    case 'name': return e.name;
    case 'pos': return ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(e.pos);
    case 'pot': return e.pot || e.ovr;
    case 'ask': return portalCost(e);
    case 'offer': return e.offer || 0;
    case 'odds': return ch.pct;
    case 'from': return e.fromName;
    default: return e.ovr;
  }
}

function chip(key, val, label, on) {
  return '<button class="fchip' + (on ? ' on' : '') + '" data-pfilter="' + key + '" data-pval="' + val + '">' + label + '</button>';
}

function th(key, label, cls) {
  var on = _pf.sort === key;
  return '<th class="sortable' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + '" data-pfilter="sort" data-pval="' + key + '">'
    + label + (on ? (_pf.dir < 0 ? ' ▾' : ' ▴') : '') + '</th>';
}

function entrantRow(e, stage) {
  var ch = portalChance(e);
  var nil = G.pts || 0;
  var offer = e.offer || 0;
  var potCol = (e.pot || e.ovr) > e.ovr + 6 ? 'var(--grn2)' : 'var(--txt2)';
  var offerCell, oddsCell;
  if (e.fromTid === G.tid) {
    offerCell = '<span style="color:var(--txt3);">Your player</span>';
    oddsCell = '';
  } else {
    var canAdd = nil >= PORTAL_OFFER_STEP, canSub = offer > 0;
    offerCell = '<div class="bt-offer">'
      + '<button class="stepper' + (canSub ? '' : ' off') + '" data-poff-dec="' + e.pid + '" aria-label="Lower offer to ' + e.name + '">−</button>'
      + '<span class="offer-v' + (offer ? ' on' : '') + '">' + offer + '</span>'
      + '<button class="stepper plus' + (canAdd ? '' : ' off') + '" data-poff-inc="' + e.pid + '" aria-label="Raise offer to ' + e.name + '">+</button>'
      + (offer > 0 && stage >= 1 ? '<button class="btn-quiet btn-sm" data-ppivot="' + e.pid + '">Withdraw</button>' : '')
      + '</div>';
    oddsCell = offer > 0
      ? '<b style="color:' + chanceColor(ch.pct) + ';font-weight:600;">' + ch.pct + '%</b><div>' + Battle.trendHTML(ch.pct, e._prevPct) + '</div>'
      : '<span style="color:var(--txt3);">' + ch.pct + '%</span>';
  }
  var chase = ch.suitors.slice(0, 2).map(function(s) { return s.name; }).join(', ');
  return '<tr' + (offer > 0 ? ' class="hl"' : '') + '>'
    + '<td class="c-pos">' + e.pos + '</td>'
    + '<td class="pt-name c-name"><b>' + e.name + '</b> <span class="dim">' + e.cls + '</span>' + (e.late ? ' <span class="tag t-ok">Late entry</span>' : '')
    + '<div class="pt-sub">' + e.fromName + ', ' + e.reason.toLowerCase() + (chase ? '. Interest: ' + chase : '') + '</div></td>'
    + '<td class="num c-ovr" data-l="Ovr"><b>' + e.ovr + '</b></td>'
    + '<td class="num c-pot" data-l="Pot" style="color:' + potCol + ';">' + (e.pot || e.ovr) + '</td>'
    + '<td class="num dim c-ask" data-l="Ask">' + portalCost(e) + '</td>'
    + '<td class="c-offer">' + offerCell + '</td>'
    + '<td class="num c-odds" data-l="Odds">' + oddsCell + '</td>'
    + '</tr>';
}

export function renderPortal() {
  var board = portalBoard();
  var mine = board.filter(function(e) { return e.fromTid === G.tid; });
  var avail = board.filter(function(e) { return e.fromTid !== G.tid; });
  var stage = G.portalStage || 0;
  var stg = Battle.stageOf(stage);
  var offersOut = avail.filter(function(e) { return (e.offer || 0) > 0; }).length;
  var committed = avail.reduce(function(s, e) { return s + (e.offer || 0); }, 0);
  var tier = TIERS.find(function(t) { return t.id === _pf.tier; }) || TIERS[0];

  var h = '<div class="portal-wrap">';
  h += '<div style="margin-bottom:10px;"><div class="sec-head">Transfer portal</div>'
    + '<div class="sec-sub">' + stg.tag + ': ' + stg.name + '. ' + stg.desc + '</div></div>';
  h += Battle.stageStepperHTML(stage);

  h += '<div class="kv" style="margin-bottom:12px;">'
    + '<div><b data-nil-left>' + (G.pts || 0) + '</b><span>NIL available</span></div>'
    + '<div><b>' + committed + '</b><span>NIL offered</span></div>'
    + '<div><b>' + offersOut + '</b><span>Open offers</span></div>'
    + '<div><b>' + avail.length + '</b><span>In portal</span></div></div>';

  if (mine.length) {
    h += '<div class="final-line l" style="display:block;">'
      + (mine.length === 1 ? 'One of your players' : mine.length + ' of your players') + ' entered the portal: '
      + mine.map(function(e) { return '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ')'; }).join(', ') + '.</div>';
  }

  // Filters
  h += '<div class="fbar"><span class="flbl">Position</span>';
  ['All', 'PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pz) { h += chip('pos', pz, pz, _pf.pos === pz); });
  h += '</div><div class="fbar"><span class="flbl">Overall</span>';
  TIERS.forEach(function(t) { h += chip('tier', t.id, t.label, _pf.tier === t.id); });
  h += chip('mine', '1', 'My offers only', _pf.mine);
  h += '</div><div class="fbar fbar-sort"><span class="flbl">Sort</span>';
  [['ovr', 'Overall'], ['pot', 'Potential'], ['odds', 'Odds'], ['ask', 'Ask']].forEach(function(s) {
    h += chip('sort', s[0], s[1] + (_pf.sort === s[0] ? (_pf.dir < 0 ? ' ▾' : ' ▴') : ''), _pf.sort === s[0]);
  });
  h += '</div>';

  var rows = avail.filter(function(e) {
    if (_pf.pos !== 'All' && e.pos !== _pf.pos) return false;
    if (!tier.test(e)) return false;
    if (_pf.mine && !(e.offer > 0)) return false;
    return true;
  }).map(function(e) { return { e: e, ch: portalChance(e) }; });
  rows.sort(function(a, b) {
    var x = sortVal(a.e, a.ch), y = sortVal(b.e, b.ch);
    if (x < y) return -1 * _pf.dir; if (x > y) return 1 * _pf.dir;
    return b.e.ovr - a.e.ovr;
  });

  h += '<div class="sec-sub" style="margin:6px 0;">' + rows.length + ' of ' + avail.length + ' players shown. Ask is the typical NIL offer for that player.</div>';
  h += '<div class="tbl-wrap"><table class="ptbl"><thead><tr>'
    + th('pos', 'Pos') + th('name', 'Player') + th('ovr', 'Ovr', 'num') + th('pot', 'Pot', 'num')
    + th('ask', 'Ask', 'num') + th('offer', 'Your offer') + th('odds', 'Odds', 'num')
    + '</tr></thead><tbody>';
  rows.forEach(function(r) { h += entrantRow(r.e, stage); });
  h += '</tbody></table></div>';
  if (!avail.length) h += '<div class="empty-state">No players are in the portal this year.</div>';
  else if (!rows.length) h += '<div class="empty-state">No players match these filters.</div>';

  h += '<button class="btn-big btn-full" style="margin-top:14px;" data-pstage>' + stg.btn + '</button>';
  return h + '</div>';
}
