// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/history.js
//  History: one page with three tabs — Seasons (results by
//  year), Coach (career totals and achievements), Records
//  (record book and Hall of Fame). The old Trophy room view
//  was merged here (M1, 2026-10-12).
// ═══════════════════════════════════════════════════════════

import { ge, fR } from '../utils.js';
import { G } from '../state.js';
import { bookFor, ensureRecords, STAT_LABELS } from '../records.js';
import { devReportHTML } from './devreport.js';
import { ACHIEVEMENTS } from '../goals.js';

var _histTab = 'seasons'; // 'seasons' | 'coach' | 'records'

// ── Trophy case: derived from career data ─────────────────
function trophies() {
  var out = [];
  var hist = G.history || [];
  var titles = hist.filter(function(x) { return x.championship; }).length;
  var f4 = hist.filter(function(x) { return x.tourneyFinish === 'Final Four' || x.championship; }).length;
  if (titles > 0) out.push({ ico: '', name: 'National Champion', desc: titles + '× — ' + hist.filter(function(x){return x.championship;}).map(function(x){return x.year;}).join(', ') });
  if (f4 > 0) out.push({ ico: '', name: 'Final Four', desc: f4 + ' appearances' });
  var confT = hist.filter(function(x) { return x.confTitle; }).length;
  if (confT > 0) out.push({ ico: '', name: 'Conference Champion', desc: confT + '×' });
  var best = null;
  hist.forEach(function(x) { if (!best || x.wins > best.wins) best = x; });
  if (best && best.wins >= 25) out.push({ ico: '', name: '25-Win Season', desc: best.wins + '-' + best.loss + ' in ' + best.year });
  if (G.coach.careerWins >= 100) out.push({ ico: '', name: 'Century Club', desc: G.coach.careerWins + ' career wins' });
  if (G.coach.awards && G.coach.awards.length) out.push({ ico: '', name: 'Coach of the Year', desc: G.coach.awards.length + '×' });
  return out;
}

// ── Program record book: bests across recorded seasons ────
function recordBook() {
  var hist = G.history || [];
  if (!hist.length) return [];
  var rows = [];
  var mostWins = hist.reduce(function(a, b) { return b.wins > a.wins ? b : a; }, hist[0]);
  rows.push({ label: 'Most wins, season', val: mostWins.wins + '-' + mostWins.loss, note: mostWins.year });
  var bestPct = hist.reduce(function(a, b) {
    var pa = a.wins / Math.max(1, a.wins + a.loss), pb = b.wins / Math.max(1, b.wins + b.loss);
    return pb > pa ? b : a;
  }, hist[0]);
  rows.push({ label: 'Best win %, season', val: (bestPct.wins / Math.max(1, bestPct.wins + bestPct.loss) * 100).toFixed(1) + '%', note: bestPct.year });
  // Final Top 25 (seasons since the poll); older seasons only have the NET rank
  var polled = hist.filter(function(h) { return h.poll > 0; });
  if (polled.length) {
    var bestPoll = polled.reduce(function(a, b) { return b.poll < a.poll ? b : a; }, polled[0]);
    rows.push({ label: 'Best final Top 25 rank', val: '#' + bestPoll.poll, note: bestPoll.year });
  }
  var bestRank = hist.reduce(function(a, b) { return b.rank < a.rank ? b : a; }, hist[0]);
  rows.push({ label: 'Best final NET rank', val: '#' + bestRank.rank, note: bestRank.year });
  // Longest recorded streak of 20+ win seasons
  var run = 0, bestRun = 0;
  hist.forEach(function(x) { run = x.wins >= 20 ? run + 1 : 0; bestRun = Math.max(bestRun, run); });
  if (bestRun >= 2) rows.push({ label: '20-win seasons in a row', val: bestRun, note: 'program best' });
  return rows;
}

function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

function histTabBtn(id, label) {
  var on = _histTab === id;
  return '<button class="hist-tab' + (on ? ' on' : '') + '" data-histtab="' + id + '" role="tab" aria-selected="' + on + '">' + label + '</button>';
}

