// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/acq.js
//  Shared layout for the two "acquisition" screens — the transfer
//  portal and recruiting — so they look and work the same:
//    slim header  · one line: round + budget
//    tabs         · Board / Targets (or My offers) / Your class / Roster
//    clean list   · two-line rows, no buttons inside rows
//    player page  · tap a row → sheet with Overview / Ratings / Schools
//    filter sheet · filters live behind one Filter button
//    sticky bar   · the round's advance button, always in reach
//  The screens own their data and actions; this module only renders
//  shared pieces and remembers which sheet is open so it can refresh
//  after every action (portal.js / recruiting.js call refreshSheet).
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { openSheet, isSheetOpen } from './sheet.js';
import { nextSeasonRoster } from './scouting.js';
import { ge } from '../utils.js';
import { playerFaceSmallHTML } from './faces.js';

// ── Header / tabs / toolbar / sticky bar ──────────────────
export function header(title, roundLine, stats) {
  return '<div class="acq-head"><div class="acq-title">' + title + '</div>'
    + '<div class="acq-line"><span>' + roundLine + '</span><span class="acq-stats">'
    + stats.map(function(s) { return '<span><b' + (s.attr ? ' ' + s.attr : '') + '>' + s.v + '</b> ' + s.l + '</span>'; }).join('')
    + '</span></div></div>';
}

export function tabs(list, cur) {
  var h = '<div class="acq-tabs" role="tablist">';
  list.forEach(function(t) {
    h += '<button class="acq-tab' + (t.id === cur ? ' on' : '') + '" role="tab" data-acqtab="' + t.id + '">' + t.label
      + (t.n !== undefined ? ' <span>' + t.n + '</span>' : '') + '</button>';
  });
  return h + '</div>';
}

// Filter button + a chip for each active filter (tap a chip to clear it)
export function toolbar(active, countLine) {
  var h = '<div class="acq-tool"><button class="acq-filter-btn" data-acq-filter>Filter'
    + (active.length ? ' <span>' + active.length + '</span>' : '') + '</button>';
  active.forEach(function(a) { h += '<button class="acq-chip" data-acq-clear="' + a.key + '">' + a.label + ' <span aria-hidden="true">×</span></button>'; });
  return h + '<span class="acq-count">' + countLine + '</span></div>';
}

export function sticky(btnAttr, label) {
  return '<div class="acq-sticky"><button class="btn-big btn-full" ' + btnAttr + '>' + label + '</button></div>';
}

// One list row. o: { open (attr string), name, tag, sub, big, small, hl, dim }
export function row(o) {
  return '<div class="acq-row' + (o.hl ? ' hl' : '') + (o.dim ? ' dim' : '') + '" ' + o.open + ' role="button" tabindex="0">'
    + '<div class="acq-main"><div class="acq-name">' + o.name + (o.tag || '') + '</div>'
    + '<div class="acq-sub">' + o.sub + '</div></div>'
    + '<div class="acq-right"><div class="acq-big">' + o.big + '</div>' + (o.small ? '<div class="acq-small">' + o.small + '</div>' : '') + '</div></div>';
}

export function empty(msg) { return '<div class="empty-state">' + msg + '</div>'; }

// Banner line (e.g. your players in the portal, last round's results)
export function banner(html, action) {
  return '<div class="acq-banner"' + (action ? ' ' + action + ' role="button" tabindex="0"' : '') + '>' + html + '</div>';
}

// ── Roster tab: your roster next season, by position ─────
export function rosterTabHTML(incomingNames) {
  incomingNames = incomingNames || {};
  var roster = nextSeasonRoster();
  var h = '<div class="sec-sub" style="margin:4px 0 10px;">Your roster next season: returners and players who have signed, '
    + roster.length + ' of 15 spots.</div>';
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function(pos) {
    var list = roster.filter(function(x) { return x.pos === pos; });
    h += '<div class="acq-pos"><div class="acq-pos-h">' + pos + ' <span>' + list.length + '</span></div>';
    if (!list.length) h += '<div class="acq-pos-none">Nobody at ' + pos + ' next season</div>';
    list.forEach(function(x) {
      var isNew = x.signed || incomingNames[x.name];
      h += '<div class="acq-pos-row"><span>' + x.name + ' <span class="sg-meta">' + x.cls + '</span>'
        + (isNew ? ' <span class="tag t-ok">New</span>' : '') + '</span><b>' + x.ovr + '</b></div>';
    });
    h += '</div>';
  });
  return h;
}

// ── Player page / filter sheet ────────────────────────────
// renderers[kind](state) → { title, html }
var _renderers = {};
var _cur = null;      // { kind, id, tab }
var _bind = null;     // binds the screen's click handler to the sheet body

export function registerSheet(kind, fn) { _renderers[kind] = fn; }
export function setSheetBinder(fn) { _bind = fn; }

export function openPage(kind, id, tab) {
  _cur = { kind: kind, id: id, tab: tab || 'overview' };
  draw();
}
export function setPageTab(tab) { if (_cur) { _cur.tab = tab; draw(); } }
export function current() { return isSheetOpen() ? _cur : null; }

// Re-render the open sheet after any action (offer, points, filters)
export function refreshSheet() {
  if (!_cur || !isSheetOpen()) { _cur = isSheetOpen() ? _cur : null; return; }
  draw();
}

function draw() {
  var fn = _renderers[_cur.kind];
  if (!fn) return;
  var out = fn(_cur);
  if (!out) return;
  var body = ge('sheet-body');
  var keepScroll = isSheetOpen() ? (body && body.parentNode ? body.parentNode.scrollTop : 0) : 0;
  openSheet(out.html, out.title);
  if (body && body.parentNode && keepScroll) body.parentNode.scrollTop = keepScroll;
  if (_bind && body) _bind(body);
}

// Tabs inside a player page
export function pageTabs(list, cur) {
  var h = '<div class="pp-tabs">';
  list.forEach(function(t) { h += '<button class="pp-tab' + (t.id === cur ? ' on' : '') + '" data-pptab="' + t.id + '">' + t.label + '</button>'; });
  return h + '</div>';
}

// Top of a player page: name line + big overall/potential
export function pageTop(name, line, ovr, pot, extra, p) {
  // p (the player object) is optional. portal.js passes it; for recruit pages
  // (recruiting.js is Claude's file) look it up read-only by name.
  if (!p && typeof G !== 'undefined') {
    p = ((G.recruits || []).find(function(r) { return r.name === name; })
      || (G.portalEntrants || []).find(function(e) { return e.name === name; })
      || null);
  }
  var face = p ? playerFaceSmallHTML(p) : '';
  return '<div class="pp-top"><div class="pp-id">' + face + '<div><div class="pp-name">' + name + '</div><div class="pp-line">' + line + '</div></div></div>'
    + '<div class="pp-nums"><div><b>' + ovr + '</b><span>Overall</span></div><div><b>' + pot + '</b><span>Potential</span></div></div></div>'
    + (extra || '');
}
