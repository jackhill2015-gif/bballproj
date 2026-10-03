// ═══════════════════════════════════════════════════════════
//  HOOPS OS — main.js
//  Entry point. Imports all modules, wires callback registries,
//  binds window globals for HTML onclick handlers, boots app.
// ═══════════════════════════════════════════════════════════

// ── Core ─────────────────────────────────────────────────
import { G, SetupState, flushPendingSave } from './state.js';
import {
  buildUniverse, buildSchedules, genRecruits,
  launchSim, doPlay, advanceWeek, autoSimNext, updateAutoBtn,
  recordResult, simCPUWeek, endSeason, beginOffseason, doOffseason,
  registerSeasonCallbacks
} from './season.js';
import {
  startConfTourney, simConfRoundAll, simNCAAround,
  playTournamentGame, buildNCAA, closeBracketReveal, revealFullBracket,
  showTournamentResult, closeTournamentResult, resolveTournamentGame,
  registerTournamentCallbacks
} from './tournament.js';
import {
  toast, addLog, updateAll, navTo, refreshView,
  openModal, stepSim, skipGame, finalizeModal,
  togglePlayMenu, renderLog,
  registerUICallbacks, initOutsideClickHandlers, updateAdvanceBtn
} from './ui.js';

// ── Views ────────────────────────────────────────────────
import { renderDashboard, renderStatsBanner } from './views/dashboard.js';
import { renderRoster, updateMins, updateMinsSlider, autoOptimizeRoster, rosterMove } from './views/roster.js';
import { renderStats } from './views/stats.js';
import { renderStandings } from './views/standings.js';
import { renderScheduleView } from './views/schedule.js';
import { renderHistory } from './views/history.js';
import { renderBracket } from './views/bracket.js';
import { renderOffseason, pitchRecruit, resolvePitchWeek, resolveRecruitingClass, adjustPoints, advanceRecruitPhase, addTarget, removeTarget, showDetail, closeDetail, setRecruitTab, setRecruitFilter, proceedToRecruiting, allocateSkillPoint, deallocateSkillPoint, finishSkillPoints, applyForJob, stayAtSchool, proceedFromFired, registerRecruitingCallbacks } from './views/recruiting.js';
import { renderSeasonRecap } from './views/recap.js';
import {
  showHomeScreen, loadAndPlay, startNewDynasty, deleteFromHome, newDynasty,
  buildPicker, togglePicker, selectTeam, pickRandom, setDiff,
  goToStep2, goToStep1, startDynasty, renderNCAutoList, swapNC,
  submitCoachName, submitDifficulty, selectJob, goBackToJobs,
  registerSetupCallbacks
} from './views/setup.js';
import { registerRecordsCallbacks } from './records.js';

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
  renderSeasonRecap: renderSeasonRecap,
  updateAdvance: updateAdvanceBtn
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

// Records stay UI-free: inject the quiet notifiers (log line + toast)
registerRecordsCallbacks({
  log: addLog,
  toast: toast
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
window.revealFullBracket = revealFullBracket;
window.closeTournamentResult = closeTournamentResult;

// Setup / Home screen
window.showHomeScreen = showHomeScreen;
window.loadAndPlay = loadAndPlay;
// Never lose the last move: write any pending save when the tab is hidden,
// switched away from on a phone, or closed.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') flushPendingSave(); });
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', function() { flushPendingSave(); });
}
// goals.js announces unlocks without importing the UI
window._hoopsToast = function(msg) { toast(msg); addLog('ev', G.gi, msg + '.'); };
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
window.submitCoachName = submitCoachName;
window.submitDifficulty = submitDifficulty;
window.selectJob = selectJob;
window.goBackToJobs = goBackToJobs;

// Roster
window.updateMins = updateMins;
window.updateMinsSlider = updateMinsSlider;
window.autoOptimizeRoster = autoOptimizeRoster;
window.rosterMove = rosterMove;

// Recruiting
window.pitchRecruit = pitchRecruit;
window.resolvePitchWeek = resolvePitchWeek;
window.resolveRecruitingClass = resolveRecruitingClass;
window.adjustPoints = adjustPoints;
window.advanceRecruitPhase = advanceRecruitPhase;
window.addTarget = addTarget;
window.removeTarget = removeTarget;
window.showDetail = showDetail;
window.closeDetail = closeDetail;
window.setRecruitTab = setRecruitTab;
window.setRecruitFilter = setRecruitFilter;
window.proceedToRecruiting = proceedToRecruiting;
window.allocateSkillPoint = allocateSkillPoint;
window.deallocateSkillPoint = deallocateSkillPoint;
window.finishSkillPoints = finishSkillPoints;
window.applyForJob = applyForJob;
window.stayAtSchool = stayAtSchool;
window.proceedFromFired = proceedFromFired;

// Auto-sim (referenced by setTimeout callbacks)
window.autoSimNext = autoSimNext;

// Bridge for recruiting.js to call genRecruits
window._genRecruits = genRecruits;
window._renderSeasonRecap = renderSeasonRecap;

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════

buildUniverse();
initOutsideClickHandlers();
showHomeScreen();

// Offline support: register the service worker (installed home-screen app
// keeps working with no signal). Skipped where unsupported or on file://.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof location !== 'undefined' && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(e) { console.warn('Offline support unavailable', e); });
  });
}
