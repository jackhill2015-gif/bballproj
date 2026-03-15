// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recap.js
//  Season Recap + Awards — renders in main view, not popup.
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

  // Player of the Year — highest PER
  allPlayers.sort(function(a, b) { return b.per - a.per; });
  var poy = allPlayers[0] || null;

  // All-American (best 5 nationally by PER)
  var allAmerican = allPlayers.slice(0, 5);

  // Freshman of the Year
  var freshmen = allPlayers.filter(function(p) { return p.cls === 'FR'; });
  freshmen.sort(function(a, b) { return b.per - a.per; });
  var foy = freshmen[0] || null;

  // All-Conference teams (best 5 per conference)
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

  // Coach of the Year — team that most exceeded expectations (win% vs baseOvr)
  var coachCandidates = G.teams.map(function(t) {
    var totalGames = t.wins + t.loss;
    var expectedWinPct = (t.baseOvr - 50) / 50;
    var actualWinPct = totalGames > 0 ? t.wins / totalGames : 0;
    return { team: t, overperform: actualWinPct - expectedWinPct };
  });
  coachCandidates.sort(function(a, b) { return b.overperform - a.overperform; });
  var coy = coachCandidates[0] ? coachCandidates[0].team : null;

  // User's conference All-Conference team
  var userConf = G.teams[G.tid].conf;
  var userAllConf = confTeams[userConf] || [];

  return { poy: poy, allAmerican: allAmerican, foy: foy, confTeams: confTeams, coy: coy, userAllConf: userAllConf, userConf: userConf };
}

