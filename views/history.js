// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/history.js
//  Dynasty almanac: coach resume, season timeline, national
//  champions, program record book, coaching milestones,
//  trophy case. (Fixes the old dead view that rendered into
//  a nonexistent element.)
// ═══════════════════════════════════════════════════════════

import { ge, fR } from '../utils.js';
import { G } from '../state.js';
import { bookFor, ensureRecords, STAT_LABELS } from '../records.js';

function finishBadge(tf) {
  if (tf === 'CHAMP') return '<span class="tag t-cf">National Champion</span>';
  if (tf === 'Runner-Up') return '<span class="tag">Runner-Up</span>';
  if (tf === 'Final Four') return '<span class="tag t-home">Final Four</span>';
  if (tf === 'Elite Eight') return '<span class="tag">Elite 8</span>';
  if (tf === 'Sweet 16') return '<span class="tag">Sweet 16</span>';
  if (tf === 'Round of 32') return '<span style="font-size:11px;color:var(--txt3);">Round of 32</span>';
  if (tf === 'Round of 64') return '<span style="font-size:11px;color:var(--txt3);">Round of 64</span>';
  if (tf === 'Conf Tourney') return '<span class="tag t-cf">Conf Tourney</span>';
  return '';
}

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
  var bestRank = hist.reduce(function(a, b) { return b.rank < a.rank ? b : a; }, hist[0]);
  rows.push({ label: 'Best final rank', val: '#' + bestRank.rank, note: bestRank.year });
  // Longest recorded streak of 20+ win seasons
  var run = 0, bestRun = 0;
  hist.forEach(function(x) { run = x.wins >= 20 ? run + 1 : 0; bestRun = Math.max(bestRun, run); });
  if (bestRun >= 2) rows.push({ label: '20-win seasons in a row', val: bestRun, note: 'program best' });
  return rows;
}

