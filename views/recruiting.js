// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  3-Phase Recruiting System
//  Phase 1: Evaluation Period — scout & invest
//  Phase 2: Early Signing — first decisions, refunds, reinvest
//  Phase 3: Late Signing — final decisions, close the class
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G, SetupState, saveState, calcRecruitingBudget } from '../state.js';

// ── Late-binding ─────────────────────────────────────────
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
//  PHASE CONFIG
// ═══════════════════════════════════════════════════════════

var PHASES = {
  1: {
    name: 'Evaluation Period',
    tag: 'PHASE 1 OF 3',
    desc: 'Scout the board. Invest points to build relationships. No one commits yet.',
    btnLabel: 'ADVANCE TO EARLY SIGNING \u25b6',
    btnAction: 'advanceRecruitPhase()',
    decisionRate: 0.30,    // 30% of open recruits decide
    cpuAggression: 0.8     // CPU is mild
  },
  2: {
    name: 'Early Signing Period',
    tag: 'PHASE 2 OF 3',
    desc: 'Top prospects make decisions. Refunded points from decided recruits can be reinvested.',
    btnLabel: 'ADVANCE TO LATE SIGNING \u25b6',
    btnAction: 'advanceRecruitPhase()',
    decisionRate: 0.55,    // 55% of remaining open decide
    cpuAggression: 1.1     // CPU gets aggressive
  },
  3: {
    name: 'Late Signing Period',
    tag: 'PHASE 3 OF 3',
    desc: 'Final chance. All remaining recruits make their decision.',
    btnLabel: 'FINALIZE CLASS & START SEASON \u25b6',
    btnAction: 'doOffseason()',
    decisionRate: 1.0,     // everyone decides
    cpuAggression: 1.4     // desperation mode
  }
};

// ═══════════════════════════════════════════════════════════
//  INIT / BUDGET
// ═══════════════════════════════════════════════════════════

function initRecruitingIfNeeded() {
  if (G.recruitPhase === 0) {
    G.recruitPhase = 1;
    G.recruitingBudget = calcRecruitingBudget();
    G.recruitingSpent = 0;
  }
  G.recruits.forEach(function(r) {
    if (typeof r.points !== 'number') r.points = 0;
    if (typeof r.status !== 'string') {
      r.status = r.signed >= 0 ? (r.signed === G.tid ? 'committed' : 'gone') : 'open';
    }
  });
}

function getPointsLeft() {
  return G.recruitingBudget - G.recruitingSpent;
}

function recalcSpent() {
  G.recruitingSpent = G.recruits.reduce(function(sum, r) {
    return sum + (r.status === 'open' ? (r.points || 0) : 0);
  }, 0);
}

// ═══════════════════════════════════════════════════════════
//  ADJUST POINTS (+/- stepper, increments of 5)
// ═══════════════════════════════════════════════════════════

export function adjustPoints(recruitId, delta) {
  var r = G.recruits.find(function(x) { return x.id === recruitId; });
  if (!r || r.status !== 'open') return;

  var newVal = (r.points || 0) + delta;
  if (newVal < 0) return;
  if (delta > 0 && getPointsLeft() < delta) return;

  r.points = newVal;
  recalcSpent();

  saveState();
  renderOffseason();
}

window.adjustPoints = adjustPoints;

// ═══════════════════════════════════════════════════════════
//  PHASE RESOLUTION — the heart of the system
//  Called when user clicks the advance button.
//  Resolves a % of open recruits based on phase config.
//  Refunds points from decided recruits.
// ═══════════════════════════════════════════════════════════

