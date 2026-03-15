// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  Offseason view: Point Allocation recruiting system.
//  Budget-based model with +/- steppers per recruit.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G, SetupState, saveState, calcRecruitingBudget } from '../state.js';

// ── Late-binding for cross-module calls ──────────────────
var _ext = { toast: null, addLog: null, updateAll: null };

export function registerRecruitingCallbacks(callbacks) {
  Object.keys(callbacks).forEach(function(k) {
    if (_ext.hasOwnProperty(k)) _ext[k] = callbacks[k];
  });
}

function toast(msg, col) { if (_ext.toast) _ext.toast(msg, col); }
function addLog(type, wk, text) { if (_ext.addLog) _ext.addLog(type, wk, text); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }

// ═══════════════════════════════════════════════════════════
//  BUDGET HELPERS
// ═══════════════════════════════════════════════════════════

function getPointsLeft() {
  return G.recruitingBudget - G.recruitingSpent;
}

function initBudgetIfNeeded() {
  // Calculate budget on first visit to offseason
  if (G.recruitingBudget <= 0) {
    G.recruitingBudget = calcRecruitingBudget();
    G.recruitingSpent = 0;
  }
  // Ensure all recruits have points property
  G.recruits.forEach(function(r) {
    if (typeof r.points !== 'number') r.points = 0;
  });
}

// ═══════════════════════════════════════════════════════════
//  ADJUST POINTS (+/- stepper)
// ═══════════════════════════════════════════════════════════

export function adjustPoints(recruitId, delta) {
  var r = G.recruits.find(function(x) { return x.id === recruitId; });
  if (!r || r.signed >= 0) return;

  var newVal = (r.points || 0) + delta;
  // Can't go below 0
  if (newVal < 0) return;
  // Can't exceed budget
  if (delta > 0 && getPointsLeft() < delta) return;

  r.points = newVal;
  G.recruitingSpent = G.recruits.reduce(function(sum, rec) { return sum + (rec.points || 0); }, 0);

  // Update interest based on points allocated (every 5 pts = ~2-4% interest)
  r.interest = Math.min(100, r.interest + (delta > 0 ? Math.floor(Math.random() * 3) + 2 : -(Math.floor(Math.random() * 3) + 2)));
  r.interest = Math.max(0, r.interest);

  saveState();
  renderOffseason();
}

// Attach to window so onclick handlers work
window.adjustPoints = adjustPoints;

// ═══════════════════════════════════════════════════════════
//  RESOLVE ALL RECRUITS (called when advancing to next season)
//  Converts point allocations into commits/losses.
// ═══════════════════════════════════════════════════════════

export function resolveRecruitingClass() {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var userPrestigeMod = 0.6 + (G.prestige / 5) * 0.8;

  G.recruits.forEach(function(r) {
    if (r.signed >= 0) return; // already decided

    // User's commit chance based on points spent + interest + prestige
    var userScore = (r.points || 0) * userPrestigeMod + r.interest * 0.5;

    // CPU rivals compete — top programs make bids
    var rivalCount = Math.floor(Math.random() * 2) + 2;
    var pool = ranked.slice(0, 50).filter(function(t) { return t.id !== G.tid; });
    pool.sort(function() { return 0.5 - Math.random(); });
    var rivals = pool.slice(0, rivalCount);

    var bestRivalScore = 0;
    var bestRival = null;
    rivals.forEach(function(rival) {
      var rivalRank = ranked.findIndex(function(t) { return t.id === rival.id; }) + 1;
      var rivalPower = rivalRank <= 10 ? 1.4 : rivalRank <= 25 ? 1.1 : rivalRank <= 64 ? 0.85 : 0.6;
      var cpuBid = (Math.random() * 40 + 20) * rivalPower;
      if (cpuBid > bestRivalScore) { bestRivalScore = cpuBid; bestRival = rival; }
    });

    // Threshold: need a minimum investment to have a shot
    if (r.points >= 10 && userScore > bestRivalScore) {
      r.signed = G.tid;
    } else if (r.points >= 5 && userScore > bestRivalScore * 0.8 && Math.random() < 0.4) {
      // Close call — coin flip territory
      r.signed = G.tid;
    } else if (bestRival && Math.random() < 0.3) {
      // CPU signs them
      r.signed = bestRival.id;
    }
    // else: unsigned, will be available if user invests more next cycle
  });

  // Log results
  var commits = G.recruits.filter(function(r) { return r.signed === G.tid; });
  var lost = G.recruits.filter(function(r) { return r.signed >= 0 && r.signed !== G.tid && (r.points || 0) > 0; });

  commits.forEach(function(r) {
    addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b>');
  });
  lost.forEach(function(r) {
    var rivalName = G.teams[r.signed] ? G.teams[r.signed].name : 'a rival';
    addLog('ev', G.gi, r.name + ' signed with <b>' + rivalName + '</b>.');
  });

  if (commits.length) {
    toast(commits.length + ' recruit' + (commits.length > 1 ? 's' : '') + ' committed!', 'var(--grn)');
  } else {
    toast('No recruits committed this cycle.', 'var(--txt3)');
  }

  saveState();
}

