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
import { ge, clamp, ri } from '../utils.js';
import { hasRestlessStarAt } from '../morale.js';
import { TEAM_STATES, STATE_TO_REGION, STATE_NAMES, SCHOOL_RECRUIT_GATES, COACH_FN, COACH_LN, RECRUIT_STATE_POOL } from '../constants.js';
import { G, LS, SetupState, saveState, calcRecruitingBudget } from '../state.js';
import { renderPortal, genPortalEntrants, registerPortalCallbacks, adjustOffer, pivotOffer, advancePortalStage, advanceFromPortal, setPortalFilter, togglePortalDetail, PORTAL_OFFER_STEP } from './portal.js';
import { genPlayer } from '../simulation.js';
import { teamLogo } from '../ui.js';
import * as Battle from './battle.js';

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
var _filter = { pos: 'All', stars: 0, sort: 'rank', dir: 1, near: false, targets: false };
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
  3: { name: 'Signing day', tag: 'Round 3 of 3', desc: 'Last chance to adjust. Prospects sign when you finalize.', btnLabel: 'Finalize class and start season', final: true, decideFrac: 1.0, cpuAgg: 1.4 }
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

export function adjustPoints(rid, delta) {
  var r = G.recruits.find(function(x) { return x.id === rid; });
  if (!r || r.status !== 'open') return;
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
  updateRecruitRow(rid); // in-place: no full re-render
}
window.adjustPoints = adjustPoints;

export function addTarget(rid) {
  if (G.recruitTargets.indexOf(rid) < 0) G.recruitTargets.push(rid);
  saveState();
  // On the board, just flip that row (no 400-row rebuild); elsewhere re-render
  if (_tab === 'board' && _detailId !== rid && patchTargetRow(rid)) return;
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

export function setRecruitFilter(key, val) { _filter[key] = val; renderOffseason(); }
window.setRecruitFilter = setRecruitFilter;


export function proceedToRecruiting() {
  // Remove departing players from roster
  var t = G.teams[G.tid];
  var dominated = G.departingPlayers.map(function(d) { return d.name; });
  t.rost = t.rost.filter(function(p) { return dominated.indexOf(p.name) < 0; });
  genRecruitsFn();
  // R9: transfer portal step sits between turnover and recruiting
  genPortalEntrants();
  // The donor collective's check lands here: it funds the transfer portal.
  var bonus = payDonors();
  if (bonus) {
    addLog('ev', G.gi, 'Donor collective check: <b>+' + bonus + ' NIL</b> for the transfer portal and facilities.');
    toast('Donor check: +' + bonus + ' NIL', 'var(--grn)');
  }
  G.offseasonStep = 'portal';
  saveState(); updateAll(); renderOffseason();
}
window.proceedToRecruiting = proceedToRecruiting;

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
      r.signed = G.tid; r.status = 'committed';
      refundRecruitPoints(r);
      addLog('ev', G.gi, r.name + ' (' + r.stars + '★) commits early.');
    },
    cpuSign: function(r) {
      var win = cpuWeightedSign(r);
      if (!win) { r.status = 'gone'; r.signed = -1; return; }
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
  saveState(); updateAll(); renderOffseason();
}
window.advanceRecruitPhase = advanceRecruitPhase;

