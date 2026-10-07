// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/scouting.js
//  Scouting reports for recruits and transfer portal entrants:
//    type        — what kind of player he is (from his rating profile)
//    strengths / weaknesses
//    fit         — where he'd slot on YOUR roster next season, whether
//                  he covers a weak spot, and how he suits your gameplan
//  Read-only: never changes G. Used by views/recruiting.js and
//  views/portal.js (one-line summary in the table, full report in
//  the detail row).
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';

var ATTRS = ['sht', 'fin', 'def', 'reb', 'ply'];
var ATTR_NAME = { sht: 'Shooting', fin: 'Finishing', def: 'Defense', reb: 'Rebounding', ply: 'Playmaking' };
var ATTR_NOUN = { sht: 'shooting', fin: 'finishing at the rim', def: 'defense', reb: 'rebounding', ply: 'playmaking' };

// Player type by position and standout skill
var TYPES = {
  PG: { ply: 'Floor general', sht: 'Scoring guard', fin: 'Slashing guard', def: 'Defensive guard', reb: 'Big guard', all: 'All-around guard' },
  SG: { sht: 'Sharpshooter', fin: 'Slasher', def: 'Perimeter stopper', ply: 'Combo guard', reb: 'Rebounding guard', all: 'All-around guard', sd: '3-and-D wing' },
  SF: { sht: 'Wing scorer', def: 'Two-way wing', ply: 'Point forward', fin: 'Slashing wing', reb: 'Glue forward', all: 'All-around wing', sd: '3-and-D wing' },
  PF: { sht: 'Stretch four', reb: 'Glass cleaner', fin: 'Post scorer', def: 'Defensive forward', ply: 'Point forward', all: 'All-around forward' },
  C:  { def: 'Rim protector', reb: 'Glass cleaner', fin: 'Post scorer', sht: 'Stretch big', ply: 'Passing big', all: 'All-around big' }
};

// What each gameplan leans on (views/strategy.js keys)
var SCHEME = {
  off: {
    motion: { name: 'Motion offense', keys: ['ply', 'sht'] },
    drive: { name: 'Drive offense', keys: ['fin', 'ply'] },
    set: { name: 'Set offense', keys: ['fin', 'reb'] },
    early: { name: 'Early offense', keys: ['sht', 'ply'] }
  },
  def: {
    man: { name: 'man-to-man', keys: ['def'] },
    '2-3': { name: '2-3 zone', keys: ['def', 'reb'] },
    '3-2': { name: '3-2 zone', keys: ['def'] },
    '1-3-1': { name: '1-3-1 zone', keys: ['def', 'ply'] },
    box1: { name: 'box-and-one', keys: ['def'] }
  }
};

function mean(p) { return (p.sht + p.fin + p.def + p.reb + p.ply) / 5; }

// League average of each rating by position (cached per season), so a
// point guard is judged against point guards, a center against centers
var _pos = { key: '', v: null };
function posNorms() {
  var key = G.yr + ':' + G.teams.length;
  if (_pos.key === key) return _pos.v;
  var acc = {};
  G.teams.forEach(function(tm) {
    (tm.rost || []).forEach(function(p) {
      var a = acc[p.pos] || (acc[p.pos] = { n: 0, sht: 0, fin: 0, def: 0, reb: 0, ply: 0 });
      a.n++; ATTRS.forEach(function(k) { a[k] += p[k]; });
    });
  });
  var v = {};
  Object.keys(acc).forEach(function(pos) { v[pos] = {}; ATTRS.forEach(function(k) { v[pos][k] = acc[pos][k] / Math.max(1, acc[pos].n); }); });
  _pos = { key: key, v: v };
  return v;
}
// Each rating relative to his position, with his overall level removed:
// positive = a standout skill for his position, negative = a hole
function relProfile(p) {
  var n = posNorms()[p.pos], z = {}, mz = 0;
  ATTRS.forEach(function(a) { z[a] = p[a] - (n ? n[a] : mean(p)); mz += z[a]; });
  mz /= 5;
  ATTRS.forEach(function(a) { z[a] -= mz; });
  return z;
}
function sorted(p) { var z = relProfile(p); return ATTRS.slice().sort(function(a, b) { return z[b] - z[a]; }); }

// ── Player type ───────────────────────────────────────────
export function playerType(p) {
  var t = TYPES[p.pos] || TYPES.SF;
  var z = relProfile(p), s = sorted(p);
  if (z[s[0]] < 4) return t.all;
  // shooter who also defends
  if (t.sd && (s[0] === 'sht' || s[0] === 'def') && z.sht >= 2 && z.def >= 2) return t.sd;
  return t[s[0]] || t.all;
}

