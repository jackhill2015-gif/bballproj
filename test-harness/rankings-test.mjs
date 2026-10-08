// The AP-style poll (poll.js): fast checks for run-all. The full 20-season
// calibration against real AP polls is rankings-calibration.mjs.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { simulate, compare, printTable } from './rankings-lib.mjs';
import { REPO } from './shim.mjs';
const P = await import(REPO + '/poll.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

// ── Mechanics over one season ──
const polls = [];
const off = P.onPoll(ev => polls.push({ kind: ev.kind, gi: G.gi, ids: ev.ids.slice() }));
newDynasty(60);
check(G.poll && G.poll.kind === 'pre' && G.poll.ids.length === 25 && new Set(G.poll.ids).size === 25, 'preseason poll: 25 different teams');
check(G.poll.rv.length === 10 && G.poll.rv.every(id => !G.poll.ids.includes(id)), 'ten others receiving votes, none of them ranked');
runRegSeason();
const reg = polls.filter(p => p.kind === 'reg');
check(reg.length === 15 && reg.every((p, i) => p.gi === 2 * (i + 1)), 'a new poll every other week (15 in the regular season)');
check(reg.every(p => p.ids.length === 25 && new Set(p.ids).size === 25), 'every poll has 25 different teams');
runConfTourneys();
check(G.poll.kind === 'sel', 'Selection Sunday poll after the conference tournaments');
runNCAA();
check(G.poll.kind === 'final', 'final poll after the NCAA tournament');
const champ = G.leagueChamps[G.leagueChamps.length - 1];
check(champ && G.poll.ids[0] === champ.tid, 'the national champion is #1 in the final poll (' + (champ && champ.name) + ')');
check(G.history[G.history.length - 1].poll === P.pollRank(G.tid), 'season history keeps your final poll rank');
off();
// arrows: previous poll is kept
check(Array.isArray(G.poll.prev) && G.poll.prev.length === 25, 'last poll kept for movement arrows');

// ── Save: small, and old saves get a poll on load ──
ST.saveStateNow();
const raw = JSON.parse(localStorage.getItem('hoops_os_v3'));
const pollBytes = JSON.stringify(raw.poll).length;
check(raw.poll && pollBytes < 600, 'poll adds only ' + pollBytes + ' bytes to the save');
const saved = JSON.stringify(G.poll);
S.buildUniverse(); ST.loadState();
check(JSON.stringify(G.poll) === saved, 'poll survives save and load');
delete raw.poll;
localStorage.setItem('hoops_os_v3', JSON.stringify(raw));
S.buildUniverse(); G.poll = null; ST.loadState();
check(G.poll && G.poll.ids.length === 25 && new Set(G.poll.ids).size === 25, 'a save from before the poll loads and starts one');
// next season's preseason poll uses last season's final poll
S.beginOffseason(); S.doOffseason();
check(G.poll.kind === 'pre' && G.poll.yr === G.yr && G.poll.ids.length === 25, 'next season opens with a new preseason poll');

// ── Calibration, loose: a few seasons, bands doubled ──
const st = simulate(4, 90);
const rows = compare(st, undefined, 2);
printTable(rows);
const key = ['Drop after a 1-loss-1-win week (all)', '  ... loss to an unranked team', 'New teams per poll (churn)', 'Preseason Top 25 still ranked at the end (%)', '#1 changes (% of polls)', 'Top 25 spots: power conferences (%)'];
rows.filter(r => key.includes(r[0])).forEach(r => check(r[4], 'calibration (loose): ' + r[0].trim() + ' ' + r[1] + ' vs real ' + r[2]));
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
