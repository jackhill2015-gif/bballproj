// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/schedule.js
//  Schedule view: results table + upcoming games with win prob.
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';

export function renderScheduleView() {
  var team = G.teams[G.tid];
  if (!team || !team.sched || !team.sched.length) {
    return '<div class="card"><div style="padding:20px;text-align:center;color:var(--txt3);">No schedule available yet.</div></div>';
  }
  var sched = team.sched;
  var played = sched.filter(function(g) { return g && g.played === true; });
  var upcoming = sched.filter(function(g) { return g && !g.played && g.opp !== undefined && g.opp !== null; });
  var h = '<div style="display:flex;flex-direction:column;gap:20px;">';

  // Results
  h += '<div class="card">';
  h += '<div class="card-title">Results <span>' + played.length + ' games played</span></div>';
  if (!played.length) {
    h += '<div style="padding:16px;text-align:center;color:var(--txt3);font-style:italic;">Season has not started yet.</div>';
  } else {
    h += '<table><thead><tr><th>Result</th><th>Opponent</th><th style="text-align:right;">Score</th><th style="text-align:right;">Opp NET</th></tr></thead><tbody>';
    played.forEach(function(game) {
      var oppTeam = G.teams[game.opp];
      if (!oppTeam) return;
      var isWin = game.uScore > game.oScore;
      var oppNat = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === oppTeam.id; }) + 1;
      h += '<tr>'
        + '<td><span class="tag ' + (isWin ? 't-w' : 't-l') + '">' + (isWin ? 'W' : 'L') + '</span></td>'
        + '<td>' + (game.home ? '' : ' @ ') + oppTeam.name + (game.conf ? ' <span class="tag t-cf">CONF</span>' : '') + '</td>'
        + '<td style="text-align:right;font-family:monospace;font-weight:700;">' + game.uScore + '\u2013' + game.oScore + '</td>'
        + '<td style="text-align:right;color:var(--txt2);font-family:monospace;">#' + oppNat + '</td>'
        + '</tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div>';

  // Upcoming
  h += '<div class="card">';
  h += '<div class="card-title">Upcoming <span>next ' + Math.min(5, upcoming.length) + '</span></div>';
  if (!upcoming.length) {
    h += '<div style="padding:16px;text-align:center;color:var(--txt3);font-style:italic;">No remaining games this season.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:10px;">';
    upcoming.slice(0, 5).forEach(function(game) {
      var oppTeam = G.teams[game.opp];
      if (!oppTeam) return;
      var ourOvr = getTOvr(team) || 75;
      var theirOvr = getTOvr(oppTeam) || 75;
      var dm = DIFF_MOD[G.difficulty] || 0;
      var wp = clamp(Math.round(50 + (ourOvr + dm - theirOvr) * 1.8 + (game.home ? 8 : -8)), 5, 95);
      var barCol = wp >= 70 ? 'var(--grn)' : wp <= 30 ? 'var(--red)' : 'var(--blu)';
      var oppNat = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === oppTeam.id; }) + 1;
      h += '<div style="padding:12px 14px;background:var(--s2);border-radius:6px;border-left:4px solid ' + barCol + ';">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        + '<div style="font-size:15px;font-weight:800;color:#fff;">' + (game.home ? 'vs ' : ' @ ') + oppTeam.name + '</div>'
        + '<div>' + (game.conf ? '<span class="tag t-cf">CONF</span> ' : '') + ' <span style="font-family:monospace;font-size:12px;color:var(--txt2);">#' + oppNat + ' NET</span></div>'
        + '</div>'
        + '<div style="height:6px;background:var(--bdr2);border-radius:3px;overflow:hidden;margin:6px 0;">'
        + '<div style="height:100%;width:' + wp + '%;background:' + barCol + ';border-radius:3px;transition:width .4s;"></div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt2);">'
        + '<span>' + wp + '% <span style="color:' + barCol + ';font-weight:700;">WIN PROB</span></span>'
        + '<span>' + (game.home ? 'Home' : 'Away') + '</span>'
        + '</div></div>';
    });
    if (upcoming.length > 5) {
      h += '<div style="text-align:center;padding:8px;color:var(--txt3);font-size:11px;font-weight:600;">...and ' + (upcoming.length - 5) + ' more games</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  h += '</div>';
  return h;
}
