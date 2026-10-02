// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recap.js
//  Season Recap + Awards. Renders inside the offseason view
//  (recruiting.js calls window._renderSeasonRecap). Mobile-
//  first stacking; delegated CTA, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';
import { SKILL_POINT_TABLE } from '../constants.js';

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
        per: +(((p.s.pts + p.s.reb + p.s.ast) / gp)).toFixed(1)
      });
    });
  });

  allPlayers.sort(function(a, b) { return b.per - a.per; });
  var poy = allPlayers[0] || null;
  var allAmerican = allPlayers.slice(0, 5);

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
    confTeams[conf] = confs[conf].slice(0, 5);
  });

  var coachCandidates = G.teams.map(function(t) {
    var totalGames = t.wins + t.loss;
    var expectedWinPct = (t.baseOvr - 50) / 50;
    var actualWinPct = totalGames > 0 ? t.wins / totalGames : 0;
    return { team: t, overperform: actualWinPct - expectedWinPct };
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
  return earned;
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

  var topTeams = G.teams.slice().sort(function(a, b) { return (b.wins - b.loss) - (a.wins - a.loss); }).slice(0, 10);
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;

  var lastHistory = G.history && G.history.length ? G.history[G.history.length - 1] : null;
  var tf = lastHistory ? lastHistory.tourneyFinish : 'N/A';

  function awardCard(kicker, name, sub, yours) {
    return '<div class="sec-block">'
      + '<div class="card-title">' + kicker + '</div>'
      + '<div style="font-size:18px;font-weight:900;' + (yours ? 'color:var(--blu);' : '') + '">' + name
      + (yours ? ' <span class="tag t-home">Yours</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">' + sub + '</div></div>';
  }

  var h = '<div style="margin-bottom:20px;">'
    + '<div class="sec-head">Season ' + year + ' Recap</div>'
    + '<div class="sec-sub">National champion · awards · your program</div></div>';

  h += '<div class="grid-2">';

  // LEFT — league
  h += '<div>';
  h += '<div class="sec-block">'
    + '<div class="card-title">National Champion</div>'
    + '<div class="br-champ-team">' + natChamp.name + '</div></div>';

  h += '<div class="sec-block"><div class="card-title">Final Top 10</div>';
  topTeams.forEach(function(tm, i) {
    var isU = tm.id === G.tid;
    h += '<div class="leader-row"><div class="leader-rank">' + (i + 1) + '</div>'
      + '<div class="leader-name" style="' + (isU ? 'font-weight:900;color:var(--blu);' : '') + '">' + tm.name + '</div>'
      + '<div style="font-family:var(--mono);font-weight:800;color:' + (tm.wins > tm.loss ? 'var(--grn2)' : 'var(--txt2)') + ';">' + tm.wins + '-' + tm.loss + '</div></div>';
  });
  h += '</div>';

  if (awards.poy) h += awardCard('Player of the Year', awards.poy.name,
    awards.poy.team + ' · ' + awards.poy.pos + ' · ' + awards.poy.ppg + ' PPG / ' + awards.poy.rpg + ' RPG / ' + awards.poy.apg + ' APG',
    awards.poy.tid === G.tid);
  if (awards.foy) h += awardCard('Freshman of the Year', awards.foy.name,
    awards.foy.team + ' · ' + awards.foy.ppg + ' PPG', awards.foy.tid === G.tid);
  if (awards.coy) {
    var cn = awards.coy.coach ? awards.coy.coach.firstName + ' ' + awards.coy.coach.lastName : 'Staff';
    h += awardCard('Coach of the Year', cn, awards.coy.name + ' (' + awards.coy.wins + '-' + awards.coy.loss + ')',
      awards.coy.id === G.tid);
  }
  h += '</div>';

  // RIGHT — your program
  h += '<div>';
  h += '<div class="sec-block"><div class="card-title">Your Season</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">'
    + '<div><div style="font-size:22px;font-weight:900;">' + t.name + '</div>'
    + '<div style="font-size:13px;color:var(--blu);font-weight:700;margin-top:2px;">' + t.wins + '-' + t.loss + ' (' + t.cWins + '-' + t.cLoss + ' ' + t.conf + ')</div></div>'
    + '<div style="text-align:right;"><div style="font-size:10px;color:var(--txt3);font-weight:700;">NET</div><div style="font-family:var(--mono);font-size:24px;font-weight:900;">#' + rank + '</div></div></div>'
    + '<div class="leader-row"><div class="leader-name">Tournament finish</div><div class="leader-val" style="font-size:14px;">' + tf + '</div></div>'
    + '<div class="leader-row"><div class="leader-name">Prestige</div><div class="leader-val" style="font-size:14px;">' + (t.schoolPrestige || '—') + '</div></div>'
    + '</div>';

  if (awards.allAmerican.length) {
    h += '<div class="sec-block"><div class="card-title">All-American Team</div>';
    awards.allAmerican.forEach(function(p) {
      var isU = p.tid === G.tid;
      h += '<div class="leader-row"><div class="leader-name" style="' + (isU ? 'font-weight:900;color:var(--blu);' : '') + '">' + p.name
        + '<small>' + p.pos + ' · ' + p.team + '</small></div>'
        + '<div style="font-family:var(--mono);font-size:12px;color:var(--txt2);">' + p.ppg + ' / ' + p.rpg + ' / ' + p.apg + '</div></div>';
    });
    h += '</div>';
  }

  if (awards.userAllConf.length) {
    h += '<div class="sec-block"><div class="card-title">All-' + awards.userConf + ' Team</div>';
    awards.userAllConf.forEach(function(p) {
      var isU = p.tid === G.tid;
      h += '<div class="leader-row"><div class="leader-name" style="' + (isU ? 'font-weight:900;color:var(--blu);' : '') + '">' + p.name
        + '<small>' + p.team + '</small></div>'
        + '<div style="font-family:var(--mono);font-size:12px;color:var(--txt2);">' + p.ppg + ' PPG</div></div>';
    });
    h += '</div>';
  }

  // Record book: everything that fell this season + HOF inductions
  var _rb = G._recBreaks || [];
  if (_rb.length) {
    h += '<div class="sec-block"><div class="card-title">Record Book</div>';
    _rb.forEach(function(b) { h += b.line; });
    h += '</div>';
  }

  h += '<div class="sec-block">'
    + '<div class="card-title">Coaching XP Earned</div>'
    + '<div style="font-family:var(--mono);font-size:26px;font-weight:900;margin-bottom:8px;">' + skillPts.length + ' <span style="font-size:13px;font-weight:700;color:var(--txt2);">skill point' + (skillPts.length !== 1 ? 's' : '') + '</span></div>';
  if (skillPts.length) {
    skillPts.forEach(function(label) {
      h += '<div style="font-size:12px;color:var(--grn2);padding:3px 0;">✓ ' + label + '</div>';
    });
  } else {
    h += '<div style="font-size:12px;color:var(--txt3);">No achievements this season.</div>';
  }
  h += '</div>';

  h += '</div></div>';

  h += '<div style="margin-top:20px;text-align:center;">'
    + '<button class="btn-big" data-action="begin-offseason">Begin offseason</button></div>';

  return h;
}
