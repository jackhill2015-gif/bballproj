// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/devreport.js
//  Offseason development report: what every returner gained.
//  Reads G.devReport = { yr, school, rows: [{ name, pos,
//  clsFrom, clsTo, redshirt, ovrFrom, ovrTo, pot, delta:
//  { sht, fin, def, reb, ply } }] } (built in season.js each
//  offseason). Rendered at the top of the History screen while
//  G.devReport.yr === G.yr, and on demand via the "Development
//  report" item in the More menu (ui.js 'devreport' action),
//  which opens it in the generic sheet (views/sheet.js).
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { openSheet } from './sheet.js';

var ATTR_LABEL = {
  sht: 'Shooting',
  fin: 'Finishing',
  def: 'Defense',
  reb: 'Rebounding',
  ply: 'Playmaking'
};

function biggestGain(delta) {
  var bk = null, bv = -Infinity;
  Object.keys(delta || {}).forEach(function(k) {
    if (ATTR_LABEL[k] && delta[k] > bv) { bv = delta[k]; bk = k; }
  });
  if (!bk || bv <= 0) return '—';
  return ATTR_LABEL[bk] + ' +' + bv;
}

export function devReportHTML() {
  var r = G.devReport;
  if (!r || !r.rows || !r.rows.length) return '';
  var rows = r.rows.slice().sort(function(a, b) {
    return (b.ovrTo - b.ovrFrom) - (a.ovrTo - a.ovrFrom);
  });
  var h = '<div class="panel"><div class="panel-h"><span>Development report</span>'
    + '<small>' + r.yr + ' · ' + r.school + '</small></div><div class="panel-b flush">'
    + '<div class="sec-sub" style="padding:10px 12px 0;">How last season\'s returners grew over the offseason.</div>'
    + '<div class="tbl-wrap"><table><thead><tr><th>Player</th><th>Class</th>'
    + '<th class="num">OVR</th><th>Biggest gain</th></tr></thead><tbody>';
  rows.forEach(function(x) {
    var gain = x.ovrTo - x.ovrFrom;
    var gainStr = (gain >= 0 ? '+' : '') + gain;
    var gc = gain > 0 ? 'var(--grn2)' : gain < 0 ? 'var(--red)' : 'var(--txt3)';
    h += '<tr><td>' + x.name + ' <span class="pt-sub">' + x.pos + '</span>'
      + (x.redshirt ? ' <span class="tag">Redshirt year</span>' : '') + '</td>'
      + '<td style="white-space:nowrap;">' + x.clsFrom + ' → ' + x.clsTo + '</td>'
      + '<td class="num" style="white-space:nowrap;">' + x.ovrFrom + ' → <b>' + x.ovrTo + '</b> '
      + '<span style="color:' + gc + ';font-weight:700;">(' + gainStr + ')</span></td>'
      + '<td>' + biggestGain(x.delta) + '</td></tr>';
  });
  h += '</tbody></table></div></div></div>';
  return h;
}

export function openDevReport() {
  var h = devReportHTML();
  if (!h) {
    h = '<div class="empty-state">No development report yet. It appears after your first offseason.</div>';
  }
  openSheet(h, 'Development report');
}