// ═══════════════════════════════════════════════════════════
//  SKILL POINTS
// ═══════════════════════════════════════════════════════════

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

  var h = '';

  // ── Header ──
  h += '<div style="text-align:center;margin-bottom:28px;">'
    + '<div style="font-size:11px;color:var(--gld2);letter-spacing:4px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">OFFICIAL RECAP</div>'
    + '<div style="font-size:40px;font-weight:900;line-height:1;letter-spacing:-2px;">SEASON ' + year + '</div>'
    + '<div style="height:2px;width:60px;background:var(--red);margin:14px auto;"></div></div>';

  // ── Two columns ──
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">';

  // LEFT — League
  h += '<div style="display:flex;flex-direction:column;gap:14px;">';

  // National Champion
  h += '<div class="card" style="padding:18px;border-left:4px solid var(--gld2);">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">National Champion</div>'
    + '<div style="font-size:22px;font-weight:900;">' + natChamp.name + '</div></div>';

  // Top 10
  h += '<div class="card" style="padding:18px;">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Final Top 10</div>';
  topTeams.forEach(function(tm, i) {
    var isU = tm.id === G.tid;
    h += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;">'
      + '<span><span style="color:var(--txt3);margin-right:6px;font-family:monospace;">#' + (i + 1) + '</span>'
      + '<span style="color:' + (isU ? 'var(--red)' : '#fff') + ';font-weight:' + (isU ? '800' : '500') + ';">' + tm.name + (isU ? ' \u25c0' : '') + '</span></span>'
      + '<span style="font-family:monospace;font-weight:700;color:' + (tm.wins > tm.loss ? 'var(--grn2)' : 'var(--txt)') + ';">' + tm.wins + '-' + tm.loss + '</span></div>';
  });
  h += '</div>';

  // Player of the Year
  if (awards.poy) {
    h += '<div class="card" style="padding:18px;border-left:4px solid var(--red);">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Player of the Year</div>'
      + '<div style="font-size:18px;font-weight:900;color:' + (awards.poy.tid === G.tid ? 'var(--red)' : '#fff') + ';">' + awards.poy.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">' + awards.poy.team + ' \u00b7 ' + awards.poy.pos + ' \u00b7 ' + awards.poy.ppg + ' PPG / ' + awards.poy.rpg + ' RPG / ' + awards.poy.apg + ' APG</div></div>';
  }

  // Freshman of the Year
  if (awards.foy) {
    h += '<div class="card" style="padding:18px;">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Freshman of the Year</div>'
      + '<div style="font-size:16px;font-weight:900;color:' + (awards.foy.tid === G.tid ? 'var(--grn2)' : '#fff') + ';">' + awards.foy.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">' + awards.foy.team + ' \u00b7 ' + awards.foy.ppg + ' PPG</div></div>';
  }

  // Coach of the Year
  if (awards.coy) {
    var coachName = awards.coy.coach ? awards.coy.coach.firstName + ' ' + awards.coy.coach.lastName : 'Staff';
    h += '<div class="card" style="padding:18px;">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Coach of the Year</div>'
      + '<div style="font-size:16px;font-weight:900;color:' + (awards.coy.id === G.tid ? 'var(--gld2)' : '#fff') + ';">' + coachName + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-top:2px;">' + awards.coy.name + ' (' + awards.coy.wins + '-' + awards.coy.loss + ')</div></div>';
  }

  h += '</div>';

  // RIGHT — Your program
  h += '<div style="display:flex;flex-direction:column;gap:14px;">';

  // Your season card
  h += '<div class="card" style="padding:20px;background:linear-gradient(145deg,var(--s2),var(--s1));">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">'
    + '<div><div style="font-size:24px;font-weight:900;letter-spacing:-.5px;">' + t.name + '</div>'
    + '<div style="font-size:13px;color:var(--red);font-weight:700;margin-top:2px;">' + t.wins + '-' + t.loss + ' (' + t.cWins + '-' + t.cLoss + ' ' + t.conf + ')</div></div>'
    + '<div style="text-align:right;"><div style="font-size:10px;color:var(--txt2);">NET</div><div style="font-size:22px;font-weight:900;">#' + rank + '</div></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
    + '<div style="background:rgba(255,255,255,.04);padding:10px;border-radius:4px;"><div style="font-size:9px;color:var(--txt3);text-transform:uppercase;">Tournament</div><div style="font-size:14px;font-weight:700;margin-top:2px;">' + tf + '</div></div>'
    + '<div style="background:rgba(255,255,255,.04);padding:10px;border-radius:4px;"><div style="font-size:9px;color:var(--txt3);text-transform:uppercase;">Prestige</div><div style="font-size:14px;font-weight:700;margin-top:2px;">' + (t.schoolPrestige || '--') + '</div></div>'
    + '</div></div>';

  // All-American
  if (awards.allAmerican.length) {
    h += '<div class="card" style="padding:18px;">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">All-American Team</div>';
    awards.allAmerican.forEach(function(p) {
      var isU = p.tid === G.tid;
      h += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(0,0,0,.03);font-size:12px;">'
        + '<span style="color:' + (isU ? 'var(--red)' : '#fff') + ';font-weight:' + (isU ? '800' : '600') + ';">' + p.name + ' <span style="color:var(--txt3);font-size:10px;">' + p.pos + ' \u00b7 ' + p.team + '</span></span>'
        + '<span style="font-family:monospace;color:var(--txt2);">' + p.ppg + ' / ' + p.rpg + ' / ' + p.apg + '</span></div>';
    });
    h += '</div>';
  }

  // Your Conference All-Conference
  if (awards.userAllConf.length) {
    h += '<div class="card" style="padding:18px;">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">All-' + awards.userConf + ' Team</div>';
    awards.userAllConf.forEach(function(p) {
      var isU = p.tid === G.tid;
      h += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(0,0,0,.03);font-size:12px;">'
        + '<span style="color:' + (isU ? 'var(--red)' : '#fff') + ';font-weight:' + (isU ? '800' : '600') + ';">' + p.name + ' <span style="color:var(--txt3);font-size:10px;">' + p.team + '</span></span>'
        + '<span style="font-family:monospace;color:var(--txt2);">' + p.ppg + ' PPG</span></div>';
    });
    h += '</div>';
  }

  // Skill Points Earned
  h += '<div class="card" style="padding:18px;border-left:4px solid var(--grn);">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Coaching XP Earned</div>'
    + '<div style="font-size:28px;font-weight:900;color:var(--grn2);margin-bottom:8px;">' + skillPts.length + ' skill point' + (skillPts.length !== 1 ? 's' : '') + '</div>';
  if (skillPts.length) {
    skillPts.forEach(function(label) {
      h += '<div style="font-size:11px;color:var(--grn2);padding:2px 0;">\u2713 ' + label + '</div>';
    });
  } else {
    h += '<div style="font-size:11px;color:var(--txt3);">No achievements this season.</div>';
  }
  h += '</div>';

  h += '</div>'; // close right
  h += '</div>'; // close grid

  // CTA
  h += '<div style="margin-top:24px;text-align:center;">'
    + '<div class="btn btn-red" onclick="beginOffseason()" style="display:inline-block;padding:14px 40px;font-size:14px;font-weight:800;">BEGIN OFFSEASON \u25b6</div></div>';

  return h;
}
