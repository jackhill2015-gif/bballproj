// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  3-Phase Recruiting with Geography, Rival Bids, Success Mods
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { TEAM_STATES, STATE_TO_REGION, STATE_NAMES, RECRUIT_PRESTIGE_GATES } from '../constants.js';
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
  1: { name:'Evaluation Period', tag:'PHASE 1 OF 3',
       desc:'Scout the board and invest. No decisions yet — build relationships.',
       btnLabel:'ADVANCE TO EARLY SIGNING \u25b6', btnAction:'advanceRecruitPhase()',
       decisionRate:0.30, cpuAggression:0.8 },
  2: { name:'Early Signing Period', tag:'PHASE 2 OF 3',
       desc:'Top prospects decide. Refunded points from decided recruits can be reinvested.',
       btnLabel:'ADVANCE TO LATE SIGNING \u25b6', btnAction:'advanceRecruitPhase()',
       decisionRate:0.55, cpuAggression:1.1 },
  3: { name:'Late Signing Period', tag:'PHASE 3 OF 3',
       desc:'Final chance. All remaining recruits make their decision.',
       btnLabel:'FINALIZE CLASS & START SEASON \u25b6', btnAction:'doOffseason()',
       decisionRate:1.0, cpuAggression:1.4 }
};

// ═══════════════════════════════════════════════════════════
//  GEOGRAPHY HELPERS
// ═══════════════════════════════════════════════════════════

function getTeamState(team) {
  return TEAM_STATES[team.name] || 'XX';
}

function getGeoBonus(teamState, recruitState) {
  if (!teamState || !recruitState || teamState === 'XX') return 0;
  if (teamState === recruitState) return 0.20;              // same state: +20%
  var teamReg = STATE_TO_REGION[teamState];
  var recReg = STATE_TO_REGION[recruitState];
  if (teamReg && teamReg === recReg) return 0.10;           // same region: +10%
  return 0;
}

function getGeoLabel(teamState, recruitState) {
  if (!teamState || !recruitState || teamState === 'XX') return '';
  if (teamState === recruitState) return 'HOME';
  var teamReg = STATE_TO_REGION[teamState];
  var recReg = STATE_TO_REGION[recruitState];
  if (teamReg && teamReg === recReg) return 'REGION';
  return '';
}

// ═══════════════════════════════════════════════════════════
//  BID CALCULATION (used for display AND resolution)
// ═══════════════════════════════════════════════════════════

function calcUserBid(recruit) {
  var userPrestigeMod = 0.6 + (G.prestige / 5) * 0.8;
  var userState = getTeamState(G.teams[G.tid]);
  var geoBonus = getGeoBonus(userState, recruit.homeState);
  var baseBid = ((recruit.points || 0) * userPrestigeMod * 1.5 + recruit.interest * 0.4) * (1 + geoBonus);

  // Apply prestige gate — harsh penalty if you're below the threshold
  var gate = RECRUIT_PRESTIGE_GATES[recruit.stars] || { minPrestige: 1, penalty: 1.0 };
  if (G.prestige < gate.minPrestige) {
    baseBid *= gate.penalty;
  }
  return baseBid;
}

function calcCPURivalBids(recruit, cpuAgg) {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rivalCount = Math.floor(Math.random() * 3) + 2;
  var pool = ranked.slice(0, 60).filter(function(t) { return t.id !== G.tid; });
  pool.sort(function() { return 0.5 - Math.random(); });
  var rivals = pool.slice(0, rivalCount);

  return rivals.map(function(rival) {
    var rivalRank = ranked.findIndex(function(t) { return t.id === rival.id; }) + 1;
    var rivalPower = rivalRank <= 10 ? 1.8 : rivalRank <= 25 ? 1.4 : rivalRank <= 64 ? 1.0 : 0.65;
    var starBonus = recruit.stars >= 5 ? 1.6 : recruit.stars >= 4 ? 1.3 : recruit.stars >= 3 ? 1.0 : 0.7;
    var rivalState = getTeamState(rival);
    var geoBonus = getGeoBonus(rivalState, recruit.homeState);
    var bid = (Math.random() * 40 + 25) * rivalPower * starBonus * cpuAgg * (1 + geoBonus);
    var geoTag = getGeoLabel(rivalState, recruit.homeState);
    return { team: rival, bid: bid, rank: rivalRank, geo: geoTag, state: rivalState };
  }).sort(function(a, b) { return b.bid - a.bid; });
}

