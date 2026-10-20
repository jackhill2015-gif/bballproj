// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/build.js
//  Build your roster: high school recruiting and the transfer
//  portal on one screen. Needs by position at the top, one
//  player table with High school / Transfers tabs, one targets
//  list, and one button that runs both rounds together.
//  Every player shows the offer it takes to be favored (a 50%
//  chance on decision day) and whether that fits what you have
//  left across your open spots.
//  The offer rules live in views/portal.js and views/recruiting.js
//  (recruiting registers its pieces here to avoid an import cycle).
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import * as P from './portal.js';
import * as Battle from './battle.js';
import * as Acq from './acq.js';
import { openSpots, pursuitsOut, targetsHTML } from './signings.js';
import { playerType, nextSeasonRoster } from './scouting.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

// Recruiting pieces (registered by views/recruiting.js):
// pointsFor50(r, rankOf), chanceAt(r, pts, rankOf), pointsLeft(), pendingHTML()
var _api = {};
export function registerBuildApi(a) { Object.keys(a).forEach(function(k) { _api[k] = a[k]; }); }

// View state, remembered across visits (ui-prefs, never in the save)
var _b = getUiPrefs('build');
export function buildPrefs() { return _b; }
function remember() { setUiPrefs('build', _b); }

var POSL = ['PG', 'SG', 'SF', 'PF', 'C'];
var GROUP = { PG: 'g', SG: 'g', SF: 'w', PF: 'b', C: 'b' };
var GROUP_NAME = { g: ['guard', 'guards'], w: ['wing', 'wings'], b: ['big', 'bigs'] };
// A full roster carries about 5 guards, 3 wings and 5 bigs
var GROUP_TARGET = { g: 5, w: 3, b: 5 };

// ── Needs by position, from next season's roster ──
export function rosterNeeds() {
  var cnt = { g: 0, w: 0, b: 0 };
  nextSeasonRoster().forEach(function(x) { if (GROUP[x.pos]) cnt[GROUP[x.pos]]++; });
  var need = {};
  Object.keys(GROUP_TARGET).forEach(function(k) { need[k] = Math.max(0, GROUP_TARGET[k] - cnt[k]); });
  return need;
}
function needsLine(need) {
  var parts = ['g', 'w', 'b'].filter(function(k) { return need[k] > 0; }).map(function(k) {
    return need[k] + ' ' + GROUP_NAME[k][need[k] > 1 ? 1 : 0];
  });
  return parts.length ? parts.join(', ') : 'none by position, take the best player';
}

// ── Budget fit ──
// What a player costs to be favored, and whether that fits what you have
// left: up to two even shares of your remaining budget across the spots
// you still have to fill (the most you'd put on one top target).
function fitOf(cost, offer, left, pursuing, slots) {
  if (!isFinite(cost)) return 'out';
  var extra = Math.max(0, cost - offer);
  var allow = pursuing ? left : Math.min(left, 2 * left / Math.max(1, slots));
  if (slots <= 0 && !pursuing) return 'full';
  if (extra <= allow) return 'fits';
  return extra <= left ? 'stretch' : 'over';
}
var FIT_LABEL = { fits: 'Fits', stretch: 'Stretch', over: 'Over budget', out: 'Out of reach', full: 'No spot' };
var FIT_RANK = { fits: 0, stretch: 1, over: 2, full: 2, out: 3 };

function rankMap() {
  var m = {};
  G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).forEach(function(t, i) { m[t.id] = i + 1; });
  return m;
}

