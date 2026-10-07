// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  Roster Turnover + Tab-Based Recruiting System
//  Re-skinned into the Campus Dynasty design system:
//  cards, stat-strip, strat-tabs, scheme-row rhythm, big
//  blue buttons, delegated events (no inline onclick).
//
//  LOGIC PRESERVED (names/signatures/behavior identical):
//  R1 r.signed = team id · R3 rejected jobs by stable id ·
//  R4 fired-coach stay block · R5 30-row cap + show-more ·
//  class-size cap · R7 _skillInitial persistence · exported
//  calcOfferChance. +/- steppers update in place (no full
//  re-render); board pagination kept.
// ═══════════════════════════════════════════════════════════

import { payDonors } from '../finance.js';
import { ge, clamp, ri, getTOvr } from '../utils.js';
import { hasRestlessStarAt } from '../morale.js';
import { TEAM_STATES, STATE_TO_REGION, STATE_NAMES, SCHOOL_RECRUIT_GATES, COACH_FN, COACH_LN, RECRUIT_STATE_POOL } from '../constants.js';
import { G, LS, SetupState, saveState, calcRecruitingBudget } from '../state.js';
import { renderPortal, genPortalEntrants, registerPortalCallbacks, adjustOffer, pivotOffer, advancePortalStage, advanceFromPortal, setPortalFilter, togglePortalDetail, PORTAL_OFFER_STEP, setPortalTab, openPortalPage, openPortalFilter, clearPortalFilter } from './portal.js';
import { genPlayer } from '../simulation.js';
import { buildRetentionAsks, renderRetention, decideRetention, applyRetention, retentionPending } from './retention.js';
import { teamLogo } from '../ui.js';
import * as Battle from './battle.js';
import { scoutLine, scoutingHTML, fitReport, playerType, typeTagsHTML, ratingBarsHTML, fitListHTML } from './scouting.js';
import { beginReport, noteSigning, signingDayHTML, openSpots, targetsHTML } from './signings.js';
import * as Acq from './acq.js';
import { closeSheet } from './sheet.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

var _ext = { toast: null, addLog: null, updateAll: null };
export function registerRecruitingCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function toast(m, c) { if (_ext.toast) _ext.toast(m, c); }
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }

// Wire portal logic → this view's render path (portal.js stays DOM-free)
registerPortalCallbacks({
  render: function() { renderOffseason(); },
  toast: toast, addLog: addLog, updateAll: updateAll
});

// ── Current recruiting tab ──
var _tab = 'board';
// Filters + sort persist across visits via ui-prefs (localStorage only).
var _filter = Object.assign({ pos: 'All', stars: 0, sort: 'rank', dir: 1, near: false, targets: false, fit: 'all' }, getUiPrefs('recruiting'));
var _detailId = -1; // recruit ID shown in detail, -1 = none

// ═══════════════════════════════════════════════════════════
//  PHASE CONFIG
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  STAGE CONFIG — unified 3-stage battle machine (views/battle.js)
//  Round 1 "Initial offers": allocate points (concentrate or spread)
//  Round 2 "Follow-up": odds moved — add, hold, or drop (75% refund)
//  Round 3 "Signing day": final adjustments, then everyone decides
// ═══════════════════════════════════════════════════════════
var PHASES = {
  1: { name: 'Initial offers', tag: 'Round 1 of 3', desc: 'Assign recruiting points. Commit heavily to a few prospects or spread points across many.', btnLabel: 'Close initial offers', final: false, decideFrac: 0.30, cpuAgg: 0.8 },
  2: { name: 'Follow-up', tag: 'Round 2 of 3', desc: 'Odds have moved. Add points, hold, or drop a prospect (dropping refunds 75%).', btnLabel: 'Close follow-ups', final: false, decideFrac: 0.60, cpuAgg: 1.1 },
  3: { name: 'Signing day', tag: 'Round 3 of 3', desc: 'Last chance to adjust. Every prospect decides when you finalize, and you will see the results before the season starts.', btnLabel: 'Finalize the class', final: true, decideFrac: 1.0, cpuAgg: 1.4 }
};

// ═══════════════════════════════════════════════════════════
//  GEO + BID HELPERS (unchanged logic)
// ═══════════════════════════════════════════════════════════
function getTeamState(t) { return TEAM_STATES[t.name] || 'XX'; }
function getGeoBonus(ts, rs) { if (!ts || !rs || ts === 'XX') return 0; if (ts === rs) return 0.20; var tr = STATE_TO_REGION[ts], rr = STATE_TO_REGION[rs]; if (tr && tr === rr) return 0.10; return 0; }
function getGeoLabel(ts, rs) { if (!ts || !rs || ts === 'XX') return ''; if (ts === rs) return 'HOME'; var tr = STATE_TO_REGION[ts], rr = STATE_TO_REGION[rs]; if (tr && tr === rr) return 'REGION'; return ''; }

function calcUserBid(r) {
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var recMod = 0.7 + ((G.coach ? G.coach.rec : 70) / 100) * 0.6;
  var us = getTeamState(G.teams[G.tid]);
  var geo = getGeoBonus(us, r.homeState);
  var base = ((r.points || 0) * recMod * 1.5 + r.interest * 0.4) * (1 + geo);
  // Morale pitch: a restless star at the recruit's position means the job is
  // opening up — "come start right away" lands harder.
  if (hasRestlessStarAt(G.teams[G.tid], r.pos)) base *= 1.15;
  var gatePrestige = SCHOOL_RECRUIT_GATES[r.stars] || 0;
  if (sp < gatePrestige) {
    var deficit = gatePrestige - sp;
    base *= Math.max(0.1, 1 - (deficit / 50));
  }
  return base;
}

function calcSchoolChances(r) {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var cpuAgg = (PHASES[G.recruitPhase] || PHASES[1]).cpuAgg;
  var schools = [];

  // User bid (only if invested)
  var userBid = calcUserBid(r);
  if ((r.points || 0) > 0) {
    var userGeo = getGeoLabel(getTeamState(G.teams[G.tid]), r.homeState);
    schools.push({ tid: G.tid, name: G.teams[G.tid].name, bid: userBid, isUser: true, geo: userGeo, rank: ranked.findIndex(function(t) { return t.id === G.tid; }) + 1 });
  }

  // Use PERSISTENT rivals from recruit generation — never reshuffles
  var rivals = r.rivals || [];
  rivals.forEach(function(rv) {
    var team = G.teams[rv.tid];
    if (!team) return;
    var rk = ranked.findIndex(function(t) { return t.id === rv.tid; }) + 1;
    var pw = rk <= 10 ? 1.8 : rk <= 25 ? 1.4 : rk <= 64 ? 1.0 : 0.65;
    var sb = r.stars >= 5 ? 1.6 : r.stars >= 4 ? 1.3 : r.stars >= 3 ? 1.0 : 0.7;
    var geo = getGeoBonus(getTeamState(team), r.homeState);
    // Deterministic bid based on rank + star + geo (seeded by recruit id + rival id)
    var seed = ((r.id * 7 + rv.tid * 13) % 100) / 100;
    var bid = (seed * 30 + 20) * pw * sb * cpuAgg * (1 + geo);
    var geoL = getGeoLabel(getTeamState(team), r.homeState);
    schools.push({ tid: rv.tid, name: rv.name, bid: bid, isUser: false, geo: geoL, rank: rk });
  });

  // Convert to percentages
  var total = schools.reduce(function(s, x) { return s + x.bid; }, 0);
  if (total === 0) total = 1;
  schools.forEach(function(s) { s.pct = Math.round((s.bid / total) * 100); });
  schools.sort(function(a, b) { return b.pct - a.pct; });
  schools.forEach(function(s) { if (s.pct < 1 && s.bid > 0) s.pct = 1; });
  return schools;
}

// Cache school chances per recruit per phase
function getSchoolChances(r) {
  if (!r._schools || r._schoolsPhase !== G.recruitPhase) {
    r._schools = calcSchoolChances(r); r._schoolsPhase = G.recruitPhase;
  }
  return r._schools;
}

function recalcSpent() {
  G.recruitingSpent = G.recruits.reduce(function(s, r) { return s + (r.status === 'open' ? (r.points || 0) : 0); }, 0);
}

function initRecruitingIfNeeded() {
  if (G.recruitPhase === 0) { G.recruitPhase = 1; G.recruitingBudget = calcRecruitingBudget(); G.recruitingSpent = 0; }
  G.recruits.forEach(function(r) {
    if (typeof r.points !== 'number') r.points = 0;
    if (typeof r.status !== 'string') r.status = r.signed >= 0 ? (r.signed === G.tid ? 'committed' : 'gone') : 'open';
    if (!r.homeState) r.homeState = 'CA';
  });
}

// ═══════════════════════════════════════════════════════════
//  ACTIONS (logic unchanged; adjustPoints now updates in place)
// ═══════════════════════════════════════════════════════════

// Recruits you're pursuing right now (targeted or holding your points)
function pursuing() {
  return (G.recruits || []).filter(function(r) {
    return r.status === 'open' && (G.recruitTargets.indexOf(r.id) >= 0 || (r.points || 0) > 0);
  }).length;
}
function isPursuing(r) { return G.recruitTargets.indexOf(r.id) >= 0 || (r.points || 0) > 0; }
// One pursuit per open roster spot, so nobody who signs is cut for room
function canPursueAnother() { return pursuing() < openSpots(); }
function pursuitBlockedMsg() {
  var os = openSpots();
  return os ? 'You have ' + os + ' open spot' + (os !== 1 ? 's' : '') + ' and someone in the running for each. Drop a target to go after him.'
    : 'Your roster is full for next season.';
}

export function adjustPoints(rid, delta) {
  var r = G.recruits.find(function(x) { return x.id === rid; });
  if (!r || r.status !== 'open') return;
  if (delta > 0 && !isPursuing(r) && !canPursueAnother()) { toast(pursuitBlockedMsg(), 'var(--gld)'); return; }
  var nv = (r.points || 0) + delta; if (nv < 0) return;
  var left = G.recruitingBudget - G.recruitingSpent;
  if (delta > 0 && left < delta) return;
  if (delta < 0 && (G.recruitPhase || 1) >= 2) {
    // Pulling out after the Open stage sinks 25% — pivoting has a cost.
    var sunk = Math.round(-delta * (1 - Battle.PIVOT_REFUND));
    if (sunk > 0) G.recruitingBudget = Math.max(0, G.recruitingBudget - sunk);
  }
  r.points = nv; delete r._schools; delete r._schoolsPhase;
  recalcSpent(); saveState();
  renderOffseason();
}
window.adjustPoints = adjustPoints;

export function addTarget(rid) {
  var r0 = G.recruits.find(function(x) { return x.id === rid; });
  if (G.recruitTargets.indexOf(rid) < 0 && !(r0 && (r0.points || 0) > 0) && !canPursueAnother()) { toast(pursuitBlockedMsg(), 'var(--gld)'); return; }
  if (G.recruitTargets.indexOf(rid) < 0) G.recruitTargets.push(rid);
  saveState();
  // On the board, just flip that row (no 400-row rebuild); elsewhere re-render
  renderOffseason();
}

