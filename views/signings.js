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

// ── Class rankings: every school's recruiting and transfer class ──
// Score works like the recruiting sites: each signee is worth points by
// stars (recruits) or rating (transfers), best first, with each extra
// signee counting a little less (x0.85), so depth helps but stars win.
var STAR_PTS = { 5: 100, 4: 72, 3: 48, 2: 28, 1: 15 };
var _sgTab = 'class', _sgKind = 'recruit';
export function setSigningTab(tab, kind) { if (tab) _sgTab = tab; if (kind) _sgKind = kind; }
if (typeof window !== 'undefined') window._setSigningTab = setSigningTab;

function classTable(kind) {
  var by = {};
  var add = function(tid, v, p) { (by[tid] = by[tid] || { tid: tid, vals: [], players: [] }); by[tid].vals.push(v); by[tid].players.push(p); };
  if (kind === 'recruit') {
    (G.recruits || []).forEach(function(r) {
      if (r.signed >= 0 && G.teams[r.signed]) add(r.signed, (STAR_PTS[r.stars] || 15) + r.ovr * 0.1, r);
    });
  } else {
    G.teams.forEach(function(t) {
      (t.rost || []).forEach(function(p) { if (p.portalYr === G.yr) add(t.id, Math.max(5, (p.ovr - 60) * 3), p); });
    });
  }
  // CPU classes count only who will actually join (best by rating, up to
  // their open spots and 8 per class: the same cap the new season applies)
  if (kind === 'recruit') Object.keys(by).forEach(function(k) {
    var c = by[k]; if (+k === G.tid) return;
    var tm = G.teams[k];
    var room = Math.max(0, 15 - (tm.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs); }).length);
    var keep = c.players.map(function(p, i) { return { p: p, v: c.vals[i] }; }).sort(function(a, b) { return b.p.ovr - a.p.ovr; }).slice(0, Math.min(8, room));
    c.players = keep.map(function(x) { return x.p; }); c.vals = keep.map(function(x) { return x.v; });
    if (!c.players.length) delete by[k];
  });
  var rows = Object.keys(by).map(function(k) {
    var c = by[k];
    var vals = c.vals.slice().sort(function(a, b) { return b - a; });
    var score = vals.reduce(function(a, v, i) { return a + v * Math.pow(0.85, i); }, 0);
    var avg = Math.round(c.players.reduce(function(a, p) { return a + p.ovr; }, 0) / c.players.length);
    return { tid: c.tid, n: c.players.length, score: Math.round(score), avg: avg, players: c.players };
  });
  rows.sort(function(a, b) { return b.score - a.score || b.avg - a.avg; });
  return rows;
}

function starLine(players) {
  var cnt = {};
  players.forEach(function(p) { cnt[p.stars || 0] = (cnt[p.stars || 0] || 0) + 1; });
  return [5, 4, 3, 2, 1].filter(function(k) { return cnt[k]; }).map(function(k) { return cnt[k] + '×' + k + '★'; }).join(' · ');
}

export function classRankingsHTML() {
  var rows = classTable(_sgKind);
  var meIdx = rows.findIndex(function(r) { return r.tid === G.tid; });
  var other = classTable(_sgKind === 'recruit' ? 'portal' : 'recruit');
  var meOther = other.findIndex(function(r) { return r.tid === G.tid; });
  var label = _sgKind === 'recruit' ? 'recruiting class' : 'transfer class';
  var h = '<div class="cr-sum">' + (meIdx >= 0 ? 'Your ' + label + ' ranks <b>#' + (meIdx + 1) + '</b> of ' + rows.length + '.' : 'You did not sign a ' + label + '.')
    + (meOther >= 0 ? ' Your ' + (_sgKind === 'recruit' ? 'transfer' : 'recruiting') + ' class: #' + (meOther + 1) + '.' : '') + '</div>';
  h += '<div class="fbar" style="margin-bottom:8px;"><button class="fchip' + (_sgKind === 'recruit' ? ' on' : '') + '" data-sgkind="recruit">Recruiting classes</button>'
    + '<button class="fchip' + (_sgKind === 'portal' ? ' on' : '') + '" data-sgkind="portal">Transfer classes</button></div>';
  var show = rows.slice(0, 25);
  if (meIdx >= 25) show.push(null, rows[meIdx]);
  h += '<div class="panel"><div class="panel-b flush"><table class="cr-tbl"><thead><tr><th class="num">#</th><th>School</th><th class="num">Signed</th><th class="num">Avg</th><th class="num">Score</th></tr></thead><tbody>';
  show.forEach(function(r) {
    if (!r) { h += '<tr><td colspan="5" class="cr-gap">…</td></tr>'; return; }
    var t = G.teams[r.tid], rk = rows.indexOf(r) + 1;
    h += '<tr' + (r.tid === G.tid ? ' class="hl"' : '') + '><td class="num">' + rk + '</td>'
      + '<td><div class="cr-name">' + t.name + '</div><div class="cr-sub">' + (_sgKind === 'recruit' ? starLine(r.players) : r.players.slice().sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3).map(function(p) { return p.pos + ' ' + p.ovr; }).join(' · ')) + '</div></td>'
      + '<td class="num">' + r.n + '</td><td class="num">' + r.avg + '</td><td class="num"><b>' + r.score + '</b></td></tr>';
  });
  if (!rows.length) h += '<tr><td colspan="5" class="cr-gap">No signings yet.</td></tr>';
  return h + '</tbody></table></div></div>';
}

// Signing day: the whole recruiting cycle's results in one place
export function signingDayHTML() {
  if (_sgTab === 'rank') {
    return '<div class="sec-head">Signing day</div>'
      + '<div class="fbar" style="margin:4px 0 10px;"><button class="fchip" data-sgtab="class">Your class</button><button class="fchip on" data-sgtab="rank">Class rankings</button></div>'
      + classRankingsHTML()
      + '<button class="btn-big btn-full" style="margin-top:12px;" data-to-schedule>Next: non-conference schedule</button>';
  }
  var s = store();
  var recruitLog = s.log.filter(function(x) { return x.kind === 'recruit'; });
  var h = '<div class="sec-head">Signing day</div>'
    + '<div class="fbar" style="margin:4px 0 10px;"><button class="fchip on" data-sgtab="class">Your class</button><button class="fchip" data-sgtab="rank">Class rankings</button></div>'
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
