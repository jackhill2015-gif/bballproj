// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/portal.js
//  Transfer portal: LOGIC (DOM-free, operates only on G) +
//  RENDERING (simple default skin; the UI rebuild can re-skin
//  rendering without touching the logic functions).
// ═══════════════════════════════════════════════════════════

import { G, saveState } from '../state.js';
import { ri, freshS } from '../utils.js';
import { CLS } from '../constants.js';

// ── Callbacks registered by views/recruiting.js (avoids an import cycle) ──
var _ext = { render: null, toast: null, addLog: null };
export function registerPortalCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function rerender() { if (_ext.render) _ext.render(); }
function toast(m, c) { if (_ext.toast) _ext.toast(m, c); }
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }

// ═══════════════════════════════════════════════════════════
//  LOGIC
// ═══════════════════════════════════════════════════════════

export var PORTAL_PICK_LIMIT = 2;    // user pickups per offseason
export var PORTAL_MAX_ENTRANTS = 160;

var _nextPid = 1;

function portalReason(p) {
  if (p.ovr >= 78 && p.mins < 18) return 'Bigger role';
  return 'Playing time';
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
      if ((p.mins || 0) >= 18) return;         // rotation players stay put
      var unhappy = p.mins <= 10 || (p.ovr >= 78 && p.mins < 18) || (p.cls === 'FR' && p.mins <= 8);
      if (!unhappy) return;
      if (Math.random() > 0.45) return;         // not everyone acts on it
      var pid = _nextPid++;
      p._portalPid = pid;
      G.portalEntrants.push({
        pid: pid, name: p.name, pos: p.pos, ovr: p.ovr, pot: p.pot || p.ovr,
        cls: p.cls, fromTid: tm.id, fromName: tm.name, mins: p.mins || 0,
        sht: p.sht, fin: p.fin, def: p.def, reb: p.reb, ply: p.ply,
        reason: portalReason(p), pickedBy: -1
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
  _portalShown = 30;
  G.portalPicksLeft = PORTAL_PICK_LIMIT;
  return G.portalEntrants;
}

// Entrants sorted best-first (rendering consumes this)
export function portalBoard() {
  return (G.portalEntrants || []).slice().sort(function(a, b) { return b.ovr - a.ovr; });
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

// User picks up one entrant. Returns true on success.
export function portalPickup(pid) {
  if ((G.portalPicksLeft || 0) <= 0) { toast('No portal pickups remaining.', 'var(--gld)'); return false; }
  var t = G.teams[G.tid];
  if (!t || t.rost.length >= 15) { toast('Roster is full (15).', 'var(--gld)'); return false; }
  var f = findEntrant(pid);
  if (!f || f.e.pickedBy !== -1) return false;
  if (f.e.fromTid === G.tid) { toast("You can't re-sign your own transfer.", 'var(--gld)'); return false; }
  f.e.pickedBy = G.tid;
  takeFromOldRoster(f.e);
  var np = entrantToPlayer(f.e);
  t.rost.push(np);
  G.portalEntrants.splice(f.i, 1);
  G.portalPicksLeft--;
  addLog('ev', G.gi, '<b>' + np.name + '</b> (' + np.pos + ', ' + np.ovr + ' OVR) transfers in from ' + f.e.fromName + '.');
  toast(np.name + ' joins from the portal!', 'var(--grn)');
  saveState(); rerender();
  return true;
}
window.portalPickup = portalPickup;

// Leave the portal step and continue to recruiting
export function advanceFromPortal() {
  G.offseasonStep = 'recruiting';
  saveState(); rerender();
}
window.advanceFromPortal = advanceFromPortal;

// CPU teams fill roster gaps from the portal BEFORE walk-ons (called from
// doOffseason). Returns true if the user's roster was touched (needs fixMins).
export function cpuPortalFill(tm) {
  var list = G.portalEntrants || [];
  if (!list.length) return false;
  var need = Math.max(0, 10 - tm.rost.length);
  var maxTake = Math.min(3, need);
  if (maxTake <= 0) return false;
  var touchedUser = false;
  var posCount = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  tm.rost.forEach(function(p) { if (posCount.hasOwnProperty(p.pos)) posCount[p.pos]++; });
  for (var n = 0; n < maxTake; n++) {
    var best = -1, bestScore = -1;
    for (var j = 0; j < list.length; j++) {
      var e = list[j];
      if (e.pickedBy !== -1) continue;
      var score = e.ovr + (posCount[e.pos] < 2 ? 25 : 0); // fill scarcest position first
      if (score > bestScore) { bestScore = score; best = j; }
    }
    if (best < 0) break;
    var e2 = list.splice(best, 1)[0];
    e2.pickedBy = tm.id;
    var taken = takeFromOldRoster(e2);
    if (taken && e2.fromTid === G.tid) touchedUser = true;
    var np = entrantToPlayer(e2);
    if (taken && taken.cls !== e2.cls) {
      np.cls = taken.cls; // old roster already aged this player in doOffseason — don't age twice
    } else {
      var ci = CLS.indexOf(np.cls);            // transfers age up like everyone else
      if (ci >= 0 && ci < 3) np.cls = CLS[ci + 1];
    }
    tm.rost.push(np);
    posCount[np.pos] = (posCount[np.pos] || 0) + 1;
  }
  return touchedUser;
}
window._cpuPortalFill = cpuPortalFill;

// Clear all portal flags/state at the end of the offseason
export function clearPortalState() {
  G.teams.forEach(function(tm) {
    (tm.rost || []).forEach(function(p) { if (p._portalPid) delete p._portalPid; });
  });
  G.portalEntrants = [];
  G.portalPicksLeft = 0;
}
window._clearPortalState = clearPortalState;

// ═══════════════════════════════════════════════════════════
//  RENDERING (default skin)
// ═══════════════════════════════════════════════════════════

var _portalShown = 30;
export function showMorePortal() { _portalShown += 30; rerender(); }
window.showMorePortal = showMorePortal;

export function renderPortal() {
  var board = portalBoard();
  var mine = board.filter(function(e) { return e.fromTid === G.tid; });
  var avail = board.filter(function(e) { return e.fromTid !== G.tid; });
  var picks = G.portalPicksLeft || 0;

  var h = '<div style="max-width:800px;margin:0 auto;padding:20px;">';

  h += '<div style="text-align:center;margin-bottom:16px;">'
    + '<div style="font-size:10px;color:var(--red);font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">OFFSEASON ' + G.yr + '</div>'
    + '<div style="font-size:28px;font-weight:900;">Transfer Portal</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">Unhappy players across the country are looking for a new home. You have <b style="color:var(--red);">' + picks + '</b> pickup' + (picks === 1 ? '' : 's') + ' left.</div></div>';

  if (mine.length) {
    h += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(0,102,204,.06);border:1px solid rgba(0,102,204,.15);border-radius:6px;font-size:12px;color:var(--txt2);">'
      + '<b style="color:#dc2626;">' + mine.length + '</b> of your player' + (mine.length > 1 ? 's' : '') + ' entered the portal: '
      + mine.map(function(e) { return e.name + ' (' + e.pos + ', ' + e.ovr + ')'; }).join(', ') + '.</div>';
  }

  h += '<div style="font-size:11px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">' + avail.length + ' Available Transfers</div>';

  var shown = avail.slice(0, _portalShown);
  shown.forEach(function(e) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;background:var(--s1);border:1px solid var(--bdr);border-radius:6px;">'
      + '<div class="pos-chip">' + e.pos + '</div>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--txt);">' + e.name + ' <span style="font-size:9px;color:var(--txt3);">' + e.cls + '</span></div>'
      + '<div style="font-size:10px;color:var(--txt3);">from ' + e.fromName + ' \u00b7 ' + e.reason + ' \u00b7 ' + e.mins + ' MIN last season</div></div>'
      + '<div style="font-family:monospace;font-size:15px;font-weight:900;color:var(--red);">' + e.ovr + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);">POT ' + (e.pot || e.ovr) + '</div>'
      + (picks > 0
        ? '<div class="btn btn-red btn-sm" style="padding:6px 14px;" onclick="portalPickup(' + e.pid + ')">PICK UP</div>'
        : '<div style="font-size:10px;color:var(--txt3);">No picks left</div>')
      + '</div>';
  });
  if (!avail.length) h += '<div style="padding:24px;text-align:center;color:var(--txt3);font-size:12px;">The portal is quiet this year.</div>';
  if (avail.length > _portalShown) {
    h += '<div style="text-align:center;margin:12px 0;"><div class="btn btn-ghost" style="padding:10px 28px;" onclick="showMorePortal()">SHOW MORE (' + (avail.length - _portalShown) + ' remaining)</div></div>';
  }

  h += '<div style="text-align:center;margin-top:16px;">'
    + '<div class="btn btn-red" style="display:inline-block;padding:14px 40px;font-size:14px;font-weight:800;" onclick="advanceFromPortal()">CONTINUE TO RECRUITING \u25b6</div></div>';

  h += '</div>';
  return h;
}
