// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/schedule.js
//  Schedule view: unified game-by-game with sections
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';

export function renderScheduleView() {
  var team = G.teams[G.tid];
  if (!team || !team.sched || !team.sched.length) {
    return '<div style="padding:20px;text-align:center;color:var(--txt3);">No schedule available yet.</div>';
  }

  var sched = team.sched;
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });

  // Summary bar
  var played = sched.filter(function(g) { return g && g.played; });
  var wins = played.filter(function(g) { return g.uScore > g.oScore; }).length;
  var losses = played.length - wins;
  var remaining = sched.filter(function(g) { return g && !g.played && g.opp !== undefined && g.opp !== null; }).length;

  var h = '';

  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900;">' + team.name + ' Schedule</div>'
    + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">' + team.conf + ' \u00b7 Season ' + G.yr + '</div></div>'
    + '<div style="display:flex;gap:12px;align-items:center;">'
    + '<div style="text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--grn2);">' + wins + '</div><div style="font-size:9px;color:var(--txt3);">WINS</div></div>'
    + '<div style="text-align:center;"><div style="font-size:18px;font-weight:900;color:#dc2626;">' + losses + '</div><div style="font-size:9px;color:var(--txt3);">LOSSES</div></div>'
    + '<div style="text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--txt2);">' + remaining + '</div><div style="font-size:9px;color:var(--txt3);">LEFT</div></div>'
    + '</div></div>';

  // Non-Conference Section
  h += '<div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1.5px;text-transform:uppercase;padding:8px 0;border-bottom:2px solid var(--red);margin-bottom:2px;">Non-Conference</div>';

  for (var w = 0; w < 10; w++) {
    h += renderGameRow(sched[w], w, natSorted, team);
  }

  // Conference Section
  h += '<div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1.5px;text-transform:uppercase;padding:8px 0;border-bottom:2px solid var(--red);margin-top:16px;margin-bottom:2px;">' + team.conf + ' Conference Play</div>';

  for (var w2 = 10; w2 < 30; w2++) {
    h += renderGameRow(sched[w2], w2, natSorted, team);
  }

  return h;
}

function renderGameRow(game, week, natSorted, team) {
  if (!game || game.opp === undefined || game.opp === null) {
    // Bye week
    return '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.03);opacity:.5;">'
      + '<div style="width:40px;font-family:monospace;font-size:10px;color:var(--txt3);flex-shrink:0;">WK ' + (week + 1) + '</div>'
      + '<div style="flex:1;font-size:11px;color:var(--txt3);font-style:italic;">BYE</div></div>';
  }

  var opp = G.teams[game.opp];
  if (!opp) return '';

  var isPlayed = game.played;
  var isWin = isPlayed && game.uScore > game.oScore;
  var isLoss = isPlayed && game.uScore < game.oScore;
  var isNext = !isPlayed && week === G.gi && G.phase === 'reg';
  var oppRank = natSorted.findIndex(function(x) { return x.id === opp.id; }) + 1;
  var oppRankStr = oppRank <= 25 ? '#' + oppRank + ' ' : '';

  // Border color
  var borderCol = isWin ? 'var(--grn)' : isLoss ? '#dc2626' : isNext ? 'var(--red)' : 'transparent';

  // Win probability for upcoming
  var wpStr = '';
  if (!isPlayed) {
    var dm = DIFF_MOD[G.difficulty] || 0;
    var wp = clamp(Math.round(50 + (getTOvr(team) + dm - getTOvr(opp)) * 1.3 + (game.home ? 4 : -4)), 5, 95);
    var wpCol = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : '#dc2626';
    wpStr = '<span style="font-family:monospace;font-size:11px;font-weight:700;color:' + wpCol + ';">' + wp + '%</span>';
  }

  var h = '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.03);border-left:3px solid ' + borderCol + ';padding-left:8px;'
    + (isNext ? 'background:rgba(0,102,204,.04);' : '') + '">';

  // Week number
  h += '<div style="width:40px;font-family:monospace;font-size:10px;color:var(--txt3);flex-shrink:0;">WK ' + (week + 1) + '</div>';

  // Result badge (played) or NEXT badge
  if (isPlayed) {
    h += '<div style="width:28px;flex-shrink:0;"><span style="font-size:10px;font-weight:800;color:' + (isWin ? 'var(--grn2)' : '#dc2626') + ';background:' + (isWin ? 'rgba(56,161,105,.1)' : 'rgba(252,129,129,.1)') + ';padding:2px 6px;border-radius:3px;">' + (isWin ? 'W' : 'L') + '</span></div>';
  } else if (isNext) {
    h += '<div style="width:28px;flex-shrink:0;"><span style="font-size:9px;font-weight:800;color:var(--red);background:rgba(0,102,204,.12);padding:2px 5px;border-radius:3px;">NEXT</span></div>';
  } else {
    h += '<div style="width:28px;flex-shrink:0;"></div>';
  }

  // Home/Away indicator
  var homeAway = game.home ? 'vs' : '@';
  h += '<div style="width:20px;font-size:10px;color:var(--txt3);flex-shrink:0;text-align:center;">' + homeAway + '</div>';

  // Opponent name + rank
  h += '<div style="flex:1;min-width:0;padding:0 8px;">'
    + '<span style="font-size:12px;font-weight:' + (isNext ? '800' : '600') + ';color:' + (isNext ? '#fff' : isPlayed ? 'var(--txt)' : 'var(--txt2)') + ';">' + oppRankStr + opp.name + '</span>';
  if (game.conf) {
    h += ' <span style="font-size:8px;font-weight:700;color:var(--red);background:rgba(0,102,204,.08);padding:1px 5px;border-radius:2px;">CONF</span>';
  }
  h += '</div>';

  // Opponent record
  h += '<div style="width:50px;font-family:monospace;font-size:10px;color:var(--txt3);text-align:center;flex-shrink:0;">' + opp.wins + '-' + opp.loss + '</div>';

  // Score (played) or Win Prob (upcoming)
  if (isPlayed) {
    h += '<div style="width:70px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:' + (isWin ? '#fff' : 'var(--txt2)') + ';flex-shrink:0;">' + game.uScore + '\u2013' + game.oScore + '</div>';
  } else {
    h += '<div style="width:70px;text-align:right;flex-shrink:0;">' + wpStr + '</div>';
  }

  // Opponent NET rank
  h += '<div style="width:40px;text-align:right;font-family:monospace;font-size:10px;color:var(--txt3);flex-shrink:0;">#' + oppRank + '</div>';

  h += '</div>';
  return h;
}