// Strengths: well above his own level (or simply elite); weaknesses: well below
export function strengthsAndWeaknesses(p) {
  var z = relProfile(p), n = posNorms()[p.pos] || {}, str = [], weak = [];
  sorted(p).forEach(function(a) {
    var v = p[a], avg = n[a] || 70;
    // strengths: elite, or a standout for him that is also above average for his position
    if (v >= 92 || (z[a] >= 6 && v >= avg + 4)) str.push((v >= 92 ? 'Elite ' : '') + ATTR_NAME[a].toLowerCase());
    // weaknesses: a hole for him that is also below average for his position
    else if ((z[a] <= -8 && v < avg - 2) || v < 50) weak.push(ATTR_NAME[a].toLowerCase());
  });
  return { strengths: str.slice(0, 3), weaknesses: weak.slice(-2) };
}

// ── Your roster next season ───────────────────────────────
// Returners (not graduating seniors, not your own players sitting in the
// portal) plus recruits who already signed with you.
function nextSeason() {
  var t = G.teams[G.tid];
  var inPortal = {};
  (G.portalEntrants || []).forEach(function(e) { if (e.fromTid === G.tid && e.pickedBy === -1) inPortal[e.name] = true; });
  var list = (t.rost || []).filter(function(p) { return !(p.cls === 'SR' && !p.rs) && !inPortal[p.name]; })
    .map(function(p) { return { name: p.name, pos: p.pos, ovr: p.ovr, cls: nextCls(p), p: p }; });
  (G.recruits || []).forEach(function(r) {
    if (r.signed === G.tid) list.push({ name: r.name, pos: r.pos, ovr: r.ovr, cls: 'FR', p: r, signed: true });
  });
  return list.sort(function(a, b) { return b.ovr - a.ovr; });
}
function nextCls(p) {
  if (p.rs) return p.cls;
  return { FR: 'SO', SO: 'JR', JR: 'SR', SR: 'SR' }[p.cls] || p.cls;
}

// League baseline: average of each rating across every team's top eight
var _base = { key: '', v: null };
function leagueBaseline() {
  var key = G.yr + ':' + G.teams.length;
  if (_base.key === key) return _base.v;
  var sum = { sht: 0, fin: 0, def: 0, reb: 0, ply: 0 }, n = 0;
  G.teams.forEach(function(tm) {
    (tm.rost || []).slice().sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 8).forEach(function(p) {
      ATTRS.forEach(function(a) { sum[a] += p[a]; }); n++;
    });
  });
  var v = {}; ATTRS.forEach(function(a) { v[a] = sum[a] / Math.max(1, n); });
  _base = { key: key, v: v };
  return v;
}

// Your projected top eight vs the league: the area where you trail the
// national average most (or lead it least) is your need
function teamNeed(roster) {
  var top = roster.slice(0, 8);
  if (!top.length) return null;
  var base = leagueBaseline(), worst = null;
  ATTRS.forEach(function(a) {
    var avg = top.reduce(function(s, x) { return s + x.p[a]; }, 0) / top.length;
    var gap = avg - base[a];
    if (!worst || gap < worst.gap) worst = { attr: a, gap: gap, avg: avg };
  });
  return worst;
}

// ── Fit report ────────────────────────────────────────────
export function fitReport(p) {
  var t = G.teams[G.tid];
  var roster = nextSeason().filter(function(x) { return x.name !== p.name; });
  var rank = roster.filter(function(x) { return x.ovr > p.ovr; }).length + 1;
  var samePos = roster.filter(function(x) { return x.pos === p.pos; });
  var bestPos = samePos[0] || null;

  var role, roleTxt;
  if (rank <= 5) { role = 'Starter'; roleTxt = rank === 1 ? 'Would be your best player' : 'Would start'; }
  else if (rank <= 8) { role = 'Rotation'; roleTxt = 'Rotation minutes'; }
  else { role = 'Bench'; roleTxt = 'Bench to start'; }

  var posTxt;
  if (!bestPos) posTxt = 'You have no ' + p.pos + ' returning next season.';
  else if (p.ovr > bestPos.ovr) posTxt = 'Better than your best returning ' + p.pos + ', ' + bestPos.name + ' (' + bestPos.ovr + ').';
  else posTxt = 'Behind ' + bestPos.name + ' (' + bestPos.ovr + ') at ' + p.pos + '.';

  var need = teamNeed(roster), needTxt = '', fillsNeed = false;
  if (need) {
    // he must be better there than your current top eight, and good enough to play
    var eighth = roster[7] ? roster[7].ovr : 0;
    fillsNeed = p[need.attr] >= need.avg + 3 && p.ovr >= eighth - 3;
    var area = need.gap < -1 ? 'your weakest area (below the national average)' : 'your thinnest area';
    needTxt = fillsNeed
      ? 'Upgrades ' + ATTR_NOUN[need.attr] + ', ' + area + '.'
      : 'Does not help ' + ATTR_NOUN[need.attr] + ', ' + area + '.';
  }

  var strat = (t && t.strat) || {};
  var off = SCHEME.off[strat.off], df = SCHEME.def[strat.def] || SCHEME.def.man;
  var m = mean(p), schemeTxt = '', schemeFit = 0;
  if (off) {
    var ok = off.keys.reduce(function(s, a) { return s + p[a]; }, 0) / off.keys.length - m;
    schemeFit = ok >= 3 ? 1 : ok <= -5 ? -1 : 0;
    schemeTxt = schemeFit > 0 ? 'Good fit for your ' + off.name + '.' : schemeFit < 0 ? 'Awkward fit for your ' + off.name + '.' : 'Neutral fit for your ' + off.name + '.';
  }
  var dk = df.keys.reduce(function(s, a) { return s + p[a]; }, 0) / df.keys.length - m;
  var defTxt = dk >= 3 ? 'Suits your ' + df.name + ' defense.' : dk <= -5 ? 'A liability in your ' + df.name + ' defense.' : '';

  return { role: role, roleTxt: roleTxt, rank: rank, posTxt: posTxt, needTxt: needTxt, fillsNeed: fillsNeed,
    schemeTxt: schemeTxt, schemeFit: schemeFit, defTxt: defTxt, depth: samePos };
}