function patchTargetRow(rid) {
  if (typeof document === 'undefined' || !document.querySelector) return false;
  var row = document.querySelector('tr.rrow[data-rid="' + rid + '"]');
  if (!row) return false;
  row.classList.add('hl');
  var act = row.querySelector('.c-act');
  if (act) act.innerHTML = '<span class="tgt-on">Targeted</span>';
  var tab = document.querySelector('[data-rtab="targets"]');
  if (tab) tab.textContent = 'Targets (' + G.recruitTargets.length + ')';
  return true;
}
window.addTarget = addTarget;

export function removeTarget(rid) {
  G.recruitTargets = G.recruitTargets.filter(function(x) { return x !== rid; });
  var r = G.recruits.find(function(x) { return x.id === rid; });
  if (r) {
    // Pivot: pull out of a lost cause. After the Open stage, 25% is sunk.
    var pts = r.points || 0;
    if (pts > 0 && (G.recruitPhase || 1) >= 2) {
      var sunk = Math.round(pts * (1 - Battle.PIVOT_REFUND));
      if (sunk > 0) {
        G.recruitingBudget = Math.max(0, G.recruitingBudget - sunk);
        toast('Dropped. ' + sunk + ' points not refunded.', 'var(--gld)');
      }
    }
    r.points = 0; delete r._schools; delete r._schoolsPhase;
  }
  recalcSpent(); saveState(); renderOffseason();
}
window.removeTarget = removeTarget;

export function showDetail(rid) { _detailId = rid; renderOffseason(); }
window.showDetail = showDetail;

export function closeDetail() { _detailId = -1; renderOffseason(); }
window.closeDetail = closeDetail;

export function setRecruitTab(tab) { _tab = tab; _detailId = -1; renderOffseason(); }
window.setRecruitTab = setRecruitTab;

export function setRecruitFilter(key, val) {
  if (key === 'show') {
    _filter.near = val === 'near'; _filter.targets = val === 'targets';
    _filter.fit = (val === 'near' || val === 'targets') ? 'all' : val;
  } else if (key === 'sortsel') { _filter.sort = val; _filter.dir = val === 'rank' ? 1 : -1; }
  else _filter[key] = val;
  setUiPrefs('recruiting', _filter); renderOffseason();
}
window.setRecruitFilter = setRecruitFilter;


export function proceedToRecruiting() {
  if (G.offseasonStep !== 'turnover' && G.offseasonStep !== 'carousel') return; // already done this offseason
  // Remove departing players from roster
  var t = G.teams[G.tid];
  var dominated = G.departingPlayers.map(function(d) { return d.name; });
  t.rost = t.rost.filter(function(p) { return dominated.indexOf(p.name) < 0; });
  genRecruitsFn();
  // The donor collective's check lands here: it funds retention, the
  // transfer portal and facilities.
  var bonus = payDonors();
  if (bonus) {
    addLog('ev', G.gi, 'Donor collective check: <b>+' + bonus + ' NIL</b> for retention, the transfer portal and facilities.');
    toast('Donor check: +' + bonus + ' NIL', 'var(--grn)');
  }
  // Departures + player retention share one screen (always shown, so you
  // see who left even when nobody asks for NIL)
  buildRetentionAsks();
  G.offseasonStep = 'retention';
  saveState(); updateAll(); renderOffseason();
}
window.proceedToRecruiting = proceedToRecruiting;

// Retention decided → mark kept / let-go players, then build the portal
function openPortal() {
  applyRetention();
  // R9: transfer portal step sits between turnover and recruiting
  genPortalEntrants();
  G.offseasonStep = 'portal';
  saveState(); updateAll(); renderOffseason();
}

export function finishRetention() {
  var n = retentionPending();
  if (n) { toast('Decide on ' + n + ' more NIL request' + (n > 1 ? 's' : '') + ' first'); return false; }
  var r = G.retention || { asks: [] };
  var kept = r.asks.filter(function(a) { return a.decision === 'keep'; });
  var gone = r.asks.filter(function(a) { return a.decision === 'go'; });
  if (kept.length) addLog('ev', G.gi, 'Retention: kept ' + kept.map(function(a) { return a.name; }).join(', ') + ' for ' + kept.reduce(function(s, a) { return s + a.ask; }, 0) + ' NIL.');
  if (gone.length) addLog('ev', G.gi, 'Entering the transfer portal: ' + gone.map(function(a) { return a.name; }).join(', ') + '.');
  openPortal();
  return true;
}
window.finishRetention = finishRetention;

// We need to call genRecruits from season.js — use window bridge
function genRecruitsFn() { if (window._genRecruits) window._genRecruits(); }

// ═══════════════════════════════════════════════════════════
//  STAGE RESOLUTION — early-decision rounds (stages 1→2, 2→3)
//  Only a fraction of the most-contended board decides each stage;
//  heavily-leading targets can sign early (never guaranteed).
//  Signing Day (stage 3) resolves everyone via the final logic.
// ═══════════════════════════════════════════════════════════

function userPctOf(r) {
  var schools = getSchoolChances(r);
  for (var i = 0; i < schools.length; i++) if (schools[i].isUser) return schools[i].pct;
  return 0;
}

function refundRecruitPoints(r) {
  // Points on a decided recruit flow back to the budget automatically:
  // recalcSpent only counts open recruits.
  r.points = 0;
  delete r._schools; delete r._schoolsPhase;
}

function cpuWeightedSign(r) {
  var schools = getSchoolChances(r).filter(function(s) { return !s.isUser; });
  if (!schools.length) return null;
  var tot = 0, i;
  for (i = 0; i < schools.length; i++) tot += schools[i].bid;
  var roll = Math.random() * tot, acc = 0, win = schools[0];
  for (i = 0; i < schools.length; i++) { acc += schools[i].bid; if (roll <= acc) { win = schools[i]; break; } }
  return win;
}

// Late risers: if the user's class is thin on Signing Day, 2 unheralded
// recruits emerge that they can take a flier on.
function maybeLateRecruits() {
  var commits = G.recruits.filter(function(r) { return r.status === 'committed'; }).length;
  var pursuits = G.recruits.filter(function(r) { return r.status === 'open' && (r.points || 0) > 0; }).length;
  if (!Battle.boardIsThin(commits, pursuits)) return;
  var maxId = 0, maxRank = 0;
  G.recruits.forEach(function(r) { if (r.id > maxId) maxId = r.id; if (r.natRank > maxRank) maxRank = r.natRank; });
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var weakPool = ranked.slice(Math.floor(ranked.length / 2));
  for (var i = 0; i < weakPool.length - 1; i++) {
    var k = ri(0, weakPool.length - 1 - i) + i, tmp = weakPool[i];
    weakPool[i] = weakPool[k]; weakPool[k] = tmp;
  }
  var POSL = ['PG', 'SG', 'SF', 'PF', 'C'];
  for (var n = 0; n < 2; n++) {
    var ovr = ri(66, 76);
    var p = genPlayer(ovr, POSL[ri(0, 4)], 'FR');
    p.id = maxId + 1 + n;
    p.stars = 3;
    p.interest = ri(10, 25);
    p.signed = -1; p.points = 0; p.status = 'open';
    p.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
    p.natRank = maxRank + 1 + n;
    p.posRank = 999;
    p.late = true;
    p.rivals = weakPool.slice(0, 3).map(function(t) { return { tid: t.id, name: t.name }; });
    G.recruits.push(p);
  }
  addLog('ev', G.gi, 'Two late risers emerge — unheralded prospects now available.');
  toast('Late risers: 2 new recruits available.', 'var(--blu)');
}

export function advanceRecruitPhase() {
  var phase = PHASES[G.recruitPhase]; if (!phase || phase.final) return;
  // Snapshot trends BEFORE the phase++ raises cpuAgg, so Vibe Check
  // shows real movement.
  G.recruits.forEach(function(r) {
    if (r.status === 'open') r._prevPct = userPctOf(r);
  });
  beginReport('recruit', 'Recruiting, ' + phase.name.toLowerCase());
  var res = Battle.runEarlyRound({
    targets: G.recruits,
    isOpen: function(r) { return r.status === 'open'; },
    decideFrac: phase.decideFrac,
    invested: function(r) { return (r.points || 0) > 0; },
    userLead: function(r) {
      var schools = getSchoolChances(r), user = null, best = 0, i;
      for (i = 0; i < schools.length; i++) {
        if (schools[i].isUser) user = schools[i];
        else best = Math.max(best, schools[i].pct);
      }
      return user ? user.pct - best : 0;
    },
    contention: function(r) { return (r.points || 0) + r.interest; },
    cpuLead: function(r) {
      var schools = getSchoolChances(r).filter(function(s) { return !s.isUser; });
      var tot = 0, i;
      for (i = 0; i < schools.length; i++) tot += schools[i].bid;
      if (tot <= 0) return 0;
      if (schools.length < 2) return 100;
      return (schools[0].bid - schools[1].bid) / tot * 100;
    },
    userSign: function(r) {
      if (openSpots() <= 0) { // no room: he goes elsewhere, points come back
        noteSigning('recruit', r, 'full');
        var w0 = cpuWeightedSign(r);
        r.signed = w0 ? w0.tid : -1; r.status = 'gone'; r.goneTo = w0 ? w0.name : '';
        refundRecruitPoints(r);
        return;
      }
      noteSigning('recruit', r, 'you', null, true);
      r.signed = G.tid; r.status = 'committed';
      refundRecruitPoints(r);
      addLog('ev', G.gi, r.name + ' (' + r.stars + '★) commits early.');
    },
    cpuSign: function(r) {
      var win = cpuWeightedSign(r);
      if (!win) { r.status = 'gone'; r.signed = -1; return; }
      if ((r.points || 0) > 0 || G.recruitTargets.indexOf(r.id) >= 0) noteSigning('recruit', r, 'other', win.name, true);
      r.signed = win.tid; r.status = 'gone'; r.goneTo = win.name;
      refundRecruitPoints(r);
      addLog('ev', G.gi, r.name + ' (' + r.stars + '★) signed early with <b>' + win.name + '</b>.');
    }
  });
  G.recruitTargets = G.recruitTargets.filter(function(id) { var r = G.recruits.find(function(x) { return x.id === id; }); return r && r.status === 'open'; });
  G.recruits.forEach(function(r) { delete r._schools; delete r._schoolsPhase; });
  recalcSpent();
  G.recruitPhase++;
  // Late risers surface on Signing Day if the class is thin
  if (G.recruitPhase === 3) maybeLateRecruits();
  var parts = [];
  if (res.userSigned.length) parts.push(res.userSigned.length + ' commit' + (res.userSigned.length > 1 ? 's' : '') + ' early');
  if (res.cpuSigned.length) parts.push(res.cpuSigned.length + ' signed elsewhere');
  parts.push(G.recruits.filter(function(r) { return r.status === 'open'; }).length + ' still open');
  toast(Battle.ACQ_STAGES[G.recruitPhase - 1].name + ': ' + parts.join(' · '), res.userSigned.length ? 'var(--grn)' : 'var(--gld)');
  if (G.signings && G.signings.report && G.signings.report.items.length) _tab = 'targets'; // results show in green / red
  saveState(); updateAll(); renderOffseason();
}
window.advanceRecruitPhase = advanceRecruitPhase;

