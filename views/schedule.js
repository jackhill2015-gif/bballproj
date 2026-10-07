// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/schedule.js
//  Schedule view: 30 games, OOC + conference sections,
//  rivalry/revenge flags, result badges, win probability.
//  Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { clamp, getTOvr, fmtScore, winProb } from '../utils.js';
import { G } from '../state.js';

// Team name link (same shape as the player pLink convention).
function tLink(tid, name) {
  return '<span class="tname-link" data-action="team" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

function oppRankOf(oppId, natSorted) {
  return natSorted.findIndex(function(x) { return x.id === oppId; }) + 1;
}

function rivalSet() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf && x.id !== G.tid; });
  conf.sort(function(a, b) { return b.pts - a.pts; });
  var s = {};
  conf.slice(0, 2).forEach(function(x) { s[x.id] = true; });
  return s;
}

export function renderScheduleView() {
  var team = G.teams[G.tid];
  if (!team || !team.sched || !team.sched.length) {
    return '<div style="padding:24px;text-align:center;color:var(--txt3);">No schedule available yet.</div>';
  }

  var sched = team.sched;
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rivals = rivalSet();

  var played = sched.filter(function(g) { return g && g.played; });
  var wins = played.filter(function(g) { return g.uScore > g.oScore; }).length;
  var losses = played.length - wins;
  var left = sched.filter(function(g) { return g && !g.played && g.opp !== undefined && g.opp !== null; }).length;

  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<div><div class="sec-head" style="margin:0;">' + team.name + ' schedule</div>'
    + '<div class="sec-sub" style="margin:2px 0 0;">' + team.conf + ' · Season ' + G.yr + '</div></div>'
    + '<div style="display:flex;gap:14px;">'
    + '<div style="text-align:center;"><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--grn2);">' + wins + '</div><div style="font-size:10px;color:var(--txt3);">Wins</div></div>'
    + '<div style="text-align:center;"><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--red);">' + losses + '</div><div style="font-size:10px;color:var(--txt3);">Losses</div></div>'
    + '<div style="text-align:center;"><div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--txt2);">' + left + '</div><div style="font-size:10px;color:var(--txt3);">Left</div></div>'
    + '</div></div>';

  h += '<div class="card-title">Non-conference</div><div class="tbl-wrap" style="margin-bottom:16px;">';
  for (var w = 0; w < 10; w++) h += gameRow(sched[w], w, natSorted, team, rivals);
  h += '</div>';

  h += '<div class="card-title">' + team.conf + ' play</div><div class="tbl-wrap">';
  for (var w2 = 10; w2 < 30; w2++) h += gameRow(sched[w2], w2, natSorted, team, rivals);
  h += '</div>';

  return h;
}

function gameRow(game, week, natSorted, team, rivals) {
  if (!game || game.opp === undefined || game.opp === null) {
    return '<div class="sched-row" style="opacity:.5;"><div class="sched-wk">WK ' + (week + 1) + '</div>'
      + '<div class="sched-opp"><small>Bye</small></div></div>';
  }
  var opp = G.teams[game.opp];
  if (!opp) return '';

  var isPlayed = !!game.played;
  var isWin = isPlayed && game.uScore > game.oScore;
  var isNext = !isPlayed && week === G.gi && G.phase === 'reg';
  var rk = oppRankOf(opp.id, natSorted);
  var rkStr = rk <= 25 ? '#' + rk + ' ' : '';

  var cls = 'sched-row' + (isNext ? ' next' : isPlayed ? (isWin ? ' rw-win' : ' rw-loss') : '');
  // Played games open a detail sheet; the nested team link wins the tap
  // because the delegated handler resolves the innermost [data-action].
  var h = '<div class="' + cls + '"' + (isPlayed ? ' data-action="game" data-week="' + week + '" role="button" tabindex="0"' : '') + '>';
  h += '<div class="sched-wk">WK ' + (week + 1) + '</div>';

  if (isPlayed) {
    h += '<div class="sched-badge"><span class="badge ' + (isWin ? 'w' : 'l') + '">' + (isWin ? 'W' : 'L') + '</span></div>';
  } else if (isNext) {
    h += '<div class="sched-badge"><span class="badge next">Next</span></div>';
  } else {
    h += '<div class="sched-badge"></div>';
  }

  // Dense one-liner: opponent + context on a single line, score right
  var ctx = (game.conf ? 'conf · ' : '') + (rivals[opp.id] && !isPlayed ? 'rivalry · ' : '')
    + opp.wins + '-' + opp.loss + ' · OVR ' + getTOvr(opp);
  h += '<div class="sched-opp-one">' + (game.home ? 'vs' : '@') + ' ' + rkStr + tLink(opp.id, opp.name)
    + '<small>' + ctx + '</small></div>';

  if (isPlayed) {
    h += '<div class="sched-score" style="color:' + (isWin ? 'var(--grn2)' : 'var(--txt2)') + ';">' + (isWin ? 'W ' : 'L ') + fmtScore(game.uScore, game.oScore) + '</div>';
  } else {
    var dm = DIFF_MOD[G.difficulty] || 0;
    var wp = winProb(getTOvr(team), getTOvr(opp), game.home ? 4 : -4, dm);
    var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
    h += '<div class="sched-score" style="color:' + col + ';font-size:12px;">' + wp + '%</div>';
  }
  return h + '</div>';
}
