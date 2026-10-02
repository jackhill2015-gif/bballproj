// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/portal.js
//  Transfer portal: LOGIC (DOM-free, operates only on G) +
//  RENDERING (new design-system skin: scheme-row rhythm,
//  bold name + gray description rows, blue accents).
//  Re-skinned into the Campus Dynasty design system; every
//  logic function keeps its name/signature/behavior.
// ═══════════════════════════════════════════════════════════

import { G, saveState } from '../state.js';
import { ri, freshS, clamp } from '../utils.js';
import { CLS, TEAM_STATES, STATE_TO_REGION, RECRUIT_STATE_POOL } from '../constants.js';
import { portalEntryChance, moralePortalReason, MORALE_DEFAULT } from '../morale.js';
import { teamLogo } from '../ui.js';

// ── Callbacks registered by views/recruiting.js (avoids an import cycle) ──
var _ext = { render: null, toast: null, addLog: null };
export function registerPortalCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function rerender() { if (_ext.render) _ext.render(); }
function toast(m, c) { if (_ext.toast) _ext.toast(m, c); }
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }

// ═══════════════════════════════════════════════════════════
//  LOGIC (unchanged)
// ═══════════════════════════════════════════════════════════

export var PORTAL_PICK_LIMIT = 2;    // user pickups per offseason
export var PORTAL_MAX_ENTRANTS = 160;

var _nextPid = 1;
var _portalShown = 30;

function portalReason(p) {
  return moralePortalReason(p);
}

// ── Geo helpers (mirror recruiting.js) ──
function getTeamState(t) { return TEAM_STATES[t.name] || 'XX'; }
function getGeoBonus(ts, rs) { if (!ts || !rs || ts === 'XX') return 0; if (ts === rs) return 0.20; var tr = STATE_TO_REGION[ts], rr = STATE_TO_REGION[rs]; if (tr && tr === rr) return 0.10; return 0; }

