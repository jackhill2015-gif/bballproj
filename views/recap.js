// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recap.js
//  End-of-season recap screen.
// ═══════════════════════════════════════════════════════════

import { G } from '../state.js';

export function renderSeasonRecap() {
  var t = G.teams[G.tid];
  var year = G.yr;

  var natChamp = { name: 'TBD' };
  if (G.bracket && G.bracket.length) {
    var still = G.bracket.filter(function(b) { return b.active; });
    if (still.length === 1) natChamp = still[0].team;
  }

  var topTeams = G.teams.slice().sort(function(a, b) { return (b.wins - b.loss) - (a.wins - a.loss); }).slice(0, 5);
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;

  var lastHistory = G.history && G.history.length ? G.history[G.history.length - 1] : null;
  var tf = lastHistory ? lastHistory.tourneyFinish : 'N/A';

  var withGP = t.rost.filter(function(p) { return p.s.gp > 0; });
  if (!withGP.length) withGP = t.rost;
  var ppgL = withGP.slice().sort(function(a, b) { return (b.s.pts / (b.s.gp || 1)) - (a.s.pts / (a.s.gp || 1)); })[0];
  var rpgL = withGP.slice().sort(function(a, b) { return (b.s.reb / (b.s.gp || 1)) - (a.s.reb / (a.s.gp || 1)); })[0];
  var apgL = withGP.slice().sort(function(a, b) { return (b.s.ast / (b.s.gp || 1)) - (a.s.ast / (a.s.gp || 1)); })[0];

  var biggestUpset = null, biggestGap = 0;
  G.teams.forEach(function(tm) {
    tm.sched.forEach(function(s) {
      if (!s || !s.played) return;
      var opp = G.teams[s.opp]; if (!opp) return;
      var winner = s.uScore > s.oScore ? tm : opp;
      var loser = s.uScore > s.oScore ? opp : tm;
      var gap = loser.pts - winner.pts;
      if (gap > biggestGap && winner.id !== G.tid) { biggestGap = gap; biggestUpset = { winner: winner, loser: loser }; }
    });
  });

  var narrative = 'A foundation was laid this year. The boosters are watching closely.';
  if (t.wins >= 25) narrative = 'A historic run that put the nation on notice. The program has reached a new tier.';
  else if (t.wins < 10) narrative = 'A difficult campaign. The program must rebuild and refocus.';
  else if (tf === 'CHAMP') narrative = 'Immortalized. The rafters will hold a new banner forever.';
  else if (tf === 'F4') narrative = 'Final Four. The program is knocking on the door. Next year is the year.';
  else if (t.wins >= 20) narrative = 'A statement season. Respect has been earned across the country.';

  var commits = G.recruits ? G.recruits.filter(function(r) { return r.signed === G.tid; }).length : 0;
  var classRank = Math.max(1, Math.min(100, Math.round(150 - commits * 8 - G.prestige * 10)));

  return '<div style="max-width:900px;margin:0 auto;padding:20px;color:var(--txt);">'
    + '<div style="text-align:center;margin-bottom:36px;">'
    + '<div style="font-size:11px;color:var(--gld2);letter-spacing:4px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">OFFICIAL RECAP</div>'
    + '<div style="font-size:44px;font-weight:900;line-height:1;letter-spacing:-2px;">SEASON ' + year + '</div>'
    + '<div style="height:2px;width:60px;background:var(--red);margin:16px auto;"></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:24px;">'
    + '<div style="display:flex;flex-direction:column;gap:16px;">'
    + '<div class="card" style="padding:18px;border-left:4px solid var(--gld2);">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">National Champion</div>'
    + '<div style="font-size:20px;font-weight:900;">' + natChamp.name + '</div>'
    + '<div style="font-size:11px;color:var(--gld2);margin-top:3px;">' + G.yr + ' NCAA Champion</div>'
    + '</div>'
    + '<div class="card" style="padding:18px;">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">Top of the Class</div>'
    + topTeams.map(function(tm, i) {
        var isU = tm.id === G.tid;
        return '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">'
          + '<span><span style="color:var(--txt3);margin-right:8px;">#' + (i + 1) + '</span>'
          + '<span style="color:' + (isU ? 'var(--red)' : '#fff') + ';font-weight:' + (isU ? '800' : '500') + ';">' + tm.name + (isU ? ' \u25c0' : '') + '</span></span>'
          + '<span style="font-family:monospace;font-weight:700;color:' + (tm.wins > tm.loss ? 'var(--grn2)' : 'var(--txt)') + ';">' + tm.wins + '-' + tm.loss + '</span>'
          + '</div>';
      }).join('')
    + '</div>'
    + (biggestUpset
      ? '<div class="card" style="padding:18px;">'
      + '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Season Shocker</div>'
      + '<div style="font-size:14px;font-weight:800;color:#fc8181;">' + biggestUpset.winner.name.toUpperCase() + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-top:3px;">Toppled ' + biggestUpset.loser.name + ' in the upset of the year.</div>'
      + '</div>'
      : '')
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:16px;">'
    + '<div class="card" style="padding:22px;background:linear-gradient(145deg,var(--s2),var(--s1));border:1px solid var(--bdr);">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">'
    + '<div>'
    + '<div style="font-size:26px;font-weight:900;letter-spacing:-.5px;">' + t.name + '</div>'
    + '<div style="font-size:13px;color:var(--red);font-weight:700;margin-top:2px;">' + t.wins + '-' + t.loss + ' (' + t.cWins + '-' + t.cLoss + ' ' + t.conf + ')</div>'
    + '</div>'
    + '<div style="text-align:right;">'
    + '<div style="font-size:10px;color:var(--txt2);text-transform:uppercase;">NET</div>'
    + '<div style="font-size:24px;font-weight:900;">#' + rank + '</div>'
    + '</div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
    + '<div style="background:rgba(255,255,255,.04);padding:10px;border-radius:4px;">'
    + '<div style="font-size:9px;color:var(--txt3);text-transform:uppercase;margin-bottom:3px;">Tournament</div>'
    + '<div style="font-size:13px;font-weight:700;">' + tf + '</div></div>'
    + '<div style="background:rgba(255,255,255,.04);padding:10px;border-radius:4px;">'
    + '<div style="font-size:9px;color:var(--txt3);text-transform:uppercase;margin-bottom:3px;">Class Rank</div>'
    + '<div style="font-size:13px;font-weight:700;">#' + classRank + '</div></div>'
    + '</div></div>'
    + '<div class="card" style="padding:18px;">'
    + '<div style="font-size:10px;color:var(--txt2);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">Statistical Leaders</div>'
    + (ppgL ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--txt2);">Points</span><span style="font-size:13px;font-weight:700;">' + (ppgL.s.pts / (ppgL.s.gp || 1)).toFixed(1) + ' <span style="font-size:10px;color:var(--txt3);font-weight:400;">' + ppgL.name + '</span></span></div>' : '')
    + (rpgL ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:var(--txt2);">Rebounds</span><span style="font-size:13px;font-weight:700;">' + (rpgL.s.reb / (rpgL.s.gp || 1)).toFixed(1) + ' <span style="font-size:10px;color:var(--txt3);font-weight:400;">' + rpgL.name + '</span></span></div>' : '')
    + (apgL ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;"><span style="color:var(--txt2);">Assists</span><span style="font-size:13px;font-weight:700;">' + (apgL.s.ast / (apgL.s.gp || 1)).toFixed(1) + ' <span style="font-size:10px;color:var(--txt3);font-weight:400;">' + apgL.name + '</span></span></div>' : '')
    + '</div>'
    + '<div style="padding:18px;font-style:italic;color:var(--txt2);font-size:13px;text-align:center;line-height:1.7;background:rgba(255,255,255,.02);border:1px solid var(--bdr);border-radius:7px;">'
    + '&ldquo;' + narrative + '&rdquo;'
    + '</div>'
    + '</div></div>'
    + '<div style="margin-top:36px;text-align:center;">'
    + '<div class="btn btn-red" onclick="beginOffseason()" style="display:inline-block;padding:14px 40px;font-size:13px;font-weight:800;letter-spacing:1px;">BEGIN OFFSEASON \u25b6</div>'
    + '</div>'
    + '</div>';
}