// One line for the table: "Sharpshooter · Would start"
export function scoutLine(p) {
  var f = fitReport(p);
  var col = f.role === 'Starter' ? 'var(--grn2)' : f.role === 'Rotation' ? 'var(--txt2)' : 'var(--txt3)';
  // Short labels so the line fits a phone row; the full sentence is on the player page
  var short = f.rank === 1 ? 'Best player' : f.role === 'Starter' ? 'Starter' : f.role === 'Rotation' ? 'Rotation' : 'Bench';
  return '<span class="sc-type">' + playerType(p) + '</span> · <span style="color:' + col + ';">' + short + '</span>'
    + (f.fillsNeed ? ' · <span style="color:var(--grn2);">Need</span>' : '');
}
export function roleOf(p) { return fitReport(p).role; }

// Full report for a detail row
// ── Report pieces (the player page uses them on separate tabs) ──
export function typeTagsHTML(p) {
  var sw = strengthsAndWeaknesses(p);
  return '<div class="scout-type">' + playerType(p) + ' <span>' + p.pos + '</span></div>'
    + '<div class="scout-tags">'
    + sw.strengths.map(function(s) { return '<span class="sc-tag up">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>'; }).join('')
    + sw.weaknesses.map(function(s) { return '<span class="sc-tag dn">Weak ' + s + '</span>'; }).join('')
    + (sw.strengths.length + sw.weaknesses.length ? '' : '<span class="sc-tag">No standout skills or holes</span>')
    + '</div>';
}
export function ratingBarsHTML(p) {
  var h = '';
  ATTRS.forEach(function(a) {
    var v = p[a], w = Math.max(4, Math.min(100, (v - 35) / 64 * 100));
    var col = v >= 85 ? 'var(--grn2)' : v >= 70 ? 'var(--blu)' : v >= 58 ? 'var(--txt3)' : 'var(--red)';
    h += '<div class="sc-bar"><span class="sc-bl">' + ATTR_NAME[a] + '</span><span class="sc-track"><span style="width:' + w + '%;background:' + col + ';"></span></span><b>' + v + '</b></div>';
  });
  return h;
}
export function fitListHTML(p) {
  var f = fitReport(p);
  return '<ul class="scout-fit">'
    + '<li><b>' + f.roleTxt + '</b> (would rank #' + f.rank + ' on your roster by overall rating). ' + f.posTxt + '</li>'
    + (f.needTxt ? '<li' + (f.fillsNeed ? ' class="good"' : '') + '>' + f.needTxt + '</li>' : '')
    + (f.schemeTxt ? '<li' + (f.schemeFit > 0 ? ' class="good"' : f.schemeFit < 0 ? ' class="bad"' : '') + '>' + f.schemeTxt + '</li>' : '')
    + (f.defTxt ? '<li>' + f.defTxt + '</li>' : '')
    + '</ul>'
    + '<div class="scout-depth"><span>Your ' + p.pos + 's next season:</span> '
    + (f.depth.length ? f.depth.map(function(x) { return x.name + ' ' + x.ovr + ' (' + x.cls + (x.signed ? ', signed' : '') + ')'; }).join(', ') : 'none')
    + '</div>';
}
// Your roster next season (returners + signed recruits), best first
export function nextSeasonRoster() { return nextSeason(); }

export function scoutingHTML(p) {
  var t = G.teams[G.tid];
  return '<div class="scout"><div class="scout-col"><div class="card-title">Scouting report</div>' + typeTagsHTML(p) + ratingBarsHTML(p) + '</div>'
    + '<div class="scout-col"><div class="card-title">Fit with ' + (t ? t.name : 'your team') + ' next season</div>' + fitListHTML(p) + '</div></div>';
}
