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
import { playerType } from './scouting.js';

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
  h += '<button class="btn-big btn-full" style="margin-top:12px;" data-start-season>Start the ' + (G.yr + 1) + ' season</button>';
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
