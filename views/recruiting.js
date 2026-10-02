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

import { ge, clamp } from '../utils.js';
import { TEAM_STATES, STATE_TO_REGION, STATE_NAMES, SCHOOL_RECRUIT_GATES, COACH_FN, COACH_LN } from '../constants.js';
import { G, LS, SetupState, saveState, calcRecruitingBudget } from '../state.js';
import { renderPortal, genPortalEntrants, registerPortalCallbacks, portalPickup, advanceFromPortal, showMorePortal } from './portal.js';
import { teamLogo } from '../ui.js';

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
var _filter = { pos: 'All', stars: 0, sort: 'rank' };
var _detailId = -1; // recruit ID shown in detail, -1 = none
var _boardShown = 30; // R5: cap rendered board rows

// ── View skin (scoped) ────────────────────────────────────
function ensureSkin() {
  if (document.getElementById('rec-skin')) return;
  var s = document.createElement('style');
  s.id = 'rec-skin';
  s.textContent =
    '.pos-chip{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;' +
    'background:var(--blu-soft);color:var(--blu);padding:5px 0;border-radius:5px;width:38px;flex-shrink:0;}' +
    '.rc-row{display:flex;align-items:center;gap:10px;width:100%;background:#fff;border:1px solid var(--bdr);' +
    'border-radius:10px;padding:12px 14px;margin-bottom:6px;min-height:64px;cursor:pointer;text-align:left;}' +
    '.rc-row:active{background:var(--s2);}' +
    '.rc-row.is-target{border-left:3px solid var(--blu);}' +
    '.rc-row.open{border-color:var(--blu2);background:var(--blu-soft);}' +
    '.rc-ovr{text-align:right;flex-shrink:0;}' +
    '.rc-ovr b{font-family:var(--mono);font-size:18px;font-weight:900;}' +
    '.rc-ovr small{display:block;font-size:10px;color:var(--txt3);font-weight:700;}' +
    '.stepper{width:44px;height:44px;border-radius:8px;border:1px solid var(--bdr2);background:#fff;' +
    'font-size:20px;font-weight:900;color:var(--txt);cursor:pointer;display:inline-flex;align-items:center;' +
    'justify-content:center;flex-shrink:0;user-select:none;-webkit-user-select:none;}' +
    '.stepper:active{background:var(--s3);}' +
    '.stepper.off{opacity:.35;cursor:default;}' +
    '.stepper.plus{background:var(--blu);border-color:var(--blu);color:#fff;}' +
    '.stepper.plus.off{background:#fff;color:var(--txt3);border-color:var(--bdr2);}' +
    '.pts-val{font-family:var(--mono);font-size:17px;font-weight:900;min-width:56px;text-align:center;flex-shrink:0;}' +
    '.school-row{display:flex;align-items:center;gap:8px;padding:5px 0;}' +
    '.school-name{width:118px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;' +
    'text-overflow:ellipsis;flex-shrink:0;}' +
    '.school-bar{flex:1;height:7px;background:var(--s3);border-radius:4px;overflow:hidden;}' +
    '.school-fill{height:100%;border-radius:4px;}' +
    '.school-pct{width:44px;text-align:right;font-family:var(--mono);font-size:12px;font-weight:800;flex-shrink:0;}' +
    '.rc-select{background:#fff;border:1px solid var(--bdr2);border-radius:8px;color:var(--txt);' +
    'padding:0 12px;font-size:13px;min-height:44px;font-family:inherit;flex-shrink:0;}' +
    '.phase-dots{display:flex;gap:6px;align-items:center;}' +
    '.phase-dot{width:10px;height:10px;border-radius:50%;}' +
    '.job-grid{display:grid;grid-template-columns:1fr;gap:10px;}' +
    '@media(min-width:861px){.job-grid{grid-template-columns:1fr 1fr;}}' +
    '.chance{font-size:15px;font-weight:900;}' +
    '.skill-row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--bdr);' +
    'border-radius:10px;padding:12px 14px;margin-bottom:8px;}' +
    '.skill-bar{height:6px;background:var(--s3);border-radius:3px;overflow:hidden;margin-top:6px;}' +
    '.skill-fill{height:100%;background:var(--blu);border-radius:3px;}' +
    '.geo-badge{font-size:9px;font-weight:900;padding:2px 7px;border-radius:4px;margin-left:6px;letter-spacing:.4px;}' +
    '.geo-home{color:var(--grn2);background:var(--grn-soft);}' +
    '.geo-region{color:var(--blu);background:var(--blu-soft);}' +
    '.geo-long{color:var(--red);background:var(--red-soft);}';
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════
//  PHASE CONFIG
// ═══════════════════════════════════════════════════════════
var PHASES = {
  1: { name: 'Evaluation Period', tag: 'PHASE 1 OF 3', desc: 'Browse and target recruits. No decisions yet.', btnLabel: 'ADVANCE TO EARLY SIGNING ▶', final: false, decisionRate: 0.30, cpuAgg: 0.8 },
  2: { name: 'Early Signing Period', tag: 'PHASE 2 OF 3', desc: 'Top prospects decide. Refunded points can be reinvested.', btnLabel: 'ADVANCE TO LATE SIGNING ▶', final: false, decisionRate: 0.55, cpuAgg: 1.1 },
  3: { name: 'Late Signing Period', tag: 'PHASE 3 OF 3', desc: 'All remaining recruits make their decision.', btnLabel: 'FINALIZE CLASS & START SEASON ▶', final: true, decisionRate: 1.0, cpuAgg: 1.4 }
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
  r.points = nv; delete r._schools; delete r._schoolsPhase;
  recalcSpent(); saveState();
  updateRecruitRow(rid); // in-place: no full re-render
}
window.adjustPoints = adjustPoints;

export function addTarget(rid) {
  if (G.recruitTargets.indexOf(rid) < 0) G.recruitTargets.push(rid);
  saveState(); renderOffseason();
}
window.addTarget = addTarget;

export function removeTarget(rid) {
  G.recruitTargets = G.recruitTargets.filter(function(x) { return x !== rid; });
  var r = G.recruits.find(function(x) { return x.id === rid; });
  if (r) { r.points = 0; delete r._schools; delete r._schoolsPhase; }
  recalcSpent(); saveState(); renderOffseason();
}
window.removeTarget = removeTarget;

export function showDetail(rid) { _detailId = rid; renderOffseason(); }
window.showDetail = showDetail;

export function closeDetail() { _detailId = -1; renderOffseason(); }
window.closeDetail = closeDetail;

export function setRecruitTab(tab) { _tab = tab; _detailId = -1; _boardShown = 30; renderOffseason(); }
window.setRecruitTab = setRecruitTab;

export function setRecruitFilter(key, val) { _filter[key] = val; _boardShown = 30; renderOffseason(); }
window.setRecruitFilter = setRecruitFilter;

export function showMoreBoard() { _boardShown += 30; renderOffseason(); }
window.showMoreBoard = showMoreBoard;

export function proceedToRecruiting() {
  // Remove departing players from roster
  var t = G.teams[G.tid];
  var dominated = G.departingPlayers.map(function(d) { return d.name; });
  t.rost = t.rost.filter(function(p) { return dominated.indexOf(p.name) < 0; });
  genRecruitsFn();
  // R9: transfer portal step sits between turnover and recruiting
  genPortalEntrants();
  G.offseasonStep = 'portal';
  saveState(); renderOffseason();
}
window.proceedToRecruiting = proceedToRecruiting;

// We need to call genRecruits from season.js — use window bridge
function genRecruitsFn() { if (window._genRecruits) window._genRecruits(); }

// ═══════════════════════════════════════════════════════════
//  PHASE RESOLUTION (unchanged logic)
// ═══════════════════════════════════════════════════════════

export function advanceRecruitPhase() {
  var phase = PHASES[G.recruitPhase]; if (!phase) return;
  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var num = Math.max(1, Math.round(open.length * phase.decisionRate));
  open.sort(function(a, b) { return ((b.points || 0) + b.interest) - ((a.points || 0) + a.interest); });
  var deciding = open.slice(0, num);
  var newC = [], newG = [], refund = 0;
  deciding.forEach(function(r) {
    var ub = calcUserBid(r);
    var schools = calcSchoolChances(r);
    var bestCPU = schools.filter(function(s) { return !s.isUser; }).sort(function(a, b) { return b.bid - a.bid; })[0];
    var bestBid = bestCPU ? bestCPU.bid : 0;
    if (r.points >= 10 && ub > bestBid) { r.signed = G.tid; r.status = 'committed'; newC.push(r); }
    else if (r.points >= 5 && ub > bestBid * 0.85 && Math.random() < 0.35) { r.signed = G.tid; r.status = 'committed'; newC.push(r); }
    else if (r.points > 0 && ub > bestBid * 0.7 && Math.random() < 0.15) { r.signed = G.tid; r.status = 'committed'; newC.push(r); }
    else if (bestCPU) {
      var ch = r.stars >= 5 ? 0.80 : r.stars >= 4 ? 0.70 : r.stars >= 3 ? 0.55 : 0.40;
      ch *= phase.cpuAgg;
      if (Math.random() < ch) { r.signed = bestCPU.tid; r.status = 'gone'; r.goneTo = bestCPU.name; newG.push(r); }
    }
    if (r.status !== 'open' && r.points > 0) { refund += r.points; r.points = 0; }
  });
  G.recruitTargets = G.recruitTargets.filter(function(id) { var r = G.recruits.find(function(x) { return x.id === id; }); return r && r.status === 'open'; });
  G.recruits.forEach(function(r) { delete r._schools; delete r._schoolsPhase; });
  recalcSpent();
  newC.forEach(function(r) { addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b>'); });
  newG.forEach(function(r) { addLog('ev', G.gi, r.name + ' signed with <b>' + (r.goneTo || 'another school') + '</b>.'); });
  var parts = [];
  if (newC.length) parts.push(newC.length + ' commit' + (newC.length > 1 ? 's' : ''));
  if (newG.length) parts.push(newG.length + ' lost');
  if (refund > 0) parts.push(refund + ' pts refunded');
  parts.push(G.recruits.filter(function(r) { return r.status === 'open'; }).length + ' still open');
  toast(phase.name + ': ' + parts.join(' \u00b7 '), newC.length ? 'var(--grn)' : 'var(--gld)');
  if (G.recruitPhase < 3) G.recruitPhase++;
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
    if (r.points >= 5 && ub > bb * 0.7) { r.signed = G.tid; r.status = 'committed'; addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b> (late)'); }
    else if (best) { r.signed = best.tid; r.status = 'gone'; r.goneTo = best.name; }
    else { r.status = 'gone'; r.signed = -1; }
    r.points = 0;
  });
  var tot = G.recruits.filter(function(r) { return r.signed === G.tid; });
  toast('Class finalized: ' + tot.length + ' signee' + (tot.length !== 1 ? 's' : '') + '!', tot.length >= 3 ? 'var(--grn)' : 'var(--gld)');
  G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0; G.recruitTargets = [];
  saveState();
}
window.resolveRecruitingClass = resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  ensureSkin();
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
    + '<div class="sec-sub">' + phase.name + ' — ' + phase.desc + '</div></div>';

  // ── Stats bar ──
  var leftCol = left > 30 ? 'var(--grn2)' : left > 0 ? 'var(--gld2)' : 'var(--red)';
  h += '<div class="stat-strip" style="grid-template-columns:repeat(5,1fr);">'
    + '<div class="stat-cell"><div class="sv" data-budget-left style="color:' + leftCol + ';">' + left + '</div><div class="sl">Budget</div></div>'
    + '<div class="stat-cell"><div class="sv">' + ((G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50) + '</div><div class="sl">Prestige</div></div>'
    + '<div class="stat-cell"><div class="sv">' + Math.max(0, 13 - G.teams[G.tid].rost.length) + '</div><div class="sl">Open spots</div></div>'
    + '<div class="stat-cell hot"><div class="sv">' + commits.length + '</div><div class="sl">Commits</div></div>'
    + '<div class="stat-cell"><div class="phase-dots" style="justify-content:center;">' + phaseDots() + '</div><div class="sl">' + phase.tag + '</div></div></div>';

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
    if (q('[data-show-more]')) { showMoreBoard(); return; }
    if (q('[data-phase-advance]')) { phaseAdvance(); return; }
    if (q('[data-proceed-portal]')) { proceedToRecruiting(); return; }
    if ((m = q('[data-skill-dec]'))) { deallocateSkillPoint(m.getAttribute('data-skill-dec')); return; }
    if ((m = q('[data-skill-inc]'))) { allocateSkillPoint(m.getAttribute('data-skill-inc')); return; }
    if (q('[data-finish-skills]')) { finishSkillPoints(); return; }
    if ((m = q('[data-apply-job]'))) { applyForJob(parseInt(m.getAttribute('data-apply-job'), 10)); return; }
    if (q('[data-stay]')) { stayAtSchool(); return; }
    if (q('[data-fired-go]')) { proceedFromFired(); return; }
    // Portal rows (portal.js HTML lives in this container)
    if ((m = q('[data-ppick]'))) { portalPickup(parseInt(m.getAttribute('data-ppick'), 10)); return; }
    if (q('[data-pshowmore]')) { showMorePortal(); return; }
    if (q('[data-padvance]')) { advanceFromPortal(); return; }
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
  if (userGeo === 'HOME') h += '<span class="geo-badge geo-home">HOME</span>';
  else if (userGeo === 'REGION') h += '<span class="geo-badge geo-region">REGION</span>';
  var gatePrestige = SCHOOL_RECRUIT_GATES[r.stars] || 0;
  if (sp < gatePrestige) h += '<span class="geo-badge geo-long">LONG SHOT</span>';
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

// +/- stepper row (44px touch targets). kind: 'detail' | 'target'
function stepperRow(r, left, removable) {
  var pts = r.points || 0;
  var h = '<div style="display:flex;align-items:center;gap:10px;">'
    + '<button class="stepper' + (pts >= 5 ? '' : ' off') + '" data-pt-dec="' + r.id + '" aria-label="Remove 5 points from ' + r.name + '" aria-disabled="' + (pts >= 5 ? 'false' : 'true') + '">−</button>'
    + '<div class="pts-val" data-pts-val="' + r.id + '">' + pts + '</div>'
    + '<button class="stepper plus' + (left >= 5 ? '' : ' off') + '" data-pt-inc="' + r.id + '" aria-label="Add 5 points to ' + r.name + '" aria-disabled="' + (left >= 5 ? 'false' : 'true') + '">+</button>'
    + '<span style="font-size:11px;color:var(--txt3);">pts</span>'
    + '<div style="flex:1;"></div>';
  if (removable) h += '<button class="btn btn-ghost btn-sm" data-rem-target="' + r.id + '">REMOVE</button>';
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

  var h = '<div style="margin-bottom:14px;"><div class="sec-head">Roster Turnover</div>'
    + '<div class="sec-sub">Offseason ' + G.yr + ' · ' + t.name + ' — review departures before recruiting</div></div>';

  h += '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);">'
    + '<div class="stat-cell"><div class="sv" style="color:var(--red);">' + dep.length + '</div><div class="sl">Departing</div></div>'
    + '<div class="stat-cell"><div class="sv" style="color:var(--grn2);">' + returning.length + '</div><div class="sl">Returning</div></div>'
    + '<div class="stat-cell"><div class="sv" style="color:var(--gld2);">' + openSpots + '</div><div class="sl">Open spots</div></div>'
    + '<div class="stat-cell"><div class="sv">' + lostMins + '</div><div class="sl">Mins to replace</div></div></div>';

  if (needs.length) {
    h += '<div class="card" style="border-left:4px solid var(--red);font-size:13px;font-weight:700;color:var(--red);">'
      + 'Position needs: ' + needs.join(', ') + ' <span style="font-weight:500;color:var(--txt2);">— target these in recruiting</span></div>';
  }

  h += '<div class="grid-2">';

  // Departing
  h += '<div class="card"><div class="card-title">Departing · ' + dep.length + '</div>';
  if (dep.length) {
    dep.forEach(function(d) {
      var reasonCol = d.reason === 'Graduated' ? 'var(--txt3)' : 'var(--gld2)';
      h += '<div class="leader-row"><span class="pos-chip">' + d.pos + '</span>'
        + '<div class="leader-name">' + d.name + '<small>' + d.cls + ' · ' + d.ppg + ' PPG · ' + d.rpg + ' RPG · ' + (d.apg || '0.0') + ' APG · ' + d.mins + ' MIN</small></div>'
        + '<div style="text-align:right;"><div class="leader-val" style="color:var(--red);">' + d.ovr + '</div>'
        + '<div style="font-size:10px;font-weight:700;color:' + reasonCol + ';">' + d.reason + '</div></div></div>';
    });
  } else {
    h += '<div style="padding:20px 0;text-align:center;color:var(--txt3);font-size:13px;">No players departing. Full squad returning.</div>';
  }
  h += '</div>';

  // Returning — FULL roster, no truncation
  returning.sort(function(a, b) { return b.ovr - a.ovr; });
  h += '<div class="card"><div class="card-title">Returning · ' + returning.length + '</div>';
  returning.forEach(function(p) {
    var gp = p.s.gp || 0;
    var ppg = gp ? (p.s.pts / gp).toFixed(1) : '--';
    var rpg = gp ? (p.s.reb / gp).toFixed(1) : '--';
    var apg = gp ? (p.s.ast / gp).toFixed(1) : '--';
    var pot = p.pot || p.ovr;
    var potCol = pot > p.ovr + 8 ? 'var(--grn2)' : pot > p.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
    h += '<div class="leader-row"><span class="pos-chip">' + p.pos + '</span>'
      + '<div class="leader-name">' + p.name + ' <span style="font-size:10px;font-weight:800;color:var(--blu);">' + p.cls + '</span>'
      + '<small>' + ppg + ' PPG · ' + rpg + ' RPG · ' + apg + ' APG · ' + p.mins + ' MIN</small></div>'
      + '<div style="text-align:right;"><div class="leader-val" style="color:var(--blu);">' + p.ovr + '</div>'
      + '<div style="font-size:10px;font-weight:700;color:' + potCol + ';">POT ' + pot + '</div></div></div>';
  });
  h += '</div>';

  h += '</div>'; // close grid-2

  h += '<button class="btn-big btn-full" style="margin-top:8px;" data-proceed-portal>PROCEED TO TRANSFER PORTAL ▶</button>';
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

  var h = '<div style="max-width:600px;margin:0 auto;padding:24px 4px;text-align:center;">'
    + '<div style="font-size:48px;margin-bottom:12px;">\ud83d\udea8</div>'
    + '<div class="tag t-rival" style="margin-bottom:10px;">End of the road</div>'
    + '<div style="font-size:30px;font-weight:900;color:var(--red);margin:8px 0;">YOU\'VE BEEN FIRED</div>'
    + '<div style="font-size:13px;color:var(--txt2);margin-bottom:20px;">' + schoolName + ' has relieved you of your duties after a ' + record + ' season.</div>';

  h += '<div class="card" style="text-align:left;margin-bottom:16px;">'
    + '<div class="card-title">Coach ' + c.firstName + ' ' + c.lastName + '</div>'
    + '<div class="stat-strip" style="grid-template-columns:repeat(4,1fr);margin-bottom:0;">'
    + '<div class="stat-cell"><div class="sv">' + c.age + '</div><div class="sl">Age</div></div>'
    + '<div class="stat-cell"><div class="sv">' + c.careerWins + '-' + c.careerLoss + '</div><div class="sl">Career</div></div>'
    + '<div class="stat-cell"><div class="sv">' + (c.titles || 0) + '</div><div class="sl">Titles</div></div>'
    + '<div class="stat-cell"><div class="sv">' + c.history.length + '</div><div class="sl">Seasons</div></div>'
    + '</div></div>';

  h += '<div style="font-size:12px;color:var(--txt3);margin-bottom:20px;">Your reputation has taken a hit. Fewer schools will be interested, but there\'s always a program looking for a fresh start.</div>'
    + '<button class="btn-big btn-full" data-fired-go>FIND A NEW JOB ▶</button>'
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
    + '<div style="text-align:center;margin-bottom:18px;">'
    + '<div class="tag t-cf" style="margin-bottom:8px;">Coaching development</div>'
    + '<div style="font-size:26px;font-weight:900;margin:8px 0 4px;">Skill Points</div>'
    + '<div style="font-size:12px;color:var(--txt2);">You earned <b style="color:var(--grn2);">' + G.skillPointsEarned + '</b> skill point' + (G.skillPointsEarned !== 1 ? 's' : '') + ' this season.</div></div>';

  h += '<div class="card" style="text-align:center;"><div style="font-size:34px;font-weight:900;color:' + (pts > 0 ? 'var(--grn2)' : 'var(--txt3)') + ';">' + pts + '</div>'
    + '<div style="font-size:11px;color:var(--txt3);font-weight:700;letter-spacing:1px;">POINTS REMAINING</div></div>';

  var ratings = [
    { key: 'off', label: 'Offense', desc: 'Boosts your team\u2019s scoring output', icon: '\ud83c\udfc0' },
    { key: 'def', label: 'Defense', desc: 'Reduces opponent scoring', icon: '\ud83d\udee1\ufe0f' },
    { key: 'dev', label: 'Development', desc: 'Players improve faster in offseason', icon: '\ud83d\udcc8' },
    { key: 'rec', label: 'Recruiting', desc: 'Stronger bids, bigger budget', icon: '\ud83c\udf1f' }
  ];

  ratings.forEach(function(r) {
    var val = c[r.key] || 70;
    var initVal = (_skillInitial && _skillInitial[r.key]) || val;
    var canAdd = pts > 0 && val < 99;
    var canRemove = val > initVal;
    var pct = Math.round((val - 40) / 59 * 100);
    h += '<div class="skill-row">'
      + '<div style="font-size:26px;flex-shrink:0;" aria-hidden="true">' + r.icon + '</div>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;">' + r.label + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + r.desc + '</div>'
      + '<div class="skill-bar"><div class="skill-fill" style="width:' + pct + '%;"></div></div></div>'
      + '<button class="stepper' + (canRemove ? '' : ' off') + '" data-skill-dec="' + r.key + '" aria-label="Remove point from ' + r.label + '" aria-disabled="' + (canRemove ? 'false' : 'true') + '">−</button>'
      + '<div class="pts-val" style="color:var(--blu);">' + val + '</div>'
      + '<button class="stepper plus' + (canAdd ? '' : ' off') + '" data-skill-inc="' + r.key + '" aria-label="Add point to ' + r.label + '" aria-disabled="' + (canAdd ? 'false' : 'true') + '">+</button>'
      + '</div>';
  });

  h += '<button class="btn-big btn-full" style="margin-top:12px;" data-finish-skills>CONTINUE ▶</button></div>';
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

function renderCarousel() {
  var jobs = generateOpenJobs();
  var c = G.coach;
  var currentTeam = G.teams[G.tid];
  var fired = isFiredCoach();

  var h = '<div style="max-width:800px;margin:0 auto;">'
    + '<div style="margin-bottom:14px;"><div class="sec-head">Job Market</div>'
    + '<div class="sec-sub">Coaching carousel · ' + c.firstName + ' ' + c.lastName + ' · Age ' + c.age + ' · Career ' + c.careerWins + '-' + c.careerLoss + '</div></div>';

  // Stay option — hidden for fired coaches (R4)
  if (!fired) {
    h += '<div class="card" style="border-left:4px solid var(--grn);">'
      + '<div style="display:flex;align-items:center;gap:12px;">' + teamLogo(currentTeam.name, 'sm')
      + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:800;">Stay at ' + currentTeam.name + '</div>'
      + '<div style="font-size:12px;color:var(--txt3);margin-top:2px;">' + currentTeam.conf + ' · Prestige ' + (currentTeam.schoolPrestige || '?') + ' · Year ' + (c.tenure + 1) + ' tenure</div></div>'
      + '<button class="btn btn-ghost" data-stay>STAY</button></div></div>';
  }

  if (jobs.length) {
    h += '<div class="strat-sec-label">' + jobs.length + ' open positions</div><div class="job-grid">';
    jobs.forEach(function(job) {
      var jobId = job.team.id;
      if (_rejectedJobs.indexOf(jobId) >= 0) return; // hide rejected jobs by stable team id (R3)
      var chance = calcOfferChance(job);
      var t = job.team;
      h += '<div class="card" style="margin-bottom:0;">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' + teamLogo(t.name, 'sm')
        + '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:800;">' + t.name + '</div>'
        + '<div style="font-size:11px;color:var(--txt3);">' + t.conf + ' · OVR ' + (t.baseOvr || '?') + ' · Prestige ' + (t.schoolPrestige || '?') + '</div></div></div>'
        + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;">Previous: ' + job.firedCoach + ' · ' + job.reason + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div class="chance" style="color:' + chanceColor(chance) + ';">' + chance + '% chance</div>'
        + '<button class="btn btn-red btn-sm" data-apply-job="' + jobId + '">APPLY</button>'
        + '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div class="card" style="text-align:center;color:var(--txt3);font-size:13px;">No coaching vacancies this year.</div>';
  }

  if (!fired) {
    h += '<div style="text-align:center;margin-top:14px;font-size:11px;color:var(--txt3);">You can also skip the carousel and stay at your current school.</div>';
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

      addLog('ev', G.gi, 'Coach ' + G.coach.lastName + ' accepts the job at <b>' + newTeam.name + '</b>!');
      toast('Welcome to ' + newTeam.name + '!', 'var(--grn)');
      G.offseasonStep = 'turnover';
      _rejectedJobs = [];
      saveState(); updateAll(); renderOffseason();
    });
  } else {
    // Rejected — show modal and remove from list (by stable team id)
    _rejectedJobs.push(jobId);
    showJobModal(job, false, function() {
      renderOffseason();
    });
  }
}
window.applyForJob = applyForJob;

function showJobModal(job, offered, onContinue) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,25,50,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  var headCol = offered ? 'var(--grn2)' : 'var(--red)';
  var content = '<div style="background:#fff;border:1px solid var(--bdr);border-radius:14px;padding:28px;width:min(420px,100%);text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.3);">'
    + '<div class="tag" style="background:' + (offered ? 'var(--grn-soft)' : 'var(--red-soft)') + ';color:' + headCol + ';margin-bottom:10px;">' + (offered ? 'Job offered' : 'Not interested') + '</div>'
    + '<div style="font-size:24px;font-weight:900;margin:8px 0 4px;">' + job.team.name + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px;">' + job.team.conf + ' \u00b7 Prestige ' + (job.team.schoolPrestige || '?') + '</div>';
  if (offered) {
    content += '<div style="font-size:13px;color:var(--txt2);margin-bottom:20px;">The program wants you to lead them to glory. Do you accept?</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="job-decline" class="btn btn-ghost" style="flex:1;">DECLINE</button>'
      + '<button id="job-accept" class="btn btn-red" style="flex:1;">ACCEPT</button>'
      + '</div>';
  } else {
    content += '<div style="font-size:13px;color:var(--txt3);margin-bottom:20px;">' + job.team.name + ' has decided to go in a different direction.</div>'
      + '<button id="job-ok" class="btn btn-ghost btn-full">OK</button>';
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

function renderBoard(open, left) {
  var h = '';
  // Filters — 44px selects, stacked on narrow screens
  h += '<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap;">';
  h += '<select class="rc-select" data-rfilter="pos" aria-label="Filter by position">';
  ['All', 'PG', 'SG', 'SF', 'PF', 'C'].forEach(function(p) {
    h += '<option value="' + p + '"' + ((_filter.pos === p) ? ' selected' : '') + '>' + (p === 'All' ? 'All positions' : p) + '</option>';
  });
  h += '</select>';
  h += '<select class="rc-select" data-rfilter="stars" aria-label="Filter by stars">';
  [{ v: 0, l: 'All stars' }, { v: 5, l: '5\u2605' }, { v: 4, l: '4\u2605+' }, { v: 3, l: '3\u2605+' }, { v: 2, l: '2\u2605+' }].forEach(function(o) {
    h += '<option value="' + o.v + '"' + ((_filter.stars === o.v) ? ' selected' : '') + '>' + o.l + '</option>';
  });
  h += '</select>';
  h += '<div style="flex:1;"></div>';
  h += '<div style="font-size:11px;color:var(--txt3);">' + open.length + ' available</div></div>';

  // Filter
  var filtered = open.filter(function(r) {
    if (_filter.pos !== 'All' && r.pos !== _filter.pos) return false;
    if (_filter.stars > 0 && r.stars < _filter.stars) return false;
    return true;
  });

  // Show detail panel if active
  if (_detailId >= 0) {
    var dr = G.recruits.find(function(x) { return x.id === _detailId; });
    if (dr) h += renderDetailPanel(dr, left);
  }

  // List (R5: capped at _boardShown rows with show-more)
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  filtered.slice(0, _boardShown).forEach(function(r) {
    var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
    var stName = STATE_NAMES[r.homeState] || r.homeState;
    var potCol = r.pot > r.ovr + 8 ? 'var(--grn2)' : r.pot > r.ovr + 3 ? 'var(--gld2)' : 'var(--txt3)';
    h += '<div class="rc-row' + (isTarget ? ' is-target' : '') + (r.id === _detailId ? ' open' : '') + '" data-rid="' + r.id + '" role="button" tabindex="0" aria-label="View ' + r.name + '">'
      + '<div class="leader-rank">#' + r.natRank + '</div>'
      + '<span class="pos-chip">' + r.pos + '</span>'
      + '<div class="leader-name">' + r.name + geoBadges(r, sp)
      + '<small><span style="color:var(--gld2);">' + starStr(r.stars) + '</span> · ' + stName + (isTarget ? ' · <span style="color:var(--blu);font-weight:800;">TARGETED</span>' : '') + '</small></div>'
      + '<div class="rc-ovr"><b style="color:var(--blu);">' + r.ovr + '</b><small style="color:' + potCol + ';">POT ' + (r.pot || r.ovr) + '</small></div>'
      + '</div>';
  });
  if (!filtered.length) h += '<div class="card" style="text-align:center;color:var(--txt3);font-size:13px;">No recruits match filters.</div>';
  else if (filtered.length > _boardShown) {
    h += '<button class="btn btn-ghost btn-full" style="margin-top:6px;" data-show-more>SHOW MORE (' + (filtered.length - _boardShown) + ' remaining)</button>';
  }
  return h;
}

// ═══════════════════════════════════════════════════════════
//  DETAIL PANEL
// ═══════════════════════════════════════════════════════════

function renderDetailPanel(r, left) {
  var stName = STATE_NAMES[r.homeState] || r.homeState;
  var isTarget = G.recruitTargets.indexOf(r.id) >= 0;
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;

  var h = '<div class="card" style="border-color:var(--blu2);">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">'
    + '<div><div style="font-size:17px;font-weight:900;">' + r.name + '</div>'
    + '<div style="font-size:12px;color:var(--gld2);font-weight:700;margin-top:2px;">' + starStr(r.stars) + ' · #' + r.natRank + ' National · #' + r.posRank + ' ' + r.pos + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:2px;">OVR ' + r.ovr + ' · POT ' + (r.pot || r.ovr) + ' · ' + stName + geoBadges(r, sp) + '</div></div>'
    + '<button class="btn btn-ghost btn-sm" data-close-detail aria-label="Close details">✕</button></div>';

  if (!isTarget) {
    h += '<button class="btn btn-red" style="margin-bottom:12px;" data-add-target="' + r.id + '">+ ADD TO TARGETS</button>';
  } else {
    h += '<div style="font-size:11px;font-weight:800;color:var(--blu);letter-spacing:1px;margin-bottom:8px;">TARGETED</div>';
    h += '<div style="margin-bottom:12px;">' + stepperRow(r, left, true) + '</div>';
  }

  h += '<div class="strat-sec-label" style="margin-top:4px;">Schools in the race</div>'
    + '<div data-schools-for="' + r.id + '" data-schools-n="0">' + schoolRaceHTML(r, 0) + '</div>';
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  TARGETS TAB
// ═══════════════════════════════════════════════════════════

function renderTargets(left) {
  if (!G.recruitTargets.length) {
    return '<div class="card" style="text-align:center;color:var(--txt3);font-size:13px;">No targets yet. Browse the Board and add recruits you want to pursue.</div>';
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

    h += '<div class="card"' + (leading ? ' style="border-left:3px solid var(--grn);"' : '') + '>';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<div class="leader-rank">#' + r.natRank + '</div>'
      + '<span class="pos-chip">' + r.pos + '</span>'
      + '<div class="leader-name" style="flex:1;">' + r.name
      + '<small><span style="color:var(--gld2);">' + starStr(r.stars) + '</span> · OVR ' + r.ovr + ' · ' + (STATE_NAMES[r.homeState] || r.homeState) + '</small></div>'
      + '<div class="leader-val" data-user-pct="' + r.id + '" style="color:' + pctCol + ';">' + userPct + '%</div></div>';

    h += '<div style="margin-bottom:10px;">' + stepperRow(r, left, true) + '</div>';

    h += '<div data-schools-for="' + r.id + '" data-schools-n="3">' + schoolRaceHTML(r, 3) + '</div>';
    h += '</div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  COMMITS TAB
// ═══════════════════════════════════════════════════════════

function renderCommits(commits) {
  if (!commits.length) return '<div class="card" style="text-align:center;color:var(--txt3);font-size:13px;">No commits yet. Target recruits and advance phases.</div>';
  var avgOvr = Math.round(commits.reduce(function(s, r) { return s + r.ovr; }, 0) / commits.length);
  var h = '<div style="margin-bottom:10px;font-size:12px;color:var(--txt2);">' + commits.length + ' commit' + (commits.length > 1 ? 's' : '') + ' · Avg OVR ' + avgOvr + '</div>';
  commits.forEach(function(r) {
    h += '<div class="leader-row" style="background:#fff;border:1px solid var(--bdr);border-left:3px solid var(--grn);border-radius:10px;padding:10px 14px;margin-bottom:6px;">'
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

  h += '<div class="stat-strip" style="grid-template-columns:repeat(5,1fr);">';
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
      + '<small>' + ppg + ' PPG · ' + p.mins + ' MIN</small></div>'
      + '<div class="leader-val" style="color:var(--blu);font-size:15px;">' + p.ovr + '</div></div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS
// ═══════════════════════════════════════════════════════════
export function resolvePitchWeek(id) { adjustPoints(id, 5); return { userBoost: 5, rivals: [], signed: -1 }; }
export function pitchRecruit(id) { adjustPoints(id, 5); }
