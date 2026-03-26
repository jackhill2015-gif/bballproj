// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/dashboard.js
//  Full dashboard: ticker, standings, leaders, coach, game card
// ═══════════════════════════════════════════════════════════

import { DIFF_MOD } from '../constants.js';
import { ge, clamp, getTOvr, fR } from '../utils.js';
import { G } from '../state.js';
import { getUserConfMatchup, getUserNCAAmatchup, getConfRoundName, getNCAAroundName } from '../tournament.js';

// ── Stats Banner (compact 6-column) ──
export function renderStatsBanner() {
  var t = G.teams[G.tid];
  var natSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var netRank = natSorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  confTeams.sort(function(a, b) { return b.cWins - a.cWins || b.pts - a.pts; });
  var confRank = confTeams.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var played = t.sched.filter(function(s) { return s && s.played; });
  var last5 = played.slice(-5);
  var streakHtml = '<div style="display:flex;gap:4px;justify-content:center;margin-top:4px;">';
  for (var i = 0; i < 5; i++) {
    var s = last5[i];
    var col = s ? (s.uScore > s.oScore ? 'var(--grn)' : '#dc2626') : 'var(--bdr2)';
    streakHtml += '<div style="width:8px;height:8px;border-radius:50%;background:' + col + ';"></div>';
  }
  streakHtml += '</div>';
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
  var h = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">';
  for (var j = 0; j < stats.length; j++) {
    h += '<div style="padding:8px 4px;text-align:center;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;">'
      + '<div style="font-size:9px;color:var(--txt3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">' + stats[j].label + '</div>'
      + '<div style="font-family:monospace;font-size:13px;font-weight:700;color:var(--txt);">' + stats[j].val + '</div></div>';
  }
  h += '</div>';
  return h;
}

// ── Score Ticker (horizontal scrolling recent games) ──
function renderTicker() {
  var t = G.teams[G.tid];
  var played = t.sched.filter(function(s) { return s && s.played; });
  if (!played.length) return '';
  var last10 = played.slice(-10);
  var h = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;scrollbar-width:none;">';
  last10.forEach(function(g) {
    var opp = G.teams[g.opp];
    var w = g.uScore > g.oScore;
    var oppName = opp ? opp.name : '???';
    h += '<div style="flex-shrink:0;padding:6px 10px;background:' + (w ? 'rgba(56,161,105,.08)' : 'rgba(252,129,129,.08)') + ';border:1px solid ' + (w ? 'rgba(56,161,105,.2)' : 'rgba(252,129,129,.2)') + ';border-radius:5px;min-width:100px;">'
      + '<div style="font-size:9px;font-weight:800;color:' + (w ? 'var(--grn2)' : '#dc2626') + ';margin-bottom:2px;">' + (w ? 'W' : 'L') + '</div>'
      + '<div style="font-size:11px;font-weight:600;color:var(--txt);white-space:nowrap;">' + oppName + '</div>'
      + '<div style="font-size:10px;color:var(--txt2);font-family:monospace;">' + g.uScore + '-' + g.oScore + '</div></div>';
  });
  h += '</div>';
  return h;
}

// ── Mini Conference Standings ──
function renderMiniStandings() {
  var t = G.teams[G.tid];
  var conf = G.teams.filter(function(x) { return x.conf === t.conf; });
  conf.sort(function(a, b) { return b.cWins - a.cWins || b.pts - a.pts; });
  var leaderWins = conf.length ? conf[0].cWins : 0;

  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;overflow:hidden;">'
    + '<div style="padding:8px 10px;font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">'
    + '<span>' + t.conf + '</span><span>GB</span></div>';
  conf.forEach(function(tm, i) {
    var isU = tm.id === G.tid;
    var gb = leaderWins - tm.cWins;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 10px;font-size:11px;'
      + (isU ? 'background:rgba(0,102,204,.08);border-left:3px solid var(--red);' : 'border-left:3px solid transparent;') + '">'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="width:16px;font-family:monospace;font-size:10px;color:var(--txt3);">' + (i + 1) + '</span>'
      + '<span style="font-weight:' + (isU ? '800' : '500') + ';color:' + (isU ? 'var(--txt)' : 'var(--txt2)') + ';">' + tm.name + '</span></div>'
      + '<div style="display:flex;gap:10px;align-items:center;">'
      + '<span style="font-family:monospace;font-size:10px;color:var(--txt3);">' + tm.cWins + '-' + tm.cLoss + '</span>'
      + '<span style="width:24px;text-align:right;font-family:monospace;font-size:10px;color:var(--txt3);">' + (gb === 0 ? '-' : gb) + '</span>'
      + '</div></div>';
  });
  h += '</div>';
  return h;
}

