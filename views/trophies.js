// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/trophies.js
//  Trophy room: career totals, season-by-season results, season
//  goals history and achievements.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';
import { ACHIEVEMENTS } from '../goals.js';

function panel(title, body, right) {
  return '<div class="panel"><div class="panel-h"><span>' + title + '</span>' + (right ? '<small>' + right + '</small>' : '') + '</div>'
    + '<div class="panel-b flush">' + body + '</div></div>';
}

var FINISH_ORDER = { 'CHAMP': 7, 'Championship Game': 6, 'Final Four': 5, 'Elite Eight': 4, 'Sweet 16': 3, 'Round of 32': 2, 'Round of 64': 1, 'Opening round': 1 };

export function renderTrophies() {
  var el = ge('trophies-content');
  if (!el) return;
  var hist = (G.history || []).slice().sort(function(a, b) { return b.year - a.year; });
  var c = G.coach || {};
  var titles = hist.filter(function(h) { return h.tourneyFinish === 'CHAMP'; }).length;
  var ff = hist.filter(function(h) { return (FINISH_ORDER[h.tourneyFinish] || 0) >= 5; }).length;
  var apps = hist.filter(function(h) { return (FINISH_ORDER[h.tourneyFinish] || 0) >= 1; }).length;
  var ach = G.achievements || {};
  var nAch = ACHIEVEMENTS.filter(function(a) { return ach[a[0]]; }).length;

  var h = '<div class="dash-sum"><div class="dash-team"><h1>Trophy room</h1>'
    + '<div class="sub">' + (c.firstName ? c.firstName + ' ' + c.lastName + ', ' : '') + 'career ' + (c.careerWins || 0) + '-' + (c.careerLoss || 0) + '</div></div>'
    + '<div class="kv"><div><b>' + titles + '</b><span>National titles</span></div>'
    + '<div><b>' + ff + '</b><span>Final Fours</span></div>'
    + '<div><b>' + apps + '</b><span>NCAA trips</span></div>'
    + '<div><b>' + (c.confTitles || G.confTitles || 0) + '</b><span>Conf. titles</span></div></div></div>';

  h += '<div class="grid-2"><div>';
  // Seasons
  if (hist.length) {
    var t = '<table><thead><tr><th>Year</th><th>School</th><th class="num">Record</th><th class="num">Final rank</th><th>Postseason</th></tr></thead><tbody>';
    hist.forEach(function(s) {
      var post = s.tourneyFinish === 'CHAMP' ? '<b>National champions</b>' : s.tourneyFinish === 'Did Not Qualify' ? '<span style="color:var(--txt3);">No NCAA bid</span>' : (s.tourneyFinish || '');
      if (s.confTitle) post += (post ? ', ' : '') + 'conf. tournament title';
      t += '<tr><td>' + s.year + '</td><td>' + (s.school || '') + '</td><td class="num">' + s.wins + '-' + s.loss + '</td><td class="num">' + (typeof s.poll === 'number' ? (s.poll ? '#' + s.poll : 'NR') : (s.rank ? '#' + s.rank : '')) + '</td><td>' + post + '</td></tr>';
    });
    h += panel('Seasons', t + '</tbody></table>');
  } else {
    h += panel('Seasons', '<div class="empty-state">Finish a season to start your record.</div>');
  }
  // Goals
  var gh = (G.goalHistory || []).slice().reverse();
  if (gh.length) {
    var g = '<table><thead><tr><th>Year</th><th>Goals met</th><th>Details</th></tr></thead><tbody>';
    gh.forEach(function(x) {
      g += '<tr><td>' + x.yr + '</td><td>' + x.met + ' of ' + x.total + '</td><td style="font-size:12px;color:var(--txt2);">'
        + (x.results || []).map(function(r) { return (r.done ? '✓ ' : '✗ ') + r.text; }).join('<br>') + '</td></tr>';
    });
    h += panel('Season goals', g + '</tbody></table>');
  }
  h += '</div><div>';
  // Achievements
  var a = '<table><tbody>';
  ACHIEVEMENTS.forEach(function(x) {
    var u = ach[x[0]];
    a += '<tr><td style="width:22px;color:' + (u ? 'var(--grn2)' : 'var(--bdr2)') + ';">' + (u ? '✓' : '○') + '</td>'
      + '<td style="' + (u ? '' : 'color:var(--txt3);') + '">' + x[1] + '</td>'
      + '<td class="num" style="color:var(--txt3);font-size:12px;">' + (u ? u.yr + (u.school ? ', ' + u.school : '') : '') + '</td></tr>';
  });
  h += panel('Achievements', a + '</tbody></table>', nAch + ' of ' + ACHIEVEMENTS.length);
  h += '</div></div>';
  el.innerHTML = h;
}
