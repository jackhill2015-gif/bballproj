// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/signings.js
//  Who signed where, made explicit. Every portal and recruiting
//  decision that involves you is logged:
//    you     — signed with you
//    other   — a player you pursued chose another school
//    stayed  — a transfer you pursued went back to his old school
//    left    — one of your players transferred out
//    returns — one of your players in the portal came back
//  Shown as: a "Round results" panel after each round, a
//  "Your incoming class" panel on the portal and recruiting screens,
//  a signing day screen, and an "Offseason moves" recap on Home.
//  State: G.signings = { yr, log: [items], report: { kind, title, items } }
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { playerType, nextSeasonRoster } from './scouting.js';

// A new log starts with each offseason; during the season the last
// offseason's log stays readable (Home shows it in the first weeks)
function store() {
  if (!G.signings || (G.signings.yr !== G.yr && G.phase === 'offseason')) G.signings = { yr: G.yr, log: [], report: null };
  return G.signings;
}

// Start a new round's report (the previous round's report is replaced)
export function beginReport(kind, title) {
  store().report = { kind: kind, title: title, items: [] };
}

export function noteSigning(kind, p, outcome, school, early) {
  var s = store();
  var it = { kind: kind, name: p.name, pos: p.pos, ovr: p.ovr, cls: p.cls, stars: p.stars || 0,
    outcome: outcome, school: school || '', early: !!early, type: playerType(p) };
  s.log.push(it);
  if (s.report) s.report.items.push(it);
}

function who(it) {
  return '<b>' + it.name + '</b> <span class="sg-meta">' + it.pos + ', ' + it.ovr
    + (it.kind === 'recruit' && it.stars ? ', ' + it.stars + '★' : '') + ' · ' + it.type + '</span>';
}

function group(title, items, cls, line) {
  if (!items.length) return '';
  var h = '<div class="sg-group ' + cls + '"><div class="sg-gh">' + title + ' <span>' + items.length + '</span></div>';
  items.forEach(function(it) { h += '<div class="sg-row">' + who(it) + (line ? '<span class="sg-to">' + line(it) + '</span>' : '') + '</div>'; });
  return h + '</div>';
}

function groupsHTML(items) {
  var by = function(o) { return items.filter(function(x) { return x.outcome === o; }); };
  return group('Signed with you', by('you'), 'good', function(it) { return it.early ? 'Committed early' : ''; })
    + group('Chose another school', by('other'), 'bad', function(it) { return it.school ? it.school : 'Undecided'; })
    + group('Stayed at his old school', by('stayed'), '', function(it) { return it.school; })
    + group('Picked you, but your roster was full', by('full'), 'bad', function() { return 'Offer refunded'; })
    + group('Your players who transferred out', by('left'), 'bad', function(it) { return it.school; })
    + group('Your players who came back', by('returns'), 'good', null);
}

// ── Open roster spots for next season ─────────────────────
// 15 minus returners (not graduating, not sitting in the portal), transfers
// already in, and signed recruits. You can only pursue as many players as
// you have open spots, so nobody who signs is ever cut for room.
export function openSpots() {
  try { return Math.max(0, 15 - nextSeasonRoster().length); } catch (e) { return 15; }
}

// ── Targets tab: everyone you pursued in one list ─────────
// Signed (green), still deciding (the live rows with your offers), went
// elsewhere (red). Replaces the separate offers / class / round results views.
function tgRow(it, cls, right) {
  return '<div class="tg-row ' + cls + '"><div class="acq-main"><div class="acq-name">' + it.name
    + (it.kind === 'recruit' && it.stars ? ' <span class="stars">' + '★'.repeat(it.stars) + '</span>' : '') + '</div>'
    + '<div class="acq-sub">' + it.pos + ', ' + it.ovr + (it.type ? ' · ' + it.type : '') + '</div></div>'
    + '<div class="tg-r">' + right + '</div></div>';
}
function tgGroup(title, n, body) {
  return '<div class="tg-h">' + title + ' <span>' + n + '</span></div>' + body;
}
export function targetsHTML(kind, pendingHTML, nPending) {
  var log = store().log.filter(function(x) { return x.kind === kind; });
  var signed = kind === 'recruit'
    ? (G.recruits || []).filter(function(r) { return r.signed === G.tid; }).map(function(r) {
        var l = log.find(function(x) { return x.name === r.name && x.outcome === 'you'; });
        return { kind: 'recruit', name: r.name, pos: r.pos, ovr: r.ovr, stars: r.stars, type: playerType(r), early: l ? l.early : false };
      })
    : log.filter(function(x) { return x.outcome === 'you'; });
  var lost = log.filter(function(x) { return x.outcome === 'other' || x.outcome === 'stayed' || x.outcome === 'full'; });
  var left = kind === 'portal' ? log.filter(function(x) { return x.outcome === 'left'; }) : [];
  var back = kind === 'portal' ? log.filter(function(x) { return x.outcome === 'returns'; }) : [];
  var open = openSpots();
  var h = '<div class="tg-sum"><b>' + open + '</b> open spot' + (open !== 1 ? 's' : '') + ' for next season · <b>' + nPending + '</b> still deciding'
    + (open > 0 && nPending >= open ? '<div class="tg-note">Every open spot has someone in the running. Drop one to go after someone else.</div>' : '')
    + (open === 0 ? '<div class="tg-note">Your roster is full for next season.</div>' : '')
    + '</div>';
  if (signed.length) h += tgGroup('Signed with you', signed.length, signed.map(function(it) { return tgRow(it, 'good', it.early ? 'Committed early' : 'Signed'); }).join(''));
  h += tgGroup('Still deciding', nPending, nPending ? pendingHTML : '<div class="tg-none">' + (kind === 'portal' ? 'No offers out. Open a player on the Board to make one.' : 'Nobody targeted. Open a recruit on the Board to add him.') + '</div>');
  if (lost.length) h += tgGroup('Went elsewhere', lost.length, lost.map(function(it) {
    return tgRow(it, 'bad', it.outcome === 'full' ? 'Roster was full' : it.outcome === 'stayed' ? 'Stayed at ' + it.school : (it.school || 'Undecided'));
  }).join(''));
  if (kind === 'recruit') {
    var tin = store().log.filter(function(x) { return x.kind === 'portal' && x.outcome === 'you'; });
    if (tin.length) h += tgGroup('Transfers signed in the portal', tin.length, tin.map(function(it) { return tgRow(it, 'good', 'Transfer'); }).join(''));
  }
  if (left.length) h += tgGroup('Your players who left', left.length, left.map(function(it) { return tgRow(it, 'bad', it.school || ''); }).join(''));
  if (back.length) h += tgGroup('Your players who came back', back.length, back.map(function(it) { return tgRow(it, 'good', 'Back'); }).join(''));
  return h;
}