// ── Tab: Seasons — results by year, one list ───────────────
function seasonsHTML(hist, c) {
  var h = '<div class="sec-block"><div class="card-title">Seasons</div>';
  if (!hist.length) {
    h += '<div style="font-size:13px;color:var(--txt3);">No completed seasons yet.</div>';
  } else {
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Year</th><th>School</th><th class="num">Record</th><th class="num">Final rank</th><th>Postseason</th></tr></thead><tbody>';
    hist.slice().reverse().forEach(function(s) {
      var post = s.tourneyFinish === 'CHAMP' ? '<b>National champions</b>'
        : s.tourneyFinish === 'Did Not Qualify' ? '<span style="color:var(--txt3);">No NCAA bid</span>' : (s.tourneyFinish || '');
      if (s.confTitle) post += (post ? ', ' : '') + 'conf. tournament title';
      var ch = (c.history || []).find(function(e) { return e.yr === s.year; });
      if (ch && ch.action === 'Fired') post += ' <span class="tag t-rival">Fired</span>';
      else if (ch && ch.action === 'Hot Seat') post += ' <span class="tag t-rival">Hot Seat</span>';
      h += '<tr><td>' + s.year + '</td><td>' + (s.school || '') + '</td>'
        + '<td class="num">' + s.wins + '-' + s.loss + '</td>'
        + '<td class="num">' + (typeof s.poll === 'number' ? (s.poll ? '#' + s.poll : 'NR') : (s.rank ? '#' + s.rank : '')) + '</td>'
        + '<td>' + post + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div>';

  // Season goals history
  var gh = (G.goalHistory || []).slice().reverse();
  if (gh.length) {
    h += '<div class="sec-block"><div class="card-title">Season goals</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Year</th><th>Goals met</th><th>Details</th></tr></thead><tbody>';
    gh.forEach(function(x) {
      h += '<tr><td>' + x.yr + '</td><td>' + x.met + ' of ' + x.total + '</td><td style="font-size:12px;color:var(--txt2);">'
        + (x.results || []).map(function(r) { return (r.done ? '✓ ' : '✗ ') + r.text; }).join('<br>') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }
  return h;
}

// ── Tab: Coach — career totals and achievements ─────────────
function coachHTML(hist, c) {
  var totalW = hist.reduce(function(a, b) { return a + b.wins; }, 0);
  var totalL = hist.reduce(function(a, b) { return a + b.loss; }, 0);
  var titles = hist.filter(function(x) { return x.championship; }).length;
  var confTitles = hist.filter(function(x) { return x.confTitle; }).length;

  var h = '<div class="sec-block"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
    + '<div><div style="font-size:19px;font-weight:900;">Coach ' + (c.firstName || '') + ' ' + (c.lastName || '') + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:2px;">Level ' + (c.level || 1) + ' · ' + ordinal(hist.length + 1) + ' season · ' + G.teams[G.tid].name + '</div></div>'
    + '<div style="font-family:var(--mono);font-size:22px;font-weight:900;color:' + (totalW >= totalL ? 'var(--grn2)' : 'var(--red)') + ';">' + fR(totalW, totalL) + '</div></div>'
    + '<div class="stat-strip" style="grid-template-columns:repeat(5,1fr);">';
  [
    { l: 'Seasons', v: hist.length },
    { l: 'Nat Titles', v: titles },
    { l: 'Conf Titles', v: confTitles },
    { l: 'Career Wins', v: c.careerWins || 0 },
    { l: 'Win %', v: (totalW + totalL) ? Math.round(totalW / (totalW + totalL) * 100) + '%' : '—' }
  ].forEach(function(s) {
    h += '<div class="stat-cell"><div class="sv">' + s.v + '</div><div class="sl">' + s.l + '</div></div>';
  });
  h += '</div></div>';

  // Trophy case
  var tr = trophies();
  if (tr.length) {
    h += '<div class="sec-block"><div class="card-title">Trophy case</div>';
    tr.forEach(function(t2) {
      h += '<div class="leader-row"><div class="leader-name" style="font-weight:800;">' + t2.name
        + '<small>' + t2.desc + '</small></div></div>';
    });
    h += '</div>';
  }

  // Achievements
  var ach = G.achievements || {};
  var nAch = ACHIEVEMENTS.filter(function(a) { return ach[a[0]]; }).length;
  h += '<div class="sec-block"><div class="card-title">Achievements</div>'
    + '<div class="tbl-wrap"><table class="tbl"><tbody>';
  ACHIEVEMENTS.forEach(function(x) {
    var u = ach[x[0]];
    h += '<tr><td style="width:22px;color:' + (u ? 'var(--grn2)' : 'var(--bdr2)') + ';">' + (u ? '✓' : '○') + '</td>'
      + '<td style="' + (u ? '' : 'color:var(--txt3);') + '">' + x[1] + '</td>'
      + '<td class="num" style="color:var(--txt3);font-size:12px;">' + (u ? u.yr + (u.school ? ', ' + u.school : '') : '') + '</td></tr>';
  });
  h += '</tbody></table></div>'
    + '<div style="font-size:11px;color:var(--txt3);margin-top:8px;">' + nAch + ' of ' + ACHIEVEMENTS.length + ' unlocked</div></div>';
  return h;
}

// ── Tab: Records — record book and Hall of Fame ─────────────
function recordsHTML() {
  var h = '';

  // Program record book
  var rb = recordBook();
  if (rb.length) {
    h += '<div class="sec-block"><div class="card-title">Program record book</div>'
      + '<div class="tbl-wrap"><table class="tbl"><tbody>';
    rb.forEach(function(r) {
      h += '<tr><td class="tname">' + r.label + ' <span class="dim">' + r.note + '</span></td>'
        + '<td class="num" style="font-size:14px;font-weight:800;">' + r.val + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }

  // Player record book (single game / season / career)
  var pb = bookFor(G.tid);
  h += '<div class="sec-block"><div class="card-title">Player record book</div>'
    + '<div style="font-size:11px;color:var(--txt3);margin-bottom:8px;">' + G.teams[G.tid].name + ' all-time marks.</div>';
  [['game', 'Single Game'], ['season', 'Single Season'], ['career', 'Career']].forEach(function(sc) {
    h += '<div class="rb-scope">' + sc[1] + '</div><div class="tbl-wrap"><table class="tbl"><tbody>';
    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(function(st) {
      var e = pb[sc[0]][st];
      h += '<tr><td class="tname">' + STAT_LABELS[st]
        + (e ? ' <span class="dim"><span class="pname" data-action="player" data-player-name="' + e.name + '" data-tid="' + G.tid + '" role="button" tabindex="0">' + e.name + '</span> · ' + e.yr + '</span>'
             : ' <span class="dim">No record yet</span>')
        + '</td><td class="num" style="font-size:14px;font-weight:800;">' + (e ? e.v : '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';
  });
  h += '</div>';

  // Hall of Fame
  var hof = ensureRecords().hof.filter(function(x) { return x.tid === G.tid; });
  hof.sort(function(a, b) { return b.yr - a.yr; });
  h += '<div class="sec-block"><div class="card-title">Hall of Fame</div>';
  if (!hof.length) {
    h += '<div style="font-size:13px;color:var(--txt3);">No Hall of Fame players yet.</div>';
  } else {
    hof.forEach(function(x) {
      var tags = x.honors.map(function(hh) { return '<span class="tag t-home">' + hh + '</span>'; }).join(' ');
      if (x.retired) tags += ' <span class="tag t-cf">Jersey Retired</span>';
      h += '<div class="leader-row"><div class="leader-name" style="font-weight:800;"><span class="pname" data-action="player" data-player-name="' + x.name + '" data-tid="' + x.tid + '" role="button" tabindex="0">' + x.name + '</span>'
        + '<small>' + x.pos + ' · ' + x.yrs + (x.yrs === 1 ? ' yr' : ' yrs') + ' · ' + x.yr
        + ' · ' + x.pts + ' pts, ' + x.reb + ' reb, ' + x.ast + ' ast</small></div>'
        + '<div style="text-align:right;max-width:45%;">' + tags + '</div></div>';
    });
  }
  h += '</div>';

  // National champions
  if (G.leagueChamps && G.leagueChamps.length) {
    h += '<div class="sec-block"><div class="card-title">National champions</div>';
    G.leagueChamps.slice().reverse().slice(0, 20).forEach(function(ch) {
      var isU = ch.tid === G.tid;
      h += '<div class="leader-row"><div class="leader-rank" style="width:44px;color:var(--gld2);">' + ch.year + '</div>'
        + '<div class="leader-name" style="' + (isU ? 'font-weight:900;color:var(--gld2);' : '') + '">' + ch.name
        + (isU ? ' <span class="tag t-home">Yours</span>' : '') + '</div></div>';
    });
    h += '</div>';
  }
  return h;
}

export function renderHistory() {
  var el = ge('history-content');
  if (!el) return;
  var c = G.coach || {};
  var hist = G.history || [];

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">History</div></div>';

  // Development report (this offseason's gains, while current)
  if (G.devReport && G.devReport.yr === G.yr) h += devReportHTML();

  h += '<div class="hist-tabs" role="tablist">'
    + histTabBtn('seasons', 'Seasons')
    + histTabBtn('coach', 'Coach')
    + histTabBtn('records', 'Records')
    + '</div>';

  if (_histTab === 'coach') h += coachHTML(hist, c);
  else if (_histTab === 'records') h += recordsHTML();
  else h += seasonsHTML(hist, c);

  el.innerHTML = h;
  el.onclick = function(e) {
    var t = e.target.closest && e.target.closest('[data-histtab]');
    if (!t) return;
    _histTab = t.getAttribute('data-histtab');
    renderHistory();
  };
}
