// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recap.js
//  Season Recap + Awards. Renders inside the offseason view
//  (recruiting.js calls window._renderSeasonRecap). Mobile-
//  first stacking; delegated CTA, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { STREAMS, BUCKETS, ledger, totals } from '../finance.js';
import { G } from '../state.js';
import { SKILL_POINT_TABLE } from '../constants.js';
import { awardScore, pickPositionalTeam, getTOvr, oldOvr } from '../utils.js';

// Clickable player name (opens the profile; convention in views/player.js)
function pLink(name, tid) {
  return '<span class="pname" data-action="player" data-player-name="' + String(name).replace(/"/g, '&quot;') + '" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}


// ═══════════════════════════════════════════════════════════
//  AWARDS CALCULATION
// ═══════════════════════════════════════════════════════════

function calcAwards() {
  var allPlayers = [];
  G.teams.forEach(function(t) {
    t.rost.forEach(function(p) {
      var gp = p.s.gp || 0;
      if (gp < 10) return;
      allPlayers.push({
        name: p.name, pos: p.pos, cls: p.cls, ovr: p.ovr,
        team: t.name, tid: t.id, conf: t.conf,
        ppg: +(p.s.pts / gp).toFixed(1),
        rpg: +(p.s.reb / gp).toFixed(1),
        apg: +(p.s.ast / gp).toFixed(1),
        fgp: p.s.fga > 0 ? +(p.s.fgm / p.s.fga * 100).toFixed(1) : 0,
        per: +awardScore(p, t).toFixed(1)
      });
    });
  });

  allPlayers.sort(function(a, b) { return b.per - a.per; });
  var poy = allPlayers[0] || null;
  var allAmerican = pickPositionalTeam(allPlayers);

  var freshmen = allPlayers.filter(function(p) { return p.cls === 'FR'; });
  freshmen.sort(function(a, b) { return b.per - a.per; });
  var foy = freshmen[0] || null;

  var confTeams = {};
  var confs = {};
  allPlayers.forEach(function(p) {
    if (!confs[p.conf]) confs[p.conf] = [];
    confs[p.conf].push(p);
  });
  Object.keys(confs).forEach(function(conf) {
    confs[conf].sort(function(a, b) { return b.per - a.per; });
    confTeams[conf] = pickPositionalTeam(confs[conf]);
  });

  // Coach of the year: most wins above what the roster's talent predicted,
  // with extra credit for NCAA tournament wins
  var talent = G.teams.map(function(t) { return oldOvr(getTOvr(t)); });
  var meanTal = talent.reduce(function(a, b) { return a + b; }, 0) / Math.max(1, talent.length);
  var tWins = {};
  (G.bracket || []).forEach(function(b) {
    if (b && b.team && b.sc && b.sc.length) tWins[b.team.id] = b.active ? b.sc.length : b.sc.length - 1;
  });
  var coachCandidates = G.teams.map(function(t, i) {
    var totalGames = t.wins + t.loss;
    var expectedWinPct = Math.max(0.1, Math.min(0.9, 0.5 + (talent[i] - meanTal) * 0.025));
    var actualWinPct = totalGames > 0 ? t.wins / totalGames : 0;
    return { team: t, overperform: actualWinPct - expectedWinPct + (tWins[t.id] || 0) * 0.04 };
  });
  coachCandidates.sort(function(a, b) { return b.overperform - a.overperform; });
  var coy = coachCandidates[0] ? coachCandidates[0].team : null;

  var userConf = G.teams[G.tid].conf;
  var userAllConf = confTeams[userConf] || [];

  return { poy: poy, allAmerican: allAmerican, foy: foy, coy: coy, userAllConf: userAllConf, userConf: userConf };
}

function calcSkillPoints() {
  var t = G.teams[G.tid];
  var sa = G.seasonAchievements || {};
  var earned = [];
  SKILL_POINT_TABLE.forEach(function(row) {
    if (row.check(t, sa)) earned.push(row.label);
  });
  // Season goals pay one skill point each
  var gs = G.goals;
  if (gs && gs.results && gs.yr === G.yr) gs.results.forEach(function(r) { if (r.done) earned.push('Season goal: ' + r.text.charAt(0).toLowerCase() + r.text.slice(1)); });
  return earned;
}

function moneyPanels() {
  var h = '';
  var gs = G.goals;
  if (gs && gs.results && gs.yr === G.yr) {
    h += '<div class="panel"><div class="panel-h"><span>Season goals</span><small>' + gs.results.filter(function(r) { return r.done; }).length + ' of ' + gs.results.length + ' met</small></div><div class="panel-b flush"><table><tbody>';
    gs.results.forEach(function(r) {
      h += '<tr><td style="width:22px;color:' + (r.done ? 'var(--grn2)' : 'var(--red)') + ';">' + (r.done ? '✓' : '✗') + '</td><td>' + r.text + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }
  var l = ledger(), tot = totals(l);
  h += '<div class="panel"><div class="panel-h"><span>Program finances</span><small>NIL</small></div><div class="panel-b flush"><table><tbody>';
  STREAMS.forEach(function(s) { if (l.income[s[0]]) h += '<tr><td>' + s[1] + '</td><td class="num">+' + l.income[s[0]] + '</td></tr>'; });
  BUCKETS.forEach(function(b) { if (l.spend[b[0]]) h += '<tr><td style="color:var(--txt2);">' + b[1] + '</td><td class="num" style="color:var(--txt2);">−' + l.spend[b[0]] + '</td></tr>'; });
  h += '<tr><td><b>Net</b></td><td class="num"><b>' + (tot.net >= 0 ? '+' : '−') + Math.abs(tot.net) + '</b></td></tr>'
    + '</tbody></table><div style="font-size:12px;color:var(--txt3);padding:6px 10px 8px;">The donor collective\'s check arrives next, before the transfer portal.</div></div></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════

export function renderSeasonRecap() {
  var t = G.teams[G.tid];
  var year = G.yr;
  var awards = calcAwards();
  var skillPts = calcSkillPoints();

  var natChamp = { name: 'TBD' };
  if (G.bracket && G.bracket.length) {
    var still = G.bracket.filter(function(b) { return b.active; });
    if (still.length === 1) natChamp = still[0].team;
  }

  // Final top 10 = the final national rankings (not raw win margin, which
  // put 30-win low-majors ahead of the best teams)
  var topTeams = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).slice(0, 10);
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;

  var lastHistory = G.history && G.history.length ? G.history[G.history.length - 1] : null;
  var tf = lastHistory ? lastHistory.tourneyFinish : '';
  tf = { CHAMP: 'National champion', 'Championship Game': 'Runner-up', 'Did Not Qualify': 'No NCAA bid',
    'Round of 64': 'First round', 'Round of 32': 'Second round' }[tf] || tf || '—';

  function awardCard(kicker, name, sub, yours, tid) {
    return '<div class="panel"><div class="panel-h"><span>' + kicker + '</span></div>'
      + '<div class="panel-b">'
      + '<div style="font-size:15px;font-weight:600;">' + (tid !== undefined ? pLink(name, tid) : name)
      + (yours ? ' <span class="tag t-home">Yours</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">' + sub + '</div></div></div>';
  }

  var h = '<div class="sec-head">Season ' + year + ' Recap</div>'
    + '<div class="sec-sub" style="margin-bottom:12px;">National champion · awards · your program</div>';

  h += '<div class="grid-2">';

  // LEFT — league
  h += '<div>';
  h += '<div class="panel"><div class="panel-h"><span>National champion</span></div>'
    + '<div class="panel-b"><div class="br-champ-team' + (natChamp.id === G.tid ? ' is-user' : '') + '">'
    + natChamp.name + '</div></div></div>';

  h += '<div class="panel"><div class="panel-h"><span>Final top 10</span></div>'
    + '<div class="panel-b flush"><table>'
    + '<thead><tr><th>Rank</th><th>Team</th><th style="text-align:right;">Record</th></tr></thead><tbody>';
  topTeams.forEach(function(tm, i) {
    h += '<tr' + (tm.id === G.tid ? ' class="hl"' : '') + '>'
      + '<td style="font-family:var(--mono);">' + (i + 1) + '</td>'
      + '<td>' + tm.name + '</td>'
      + '<td style="font-family:var(--mono);text-align:right;color:' + (tm.wins > tm.loss ? 'var(--grn2)' : 'var(--txt2)') + ';">'
      + tm.wins + '-' + tm.loss + '</td></tr>';
  });
  h += '</tbody></table></div></div>';

  if (awards.poy) h += awardCard('Player of the year', awards.poy.name,
    awards.poy.team + ' · ' + awards.poy.pos + ' · ' + awards.poy.ppg.toFixed(1) + ' PPG / ' + awards.poy.rpg.toFixed(1) + ' RPG / ' + awards.poy.apg.toFixed(1) + ' APG',
    awards.poy.tid === G.tid, awards.poy.tid);
  if (awards.foy) h += awardCard('Freshman of the year', awards.foy.name,
    awards.foy.team + ' · ' + awards.foy.ppg.toFixed(1) + ' PPG', awards.foy.tid === G.tid, awards.foy.tid);
  if (awards.coy) {
    var cn = awards.coy.coach ? awards.coy.coach.firstName + ' ' + awards.coy.coach.lastName : 'Staff';
    h += awardCard('Coach of the year', cn, awards.coy.name + ' (' + awards.coy.wins + '-' + awards.coy.loss + ')',
      awards.coy.id === G.tid);
  }
  h += '</div>';

  // RIGHT — your program
  h += '<div>';
  h += '<div class="panel"><div class="panel-h"><span>Your season</span></div><div class="panel-b">'
    + '<div class="dash-sum">'
    + '<div class="dash-team"><h1>' + t.name + '</h1>'
    + '<div class="sub">' + t.conf + ' · season ' + year + '</div></div>'
    + '<div class="kv">'
    + '<div><b>' + t.wins + '-' + t.loss + '</b><span>Record</span></div>'
    + '<div><b style="font-family:var(--mono);">#' + rank + '</b><span>Final rank</span></div>'
    + '<div><b>' + tf + '</b><span>NCAA tournament</span></div>'
    + '<div><b>' + (t.schoolPrestige || '—') + '</b><span>Prestige</span></div>'
    + '</div></div>'
    + '<div style="font-size:12px;color:var(--txt2);">Conference: ' + t.cWins + '-' + t.cLoss + ' (' + t.conf + ')</div>'
    + '</div></div>';
  h += moneyPanels();

  if (awards.allAmerican.length) {
    h += '<div class="panel"><div class="panel-h"><span>All-American team</span></div>'
      + '<div class="panel-b flush"><table>'
      + '<thead><tr><th>Player</th><th>Team</th><th style="text-align:right;">PPG</th>'
      + '<th style="text-align:right;">RPG</th><th style="text-align:right;">APG</th></tr></thead><tbody>';
    awards.allAmerican.forEach(function(p) {
      h += '<tr' + (p.tid === G.tid ? ' class="hl"' : '') + '>'
        + '<td>' + pLink(p.name, p.tid) + ' <span style="font-size:11px;color:var(--txt3);">' + p.pos + '</span></td>'
        + '<td style="font-size:12px;color:var(--txt2);">' + p.team + '</td>'
        + '<td style="font-family:var(--mono);text-align:right;">' + p.ppg.toFixed(1) + '</td>'
        + '<td style="font-family:var(--mono);text-align:right;">' + p.rpg.toFixed(1) + '</td>'
        + '<td style="font-family:var(--mono);text-align:right;">' + p.apg + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }

  if (awards.userAllConf.length) {
    h += '<div class="panel"><div class="panel-h"><span>All-conference team</span><small>' + awards.userConf + '</small></div>'
      + '<div class="panel-b flush"><table>'
      + '<thead><tr><th>Player</th><th>Team</th><th style="text-align:right;">PPG</th></tr></thead><tbody>';
    awards.userAllConf.forEach(function(p) {
      h += '<tr' + (p.tid === G.tid ? ' class="hl"' : '') + '>'
        + '<td>' + pLink(p.name, p.tid) + ' <span style="font-size:11px;color:var(--txt3);">' + p.pos + '</span></td>'
        + '<td style="font-size:12px;color:var(--txt2);">' + p.team + '</td>'
        + '<td style="font-family:var(--mono);text-align:right;">' + p.ppg + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  }

  // Record book: everything that fell this season + HOF inductions
  var _rb = G._recBreaks || [];
  if (_rb.length) {
    h += '<div class="panel"><div class="panel-h"><span>Record book</span></div><div class="panel-b">';
    _rb.forEach(function(b) { h += b.line; });
    h += '</div></div>';
  }

  h += '<div class="panel"><div class="panel-h"><span>Coaching XP earned</span></div><div class="panel-b">'
    + '<div style="font-family:var(--mono);font-size:20px;margin-bottom:8px;">' + skillPts.length
    + ' <span style="font-size:12px;color:var(--txt2);">skill point' + (skillPts.length !== 1 ? 's' : '') + '</span></div>';
  if (skillPts.length) {
    skillPts.forEach(function(label) {
      h += '<div style="font-size:12px;color:var(--grn2);padding:3px 0;">✓ ' + label + '</div>';
    });
  } else {
    h += '<div style="font-size:12px;color:var(--txt3);">No achievements this season.</div>';
  }
  h += '</div></div>';

  h += '</div></div>';

  h += '<div class="big-btn-row" style="text-align:center;">'
    + '<button class="btn-big" data-action="begin-offseason">Begin offseason</button></div>';

  return h;
}
