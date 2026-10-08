// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recap.js
//  Season Recap + Awards. Renders inside the offseason view
//  (recruiting.js calls window._renderSeasonRecap). Mobile-
//  first stacking; delegated CTA, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { STREAMS, BUCKETS, ledger, totals } from '../finance.js';
import { G } from '../state.js';
import { pollRank, pollTeams } from '../poll.js';
import { SKILL_POINT_TABLE } from '../constants.js';
import { awardScore, pickPositionalTeam, getTOvr, oldOvr } from '../utils.js';
import { playerFaceSmallHTML } from './faces.js';

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


// ═══════════════════════════════════════════════════════════
//  GM RECAP — your season on one screen: the verdict against the
//  athletic director's expectations, your roster with stats, and the
//  skill points with the button to move on. League awards live on a
//  second tab.
// ═══════════════════════════════════════════════════════════
var _rcTab = 'you';
export function setRecapTab(t) { _rcTab = t === 'league' ? 'league' : 'you'; }
if (typeof window !== 'undefined') window._setRecapTab = setRecapTab;

function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

function verdictHTML(t, rank, tf) {
  var exp = G.expectations;
  var sa = G.seasonAchievements || {};
  var v = { txt: 'Season complete', cls: '', line: '' };
  if (exp) {
    var ncaaMiss = exp.ncaa && !sa.madeNCAA;
    if (t.wins > exp.high) v = { txt: 'Beat expectations', cls: 'good' };
    else if (t.wins >= exp.low && !ncaaMiss) v = { txt: 'Met expectations', cls: '' };
    else if (t.wins >= exp.low) v = { txt: 'Short of expectations', cls: 'bad' };
    else if (exp.danger !== undefined && t.wins < exp.danger) v = { txt: 'Well short of expectations', cls: 'bad' };
    else v = { txt: 'Short of expectations', cls: 'bad' };
    v.line = 'The athletic director expected ' + exp.low + '-' + exp.high + ' wins' + (exp.ncaa ? ' and an NCAA bid' : '') + '. '
      + 'You won ' + t.wins + (exp.ncaa || sa.madeNCAA ? (sa.madeNCAA ? ' and made the tournament.' : ' and missed the tournament.') : '.');
  }
  if (G.coach && G.coach.hotSeat) v.line += ' <b>You are on the hot seat.</b> Another season like this and you will be replaced.';
  var confT = G.teams.filter(function(x) { return x.conf === t.conf; })
    .sort(function(a, b) { return (b.cWins - b.cLoss) - (a.cWins - a.cLoss) || b.pts - a.pts; });
  var confPos = confT.findIndex(function(x) { return x.id === t.id; }) + 1;
  var l = ledger(), tot = totals(l);
  var gs = G.goals && G.goals.results && G.goals.yr === G.yr ? G.goals.results : [];
  var met = gs.filter(function(r) { return r.done; }).length;
  var h = '<div class="panel rc-verdict"><div class="panel-b">'
    + '<div class="rc-v ' + v.cls + '">' + v.txt + '</div>'
    + (v.line ? '<div class="rc-vline">' + v.line + '</div>' : '')
    + '<div class="rc-kv">'
    + '<div><b>' + t.wins + '-' + t.loss + '</b><span>Record</span></div>'
    + '<div><b>' + ordinal(confPos) + '</b><span>' + t.conf + ' (' + t.cWins + '-' + t.cLoss + ')</span></div>'
    + '<div><b>' + (rank ? '#' + rank : 'NR') + '</b><span>Final poll</span></div>'
    + '<div><b>' + tf + '</b><span>NCAA</span></div>'
    + '<div><b>' + (tot.net >= 0 ? '+' : '−') + Math.abs(tot.net) + '</b><span>NIL net</span></div>'
    + '</div>';
  if (gs.length) {
    h += '<div class="rc-goals"><span class="rc-gh">Goals ' + met + ' of ' + gs.length + '</span>'
      + gs.map(function(r) { return '<span class="rc-goal ' + (r.done ? 'good' : 'bad') + '">' + (r.done ? '✓ ' : '✗ ') + r.text + '</span>'; }).join('') + '</div>';
  }
  return h + '</div></div>';
}

