// Team pages + game detail sheets: markup convention, schedule entry shape,
// and sheet openers run without throwing on a real season.
import { G, S, ST, U, newDynasty } from './season-lib.mjs';
const TM = await import('../views/team.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

// Convention markup (mirrors views/player.js doc block)
const link = TM.teamLink(7, 'NC State');
check(/data-action="team"/.test(link) && /data-tid="7"/.test(link) && /role="button"/.test(link),
  'teamLink carries data-action="team" + data-tid + role=button: ' + link.slice(0, 80));

S.buildUniverse(); newDynasty(3);
// play 4 weeks so there are played schedule entries
let n = 0, guard = 0;
while (n < 4 && ++guard < 200) {
  const game = G.teams[G.tid].sched[G.gi];
  if (game && !game.played) { S.launchSim(false); n++; }
  S.simCPUWeek(); S.advanceWeek();
}
const played = G.teams[G.tid].sched.map((g, w) => ({ g, w })).filter(x => x.g && x.g.played);
check(played.length >= 4, 'played schedule entries exist: ' + played.length);
// Entries carry scores; games you played also keep a box score (boxscore-test)
check(played.every(x => x.g.uScore !== undefined), 'schedule entries have scores');
// Sheet openers run clean on real data
try {
  TM.openTeamPage(G.tid);
  TM.openTeamPage(99999); // unknown team -> empty state, no throw
  TM.openGameDetail(played[0].w);
  TM.openGameDetail(29); // unplayed week -> empty state, no throw
  check(true, 'openTeamPage/openGameDetail run without throwing');
} catch (e) { check(false, 'sheet opener threw: ' + e.message); }
// Team page for another team resolves that team's perspective
const t2 = G.teams[(G.tid + 1) % G.teams.length];
try { TM.openTeamPage(t2.id); check(true, 'team page opens for CPU team ' + t2.name); }
catch (e) { check(false, 'CPU team page threw: ' + e.message); }
if (fails) { console.log(fails + ' FAILURES'); process.exit(1); }
console.log('team-page-test: all ok');
