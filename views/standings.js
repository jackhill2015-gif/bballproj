// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/standings.js
//  National Top 25 + all conference standings
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';
import { G } from '../state.js';

export function renderStandings() {
  var el = ge('standings-content'); if (!el) return;

  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var h = '';

  // ── National Top 25 ──
  h += '<div style="margin-bottom:20px;">'
    + '<div style="font-size:18px;font-weight:900;margin-bottom:12px;">National Rankings</div>'
    + '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;overflow:hidden;">'
    + '<div style="display:grid;grid-template-columns:40px 1fr 80px 70px 70px 60px;padding:8px 12px;font-size:9px;font-weight:800;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid var(--bdr);">'
    + '<div>RK</div><div>TEAM</div><div>CONF</div><div>RECORD</div><div>CONF</div><div>WIN%</div></div>';

  natSorted.slice(0, 25).forEach(function(t, i) {
    var isU = t.id === G.tid;
    var total = t.wins + t.loss;
    var winPct = total > 0 ? (t.wins / total * 100).toFixed(0) : '--';
    var rkCol = i < 4 ? 'var(--grn2)' : i < 8 ? 'var(--gld2)' : i < 16 ? 'var(--txt2)' : 'var(--txt3)';

    h += '<div style="display:grid;grid-template-columns:40px 1fr 80px 70px 70px 60px;align-items:center;padding:7px 12px;border-bottom:1px solid rgba(0,0,0,.04);'
      + (isU ? 'background:rgba(0,102,204,.06);border-left:3px solid var(--red);' : 'border-left:3px solid transparent;') + '">'
      + '<div style="font-family:monospace;font-weight:800;color:' + rkCol + ';">' + (i + 1) + '</div>'
      + '<div style="font-weight:' + (isU ? '800' : '600') + ';color:' + (isU ? 'var(--red)' : '#fff') + ';">' + t.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + t.conf + '</div>'
      + '<div style="font-family:monospace;font-size:12px;color:' + (t.wins > t.loss ? 'var(--grn2)' : t.wins < t.loss ? '#dc2626' : 'var(--txt)') + ';">' + t.wins + '-' + t.loss + '</div>'
      + '<div style="font-family:monospace;font-size:11px;color:var(--txt2);">' + t.cWins + '-' + t.cLoss + '</div>'
      + '<div style="font-family:monospace;font-size:11px;color:var(--txt2);">' + winPct + '%</div>'
      + '</div>';
  });

  // Show user's rank if not in top 25
  var userRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  if (userRank > 25) {
    var ut = G.teams[G.tid];
    var utTotal = ut.wins + ut.loss;
    var utPct = utTotal > 0 ? (ut.wins / utTotal * 100).toFixed(0) : '--';
    h += '<div style="display:grid;grid-template-columns:40px 1fr 80px 70px 70px 60px;align-items:center;padding:7px 12px;background:rgba(0,102,204,.06);border-left:3px solid var(--red);border-top:2px dashed var(--bdr);">'
      + '<div style="font-family:monospace;font-weight:800;color:var(--txt3);">' + userRank + '</div>'
      + '<div style="font-weight:800;color:var(--red);">' + ut.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + ut.conf + '</div>'
      + '<div style="font-family:monospace;font-size:12px;color:' + (ut.wins > ut.loss ? 'var(--grn2)' : '#dc2626') + ';">' + ut.wins + '-' + ut.loss + '</div>'
      + '<div style="font-family:monospace;font-size:11px;color:var(--txt2);">' + ut.cWins + '-' + ut.cLoss + '</div>'
      + '<div style="font-family:monospace;font-size:11px;color:var(--txt2);">' + utPct + '%</div>'
      + '</div>';
  }
  h += '</div></div>';

  // ── Conference Standings ──
  var confs = {};
  G.teams.forEach(function(t) { if (!confs[t.conf]) confs[t.conf] = []; confs[t.conf].push(t); });
  var power = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var confNames = Object.keys(confs).sort(function(a, b) {
    var ai = power.indexOf(a), bi = power.indexOf(b);
    if (ai < 0) ai = 99; if (bi < 0) bi = 99;
    return ai - bi || a.localeCompare(b);
  });

  // User's conference first
  var userConf = G.teams[G.tid].conf;
  var sortedConfs = [userConf].concat(confNames.filter(function(c) { return c !== userConf; }));

  h += '<div style="font-size:18px;font-weight:900;margin-bottom:12px;">Conference Standings</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

  sortedConfs.forEach(function(conf) {
    var teams = confs[conf].slice().sort(function(a, b) { return b.cWins - a.cWins || a.cLoss - b.cLoss || b.pts - a.pts; });
    var leaderWins = teams.length ? teams[0].cWins : 0;
    var isUserConf = conf === userConf;

    h += '<div style="background:var(--s2);border:1px solid ' + (isUserConf ? 'var(--red)' : 'var(--bdr)') + ';border-radius:6px;overflow:hidden;">'
      + '<div style="padding:8px 10px;font-size:11px;font-weight:800;color:' + (isUserConf ? 'var(--red)' : 'var(--txt2)') + ';letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">'
      + '<span>' + conf + '</span><span style="color:var(--txt3);">' + teams.length + ' teams</span></div>';

    teams.forEach(function(t, i) {
      var isU = t.id === G.tid;
      var gb = leaderWins - t.cWins;
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 10px;font-size:11px;'
        + (isU ? 'background:rgba(0,102,204,.06);border-left:3px solid var(--red);' : 'border-left:3px solid transparent;') + '">'
        + '<div style="display:flex;align-items:center;gap:6px;">'
        + '<span style="width:16px;font-family:monospace;font-size:10px;color:var(--txt3);">' + (i + 1) + '</span>'
        + '<span style="font-weight:' + (isU ? '800' : '500') + ';color:' + (isU ? '#fff' : 'var(--txt2)') + ';">' + t.name + '</span></div>'
        + '<div style="display:flex;gap:10px;align-items:center;">'
        + '<span style="font-family:monospace;font-size:10px;color:var(--txt2);">' + t.cWins + '-' + t.cLoss + '</span>'
        + '<span style="width:20px;text-align:right;font-family:monospace;font-size:10px;color:var(--txt3);">' + (gb === 0 ? '-' : gb) + '</span>'
        + '</div></div>';
    });
    h += '</div>';
  });
  h += '</div>';

  el.innerHTML = h;
}
