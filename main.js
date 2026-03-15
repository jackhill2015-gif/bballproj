// ═══════════════════════════════════════════════════════════
//  HOOPS OS — main.js
//  Entry point. Imports all modules, wires callback registries,
//  binds window globals for HTML onclick handlers, boots app.
// ═══════════════════════════════════════════════════════════

// ── Core ─────────────────────────────────────────────────
import { G, SetupState } from './state.js';
import {
  buildUniverse, buildSchedules, genRecruits,
  launchSim, doPlay, advanceWeek, autoSimNext, updateAutoBtn,
  recordResult, simCPUWeek, endSeason, showRecap, beginOffseason, doOffseason,
  registerSeasonCallbacks
} from './season.js';
import {
  startConfTourney, simConfRoundAll, simNCAAround,
  playTournamentGame, buildNCAA, closeBracketReveal,
  showTournamentResult, closeTournamentResult, resolveTournamentGame,
  registerTournamentCallbacks
} from './tournament.js';
import {
  toast, addLog, updateAll, navTo, refreshView,
  openModal, stepSim, skipGame, finalizeModal,
  togglePlayMenu, renderLog,
  registerUICallbacks, initOutsideClickHandlers
} from './ui.js';

// ── Views ────────────────────────────────────────────────
import { renderDashboard, renderStatsBanner } from './views/dashboard.js';
import { renderRoster, updateMins } from './views/roster.js';
import { renderStats } from './views/stats.js';
import { renderStandings } from './views/standings.js';
import { renderScheduleView } from './views/schedule.js';
import { renderHistory } from './views/history.js';
import { renderBracket } from './views/bracket.js';
import { renderOffseason, pitchRecruit, resolvePitchWeek, resolveRecruitingClass, adjustPoints, registerRecruitingCallbacks } from './views/recruiting.js';
import { renderSeasonRecap } from './views/recap.js';
import {
  showHomeScreen, loadAndPlay, startNewDynasty, deleteFromHome, newDynasty,
  buildPicker, togglePicker, selectTeam, pickRandom, setDiff,
  goToStep2, goToStep1, startDynasty, renderNCAutoList, swapNC,
  registerSetupCallbacks
} from './views/setup.js';

// ═══════════════════════════════════════════════════════════
//  WIRE CALLBACK REGISTRIES
//  Resolves all cross-module dependencies without circular imports.
// ═══════════════════════════════════════════════════════════

registerUICallbacks({
  renderDashboard: renderDashboard,
  renderRoster: renderRoster,
  renderStats: renderStats,
  renderStandings: renderStandings,
  renderScheduleView: renderScheduleView,
  renderHistory: renderHistory,
  renderBracket: renderBracket,
  renderOffseason: renderOffseason,
  doPlay: doPlay,
  recordResult: recordResult,
  simCPUWeek: simCPUWeek,
  advanceWeek: advanceWeek,
  showTournamentResult: showTournamentResult
});

registerSeasonCallbacks({
  toast: toast,
  addLog: addLog,
  updateAll: updateAll,
  navTo: navTo,
  openModal: openModal,
  startConfTourney: startConfTourney,
  simConfRoundAll: simConfRoundAll,
  simNCAAround: simNCAAround,
  playTournamentGame: playTournamentGame,
  renderSeasonRecap: renderSeasonRecap
});

registerTournamentCallbacks({
  toast: toast,
  addLog: addLog,
  updateAll: updateAll,
  navTo: navTo,
  openModal: openModal,
  endSeason: endSeason,
  renderBracket: renderBracket
});

registerRecruitingCallbacks({
  toast: toast,
  addLog: addLog,
  updateAll: updateAll
});

registerSetupCallbacks({
  addLog: addLog,
  updateAll: updateAll
});

// ═══════════════════════════════════════════════════════════
//  WINDOW BINDINGS
//  Required because HTML uses onclick="..." attributes which
//  can only call functions on the global (window) scope.
//  Module scope is not global, so we bridge here.
// ═══════════════════════════════════════════════════════════

// Navigation
window.navTo = navTo;

// Play controls
window.doPlay = doPlay;
window.togglePlayMenu = togglePlayMenu;
window.launchSim = launchSim;
window.skipGame = skipGame;

// Season flow
window.advanceWeek = advanceWeek;
window.beginOffseason = beginOffseason;
window.doOffseason = doOffseason;
window.endSeason = endSeason;

// Tournament
window.startConfTourney = startConfTourney;
window.simConfRoundAll = simConfRoundAll;
window.simNCAAround = simNCAAround;
window.buildNCAA = buildNCAA;
window.closeBracketReveal = closeBracketReveal;
window.closeTournamentResult = closeTournamentResult;

// Setup / Home screen
window.showHomeScreen = showHomeScreen;
window.loadAndPlay = loadAndPlay;
window.startNewDynasty = startNewDynasty;
window.deleteFromHome = deleteFromHome;
window.newDynasty = newDynasty;
window.togglePicker = togglePicker;
window.selectTeam = selectTeam;
window.pickRandom = pickRandom;
window.setDiff = setDiff;
window.goToStep2 = goToStep2;
window.goToStep1 = goToStep1;
window.startDynasty = startDynasty;
window.swapNC = swapNC;

// Roster
window.updateMins = updateMins;

// Recruiting
window.pitchRecruit = pitchRecruit;
window.resolvePitchWeek = resolvePitchWeek;
window.resolveRecruitingClass = resolveRecruitingClass;
window.adjustPoints = adjustPoints;

// Auto-sim (referenced by setTimeout callbacks)
window.autoSimNext = autoSimNext;

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════

buildUniverse();
initOutsideClickHandlers();
showHomeScreen();
