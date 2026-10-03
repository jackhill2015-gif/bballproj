// Full-season runner on the real modules (shared by diag/regression scripts).
import { REPO } from './shim.mjs';
export const S = await import(REPO + '/season.js');
export const T = await import(REPO + '/tournament.js');
export const SIM = await import(REPO + '/simulation.js');
export const ST = await import(REPO + '/state.js');
export const U = await import(REPO + '/utils.js');
export const C = await import(REPO + '/constants.js');
export const { G, SetupState } = ST;

S.registerSeasonCallbacks({ addLog() {}, updateAll() {}, navTo() {}, toast() {},
  startConfTourney() { T.startConfTourney(); }, playTournamentGame(w) { T.playTournamentGame(w); }, openModal() {} });
T.registerTournamentCallbacks({ toast() {}, addLog() {}, updateAll() {}, navTo() {}, openModal() {},
  endSeason() { S.endSeason(); }, renderBracket() {} });

export function newDynasty(tid = 0) {
  S.buildUniverse();
  Object.assign(G, { tid, yr: 2025, gi: 0, wk: 0, pts: 120, phase: 'reg', difficulty: 'normal',
    bracket: [], confTourneys: {}, confTitles: 0, championships: 0, logs: [], history: [], leagueChamps: [],
    recruitPhase: 0, recruitingBudget: 0, recruitingSpent: 0, recruitTargets: [], departingPlayers: [],
    offseasonStep: 'turnover', injuries: [], buffs: [], nextHomeBonus: 0, momentum: { tid: -1, pts: 0 }, prestige: 3,
    records: null, expectations: null, skillPointsEarned: 0, skillPointsToSpend: 0,
    finance: null, retention: null, goals: null, goalHistory: [], achievements: {}, facilities: null, jobMarket: null, lastResult: null });
  G.coach = { firstName: 'Test', lastName: 'Coach', age: 40, off: 70, def: 70, dev: 70, rec: 70, xp: 0, level: 1,
    careerWins: 0, careerLoss: 0, tenure: 0, hotSeat: false, titles: 0, confTitles: 0, finalFours: 0,
    tourneyApps: 0, awards: [], history: [] };
  G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };
  ST.resetLS();
  S.buildSchedules();
  const t = G.teams[G.tid];
  const pool = G.teams.filter(x => x.id !== G.tid && x.conf !== t.conf).sort(() => Math.random() - 0.5);
  SetupState.NC_PICKS = pool.slice(0, 10).map(x => x.id);
  S.setupUserOOC(); S.genRecruits();
  const conf = G.teams.filter(x => x.conf === t.conf);
  G.expectations = C.calcExpectations(U.getTOvr(t), conf.reduce((s, x) => s + U.getTOvr(x), 0) / conf.length);
}

export function runRegSeason() {
  let guard = 0;
  while (G.phase === 'reg' && G.gi < 30 && ++guard < 500) {
    const game = G.teams[G.tid].sched[G.gi];
    if (!game || game.played) { S.simCPUWeek(); S.advanceWeek(); } else S.launchSim(false);
  }
}
export function runConfTourneys() {
  let guard = 0;
  while (!T.allConfDone() && ++guard < 3000) {
    if (T.getUserConfMatchup()) T.playTournamentGame(false); else T.advanceConfTourney();
  }
}
export function runNCAA() {
  let guard = 0;
  while (G.bracket.filter(b => b.active).length > 1 && ++guard < 200) {
    if (T.getUserNCAAmatchup()) T.playTournamentGame(false); else T.simNCAAround();
  }
}