// Panel for the latest round (shown until the next round starts)
export function reportHTML() {
  var s = G.signings;
  if (!s || s.yr !== G.yr || !s.report) return '';
  var r = s.report;
  var body = r.items.length ? groupsHTML(r.items)
    : '<div class="sg-none">No decisions involving you this round.</div>';
  return '<div class="panel sg-panel"><div class="panel-h"><span>Round results</span><small>' + r.title + '</small></div>'
    + '<div class="panel-b">' + body + '</div></div>';
}

// Who is joining next season so far: transfers in + signed recruits,
// plus your players who have left through the portal
export function classPanelHTML() {
  var s = store();
  var transfers = s.log.filter(function(x) { return x.kind === 'portal' && x.outcome === 'you'; });
  var recruits = (G.recruits || []).filter(function(r) { return r.signed === G.tid; });
  var left = s.log.filter(function(x) { return x.outcome === 'left'; });
  var t = G.teams[G.tid];
  var returning = (t.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs) && p.portalYr !== G.yr; });
  var inPortal = (G.portalEntrants || []).filter(function(e) { return e.fromTid === G.tid && e.pickedBy === -1; }).length;
  var total = returning.length - inPortal + transfers.length + recruits.length;
  var h = '<div class="panel sg-panel"><div class="panel-h"><span>Your incoming class</span><small>'
    + Math.min(total, 15) + ' of 15 roster spots filled for next season</small></div><div class="panel-b">';
  if (total > 15) {
    var extra = total - 15;
    var cut = recruits.slice().sort(function(a, b) { return a.ovr - b.ovr; }).slice(0, extra);
    h += '<div class="sg-warn">You have ' + total + ' players for 15 spots. '
      + (cut.length ? 'Your lowest-rated signee' + (cut.length > 1 ? 's' : '') + ' (' + cut.map(function(r) { return r.name; }).join(', ') + ') will not join.' : 'Some signees will not fit.')
      + '</div>';
  }
  if (!transfers.length && !recruits.length && !left.length) {
    h += '<div class="sg-none">Nobody has committed yet.</div>';
  } else {
    h += group('Transfers in', transfers, 'good', null);
    h += group('Recruits signed', recruits.map(function(r) {
      return { name: r.name, pos: r.pos, ovr: r.ovr, stars: r.stars, kind: 'recruit', type: playerType(r) };
    }), 'good', null);
    h += group('Transferred out', left, 'bad', function(it) { return it.school; });
  }
  return h + '</div></div>';
}

// Signing day: the whole recruiting cycle's results in one place
export function signingDayHTML() {
  var s = store();
  var recruitLog = s.log.filter(function(x) { return x.kind === 'recruit'; });
  var h = '<div class="sec-head">Signing day</div>'
    + '<div class="sec-sub" style="margin-bottom:12px;">Every recruit has decided. Here is how your class came together.</div>';
  h += '<div class="panel sg-panel"><div class="panel-h"><span>Recruiting results</span><small>All three phases</small></div><div class="panel-b">'
    + (recruitLog.length ? groupsHTML(recruitLog) : '<div class="sg-none">You did not pursue any recruits this year.</div>') + '</div></div>';
  h += classPanelHTML();
  h += '<button class="btn-big btn-full" style="margin-top:12px;" data-to-schedule>Next: non-conference schedule</button>';
  return h;
}

// Home, first weeks of the new season: last offseason's moves
export function offseasonMovesHTML() {
  var s = G.signings;
  if (!s || s.yr !== G.yr - 1 || (G.gi || 0) > 3 || G.phase !== 'reg') return '';
  var onRoster = {};
  ((G.teams[G.tid] || {}).rost || []).forEach(function(p) { onRoster[p.name] = true; });
  var ins = s.log.filter(function(x) { return x.outcome === 'you' && onRoster[x.name]; });
  var outs = s.log.filter(function(x) { return x.outcome === 'left'; });
  if (!ins.length && !outs.length) return '';
  var h = '<div class="panel sg-panel"><div class="panel-h"><span>Offseason moves</span><small>' + ins.length + ' in, ' + outs.length + ' out</small></div><div class="panel-b">';
  h += group('New arrivals', ins, 'good', function(it) { return it.kind === 'portal' ? 'Transfer' : 'Freshman'; });
  h += group('Transferred out', outs, 'bad', function(it) { return it.school; });
  return h + '</div></div>';
}