// One row per player, for either board
function hsRows(need, slots) {
  var rankOf = rankMap(), left = _api.pointsLeft ? _api.pointsLeft() : 0, tg = G.recruitTargets || [];
  return (G.recruits || []).filter(function(r) { return r.status === 'open'; }).map(function(r) {
    var p50 = _api.pointsFor50 ? _api.pointsFor50(r, rankOf) : Infinity;
    var cost = isFinite(p50) ? Math.max(5, Math.ceil(p50 / 5 - 1e-9) * 5) : Infinity;
    var offer = r.points || 0, pursuing = tg.indexOf(r.id) >= 0 || offer > 0;
    return {
      kind: 'hs', id: r.id, p: r, name: r.name, pos: r.pos, stars: r.stars, cls: 'HS', late: !!r.late,
      ovr: r.ovr, pot: r.pot || r.ovr, stat: '#' + r.natRank, statSort: -r.natRank,
      cost: cost, unit: 'pts', offer: offer, pursuing: pursuing,
      odds: offer > 0 && _api.chanceAt ? _api.chanceAt(r, offer, rankOf) : null,
      fit: fitOf(cost, offer, left, pursuing, slots), need: need[GROUP[r.pos]] > 0,
      value: (r.ovr + (r.pot || r.ovr)) / 2
    };
  });
}
function trRows(need, slots) {
  var left = G.pts || 0;
  return P.portalBoard().filter(function(e) { return e.fromTid !== G.tid && e.pickedBy === -1; }).map(function(e) {
    var cost = P.nilFor50(e), offer = e.offer || 0, pursuing = offer > 0;
    var st = P.entrantStats(e);
    return {
      kind: 'tr', id: e.pid, p: e, name: e.name, pos: e.pos, cls: e.cls, late: !!e.late,
      ovr: e.ovr, pot: e.pot || e.ovr,
      stat: st ? st.ppg.toFixed(1) + ' / ' + st.rpg.toFixed(1) + ' / ' + st.apg.toFixed(1) : '-', statSort: st ? st.ppg : -1,
      cost: cost, unit: 'NIL', offer: offer, pursuing: pursuing,
      odds: pursuing ? P.portalChance(e).p : null,
      fit: fitOf(cost, offer, left, pursuing, slots), need: need[GROUP[e.pos]] > 0,
      value: e.ovr, from: e.fromName
    };
  });
}

// Best fit: ready players for transfers, the midpoint of now and potential
// for high school; a position of need counts 3 points; what you can afford
// comes first.
function fitScore(x) {
  return (x.pursuing ? 0 : FIT_RANK[x.fit] * -100) + x.value + (x.need ? 3 : 0);
}
var SORTS = {
  fit: function(x) { return fitScore(x); },
  name: function(x) { return x.name; },
  pos: function(x) { return -POSL.indexOf(x.pos); },
  cls: function(x) { return x.kind === 'hs' ? x.stars : ['FR', 'SO', 'JR', 'SR'].indexOf(x.cls); },
  type: function(x) { return typeOf(x); },
  ovr: function(x) { return x.ovr; },
  pot: function(x) { return x.pot; },
  stat: function(x) { return x.statSort; },
  cost: function(x) { return isFinite(x.cost) ? -x.cost : -1e9; },
  odds: function(x) { return x.odds === null ? -1 : x.odds; },
  offer: function(x) { return x.offer; }
};
// Text columns sort A-Z first; numbers high first
var ASC_FIRST = { name: 1, type: 1 };
function typeOf(x) { if (x._type === undefined) x._type = playerType(x.p); return x._type; }

function sortRows(rows) {
  var f = SORTS[_b.sort] || SORTS.fit, d = _b.dir || -1;
  rows.forEach(function(x) { x._k = f(x); });
  rows.sort(function(a, b) {
    if (a._k < b._k) return -d; if (a._k > b._k) return d;
    return fitScore(b) - fitScore(a);
  });
  return rows;
}

// Show at most this many rows (the high school pool is about 1,500); the
// players you're going after are always listed
export function rowCap() { return 60 + 10 * openSpots(); }

function filtered(rows) {
  var need = rosterNeeds();
  var out = rows.filter(function(x) {
    if (_b.pos === 'Needs' && !(need[GROUP[x.pos]] > 0)) return x.pursuing;
    if (_b.pos !== 'All' && _b.pos !== 'Needs' && x.pos !== _b.pos) return false;
    if (_b.fits && x.fit !== 'fits' && !x.pursuing) return false;
    return true;
  });
  sortRows(out);
  var cap = rowCap(), n = 0;
  return { rows: out.filter(function(x) { return x.pursuing || n++ < cap; }), total: out.length };
}