export function resolveRecruitingClass() {
  if (G.recruitPhase < 3) { while (G.recruitPhase < 3 && G.recruitPhase > 0) advanceRecruitPhase(); }
  G.recruits.forEach(function(r) {
    if (r.status !== 'open') return;
    var ub = calcUserBid(r); var schools = calcSchoolChances(r);
    var best = schools.filter(function(s) { return !s.isUser; }).sort(function(a, b) { return b.bid - a.bid; })[0];
    var bb = best ? best.bid : 0;
    if (r.points >= 5 && ub > bb * 0.7) { r.signed = G.tid; r.status = 'committed'; addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) commits (late).'); }
    else if (best) { r.signed = best.tid; r.status = 'gone'; r.goneTo = best.name; }
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
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content'); if (!el) return;

  // Route to correct screen
  if (G.offseasonStep === 'fired') { el.innerHTML = renderFired(); bindOffseason(el); return; }

  if (G.offseasonStep === 'recap') {
    if (window._renderSeasonRecap) el.innerHTML = window._renderSeasonRecap();
    else el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt3);">Season recap loading...</div>';
    return;
  }

  if (G.offseasonStep === 'skillpoints') { el.innerHTML = renderSkillPoints(); bindOffseason(el); return; }

  if (G.offseasonStep === 'carousel') { el.innerHTML = renderCarousel(); bindOffseason(el); return; }

  if (G.offseasonStep === 'portal') { el.innerHTML = renderPortal(); bindOffseason(el); return; }

  if (G.offseasonStep === 'turnover' || !G.offseasonStep) { el.innerHTML = renderTurnover(); bindOffseason(el); return; }

  initRecruitingIfNeeded();
  var phase = PHASES[G.recruitPhase] || PHASES[1];
  var left = G.recruitingBudget - G.recruitingSpent;
  var commits = G.recruits.filter(function(r) { return r.status === 'committed'; });
  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var h = '';

  // ── Header ──
  h += '<div style="margin-bottom:12px;"><div class="sec-head">Recruiting ' + G.yr + '</div>'
    + '<div class="sec-sub">' + phase.tag + ': ' + phase.name + '. ' + phase.desc + '</div></div>';

  h += Battle.stageStepperHTML(G.recruitPhase - 1);

  // ── Stats bar ──
  var leftCol = left > 30 ? 'var(--grn2)' : left > 0 ? 'var(--gld2)' : 'var(--red)';
  h += '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);">'
    + '<div class="stat-cell"><div class="sv" data-budget-left style="color:' + leftCol + ';">' + left + '</div><div class="sl">Budget</div></div>'
    + '<div class="stat-cell"><div class="sv">' + ((G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50) + '</div><div class="sl">Prestige</div></div>'
    + '<div class="stat-cell"><div class="sv">' + Math.max(0, 13 - G.teams[G.tid].rost.length) + '</div><div class="sl">Open spots</div></div>'
    + '<div class="stat-cell hot"><div class="sv">' + commits.length + '</div><div class="sl">Commits</div></div>'
    + '</div>';

  // ── Tabs (Strategy-screen rhythm) ──
  var tabs = [
    { id: 'board', label: 'Board (' + open.length + ')' },
    { id: 'targets', label: 'Targets (' + G.recruitTargets.length + ')' },
    { id: 'commits', label: 'Commits (' + commits.length + ')' },
    { id: 'roster', label: 'Roster' }
  ];
  h += '<div class="strat-tabs" role="tablist" aria-label="Recruiting sections">';
  tabs.forEach(function(tb) {
    h += '<button class="strat-tab' + (_tab === tb.id ? ' on' : '') + '" role="tab" data-rtab="' + tb.id + '">' + tb.label + '</button>';
  });
  h += '</div>';

  // ── Tab content ──
  if (_tab === 'board') h += renderBoard(open, left);
  else if (_tab === 'targets') h += renderTargets(left);
  else if (_tab === 'commits') h += renderCommits(commits);
  else if (_tab === 'roster') h += renderRosterNeeds();

  // ── Advance button ──
  h += '<button class="btn-big btn-full" style="margin-top:16px;" data-phase-advance>' + phase.btnLabel + '</button>';

  el.innerHTML = h;
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
function phaseAdvance() {
  if ((PHASES[G.recruitPhase] || {}).final) {
    if (typeof window !== 'undefined' && window.doOffseason) window.doOffseason();
  } else {
    advanceRecruitPhase();
  }
}

// ═══════════════════════════════════════════════════════════
//  EVENT DELEGATION — one container-level handler for the
//  whole offseason view (recruiting + portal HTML)
// ═══════════════════════════════════════════════════════════

function bindOffseason(el) {
  el.onclick = function(e) {
    var q = function(sel) { return e.target.closest ? e.target.closest(sel) : null; };
    var m;
    if ((m = q('[data-pt-dec]'))) { adjustPoints(parseInt(m.getAttribute('data-pt-dec'), 10), -5); return; }
    if ((m = q('[data-pt-inc]'))) { adjustPoints(parseInt(m.getAttribute('data-pt-inc'), 10), 5); return; }
    if ((m = q('[data-add-target]'))) { addTarget(parseInt(m.getAttribute('data-add-target'), 10)); return; }
    if ((m = q('[data-rem-target]'))) { removeTarget(parseInt(m.getAttribute('data-rem-target'), 10)); return; }
    if (q('[data-close-detail]')) { closeDetail(); return; }
    if ((m = q('[data-rtab]'))) { setRecruitTab(m.getAttribute('data-rtab')); return; }
    if (q('[data-phase-advance]')) { phaseAdvance(); return; }
    if (q('[data-proceed-portal]')) { proceedToRecruiting(); return; }
    if ((m = q('[data-skill-dec]'))) { deallocateSkillPoint(m.getAttribute('data-skill-dec')); return; }
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
    if (q('[data-pstage]')) { advancePortalStage(); return; }
    if ((m = q('[data-pdetail]'))) { togglePortalDetail(parseInt(m.getAttribute('data-pdetail'), 10)); return; }
    if ((m = q('[data-rfchip]'))) {
      var fk = m.getAttribute('data-rfchip'), fv = m.getAttribute('data-rval');
      if (fk === 'sort') {
        if (_filter.sort === fv) _filter.dir = -(_filter.dir || 1);
        else { _filter.sort = fv; _filter.dir = (fv === 'rank' || fv === 'name' || fv === 'pos') ? 1 : -1; }
      } else if (fk === 'near' || fk === 'targets') _filter[fk] = !_filter[fk];
      else _filter[fk] = fk === 'stars' ? parseInt(fv, 10) : fv;
      renderOffseason(); return;
    }
    // Board row → detail (checked last; steppers/target buttons win)
    if ((m = q('[data-rid]'))) { showDetail(parseInt(m.getAttribute('data-rid'), 10)); return; }
  };
  el.onchange = function(e) {
    var m = e.target.closest ? e.target.closest('[data-rfilter]') : null;
    if (m) {
      var key = m.getAttribute('data-rfilter');
      setRecruitFilter(key, key === 'stars' ? parseInt(m.value, 10) : m.value);
    }
  };
  el.onkeydown = function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute) {
      var m = e.target.closest ? e.target.closest('[data-rid]') : null;
      if (m && e.target === m) { e.preventDefault(); showDetail(parseInt(m.getAttribute('data-rid'), 10)); }
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
    + '<span style="font-size:10px;color:var(--txt3);">pts</span>'
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

  h += '<div class="big-btn-row"><button class="btn-big btn-full" data-proceed-portal>Open transfer portal</button></div>';
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

function renderSkillPoints() {
  var pts = G.skillPointsToSpend || 0;
  var c = G.coach;
  // Snapshot initial values on first render. R7: persisted on G.coach (which
  // saveState serializes whole) so it survives reload; re-derived as a
  // no-deallocate floor if an old save lacks it.
  if (!_skillInitial) {
    _skillInitial = (G.coach && G.coach.skillInitial) || { off: c.off, def: c.def, dev: c.dev, rec: c.rec };
    if (G.coach) G.coach.skillInitial = _skillInitial;
  }
  var h = '<div style="max-width:600px;margin:0 auto;">'
    + '<div style="margin-bottom:12px;"><div class="sec-head">Skill points</div>'
    + '<div class="sec-sub">You earned <b>' + G.skillPointsEarned + '</b> skill point' + (G.skillPointsEarned !== 1 ? 's' : '') + ' this season.</div></div>';

  h += '<div class="panel"><div class="panel-h"><span>Coaching ratings</span>'
    + '<small><span style="font-weight:600;color:' + (pts > 0 ? 'var(--grn2)' : 'var(--txt3)') + ';">' + pts + '</span> point' + (pts !== 1 ? 's' : '') + ' remaining</small></div>'
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

  h += '<div class="big-btn-row"><button class="btn-big btn-full" data-finish-skills>Continue</button></div></div>';
  return h;
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
      saveState(); updateAll(); renderOffseason();
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
  saveState(); updateAll(); renderOffseason();
}
window.stayAtSchool = stayAtSchool;

// ═══════════════════════════════════════════════════════════
//  BOARD TAB
// ═══════════════════════════════════════════════════════════

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

function renderBoard(open, left) {
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var ts = getTeamState(G.teams[G.tid]);
  if (!_filter.dir) _filter.dir = 1;
  var h = '';

  // Filters: chips, one row each (same pattern as the transfer portal)
  h += '<div class="fbar"><span class="flbl">Position</span>';
  ['All', 'PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pz) { h += rChip('pos', pz, pz, _filter.pos === pz); });
  h += '</div><div class="fbar"><span class="flbl">Stars</span>';
  [{ v: 0, l: 'All' }, { v: 5, l: '5★' }, { v: 4, l: '4★+' }, { v: 3, l: '3★+' }, { v: 2, l: '2★+' }].forEach(function(o) {
    h += rChip('stars', o.v, o.l, _filter.stars === o.v);
  });
  h += '</div><div class="fbar"><span class="flbl">Show</span>'
    + rChip('near', '1', 'Home state and region', !!_filter.near)
    + rChip('targets', '1', 'My targets only', !!_filter.targets) + '</div>';
  h += '<div class="fbar fbar-sort"><span class="flbl">Sort</span>';
  [['rank', 'Rank'], ['ovr', 'Overall'], ['pot', 'Potential'], ['stars', 'Stars']].forEach(function(o) {
    h += rChip('sort', o[0], o[1] + (_filter.sort === o[0] ? (_filter.dir > 0 ? ' ▴' : ' ▾') : ''), _filter.sort === o[0]);
  });
  h += '</div>';

  var filtered = open.filter(function(r) {
    if (_filter.pos !== 'All' && r.pos !== _filter.pos) return false;
    if (_filter.stars > 0 && r.stars < _filter.stars) return false;
    if (_filter.targets && G.recruitTargets.indexOf(r.id) < 0) return false;
    if (_filter.near && !getGeoLabel(ts, r.homeState)) return false;
    return true;
  });
  filtered.sort(function(a, b) {
    var x = rSortVal(a), y = rSortVal(b);
    if (x < y) return -_filter.dir; if (x > y) return _filter.dir;
    return a.natRank - b.natRank;
  });

  h += '<div class="sec-sub" style="margin:6px 0;">' + filtered.length + ' of ' + open.length + ' prospects shown. Select a prospect to see the schools recruiting him.</div>';
  h += '<div class="tbl-wrap"><table class="ptbl rtbl"><thead><tr>'
    + rTh('rank', '#', 'num') + rTh('pos', 'Pos') + rTh('name', 'Prospect') + rTh('stars', 'Stars')
    + rTh('ovr', 'Ovr', 'num') + rTh('pot', 'Pot', 'num') + '<th></th></tr></thead><tbody>';
  filtered.forEach(function(r) {
    var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
    var stName = STATE_NAMES[r.homeState] || r.homeState;
    var potCol = r.pot > r.ovr + 8 ? 'var(--grn2)' : 'var(--txt2)';
    var act = isTarget
      ? '<span class="tgt-on">Targeted</span>'
      : '<button class="btn-quiet btn-sm" data-add-target="' + r.id + '">Target</button>';
    h += '<tr class="rrow' + (isTarget ? ' hl' : '') + (r.id === _detailId ? ' open' : '') + '" data-rid="' + r.id + '" tabindex="0" aria-label="View ' + r.name + '">'
      + '<td class="num c-rank">' + r.natRank + '</td>'
      + '<td class="c-pos">' + r.pos + '</td>'
      + '<td class="pt-name c-name"><b>' + r.name + '</b> ' + geoBadges(r, sp)
      + '<div class="pt-sub">' + stName + '</div></td>'
      + '<td class="c-stars" data-l=""><span class="stars">' + starStr(r.stars) + '</span></td>'
      + '<td class="num c-ovr" data-l="Ovr"><b>' + r.ovr + '</b></td>'
      + '<td class="num c-pot" data-l="Pot" style="color:' + potCol + ';">' + (r.pot || r.ovr) + '</td>'
      + '<td class="c-act">' + act + '</td></tr>';
    // Details open right under the selected prospect, not at the top of the page
    if (r.id === _detailId) h += '<tr class="detail-row"><td colspan="7">' + renderDetailPanel(r, left) + '</td></tr>';
  });
  h += '</tbody></table></div>';
  if (!filtered.length) h += '<div class="empty-state">No prospects match these filters.</div>';
  return h;
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
  h += '<div class="card-title" style="margin-top:4px;">Schools recruiting him</div>'
    + '<div data-schools-for="' + r.id + '" data-schools-n="0">' + schoolRaceHTML(r, 0) + '</div>';
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  TARGETS TAB
// ═══════════════════════════════════════════════════════════

function renderTargets(left) {
  if (!G.recruitTargets.length) {
    return '<div class="empty-state">No targets yet. Browse the Board and add recruits you want to pursue.</div>';
  }
  var h = '';
  G.recruitTargets.forEach(function(rid) {
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
      + '<div class="leader-name" style="flex:1;">' + r.name + (leading ? ' <span class="tag t-ok">Leading</span>' : '')
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
