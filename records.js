// ═══════════════════════════════════════════════════════════
//  HOOPS OS — records.js
//  School record book + Hall of Fame. Pure game logic, no DOM.
//  UI side effects (log/toast) go through injected hooks so this
//  module stays importable from the engine (simulation.js) and
//  testable in node. Records are ambient: they break quietly,
//  surface as log lines + toasts, and live in the History view.
// ═══════════════════════════════════════════════════════════

import { G, LS } from './state.js';
import { awardScore, pickPositionalTeam } from './utils.js';

// ── Late-binding UI hooks (registered by main.js) ─────────
var _hooks = { log: null, toast: null };
export function registerRecordsCallbacks(h) {
  if (h.log) _hooks.log = h.log;
  if (h.toast) _hooks.toast = h.toast;
}

var STATS = ['pts', 'reb', 'ast', 'stl', 'blk'];
export var STAT_LABELS = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks'
};

// HOF bars
var HOF_PTS = 2000;        // career points → automatic induction
var RETIRE_PTS = 2500;    // career points → jersey retired

// ── Shape ─────────────────────────────────────────────────
// G.records = {
//   books: { [tid]: { game:{pts:entry,..}, season:{...}, career:{...} } },
//   hof: [ {name,pos,tid,school,yrs,pts,reb,ast,honors[],retired,yr} ]
// }
// entry = { v, name, yr }  (null = no record yet)

// ── Transient per-season highlights for the recap view ────
// (not saved; rebuilt every season)
function seasonBreaks() {
  if (!G._recBreaks) G._recBreaks = [];
  return G._recBreaks;
}
export function clearSeasonBreaks() { G._recBreaks = []; }

export function defaultRecords() {
  return { books: {}, hof: [] };
}

export function ensureRecords() {
  if (!G.records || typeof G.records !== 'object') G.records = defaultRecords();
  if (!G.records.books || typeof G.records.books !== 'object') G.records.books = {};
  if (!Array.isArray(G.records.hof)) G.records.hof = [];
  return G.records;
}

// Book for one school (created on demand, empty = honest).
export function bookFor(tid) {
  var R = ensureRecords();
  if (!R.books[tid]) {
    var b = { game: {}, season: {}, career: {} };
    STATS.forEach(function(s) { b.game[s] = null; b.season[s] = null; b.career[s] = null; });
    R.books[tid] = b;
  }
  return R.books[tid];
}

// ── Per-game stat snapshots ───────────────────────────────
// simGame accumulates straight into p.s, so callers snapshot
// before the game and diff after to get true game lines.

export function snapRoster(team) {
  return team.rost.map(function(p) {
    return { pts: p.s.pts || 0, reb: p.s.reb || 0, ast: p.s.ast || 0, stl: p.s.stl || 0, blk: p.s.blk || 0 };
  });
}

