// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/history.js
//  Dynasty history + league champions list.
// ═══════════════════════════════════════════════════════════

import { ge, txt, fR } from '../utils.js';
import { G } from '../state.js';

export function renderHistory() {
  var t = G.teams[G.tid];
  var totalW = G.history.reduce(function(a, b) { return a + b.wins; }, 0);
  var totalL = G.history.reduce(function(a, b) { return a + b.loss; }, 0);
  txt('history-record', fR(totalW, totalL) + ' all-time');
  var list = ge('history-list'); list.innerHTML = '';
  if (!G.history.length) { list.innerHTML = '<div style="color:var(--txt3);padding:12px 0;font-size:12px;">No seasons completed yet.</div>'; return; }
  G.history.slice().reverse().forEach(function(yr) {
    var row = document.createElement('div'); row.className = 'history-row';
    var badge = '';
    if (yr.championship) badge = '<span class="history-badge" style="background:rgba(214,158,46,.15);color:var(--gld2);">\ud83c\udfc6 CHAMPS</span>';
    else if (yr.confTitle) badge = '<span class="history-badge" style="background:rgba(49,130,206,.12);color:#63b3ed;">CONF TITLE</span>';
    else if (yr.tourneyFinish === 'F4') badge = '<span class="history-badge" style="background:rgba(128,90,213,.15);color:#b794f4;">FINAL FOUR</span>';
    row.innerHTML = '<span class="history-yr">' + yr.year + '</span>'
      + '<span class="history-rec">' + fR(yr.wins, yr.loss) + '</span>'
      + '<span class="history-note">' + yr.note + '</span>'
      + (badge ? badge : '');
    list.appendChild(row);
  });
  // League champs
  var lc = ge('history-champs');
  if (!G.leagueChamps || !G.leagueChamps.length) { lc.innerHTML = '<div style="color:var(--txt3);padding:12px 0;font-size:12px;">No champions yet.</div>'; return; }
  lc.innerHTML = G.leagueChamps.slice().reverse().map(function(c) {
    return '<div class="history-row"><span class="history-yr">' + c.year + '</span><span class="history-note" style="font-weight:700;color:' + (c.tid === G.tid ? 'var(--gld2)' : '#fff') + ';">' + c.name + '</span>'
      + (c.tid === G.tid ? '<span class="history-badge" style="background:rgba(214,158,46,.12);color:var(--gld2);">YOUR DYNASTY</span>' : '')
      + '</div>';
  }).join('');
}