function rosterHTML(t) {
  var rows = (t.rost || []).slice().sort(function(a, b) { return (b.mins || 0) - (a.mins || 0) || b.ovr - a.ovr; });
  var h = '<div class="panel rc-roster"><div class="panel-h"><span>Your roster</span><small>Season stats</small></div>'
    + '<div class="panel-b flush"><div class="tbl-wrap"><table class="rc-tbl"><thead><tr>'
    + '<th>Player</th><th class="num">OVR</th><th class="num rc-x">MIN</th><th class="num">PPG</th><th class="num">RPG</th><th class="num">APG</th><th class="num rc-x">FG%</th>'
    + '</tr></thead><tbody>';
  rows.forEach(function(p) {
    var s = p.s || {}, gp = s.gp || 0;
    var per = function(k) { return gp ? (s[k] / gp).toFixed(1) : '–'; };
    var ppg = gp ? s.pts / gp : 0;
    var leaving = p.cls === 'SR' && !p.rs ? 'Graduating' : (ppg >= 16 && p.cls !== 'FR' ? 'Draft' : '');
    h += '<tr><td><div class="rc-pn">' + playerFaceSmallHTML(p, G.teams[G.tid].name) + pLink(p.name, G.tid) + ' <span class="rc-pm">' + p.pos + ' · ' + p.cls + '</span>'
      + (leaving ? ' <span class="rc-leave">' + leaving + '</span>' : '') + '</div></td>'
      + '<td class="num">' + p.ovr + '</td><td class="num rc-x">' + (p.mins || 0) + '</td>'
      + '<td class="num">' + per('pts') + '</td><td class="num">' + per('reb') + '</td><td class="num">' + per('ast') + '</td>'
      + '<td class="num rc-x">' + (s.fga ? Math.round(s.fgm / s.fga * 100) : '–') + '</td></tr>';
  });
  return h + '</tbody></table></div></div></div>';
}

function coachingHTML(skillPts) {
  var pts = G.skillPointsToSpend || 0;
  var h = '<div class="panel rc-coach"><div class="panel-h"><span>Skill points</span><small>' + skillPts.length + ' earned this season</small></div><div class="panel-b">';
  if (skillPts.length) h += '<div class="rc-earned">' + skillPts.map(function(l) { return '<span>✓ ' + l + '</span>'; }).join('') + '</div>';
  else h += '<div class="rc-earned none">No achievements this season.</div>';
  h += '</div></div>';
  if (typeof window !== 'undefined' && window._skillPanelHTML) h += window._skillPanelHTML();
  h += '<button class="btn-big btn-full" data-action="begin-offseason">Begin offseason' + (pts > 0 ? ' (' + pts + ' point' + (pts > 1 ? 's' : '') + ' carry over)' : '') + '</button>';
  return h;
}

export function renderSeasonRecap() {
  var t = G.teams[G.tid];
  var rank = pollRank(G.tid); // final Top 25 (0 = unranked)
  var lastHistory = G.history && G.history.length ? G.history[G.history.length - 1] : null;
  var tf = lastHistory ? lastHistory.tourneyFinish : '';
  tf = { CHAMP: 'Champion', 'Championship Game': 'Runner-up', 'Did Not Qualify': 'No bid', 'Conf Tourney': 'No bid',
    'Round of 64': 'First round', 'Round of 32': 'Second round', 'Opening round': 'Opening round' }[tf] || tf || '—';
  var natChamp = null;
  if (G.bracket && G.bracket.length) { var still = G.bracket.filter(function(b) { return b.active; }); if (still.length === 1) natChamp = still[0].team; }

  var h = '<div class="rc-head"><div><div class="sec-head" style="margin:0;">' + t.name + ' · ' + G.yr + ' season</div>'
    + '<div class="sec-sub" style="margin:2px 0 0;">' + (natChamp ? natChamp.name + ' won the national title.' : 'Season complete.') + '</div></div>'
    + '<div class="fbar rc-tabs"><button class="fchip' + (_rcTab === 'you' ? ' on' : '') + '" data-rctab="you">Your season</button>'
    + '<button class="fchip' + (_rcTab === 'league' ? ' on' : '') + '" data-rctab="league">League awards</button></div></div>';
  if (_rcTab === 'league') {
    h += leagueHTML();
    h += '<button class="btn-big btn-full" style="margin-top:12px;" data-rctab="you">Back to your season</button>';
    return h;
  }
  h += '<div class="rc-grid"><div class="rc-left">' + verdictHTML(t, rank, tf) + rosterHTML(t) + '</div>'
    + '<div class="rc-right">' + coachingHTML(calcSkillPoints()) + '</div></div>';
  return h;
}

function leagueHTML() {
  var t = G.teams[G.tid];
  var year = G.yr;
  var awards = calcAwards();
  var skillPts = calcSkillPoints();

  var natChamp = { name: 'TBD' };
  if (G.bracket && G.bracket.length) {
    var still = G.bracket.filter(function(b) { return b.active; });
    if (still.length === 1) natChamp = still[0].team;
  }

  // Final top 10 = the final Top 25 poll (after the NCAA tournament)
  var topTeams = pollTeams().slice(0, 10);
  var rank = pollRank(G.tid);

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

  var h = '<div class="grid-2">';

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

  h += '</div></div>';
  return h;
}