export function resolveRecruitingClass() {
  if (G.offseasonStep === 'signed' || !G.recruits.some(function(r) { return r.status === 'open'; })) return; // already resolved on signing day
  if (G.recruitPhase < 3) { while (G.recruitPhase < 3 && G.recruitPhase > 0) advanceRecruitPhase(); }
  beginReport('recruit', 'Signing day');
  G.recruits.forEach(function(r) {
    if (r.status !== 'open') return;
    var pursued = (r.points || 0) > 0 || G.recruitTargets.indexOf(r.id) >= 0;
    var ub = calcUserBid(r); var schools = calcSchoolChances(r);
    var best = schools.filter(function(s) { return !s.isUser; }).sort(function(a, b) { return b.bid - a.bid; })[0];
    var bb = best ? best.bid : 0;
    if (r.points >= 5 && ub > bb * 0.7 && openSpots() <= 0) { noteSigning('recruit', r, 'full'); if (best) { r.signed = best.tid; r.status = 'gone'; r.goneTo = best.name; } else { r.status = 'gone'; r.signed = -1; } }
    else if (r.points >= 5 && ub > bb * 0.7) { r.signed = G.tid; r.status = 'committed'; noteSigning('recruit', r, 'you'); addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) signs with you.'); }
    else if (best) { r.signed = best.tid; r.status = 'gone'; r.goneTo = best.name; if (pursued) noteSigning('recruit', r, 'other', best.name); }
    else { r.status = 'gone'; r.signed = -1; }
    r.points = 0;
  });
  var tot = G.recruits.filter(function(r) { return r.signed === G.tid; });
  toast('Class finalized: ' + tot.length + ' signee' + (tot.length !== 1 ? 's' : ''), tot.length >= 3 ? 'var(--grn)' : 'var(--gld)');
  G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0; G.recruitTargets = [];
  saveState();
}
window.resolveRecruitingClass = resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  OFFSEASON PROGRESS STRIP (display-only)
// ═══════════════════════════════════════════════════════════
// Thin one-row summary of the offseason step order. Rendered at the top of
// every offseason screen by renderOffseason(). Reads G.offseasonStep — it
// never changes how the step is set.

export function offseasonStrip() {
  var steps = [
    { id: 'recap', label: 'Recap' },

    { id: 'carousel', label: 'Carousel' },
    { id: 'retention', label: 'Departures' },
    { id: 'portal', label: 'Portal' },
    { id: 'recruiting', label: 'Recruiting' },
    { id: 'signed', label: 'Signing day' },
    { id: 'schedule', label: 'Schedule' }
  ];
  var order = { recap: 0, skillpoints: 1, carousel: 2, turnover: 3, retention: 4, portal: 5, recruiting: 6, signed: 7, schedule: 8 };
  var cur = G.offseasonStep;
  var curIdx = order.hasOwnProperty(cur) ? order[cur] : 0;
  if (cur === 'fired') curIdx = 2; // fired interstitial leads into the carousel

  // A fired coach never sees recap or skill points in this run.
  var firedRun = (cur === 'fired') || (typeof isFiredCoach === 'function' && isFiredCoach());

  // Retention only applies when the router actually visits it: the router
  // skips it when buildRetentionAsks() comes back empty. Before that decision
  // is made the step stays visible as upcoming; afterwards we read the
  // stored asks (never re-run buildRetentionAsks here — it mutates state).
  var r = G.retention;
  var retentionHappened = !!(r && r.yr === G.yr && r.asks && r.asks.length);
  function showRetention() { return true; } // departures + retention always has its own screen now

  var h = '<div class="os-strip" aria-label="Offseason progress">';
  var first = true;
  steps.forEach(function(s) {
    if (s.id === 'recap' && firedRun) return;
    if (s.id === 'skillpoints' && firedRun) return;
    if (s.id === 'retention' && !showRetention()) return;
    var idx = order[s.id];
    var cls = idx < curIdx ? 'os-step done' : idx === curIdx ? 'os-step current' : 'os-step upcoming';
    var label = idx < curIdx ? '✓ ' + s.label : s.label;
    if (!first) h += '<span class="os-sep" aria-hidden="true">›</span>';
    h += '<span class="' + cls + '">' + label + '</span>';
    first = false;
  });
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content'); if (!el) return;

  // Route to correct screen
  if (G.offseasonStep === 'fired') { el.innerHTML = offseasonStrip() + renderFired(); bindOffseason(el); return; }

  if (G.offseasonStep === 'recap') {
    if (window._renderSeasonRecap) { el.innerHTML = offseasonStrip() + window._renderSeasonRecap(); bindOffseason(el); }
    else el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt3);">Season recap loading...</div>';
    return;
  }

  if (G.offseasonStep === 'skillpoints') { el.innerHTML = offseasonStrip() + renderSkillPoints(); bindOffseason(el); return; }

  if (G.offseasonStep === 'carousel') { el.innerHTML = offseasonStrip() + renderCarousel(); bindOffseason(el); return; }

  if (G.offseasonStep === 'retention') { el.innerHTML = offseasonStrip() + renderRetention(); bindOffseason(el); return; }

  if (G.offseasonStep === 'portal') { el.innerHTML = offseasonStrip() + renderPortal(); bindOffseason(el); return; }

  if (G.offseasonStep === 'signed') { el.innerHTML = offseasonStrip() + signingDayHTML(); bindOffseason(el); return; }

  if (G.offseasonStep === 'schedule') { el.innerHTML = offseasonStrip() + renderNCSchedule(); bindOffseason(el); Acq.refreshSheet(); return; }

  if (G.offseasonStep === 'turnover' || !G.offseasonStep) { el.innerHTML = offseasonStrip() + renderTurnover(); bindOffseason(el); return; }

  initRecruitingIfNeeded();
  var phase = PHASES[G.recruitPhase] || PHASES[1];
  var left = G.recruitingBudget - G.recruitingSpent;
  var commits = G.recruits.filter(function(r) { return r.status === 'committed'; });
  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var h = '';

  // Shared acquisition layout (views/acq.js): slim header, tabs, list, sticky button
  var sp0 = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var spots = openSpots();
  h += Acq.header('Recruiting', phase.tag + ' · ' + phase.name, [
    { v: left, l: 'points', attr: 'data-budget-left' }, { v: sp0, l: 'prestige' }, { v: spots, l: 'open spot' + (spots !== 1 ? 's' : '') }]);
  var classN = G.recruits.filter(function(r) { return r.signed === G.tid; }).length;
  if (_tab !== 'board' && _tab !== 'targets' && _tab !== 'roster') _tab = 'board';
  h += Acq.tabs([
    { id: 'board', label: 'Board', n: open.length },
    { id: 'targets', label: 'Targets', n: pursuing() + classN },
    { id: 'roster', label: 'Roster' }], _tab);

  if (_tab === 'board') h += renderBoard(open, left);
  else if (_tab === 'targets') h += targetsHTML('recruit', renderTargets(left), pursuing());
  else h += Acq.rosterTabHTML();

  h += Acq.sticky('data-phase-advance', phase.btnLabel);
  Acq.refreshSheet();

  el.innerHTML = offseasonStrip() + h;
  bindOffseason(el);
}

function phaseDots() {
  var h = '';
  for (var pi = 1; pi <= 3; pi++) {
    var ds = pi < G.recruitPhase ? 'done' : pi === G.recruitPhase ? 'active' : 'future';
    var db = ds === 'done' ? 'var(--grn)' : ds === 'active' ? 'var(--blu)' : 'var(--bdr2)';
    h += '<div class="phase-dot" style="background:' + db + ';"></div>';
  }
  return h;
}

// Final phase button resolves through window.doOffseason (main.js),
// matching the old inline onclick="doOffseason()" behavior.
// ═══════════════════════════════════════════════════════════
//  NON-CONFERENCE SCHEDULE — every offseason, after signing day.
//  G.ncPicks (10 team ids) is used by doOffseason when it builds
//  next season's schedule; tap a game to swap the opponent.
// ═══════════════════════════════════════════════════════════
var _ncSlot = 0, _ncBand = 'all';

export function toSchedule() {
  var ok = Array.isArray(G.ncPicks) && G.ncPicks.length === 10;
  if (!ok && window._pickBalancedOOC) G.ncPicks = window._pickBalancedOOC();
  G.offseasonStep = 'schedule';
  saveState(); updateAll(); renderOffseason();
}
window.toSchedule = toSchedule;

function ncEdge(opp) {
  var d = getTOvr(opp) - getTOvr(G.teams[G.tid]);
  return d >= 4 ? { l: 'Tough', c: 'var(--red)' } : d >= -4 ? { l: 'Even', c: 'var(--gld2)' } : { l: 'Easier', c: 'var(--grn2)' };
}

function renderNCSchedule() {
  var t = G.teams[G.tid];
  var picks = G.ncPicks || [];
  var counts = { Tough: 0, Even: 0, Easier: 0 };
  picks.forEach(function(id) { if (G.teams[id]) counts[ncEdge(G.teams[id]).l]++; });
  var h = Acq.header('Non-conference schedule', 'Season ' + (G.yr + 1) + ' · 10 games before ' + t.conf + ' play',
    [{ v: counts.Tough, l: 'tough' }, { v: counts.Even, l: 'even' }, { v: counts.Easier, l: 'easier' }]);
  h += '<div class="acq-tool"><span class="sec-sub" style="margin:0;">Tap a game to swap the opponent. Overall ratings are this season\'s.</span>'
    + '<button class="acq-filter-btn" style="margin-left:auto;" data-nc-auto>Auto-pick again</button></div>';
  h += '<div class="acq-list">';
  picks.forEach(function(id, i) {
    var o = G.teams[id]; if (!o) return;
    var e = ncEdge(o);
    h += Acq.row({ open: 'data-nc-swap="' + i + '"',
      name: o.name, sub: (i % 2 === 0 ? 'Home' : 'Away') + ' · ' + o.conf + ' · ' + o.wins + '-' + o.loss + ' this season',
      big: getTOvr(o), small: '<span style="color:' + e.c + ';">' + e.l + '</span>' });
  });
  h += '</div>';
  h += Acq.sticky('data-start-season', 'Start the ' + (G.yr + 1) + ' season');
  return h;
}

