// 2027 NCAA format: 76 teams, a 12-game Opening Round (the 12 lowest
// at-large teams and the 12 lowest automatic qualifiers), winners join
// 52 directly seeded teams in the 64-team bracket.
import { G, S, T, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

newDynasty(0);
runRegSeason(); runConfTourneys();
check(G.phase === 'ncaa' && G.bracket.length === 64, 'bracket of 64 built');
const O = G.ncaaOpening;
check(O && O.games.length === 12 && !O.done, '12 Opening Round games');
const autoIds = new Set(Object.values(G.confTourneys).map(ct => ct.champ && ct.champ.id));
const openTeams = O.games.flatMap(g => [g.t1, g.t2]);
const pendingIds = new Set(G.bracket.filter(b => b.pending !== undefined).map(b => b.team.id));
const direct = G.bracket.filter(b => b.pending === undefined).map(b => b.team.id);
const all = new Set(openTeams.map(t => t.id).concat(direct));
check(all.size === 76, '76 different teams in the field (' + all.size + ')');
check(direct.length === 52, '52 teams seeded straight into the 64');
const al = O.games.filter(g => g.kind === 'al'), au = O.games.filter(g => g.kind === 'auto');
check(al.length === 6 && au.length === 6, 'six at-large games, six automatic-bid games');
check(al.every(g => !autoIds.has(g.t1.id) && !autoIds.has(g.t2.id)), 'at-large games have no conference champions');
check(au.every(g => autoIds.has(g.t1.id) && autoIds.has(g.t2.id)), 'automatic-bid games are all conference champions');
const slotSeed = g => T.bracketEntryAt(g.pos).seed;
check(al.every(g => [11, 12].includes(slotSeed(g))), 'at-large winners become 11 or 12 seeds');
check(au.every(g => [15, 16].includes(slotSeed(g))), 'automatic-bid winners become 15 or 16 seeds');
check(G.bracket.filter(b => b.pending !== undefined).length === 12, '12 bracket slots wait on the Opening Round');
check(T.getUserNCAAmatchup() === null, 'no round-of-64 game until the Opening Round is played');
check(/Opening Round/.test(T.getNCAAroundName()), 'round name says Opening Round');

// Put the user in an Opening Round game and play it through the normal flow
const g0 = O.games[0];
G.tid = g0.t2.id;
check(T.getUserOpeningGame() === g0, 'user opening game found');
ST.saveStateNow(); ST.loadState();
check(G.ncaaOpening && G.ncaaOpening.games.length === 12 && G.bracket.filter(b => b.pending !== undefined).length === 12, 'Opening Round survives a save and load');
const og = T.getUserOpeningGame();
check(og && og.t2.id === G.tid && og.t1 === G.teams[og.t1.id], 'loaded game points at live team objects');
T.playTournamentGame(false);
check(G.ncaaOpening.done && G.ncaaOpening.games.every(g => g.winner), 'playing your game finishes the whole Opening Round');
check(G.bracket.every(b => b.pending === undefined), 'every slot filled');
const winners = new Set(G.ncaaOpening.games.map(g => g.winner.id));
check(G.ncaaOpening.games.every(g => T.bracketEntryAt(g.pos).team.id === g.winner.id), 'each winner sits in its slot');
check(new Set(G.bracket.map(b => b.team.id)).size === 64, '64 different teams in the bracket');
const userWon = winners.has(G.tid);
check(userWon ? G.bracket.some(b => b.team.id === G.tid) : G.seasonAchievements.tourneyFinish === 'Opening round', 'user result recorded (' + (userWon ? 'won' : 'lost') + ')');
runNCAA();
check(G.bracket.filter(b => b.active).length === 1, 'tournament plays out to a champion');
S.checkSeasonAchievements && S.checkSeasonAchievements();

console.log(fails ? fails + ' FAILED' : 'all opening round checks passed');
process.exit(fails ? 1 : 0);