// Attach to window for doOffseason to call
window.resolveRecruitingClass = resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  OFFSEASON VIEW — Point Allocation UI
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content');
  if (!el) return;

  initBudgetIfNeeded();

  var budget = G.recruitingBudget;
  var spent = G.recruitingSpent;
  var left = budget - spent;
  var pctUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  var h = '';

  // Header
  h += '<div style="margin-bottom:16px;">'
    + '<div style="font-size:20px;font-weight:900;margin-bottom:4px;">Offseason ' + G.yr + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);">Allocate recruiting points to land your class. Higher investment = better odds.</div>'
    + '</div>';

  // Budget bar
  h += '<div class="card" style="margin-bottom:14px;padding:14px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;">Recruiting Budget</div>'
    + '<div style="font-size:13px;font-weight:800;font-family:monospace;">'
    + '<span style="color:' + (left > 30 ? 'var(--grn2)' : left > 0 ? 'var(--gld2)' : '#fc8181') + ';">' + left + '</span>'
    + ' <span style="color:var(--txt3);">/ ' + budget + ' pts</span>'
    + '</div></div>'
    + '<div style="height:8px;background:var(--bdr2);border-radius:4px;overflow:hidden;">'
    + '<div style="height:100%;width:' + pctUsed + '%;background:' + (pctUsed < 70 ? 'var(--grn)' : pctUsed < 90 ? 'var(--gld)' : 'var(--red)') + ';border-radius:4px;transition:width .2s;"></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt3);margin-top:4px;">'
    + '<span>Prestige ' + G.prestige + '/5</span>'
    + '<span>' + spent + ' pts allocated</span>'
    + '</div></div>';

  // Two-column layout
  h += '<div style="display:grid;grid-template-columns:1.3fr 0.7fr;gap:14px;">';

  // ── LEFT: Big Board ──
  h += '<div class="card"><div class="card-title">Big Board <span style="color:var(--txt2);">Top Prospects</span></div>';

  var available = G.recruits.filter(function(r) { return r.signed < 0; });
  var gone = G.recruits.filter(function(r) { return r.signed >= 0 && r.signed !== G.tid; });

  if (!available.length) {
    h += '<div style="color:var(--txt3);font-size:12px;padding:12px 0;">All recruits have been decided.</div>';
  }

  available.slice(0, 20).forEach(function(r) {
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
    var pts = r.points || 0;
    var canAdd = left >= 5;
    var canSub = pts >= 5;

    h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.025);">';

    // Player info
    h += '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.name + '</div>'
      + '<div style="font-size:9px;color:var(--gld2);flex-shrink:0;">' + stars + '</div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">' + r.pos + ' \u00b7 OVR ' + r.ovr + '</div>'
      + '<div style="height:3px;background:var(--bdr2);border-radius:2px;margin-top:4px;overflow:hidden;">'
      + '<div style="height:100%;width:' + r.interest + '%;background:' + (r.interest >= 70 ? 'var(--grn)' : r.interest >= 40 ? 'var(--gld)' : 'var(--red)') + ';transition:width .2s;"></div>'
      + '</div>'
      + '<div style="font-size:9px;color:var(--txt3);margin-top:2px;">' + r.interest + '% interest</div>'
      + '</div>';

    // Point stepper
    h += '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">'
      + '<div onclick="adjustPoints(' + r.id + ',-5)" style="width:24px;height:24px;border-radius:4px;background:' + (canSub ? 'var(--s3)' : 'var(--s2)') + ';border:1px solid ' + (canSub ? 'var(--bdr2)' : 'var(--bdr)') + ';color:' + (canSub ? '#fff' : 'var(--txt3)') + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;cursor:' + (canSub ? 'pointer' : 'default') + ';user-select:none;">\u2212</div>'
      + '<div style="width:36px;text-align:center;font-family:monospace;font-size:13px;font-weight:800;color:' + (pts > 0 ? 'var(--red)' : 'var(--txt3)') + ';">' + pts + '</div>'
      + '<div onclick="adjustPoints(' + r.id + ',5)" style="width:24px;height:24px;border-radius:4px;background:' + (canAdd ? 'var(--red)' : 'var(--s2)') + ';border:1px solid ' + (canAdd ? 'var(--red)' : 'var(--bdr)') + ';color:' + (canAdd ? '#fff' : 'var(--txt3)') + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;cursor:' + (canAdd ? 'pointer' : 'default') + ';user-select:none;">+</div>'
      + '</div>';

    h += '</div>';
  });

  h += '</div>';

  // ── RIGHT: Commits + Advance ──
  h += '<div style="display:flex;flex-direction:column;gap:14px;">';

  // Commits panel
  var commits = G.recruits.filter(function(r) { return r.signed === G.tid; });
  h += '<div class="card"><div class="card-title">Committed <span style="color:var(--grn2);">' + commits.length + '</span></div>';
  if (commits.length) {
    commits.forEach(function(r) {
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.025);">'
        + '<div><div style="font-size:11px;font-weight:600;color:#fff;">' + r.name + '</div>'
        + '<div style="font-size:9px;color:var(--gld2);">' + stars + ' \u00b7 ' + r.pos + '</div></div>'
        + '<div style="font-family:monospace;font-size:13px;font-weight:900;color:var(--grn2);">' + r.ovr + '</div>'
        + '</div>';
    });
  } else {
    h += '<div style="color:var(--txt3);font-size:11px;padding:8px 0;">Allocate points and advance to resolve class.</div>';
  }
  h += '</div>';

  // Invested recruits summary
  var invested = G.recruits.filter(function(r) { return r.signed < 0 && (r.points || 0) > 0; });
  if (invested.length) {
    h += '<div class="card"><div class="card-title">Pursuing <span style="color:var(--txt2);">' + invested.length + '</span></div>';
    invested.sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
    invested.forEach(function(r) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.02);font-size:11px;">'
        + '<span style="color:var(--txt2);">' + r.name + '</span>'
        + '<span style="font-family:monospace;font-weight:700;color:var(--red);">' + r.points + ' pts</span>'
        + '</div>';
    });
    h += '</div>';
  }

  // Advance button
  h += '<div class="btn btn-red btn-full" style="margin-top:6px;padding:14px;" onclick="doOffseason()">RESOLVE CLASS & ADVANCE \u25b6</div>';

  // Info hint
  h += '<div style="font-size:10px;color:var(--txt3);line-height:1.5;margin-top:8px;">'
    + 'Points determine your bid strength against rival programs. Higher-starred recruits attract more CPU competition. '
    + 'Spread points across multiple targets or go all-in on your top choice.'
    + '</div>';

  h += '</div>'; // close right column
  h += '</div>'; // close grid

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS (kept for backward compat with main.js)
// ═══════════════════════════════════════════════════════════

export function resolvePitchWeek(recruitId) {
  // Legacy — redirect to point-based system
  adjustPoints(recruitId, 5);
  return { userBoost: 5, rivals: [], signed: -1 };
}

export function pitchRecruit(id, cost) {
  // Legacy — redirect to point-based system
  adjustPoints(id, 5);
}
