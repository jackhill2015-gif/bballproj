// ═══════════════════════════════════════════════════════════
//  HOOPS OS — main.js
//  Entry point. Imports all modules, wires callback registries,
//  binds window globals for HTML onclick handlers, boots app.
// ═══════════════════════════════════════════════════════════

// ── Core ─────────────────────────────────────────────────
import { G, SetupState, flushPendingSave } from './state.js';
import { initStorage, onStorageError } from './storage.js';
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
  registerUICallbacks, initOutsideClickHandlers, updateAdvanceBtn, initTheme
} from './ui.js';

// ── Views ────────────────────────────────────────────────
import { renderDashboard, renderStatsBanner, renderProgram } from './views/dashboard.js';
import { renderRoster, updateMins, updateMinsSlider, autoOptimizeRoster, rosterMove } from './views/roster.js';
import { renderStats } from './views/stats.js';
import { renderStandings } from './views/standings.js';
import { renderScheduleView } from './views/schedule.js';
import { renderHistory } from './views/history.js';
import { renderBracket } from './views/bracket.js';
import { renderOffseason, pitchRecruit, resolvePitchWeek, resolveRecruitingClass, adjustPoints, advanceRecruitPhase, addTarget, removeTarget, showDetail, closeDetail, setRecruitTab, setRecruitFilter, proceedToRecruiting, allocateSkillPoint, deallocateSkillPoint, finishSkillPoints, applyForJob, stayAtSchool, proceedFromFired, registerRecruitingCallbacks } from './views/recruiting.js';
import { renderSeasonRecap } from './views/recap.js';
import {
  showHomeScreen, loadAndPlay, startNewDynasty, deleteFromHome, exitToHome,
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
  renderProgram: renderProgram,
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
window.exitToHome = exitToHome;
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
initTheme();
// Saves are read from IndexedDB into memory before the home screen shows
// (moves an older localStorage save into slot 1 the first time)
onStorageError(function() { toast('Couldn\u2019t save to this device. Back up your dynasty to be safe.'); });
initStorage().then(showHomeScreen, showHomeScreen);
if (typeof window !== 'undefined') window._gameStarted = true; // update guard in index.html

// Offline support: register the service worker (installed home-screen app
// keeps working with no signal). Skipped where unsupported or on file://.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof location !== 'undefined' && /^https?:/.test(location.protocol)) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(e) { console.warn('Offline support unavailable', e); });
  });
}

// ── Press and hold any +/− stepper to keep counting ──
// Works for portal offers, recruiting points and skill points. The screen
// re-renders after each step, so each repeat looks the button up again by
// its data attribute rather than holding on to the old element.
(function holdToRepeat() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  var KEYS = ['data-poff-inc', 'data-poff-dec', 'data-pt-inc', 'data-pt-dec', 'data-skill-inc', 'data-skill-dec'];
  var timer = null, sel = null, count = 0;
  function stop() { if (timer) clearTimeout(timer); timer = null; sel = null; }
  function tick() {
    if (!sel) return;
    var btn = document.querySelector(sel);
    if (!btn || btn.classList.contains('off') || btn.disabled) { stop(); return; }
    btn.click();
    count++;
    timer = setTimeout(tick, count < 6 ? 140 : count < 20 ? 80 : 45); // speeds up the longer you hold
  }
  document.addEventListener('pointerdown', function(e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    for (var i = 0; i < KEYS.length; i++) {
      if (b.hasAttribute(KEYS[i])) {
        var inSheet = !!b.closest('#sheet');
        sel = (inSheet ? '#sheet ' : '#app ') + 'button[' + KEYS[i] + '="' + b.getAttribute(KEYS[i]) + '"]';
        count = 0;
        timer = setTimeout(tick, 380); // a normal tap still counts once
        return;
      }
    }
  });
  ['pointerup', 'pointercancel'].forEach(function(ev) { window.addEventListener(ev, stop, true); });
  window.addEventListener('blur', function(e) { if (e.target === window) stop(); }); // app switched away, not a re-render
  document.addEventListener('contextmenu', function(e) { if (sel) e.preventDefault(); });
})();
