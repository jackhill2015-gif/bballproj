// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  National Top 25 + conference standings.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;
  el.innerHTML = '';

  // National Top 25
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var natCard = document.createElement('div');
  natCard.className = 'card';
  natCard.style.cssText = 'grid-column:1/-1;';
  var natTitle = document.createElement('div');
  natTitle.className = 'card-title';
  natTitle.innerHTML = 'National Rankings <span>Top 25</span>';
  natCard.appendChild(natTitle);

  var natTable = document.createElement('table');
  natTable.innerHTML = '<thead><tr><th>RK</th><th>Team</th><th>Conf</th><th>W-L</th><th>Conf W-L</th></tr></thead>';
  var natBody = document.createElement('tbody');
  natSorted.slice(0, 25).forEach(function(t, i) {
    var isU = t.id === G.tid;
    var tr = document.createElement('tr');
    if (isU) tr.className = 'hl';
    tr.innerHTML = '<td style="font-family:monospace;color:' + (i < 4 ? 'var(--grn2)' : i < 8 ? 'var(--gld2)' : 'var(--txt3)') + '">' + (i + 1) + '</td>'
      + '<td style="font-weight:600;color:' + (isU ? 'var(--red)' : '#fff') + '">' + (isU ? '&bull; ' : '') + t.name + '</td>'
      + '<td style="color:var(--txt3);font-size:11px;">' + t.conf + '</td>'
      + '<td style="font-family:monospace;color:' + (t.wins > t.loss ? 'var(--grn2)' : 'var(--txt)') + '">' + t.wins + '-' + t.loss + '</td>'
      + '<td style="font-family:monospace;color:var(--txt2)">' + t.cWins + '-' + t.cLoss + '</td>';
    natBody.appendChild(tr);
  });
  natTable.appendChild(natBody);
  natCard.appendChild(natTable);
  el.appendChild(natCard);

  // Conference Standings
  var confs = {};
  G.teams.forEach(function(t) { if (!confs[t.conf]) confs[t.conf] = []; confs[t.conf].push(t); });
  var power = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var confNames = Object.keys(confs).sort(function(a, b) {
    var ai = power.indexOf(a), bi = power.indexOf(b);
    if (ai < 0) ai = 99; if (bi < 0) bi = 99;
    return ai - bi || a.localeCompare(b);
  });
  confNames.forEach(function(conf) {
    var teams = confs[conf].slice().sort(function(a, b) { return b.cWins - a.cWins || a.cLoss - b.cLoss; });
    var card = document.createElement('div'); card.className = 'card';
    var title = document.createElement('div'); title.className = 'card-title'; title.textContent = conf;
    card.appendChild(title);
    var table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Team</th><th>W</th><th>L</th><th>Conf</th></tr></thead>';
    var body = document.createElement('tbody');
    teams.forEach(function(t) {
      var isU = t.id === G.tid;
      var tr = document.createElement('tr'); if (isU) tr.className = 'hl';
      tr.innerHTML = '<td style="font-weight:600;color:' + (isU ? 'var(--red)' : '#fff') + '">' + t.name + '</td>'
        + '<td style="font-family:monospace;">' + t.wins + '</td>'
        + '<td style="font-family:monospace;color:var(--txt3)">' + t.loss + '</td>'
        + '<td style="font-family:monospace;color:var(--txt2)">' + t.cWins + '-' + t.cLoss + '</td>';
      body.appendChild(tr);
    });
    table.appendChild(body); card.appendChild(table); el.appendChild(card);
  });
}