function ncSwapSheet() {
  var me = G.teams[G.tid], cur = G.teams[(G.ncPicks || [])[_ncSlot]];
  var pool = G.teams.filter(function(t) { return t.conf !== me.conf && t.id !== G.tid && (G.ncPicks || []).indexOf(t.id) < 0; })
    .filter(function(t) { return _ncBand === 'all' || ncEdge(t).l === _ncBand; })
    .sort(function(a, b) { return getTOvr(b) - getTOvr(a); });
  var h = '<div class="pp-note" style="margin-bottom:8px;">Replacing ' + (cur ? '<b>' + cur.name + '</b>' : 'this game') + ' (' + (_ncSlot % 2 === 0 ? 'home' : 'away') + ').</div>'
    + '<input class="setup-input" data-nc-search placeholder="Search schools or conferences" autocomplete="off" style="width:100%;margin-bottom:8px;">'
    + '<div class="fbar">';
  [['all', 'All'], ['Tough', 'Tough'], ['Even', 'Even'], ['Easier', 'Easier']].forEach(function(b) {
    h += '<button class="fchip' + (_ncBand === b[0] ? ' on' : '') + '" data-nc-band="' + b[0] + '">' + b[1] + '</button>';
  });
  h += '</div><div class="acq-list">';
  pool.forEach(function(o) {
    var e = ncEdge(o);
    h += '<div class="acq-row" data-nc-pick="' + o.id + '" data-nc-name="' + (o.name + ' ' + o.conf).toLowerCase().replace(/"/g, '') + '" role="button" tabindex="0">'
      + '<div class="acq-main"><div class="acq-name">' + o.name + '</div><div class="acq-sub">' + o.conf + ' · ' + o.wins + '-' + o.loss + '</div></div>'
      + '<div class="acq-right"><div class="acq-big">' + getTOvr(o) + '</div><div class="acq-small" style="color:' + e.c + ';">' + e.l + '</div></div></div>';
  });
  return { title: 'Swap opponent', html: h + '</div>' };
}
Acq.registerSheet('nc-swap', ncSwapSheet);

function pickNC(id) {
  if (!G.ncPicks) return;
  G.ncPicks[_ncSlot] = id;
  saveState();
  closeSheet();
  renderOffseason();
}

// ═══════════════════════════════════════════════════════════
//  HEADS-UP BEFORE MOVING ON — first tap warns, second tap goes ahead
// ═══════════════════════════════════════════════════════════
var _warnKey = '';
function moveOnIssue() {
  var step = G.offseasonStep, t = G.teams[G.tid];
  if (G.phase !== 'offseason') return null;
  var nextN = function() {
    var inPortal = (G.portalEntrants || []).filter(function(e) { return e.fromTid === G.tid && e.pickedBy === -1; }).length;
    var ret = (t.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs); }).length - inPortal;
    return ret + (G.recruits || []).filter(function(r) { return r.signed === G.tid; }).length;
  };
  if (step === 'portal' && (G.portalStage || 0) >= 2) { // decision day only
    var offers = (G.portalEntrants || []).filter(function(e) { return e.fromTid !== G.tid && (e.offer || 0) > 0; }).length;
    var open = 15 - nextN();
    if (!offers && open >= 2 && (G.pts || 0) >= 100) return 'You have ' + open + ' open roster spots and no transfer offers out.';
  }
  if ((step === 'recruiting' || (!step && G.recruitPhase)) && (PHASES[G.recruitPhase] || {}).final) { // signing day only
    var left = (G.recruitingBudget || 0) - (G.recruitingSpent || 0);
    var open2 = 15 - nextN();
    if (open2 >= 1 && left >= 20) return 'You have ' + left + ' recruiting points unspent and ' + open2 + ' open spot' + (open2 > 1 ? 's' : '') + '.';
  }
  if (step === 'schedule') {
    var r = window._nextRoster ? window._nextRoster() : [];
    var missing = ['PG', 'SG', 'SF', 'PF', 'C'].filter(function(pos) { return !r.some(function(x) { return x.pos === pos; }); });
    if (missing.length) return 'Next season you have no ' + missing.join(' or ') + ' on the roster.';
    if (r.length < 10) return 'Next season you only have ' + r.length + ' players. Walk-ons will fill the rest.';
  }
  return null;
}
// true = warned now (stop); false = fine to continue.
// The heads-up is a small dialog (a toast was easy to miss, so the first tap
// looked like it did nothing). "Continue anyway" runs onContinue.
export function moveOnWarning(onContinue) {
  var msg = moveOnIssue();
  if (!msg) { _warnKey = ''; return false; }
  var key = (G.offseasonStep || '') + ':' + (G.portalStage || 0) + ':' + (G.recruitPhase || 0) + ':' + msg;
  if (_warnKey === key) { _warnKey = ''; return false; }
  _warnKey = key;
  if (typeof document === 'undefined' || !document.body || !document.createElement) {
    toast(msg + ' Tap again to continue anyway.', 'var(--gld)');
    return true;
  }
  var old = document.getElementById('mo-ov'); if (old) old.parentNode.removeChild(old);
  var ov = document.createElement('div');
  ov.id = 'mo-ov'; ov.className = 'mo-ov';
  ov.innerHTML = '<div class="panel mo-p" role="alertdialog" aria-label="Before you move on"><div class="panel-h"><span>Before you move on</span></div>'
    + '<div class="panel-b"><div class="mo-msg"></div><div class="big-btn-row" style="margin:0;">'
    + '<button class="btn-big secondary" data-mo="back">Go back</button>'
    + '<button class="btn-big" data-mo="go">Continue anyway</button></div></div></div>';
  ov.querySelector('.mo-msg').textContent = msg;
  document.body.appendChild(ov);
  var close = function() { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('[data-mo]');
    if (e.target === ov || (b && b.getAttribute('data-mo') === 'back')) { _warnKey = ''; close(); return; }
    if (b && b.getAttribute('data-mo') === 'go') { close(); if (onContinue) onContinue(); _warnKey = ''; }
  });
  var go = ov.querySelector('[data-mo="go"]'); if (go && go.focus) go.focus();
  return true;
}
window._moveOnWarning = moveOnWarning;

// Signing day: resolve the class and show the results before the season starts
export function finishSigningDay() {
  resolveRecruitingClass();
  G.offseasonStep = 'signed';
  saveState(); updateAll(); renderOffseason();
}
window.finishSigningDay = finishSigningDay;

function phaseAdvance() {
  if (G.offseasonStep === 'signed') { toSchedule(); return; }
  if (G.offseasonStep === 'schedule') {
    if (typeof window !== 'undefined' && window.doOffseason) window.doOffseason();
  } else if ((PHASES[G.recruitPhase] || {}).final) {
    finishSigningDay();
  } else {
    advanceRecruitPhase();
  }
}

// ═══════════════════════════════════════════════════════════
//  EVENT DELEGATION — one container-level handler for the
//  whole offseason view (recruiting + portal HTML)
// ═══════════════════════════════════════════════════════════

Acq.setSheetBinder(function(el) { bindOffseason(el); });

function bindOffseason(el) {
  el.onclick = function(e) {
    var q = function(sel) { return e.target.closest ? e.target.closest(sel) : null; };
    var m;
    // Tap-target rule (Job 5): buttons inside a row (steppers, Target,
    // Withdraw, Drop, Close, chips) are ALL matched before the row
    // selectors below, and each branch returns early. That ordering is
    // the stopPropagation equivalent — a button tap can never fall
    // through to the row's open/close-detail handler. Keep it that way:
    // any new in-row button selector goes above [data-pdetail]/[data-rid].
    // Shared acquisition layout (views/acq.js) — portal and recruiting
    var onPortal = G.offseasonStep === 'portal';
    if ((m = q('[data-pptab]'))) { Acq.setPageTab(m.getAttribute('data-pptab')); return; }
    if ((m = q('[data-acqtab]'))) { var _t = m.getAttribute('data-acqtab'); if (onPortal) setPortalTab(_t); else setRecruitTab(_t); return; }
    if (q('[data-acq-filter]')) { if (onPortal) openPortalFilter(); else openRecruitFilter(); return; }
    if ((m = q('[data-acq-clear]'))) { if (onPortal) clearPortalFilter(m.getAttribute('data-acq-clear')); else clearRecruitFilter(m.getAttribute('data-acq-clear')); return; }
    if ((m = q('[data-pt-dec]'))) { adjustPoints(parseInt(m.getAttribute('data-pt-dec'), 10), -5); return; }
    if ((m = q('[data-pt-inc]'))) { adjustPoints(parseInt(m.getAttribute('data-pt-inc'), 10), 5); return; }
    if ((m = q('[data-add-target]'))) { addTarget(parseInt(m.getAttribute('data-add-target'), 10)); return; }
    if ((m = q('[data-rem-target]'))) { removeTarget(parseInt(m.getAttribute('data-rem-target'), 10)); return; }
    if (q('[data-close-detail]')) { closeDetail(); return; }
    if ((m = q('[data-rtab]'))) { setRecruitTab(m.getAttribute('data-rtab')); return; }
    if (q('[data-phase-advance]')) { if (!moveOnWarning(phaseAdvance)) phaseAdvance(); return; }
    if (q('[data-proceed-portal]')) { proceedToRecruiting(); return; }
    if (q('[data-start-season]')) { if (!moveOnWarning(function() { if (window.doOffseason) window.doOffseason(); }) && window.doOffseason) window.doOffseason(); return; }
    if (q('[data-to-schedule]')) { toSchedule(); return; }
    if (q('[data-nc-auto]')) { G.ncPicks = window._pickBalancedOOC ? window._pickBalancedOOC() : G.ncPicks; saveState(); renderOffseason(); return; }
    if ((m = q('[data-nc-band]'))) { _ncBand = m.getAttribute('data-nc-band'); Acq.refreshSheet(); return; }
    if ((m = q('[data-nc-pick]'))) { pickNC(parseInt(m.getAttribute('data-nc-pick'), 10)); return; }
    if ((m = q('[data-nc-swap]'))) { _ncSlot = parseInt(m.getAttribute('data-nc-swap'), 10); _ncBand = 'all'; Acq.openPage('nc-swap', _ncSlot); return; }
    if ((m = q('[data-ret]'))) {
      var _rr = decideRetention(parseInt(m.getAttribute('data-ri'), 10), m.getAttribute('data-ret'));
      if (_rr.msg) toast(_rr.msg);
      if (_rr.ok) { saveState(); updateAll(); renderOffseason(); }
      return;
    }
    if (q('[data-ret-done]')) { finishRetention(); return; }
    if ((m = q('[data-skill-dec]'))) { deallocateSkillPoint(m.getAttribute('data-skill-dec')); return; }
    if ((m = q('[data-rctab]'))) { if (window._setRecapTab) window._setRecapTab(m.getAttribute('data-rctab')); renderOffseason(); return; }
    if ((m = q('[data-skill-inc]'))) { allocateSkillPoint(m.getAttribute('data-skill-inc')); return; }
    if (q('[data-finish-skills]')) { finishSkillPoints(); return; }
    if ((m = q('[data-apply-job]'))) { applyForJob(parseInt(m.getAttribute('data-apply-job'), 10)); return; }
    if (q('[data-stay]')) { stayAtSchool(); return; }
    if (q('[data-fired-go]')) { proceedFromFired(); return; }
    // Portal rows (portal.js HTML lives in this container)
    if ((m = q('[data-poff-dec]'))) { adjustOffer(parseInt(m.getAttribute('data-poff-dec'), 10), -PORTAL_OFFER_STEP); return; }
    if ((m = q('[data-poff-inc]'))) { adjustOffer(parseInt(m.getAttribute('data-poff-inc'), 10), PORTAL_OFFER_STEP); return; }
    if ((m = q('[data-ppivot]'))) { pivotOffer(parseInt(m.getAttribute('data-ppivot'), 10)); return; }
    if ((m = q('[data-pfilter]'))) { setPortalFilter(m.getAttribute('data-pfilter'), m.getAttribute('data-pval')); return; }
    if (q('[data-pstage]')) { if (!moveOnWarning(advancePortalStage)) advancePortalStage(); return; }
    if ((m = q('[data-pdetail]'))) { togglePortalDetail(parseInt(m.getAttribute('data-pdetail'), 10)); return; }
    if ((m = q('[data-rfchip]'))) {
      var fk = m.getAttribute('data-rfchip'), fv = m.getAttribute('data-rval');
      if (fk === 'show' || fk === 'sortsel') { setRecruitFilter(fk, fv); return; }
      if (fk === 'sort') {
        if (_filter.sort === fv) _filter.dir = -(_filter.dir || 1);
        else { _filter.sort = fv; _filter.dir = (fv === 'rank' || fv === 'name' || fv === 'pos') ? 1 : -1; }
      } else if (fk === 'near' || fk === 'targets') _filter[fk] = !_filter[fk];
      else _filter[fk] = fk === 'stars' ? parseInt(fv, 10) : fv;
      setUiPrefs('recruiting', _filter);
      renderOffseason(); return;
    }
    // Rows → player page (checked last; buttons above always win)
    if ((m = q('[data-acq-open-p]'))) { openPortalPage(parseInt(m.getAttribute('data-acq-open-p'), 10)); return; }
    if ((m = q('[data-acq-open-r]'))) { openRecruitPage(parseInt(m.getAttribute('data-acq-open-r'), 10)); return; }
    if ((m = q('[data-rid]'))) { openRecruitPage(parseInt(m.getAttribute('data-rid'), 10)); return; }
  };
  el.oninput = function(e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-nc-search')) {
      var f = e.target.value.toLowerCase();
      el.querySelectorAll('[data-nc-pick]').forEach(function(r) { r.style.display = !f || r.getAttribute('data-nc-name').indexOf(f) >= 0 ? '' : 'none'; });
    }
  };
  el.onchange = function(e) {
    var ps = e.target.closest ? e.target.closest('[data-pselect]') : null;
    if (ps) { setPortalFilter(ps.getAttribute('data-pselect'), ps.value); return; }
    var m = e.target.closest ? e.target.closest('[data-rfilter]') : null;
    if (m) {
      var key = m.getAttribute('data-rfilter');
      setRecruitFilter(key, key === 'stars' ? parseInt(m.value, 10) : m.value);
    }
  };
  el.onkeydown = function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); e.target.click();
    }
  };
}