// ── Cells ──
function stars(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s; }
function money(v, unit) { return isFinite(v) ? v + ' ' + unit : '-'; }
function oddsCol(p) { return p >= 0.6 ? 'var(--grn2)' : p >= 0.3 ? 'var(--gld2)' : 'var(--red)'; }
function oddsTxt(x) {
  if (x.odds === null) return '<span class="dim">-</span>';
  var pct = Math.round(x.odds * 100);
  return '<b style="color:' + oddsCol(x.odds) + ';">' + pct + '%</b>';
}
function fitTxt(x) {
  if (x.pursuing) return '<span class="bld-fit on">In the running</span>';
  return '<span class="bld-fit ' + x.fit + '">' + FIT_LABEL[x.fit] + '</span>';
}
function openAttr(x) { return x.kind === 'hs' ? 'data-acq-open-r="' + x.id + '"' : 'data-acq-open-p="' + x.id + '"'; }
var _needTag = true; // off when every position group is short (the tag would mark everyone)
function tags(x) {
  return (x.need && _needTag ? ' <span class="tag t-ok">Need</span>' : '') + (x.late ? ' <span class="tag t-home">Late</span>' : '');
}
function clsCell(x) { return x.kind === 'hs' ? '<span class="stars">' + stars(x.stars) + '</span>' : x.cls; }

