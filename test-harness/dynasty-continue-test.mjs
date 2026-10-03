// Multi-season dynasty with "Continue" (fresh universe + load) at several
// points: the whole league — rosters, records, rankings — must survive.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
let fails = 0;
const check = (c, msg) => { console.log((c ? '  ok  ' : '  FAIL ') + msg); if (!c) fails++; };
const league = () => JSON.stringify(G.teams.map(t => ({ r: t.rost.map(p => [p.name, p.ovr, p.cls, p.s.pts]), w: t.wins, l: t.loss, pts: t.pts, strat: t.strat })));
function continueGame(label) {
  ST.saveStateNow();
  const before = league();
  S.buildUniverse();          // what loadAndPlay() does first
  ST.loadState();
  check(league() === before, `${label}: league identical after Continue`);
}
newDynasty(12);
// play half a season
for (let i = 0; i < 300 && G.gi < 15; i++) {
  const g = G.teams[G.tid].sched[G.gi];
  if (!g || g.played) { S.simCPUWeek(); S.advanceWeek(); } else S.launchSim(false);
}
continueGame('mid-season (week ' + G.gi + ')');
runRegSeason(); runConfTourneys(); runNCAA();
continueGame('offseason recap');
S.beginOffseason(); S.doOffseason();
continueGame('season 2 preseason');
const ovrs = G.teams.map(t => U.getTOvr(t));
runRegSeason();
continueGame('season 2 end of regular season');
runConfTourneys(); runNCAA();
S.beginOffseason(); S.doOffseason();
continueGame('season 3 preseason');
check(G.yr === 2027 && G.phase === 'reg', 'reached season 3 (yr ' + G.yr + ')');
// rankings sanity: preseason top 25 should be strong rosters
const top = G.teams.slice().sort((a, b) => b.pts - a.pts).slice(0, 25);
const avgTop = top.reduce((s, t) => s + U.getTOvr(t), 0) / 25;
const avgAll = G.teams.reduce((s, t) => s + U.getTOvr(t), 0) / G.teams.length;
check(avgTop > avgAll + 8, `preseason top 25 is the strongest rosters (top25 ovr ${avgTop.toFixed(1)} vs league ${avgAll.toFixed(1)})`);
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