export function advanceRecruitPhase() {
  var phase = PHASES[G.recruitPhase];
  if (!phase) return;

  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var userPrestigeMod = 0.6 + (G.prestige / 5) * 0.8;
  var cpuAgg = phase.cpuAggression;

  // Get open recruits
  var open = G.recruits.filter(function(r) { return r.status === 'open'; });

  // Determine how many decide this phase
  var numDeciding = Math.max(1, Math.round(open.length * phase.decisionRate));

  // Sort by total attention (user points + interest) to decide highest-profile first
  open.sort(function(a, b) {
    return ((b.points || 0) + b.interest) - ((a.points || 0) + a.interest);
  });

  var deciding = open.slice(0, numDeciding);
  var newCommits = [];
  var newGone = [];
  var refunded = 0;

  deciding.forEach(function(r) {
    // User's bid strength: points * prestige + interest buildup
    var userScore = (r.points || 0) * userPrestigeMod * 1.5 + r.interest * 0.4;

    // CPU competition — 2-4 rivals, power-scaled
    var rivalCount = Math.floor(Math.random() * 3) + 2;
    var pool = ranked.slice(0, 60).filter(function(t) { return t.id !== G.tid; });
    pool.sort(function() { return 0.5 - Math.random(); });
    var rivals = pool.slice(0, rivalCount);

    var bestRivalScore = 0;
    var bestRival = null;
    rivals.forEach(function(rival) {
      var rivalRank = ranked.findIndex(function(t) { return t.id === rival.id; }) + 1;
      var rivalPower = rivalRank <= 10 ? 1.5 : rivalRank <= 25 ? 1.2 : rivalRank <= 64 ? 0.9 : 0.6;
      // Higher star recruits attract stronger CPU bids
      var starBonus = r.stars >= 4 ? 1.3 : r.stars >= 3 ? 1.0 : 0.7;
      var cpuBid = (Math.random() * 35 + 15) * rivalPower * starBonus * cpuAgg;
      if (cpuBid > bestRivalScore) { bestRivalScore = cpuBid; bestRival = rival; }
    });

    // Decision logic
    if (r.points >= 10 && userScore > bestRivalScore) {
      // Clear win — user lands them
      r.signed = G.tid;
      r.status = 'committed';
      newCommits.push(r);
    } else if (r.points >= 5 && userScore > bestRivalScore * 0.85 && Math.random() < 0.35) {
      // Close — user edges it out
      r.signed = G.tid;
      r.status = 'committed';
      newCommits.push(r);
    } else if (r.points > 0 && userScore > bestRivalScore * 0.7 && Math.random() < 0.15) {
      // Upset pull — unlikely but possible
      r.signed = G.tid;
      r.status = 'committed';
      newCommits.push(r);
    } else if (bestRival) {
      // CPU wins or recruit goes elsewhere
      var cpuSignChance = r.stars >= 4 ? 0.65 : r.stars >= 3 ? 0.50 : 0.35;
      cpuSignChance *= cpuAgg;
      if (Math.random() < cpuSignChance) {
        r.signed = bestRival.id;
        r.status = 'gone';
        r.goneTo = bestRival.name;
        newGone.push(r);
      }
      // else: stays open for next phase
    }

    // Refund points from decided recruits
    if (r.status !== 'open' && r.points > 0) {
      refunded += r.points;
      r.points = 0;
    }
  });

  // Recalculate budget with refunds
  recalcSpent();

  // Log results
  newCommits.forEach(function(r) {
    addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b>');
  });
  newGone.forEach(function(r) {
    addLog('ev', G.gi, r.name + ' signed with <b>' + (r.goneTo || 'another school') + '</b>.');
  });

  // Toast summary
  var parts = [];
  if (newCommits.length) parts.push(newCommits.length + ' commit' + (newCommits.length > 1 ? 's' : ''));
  if (newGone.length) parts.push(newGone.length + ' lost');
  if (refunded > 0) parts.push(refunded + ' pts refunded');
  var remaining = G.recruits.filter(function(r) { return r.status === 'open'; }).length;
  parts.push(remaining + ' still open');
  toast(phase.name + ': ' + parts.join(' \u00b7 '), newCommits.length ? 'var(--grn)' : 'var(--gld)');

  // Advance phase
  if (G.recruitPhase < 3) {
    G.recruitPhase++;
  }
  // Phase 3 advance is handled by doOffseason() button

  saveState();
  updateAll();
  renderOffseason();
}