// ── Team Leaders ──
function renderTeamLeaders() {
  var t = G.teams[G.tid];
  var leaders = { pts: null, reb: null, ast: null };
  t.rost.forEach(function(p) {
    var gp = p.s.gp || 0; if (gp < 1) return;
    var ppg = p.s.pts / gp, rpg = p.s.reb / gp, apg = p.s.ast / gp;
    if (!leaders.pts || ppg > leaders.pts.val) leaders.pts = { name: p.name, pos: p.pos, cls: p.cls, val: ppg };
    if (!leaders.reb || rpg > leaders.reb.val) leaders.reb = { name: p.name, pos: p.pos, cls: p.cls, val: rpg };
    if (!leaders.ast || apg > leaders.ast.val) leaders.ast = { name: p.name, pos: p.pos, cls: p.cls, val: apg };
  });

  var h = '<div style="background:var(--s1);border:1px solid var(--g200);border-radius:var(--radius);padding:14px;box-shadow:var(--shadow-sm);">'
    + '<div style="font-size:10px;font-weight:700;color:var(--g500);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--g100);">Team Leaders</div>';
  [{ key: 'pts', label: 'PPG' }, { key: 'reb', label: 'RPG' }, { key: 'ast', label: 'APG' }].forEach(function(cat) {
    var l = leaders[cat.key];
    h += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;' + (cat.key !== 'ast' ? 'border-bottom:1px solid var(--g100);' : '') + '">'
      + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:var(--g900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (l ? l.name : '--') + '</div>'
      + '<div style="font-size:10px;color:var(--g400);">' + (l ? l.pos + ' \u00b7 ' + l.cls : '') + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0;"><div style="font-family:var(--mono);font-size:22px;font-weight:900;color:var(--g900);line-height:1;">' + (l ? l.val.toFixed(1) : '--') + '</div>'
      + '<div style="font-size:9px;color:var(--g400);font-weight:700;letter-spacing:.5px;">' + cat.label + '</div></div></div>';
  });
  h += '</div>';
  return h;
}

// ── Team Stats ──
function renderTeamStats() {
  var t = G.teams[G.tid];
  var gp = t.ts.games || 1;
  var ppg = (t.ts.pts / gp).toFixed(1);
  var oppg = (t.ts.opp / gp).toFixed(1);

  // League ranks
  var allByPts = G.teams.slice().sort(function(a, b) { return (b.ts.pts / (b.ts.games || 1)) - (a.ts.pts / (a.ts.games || 1)); });
  var ptsRank = allByPts.findIndex(function(x) { return x.id === G.tid; }) + 1;
  var allByDef = G.teams.slice().sort(function(a, b) { return (a.ts.opp / (a.ts.games || 1)) - (b.ts.opp / (b.ts.games || 1)); });
  var defRank = allByDef.findIndex(function(x) { return x.id === G.tid; }) + 1;

  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Team Stats</div>'
    + '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;">'
    + '<span style="color:var(--txt2);">Points</span><span style="font-family:monospace;font-weight:700;color:var(--txt);">' + ppg + ' <span style="font-size:9px;color:var(--txt3);">(' + ptsRank + getSuffix(ptsRank) + ')</span></span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;">'
    + '<span style="color:var(--txt2);">Allowed</span><span style="font-family:monospace;font-weight:700;color:var(--txt);">' + oppg + ' <span style="font-size:9px;color:var(--txt3);">(' + defRank + getSuffix(defRank) + ')</span></span></div>'
    + '</div>';
  return h;
}

function getSuffix(n) { if (n % 10 === 1 && n !== 11) return 'st'; if (n % 10 === 2 && n !== 12) return 'nd'; if (n % 10 === 3 && n !== 13) return 'rd'; return 'th'; }

// ── Coach Profile Card ──
function renderCoachCard() {
  var c = G.coach;
  if (!c || !c.firstName) return '';
  var hotSeatBadge = c.hotSeat ? ' <span style="font-size:9px;font-weight:800;color:#dc2626;background:rgba(252,129,129,.12);padding:1px 6px;border-radius:2px;">HOT SEAT</span>' : '';

  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Coach Profile</div>'
    + '<div style="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:4px;">' + c.firstName + ' ' + c.lastName + hotSeatBadge + '</div>'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:8px;">Age ' + c.age + ' \u00b7 Year ' + (c.tenure + 1) + ' \u00b7 Career ' + c.careerWins + '-' + c.careerLoss + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;">';
  [{ k: 'off', l: 'OFF' }, { k: 'def', l: 'DEF' }, { k: 'dev', l: 'DEV' }, { k: 'rec', l: 'REC' }].forEach(function(r) {
    var v = c[r.k] || 70;
    h += '<div style="text-align:center;padding:4px;background:var(--s3);border-radius:3px;">'
      + '<div style="font-family:monospace;font-size:14px;font-weight:900;color:var(--red);">' + v + '</div>'
      + '<div style="font-size:8px;color:var(--txt3);font-weight:700;">' + r.l + '</div></div>';
  });
  h += '</div></div>';
  return h;
}

// ── Expectations Bar ──
function renderExpectations() {
  var exp = G.expectations;
  if (!exp) return '';
  var t = G.teams[G.tid];
  var wins = t.wins;
  var pct = Math.min(100, Math.round((wins / Math.max(1, exp.high)) * 100));
  var dangerPct = Math.round((exp.danger / Math.max(1, exp.high)) * 100);
  var lowPct = Math.round((exp.low / Math.max(1, exp.high)) * 100);
  var col = wins >= exp.low ? 'var(--grn)' : wins >= exp.danger ? 'var(--gld)' : '#dc2626';

  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Season Expectations</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">'
    + '<span style="color:var(--txt2);">Target: ' + exp.low + '-' + exp.high + ' wins</span>'
    + '<span style="font-weight:700;color:' + col + ';">' + wins + ' W</span></div>'
    + '<div style="height:6px;background:var(--s3);border-radius:3px;overflow:hidden;position:relative;">'
    + '<div style="position:absolute;left:' + dangerPct + '%;top:0;bottom:0;width:1px;background:#dc2626;opacity:.5;"></div>'
    + '<div style="position:absolute;left:' + lowPct + '%;top:0;bottom:0;width:1px;background:var(--gld);opacity:.5;"></div>'
    + '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:3px;transition:width .3s;"></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--txt3);margin-top:3px;">'
    + '<span>Danger: ' + exp.danger + '</span><span>Target: ' + exp.low + '</span><span>Goal: ' + exp.high + '</span></div>'
    + '</div>';
  return h;
}

// ── Headlines / Inbox ──
function renderHeadlines() {
  // Pull recent log entries as headlines
  var headlines = (G.logs || []).slice(0, 6);
  var h = '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:6px;padding:10px;">'
    + '<div style="font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Headlines</div>';
  if (headlines.length) {
    headlines.forEach(function(log) {
      var typeCol = log.type === 'w' ? 'var(--grn)' : log.type === 'l' ? '#dc2626' : 'var(--red)';
      var badge = log.type === 'w' ? 'WIN' : log.type === 'l' ? 'LOSS' : 'NEWS';
      h += '<div style="padding:5px 0;border-bottom:1px solid rgba(0,0,0,.03);font-size:11px;display:flex;gap:6px;align-items:flex-start;">'
        + '<span style="font-size:8px;font-weight:800;color:' + typeCol + ';background:' + typeCol.replace(')', ',.1)').replace('var(', 'rgba(').replace('#dc2626', 'rgba(252,129,129,.1)') + ';padding:1px 5px;border-radius:2px;flex-shrink:0;margin-top:1px;">' + badge + '</span>'
        + '<span style="color:var(--txt2);">' + log.text + '</span></div>';
    });
  } else {
    h += '<div style="font-size:11px;color:var(--txt3);">No headlines yet.</div>';
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  GAME CARD (matchup for next game / tournament)
// ═══════════════════════════════════════════════════════════

function renderGameCard() {
  var t = G.teams[G.tid];
  var h = '';

  if (G.phase === 'reg' && G.gi < 30) {
    var ng = t.sched[G.gi];
    var no = ng && ng.opp !== undefined ? G.teams[ng.opp] : null;
    if (ng && no) {
      var dm = DIFF_MOD[G.difficulty] || 0;
      var wp = clamp(50 + ((getTOvr(t) + dm) - (getTOvr(no) + (ng.home ? 0 : 3.5))) * 1.3, 5, 95);
      var wpc = wp >= 50 ? 'var(--grn)' : '#dc2626';
      var noRank = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(x) { return x.id === no.id; }) + 1;
      var noRankStr = noRank <= 25 ? '<span style="font-size:10px;color:var(--gld2);">#' + noRank + ' </span>' : '';
      h += '<div class="matchup-card">'
        + '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">GAME ' + (G.gi + 1) + ' OF 30</div>'
        + '<div class="matchup-opp">' + noRankStr + no.name + '</div>'
        + '<div class="matchup-meta">'
        + '<span class="tag ' + (ng.home ? 't-home' : 't-away') + '">' + (ng.home ? 'HOME' : 'AWAY') + '</span>'
        + '<span class="tag ' + (ng.conf ? 't-cf' : 't-nc') + '">' + (ng.conf ? 'CONF' : 'NC') + '</span>'
        + '<span style="color:var(--txt2);">OVR ' + getTOvr(no) + ' \u00b7 ' + no.wins + '-' + no.loss + '</span>'
        + '</div>'
        + '<div class="prob-row"><span>Win Probability</span><span style="color:' + wpc + ';font-weight:700;">' + Math.round(wp) + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + Math.round(wp) + '%;background:' + wpc + ';"></div></div>'
        + '<div class="action-btns">'
        + '<div class="btn btn-red btn-full" onclick="launchSim(false)">\u26a1 QUICK SIM</div>'
        + '<div class="btn btn-ghost btn-full" onclick="launchSim(true)">\u25b6 LIVE SIM</div>'
        + '</div></div>';
    } else if (!ng) {
      h += '<div class="matchup-card"><div style="font-size:12px;color:var(--txt3);">BYE WEEK</div></div>';
    }
  } else if (G.phase === 'reg' && G.gi >= 30) {
    h += '<div class="matchup-card">'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Regular Season Complete</div>'
      + '<div class="btn btn-red btn-full" onclick="startConfTourney()">BEGIN CONFERENCE TOURNAMENT</div></div>';
  } else if (G.phase === 'conf_tourn') {
    var confMatch = getUserConfMatchup();
    if (confMatch) {
      var cm = confMatch.matchup;
      var userIsT1 = cm.t1.id === G.tid;
      var confOpp = userIsT1 ? cm.t2 : cm.t1;
      var confOppSeed = confMatch.ct.seeds ? confMatch.ct.seeds.findIndex(function(x) { return x.id === confOpp.id; }) + 1 : '?';
      var userSeed = confMatch.ct.seeds ? confMatch.ct.seeds.findIndex(function(x) { return x.id === G.tid; }) + 1 : '?';
      var roundName = getConfRoundName(confMatch.ct, confMatch.conf);
      var dm2 = DIFF_MOD[G.difficulty] || 0;
      var cwp = clamp(50 + ((getTOvr(t) + dm2) - getTOvr(confOpp)) * 1.3, 5, 95);
      var cwpc = cwp >= 50 ? 'var(--grn)' : '#dc2626';
      h += '<div class="matchup-card" style="border-left-color:var(--blu);">'
        + '<div style="font-size:10px;font-weight:700;color:var(--blu);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">' + roundName + '</div>'
        + '<div class="matchup-opp">#' + confOppSeed + ' ' + confOpp.name + '</div>'
        + '<div class="matchup-meta">'
        + '<span class="tag t-cf">CONF TOURNEY</span>'
        + '<span style="color:var(--txt2);">You: #' + userSeed + ' \u00b7 OVR ' + getTOvr(confOpp) + ' \u00b7 ' + confOpp.wins + '-' + confOpp.loss + '</span>'
        + '</div>'
        + '<div class="prob-row"><span>Win Probability</span><span style="color:' + cwpc + ';font-weight:700;">' + Math.round(cwp) + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + Math.round(cwp) + '%;background:' + cwpc + ';"></div></div>'
        + '<div class="action-btns">'
        + '<div class="btn btn-red btn-full" onclick="doPlay(\'quick\')">\u26a1 QUICK SIM</div>'
        + '<div class="btn btn-ghost btn-full" onclick="doPlay(\'live\')">\u25b6 LIVE SIM</div>'
        + '</div></div>';
    } else {
      h += '<div class="matchup-card">'
        + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Conference Tournament</div>'
        + '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">Your tournament run is over. Advancing other conferences...</div>'
        + '<div class="btn btn-red btn-full" onclick="simConfRoundAll()">ADVANCE TO NCAA</div></div>';
    }
  } else if (G.phase === 'ncaa') {
    var ncaaMatch = getUserNCAAmatchup();
    if (ncaaMatch) {
      var userIsB1 = ncaaMatch.b1.team.id === G.tid;
      var ncaaOppEntry = userIsB1 ? ncaaMatch.b2 : ncaaMatch.b1;
      var userEntry = userIsB1 ? ncaaMatch.b1 : ncaaMatch.b2;
      var ncaaOpp = ncaaOppEntry.team;
      var active = G.bracket ? G.bracket.filter(function(b) { return b.active; }).length : 0;
      var rn = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16', 8: 'Elite Eight', 4: 'Final Four', 2: 'Championship' };
      var ncaaRoundName = rn[active] || 'NCAA Tournament';
      var dm3 = DIFF_MOD[G.difficulty] || 0;
      var nwp = clamp(50 + ((getTOvr(t) + dm3) - getTOvr(ncaaOpp)) * 1.3, 5, 95);
      var nwpc = nwp >= 50 ? 'var(--grn)' : '#dc2626';
      h += '<div class="matchup-card" style="border-left-color:var(--gld);">'
        + '<div style="font-size:10px;font-weight:700;color:var(--gld2);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">NCAA \u2014 ' + ncaaRoundName + '</div>'
        + '<div class="matchup-opp">#' + ncaaOppEntry.seed + ' ' + ncaaOpp.name + '</div>'
        + '<div class="matchup-meta">'
        + '<span class="tag" style="background:rgba(214,158,46,.12);color:var(--gld2);">MARCH MADNESS</span>'
        + '<span style="color:var(--gld2);">You: #' + userEntry.seed + ' \u00b7 OVR ' + getTOvr(ncaaOpp) + ' \u00b7 ' + ncaaOpp.wins + '-' + ncaaOpp.loss + '</span>'
        + '</div>'
        + '<div class="prob-row"><span>Win Probability</span><span style="color:' + nwpc + ';font-weight:700;">' + Math.round(nwp) + '%</span></div>'
        + '<div class="prob-bar"><div class="prob-fill" style="width:' + Math.round(nwp) + '%;background:' + nwpc + ';"></div></div>'
        + '<div class="action-btns">'
        + '<div class="btn btn-red btn-full" onclick="doPlay(\'quick\')">\u26a1 QUICK SIM</div>'
        + '<div class="btn btn-ghost btn-full" onclick="doPlay(\'live\')">\u25b6 LIVE SIM</div>'
        + '</div></div>';
    } else {
      h += '<div class="matchup-card">'
        + '<div style="font-size:11px;color:var(--txt3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">NCAA Tournament</div>'
        + '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">Your run is over. Simming remaining games...</div>'
        + '<div class="btn btn-red btn-full" onclick="simNCAAround()">SIM NEXT ROUND</div></div>';
    }
  }
  return h;
}

// ═══════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

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

  // Stats banner
  h += renderStatsBanner();

  // Score ticker
  h += renderTicker();

  // 3-column layout
  h += '<div style="display:grid;grid-template-columns:220px 1fr 220px;gap:14px;">';

  // ── LEFT COLUMN: Conference standings ──
  h += '<div style="display:flex;flex-direction:column;gap:10px;">';
  h += renderMiniStandings();
  h += renderCoachCard();
  h += '</div>';

  // ── CENTER COLUMN: Game card + record ──
  h += '<div style="display:flex;flex-direction:column;gap:10px;">';
  h += renderGameCard();
  h += '</div>';

  // ── RIGHT COLUMN: Leaders, stats, expectations, headlines ──
  h += '<div style="display:flex;flex-direction:column;gap:10px;">';
  h += renderTeamLeaders();
  h += renderTeamStats();
  h += renderExpectations();
  h += renderHeadlines();
  h += '</div>';

  h += '</div>'; // close grid

  el.innerHTML = h;
}