// Generate persistent rival list per recruit (so it doesn't shuffle on re-render)
function ensureRivals(recruit) {
  if (!recruit._rivals || recruit._rivalsPhase !== G.recruitPhase) {
    var cpuAgg = (PHASES[G.recruitPhase] || PHASES[1]).cpuAggression;
    recruit._rivals = calcCPURivalBids(recruit, cpuAgg);
    recruit._rivalsPhase = G.recruitPhase;
  }
  return recruit._rivals;
}

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
    if (typeof r.status !== 'string') r.status = r.signed >= 0 ? (r.signed === G.tid ? 'committed' : 'gone') : 'open';
    if (!r.homeState) r.homeState = 'CA'; // fallback
  });
}

function getPointsLeft() { return G.recruitingBudget - G.recruitingSpent; }

function recalcSpent() {
  G.recruitingSpent = G.recruits.reduce(function(sum, r) {
    return sum + (r.status === 'open' ? (r.points || 0) : 0);
  }, 0);
}

// ═══════════════════════════════════════════════════════════
//  ADJUST POINTS
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
//  PHASE RESOLUTION
// ═══════════════════════════════════════════════════════════

export function advanceRecruitPhase() {
  var phase = PHASES[G.recruitPhase];
  if (!phase) return;

  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var numDeciding = Math.max(1, Math.round(open.length * phase.decisionRate));

  open.sort(function(a, b) { return ((b.points||0)+b.interest) - ((a.points||0)+a.interest); });
  var deciding = open.slice(0, numDeciding);

  var newCommits = [], newGone = [], refunded = 0;

  deciding.forEach(function(r) {
    var userBid = calcUserBid(r);
    var rivals = calcCPURivalBids(r, phase.cpuAggression);
    var bestRival = rivals.length ? rivals[0] : null;
    var bestRivalBid = bestRival ? bestRival.bid : 0;

    if (r.points >= 10 && userBid > bestRivalBid) {
      r.signed = G.tid; r.status = 'committed'; newCommits.push(r);
    } else if (r.points >= 5 && userBid > bestRivalBid * 0.85 && Math.random() < 0.35) {
      r.signed = G.tid; r.status = 'committed'; newCommits.push(r);
    } else if (r.points > 0 && userBid > bestRivalBid * 0.7 && Math.random() < 0.15) {
      r.signed = G.tid; r.status = 'committed'; newCommits.push(r);
    } else if (bestRival) {
      var cpuSignChance = r.stars >= 5 ? 0.80 : r.stars >= 4 ? 0.70 : r.stars >= 3 ? 0.55 : 0.40;
      cpuSignChance *= phase.cpuAggression;
      if (Math.random() < cpuSignChance) {
        r.signed = bestRival.team.id; r.status = 'gone'; r.goneTo = bestRival.team.name;
        newGone.push(r);
      }
    }
    if (r.status !== 'open' && r.points > 0) { refunded += r.points; r.points = 0; }
  });

  recalcSpent();
  // Clear cached rivals for next phase
  G.recruits.forEach(function(r) { delete r._rivals; delete r._rivalsPhase; });

  newCommits.forEach(function(r) { addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b>'); });
  newGone.forEach(function(r) { addLog('ev', G.gi, r.name + ' signed with <b>' + (r.goneTo||'another school') + '</b>.'); });

  var parts = [];
  if (newCommits.length) parts.push(newCommits.length + ' commit' + (newCommits.length>1?'s':''));
  if (newGone.length) parts.push(newGone.length + ' lost');
  if (refunded > 0) parts.push(refunded + ' pts refunded');
  var remaining = G.recruits.filter(function(r) { return r.status === 'open'; }).length;
  parts.push(remaining + ' still open');
  toast(phase.name + ': ' + parts.join(' \u00b7 '), newCommits.length ? 'var(--grn)' : 'var(--gld)');

  if (G.recruitPhase < 3) G.recruitPhase++;
  saveState(); updateAll(); renderOffseason();
}
window.advanceRecruitPhase = advanceRecruitPhase;

// ═══════════════════════════════════════════════════════════
//  FINAL RESOLUTION (Phase 3 → doOffseason)
// ═══════════════════════════════════════════════════════════

export function resolveRecruitingClass() {
  if (G.recruitPhase < 3) { while (G.recruitPhase < 3) advanceRecruitPhase(); }

  G.recruits.forEach(function(r) {
    if (r.status !== 'open') return;
    var userBid = calcUserBid(r);
    var rivals = calcCPURivalBids(r, 1.4);
    var best = rivals.length ? rivals[0] : null;
    var bestBid = best ? best.bid : 0;

    if (r.points >= 5 && userBid > bestBid * 0.7) {
      r.signed = G.tid; r.status = 'committed';
      addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b> (late)');
    } else if (best) {
      r.signed = best.team.id; r.status = 'gone'; r.goneTo = best.team.name;
    } else {
      r.status = 'gone'; r.signed = -1;
    }
    r.points = 0;
  });

  var total = G.recruits.filter(function(r) { return r.signed === G.tid; });
  toast('Class finalized: ' + total.length + ' signee' + (total.length!==1?'s':'') + '!', total.length>=3?'var(--grn)':'var(--gld)');
  G.recruitPhase = 0; G.recruitingBudget = 0; G.recruitingSpent = 0;
  saveState();
}
window.resolveRecruitingClass = resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content'); if (!el) return;
  initRecruitingIfNeeded();

  var phase = PHASES[G.recruitPhase] || PHASES[1];
  var budget = G.recruitingBudget;
  var left = getPointsLeft();
  var spent = G.recruitingSpent;
  var pctUsed = budget > 0 ? Math.round((spent/budget)*100) : 0;

  var open = G.recruits.filter(function(r) { return r.status === 'open'; });
  var commits = G.recruits.filter(function(r) { return r.status === 'committed'; });
  var gone = G.recruits.filter(function(r) { return r.status === 'gone'; });
  var userState = getTeamState(G.teams[G.tid]);
  var userRegion = STATE_TO_REGION[userState] || '';

  var h = '';

  // Header + phase tag
  h += '<div style="margin-bottom:14px;">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">'
    + '<div style="font-size:20px;font-weight:900;">Offseason ' + G.yr + '</div>'
    + '<div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1.5px;background:rgba(229,62,62,.1);padding:3px 10px;border-radius:4px;border:1px solid rgba(229,62,62,.2);">' + phase.tag + '</div>'
    + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:3px;">' + phase.name + '</div>'
    + '<div style="font-size:11px;color:var(--txt2);">' + phase.desc + '</div>'
    + '</div>';

  // Phase dots
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;">';
  for (var pi = 1; pi <= 3; pi++) {
    var ds = pi < G.recruitPhase ? 'done' : pi === G.recruitPhase ? 'active' : 'future';
    var db = ds==='done'?'var(--grn)':ds==='active'?'var(--red)':'var(--bdr2)';
    var dl = pi===1?'Eval':pi===2?'Early':'Late';
    h += '<div style="display:flex;align-items:center;gap:4px;">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:'+db+';'+(ds==='active'?'box-shadow:0 0 6px '+db+';':'')+'"></div>'
      + '<span style="font-size:10px;font-weight:700;color:'+(ds==='future'?'var(--txt3)':'#fff')+';">'+dl+'</span></div>';
    if (pi < 3) h += '<div style="flex:1;height:2px;background:'+(pi<G.recruitPhase?'var(--grn)':'var(--bdr2)')+';"></div>';
  }
  h += '</div>';

  // Budget bar
  h += '<div class="card" style="margin-bottom:14px;padding:14px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;">Recruiting Budget</div>'
    + '<div style="font-size:13px;font-weight:800;font-family:monospace;">'
    + '<span style="color:'+(left>30?'var(--grn2)':left>0?'var(--gld2)':'#fc8181')+';">'+left+'</span>'
    + ' <span style="color:var(--txt3);">/ '+budget+' pts</span></div></div>'
    + '<div style="height:8px;background:var(--bdr2);border-radius:4px;overflow:hidden;">'
    + '<div style="height:100%;width:'+pctUsed+'%;background:'+(pctUsed<70?'var(--grn)':pctUsed<90?'var(--gld)':'var(--red)')+';border-radius:4px;transition:width .2s;"></div></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt3);margin-top:4px;">'
    + '<span>Your school: '+userState+' ('+userRegion+')</span>'
    + '<span>'+open.length+' open \u00b7 '+commits.length+' committed \u00b7 '+gone.length+' gone</span></div></div>';

  // Two columns
  h += '<div style="display:grid;grid-template-columns:1.4fr 0.6fr;gap:14px;">';

  // ═══ LEFT: Big Board ═══
  h += '<div class="card" style="padding:14px;"><div class="card-title">Big Board <span style="color:var(--txt2);">'+open.length+' available</span></div>';

  if (!open.length) {
    h += '<div style="color:var(--txt3);font-size:12px;padding:16px 0;text-align:center;">All recruits decided.</div>';
  }

  open.forEach(function(r) {
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
    var pts = r.points || 0;
    var canAdd = left >= 5;
    var canSub = pts >= 5;
    var stName = STATE_NAMES[r.homeState] || r.homeState;
    var userGeo = getGeoLabel(userState, r.homeState);
    var userGeoBadge = userGeo === 'HOME' ? '<span style="font-size:8px;font-weight:900;color:var(--grn2);background:rgba(56,161,105,.15);padding:1px 5px;border-radius:2px;margin-left:4px;">HOME</span>'
      : userGeo === 'REGION' ? '<span style="font-size:8px;font-weight:900;color:var(--blu2);background:rgba(49,130,206,.12);padding:1px 5px;border-radius:2px;margin-left:4px;">REGION</span>' : '';

    // Prestige gate check
    var gate = RECRUIT_PRESTIGE_GATES[r.stars] || { minPrestige: 1, penalty: 1.0 };
    var isGated = G.prestige < gate.minPrestige;
    var gateBadge = isGated ? '<span style="font-size:8px;font-weight:900;color:#fc8181;background:rgba(229,62,62,.15);padding:1px 5px;border-radius:2px;margin-left:4px;">LONG SHOT</span>' : '';

    // Get rivals for this recruit
    var rivals = ensureRivals(r);
    var topRivals = rivals.slice(0, 3);
    var userBid = calcUserBid(r);
    var bestRivalBid = topRivals.length ? topRivals[0].bid : 0;
    var maxBid = Math.max(userBid, bestRivalBid, 1);
    var userPct = Math.round((userBid / maxBid) * 100);
    var userLeading = userBid >= bestRivalBid && pts > 0;

    h += '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);">';

    // Row 1: Player info + stepper
    h += '<div style="display:flex;align-items:center;gap:8px;">';
    h += '<div style="width:20px;text-align:center;flex-shrink:0;font-size:9px;color:var(--txt3);font-family:monospace;">#'+(r.id+1)+'</div>';
    h += '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:5px;">'
      + '<span style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+r.name+'</span>'
      + '<span style="font-size:8px;color:var(--gld2);flex-shrink:0;">'+stars+'</span>'
      + userGeoBadge + gateBadge
      + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">'+r.pos+' \u00b7 OVR '+r.ovr+' \u00b7 '+stName+'</div>'
      + '</div>';
    // Stepper
    h += '<div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">'
      + '<div onclick="adjustPoints('+r.id+',-5)" style="width:26px;height:26px;border-radius:4px;background:'+(canSub?'var(--s3)':'var(--s2)')+';border:1px solid '+(canSub?'var(--bdr2)':'var(--bdr)')+';color:'+(canSub?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:'+(canSub?'pointer':'default')+';user-select:none;">\u2212</div>'
      + '<div style="width:38px;text-align:center;font-family:monospace;font-size:14px;font-weight:800;color:'+(pts>0?'var(--red)':'var(--txt3)')+';">'+pts+'</div>'
      + '<div onclick="adjustPoints('+r.id+',5)" style="width:26px;height:26px;border-radius:4px;background:'+(canAdd?'var(--red)':'var(--s2)')+';border:1px solid '+(canAdd?'var(--red)':'var(--bdr)')+';color:'+(canAdd?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:'+(canAdd?'pointer':'default')+';user-select:none;">+</div>'
      + '</div>';
    h += '</div>';

    // Row 2: Bid battle visualization
    h += '<div style="margin-top:6px;margin-left:28px;padding:6px 8px;background:var(--s2);border-radius:4px;border:1px solid var(--bdr);">';

    // Your bid bar
    if (pts > 0) {
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'
        + '<span style="font-size:9px;font-weight:700;color:'+(userLeading?'var(--grn2)':'var(--txt2)')+';width:70px;flex-shrink:0;">You'+(userGeo?' ('+userGeo+')':'')+'</span>'
        + '<div style="flex:1;height:4px;background:var(--bdr2);border-radius:2px;overflow:hidden;">'
        + '<div style="height:100%;width:'+userPct+'%;background:'+(userLeading?'var(--grn)':'var(--red)')+';border-radius:2px;"></div></div>'
        + '</div>';
    }

    // Rival bid bars (top 3)
    topRivals.forEach(function(rv) {
      var rvPct = Math.round((rv.bid / maxBid) * 100);
      var rvGeo = rv.geo ? ' ('+rv.geo+')' : '';
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">'
        + '<span style="font-size:9px;color:var(--txt3);width:70px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+rv.team.name+rvGeo+'</span>'
        + '<div style="flex:1;height:4px;background:var(--bdr2);border-radius:2px;overflow:hidden;">'
        + '<div style="height:100%;width:'+rvPct+'%;background:var(--txt3);border-radius:2px;"></div></div>'
        + '</div>';
    });

    if (!pts && !topRivals.length) {
      h += '<div style="font-size:9px;color:var(--txt3);font-style:italic;">Invest points to see bid battle</div>';
    } else if (!pts) {
      h += '<div style="font-size:9px;color:var(--txt3);font-style:italic;">Not yet pursuing</div>';
    }

    h += '</div>'; // close bid box
    h += '</div>'; // close recruit card
  });

  h += '</div>'; // close big board card

  // ═══ RIGHT: Sidebar ═══
  h += '<div style="display:flex;flex-direction:column;gap:12px;">';

  // Commits
  h += '<div class="card"><div class="card-title">Committed <span style="color:var(--grn2);">'+commits.length+'</span></div>';
  if (commits.length) {
    commits.forEach(function(r) {
      var stars = ''; for (var i=0;i<5;i++) stars += i<r.stars?'\u2605':'\u2606';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.025);">'
        + '<div><div style="font-size:11px;font-weight:600;color:#fff;">'+r.name+'</div>'
        + '<div style="font-size:9px;color:var(--gld2);">'+stars+' \u00b7 '+r.pos+' \u00b7 '+(STATE_NAMES[r.homeState]||r.homeState)+'</div></div>'
        + '<div style="font-family:monospace;font-size:12px;font-weight:900;color:var(--grn2);">'+r.ovr+'</div></div>';
    });
  } else {
    h += '<div style="color:var(--txt3);font-size:11px;padding:8px 0;">No commits yet.</div>';
  }
  h += '</div>';

  // Gone
  if (gone.length) {
    h += '<div class="card"><div class="card-title">Signed Elsewhere <span style="color:var(--txt3);">'+gone.length+'</span></div>';
    gone.slice(0,8).forEach(function(r) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02);font-size:10px;">'
        + '<span style="color:var(--txt3);">'+r.name+' ('+r.stars+'\u2605)</span>'
        + '<span style="color:var(--txt3);font-style:italic;">'+(r.goneTo||'?')+'</span></div>';
    });
    if (gone.length > 8) h += '<div style="font-size:10px;color:var(--txt3);padding:4px 0;">+'+(gone.length-8)+' more</div>';
    h += '</div>';
  }

  // Pursuing
  var invested = open.filter(function(r) { return (r.points||0) > 0; });
  if (invested.length) {
    h += '<div class="card"><div class="card-title">Pursuing <span style="color:var(--txt2);">'+invested.length+'</span></div>';
    invested.sort(function(a,b) { return (b.points||0)-(a.points||0); });
    invested.forEach(function(r) {
      var geo = getGeoLabel(userState, r.homeState);
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02);font-size:10px;">'
        + '<span style="color:var(--txt2);">'+r.name+(geo?' <span style="color:'+(geo==='HOME'?'var(--grn2)':'var(--blu2)')+';font-size:8px;font-weight:800;">'+geo+'</span>':'')+'</span>'
        + '<span style="font-family:monospace;font-weight:700;color:var(--red);">'+r.points+'</span></div>';
    });
    h += '</div>';
  }

  // Advance button
  h += '<div class="btn btn-red btn-full" style="padding:14px;margin-top:4px;" onclick="'+phase.btnAction+'">'+phase.btnLabel+'</div>';

  // Hint
  var hints = {
    1: 'Spread points to build interest. \ud83c\udfe0 HOME and \ud83c\udf0d REGION badges mean you have a geographic edge.',
    2: 'Refunded points are back in your budget. Double down on remaining targets or spread to new ones.',
    3: 'Everyone decides. The bid bars show if you\'re winning or losing each battle. Go all-in.'
  };
  h += '<div style="font-size:10px;color:var(--txt3);line-height:1.5;margin-top:8px;padding:8px;background:rgba(255,255,255,.02);border-radius:4px;border:1px solid var(--bdr);">'
    + '\ud83c\udfc0 '+(hints[G.recruitPhase]||'') + '</div>';

  h += '</div>'; // close right
  h += '</div>'; // close grid
  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS
// ═══════════════════════════════════════════════════════════
export function resolvePitchWeek(id) { adjustPoints(id,5); return {userBoost:5,rivals:[],signed:-1}; }
export function pitchRecruit(id) { adjustPoints(id,5); }