export function renderHistory() {
  var el = ge('history-content');
  if (!el) return;
  var c = G.coach || {};
  var hist = G.history || [];
  var totalW = hist.reduce(function(a, b) { return a + b.wins; }, 0);
  var totalL = hist.reduce(function(a, b) { return a + b.loss; }, 0);
  var titles = hist.filter(function(x) { return x.championship; }).length;
  var confTitles = hist.filter(function(x) { return x.confTitle; }).length;

  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Dynasty Almanac</div>'
    + '<div class="sec-sub">Every season, every title, every milestone — the permanent record.</div></div>';

  // ── Coach resume ──
  h += '<div class="sec-block"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
    + '<div><div style="font-size:19px;font-weight:900;">Coach ' + (c.firstName || '') + ' ' + (c.lastName || '') + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:2px;">Age ' + (c.age || '—') + ' · Level ' + (c.level || 1) + ' · ' + (hist.length + 1) + 'th season · ' + G.teams[G.tid].name + '</div></div>'
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

  // ── Trophy case ──
  var tr = trophies();
  if (tr.length) {
    h += '<div class="sec-block"><div class="card-title">Trophy Case</div>';
    tr.forEach(function(t2) {
      // Bugfix: this was a `+ +` typo that rendered literal NaN in the UI
      h += '<div class="leader-row"><div class="leader-name" style="font-weight:800;">' + t2.name
        + '<small>' + t2.desc + '</small></div></div>';
    });
    h += '</div>';
  }

  // ── Season timeline ──
  h += '<div class="sec-block"><div class="card-title">Season History</div>';
  if (!hist.length) {
    h += '<div style="font-size:13px;color:var(--txt3);">No completed seasons yet. Your story starts now.</div>';
  } else {
    hist.slice().reverse().forEach(function(yr) {
      var ch = (c.history || []).find(function(e) { return e.yr === yr.year; });
      var act = '';
      if (ch && ch.action === 'Fired') act = ' <span class="tag t-rival">Fired</span>';
      else if (ch && ch.action === 'Hot Seat') act = ' <span class="tag t-rival">Hot Seat</span>';
      h += '<div class="leader-row"><div class="leader-rank" style="width:44px;">' + yr.year + '</div>'
        + '<div class="leader-name"><b>' + fR(yr.wins, yr.loss) + '</b> ' + finishBadge(yr.tourneyFinish) + act
        + '<small>#' + yr.rank + ' NET · ' + (yr.note || '') + '</small></div></div>';
    });
  }
  h += '</div>';

  // ── Record book ──
  var rb = recordBook();
  if (rb.length) {
    h += '<div class="sec-block"><div class="card-title">Program Record Book</div>';
    rb.forEach(function(r) {
      h += '<div class="leader-row"><div class="leader-name">' + r.label + '<small>' + r.note + '</small></div>'
        + '<div class="leader-val" style="font-size:15px;">' + r.val + '</div></div>';
    });
    h += '</div>';
  }

  // ── Player record book (single game / season / career) ──
  var pb = bookFor(G.tid);
  h += '<div class="sec-block"><div class="card-title">Player Record Book</div>'
    + '<div style="font-size:12px;color:var(--txt3);margin-bottom:6px;">' + G.teams[G.tid].name + ' all-time marks. First seasons write the history.</div>';
  [['game', 'Single Game'], ['season', 'Single Season'], ['career', 'Career']].forEach(function(sc) {
    h += '<div style="font-size:11px;font-weight:800;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin:10px 0 2px;">' + sc[1] + '</div>';
    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(function(st) {
      var e = pb[sc[0]][st];
      h += '<div class="leader-row"><div class="leader-name">' + STAT_LABELS[st]
        + (e
          ? '<small>' + e.name + ' · ' + e.yr + '</small>'
          : '<small>No record yet</small>')
        + '</div><div class="leader-val" style="font-size:15px;">' + (e ? e.v : '—') + '</div></div>';
    });
  });
  h += '</div>';

  // ── Hall of Fame ──
  var hof = ensureRecords().hof.filter(function(x) { return x.tid === G.tid; });
  hof.sort(function(a, b) { return b.yr - a.yr; });
  h += '<div class="sec-block"><div class="card-title">Hall of Fame</div>';
  if (!hof.length) {
    h += '<div style="font-size:13px;color:var(--txt3);">No legends yet. All-Americans, 2,000-point scorers, and players of the year get inducted when they leave.</div>';
  } else {
    hof.forEach(function(x) {
      var tags = x.honors.map(function(hh) { return '<span class="tag t-home">' + hh + '</span>'; }).join(' ');
      if (x.retired) tags += ' <span class="tag t-cf">Jersey Retired</span>';
      h += '<div class="leader-row"><div class="leader-name" style="font-weight:800;">' + x.name
        + '<small>' + x.pos + ' · ' + x.yrs + (x.yrs === 1 ? ' yr' : ' yrs') + ' · ' + x.yr
        + ' · ' + x.pts + ' pts, ' + x.reb + ' reb, ' + x.ast + ' ast</small></div>'
        + '<div style="text-align:right;max-width:45%;">' + tags + '</div></div>';
    });
  }
  h += '</div>';

  // ── National champions ──
  if (G.leagueChamps && G.leagueChamps.length) {
    h += '<div class="sec-block"><div class="card-title">National Champions</div>';
    G.leagueChamps.slice().reverse().slice(0, 20).forEach(function(ch) {
      var isU = ch.tid === G.tid;
      h += '<div class="leader-row"><div class="leader-rank" style="width:44px;color:var(--gld2);">' + ch.year + '</div>'
        + '<div class="leader-name" style="' + (isU ? 'font-weight:900;color:var(--gld2);' : '') + '">' + ch.name
        + (isU ? ' <span class="tag t-home">Yours</span>' : '') + '</div></div>';
    });
    h += '</div>';
  }

  el.innerHTML = h;
}