// ── Portal economy ──
// NIL cost to pitch an entrant, scaled by OVR. Weekly NIL earnings run
// ~14-40 and the shop sells boosts for 50-80, so a 45-135 pitch is a real
// investment without being out of reach.
export function portalCost(e) {
  return 20 + Math.max(0, e.ovr - 65) * 5;
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
function assignSuitors(e) {
  var ranked = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var poolSize = e.ovr >= 84 ? 25 : e.ovr >= 79 ? 60 : e.ovr >= 74 ? 120 : ranked.length;
  var pool = ranked.slice(0, poolSize).filter(function(t) { return t.id !== e.fromTid && t.id !== G.tid; });
  for (var j = pool.length - 1; j > 0; j--) { var k = ri(0, j); var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp; }
  e.suitors = pool.slice(0, ri(3, 6)).map(function(t) { return { tid: t.id, name: t.name }; });
}

// Defensive defaults for entrants from old saves (pre-suitor era).
function ensureEntrant(e) {
  if (!e.homeState) e.homeState = RECRUIT_STATE_POOL[ri(0, RECRUIT_STATE_POOL.length - 1)];
  if (!e.suitors) assignSuitors(e);
  return e;
}

// Deterministic suitor bids (seeded by entrant + school, like recruiting's
// rival bids): prestige dominates, geography and entrant quality nudge it.
function calcSuitorBids(e) {
  var desir = 1 + Math.max(0, e.ovr - 70) / 60; // elite transfers get pursued harder
  var out = [];
  (e.suitors || []).forEach(function(s) {
    var team = G.teams[s.tid];
    if (!team) return;
    var sp = team.schoolPrestige || 50;
    var seed = ((e.pid * 7 + s.tid * 13) % 100) / 100;
    var geo = getGeoBonus(getTeamState(team), e.homeState);
    var bid = (seed * 30 + 25) * (0.35 + sp / 55) * desir * (1 + geo);
    out.push({ tid: s.tid, name: s.name, bid: Math.max(1, bid) });
  });
  out.sort(function(a, b) { return b.bid - a.bid; });
  return out;
}

// User's pitch strength: school prestige + NIL offer + playing time at the
// entrant's position + geography + coach recruiting chops, gated by prestige.
export function calcUserPortalBid(e) {
  var t = G.teams[G.tid];
  var sp = (t && t.schoolPrestige) || 50;
  var cost = portalCost(e);
  var posCount = 0;
  (t.rost || []).forEach(function(p) { if (p.pos === e.pos) posCount++; });
  var ptBonus = posCount < 2 ? 30 : posCount === 2 ? 12 : posCount === 3 ? 0 : -18;
  var geo = getGeoBonus(getTeamState(t), e.homeState);
  var coachMod = 0.7 + ((G.coach ? G.coach.rec : 70) / 100) * 0.6;
  var bid = (sp + cost * 0.9 + ptBonus) * coachMod * (1 + geo);
  var gate = portalGate(e.ovr);
  if (sp < gate) {
    var deficit = gate - sp;
    bid *= Math.max(0.12, 1 - deficit / 45);
  }
  return { bid: Math.max(1, bid), cost: cost };
}

// User's win % against the suitor field, shown BEFORE committing.
export function portalChance(e) {
  ensureEntrant(e);
  var u = calcUserPortalBid(e);
  var suitors = calcSuitorBids(e);
  var total = u.bid;
  suitors.forEach(function(s) { total += s.bid; });
  var pct = total > 0 ? Math.round(u.bid / total * 100) : 50;
  return { pct: clamp(pct, 1, 99), cost: u.cost, bid: u.bid, suitors: suitors };
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

// User pitches an entrant: pays the NIL cost up front, then the entrant picks
// a winner by weighted draw among the user and the suitor schools. Win the
// draw and they're yours; lose and the NIL is refunded (like recruiting
// point refunds) and the player signs with the winning suitor.
export function portalPitch(pid) {
  if ((G.portalPicksLeft || 0) <= 0) { toast('No portal pitches remaining.', 'var(--gld)'); return false; }
  var t = G.teams[G.tid];
  if (!t || t.rost.length >= 15) { toast('Roster is full (15).', 'var(--gld)'); return false; }
  var f = findEntrant(pid);
  if (!f || f.e.pickedBy !== -1) return false;
  if (f.e.fromTid === G.tid) { toast("You can't re-sign your own transfer.", 'var(--gld)'); return false; }
  var e = ensureEntrant(f.e);
  var u = calcUserPortalBid(e);
  if ((G.pts || 0) < u.cost) { toast('Not enough NIL (' + u.cost + ' needed).', 'var(--gld)'); return false; }
  G.pts -= u.cost;
  G.portalPicksLeft--;

  var suitors = calcSuitorBids(e);
  var entries = [{ key: 'user', bid: u.bid, name: t.name }];
  suitors.forEach(function(s) {
    var wt = G.teams[s.tid];
    if (wt && wt.rost.length < 15) entries.push({ key: s.tid, bid: s.bid, name: s.name });
  });
  var winner = weightedWinner(entries);

  if (winner.key === 'user') {
    e.pickedBy = G.tid;
    takeFromOldRoster(e);
    var np = entrantToPlayer(e);
    t.rost.push(np);
    G.portalEntrants.splice(f.i, 1);
    addLog('ev', G.gi, '<b>' + np.name + '</b> (' + np.pos + ', ' + np.ovr + ' OVR) transfers in from ' + e.fromName + '.');
    toast(np.name + ' commits from the portal!', 'var(--grn)');
  } else {
    var wt2 = G.teams[winner.key];
    takeFromOldRoster(e);
    if (wt2) wt2.rost.push(entrantToPlayer(e));
    G.portalEntrants.splice(f.i, 1);
    G.pts += u.cost; // refund on loss — matches recruiting point refunds
    addLog('ev', G.gi, '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ' OVR) chose <b>' + winner.name + '</b> over you.');
    toast(e.name + ' chose ' + winner.name + '.', 'var(--gld)');
  }
  saveState(); rerender();
  return true;
}
window.portalPitch = portalPitch;

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
  G.portalPicksLeft = 0;
}
window._clearPortalState = clearPortalState;

export function showMorePortal() { _portalShown += 30; rerender(); }
window.showMorePortal = showMorePortal;

// ═══════════════════════════════════════════════════════════
//  RENDERING — new design-system skin
//  (delegation is bound by views/recruiting.js, which owns the
//  #offseason-content container this HTML is injected into)
// ═══════════════════════════════════════════════════════════

function chanceColor(pct) {
  return pct >= 60 ? 'var(--grn2)' : pct >= 30 ? 'var(--gld2)' : 'var(--red)';
}

function entrantRow(e, picksLeft) {
  var ch = portalChance(e);
  var nil = G.pts || 0;
  var action;
  if (picksLeft <= 0) {
    action = '<div style="font-size:11px;color:var(--txt3);">No pitches left</div>';
  } else if (nil < ch.cost) {
    action = '<div style="font-size:11px;color:var(--txt3);"><b style="color:' + chanceColor(ch.pct) + ';">' + ch.pct + '%</b> · need ' + ch.cost + ' NIL</div>';
  } else {
    action = '<button class="btn-quiet" data-ppitch="' + e.pid + '" aria-label="Pitch ' + e.name + '">'
      + '<b style="color:' + chanceColor(ch.pct) + ';">' + ch.pct + '%</b> · Pitch ' + ch.cost + ' NIL</button>';
  }
  var chase = ch.suitors.slice(0, 2).map(function(s) { return s.name; }).join(', ');
  return '<div class="pl-row">'
    + teamLogo(e.fromName, 'sm')
    + '<span class="pos-chip">' + e.pos + '</span>'
    + '<div class="pl-body"><div class="pl-name">' + e.name + ' <span style="font-size:11px;font-weight:700;color:var(--txt3);">' + e.cls + '</span></div>'
    + '<div class="pl-desc">from ' + e.fromName + ' · ' + e.reason + ' · ' + e.mins + ' min last season'
    + (chase ? ' · <span style="color:var(--txt3);">also: ' + chase + '</span>' : '') + '</div></div>'
    + '<div class="pl-ovr"><b>' + e.ovr + '</b><small>POT ' + (e.pot || e.ovr) + '</small></div>'
    + action + '</div>';
}

export function renderPortal() {
  var board = portalBoard();
  var mine = board.filter(function(e) { return e.fromTid === G.tid; });
  var avail = board.filter(function(e) { return e.fromTid !== G.tid; });
  var picks = G.portalPicksLeft || 0;

  var h = '<div class="portal-wrap">';

  h += '<div style="margin-bottom:14px;"><div class="sec-head">Transfer Portal</div>'
    + '<div class="sec-sub">Offseason ' + G.yr + ' · unhappy players looking for a new home</div></div>';

  h += '<div class="stat-strip" style="grid-template-columns:1fr 1fr 1fr;">'
    + '<div class="stat-cell' + (picks > 0 ? ' hot' : '') + '"><div class="sv">' + picks + '</div><div class="sl">Pitches left</div></div>'
    + '<div class="stat-cell"><div class="sv">' + (G.pts || 0) + '</div><div class="sl">NIL</div></div>'
    + '<div class="stat-cell"><div class="sv">' + avail.length + '</div><div class="sl">Available</div></div></div>';

  if (mine.length) {
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:10px;">'
      + '<b style="color:var(--red);">' + mine.length + '</b> of your player' + (mine.length > 1 ? 's' : '')
      + ' entered the portal: '
      + mine.map(function(e) { return '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ')'; }).join(', ')
      + '.</div>';
  }

  h += '<div class="strat-sec-label">Available transfers</div>';

  var shown = avail.slice(0, _portalShown);
  shown.forEach(function(e) { h += entrantRow(e, picks); });
  if (!avail.length) {
    h += '<div class="empty-state">The portal is quiet this year.</div>';
  }
  if (avail.length > _portalShown) {
    h += '<button class="btn-quiet" data-pshowmore>Show more (' + (avail.length - _portalShown) + ' remaining)</button>';
  }

  h += '<button class="btn-big btn-full" style="margin-top:16px;" data-padvance>CONTINUE TO RECRUITING</button>';

  h += '</div>';
  return h;
}