export function diffRoster(team, pre) {
  var out = [];
  team.rost.forEach(function(p, i) {
    var s0 = pre[i] || { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
    out.push({
      p: p,
      pts: (p.s.pts || 0) - s0.pts,
      reb: (p.s.reb || 0) - s0.reb,
      ast: (p.s.ast || 0) - s0.ast,
      stl: (p.s.stl || 0) - s0.stl,
      blk: (p.s.blk || 0) - s0.blk
    });
  });
  return out;
}

// Pull the user's team's lines out of a simGame result.
export function userLinesFromRes(res) {
  if (!res || !res.plines) return null;
  var pl = res.plines;
  if (pl.h && pl.h.tid === G.tid) return pl.h.lines;
  if (pl.a && pl.a.tid === G.tid) return pl.a.lines;
  return null;
}

// ── Record checking ─────────────────────────────────────

function entryText(scope, st, name, value, prev) {
  var label = STAT_LABELS[st];
  var scopeTxt = scope === 'game' ? 'single-game' : scope === 'season' ? 'single-season' : 'career';
  return '<b>SCHOOL RECORD!</b> ' + name + ' sets the ' + scopeTxt + ' ' + label.toLowerCase()
    + ' record with <b>' + value + '</b>'
    + (prev ? ' (was ' + prev.v + ' by ' + prev.name + (prev.yr ? ' · ' + prev.yr : '') + ')' : '')
    + '.';
}

// Check one scope ('game' | 'season' | 'career'). `getVal(L)` reads the
// value off a line/player. First-ever marks are set silently — only
// broken records announce. `silent` writes the max without announcing
// (used for a book's inaugural season so year one doesn't toast-spam).
function checkScope(book, scope, items, getVal, getName, yr, silent) {
  var breaks = [];
  items.forEach(function(it) {
    STATS.forEach(function(st) {
      var v = getVal(it, st);
      if (!(v > 0)) return;
      var cur = book[scope][st];
      if (!cur) {
        book[scope][st] = { v: v, name: getName(it), yr: yr };
        return;
      }
      if (v > cur.v) {
        if (!silent) {
          var nm = getName(it);
          var b = {
            scope: scope, stat: st, value: v,
            prev: cur.v, prevName: cur.name, prevYr: cur.yr,
            player: nm, yr: yr
          };
          b.text = entryText(scope, st, nm, v, cur);
          b.short = 'Record! ' + nm + ': ' + v + ' ' + STAT_LABELS[st].toLowerCase();
          b.line = '<div class="leader-row"><div class="leader-name">' + STAT_LABELS[st] + ' — ' + scope
            + '<small>' + getName(it) + ' · broke ' + cur.name + '\'s ' + cur.v + '</small></div>'
            + '<div class="leader-val" style="font-size:15px;">' + v + '</div></div>';
          breaks.push(b);
        }
        book[scope][st] = { v: v, name: getName(it), yr: yr };
      }
    });
  });
  return breaks;
}

export function checkGameRecords(tid, lines, wk) {
  var book = bookFor(tid);
  // Year one: the book is empty, so every big night would "break" a record
  // set a week earlier. Until the first season is in the books (season marks
  // exist), single-game marks are written quietly.
  var inaugural = STATS.every(function(st) { return !book.season[st]; });
  var breaks = checkScope(book, 'game', lines,
    function(L, st) { return L[st]; },
    function(L) { return L.p.name; }, G.yr, inaugural);
  breaks.forEach(function(b) { b.wk = (wk === undefined ? G.gi : wk); });
  return breaks;
}

// ── Season honors (same formula as the recap awards) ──────

function seasonHonors() {
  var all = [];
  G.teams.forEach(function(tm) {
    tm.rost.forEach(function(p) {
      var gp = p.s.gp || 0;
      if (gp < 10) return;
      all.push({ p: p, tid: tm.id, per: awardScore(p, tm) });
    });
  });
  all.sort(function(a, b) { return b.per - a.per; });
  return { poy: all[0] || null, aa: pickPositionalTeam(all, function(x) { return x.p.pos; }) };
}

// ── Ambient announcement ──────────────────────────────────

function announce(breaks) {
  breaks.forEach(function(b) {
    if (_hooks.log) _hooks.log('r', (b.wk === undefined ? G.gi : b.wk), b.text);
    seasonBreaks().push(b);
  });
  // One toast per batch, not one per record
  if (!breaks.length || !_hooks.toast) return;
  if (breaks.length === 1) _hooks.toast(breaks[0].short, 'var(--gld2)');
  else _hooks.toast(breaks.length + ' school records broken! See the log.', 'var(--gld2)');
}

// Surface the user's just-finished game. Reads LS._recLines (quick-sim
// path, set from simGame's plines) or diffs LS._recPre (live path).
// Safe to call when neither exists — it's a no-op.
export function surfaceUserGameRecords() {
  var lines = LS._recLines || null;
  if (!lines && LS._recPre) {
    var pre = LS._recPre;
    var side = null;
    if (pre.hid === G.tid && LS.tH && LS.tH.id === G.tid) side = { team: LS.tH, pre: pre.h };
    else if (pre.aid === G.tid && LS.tA && LS.tA.id === G.tid) side = { team: LS.tA, pre: pre.a };
    if (side) lines = diffRoster(side.team, side.pre);
  }
  LS._recLines = null;
  LS._recPre = null;
  if (!lines || !lines.length) return [];
  var breaks = checkGameRecords(G.tid, lines, G.gi);
  announce(breaks);
  return breaks;
}

// ── End of season: season + career records, HOF ───────────
// Call while p.s still holds the finished season (before the
// offseason roster reset). Accumulates career totals on p.c.

export function processSeasonRecords() {
  ensureRecords();
  var t = G.teams[G.tid];
  if (!t) return { seasonBreaks: [], careerBreaks: [], inductees: [] };
  var book = bookFor(G.tid);
  var honors = seasonHonors();
  var aaSet = {};
  honors.aa.forEach(function(a) { aaSet[a.p.name + '|' + a.tid] = true; });
  var poyKey = honors.poy ? honors.poy.p.name + '|' + honors.poy.tid : null;

  var sBreaks = [], cBreaks = [], inductees = [];
  // Inaugural season: write the book's first marks quietly (max across the
  // roster) instead of announcing every intra-roster overtake.
  var seasonSilent = STATS.every(function(st) { return !book.season[st]; });
  var careerSilent = STATS.every(function(st) { return !book.career[st]; });

  t.rost.forEach(function(p) {
    var gp = p.s.gp || 0;
    if (!p.c) p.c = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
    if (gp > 0) {
      p.seasons = (p.seasons || 0) + 1;
      // Single-season records (postseason included — it's all one season)
      sBreaks = sBreaks.concat(checkScope(book, 'season', [p],
        function(pl, st) { return pl.s[st] || 0; },
        function(pl) { return pl.name; }, G.yr, seasonSilent));
      // Accumulate career, then check career records
      STATS.forEach(function(st) { p.c[st] += (p.s[st] || 0); });
      cBreaks = cBreaks.concat(checkScope(book, 'career', [p],
        function(pl, st) { return (pl.c[st] || 0); },
        function(pl) { return pl.name; }, G.yr, careerSilent));
    }

    // Hall of Fame: evaluate departing players
    var ppg = gp > 0 ? p.s.pts / gp : 0;
    var departing = (p.cls === 'SR') || (ppg >= 16 && p.cls !== 'FR');
    if (departing && gp >= 10) {
      var key = p.name + '|' + G.tid;
      var isPOY = (poyKey === key);
      var isAA = !!aaSet[key];
      var cPts = p.c.pts || 0;
      if (isPOY || isAA || cPts >= HOF_PTS) {
        var retired = isPOY || cPts >= RETIRE_PTS || (isAA && cPts >= HOF_PTS);
        var h = {
          name: p.name, pos: p.pos, tid: G.tid, school: t.name,
          yrs: p.seasons || 1, pts: cPts, reb: p.c.reb || 0, ast: p.c.ast || 0,
          honors: [], retired: retired, yr: G.yr
        };
        if (isPOY) h.honors.push('National POY');
        else if (isAA) h.honors.push('All-American');
        if (cPts >= HOF_PTS) h.honors.push('2,000-pt scorer');
        // Guard against double-induction across repeated calls
        var already = G.records.hof.some(function(x) {
          return x.name === h.name && x.tid === h.tid && x.yr === h.yr;
        });
        if (!already) {
          G.records.hof.push(h);
          inductees.push(h);
        }
      }
    }
  });

  announce(sBreaks.concat(cBreaks));

  inductees.forEach(function(h) {
    var txt = '<b>HALL OF FAME:</b> ' + h.name + ' (' + h.pos + ') inducted'
      + (h.honors.length ? ' — ' + h.honors.join(', ') : '')
      + ' (' + h.pts + ' career pts).'
      + (h.retired ? ' <b>Jersey retired.</b>' : '');
    if (_hooks.log) _hooks.log('r', G.gi, txt);
    if (_hooks.toast) _hooks.toast('HOF: ' + h.name + (h.retired ? ' — jersey retired' : ''), 'var(--gld2)');
    seasonBreaks().push({
      scope: 'hof', player: h.name, yr: h.yr, wk: G.gi,
      text: txt, short: 'HOF: ' + h.name,
      line: '<div class="leader-row"><div class="leader-name">Hall of Fame — ' + h.name
        + '<small>' + h.honors.join(' · ') + (h.retired ? ' · Jersey retired' : '') + '</small></div>'
        + '<div class="leader-val" style="font-size:15px;color:var(--gld2);">HOF</div></div>'
    });
  });

  return { seasonBreaks: sBreaks, careerBreaks: cBreaks, inductees: inductees };
}
