// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/bracket.js
//  Bracket view: conference tournaments + NCAA bracket.
// ═══════════════════════════════════════════════════════════

import { ge, clamp, getTOvr } from '../utils.js';
import { G } from '../state.js';
import { allConfDone, getUserNCAAmatchup } from '../tournament.js';

export function renderBracket() {
  var el = ge('bracket-content'); if (!el) return;

  if (G.phase === 'conf_tourn' && G.confTourneys) {
    var myConf = G.teams[G.tid].conf;
    var ct = G.confTourneys[myConf];
    el.innerHTML = renderConfBracket(myConf, ct);
    return;
  }

  if (G.bracket && G.bracket.length) {
    el.innerHTML = renderNCAAbracket();
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--txt3);font-size:13px;">Complete the regular season to unlock the bracket.</div>';
}

function renderConfBracket(myConf, ct) {
  if (!ct) return '<div style="padding:40px;text-align:center;color:var(--txt3);">No tournament data.</div>';
  var rnames = { 1: 'First Round', 2: 'Quarterfinals', 3: 'Semifinals', 4: 'Championship' };
  var h = '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">';
  h += '<div style="font-size:18px;font-weight:900;letter-spacing:-.5px;">' + myConf + ' Tournament</div>';
  h += '<div style="font-size:11px;font-weight:700;color:' + (ct.done ? 'var(--grn2)' : 'var(--red)');
  h += '">' + (ct.done ? 'COMPLETE' : rnames[ct.rounds ? ct.rounds.length : 0] || 'IN PROGRESS') + '</div>';
  h += '</div>';

  if (!ct.rounds || !ct.rounds.length) {
    h += '<div style="color:var(--txt3);font-size:12px;padding:20px 0;">Tournament has not started yet.</div>';
    return h;
  }

  h += '<div style="display:flex;gap:0;overflow-x:auto;background:var(--s1);border:1px solid var(--bdr);border-radius:7px;overflow:hidden;">';

  ct.rounds.forEach(function(round, ri) {
    var rname = rnames[ri + 1] || 'Round ' + (ri + 1);
    h += '<div class="brk-col">';
    h += '<div class="brk-col-title">' + rname + '</div>';
    round.forEach(function(m) {
      var played = m.winner !== null;
      var isu1 = m.t1.id === G.tid, isu2 = m.t2.id === G.tid;
      var win1 = played && m.winner && m.winner.id === m.t1.id;
      var win2 = played && m.winner && m.winner.id === m.t2.id;
      h += '<div class="brk-game">';
      h += '<div class="brk-team' + (isu1 ? ' usr' : '') + (played ? (win1 ? ' win' : ' lose') : '') + '">';
      h += '<span class="brk-seed-n">' + (ct.seeds ? ct.seeds.findIndex(function(t) { return t.id === m.t1.id; }) + 1 : '') + '</span>';
      h += '<span class="brk-team-name">' + m.t1.name + '</span>';
      h += (played ? '<span class="brk-score" style="color:' + (win1 ? 'var(--grn2)' : 'var(--txt3)') + '">' + m.s1 + '</span>' : '');
      h += '</div>';
      h += '<div class="brk-team' + (isu2 ? ' usr' : '') + (played ? (win2 ? ' win' : ' lose') : '') + '">';
      h += '<span class="brk-seed-n">' + (ct.seeds ? ct.seeds.findIndex(function(t) { return t.id === m.t2.id; }) + 1 : '') + '</span>';
      h += '<span class="brk-team-name">' + m.t2.name + '</span>';
      h += (played ? '<span class="brk-score" style="color:' + (win2 ? 'var(--grn2)' : 'var(--txt3)') + '">' + m.s2 + '</span>' : '');
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
  });

  if (ct.done && ct.champ) {
    h += '<div class="brk-col" style="justify-content:center;align-items:center;">';
    h += '<div class="brk-col-title">Champion</div>';
    h += '<div style="text-align:center;padding:12px;">';
    h += '<div style="font-size:28px;margin-bottom:6px;">\ud83c\udfc6</div>';
    h += '<div style="font-size:13px;font-weight:900;color:' + (ct.champ.id === G.tid ? 'var(--gld2)' : '#fff') + ';line-height:1.2;">' + ct.champ.name + '</div>';
    if (ct.champ.id === G.tid) h += '<div style="font-size:10px;color:var(--gld2);margin-top:4px;font-weight:800;">YOUR TEAM</div>';
    h += '</div></div>';
  }
  h += '</div>';

  // Other conferences summary
  var otherConfs = Object.keys(G.confTourneys).filter(function(c) { return c !== myConf; });
  if (otherConfs.length) {
    h += '<div style="margin-top:16px;"><div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Other Conference Champions</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    otherConfs.forEach(function(c) {
      var oct = G.confTourneys[c];
      if (oct && oct.done && oct.champ) {
        h += '<div style="background:var(--s2);border:1px solid var(--bdr);border-radius:5px;padding:6px 10px;font-size:11px;">';
        h += '<span style="color:var(--txt3);font-size:10px;">' + c + '</span><br>';
        h += '<span style="font-weight:700;color:var(--txt);">' + oct.champ.name + '</span>';
        h += '</div>';
      }
    });
    h += '</div></div>';
    if (allConfDone() && (!G.bracket || !G.bracket.length)) {
      h += '<div style="margin-top:16px;"><div class="btn btn-red" style="display:inline-block;padding:12px 24px;" onclick="buildNCAA()">BUILD NCAA BRACKET \u25b6</div></div>';
    }
  }
  return h;
}