window.advanceRecruitPhase = advanceRecruitPhase;

// ═══════════════════════════════════════════════════════════
//  FINAL RESOLUTION (called by doOffseason for Phase 3)
//  Resolves ALL remaining open recruits.
// ═══════════════════════════════════════════════════════════

export function resolveRecruitingClass() {
  if (G.recruitPhase < 3) {
    // If somehow called early, run through remaining phases
    while (G.recruitPhase < 3) {
      advanceRecruitPhase();
    }
  }

  // Final pass: force-decide everyone still open
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var userPrestigeMod = 0.6 + (G.prestige / 5) * 0.8;

  G.recruits.forEach(function(r) {
    if (r.status !== 'open') return;

    var userScore = (r.points || 0) * userPrestigeMod * 1.5 + r.interest * 0.4;
    var pool = ranked.slice(0, 50).filter(function(t) { return t.id !== G.tid; });
    pool.sort(function() { return 0.5 - Math.random(); });
    var rival = pool[0];
    var rivalRank = rival ? ranked.findIndex(function(t) { return t.id === rival.id; }) + 1 : 99;
    var rivalPower = rivalRank <= 10 ? 1.5 : rivalRank <= 25 ? 1.2 : rivalRank <= 64 ? 0.9 : 0.6;
    var cpuBid = (Math.random() * 35 + 15) * rivalPower * 1.4 * (r.stars >= 4 ? 1.3 : 1.0);

    if (r.points >= 5 && userScore > cpuBid * 0.7) {
      r.signed = G.tid;
      r.status = 'committed';
      addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b> (late)');
    } else if (rival) {
      r.signed = rival.id;
      r.status = 'gone';
      r.goneTo = rival.name;
    } else {
      r.status = 'gone';
      r.signed = -1;
    }
    r.points = 0;
  });

  var totalCommits = G.recruits.filter(function(r) { return r.signed === G.tid; });
  toast('Class finalized: ' + totalCommits.length + ' signee' + (totalCommits.length !== 1 ? 's' : '') + '!',
    totalCommits.length >= 3 ? 'var(--grn)' : 'var(--gld)');

  // Reset recruiting state for next cycle
  G.recruitPhase = 0;
  G.recruitingBudget = 0;
  G.recruitingSpent = 0;
  saveState();
}

