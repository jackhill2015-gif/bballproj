// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/history.js
//  Coach career timeline, dynasty history, league champions
// ═══════════════════════════════════════════════════════════

import { ge, fR } from '../utils.js';
import { G } from '../state.js';

export function renderHistory() {
  var el = ge('history-content'); if (!el) return;

  var c = G.coach;
  var totalW = G.history.reduce(function(a, b) { return a + b.wins; }, 0);
  var totalL = G.history.reduce(function(a, b) { return a + b.loss; }, 0);
  var titles = G.history.filter(function(h) { return h.championship; }).length;
  var confTitles = G.history.filter(function(h) { return h.confTitle; }).length;
  var f4s = G.history.filter(function(h) { return h.tourneyFinish === 'F4' || h.championship; }).length;

  var h = '';

  // ── Coach Resume Card ──
  h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:16px;margin-bottom:16px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;">Coach ' + c.firstName + ' ' + c.lastName + '</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">Age ' + c.age + ' \u00b7 Year ' + (G.history.length + 1) + ' \u00b7 Currently at ' + G.teams[G.tid].name + '</div>'
    + '</div>'
    + '<div style="font-family:monospace;font-size:20px;font-weight:900;color:' + (totalW > totalL ? 'var(--grn2)' : '#fc8181') + ';">' + fR(totalW, totalL) + '</div>'
    + '</div>';

  // Stats grid
  h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">';
  var resumeStats = [
    { label: 'SEASONS', val: G.history.length },
    { label: 'TITLES', val: titles, col: titles > 0 ? 'var(--gld2)' : null },
    { label: 'CONF TITLES', val: confTitles, col: confTitles > 0 ? 'var(--blu2)' : null },
    { label: 'FINAL FOURS', val: f4s },
    { label: 'WIN %', val: (totalW + totalL) > 0 ? ((totalW / (totalW + totalL)) * 100).toFixed(0) + '%' : '--' }
  ];
  resumeStats.forEach(function(s) {
    h += '<div style="text-align:center;padding:8px;background:var(--s3);border-radius:4px;">'
      + '<div style="font-family:monospace;font-size:18px;font-weight:900;color:' + (s.col || 'var(--txt)') + ';">' + s.val + '</div>'
      + '<div style="font-size:8px;color:var(--txt3);font-weight:700;letter-spacing:.5px;">' + s.label + '</div></div>';
  });
  h += '</div>';

  // Coaching ratings
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">';
  [{ k: 'off', l: 'OFF' }, { k: 'def', l: 'DEF' }, { k: 'dev', l: 'DEV' }, { k: 'rec', l: 'REC' }].forEach(function(r) {
    var v = c[r.k] || 70;
    h += '<div style="text-align:center;padding:4px;background:var(--s3);border-radius:3px;">'
      + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--red);">' + v + '</div>'
      + '<div style="font-size:8px;color:var(--txt3);font-weight:700;">' + r.l + '</div></div>';
  });
  h += '</div></div>';

  // ── Season-by-Season Timeline ──
  h += '<div style="font-size:16px;font-weight:900;margin-bottom:10px;">Season History</div>';

  if (!G.history.length) {
    h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:20px;text-align:center;color:var(--txt3);">No seasons completed yet. Your story starts now.</div>';
  } else {
    h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;overflow:hidden;">';
    G.history.slice().reverse().forEach(function(yr, idx) {
      var winCol = yr.wins > yr.loss ? 'var(--grn2)' : yr.wins < yr.loss ? '#fc8181' : 'var(--txt)';

      // Badges
      var badges = '';
      if (yr.championship) badges += '<span style="font-size:9px;font-weight:800;color:var(--gld2);background:rgba(214,158,46,.12);padding:2px 7px;border-radius:3px;margin-left:6px;">\ud83c\udfc6 NATIONAL CHAMPION</span>';
      if (yr.confTitle && !yr.championship) badges += '<span style="font-size:9px;font-weight:800;color:#63b3ed;background:rgba(49,130,206,.1);padding:2px 7px;border-radius:3px;margin-left:6px;">CONF CHAMP</span>';
      if (yr.tourneyFinish === 'F4' && !yr.championship) badges += '<span style="font-size:9px;font-weight:800;color:#b794f4;background:rgba(128,90,213,.1);padding:2px 7px;border-radius:3px;margin-left:6px;">FINAL FOUR</span>';
      if (yr.tourneyFinish === 'E8') badges += '<span style="font-size:9px;font-weight:800;color:var(--txt2);background:var(--s3);padding:2px 7px;border-radius:3px;margin-left:6px;">ELITE 8</span>';
      if (yr.tourneyFinish === 'S16') badges += '<span style="font-size:9px;font-weight:800;color:var(--txt3);background:var(--s3);padding:2px 7px;border-radius:3px;margin-left:6px;">SWEET 16</span>';

      // Coach history action for this year
      var coachAction = '';
      if (c.history) {
        var ch = c.history.find(function(e) { return e.yr === yr.year; });
        if (ch) {
          if (ch.action === 'Fired') coachAction = '<span style="font-size:9px;font-weight:800;color:#fc8181;margin-left:6px;">FIRED</span>';
          else if (ch.action === 'Hot Seat') coachAction = '<span style="font-size:9px;font-weight:800;color:#fc8181;margin-left:6px;">HOT SEAT</span>';
          else if (ch.action && ch.action.indexOf('Left for') >= 0) coachAction = '<span style="font-size:9px;font-weight:800;color:var(--gld2);margin-left:6px;">' + ch.action.toUpperCase() + '</span>';
        }
      }

      h += '<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.025);gap:12px;">'
        + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--red);width:40px;flex-shrink:0;">' + yr.year + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="display:flex;align-items:center;flex-wrap:wrap;">'
        + '<span style="font-size:13px;font-weight:700;color:#fff;">' + fR(yr.wins, yr.loss) + '</span>'
        + badges + coachAction
        + '</div>'
        + '<div style="font-size:10px;color:var(--txt3);margin-top:2px;">' + yr.note + '</div>'
        + '</div>'
        + '<div style="font-family:monospace;font-size:12px;font-weight:700;color:' + winCol + ';flex-shrink:0;">' + yr.wins + 'W</div>'
        + '</div>';
    });
    h += '</div>';
  }

  // ── League Champions ──
  if (G.leagueChamps && G.leagueChamps.length) {
    h += '<div style="font-size:16px;font-weight:900;margin:16px 0 10px;">National Champions</div>';
    h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;overflow:hidden;">';
    G.leagueChamps.slice().reverse().forEach(function(ch) {
      var isU = ch.tid === G.tid;
      h += '<div style="display:flex;align-items:center;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.025);gap:12px;">'
        + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--gld2);width:40px;flex-shrink:0;">' + ch.year + '</div>'
        + '<div style="font-size:13px;font-weight:' + (isU ? '800' : '600') + ';color:' + (isU ? 'var(--gld2)' : '#fff') + ';">' + ch.name + '</div>'
        + (isU ? '<span style="font-size:9px;font-weight:800;color:var(--gld2);background:rgba(214,158,46,.1);padding:2px 7px;border-radius:3px;">YOUR DYNASTY</span>' : '')
        + '</div>';
    });
    h += '</div>';
  }

  el.innerHTML = h;
}