function renderNCAAbracket() {
  var active = G.bracket.filter(function(b) { return b.active; });
  var rn = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16', 8: 'Elite Eight', 4: 'Final Four', 2: 'Championship', 1: 'Champion' };
  var currentRound = rn[active.length] || '';
  var h = '';

  if (active.length === 1) {
    var ch = active[0].team; var isu = ch.id === G.tid;
    h = '<div style="text-align:center;padding:48px 32px;">';
    h += '<div style="font-size:64px;margin-bottom:12px;">\ud83c\udfc6</div>';
    h += '<div style="font-size:10px;font-weight:800;color:var(--gld2);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">' + G.yr + ' National Champion</div>';
    h += '<div style="font-size:40px;font-weight:900;color:' + (isu ? 'var(--gld2)' : '#fff') + ';letter-spacing:-1px;margin-bottom:6px;">' + ch.name + '</div>';
    if (isu) h += '<div style="font-size:15px;font-weight:800;color:var(--gld2);margin-bottom:24px;">YOUR DYNASTY. YOUR LEGACY.</div>';
    h += '<div class="btn btn-red" style="display:inline-block;padding:12px 28px;font-size:13px;" onclick="endSeason()">VIEW SEASON RECAP</div>';
    h += '</div>';
    return h;
  }

  h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">';
  h += '<div style="font-size:18px;font-weight:900;letter-spacing:-.5px;">NCAA Tournament</div>';
  h += '<div style="font-size:11px;font-weight:800;color:var(--red);letter-spacing:1px;text-transform:uppercase;">' + currentRound + '</div>';
  h += '</div>';

  var userMatch = getUserNCAAmatchup();
  if (userMatch) {
    var ub1 = userMatch.b1, ub2 = userMatch.b2;
    var uIsB1 = ub1.team.id === G.tid;
    var uTeam = uIsB1 ? ub1 : ub2, oppTeam = uIsB1 ? ub2 : ub1;
    h += '<div style="background:linear-gradient(135deg,rgba(214,158,46,.1),rgba(0,102,204,.08));border:2px solid var(--gld);border-radius:8px;padding:16px;margin-bottom:16px;">';
    h += '<div style="font-size:10px;font-weight:800;color:var(--gld2);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">YOUR GAME \u2014 ' + currentRound + '</div>';
    h += '<div style="display:flex;align-items:center;gap:12px;">';
    h += '<div style="flex:1;"><div style="font-size:11px;color:var(--gld2);font-weight:700;">#' + uTeam.seed + ' seed</div><div style="font-size:20px;font-weight:900;color:var(--txt);">' + uTeam.team.name + '</div></div>';
    h += '<div style="font-size:13px;font-weight:900;color:var(--txt3);">VS</div>';
    h += '<div style="flex:1;text-align:right;"><div style="font-size:11px;color:var(--txt2);font-weight:700;">#' + oppTeam.seed + ' seed</div><div style="font-size:20px;font-weight:900;color:var(--txt2);">' + oppTeam.team.name + '</div></div>';
    h += '</div>';
    var wp = clamp(50 + (getTOvr(uTeam.team) - getTOvr(oppTeam.team)) * 1.3, 5, 95);
    h += '<div style="margin-top:12px;"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);margin-bottom:4px;"><span>Win Probability</span><span style="color:' + (wp >= 50 ? 'var(--grn2)' : '#dc2626');
    h += ';font-weight:700;">' + Math.round(wp) + '%</span></div>';
    h += '<div style="height:5px;background:var(--bdr2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + Math.round(wp) + '%;background:' + (wp >= 50 ? 'var(--grn)' : 'var(--red)') + ';border-radius:3px;"></div></div>';
    h += '</div></div>';
  }

  var regions = ['East', 'West', 'South', 'Midwest'];
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  for (var r = 0; r < 4; r++) {
    var regionStart = r * 16;
    var regionTeams = G.bracket.slice(regionStart, regionStart + 16);
    if (!regionTeams.length) continue;
    h += '<div style="background:var(--s1);border:1px solid var(--bdr);border-radius:7px;overflow:hidden;">';
    h += '<div style="padding:8px 12px;background:var(--s2);border-bottom:1px solid var(--bdr);font-size:10px;font-weight:800;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;">' + regions[r] + ' Region</div>';
    for (var i = 0; i < regionTeams.length - 1; i += 2) {
      var b1 = regionTeams[i], b2 = regionTeams[i + 1];
      if (!b1 || !b2) continue;
      var played = b1.score !== null;
      h += '<div style="border-bottom:1px solid rgba(255,255,255,.04);">';
      [b1, b2].forEach(function(b, idx) {
        var isu = b.team.id === G.tid;
        var isWin = played && b.won;
        var isLose = played && !b.won;
        var rowStyle = 'display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:11px;font-weight:600;';
        if (isu) rowStyle += 'background:rgba(214,158,46,.1);border-left:3px solid var(--gld);';
        if (isWin) rowStyle += 'color:var(--grn2);';
        else if (isLose) rowStyle += 'color:var(--txt3);';
        else if (!isu) rowStyle += 'color:var(--txt);';
        else rowStyle += 'color:var(--gld2);';
        if (idx === 0) rowStyle += 'border-bottom:1px solid rgba(255,255,255,.04);';
        h += '<div style="' + rowStyle + '">';
        h += '<span style="font-size:9px;font-family:monospace;color:' + (isu ? 'var(--gld2)' : 'var(--txt3)') + ';width:16px;text-align:right;flex-shrink:0;">' + b.seed + '</span>';
        h += '<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + b.team.name + '</span>';
        if (played) h += '<span style="font-family:monospace;font-size:11px;font-weight:700;">' + b.score + '</span>';
        if (!b.active && !played) h += '<span style="font-size:9px;color:var(--txt3);">-</span>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}
