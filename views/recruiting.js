// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  Offseason view: recruiting board, pitch system, commits.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G, SetupState, saveState } from '../state.js';

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
//  OFFSEASON VIEW
// ═══════════════════════════════════════════════════════════

export function renderOffseason() {
  var el = ge('offseason-content');
  if (!el) return;
  var h = '<div style="margin-bottom:16px;"><div style="font-size:20px;font-weight:900;margin-bottom:4px;">Offseason ' + G.yr + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);">Sign your class, develop your roster, prepare for next season.</div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

  // Recruiting board
  h += '<div class="card"><div class="card-title">Recruiting Board <span style="color:var(--gld2);font-family:monospace;">' + G.pts + ' NIL pts</span></div>';
  G.recruits.slice(0, 16).forEach(function(r) {
    var cost = 10 + r.stars * 8;
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < r.stars ? '\u2605' : '\u2606';
    var action = '';
    if (r.signed === G.tid) {
      action = '<span style="color:var(--grn2);font-size:10px;font-weight:800;">\u2713 COMMITTED</span>';
    } else if (r.signed >= 0) {
      action = '<span style="color:var(--txt3);font-size:10px;">Gone</span>';
    } else {
      action = '<div class="btn btn-red btn-sm" style="' + (G.pts < cost ? 'opacity:.4;pointer-events:none;' : '') + '" onclick="pitchRecruit(' + r.id + ',' + cost + ')">PITCH (' + cost + ')</div>';
    }
    h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.025);">'
      + '<div style="flex:1;"><div style="font-size:12px;font-weight:600;">' + r.name + '</div>'
      + '<div style="font-size:10px;color:var(--txt2);">' + r.pos + ' \u00b7 ' + r.stars + '\u2605 \u00b7 OVR ' + r.ovr + '</div>'
      + '<div style="height:3px;background:var(--bdr2);border-radius:2px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:' + r.interest + '%;background:var(--grn);"></div></div>'
      + '</div>' + action + '</div>';
  });
  h += '</div>';

  // Commits
  var commits = G.recruits.filter(function(r) { return r.signed === G.tid; });
  h += '<div class="card"><div class="card-title">Incoming Class <span>' + (commits.length > 0 ? commits.length + ' commits' : 'No commits yet') + '</span></div>';
  if (commits.length) {
    commits.forEach(function(r) {
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.025);">'
        + '<div><div style="font-size:12px;font-weight:600;">' + r.name + '</div><div style="font-size:10px;color:var(--txt2);">' + r.pos + ' \u00b7 ' + r.stars + '\u2605</div></div>'
        + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--red);">' + r.ovr + '</div>'
        + '</div>';
    });
  } else {
    h += '<div style="color:var(--txt3);font-size:12px;padding:8px 0;">No recruits committed yet. Hit the board.</div>';
  }
  h += '<div class="btn btn-red btn-full" style="margin-top:14px;" onclick="doOffseason()">ADVANCE TO SEASON ' + (G.yr + 1) + ' \u25b6</div>';
  h += '</div>';
  h += '</div>';
  el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════
//  COMPETITIVE PITCH SYSTEM
// ═══════════════════════════════════════════════════════════

export function resolvePitchWeek(recruitId) {
  var r = G.recruits[recruitId];
  if (!r) return { userBoost: 0, rivals: [], signed: -1 };

  // User pitch — prestige scaled
  var userPrestigeMod = 0.6 + (G.prestige / 5) * 0.8;
  var userBoost = Math.floor((Math.random() * 8 + 6) * userPrestigeMod);
  r.prevInterest = r.interest;
  r.interest = Math.min(100, r.interest + userBoost);

  // Pick 2-3 rival CPU schools weighted toward top programs
  var rivalCount = Math.floor(Math.random() * 2) + 2;
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var pool = ranked.slice(0, 50).concat(
    ranked.slice(50).sort(function() { return 0.5 - Math.random(); }).slice(0, 20)
  );
  pool = pool.filter(function(t) { return t.id !== G.tid; });
  pool.sort(function() { return 0.5 - Math.random(); });
  var selectedRivals = pool.slice(0, rivalCount);

  r.rivals = [];
  var signed = -1;

  for (var i = 0; i < selectedRivals.length; i++) {
    var rival = selectedRivals[i];
    var rivalRank = ranked.findIndex(function(t) { return t.id === rival.id; }) + 1;
    var rivalPower = rivalRank <= 10 ? 1.4 : rivalRank <= 25 ? 1.1 : rivalRank <= 64 ? 0.85 : 0.6;
    var rivalBoost = Math.floor((Math.random() * 7 + 5) * rivalPower);
    r.rivals.push({ name: rival.name, boost: rivalBoost });

    // Steal check
    var isElite = rivalRank <= 25;
    var cpuCommitChance = (isElite && r.interest < 80) ? 0.07 : 0.015;
    if (signed === -1 && Math.random() < cpuCommitChance) {
      signed = rival.id;
    }
  }

  // User signs if interest hit 100 and no CPU stole them
  if (signed === -1 && r.interest >= 100) {
    signed = G.tid;
  }

  if (signed !== -1) r.signed = signed;
  return { userBoost: userBoost, rivals: r.rivals, signed: signed };
}

// ═══════════════════════════════════════════════════════════
//  PITCH RECRUIT
// ═══════════════════════════════════════════════════════════

export function pitchRecruit(id, cost) {
  if (G.pts < cost) return;
  G.pts -= cost;
  var result = resolvePitchWeek(id);
  var r = G.recruits[id];
  if (result.signed === G.tid) {
    addLog('ev', G.gi, r.name + ' (' + r.stars + '\u2605) <b>commits!</b>');
    toast(r.name + ' COMMITTED!', 'var(--grn)');
  } else if (result.signed !== -1) {
    var rivalName = G.teams[result.signed] ? G.teams[result.signed].name : 'a rival';
    addLog('ev', G.gi, r.name + ' signed with <b>' + rivalName + '</b>.');
    toast('Lost ' + r.name + ' to ' + rivalName, 'var(--red)');
  } else {
    var rivalMsg = result.rivals.length ? result.rivals[0].name + ' also pitched (+' + result.rivals[0].boost + ')' : '';
    toast(r.name + ': +' + result.userBoost + '% interest' + (rivalMsg ? ' | ' + rivalMsg : ''));
  }
  saveState(); updateAll();
  if (SetupState.ACTIVE_VIEW === 'offseason') renderOffseason();
}
