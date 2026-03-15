// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/dashboard.js
//  Main dashboard view: stats banner, last game, next matchup,
//  phase-specific action cards.
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { ge, clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';

// ── Stats Banner (6-column resume grid) ──────────────────
export function renderStatsBanner() {
  var t = G.teams[G.tid];

  // NET rank
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var netRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;

  // Conf rank
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  confTeams.sort(function(a, b) { return b.cWins - a.cWins || b.pts - a.pts; });
  var confRank = confTeams.findIndex(function(x) { return x.id === G.tid; }) + 1;

  // Last 5 from sched
  var played = t.sched.filter(function(s) { return s && s.played; });
  var last5 = played.slice(-5);
  var streakHtml = '<div style="display:flex;gap:4px;justify-content:center;margin-top:4px;">';
  for (var i = 0; i < 5; i++) {
    var s = last5[i];
    var col = s ? (s.uScore > s.oScore ? 'var(--grn)' : 'var(--red)') : 'var(--bdr2)';
    streakHtml += '<div style="width:8px;height:8px;border-radius:50%;background:' + col + ';"></div>';
  }
  streakHtml += '</div>';

  // Proj seed + bubble status
  var seed = netRank <= 64 ? netRank : 65;
  var status, statusCol;
  if (seed <= 9) { status = 'LOCK'; statusCol = 'var(--grn2)'; }
  else if (seed <= 12) { status = 'BUBBLE'; statusCol = 'var(--gld2)'; }
  else if (seed <= 64) { status = 'IN'; statusCol = 'var(--txt2)'; }
  else { status = 'OUT'; statusCol = 'var(--txt3)'; }

  var stats = [
    { label: 'Overall', val: fR(t.wins, t.loss) },
    { label: t.conf, val: fR(t.cWins, t.cLoss) },
    { label: 'NET Rank', val: '#' + netRank },
    { label: 'Conf Rank', val: '#' + confRank + '/' + confTeams.length },
    { label: 'Last 5', val: streakHtml },
    { label: 'Proj Seed', val: (seed <= 64 ? '#' + seed : 'NQ') + ' <span style="font-size:9px;font-weight:900;color:' + statusCol + ';">' + status + '</span>' }
  ];

  var h = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px;">';
  for (var j = 0; j < stats.length; j++) {
    h += '<div style="padding:10px 6px;text-align:center;background:var(--s2);border:1px solid var(--bdr);border-radius:6px;">'
      + '<div style="font-size:9px;color:var(--txt3);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">' + stats[j].label + '</div>'
      + '<div style="font-family:monospace;font-size:14px;font-weight:700;color:var(--txt);">' + stats[j].val + '</div>'
      + '</div>';
  }
  h += '</div>';
  return h;
}

// ── Dashboard View ───────────────────────────────────────
export function renderDashboard() {
  var el = ge('dash-content');
  if (!el) return;
  if (!G.teams || !G.teams.length) {
    el.innerHTML = '<div style="padding:40px;color:var(--txt3);text-align:center;">Loading...</div>';
    return;
  }
  var t = G.teams[G.tid];
  if (!t) {
    el.innerHTML = '<div style="padding:40px;color:var(--txt3);text-align:center;">No team selected.</div>';
    return;
  }
  var h = '';

  // Ranks
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  var confRank = confTeams.slice().sort(function(a, b) { return b.cWins - a.cWins; }).findIndex(function(x) { return x.id === G.tid; }) + 1;
  var seed = rank <= 64 ? '#' + rank : 'Bubble';
  var seedCol = rank <= 4 ? 'var(--grn2)' : rank <= 16 ? 'var(--gld2)' : rank <= 64 ? 'var(--txt)' : 'var(--txt3)';

  // Stats banner
  h += renderStatsBanner();

  // Last game
  var played = t.sched.filter(function(s) { return s && s.played; });
  var lastGame = played.length ? played[played.length - 1] : null;
  if (lastGame) {
    var lg_opp = G.teams[lastGame.opp];
    var lg_w = lastGame.uScore > lastGame.oScore;
    var last5 = played.slice(-5);
    h += '<div class="last-game">'
      + '<div class="last-game-result" style="color:' + (lg_w ? 'var(--grn2)' : '#fc8181') + '">' + (lg_w ? 'W' : 'L') + '</div>'
      + '<div style="flex:1"><div style="font-weight:600;">' + (lg_opp ? lg_opp.name : 'Unknown') + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);">' + lastGame.uScore + '\u2013' + lastGame.oScore + '</div></div>'
      + '<div class="streak-dots">'
      + last5.map(function(s) {
          var w = s.uScore > s.oScore;
          return '<div class="streak-dot" style="background:' + (w ? 'var(--grn)' : 'var(--red)') + '"></div>';
        }).join('')
      + '</div></div>';
  }

  // Next game / phase action
  if (G.phase === 'reg' && G.gi < 30) {
    var ng = t.sched[G.gi];
    var no = ng && ng.opp !== undefined ? G.teams[ng.opp] : null;
    if (ng && no) {
      var dm = DIFF_MOD[G.difficulty] || 0;
      var wp = clamp(50 + ((getTOvr(t) + dm) - (getTOvr(no) + (ng.home ? 0 : 3.5))) * 1.3, 5, 95);
      var wpc = wp >= 50 ? 'var(--grn)' : 'var(--red)';
      h += '<div class="matchup-card">'
        + '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">GAME ' + (G.gi + 1) + ' OF 30</div>'
        + '<div class="matchup-opp">' + no.name + '</div>'
        + '<div class="matchup-meta">'
        + '<span class="tag ' + (ng.home ? 't-home' : 't-away') + '">' + (ng.home ? 'HOME' : 'AWAY') + '</span>'
        + '<span class="tag ' + (ng.conf ? 't-cf' : 't-nc') + '">' + (ng.conf ? 'CONF' : 'NC') + '</span>'
        + '<span style="color:var(--txt2);">OVR ' + getTOvr(no) + '</span>'
        + '</div>'
        + '<div class="prob-row"><span>Win Probability</span><span style="color:' + wpc + ';font-weight:700;">' + Math.round(wp) + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + Math.round(wp) + '%;background:' + wpc + ';"></div></div>'
        + '<div class="action-btns">'
        + '<div class="btn btn-red btn-full" onclick="launchSim(false)">\u26a1 QUICK SIM</div>'
        + '<div class="btn btn-ghost btn-full" onclick="launchSim(true)">\u25b6 LIVE SIM</div>'
        + '</div></div>';
    } else if (!ng || ng === null) {
      h += '<div class="matchup-card">'
        + '<div style="font-size:12px;color:var(--txt3);margin-bottom:10px;">Schedule not built yet.</div>'
        + '</div>';
    }
  } else if (G.phase === 'reg' && G.gi >= 30) {
    h += '<div class="matchup-card">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Regular Season Complete</div>'
      + '<div class="btn btn-red btn-full" onclick="startConfTourney()">BEGIN CONFERENCE TOURNAMENT</div>'
      + '</div>';
  } else if (G.phase === 'conf_tourn') {
    h += '<div class="matchup-card">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Conference Tournament</div>'
      + '<div class="btn btn-red btn-full" onclick="simConfRoundAll()">SIM NEXT ROUND</div>'
      + '</div>';
  } else if (G.phase === 'ncaa') {
    var active = G.bracket ? G.bracket.filter(function(b) { return b.active; }).length : 0;
    var rn = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16', 8: 'Elite Eight', 4: 'Final Four', 2: 'Championship' };
    h += '<div class="matchup-card">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">NCAA Tournament \u2014 ' + (rn[active] || '') + '</div>'
      + '<div class="btn btn-red btn-full" onclick="simNCAAround()">SIM NEXT ROUND</div>'
      + '</div>';
  }

  el.innerHTML = h;
}