window.resolveRecruitingClass = resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  RENDER — the main offseason view
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content');
  if (!el) return;

  initRecruitingIfNeeded();

  var phase = PHASES[G.recruitPhase] || PHASES[1];
  var budget = G.recruitingBudget;
  var left = getPointsLeft();
  var spent = G.recruitingSpent;
  var pctUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var commits = G.recruits.filter(function(r) { return r.status === 'committed'; });
  var gone = G.recruits.filter(function(r) { return r.status === 'gone'; });

  var h = '';

  // ── Header with phase indicator ──
  h += '<div style="margin-bottom:14px;">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">'
    + '<div style="font-size:20px;font-weight:900;">Offseason ' + G.yr + '</div>'
    + '<div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1.5px;background:rgba(229,62,62,.1);padding:3px 10px;border-radius:4px;border:1px solid rgba(229,62,62,.2);">' + phase.tag + '</div>'
    + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:3px;">' + phase.name + '</div>'
    + '<div style="font-size:11px;color:var(--txt2);">' + phase.desc + '</div>'
    + '</div>';

  // ── Phase progress dots ──
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;">';
  for (var pi = 1; pi <= 3; pi++) {
    var dotState = pi < G.recruitPhase ? 'done' : pi === G.recruitPhase ? 'active' : 'future';
    var dotBg = dotState === 'done' ? 'var(--grn)' : dotState === 'active' ? 'var(--red)' : 'var(--bdr2)';
    var dotLabel = pi === 1 ? 'Eval' : pi === 2 ? 'Early' : 'Late';
    h += '<div style="display:flex;align-items:center;gap:4px;">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:' + dotBg + ';' + (dotState === 'active' ? 'box-shadow:0 0 6px ' + dotBg + ';' : '') + '"></div>'
      + '<span style="font-size:10px;font-weight:700;color:' + (dotState === 'future' ? 'var(--txt3)' : '#fff') + ';">' + dotLabel + '</span>'
      + '</div>';
    if (pi < 3) h += '<div style="flex:1;height:2px;background:' + (pi < G.recruitPhase ? 'var(--grn)' : 'var(--bdr2)') + ';"></div>';
  }
  h += '</div>';

  // ── Budget bar ──
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
    + '<span>Prestige ' + G.prestige + '/5 \u00b7 ' + open.length + ' open \u00b7 ' + commits.length + ' committed \u00b7 ' + gone.length + ' gone</span>'
    + '<span>' + spent + ' pts active</span>'
    + '</div></div>';

  // ── Two-column layout ──
  h += '<div style="display:grid;grid-template-columns:1.4fr 0.6fr;gap:14px;">';

  // ══ LEFT: Big Board ══
  h += '<div class="card"><div class="card-title">Big Board \u2014 ' + phase.name + ' <span style="color:var(--txt2);">' + open.length + ' available</span></div>';

  if (!open.length) {
    h += '<div style="color:var(--txt3);font-size:12px;padding:16px 0;text-align:center;">All recruits have been decided.</div>';
  }

  open.forEach(function(r) {
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
    var pts = r.points || 0;
    var canAdd = left >= 5;
    var canSub = pts >= 5;

    // Heat indicator based on interest
    var heat = r.interest >= 75 ? 'HOT' : r.interest >= 45 ? 'WARM' : r.interest >= 20 ? 'COOL' : 'COLD';
    var heatCol = r.interest >= 75 ? 'var(--grn2)' : r.interest >= 45 ? 'var(--gld2)' : r.interest >= 20 ? 'var(--blu2)' : 'var(--txt3)';

    h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03);">';

    // Rank + star badge
    h += '<div style="width:20px;text-align:center;flex-shrink:0;">'
      + '<div style="font-size:9px;color:var(--txt3);font-family:monospace;">#' + (r.id + 1) + '</div>'
      + '</div>';

    // Player info
    h += '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.name + '</div>'
      + '<div style="font-size:8px;color:var(--gld2);flex-shrink:0;">' + stars + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:2px;">'
      + '<span style="font-size:10px;color:var(--txt3);">' + r.pos + ' \u00b7 OVR ' + r.ovr + '</span>'
      + '<span style="font-size:9px;font-weight:800;color:' + heatCol + ';">' + heat + '</span>'
      + '</div>'
      + '<div style="height:3px;background:var(--bdr2);border-radius:2px;margin-top:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + r.interest + '%;background:' + (r.interest >= 70 ? 'var(--grn)' : r.interest >= 40 ? 'var(--gld)' : 'var(--red)') + ';transition:width .2s;"></div>'
      + '</div>'
      + '</div>';

    // Point stepper
    h += '<div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">'
      + '<div onclick="adjustPoints(' + r.id + ',-5)" style="width:26px;height:26px;border-radius:4px;background:' + (canSub ? 'var(--s3)' : 'var(--s2)') + ';border:1px solid ' + (canSub ? 'var(--bdr2)' : 'var(--bdr)') + ';color:' + (canSub ? '#fff' : 'var(--txt3)') + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:' + (canSub ? 'pointer' : 'default') + ';user-select:none;">\u2212</div>'
      + '<div style="width:38px;text-align:center;font-family:monospace;font-size:14px;font-weight:800;color:' + (pts > 0 ? 'var(--red)' : 'var(--txt3)') + ';">' + pts + '</div>'
      + '<div onclick="adjustPoints(' + r.id + ',5)" style="width:26px;height:26px;border-radius:4px;background:' + (canAdd ? 'var(--red)' : 'var(--s2)') + ';border:1px solid ' + (canAdd ? 'var(--red)' : 'var(--bdr)') + ';color:' + (canAdd ? '#fff' : 'var(--txt3)') + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:' + (canAdd ? 'pointer' : 'default') + ';user-select:none;">+</div>'
      + '</div>';

    h += '</div>';
  });

  h += '</div>';

  // ══ RIGHT: Sidebar ══
  h += '<div style="display:flex;flex-direction:column;gap:12px;">';

  // Committed
  h += '<div class="card"><div class="card-title">Committed <span style="color:var(--grn2);">' + commits.length + '</span></div>';
  if (commits.length) {
    commits.forEach(function(r) {
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.025);">'
        + '<div><div style="font-size:11px;font-weight:600;color:#fff;">' + r.name + '</div>'
        + '<div style="font-size:9px;color:var(--gld2);">' + stars + ' \u00b7 ' + r.pos + '</div></div>'
        + '<div style="font-family:monospace;font-size:12px;font-weight:900;color:var(--grn2);">' + r.ovr + '</div>'
        + '</div>';
    });
  } else {
    h += '<div style="color:var(--txt3);font-size:11px;padding:8px 0;">No commits yet. Invest and advance.</div>';
  }
  h += '</div>';

  // Gone (lost recruits)
  if (gone.length) {
    h += '<div class="card"><div class="card-title">Signed Elsewhere <span style="color:var(--txt3);">' + gone.length + '</span></div>';
    gone.slice(0, 8).forEach(function(r) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02);font-size:10px;">'
        + '<span style="color:var(--txt3);">' + r.name + ' (' + r.stars + '\u2605)</span>'
        + '<span style="color:var(--txt3);font-style:italic;">' + (r.goneTo || '?') + '</span>'
        + '</div>';
    });
    if (gone.length > 8) h += '<div style="font-size:10px;color:var(--txt3);padding:4px 0;">+' + (gone.length - 8) + ' more</div>';
    h += '</div>';
  }

  // Pursuing summary
  var invested = open.filter(function(r) { return (r.points || 0) > 0; });
  if (invested.length) {
    h += '<div class="card"><div class="card-title">Pursuing <span style="color:var(--txt2);">' + invested.length + '</span></div>';
    invested.sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
    invested.forEach(function(r) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02);font-size:10px;">'
        + '<span style="color:var(--txt2);">' + r.name + '</span>'
        + '<span style="font-family:monospace;font-weight:700;color:var(--red);">' + r.points + '</span>'
        + '</div>';
    });
    h += '</div>';
  }

  // Advance button
  h += '<div class="btn btn-red btn-full" style="padding:14px;margin-top:4px;" onclick="' + phase.btnAction + '">' + phase.btnLabel + '</div>';

  // Strategy hint
  var hints = {
    1: 'Spread your points to build interest. No one commits yet \u2014 this is about positioning.',
    2: 'Some recruits will decide now. Points spent on committed/lost players come back. Reinvest wisely.',
    3: 'Everyone decides. Go all-in on your top remaining targets. Last chance.'
  };
  h += '<div style="font-size:10px;color:var(--txt3);line-height:1.5;margin-top:8px;padding:8px;background:rgba(255,255,255,.02);border-radius:4px;border:1px solid var(--bdr);">'
    + '\ud83c\udfc0 ' + (hints[G.recruitPhase] || '')
    + '</div>';

  h += '</div>'; // close right
  h += '</div>'; // close grid

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS
// ═══════════════════════════════════════════════════════════

export function resolvePitchWeek(recruitId) {
  adjustPoints(recruitId, 5);
  return { userBoost: 5, rivals: [], signed: -1 };
}

export function pitchRecruit(id, cost) {
  adjustPoints(id, 5);
}