function th(key, label, cls) {
  var on = _b.sort === key;
  return '<th class="sortable' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + '" data-bsort="' + key + '" scope="col" aria-sort="'
    + (on ? (_b.dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + label
    + '<span class="bld-arrow" aria-hidden="true">' + (on ? (_b.dir > 0 ? '▲' : '▼') : '') + '</span></th>';
}

// Desktop: a real table, every column sortable
function tableHTML(rows, kind) {
  var h = '<div class="bld-tbl-wrap"><table class="bld-tbl"><thead><tr>'
    + th('name', 'Name', 'st-name') + th('pos', 'Pos') + th('cls', kind === 'hs' ? 'Stars' : 'Yr') + th('type', 'Type')
    + th('ovr', 'OVR', 'num') + th('pot', 'POT', 'num')
    + th('stat', kind === 'hs' ? 'Rank' : 'PTS / REB / AST', 'num')
    + th('cost', 'To be favored', 'num') + th('offer', 'Your offer', 'num') + th('odds', 'Odds', 'num') + th('fit', 'Fit')
    + '</tr></thead><tbody>';
  rows.forEach(function(x) {
    h += '<tr class="bld-row' + (x.pursuing ? ' hl' : '') + '" ' + openAttr(x) + ' role="button" tabindex="0">'
      + '<td class="st-name"><b>' + x.name + '</b>' + tags(x) + (x.from ? '<div class="bld-from">From ' + x.from + '</div>' : '') + '</td>'
      + '<td>' + x.pos + '</td><td>' + clsCell(x) + '</td><td class="bld-type">' + typeOf(x) + '</td>'
      + '<td class="num bld-ovr">' + x.ovr + '</td><td class="num">' + x.pot + '</td>'
      + '<td class="num">' + x.stat + '</td>'
      + '<td class="num">' + money(x.cost, x.unit) + '</td>'
      + '<td class="num">' + (x.offer ? x.offer : '<span class="dim">-</span>') + '</td>'
      + '<td class="num">' + oddsTxt(x) + '</td><td>' + fitTxt(x) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}

// Phones: a compact two-line row per player
function cardsHTML(rows) {
  var h = '<div class="bld-cards acq-list">';
  rows.forEach(function(x) {
    var right = x.pursuing ? oddsTxt(x) + ' <span class="dim">odds</span>' : (isFinite(x.cost) ? x.cost + ' ' + x.unit : 'Out of reach');
    h += '<div class="acq-row bld-card' + (x.pursuing ? ' hl' : '') + '" ' + openAttr(x) + ' role="button" tabindex="0">'
      + '<div class="acq-main"><div class="acq-name">' + x.name + ' <span class="acq-cls">' + (x.kind === 'hs' ? '<span class="stars">' + stars(x.stars) + '</span>' : x.cls) + '</span>' + tags(x) + '</div>'
      + '<div class="acq-sub">' + x.pos + ' · ' + typeOf(x) + (x.kind === 'tr' && x.stat !== '-' ? ' · ' + x.stat : '') + '</div></div>'
      + '<div class="acq-right"><div class="acq-big">' + x.ovr + '<span class="bld-pot">/' + x.pot + '</span></div>'
      + '<div class="acq-small">' + (x.pursuing ? right : (x.fit === 'fits' ? right : '<span class="bld-fit ' + x.fit + '">' + FIT_LABEL[x.fit] + '</span>')) + '</div></div></div>';
  });
  return h + '</div>';
}

var SORT_MENU = [['fit', 'Best fit'], ['ovr', 'Overall'], ['pot', 'Potential'], ['cost', 'Cost to be favored'], ['odds', 'Your odds'], ['pos', 'Position']];
function toolbarHTML(shown, total, all) {
  var h = '<div class="bld-tool"><label class="fsel"><span>Position</span><select data-bfilter="pos">';
  [['All', 'All'], ['Needs', 'Needs'], ['PG', 'PG'], ['SG', 'SG'], ['SF', 'SF'], ['PF', 'PF'], ['C', 'C']].forEach(function(o) {
    h += '<option value="' + o[0] + '"' + (_b.pos === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  h += '</select></label>'
    + '<label class="bld-check"><input type="checkbox" data-bfilter="fits"' + (_b.fits ? ' checked' : '') + '> Fits your budget</label>'
    + '<label class="fsel bld-sortsel"><span>Sort</span><select data-bfilter="sort">';
  SORT_MENU.forEach(function(o) { h += '<option value="' + o[0] + '"' + (_b.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
  h += '</select></label><span class="acq-count">' + (shown < total ? 'Showing the top ' + shown + ' of ' + total : total + ' of ' + all) + '</span></div>';
  return h;
}

// ── Shared targets list ──
function pendingTable(rows) {
  if (!rows.length) return '';
  var h = '<div class="acq-list">';
  rows.forEach(function(x) {
    var dec = x.kind === 'hs' ? 'data-pt-dec="' + x.id + '"' : 'data-poff-dec="' + x.id + '"';
    var inc = x.kind === 'hs' ? 'data-pt-inc="' + x.id + '"' : 'data-poff-inc="' + x.id + '"';
    var drop = x.kind === 'hs' ? 'data-rem-target="' + x.id + '"' : 'data-ppivot="' + x.id + '"';
    var trend = x.odds !== null ? ' ' + Battle.trendHTML(Math.round(x.odds * 100), x.p._prevPct) : '';
    h += '<div class="acq-orow bld-orow"><div class="acq-main" ' + openAttr(x) + ' role="button" tabindex="0"><div class="acq-name">' + x.name
      + ' <span class="acq-cls">' + x.pos + ', ' + x.ovr + '/' + x.pot + ' · ' + (x.kind === 'hs' ? 'High school' : 'Transfer') + '</span></div>'
      + '<div class="acq-sub">' + (x.odds !== null ? oddsTxt(x) + ' odds' + trend : 'No offer yet') + ' · about ' + money(x.cost, x.unit) + ' to be favored</div></div>'
      + '<div class="bt-offer"><button class="stepper' + (x.offer ? '' : ' off') + '" ' + dec + ' aria-label="Lower offer">−</button>'
      + '<span class="offer-v' + (x.offer ? ' on' : '') + '">' + x.offer + '</span>'
      + '<button class="stepper plus" ' + inc + ' aria-label="Raise offer">+</button>'
      + '<button class="btn-quiet btn-sm" ' + drop + '>Drop</button></div></div>';
  });
  return h + '</div>';
}

// ── Screen ──
export function stageIndex() { return Math.max(0, Math.min(2, (G.recruitPhase || 1) - 1)); }
function portalClosed() { return (G.portalStage || 0) >= 3; }

export function renderBuild() {
  var need = rosterNeeds();
  _needTag = !(need.g && need.w && need.b);
  var spots = openSpots(), out = pursuitsOut(), slots = spots - out;
  var stg = Battle.ACQ_STAGES[stageIndex()];
  var ptsLeft = _api.pointsLeft ? _api.pointsLeft() : 0;
  var hs = hsRows(need, slots), tr = trRows(need, slots);
  var mine = P.portalBoard().filter(function(e) { return e.fromTid === G.tid; });

  var h = '<div class="bld-wrap">';
  h += Acq.header('Build your roster', stg.tag + ' · ' + stg.name, [
    { v: ptsLeft, l: 'recruiting points', attr: 'data-budget-left' }, { v: G.pts || 0, l: 'NIL', attr: 'data-nil-left' },
    { v: spots, l: 'open spot' + (spots !== 1 ? 's' : '') }]);
  h += '<div class="bld-needs"><span>Needs: <b>' + needsLine(need) + '</b></span><span>' + out + ' of ' + spots + ' open spot' + (spots !== 1 ? 's' : '')
    + ' with someone in the running</span></div>';

  var tab = _b.tab;
  var signedN = (G.recruits || []).filter(function(r) { return r.signed === G.tid; }).length
    + ((G.signings && G.signings.yr === G.yr) ? G.signings.log : []).filter(function(x) { return x.kind === 'portal' && x.outcome === 'you'; }).length;
  h += Acq.tabs([
    { id: 'hs', label: 'High school', n: hs.length },
    { id: 'tr', label: 'Transfers', n: tr.length },
    { id: 'targets', label: 'Targets', n: out + signedN },
    { id: 'roster', label: 'Roster' }], tab);

  if (tab === 'hs' || tab === 'tr') {
    var all = tab === 'hs' ? hs : tr;
    if (tab === 'tr' && mine.length) {
      h += Acq.banner((mine.length === 1 ? 'One of your players is' : mine.length + ' of your players are') + ' in the portal and gone for good: '
        + mine.map(function(e) { return '<b>' + e.name + '</b> (' + e.pos + ', ' + e.ovr + ')'; }).join(', ') + '.');
    }
    var f = filtered(all);
    h += toolbarHTML(f.rows.length, f.total, all.length);
    if (tab === 'tr' && portalClosed()) h += Acq.empty('The transfer portal has closed for this year.');
    else if (!all.length) h += Acq.empty(tab === 'tr' ? 'No players are in the portal this year.' : 'No recruits are left on the board.');
    else if (!f.rows.length) h += Acq.empty(spots - out <= 0 && _b.fits ? 'Every open spot has someone in the running. Drop a target to go after someone else, or turn off Fits your budget.'
      : 'Nobody matches these filters. Turn off Fits your budget to see everyone.');
    else h += tableHTML(f.rows, tab) + cardsHTML(f.rows);
    h += '<div class="bld-key">To be favored: the offer that gives you an even chance on decision day, against the best rival offer as it will stand then. '
      + (tab === 'hs' ? 'Recruits are fickle: no offer is a lock.' : 'Transfers take the best deal: beat the top offer clearly and he is close to certain.')
      + ' Fits: you can be favored with what you have left across your open spots.</div>';
  } else if (tab === 'targets') {
    var pend = hs.filter(function(x) { return x.pursuing; }).concat(tr.filter(function(x) { return x.pursuing; }));
    pend.sort(function(a, b) { return b.ovr - a.ovr; });
    h += targetsHTML('all', pendingTable(pend), pend.length);
  } else {
    h += Acq.rosterTabHTML();
  }
  h += Acq.sticky('data-bstage', stageIndex() >= 2 ? 'Finalize: everyone decides' : stg.btn);
  Acq.refreshSheet();
  return h + '</div>';
}

// ── View actions ──
export function setBuildTab(t) { _b.tab = t; remember(); }
export function setBuildSort(key) {
  if (_b.sort === key) _b.dir = -_b.dir;
  else { _b.sort = key; _b.dir = ASC_FIRST[key] ? 1 : -1; }
  remember();
}
export function setBuildFilter(key, val) {
  if (key === 'fits') _b.fits = !!val;
  else if (key === 'sort') { _b.sort = val; _b.dir = ASC_FIRST[val] ? 1 : -1; }
  else _b[key] = val;
  remember();
}