// ═══════════════════════════════════════════════════════════
//  IN-PLACE UPDATES for +/- steppers (no full re-render)
// ═══════════════════════════════════════════════════════════

function setStepperState(el, sel, on) {
  var b = el.querySelector(sel);
  if (!b) return;
  if (b.classList) b.classList.toggle('off', !on);
  b.setAttribute('aria-disabled', on ? 'false' : 'true');
}

function updateRecruitRow(rid) {
  var el = ge('offseason-content');
  if (!el || !el.querySelectorAll || !el.querySelector) return;
  var r = G.recruits.find(function(x) { return x.id === rid; });
  var left = G.recruitingBudget - G.recruitingSpent;

  // Points labels (detail panel + targets tab)
  var labs = el.querySelectorAll('[data-pts-val="' + rid + '"]');
  for (var i = 0; i < labs.length; i++) labs[i].textContent = r ? (r.points || 0) : 0;

  // Stepper enabled states
  setStepperState(el, '[data-pt-dec="' + rid + '"]', !!(r && (r.points || 0) >= 5));
  setStepperState(el, '[data-pt-inc="' + rid + '"]', left >= 5);

  // Budget readouts
  var bl = el.querySelectorAll('[data-budget-left]');
  for (var j = 0; j < bl.length; j++) {
    bl[j].textContent = left;
    bl[j].style.color = left > 30 ? 'var(--grn2)' : left > 0 ? 'var(--gld2)' : 'var(--red)';
  }

  // School race bars + user % (recomputed from the new bid)
  if (r) {
    var sc = el.querySelector('[data-schools-for="' + rid + '"]');
    if (sc) sc.innerHTML = schoolRaceHTML(r, sc.getAttribute('data-schools-n') === '3' ? 3 : 0);
    var up = el.querySelector('[data-user-pct="' + rid + '"]');
    if (up) {
      var schools = getSchoolChances(r), us = null;
      for (var k = 0; k < schools.length; k++) if (schools[k].isUser) us = schools[k];
      up.textContent = (us ? us.pct : 0) + '%';
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  SHARED PIECES
// ═══════════════════════════════════════════════════════════

function starStr(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606'; return s; }

function geoBadges(r, sp) {
  var h = '';
  var userGeo = getGeoLabel(getTeamState(G.teams[G.tid]), r.homeState);
  if (userGeo === 'HOME') h += '<span class="tag t-ok">Home</span>';
  else if (userGeo === 'REGION') h += '<span class="tag t-home">Region</span>';
  var gatePrestige = SCHOOL_RECRUIT_GATES[r.stars] || 0;
  if (sp < gatePrestige) h += '<span class="tag t-rival">Long shot</span>';
  return h;
}

// School race bars; n=0 → all schools, n=3 → top 3 (targets tab)
function schoolRaceHTML(r, n) {
  var schools = getSchoolChances(r);
  var list = n ? schools.slice(0, n) : schools;
  if (!list.length) return '<div style="font-size:12px;color:var(--txt3);font-style:italic;">Add to targets to see the competition.</div>';
  var h = '';
  list.forEach(function(s) {
    var barCol = s.isUser ? 'var(--blu)' : 'var(--bdr2)';
    var nameCol = s.isUser ? 'var(--blu)' : 'var(--txt2)';
    var geo = s.geo ? ' <span style="font-size:9px;color:' + (s.geo === 'HOME' ? 'var(--grn2)' : 'var(--blu)') + ';font-weight:800;">' + s.geo + '</span>' : '';
    h += '<div class="school-row">'
      + '<div class="school-name" style="color:' + nameCol + ';font-weight:' + (s.isUser ? '800' : '600') + ';">' + s.name + geo + '</div>'
      + '<div class="school-bar"><div class="school-fill" style="width:' + s.pct + '%;background:' + barCol + ';"></div></div>'
      + '<div class="school-pct" style="color:' + (s.isUser ? 'var(--blu)' : 'var(--txt3)') + ';">' + s.pct + '%</div></div>';
  });
  return h;
}

// +/- stepper row (compact). kind: 'detail' | 'target'
function stepperRow(r, left, removable) {
  var pts = r.points || 0;
  var h = '<div style="display:flex;align-items:center;gap:6px;">'
    + '<button class="stepper' + (pts >= 5 ? '' : ' off') + '" data-pt-dec="' + r.id + '" aria-label="Remove 5 points from ' + r.name + '" aria-disabled="' + (pts >= 5 ? 'false' : 'true') + '">−</button>'
    + '<div class="pts-val" data-pts-val="' + r.id + '">' + pts + '</div>'
    + '<button class="stepper plus' + (left >= 5 ? '' : ' off') + '" data-pt-inc="' + r.id + '" aria-label="Add 5 points to ' + r.name + '" aria-disabled="' + (left >= 5 ? 'false' : 'true') + '">+</button>'
    + '<span style="font-size:11px;color:var(--txt3);">points</span>'
    + '<div style="flex:1;"></div>';
  if (removable) h += '<button class="btn-quiet btn-sm" style="min-height:28px;padding:4px;" data-rem-target="' + r.id + '" aria-label="Drop ' + r.name + '">Drop</button>';
  return h + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  TURNOVER SCREEN
// ═══════════════════════════════════════════════════════════

function renderTurnover() {
  var dep = G.departingPlayers || [];
  var t = G.teams[G.tid];
  var returning = t.rost.filter(function(p) {
    return !dep.some(function(d) { return d.name === p.name; });
  });
  var openSpots = Math.max(0, 13 - returning.length);
  var lostMins = dep.reduce(function(s, d) { return s + (d.mins || 0); }, 0);

  // Position needs
  var posCount = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  returning.forEach(function(p) { if (posCount.hasOwnProperty(p.pos)) posCount[p.pos]++; });
  var needs = [];
  Object.keys(posCount).forEach(function(pos) { if (posCount[pos] < 2) needs.push(pos); });

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Roster turnover</div>'
    + '<div class="sec-sub">Offseason ' + G.yr + ' · ' + t.name + ' — review departures before recruiting</div></div>';

  h += '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);">'
    + '<div class="stat-cell"><div class="sv" style="color:var(--red);">' + dep.length + '</div><div class="sl">Departing</div></div>'
    + '<div class="stat-cell"><div class="sv" style="color:var(--grn2);">' + returning.length + '</div><div class="sl">Returning</div></div>'
    + '<div class="stat-cell"><div class="sv" style="color:var(--gld2);">' + openSpots + '</div><div class="sl">Open spots</div></div>'
    + '<div class="stat-cell"><div class="sv">' + lostMins + '</div><div class="sl">Mins to replace</div></div></div>';

  if (needs.length) {
    h += '<div class="sec-sub" style="margin-bottom:14px;">Position needs: ' + needs.join(', ') + ' — target these in recruiting</div>';
  }

  h += '<div class="grid-2">';

  // Departing — dense panel table
  h += '<div class="panel"><div class="panel-h"><span>Departing</span><small>' + dep.length + ' player' + (dep.length !== 1 ? 's' : '') + '</small></div>';
  if (dep.length) {
    h += '<div class="panel-b flush"><table>'
      + '<thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="num">OVR</th><th>Status</th></tr></thead><tbody>';
    dep.forEach(function(d) {
      var reasonCol = d.reason === 'Graduated' ? 'var(--txt3)' : 'var(--gld2)';
      h += '<tr><td><div style="font-weight:600;">' + d.name + '</div>'
        + '<div style="font-size:11px;color:var(--txt3);">' + d.ppg + ' PPG · ' + d.rpg + ' RPG · ' + (d.apg || '0.0') + ' APG · ' + d.mins + ' min</div></td>'
        + '<td style="color:var(--txt3);">' + d.pos + '</td>'
        + '<td style="color:var(--txt3);">' + d.cls + '</td>'
        + '<td class="num">' + d.ovr + '</td>'
        + '<td><span style="color:' + reasonCol + ';font-size:12px;">' + d.reason + '</span></td></tr>';
    });
    h += '</tbody></table></div>';
  } else {
    h += '<div class="panel-b"><div class="empty-state" style="padding:20px;">No players departing. Full squad returning.</div></div>';
  }
  h += '</div>';

  // Returning — FULL roster, no truncation; dense panel table
  returning.sort(function(a, b) { return b.ovr - a.ovr; });
  h += '<div class="panel"><div class="panel-h"><span>Returning</span><small>' + returning.length + ' player' + (returning.length !== 1 ? 's' : '') + '</small></div>'
    + '<div class="panel-b flush"><table>'
    + '<thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="num">OVR</th><th class="num">POT</th></tr></thead><tbody>';
  returning.forEach(function(p) {
    var gp = p.s.gp || 0;
    var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
    var rpg = gp ? (p.s.reb / gp).toFixed(1) : '--';
    var apg = gp ? (p.s.ast / gp).toFixed(1) : '--';
    var pot = p.pot || p.ovr;
    h += '<tr><td><div style="font-weight:600;">' + p.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + ppg + ' PPG · ' + rpg + ' RPG · ' + apg + ' APG · ' + p.mins + ' min</div></td>'
      + '<td style="color:var(--txt3);">' + p.pos + '</td>'
      + '<td style="color:var(--blu);">' + p.cls + '</td>'
      + '<td class="num">' + p.ovr + '</td>'
      + '<td class="num" style="color:var(--txt3);">' + pot + '</td></tr>';
  });
  h += '</tbody></table></div></div>';

  h += '</div>'; // close grid-2

  h += '<div class="big-btn-row"><button class="btn-big btn-full" data-proceed-portal>Continue</button></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  FIRED SCREEN
// ═══════════════════════════════════════════════════════════

function renderFired() {
  var c = G.coach;
  var lastJob = c.history.length ? c.history[c.history.length - 1] : null;
  var schoolName = lastJob ? lastJob.school : 'your school';
  var record = lastJob ? lastJob.wins + '-' + lastJob.loss : '?-?';

  var h = '<div style="max-width:600px;margin:0 auto;">'
    + '<div style="margin-bottom:12px;"><div class="sec-head">Contract terminated</div>'
    + '<div class="sec-sub">' + schoolName + ' has relieved you of your duties after a ' + record + ' season.</div></div>';

  h += '<div class="panel"><div class="panel-h"><span>Coach ' + c.firstName + ' ' + c.lastName + '</span></div>'
    + '<div class="panel-b">'
    + '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);margin-bottom:0;">'
    + '<div class="stat-cell"><div class="sv">' + c.age + '</div><div class="sl">Age</div></div>'
    + '<div class="stat-cell"><div class="sv">' + c.careerWins + '-' + c.careerLoss + '</div><div class="sl">Career</div></div>'
    + '<div class="stat-cell"><div class="sv">' + (c.titles || 0) + '</div><div class="sl">Titles</div></div>'
    + '<div class="stat-cell"><div class="sv">' + c.history.length + '</div><div class="sl">Seasons</div></div>'
    + '</div></div></div>';

  h += '<div class="sec-sub" style="margin-bottom:16px;">Your reputation has taken a hit. Fewer schools will be interested, but there\'s always a program looking for a fresh start.</div>'
    + '<div class="big-btn-row"><button class="btn-big btn-full" data-fired-go>Find a new job</button></div>'
    + '</div>';
  return h;
}

export function proceedFromFired() {
  // Skip skill points (you got fired, no development)
  // Go straight to carousel with limited options
  G.offseasonStep = 'carousel';
  _rejectedJobs = [];
  // Temporarily reduce coach ratings as firing penalty
  G.coach.off = Math.max(50, G.coach.off - 3);
  G.coach.def = Math.max(50, G.coach.def - 3);
  G.coach.dev = Math.max(50, G.coach.dev - 3);
  G.coach.rec = Math.max(50, G.coach.rec - 3);
  saveState(); renderOffseason();
}
window.proceedFromFired = proceedFromFired;

// ═══════════════════════════════════════════════════════════
//  SKILL POINTS ALLOCATION
// ═══════════════════════════════════════════════════════════

var _skillInitial = null;

// Skill point panel, shown on the season recap (and on the legacy
// skill points screen for old saves parked there)
function skillPanelHTML() {
  var pts = G.skillPointsToSpend || 0;
  var c = G.coach;
  // Snapshot initial values on first render. R7: persisted on G.coach (which
  // saveState serializes whole) so it survives reload; re-derived as a
  // no-deallocate floor if an old save lacks it.
  if (!_skillInitial || !(G.coach && G.coach.skillInitial)) _skillInitial = null; // new season: fresh floor
  if (!_skillInitial) {
    _skillInitial = (G.coach && G.coach.skillInitial) || { off: c.off, def: c.def, dev: c.dev, rec: c.rec };
    if (G.coach) G.coach.skillInitial = _skillInitial;
  }
  var h = '<div class="panel" id="skill-panel"><div class="panel-h"><span>Spend your skill points</span>'
    + '<small><span style="font-weight:600;color:' + (pts > 0 ? 'var(--grn2)' : 'var(--txt3)') + ';">' + pts + '</span> point' + (pts !== 1 ? 's' : '') + ' remaining' + (pts > 0 ? ' · unspent points carry over' : '') + '</small></div>'
    + '<div class="panel-b flush"><table>'
    + '<thead><tr><th>Skill</th><th class="num">Rating</th></tr></thead><tbody>';

  var ratings = [
    { key: 'off', label: 'Offense', desc: 'Boosts your team\u2019s scoring output' },
    { key: 'def', label: 'Defense', desc: 'Reduces opponent scoring' },
    { key: 'dev', label: 'Development', desc: 'Players improve faster in offseason' },
    { key: 'rec', label: 'Recruiting', desc: 'Stronger bids, bigger budget' }
  ];

  ratings.forEach(function(r) {
    var val = c[r.key] || 70;
    var initVal = (_skillInitial && _skillInitial[r.key]) || val;
    var canAdd = pts > 0 && val < 99;
    var canRemove = val > initVal;
    h += '<tr>'
      + '<td><div style="font-weight:600;">' + r.label + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + r.desc + '</div></td>'
      + '<td class="num"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">'
      + '<button class="stepper' + (canRemove ? '' : ' off') + '" data-skill-dec="' + r.key + '" aria-label="Remove point from ' + r.label + '" aria-disabled="' + (canRemove ? 'false' : 'true') + '">−</button>'
      + '<div class="pts-val">' + val + '</div>'
      + '<button class="stepper plus' + (canAdd ? '' : ' off') + '" data-skill-inc="' + r.key + '" aria-label="Add point to ' + r.label + '" aria-disabled="' + (canAdd ? 'false' : 'true') + '">+</button>'
      + '</div></td></tr>';
  });

  h += '</tbody></table></div></div>';
  return h;
}
window._skillPanelHTML = skillPanelHTML;

function renderSkillPoints() {
  return '<div style="max-width:600px;margin:0 auto;">' + skillPanelHTML()
    + '<div class="big-btn-row"><button class="btn-big btn-full" data-finish-skills>Continue</button></div></div>';
}

export function allocateSkillPoint(key) {
  if (G.skillPointsToSpend <= 0) return;
  if (G.coach[key] >= 99) return;
  G.coach[key]++;
  G.skillPointsToSpend--;
  saveState(); renderOffseason();
}
window.allocateSkillPoint = allocateSkillPoint;

export function deallocateSkillPoint(key) {
  var initVal = (_skillInitial && _skillInitial[key]) || 70;
  if (G.coach[key] <= initVal) return;
  G.coach[key]--;
  G.skillPointsToSpend++;
  saveState(); renderOffseason();
}
window.deallocateSkillPoint = deallocateSkillPoint;

export function finishSkillPoints() {
  _skillInitial = null;
  if (G.coach) delete G.coach.skillInitial;
  G.offseasonStep = 'carousel';
  saveState(); renderOffseason();
}
window.finishSkillPoints = finishSkillPoints;

// ═══════════════════════════════════════════════════════════
//  COACHING CAROUSEL
// ═══════════════════════════════════════════════════════════

function generateOpenJobs() {
  // Find CPU teams that underperformed → their coach gets fired
  var openJobs = [];
  G.teams.forEach(function(t) {
    if (t.id === G.tid) return;
    var totalGames = t.wins + t.loss;
    if (totalGames === 0) return;
    var winPct = t.wins / totalGames;
    var expectedWinPct = Math.max(0.2, (t.baseOvr - 50) / 50);
    var underperformed = winPct < expectedWinPct - 0.15;
    var terrible = winPct < 0.35;
    if (terrible || underperformed) {
      openJobs.push({
        team: t,
        firedCoach: t.coach ? t.coach.firstName + ' ' + t.coach.lastName : 'Unknown',
        record: t.wins + '-' + t.loss,
        reason: terrible ? 'Fired (' + t.wins + '-' + t.loss + ')' : 'Underperformed'
      });
    }
  });
  // Shuffle and limit to ~10
  for (var i = openJobs.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = openJobs[i]; openJobs[i] = openJobs[j]; openJobs[j] = tmp;
  }
  return openJobs.slice(0, 12);
}

export function calcOfferChance(job) {
  if (job.guaranteed) return 100;
  var sp = job.team.schoolPrestige || 30;
  var coachAvg = (G.coach.off + G.coach.def + G.coach.dev + G.coach.rec) / 4;
  var totalGames = G.coach.careerWins + G.coach.careerLoss;
  var winPct = totalGames > 0 ? G.coach.careerWins / totalGames : 0.5;
  var base = 30;
  base += Math.round((coachAvg - 70) * 1.5); // coaching skill
  base += Math.round((winPct - 0.5) * 40);    // career record
  base += G.coach.titles * 15;                  // championships
  base += G.coach.tenure * 2;                   // experience
  base -= Math.round((sp - 40) * 0.8);         // harder to get high prestige jobs
  return Math.min(95, Math.max(5, base));
}

function isFiredCoach() {
  // Derived from persisted coach history: last action 'Fired' with no new job since.
  var hst = (G.coach && G.coach.history) ? G.coach.history : [];
  var last = hst.length ? hst[hst.length - 1] : null;
  return !!(last && last.action === 'Fired');
}

function chanceColor(chance) {
  return chance >= 60 ? 'var(--grn2)' : chance >= 30 ? 'var(--gld2)' : 'var(--red)';
}

// The job market is set once per offseason and saved, so the list never
// reshuffles when you're turned down or reload the game.
function jobMarket() {
  var jm = G.jobMarket;
  if (!jm || jm.yr !== G.yr) {
    var gen = generateOpenJobs();
    jm = G.jobMarket = {
      yr: G.yr, rejected: [],
      jobs: gen.map(function(j) { return { tid: j.team.id, firedCoach: j.firedCoach, record: j.record, reason: j.reason }; })
    };
  }
  var list = jm.jobs.map(function(j) {
    return { team: G.teams[j.tid], firedCoach: j.firedCoach, record: j.record, reason: j.reason };
  }).filter(function(j) { return !!j.team; });
  // A fired coach turned down everywhere still needs a job: a small program
  // offers one outright, so the offseason can never dead-end.
  var allOut = list.every(function(j) { return jm.rejected.indexOf(j.team.id) >= 0; });
  if (isFiredCoach() && allOut) {
    if (jm.fallback === undefined) {
      var pool = G.teams.filter(function(t) { return t.id !== G.tid && jm.rejected.indexOf(t.id) < 0; });
      pool.sort(function(a, b) { return (a.schoolPrestige || 0) - (b.schoolPrestige || 0); });
      jm.fallback = pool.length ? pool[Math.floor(Math.random() * Math.min(10, pool.length))].id : -1;
    }
    var ft = G.teams[jm.fallback];
    if (ft) list.push({ team: ft, firedCoach: ft.coach ? ft.coach.firstName + ' ' + ft.coach.lastName : 'Unknown', record: ft.wins + '-' + ft.loss, reason: 'Offered you the job', guaranteed: true });
  }
  return list;
}

function renderCarousel() {
  var jobs = jobMarket();
  var rejected = (G.jobMarket && G.jobMarket.rejected) || [];
  var c = G.coach;
  var currentTeam = G.teams[G.tid];
  var fired = isFiredCoach();

  var h = '<div style="max-width:800px;margin:0 auto;">'
    + '<div style="margin-bottom:12px;"><div class="sec-head">Job market</div>'
    + '<div class="sec-sub">Coaching carousel · ' + c.firstName + ' ' + c.lastName + ' · Age ' + c.age + ' · Career ' + c.careerWins + '-' + c.careerLoss + '</div></div>';

  // Stay option — hidden for fired coaches (R4)
  if (!fired) {
    h += '<div class="panel"><div class="panel-b"><div style="display:flex;align-items:center;gap:10px;">' + teamLogo(currentTeam.name, 'sm')
      + '<div style="flex:1;min-width:0;"><div style="font-weight:600;">Stay at ' + currentTeam.name + '</div>'
      + '<div style="font-size:12px;color:var(--txt3);margin-top:2px;">' + currentTeam.conf + ' · Prestige ' + (currentTeam.schoolPrestige || '?') + ' · Year ' + (c.tenure + 1) + ' tenure</div></div>'
      + '<button class="btn-quiet" data-stay>Stay</button></div></div></div>';
  }

  h += '<div class="panel"><div class="panel-h"><span>Open positions</span><small>' + jobs.length + '</small></div>';
  if (jobs.length) {
    h += '<div class="panel-b flush"><table>'
      + '<thead><tr><th>School</th><th class="num">Prestige</th><th class="num">Chance</th><th></th></tr></thead><tbody>';
    jobs.forEach(function(job) {
      var jobId = job.team.id;
      var turnedDown = rejected.indexOf(jobId) >= 0;
      var chance = calcOfferChance(job);
      var t = job.team;
      h += '<tr>'
        + '<td><div style="display:flex;align-items:center;gap:8px;">' + teamLogo(t.name, 'sm')
        + '<div style="min-width:0;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + t.name + '</div>'
        + '<div style="font-size:11px;color:var(--txt3);">' + t.conf + ' · ' + job.firedCoach + ' · ' + job.reason + '</div></div></div></td>'
        + '<td class="num">' + (t.schoolPrestige || '?') + '</td>'
        + (turnedDown
          ? '<td class="num" colspan="2" style="color:var(--txt3);font-size:12px;">Not selected</td>'
          : '<td class="num"><span class="chance" style="color:' + chanceColor(chance) + ';">' + chance + '%</span></td>'
            + '<td class="num"><button class="btn-quiet" data-apply-job="' + jobId + '">Apply</button></td>')
        + '</tr>';
    });
    h += '</tbody></table></div>';
  } else {
    h += '<div class="panel-b"><div class="empty-state">No coaching vacancies this year.</div></div>';
  }
  h += '</div>';

  if (!fired) {
    h += '<div class="sec-sub" style="margin-top:12px;">You can also skip the carousel and stay at your current school.</div>';
  }

  h += '</div>';
  // Store jobs for apply function
  window._carouselJobs = jobs;
  return h;
}

var _rejectedJobs = [];

export function applyForJob(jobId) {
  var jobs = window._carouselJobs || [];
  var job = null;
  for (var qi = 0; qi < jobs.length; qi++) { if (jobs[qi].team.id === jobId) { job = jobs[qi]; break; } }
  if (!job) return;
  var chance = calcOfferChance(job);
  var roll = Math.random() * 100;

  if (roll < chance) {
    // Show offer modal
    showJobModal(job, true, function() {
      var oldTid = G.tid;
      G.tid = job.team.id;
      var oldTeam = G.teams[oldTid];
      oldTeam.coach = {
        firstName: COACH_FN[Math.floor(Math.random() * COACH_FN.length)],
        lastName: COACH_LN[Math.floor(Math.random() * COACH_LN.length)],
        age: Math.floor(Math.random() * 25) + 35,
        off: Math.floor(Math.random() * 20) + 60,
        def: Math.floor(Math.random() * 20) + 60,
        dev: Math.floor(Math.random() * 20) + 60,
        rec: Math.floor(Math.random() * 20) + 60,
        tenure: 0
      };
      var newTeam = G.teams[G.tid];
      newTeam.coach = {
        firstName: G.coach.firstName, lastName: G.coach.lastName,
        age: G.coach.age, off: G.coach.off, def: G.coach.def,
        dev: G.coach.dev, rec: G.coach.rec, tenure: 0, isUser: true
      };
      G.coach.tenure = 0;
      G.coach.history.push({ yr: G.yr, school: oldTeam.name, action: 'Left for ' + newTeam.name });

      // Reset all state for new school
      G.departingPlayers = [];
      var t = newTeam;
      t.rost.forEach(function(p) {
        var gp = p.s ? p.s.gp || 0 : 0;
        var ppg = gp > 0 ? p.s.pts / gp : 0;
        if (p.cls === 'SR') {
          G.departingPlayers.push({ name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr, reason: 'Graduated', ppg: ppg.toFixed(1), rpg: gp > 0 ? (p.s.reb / gp).toFixed(1) : '0.0', apg: gp > 0 ? (p.s.ast / gp).toFixed(1) : '0.0', mins: p.mins || 0 });
        }
      });

      // Clear live sim state
      LS.tH = null; LS.tA = null; LS.game = null; LS.userTeam = null;
      LS.hs = 0; LS.as = 0;

      // Reset recruiting
      G.recruitPhase = 0; G.recruitTargets = [];
      G.recruitingBudget = 0; G.recruitingSpent = 0;

      addLog('ev', G.gi, 'Coach ' + G.coach.lastName + ' accepts the job at <b>' + newTeam.name + '</b>.');
      toast('Welcome to ' + newTeam.name, 'var(--grn)');
      G.offseasonStep = 'turnover';
      _rejectedJobs = [];
      proceedToRecruiting(); // straight to departures
    });
  } else {
    // Rejected: the job stays on the list, marked as not selected
    if (G.jobMarket && G.jobMarket.rejected.indexOf(jobId) < 0) G.jobMarket.rejected.push(jobId);
    saveState();
    showJobModal(job, false, function() {
      renderOffseason();
    });
  }
}
window.applyForJob = applyForJob;

function showJobModal(job, offered, onContinue) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,25,50,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  var content = '<div style="background:#fff;border:1px solid var(--bdr);border-radius:10px;padding:24px;width:min(420px,100%);text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.18);">'
    + '<div class="tag ' + (offered ? 't-ok' : 't-rival') + '" style="margin-bottom:10px;">' + (offered ? 'Job offered' : 'Not interested') + '</div>'
    + '<div style="font-size:19px;font-weight:600;margin:8px 0 4px;">' + job.team.name + '</div>'
    + '<div class="sec-sub" style="margin-bottom:16px;">' + job.team.conf + ' \u00b7 Prestige ' + (job.team.schoolPrestige || '?') + '</div>';
  if (offered) {
    content += '<div style="font-size:13px;color:var(--txt2);margin-bottom:20px;">The program has offered you the job. Do you accept?</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="job-decline" class="btn-big secondary" style="flex:1;">Decline</button>'
      + '<button id="job-accept" class="btn-big" style="flex:1;">Accept</button>'
      + '</div>';
  } else {
    content += '<div style="font-size:13px;color:var(--txt3);margin-bottom:20px;">' + job.team.name + ' has decided to go in a different direction.</div>'
      + '<button id="job-ok" class="btn-big btn-full">OK</button>';
  }
  content += '</div>';
  overlay.innerHTML = content;
  document.body.appendChild(overlay);
  if (offered) {
    overlay.querySelector('#job-accept').addEventListener('click', function() { document.body.removeChild(overlay); onContinue(); });
    overlay.querySelector('#job-decline').addEventListener('click', function() { document.body.removeChild(overlay); });
  } else {
    overlay.querySelector('#job-ok').addEventListener('click', function() { document.body.removeChild(overlay); if (onContinue) onContinue(); });
  }
}

export function stayAtSchool() {
  if (isFiredCoach()) { toast("You were fired \u2014 you can't stay. Find a new job.", 'var(--red)'); return; }
  G.coach.history.push({ yr: G.yr, school: G.teams[G.tid].name, action: 'Stayed' });
  addLog('ev', G.gi, 'Coach ' + G.coach.lastName + ' returns to <b>' + G.teams[G.tid].name + '</b>.');
  G.offseasonStep = 'turnover';
  _rejectedJobs = [];
  proceedToRecruiting(); // straight to departures
}
window.stayAtSchool = stayAtSchool;

// ═══════════════════════════════════════════════════════════
//  BOARD TAB
// ═══════════════════════════════════════════════════════════

function rSel(key, label, opts, cur) {
  var h = '<label class="fsel"><span>' + label + '</span><select data-rfilter="' + key + '">';
  opts.forEach(function(o) { h += '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; });
  return h + '</select></label>';
}

function rChip(key, val, label, on) {
  return '<button class="fchip' + (on ? ' on' : '') + '" data-rfchip="' + key + '" data-rval="' + val + '">' + label + '</button>';
}
function rTh(key, label, cls) {
  var on = _filter.sort === key;
  return '<th class="sortable' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + '" data-rfchip="sort" data-rval="' + key + '">'
    + label + (on ? (_filter.dir > 0 ? ' ▴' : ' ▾') : '') + '</th>';
}
function rSortVal(r) {
  switch (_filter.sort) {
    case 'ovr': return r.ovr;
    case 'pot': return r.pot || r.ovr;
    case 'stars': return r.stars;
    case 'pos': return ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(r.pos);
    case 'name': return r.name;
    default: return r.natRank;
  }
}

var STARS_LABEL = { 5: '5★', 4: '4★ and up', 3: '3★ and up', 2: '2★ and up' };
var RSHOW_LABEL = { start: 'Would start', rot: 'Starter or rotation', need: 'Fills a need', near: 'Home state and region', targets: 'My targets' };
var RSORT_LABEL = { rank: 'National rank', ovr: 'Overall', pot: 'Potential', stars: 'Stars' };
function recruitShow() { return _filter.targets ? 'targets' : _filter.near ? 'near' : (_filter.fit || 'all'); }

function renderBoard(open, left) {
  var ts = getTeamState(G.teams[G.tid]);
  if (!_filter.dir) _filter.dir = 1;
  var filtered = open.filter(function(r) {
    if (_filter.pos !== 'All' && r.pos !== _filter.pos) return false;
    if (_filter.stars > 0 && r.stars < _filter.stars) return false;
    if (_filter.targets && G.recruitTargets.indexOf(r.id) < 0) return false;
    if (_filter.near && !getGeoLabel(ts, r.homeState)) return false;
    if (_filter.fit && _filter.fit !== 'all') {
      var fr = fitReport(r);
      if (_filter.fit === 'start' && fr.role !== 'Starter') return false;
      if (_filter.fit === 'rot' && fr.role === 'Bench') return false;
      if (_filter.fit === 'need' && !fr.fillsNeed) return false;
    }
    return true;
  });
  filtered.sort(function(a, b) {
    var x = rSortVal(a), y = rSortVal(b);
    if (x < y) return -_filter.dir; if (x > y) return _filter.dir;
    return a.natRank - b.natRank;
  });
  var active = [];
  if (_filter.pos !== 'All') active.push({ key: 'pos', label: _filter.pos });
  if (recruitShow() !== 'all') active.push({ key: 'show', label: RSHOW_LABEL[recruitShow()] });
  if (_filter.stars > 0) active.push({ key: 'stars', label: STARS_LABEL[_filter.stars] || (_filter.stars + '★') });
  if (_filter.sort !== 'rank') active.push({ key: 'sort', label: 'By ' + (RSORT_LABEL[_filter.sort] || _filter.sort).toLowerCase() });
  var h = Acq.toolbar(active, filtered.length + ' of ' + open.length);
  h += '<div class="acq-list">';
  filtered.forEach(function(r) {
    var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
    var geo = getGeoLabel(ts, r.homeState);
    h += Acq.row({
      open: 'data-acq-open-r="' + r.id + '"', hl: isTarget,
      name: r.name + ' <span class="stars">' + starStr(r.stars) + '</span>',
      tag: (geo === 'HOME' ? ' <span class="tag t-ok">Home</span>' : geo === 'REGION' ? ' <span class="tag t-home">Region</span>' : ''),
      sub: r.pos + ' · ' + scoutLine(r),
      big: r.ovr,
      small: isTarget ? '<span style="color:var(--blu);">' + userPctOf(r) + '% odds</span>' : '#' + r.natRank
    });
  });
  h += '</div>';
  if (!filtered.length) h += Acq.empty('No prospects match these filters.');
  return h;
}

// Recruit page (sheet): Overview · Ratings · Schools
function recruitPage(st) {
  var r = G.recruits.find(function(x) { return x.id === st.id; });
  if (!r) return null;
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var left = G.recruitingBudget - G.recruitingSpent;
  var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
  var stName = STATE_NAMES[r.homeState] || r.homeState;
  var h = Acq.pageTop(r.name, r.pos + ' · <span class="stars">' + starStr(r.stars) + '</span> · #' + r.natRank + ' nationally · ' + stName, r.ovr, r.pot || r.ovr, geoBadges(r, sp) ? '<div style="margin:-4px 0 8px;">' + geoBadges(r, sp) + '</div>' : '');
  h += Acq.pageTabs([{ id: 'overview', label: 'Overview' }, { id: 'ratings', label: 'Ratings' }, { id: 'schools', label: 'Odds' }], st.tab);
  if (r.status !== 'open') {
    h += Acq.empty(r.signed === G.tid ? 'He signed with you.' : 'He signed with ' + (r.goneTo || 'another school') + '.');
  } else if (st.tab === 'ratings') {
    h += typeTagsHTML(r) + ratingBarsHTML(r);
  } else if (st.tab === 'schools') {
    h += '<div class="pp-note" style="margin-bottom:10px;">Each school\'s chance to sign him if he decided today. '
      + (isTarget && r.points ? 'Add points to move up.' : 'Target him and add points to get in the race.') + '</div>';
    h += schoolRaceHTML(r, 0);
  } else {
    h += '<div class="pp-offer"><div class="pp-offer-l"><span>Recruiting points</span>' + stepperRow(r, left, false) + '</div>'
      + '<div class="pp-offer-r"><span>' + left + ' points left</span>'
      + (isTarget ? '<button class="btn-quiet btn-sm" data-rem-target="' + r.id + '">Drop target</button>'
        : (canPursueAnother() || (r.points || 0) > 0 ? '<button class="btn-big" style="width:auto;padding:0 16px;min-height:36px;" data-add-target="' + r.id + '">Add to targets</button>' : ''))
      + '</div></div>'
      + (!isTarget && !(r.points || 0) && !canPursueAnother() ? '<div class="tg-note" style="margin:-4px 0 10px;">' + pursuitBlockedMsg() + '</div>' : '');
    h += '<div class="pp-sec"><div class="scout-type">' + playerType(r) + '</div></div>';
    h += '<div class="pp-sec"><div class="card-title">Fit with ' + G.teams[G.tid].name + ' next season</div>' + fitListHTML(r) + '</div>';
  }
  return { title: 'Recruit', html: h };
}

function recruitFilterSheet() {
  var h = '<div class="card-title">Position</div><div class="fbar">';
  ['All', 'PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pz) { h += rChip('pos', pz, pz, _filter.pos === pz); });
  h += '</div><div class="card-title" style="margin-top:10px;">Show</div><div class="fbar">';
  [['all', 'Everyone']].concat(Object.keys(RSHOW_LABEL).map(function(k) { return [k, RSHOW_LABEL[k]]; })).forEach(function(o) {
    h += rChip('show', o[0], o[1], recruitShow() === o[0]);
  });
  h += '</div><div class="card-title" style="margin-top:10px;">Stars</div><div class="fbar">';
  [[0, 'Any'], [5, '5★'], [4, '4★ and up'], [3, '3★ and up'], [2, '2★ and up']].forEach(function(o) { h += rChip('stars', o[0], o[1], _filter.stars === o[0]); });
  h += '</div><div class="card-title" style="margin-top:10px;">Sort by</div><div class="fbar">';
  Object.keys(RSORT_LABEL).forEach(function(k) { h += rChip('sortsel', k, RSORT_LABEL[k], _filter.sort === k); });
  h += '</div><button class="btn-big btn-full" style="margin-top:14px;" data-action="sheet-close">Show prospects</button>';
  return { title: 'Filter recruits', html: h };
}
Acq.registerSheet('recruit', recruitPage);
Acq.registerSheet('recruit-filter', recruitFilterSheet);
function openRecruitPage(rid) { Acq.openPage('recruit', rid); }
function openRecruitFilter() { Acq.openPage('recruit-filter', 0); }
function clearRecruitFilter(key) {
  if (key === 'pos') _filter.pos = 'All';
  else if (key === 'show') { _filter.fit = 'all'; _filter.near = false; _filter.targets = false; }
  else if (key === 'stars') _filter.stars = 0;
  else if (key === 'sort') { _filter.sort = 'rank'; _filter.dir = 1; }
  setUiPrefs('recruiting', _filter); renderOffseason();
}

// ═══════════════════════════════════════════════════════════
//  DETAIL PANEL
// ═══════════════════════════════════════════════════════════

function renderDetailPanel(r, left) {
  var stName = STATE_NAMES[r.homeState] || r.homeState;
  var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;

  var h = '<div class="rdetail">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">'
    + '<div><div style="font-weight:600;">' + r.name + ', ' + r.pos + '</div>'
    + '<div style="font-size:12.5px;color:var(--txt2);margin-top:1px;">' + r.stars + '-star, #' + r.natRank + ' nationally, #' + r.posRank + ' at ' + r.pos
    + '. Overall ' + r.ovr + ', potential ' + (r.pot || r.ovr) + '. From ' + stName + '.</div></div>'
    + '<button class="btn-quiet" data-close-detail aria-label="Close details">Close</button></div>';
  if (!isTarget) {
    h += '<button class="btn-big" style="width:auto;margin-bottom:10px;" data-add-target="' + r.id + '">Add to targets</button>';
  } else {
    h += '<div style="margin-bottom:10px;">' + stepperRow(r, left, true) + '</div>';
  }
  h += scoutingHTML(r);
  h += '<div class="card-title" style="margin-top:12px;">Schools recruiting him</div>'
    + '<div data-schools-for="' + r.id + '" data-schools-n="0">' + schoolRaceHTML(r, 0) + '</div>';
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  TARGETS TAB
// ═══════════════════════════════════════════════════════════

function renderTargets(left) {
  var h = '';
  var ids = G.recruitTargets.slice();
  G.recruits.forEach(function(r) { if (r.status === 'open' && (r.points || 0) > 0 && ids.indexOf(r.id) < 0) ids.push(r.id); });
  ids.forEach(function(rid) {
    var r = G.recruits.find(function(x) { return x.id === rid; });
    if (!r || r.status !== 'open') return;
    var schools = getSchoolChances(r);
    var userSchool = null;
    for (var si = 0; si < schools.length; si++) if (schools[si].isUser) userSchool = schools[si];
    var userPct = userSchool ? userSchool.pct : 0;
    var leading = schools.length && schools[0].isUser;
    var pctCol = userPct >= 60 ? 'var(--grn2)' : userPct >= 30 ? 'var(--gld2)' : 'var(--red)';

    h += '<div style="padding:8px 0;border-bottom:1px solid var(--bdr);">';
    h += '<div style="display:flex;align-items:center;gap:8px;">'
      + '<div class="leader-rank">#' + r.natRank + '</div>'
      + '<span class="pos-chip">' + r.pos + '</span>'
      + '<div class="leader-name" style="flex:1;cursor:pointer;" data-acq-open-r="' + r.id + '" role="button" tabindex="0">' + r.name + (leading ? ' <span class="tag t-ok">Leading</span>' : '')
      + (r.late ? ' <span class="tag t-ok">Late</span>' : '')
      + '<small><span style="color:var(--gld2);">' + starStr(r.stars) + '</span> · OVR ' + r.ovr + ' · ' + (STATE_NAMES[r.homeState] || r.homeState) + '</small></div>'
      + '<div style="text-align:right;flex-shrink:0;"><div class="leader-val" data-user-pct="' + r.id + '" style="color:' + pctCol + ';font-size:14px;">' + userPct + '%</div>'
      + '<div>' + Battle.trendHTML(userPct, r._prevPct) + '</div></div></div>';

    h += '<div style="margin-top:4px;">' + stepperRow(r, left, true) + '</div>';

    h += '<div data-schools-for="' + r.id + '" data-schools-n="3">' + schoolRaceHTML(r, 3) + '</div>';
    h += '</div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  COMMITS TAB
// ═══════════════════════════════════════════════════════════

function renderCommits(commits) {
  if (!commits.length) return '<div class="empty-state">No commits yet. Target recruits and advance phases.</div>';
  var avgOvr = Math.round(commits.reduce(function(s, r) { return s + r.ovr; }, 0) / commits.length);
  var h = '<div style="margin-bottom:10px;font-size:12px;color:var(--txt2);">' + commits.length + ' commit' + (commits.length > 1 ? 's' : '') + ' · Avg OVR ' + avgOvr + '</div>';
  commits.forEach(function(r) {
    h += '<div class="leader-row">'
      + '<span class="pos-chip">' + r.pos + '</span>'
      + '<div class="leader-name">' + r.name
      + '<small><span style="color:var(--gld2);">' + starStr(r.stars) + '</span> · ' + (STATE_NAMES[r.homeState] || r.homeState) + '</small></div>'
      + '<div style="text-align:right;"><div class="leader-val" style="color:var(--grn2);">' + r.ovr + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);font-weight:700;">POT ' + (r.pot || r.ovr) + '</div></div></div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  ROSTER TAB
// ═══════════════════════════════════════════════════════════

function renderRosterNeeds() {
  var t = G.teams[G.tid];
  var posNeeds = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  t.rost.forEach(function(p) { if (posNeeds.hasOwnProperty(p.pos)) posNeeds[p.pos]++; });
  var h = '<div style="margin-bottom:10px;font-size:12px;color:var(--txt2);">Current roster: ' + t.rost.length + ' players</div>';

  h += '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);">';
  Object.keys(posNeeds).forEach(function(pos) {
    var ct = posNeeds[pos];
    var need = ct < 2;
    h += '<div class="stat-cell' + (need ? ' hot' : '') + '"><div class="sv" style="color:' + (need ? 'var(--red)' : 'var(--txt)') + ';">' + ct + '</div>'
      + '<div class="sl">' + pos + (need ? ' · need' : '') + '</div></div>';
  });
  h += '</div>';

  t.rost.sort(function(a, b) { return b.ovr - a.ovr; });
  t.rost.forEach(function(p) {
    var gp = p.s.gp || 0; var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
    h += '<div class="leader-row"><span class="pos-chip">' + p.pos + '</span>'
      + '<div class="leader-name">' + p.name + ' <span style="font-size:10px;font-weight:800;color:var(--blu);">' + p.cls + '</span>'
      + '<small>' + ppg + ' PPG · ' + p.mins + ' min</small></div>'
      + '<div class="leader-val" style="color:var(--blu);font-size:15px;">' + p.ovr + '</div></div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS
// ═══════════════════════════════════════════════════════════
export function resolvePitchWeek(id) { adjustPoints(id, 5); return { userBoost: 5, rivals: [], signed: -1 }; }
export function pitchRecruit(id) { adjustPoints(id, 5); }
