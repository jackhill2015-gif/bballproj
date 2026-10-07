// The moment the regular season ends: the tournament screen must not crash
// before the brackets exist (that crash left seasons stuck), and a save
// already stuck there recovers on the next Play.
import { G, S, T, newDynasty, runRegSeason } from './season-lib.mjs';
const B = await import('../views/bracket.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

newDynasty(0);
const conf = G.teams[G.tid].conf;
G.phase = 'conf_tourn'; G.confTourneys = {};
let html = '', threw = null;
try { html = B.bracketHubHTML(); } catch (e) { threw = e; }
check(!threw, 'tournament screen draws with no brackets yet' + (threw ? ' (' + threw.message + ')' : ''));
check(/brackets are being set/.test(html), 'it says the brackets are being set');
T.playTournamentGame(false);
check(Object.keys(G.confTourneys).length > 0 && G.confTourneys[conf], 'Play on a stuck save builds the brackets');

newDynasty(0);
runRegSeason();
check(G.phase === 'conf_tourn' && Object.keys(G.confTourneys).length > 0, 'ending the regular season builds every bracket');
threw = null; try { B.bracketHubHTML(); } catch (e) { threw = e; }
check(!threw, 'tournament screen draws after the brackets are built');

console.log(fails ? fails + ' FAILED' : 'all conference start checks passed');
process.exit(fails ? 1 : 0);
