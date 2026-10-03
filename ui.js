// ═══════════════════════════════════════════════════════════
//  HOOPS OS — ui.js
//  Central UI manager: toast queue, O(1) game log, navigation,
//  topbar, context-aware Advance button (event delegation),
//  narrated recaps, coach XP, milestones, live sim modal.
// ═══════════════════════════════════════════════════════════

import { noteSpend } from './finance.js';
import { upgradeFacility } from './facilities.js';
import { ge, txt, fR, clamp } from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { simPoss, simGame } from './simulation.js';

// ── Late-Binding Registry ────────────────────────────────
var _views = {
  renderDashboard: null,
  renderRoster: null,
  renderStats: null,
  renderStandings: null,
  renderHistory: null,
  renderBracket: null,
  renderOffseason: null,
  renderScheduleView: null
};
var _actions = {
  doPlay: null,
  recordResult: null,
  simCPUWeek: null,
  advanceWeek: null,
  showTournamentResult: null
};

export function registerUICallbacks(callbacks) {
  Object.keys(callbacks).forEach(function(k) {
    if (_views.hasOwnProperty(k)) _views[k] = callbacks[k];
    if (_actions.hasOwnProperty(k)) _actions[k] = callbacks[k];
  });
}

// ═══════════════════════════════════════════════════════════
//  TOAST QUEUE — stacked, capped, no overlap
// ═══════════════════════════════════════════════════════════

var _toastQ = [];
var _toastShowing = 0;
var MAX_TOASTS = 3;

export function toast(msg, col) {
  msg = calm(msg);
  // Sentence case: "INDIANA ADVANCES!" reads as shouting in a quiet UI
  if (msg && msg === msg.toUpperCase() && /[A-Z]{4}/.test(msg)) msg = msg.charAt(0) + msg.slice(1).toLowerCase();
  _toastQ.push({ msg: msg, col: col || 'var(--blu)' });
  if (_toastQ.length > 6) _toastQ.shift(); // drop oldest if spammed
  pumpToasts();
}

function pumpToasts() {
  var stack = ge('toast-stack');
  if (!stack) return;
  while (_toastShowing < MAX_TOASTS && _toastQ.length) {
    (function(item) {
      _toastShowing++;
      var d = document.createElement('div');
      d.className = 'toast';
      d.style.borderLeftColor = item.col;
      d.textContent = item.msg;
      stack.appendChild(d);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function() { d.classList.add('show'); });
      } else {
        d.classList.add('show');
      }
      setTimeout(function() {
        d.classList.remove('show');
        setTimeout(function() {
          if (d.parentNode) d.parentNode.removeChild(d);
          _toastShowing--;
          pumpToasts();
        }, 250);
      }, 2800);
    })(_toastQ.shift());
  }
}

// ═══════════════════════════════════════════════════════════
//  GAME LOG — O(1) prepend with cap; batch rebuild on demand
// ═══════════════════════════════════════════════════════════

var LOG_CAP = 30;

function logNode(type, wk, text) {
  return '<div class="log-item log-' + type + '">'
    + '<div class="log-wk">Wk ' + wk + '</div>'
    + '<div class="log-txt">' + text + '</div></div>';
}

// Keep the feed and notices plain-text calm: no emoji, no shouting.
var EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
export function calm(text) {
  if (typeof text !== 'string') return text;
  return text.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
}

export function addLog(type, wk, text) {
  text = calm(text);
  // Intercept user game results: narrate + award coach XP + ranked-win moments
  if ((type === 'w' || type === 'l') && typeof text === 'string') {
    var enriched = narrateResult(type, text);
    if (enriched) text = enriched.text;
    awardGameXP(type, text);
  }
  G.logs.unshift({ type: type, wk: wk, text: text });
  if (G.logs.length > 60) G.logs.pop();
  // O(1) DOM prepend — never a full re-render per log line.
  // addLog is called from sim logic, so it must never crash on
  // minimal DOM shims: feature-check everything DOM-specific.
  var el = ge('game-log');
  if (el) {
    var node = logNode(type, wk, text);
    if (typeof el.insertAdjacentHTML === 'function') {
      el.insertAdjacentHTML('afterbegin', node);
    } else if (typeof el.innerHTML === 'string') {
      el.innerHTML = node + el.innerHTML;
    }
    if (el.children && typeof el.children.length === 'number') {
      while (el.children.length > LOG_CAP) el.removeChild(el.lastChild);
    }
  }
}

// Batch rebuild (used on view boot / nav, not per event)
export function renderLog() {
  var el = ge('game-log');
  if (!el) return;
  el.innerHTML = G.logs.slice(0, LOG_CAP).map(function(e) {
    return logNode(e.type, e.wk, e.text);
  }).join('');
}

// ── Narrated game recaps: 1–2 sentence log lines ──────────
// Turns "<b>W</b> vs <b>Duke</b> 78–71" into a story beat:
// margin flavor + top scorer + ranked/bubble context + streak.
function narrateResult(type, text) {
  try {
    var m = /<b>([WL])<\/b> vs <b>([^<]+)<\/b>\s*(\d+)[\u2013\u2014-](\d+)(.*)$/.exec(text);
    if (!m) return null;
    var won = type === 'w';
    var oppName = m[2];
    // Logged scores are winner-first (fmtScore); map back to user/opp
    var sA = parseInt(m[3], 10), sB = parseInt(m[4], 10);
    var uScore = won ? Math.max(sA, sB) : Math.min(sA, sB);
    var oScore = won ? Math.min(sA, sB) : Math.max(sA, sB);
    var suffix = m[5] || '';
    var margin = Math.abs(uScore - oScore);

    var verb = won
      ? (margin >= 15 ? 'cruised past' : margin >= 8 ? 'handled' : margin >= 4 ? 'held off' : 'edged')
      : (margin >= 15 ? 'were routed by' : margin >= 8 ? 'fell to' : margin >= 4 ? 'dropped one to' : 'lost a heartbreaker to');

    // Top scorer by season average
    var t = G.teams[G.tid];
    var best = null, bestPpg = 0;
    if (t && t.rost) t.rost.forEach(function(p) {
      var gp = p.s.gp || 0;
      if (gp < 3) return;
      var ppg = p.s.pts / gp;
      if (ppg > bestPpg) { bestPpg = ppg; best = p; }
    });

    // Ranked-opponent context
    var oppRank = teamRankOf(oppName);
    var ctx = '';
    if (oppRank > 0 && oppRank <= 25) {
      ctx = won ? ' Ranked win over #' + oppRank + '.' : ' Upset at the hands of #' + oppRank + '.';
    } else if (!won && oppRank > 100) {
      ctx = ' A costly loss.';
    }

    // Streak
    var streak = currentStreak();
    var streakTxt = '';
    if (won && streak >= 2) streakTxt = ' ' + streak + ' straight wins.';
    else if (!won && streak <= -2) streakTxt = ' ' + Math.abs(streak) + ' straight losses.';

    var star = best ? ' ' + best.name.split(' ').slice(-1)[0] + ' (' + bestPpg.toFixed(1) + ' ppg) led the way.' : '';
    var tour = '';
    if (suffix.indexOf('Conf Tourney') >= 0) tour = won ? ' On to the next round.' : ' The run ends here.';
    else if (suffix.indexOf('NCAA') >= 0) tour = won ? ' Survive and advance.' : ' Season over.';
    var narr = ' ' + t.name.split(' ').slice(-1)[0] + ' ' + verb + ' ' + oppName + '.' + star + ctx + streakTxt + tour;
    return { text: text + '<br><span style="color:var(--txt3);font-size:11px;">' + narr + '</span>' };
  } catch (e) { return null; }
}

function teamRankOf(name) {
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  for (var i = 0; i < sorted.length; i++) if (sorted[i].name === name) return i + 1;
  return 0;
}

export function userRank() {
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  return sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
}

// Consecutive W/L from most recent played game (+ = wins)
export function currentStreak() {
  var t = G.teams[G.tid];
  if (!t || !t.sched) return 0;
  var streak = 0;
  for (var i = t.sched.length - 1; i >= 0; i--) {
    var s = t.sched[i];
    if (!s || !s.played) continue;
    var w = s.uScore > s.oScore;
    if (streak === 0) streak = w ? 1 : -1;
    else if ((w && streak > 0) || (!w && streak < 0)) streak += w ? 1 : -1;
    else break;
  }
  return streak;
}

// ── Coach XP: per win / upset / tournament run ────────────
function xpToNext(level) { return 100 + (level - 1) * 75; }
export function coachXpToNext() { return xpToNext(G.coach.level || 1); }

function awardGameXP(type, text) {
  if (!G.coach) return;
  var xp = type === 'w' ? 12 : 2;
  var m = /vs <b>([^<]+)<\/b>/.exec(text);
  var oppRank = m ? teamRankOf(m[1]) : 0;
  if (type === 'w' && oppRank > 0 && oppRank <= 10) xp += 35;
  else if (type === 'w' && oppRank > 0 && oppRank <= 25) xp += 20;
  if (type === 'w' && G.phase === 'conf_tourn') xp += 25;
  if (type === 'w' && G.phase === 'ncaa') xp += 40;
  if (type === 'w' && oppRank > 0 && oppRank <= 25) {
    toast('Ranked win over #' + oppRank + ' ' + (m ? m[1] : ''), 'var(--gld)');
  }
  G.coach.xp = (G.coach.xp || 0) + xp;
  // Level-ups
  while (G.coach.xp >= xpToNext(G.coach.level || 1)) {
    G.coach.xp -= xpToNext(G.coach.level || 1);
    G.coach.level = (G.coach.level || 1) + 1;
    ['off', 'def', 'dev', 'rec'].forEach(function(k) {
      G.coach[k] = Math.min(99, (G.coach[k] || 70) + 1);
    });
    toast('Coach level ' + G.coach.level + ': +1 to all attributes', 'var(--blu)');
    addLog('ev', G.gi, '<b>Coach reached level ' + G.coach.level + '.</b> All coaching attributes +1.');
  }
}

// ═══════════════════════════════════════════════════════════
//  RANK MOVEMENT + MILESTONES
// ═══════════════════════════════════════════════════════════

var _prevRank = 0;
var _milestones = { wins: 0, streak: 0, top25: false, top10: false, no1: false };

// { prev, cur, delta } — delta > 0 means moved UP the rankings
// Movement since last week's poll (t.lastRank is snapshotted in advanceWeek
// and saved), so the arrow stays put until the next week is played.
export function rankDelta() {
  var t = G.teams[G.tid];
  var prev = (t && t.lastRank) || 0;
  var cur = userRank();
  return { prev: prev, cur: cur, delta: prev ? prev - cur : 0 };
}

function checkMilestones(rank) {
  // Career win milestones
  [100, 250, 500, 750, 1000].forEach(function(mn) {
    if (G.coach.careerWins >= mn && _milestones.wins < mn) {
      _milestones.wins = mn;
      toast('Milestone: ' + mn + ' career wins', 'var(--gld)');
      addLog('ev', G.gi, '<b>Milestone:</b> Coach ' + G.coach.lastName + ' reaches <b>' + mn + ' career wins</b>.');
    }
  });
  // Streak milestones
  var st = currentStreak();
  [5, 10, 15, 20].forEach(function(sn) {
    if (st >= sn && _milestones.streak < sn) {
      _milestones.streak = sn;
      toast(sn + '-game win streak', 'var(--grn)');
    }
  });
  if (st < 5) _milestones.streak = Math.min(_milestones.streak, st > 0 ? st : 0);
  // Ranking milestones
  if (rank <= 25 && !_milestones.top25 && _prevRank > 25) {
    _milestones.top25 = true;
    toast('First top-25 ranking: #' + rank, 'var(--blu)');
  }
  if (rank <= 10 && !_milestones.top10 && _prevRank > 10) {
    _milestones.top10 = true;
    toast('Top 10 ranking: #' + rank, 'var(--blu)');
  }
  if (rank === 1 && !_milestones.no1) {
    _milestones.no1 = true;
    toast('Ranked #1 in the nation', 'var(--gld)');
    addLog('ev', G.gi, '<b>' + G.teams[G.tid].name + ' is ranked #1 in the nation.</b>');
  }
  if (rank > 25) _milestones.top25 = false;
  if (rank > 10) _milestones.top10 = false;
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION (event-delegated)
// ═══════════════════════════════════════════════════════════

export function navTo(v) {
  SetupState.ACTIVE_VIEW = v;
  closeMoreSheet();
  document.querySelectorAll('.nav-btn').forEach(function(b) {
    b.classList.toggle('on', b.getAttribute('data-view') === v);
  });
  document.querySelectorAll('.view').forEach(function(el) { el.classList.remove('on'); });
  var vEl = ge('v-' + v);
  if (vEl) vEl.classList.add('on');
  refreshView();
}

export function refreshView() {
  var v = SetupState.ACTIVE_VIEW;
  if (v === 'dashboard' && _views.renderDashboard) _views.renderDashboard();
  else if (v === 'roster' && _views.renderRoster) _views.renderRoster();
  else if (v === 'stats' && _views.renderStats) _views.renderStats();
  else if (v === 'schedule' && _views.renderScheduleView) {
    var sc = ge('schedule-content');
    if (sc) sc.innerHTML = _views.renderScheduleView();
  }
  else if (v === 'standings' && _views.renderStandings) _views.renderStandings();
  else if (v === 'history' && _views.renderHistory) _views.renderHistory();
  else if (v === 'bracket' && _views.renderBracket) _views.renderBracket();
  else if (v === 'offseason' && _views.renderOffseason) _views.renderOffseason();
  else if (v === 'strategy') loadStrategyView();
  else if (v === 'trophies') loadTrophiesView();
  else if (v === 'help') loadHelpView();
}

var _trophiesMod = null;
function loadTrophiesView() {
  if (_trophiesMod) { _trophiesMod.renderTrophies(); return; }
  import('./views/trophies.js').then(function(m) {
    _trophiesMod = m;
    if (SetupState.ACTIVE_VIEW === 'trophies') m.renderTrophies();
  }).catch(function(e) { console.error('trophy room failed to load', e); });
}

var _helpMod = null;
function loadHelpView() {
  if (_helpMod) { _helpMod.renderHelp(); return; }
  import('./views/help.js').then(function(m) {
    _helpMod = m;
    if (SetupState.ACTIVE_VIEW === 'help') m.renderHelp();
  }).catch(function(e) { console.error('help view failed to load', e); });
}

// Strategy view is owned by views/strategy.js and loaded on demand so
// main.js needs no new static import or registry wiring.
var _strategyMod = null;
function loadStrategyView() {
  if (_strategyMod) { _strategyMod.renderStrategy(); return; }
  import('./views/strategy.js').then(function(m) {
    _strategyMod = m;
    if (SetupState.ACTIVE_VIEW === 'strategy') m.renderStrategy();
  }).catch(function(e) { console.error('strategy view failed to load', e); });
}

// ── More sheet (mobile 5-icon nav overflow) ──
export function toggleMoreSheet() {
  var sh = ge('more-sheet'), sc = ge('sheet-scrim');
  var open = sh && !sh.classList.contains('open');
  if (sh) sh.classList.toggle('open', !!open);
  if (sc) sc.classList.toggle('on', !!open);
}
function closeMoreSheet() {
  var sh = ge('more-sheet'), sc = ge('sheet-scrim');
  if (sh) sh.classList.remove('open');
  if (sc) sc.classList.remove('on');
}

// ── Notifications (collapsible dashboard row) ──
var _notifOpen = false;
var _notifSeen = 0;
export function notifState() {
  return { open: _notifOpen, unread: Math.max(0, G.logs.length - _notifSeen) };
}
export function toggleNotif() {
  _notifOpen = !_notifOpen;
  if (_notifOpen) _notifSeen = G.logs.length;
  if (SetupState.ACTIVE_VIEW === 'dashboard' && _views.renderDashboard) _views.renderDashboard();
}

// ── Team abbreviation marker (BBGM-style: plain text, no colored circles) ──
var LOGO_COLORS = ['#0a4fc4', '#1e8e3e', '#d32f2f', '#6d3fc0', '#e67e22', '#0e7c7b', '#b7791f', '#c2185b'];
export function teamColor(name) {
  var h = 0, s = String(name || '?');
  for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return LOGO_COLORS[h % LOGO_COLORS.length];
}
export function teamInitial(name) {
  return (String(name || '?').trim().charAt(0) || '?').toUpperCase();
}
export function teamLogo(name, cls) {
  return '<span class="team-logo' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + teamAbbr(name) + '</span>';
}
export function teamAbbr(name) {
  return String(name || '???').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || '???';
}

// ═══════════════════════════════════════════════════════════
//  MAIN UPDATE — ONE render path per action
// ═══════════════════════════════════════════════════════════

export function updateAll() {
  if (!G.teams.length) return;

  // Reveal the app shell on first render. #app starts display:none in CSS and
  // the setup/continue paths hide the wizard without ever showing it —
  // without this the game renders into a hidden shell (white screen).
  var _app = ge('app');
  if (_app && _app.style.display !== 'block') _app.style.display = 'block';

  var t = G.teams[G.tid];

  var rank = userRank();
  checkMilestones(rank);

  // Topbar
  txt('tb-rec', fR(t.wins, t.loss));
  txt('tb-yr', G.yr);
  txt('nil-balance', G.pts || 0);
  var phases = { reg: 'Regular season', conf_tourn: 'Conf. tournament', ncaa: 'NCAA tournament', offseason: 'Offseason' };
  txt('tb-phase', phases[G.phase] || 'Preseason');
  updateMatchupChip();
  updateAdvanceBtn();

  _prevRank = rank;
  refreshView(); // single render path — no double renders
}

// Top bar: just your record. (The next opponent lives on the home screen.)
function updateMatchupChip() {
  var t = G.teams[G.tid];
  txt('tb-wk', fR(t.wins, t.loss));
  txt('tb-opp', '');
}

// ═══════════════════════════════════════════════════════════
//  ADVANCE BUTTON — context-aware primary action
// ═══════════════════════════════════════════════════════════

export function updateAdvanceBtn() {
  var btn = ge('advance-btn');
  if (!btn) return;
  var label = ge('advance-label');
  var t = G.teams[G.tid];
  var txtLbl = 'Continue';

  btn.classList.toggle('stop', !!SetupState.G_AUTO && G.phase !== 'offseason');
  if (SetupState.G_AUTO && G.phase !== 'offseason') {
    txtLbl = 'Simming…';
  } else if (G.phase === 'reg') {
    {
      var s = t.sched[G.gi];
      if (G.gi >= 30) txtLbl = 'Conf. tournament';
      else if (s && s.opp !== undefined && s.opp !== null && !s.played) {
        txtLbl = 'Sim game';
      } else txtLbl = 'Sim week';
    }
  } else if (G.phase === 'conf_tourn') {
    txtLbl = 'Play round';
  } else if (G.phase === 'ncaa') {
    txtLbl = 'Play round';
  } else if (G.phase === 'offseason') {
    if (G.offseasonStep === 'recap') txtLbl = 'Begin offseason';
    else if (G.offseasonStep === 'turnover') txtLbl = 'To recruiting';
    else if (G.offseasonStep === 'skillpoints') txtLbl = 'Finish';
    else if (G.offseasonStep === 'carousel') txtLbl = 'Continue';
    else if (G.offseasonStep === 'fired') txtLbl = 'Continue';
    else if (G.recruitPhase >= 3) txtLbl = 'Start season';
    else txtLbl = 'Continue';
  }
  if (label) label.textContent = txtLbl;
  buildAdvanceMenu();
}

function playOpt(label, sub, mode) {
  return '<button class="play-opt" role="menuitem" data-action="play" data-mode="' + mode + '">'
    + '<span>' + label + '</span><span class="play-opt-sub">' + sub + '</span></button>';
}

export function buildAdvanceMenu() {
  var dd = ge('play-dropdown');
  if (!dd) return;
  var h = '';
  if (SetupState.G_AUTO && (G.phase === 'reg' || G.phase === 'conf_tourn' || G.phase === 'ncaa')) {
    h += playOpt('Stop simming', 'Pause after the current game', 'stop');
  } else if (G.phase === 'reg') {
    h += playOpt('Sim game', 'Instant result', 'quick');
    h += playOpt('Watch game', 'Play by play', 'live');
    h += '<div class="play-sep"></div>';
    h += playOpt('Sim to end of regular season', 'Stops before the conference tournament', 'sim-reg');
    h += playOpt('Sim through conference tournament', 'Stops at Selection Sunday', 'sim-conf');
    h += playOpt('Sim through end of season', 'Stops at the offseason', 'sim-season');
  } else if (G.phase === 'conf_tourn' || G.phase === 'ncaa') {
    h += playOpt('Sim game', 'Instant result', 'quick');
    h += playOpt('Watch game', 'Play by play', 'live');
    h += '<div class="play-sep"></div>';
    if (G.phase === 'conf_tourn') h += playOpt('Sim through conference tournament', 'Stops at Selection Sunday', 'sim-conf');
    h += playOpt('Sim through end of season', 'Stops at the offseason', 'sim-season');
  } else {
    var stepLbl = 'Advance', stepSub = 'Move to the next step';
    if (G.offseasonStep === 'recap') { stepLbl = 'Begin offseason'; stepSub = 'Review departures, then recruit'; }
    else if (G.offseasonStep === 'turnover') { stepLbl = 'Proceed to recruiting'; stepSub = 'Review departures, then recruit'; }
    else if (G.offseasonStep === 'skillpoints') { stepLbl = 'Finish skill points'; stepSub = 'Lock in coach upgrades'; }
    else if (G.offseasonStep === 'carousel') { stepLbl = 'Continue'; stepSub = 'Stay or take a new job'; }
    else if (G.offseasonStep === 'fired') { stepLbl = 'Continue'; stepSub = 'Find your next job'; }
    else if (G.recruitPhase >= 3) { stepLbl = 'Finalize class & start season'; stepSub = 'Resolve recruits, advance the year'; }
    else { stepLbl = 'Advance recruiting'; stepSub = 'Resolve this signing period'; }
    h += playOpt(stepLbl, stepSub, 'advance');
  }
  dd.innerHTML = h;
}

export function togglePlayMenu() {
  var dd = ge('play-dropdown');
  var btn = ge('advance-btn');
  if (!dd) return;
  dd.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
}

// ═══════════════════════════════════════════════════════════
//  EVENT DELEGATION — one document-level click handler
// ═══════════════════════════════════════════════════════════

function handleAction(el) {
  var a = el.getAttribute('data-action');
  if (!a) return;
  switch (a) {
    case 'nav':
      navTo(el.getAttribute('data-view'));
      break;
    case 'advance-menu':
      togglePlayMenu();
      break;
    case 'play': {
      var dd = ge('play-dropdown');
      if (dd) { dd.classList.remove('open'); }
      var btn = ge('advance-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (_actions.doPlay) _actions.doPlay(el.getAttribute('data-mode'));
      break;
    }
    case 'skip':
      skipGame();
      break;
    case 'gcast-tab':
      switchGcastTab(el.getAttribute('data-tab'));
      break;
    case 'more':
      toggleMoreSheet();
      break;
    case 'notif-toggle':
      toggleNotif();
      break;
    case 'nil-buy':
      buyBoost(el.getAttribute('data-item'), el);
      break;
    case 'fac-up':
      (function() {
        var r = upgradeFacility(el.getAttribute('data-fac'));
        toast(r.ok ? 'Upgraded to level ' + r.level + ' (' + r.cost + ' NIL)' : r.msg);
        if (r.ok) { saveState(); updateAll(); }
      })();
      break;
    case 'new-dynasty-start':
      if (window.startNewDynasty) window.startNewDynasty();
      break;
    case 'load-play':
      if (window.loadAndPlay) window.loadAndPlay();
      break;
    case 'delete-save':
      if (window.deleteFromHome) window.deleteFromHome();
      break;
    case 'new-dynasty':
      if (window.newDynasty) window.newDynasty();
      break;
    case 'build-ncaa':
      if (window.buildNCAA) window.buildNCAA();
      break;
    case 'end-season':
      if (window.endSeason) window.endSeason();
      break;
    case 'begin-offseason':
      if (window.beginOffseason) window.beginOffseason();
      break;
  }
}

export function initOutsideClickHandlers() {
  document.addEventListener('click', function(e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (el) { handleAction(el); return; }
    // Outside click closes the advance menu
    var dd = ge('play-dropdown'), btn = ge('advance-btn');
    if (dd && dd.classList.contains('open') && btn && !btn.contains(e.target)) {
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  // Keyboard support for role=button divs
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute) {
      var role = e.target.getAttribute('role');
      var act = e.target.getAttribute('data-action');
      if (role === 'button' && act) { e.preventDefault(); handleAction(e.target); }
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  NIL BOOST SHOP — spend G.pts on weekly boosts
//  Items mirror existing mechanics so the sim already
//  understands them (sellout = G.nextHomeBonus, chemistry
//  and recovery = G.buffs entries, same shape as events.js).
// ═══════════════════════════════════════════════════════════

export var NIL_SHOP = [
  { id: 'sellout', name: 'Sellout Crowd', desc: 'Next home game gets a +3 edge.', cost: 80 },
  { id: 'film', name: 'Film Session', desc: 'Team-wide +2 to shooting, finishing & defense for 2 games.', cost: 50 },
  { id: 'recovery', name: 'Recovery Session', desc: 'Clears every slump and negative effect on the roster.', cost: 60 }
];

var _shopWeek = -1;
var _shopBought = {};

export function shopBoughtThisWeek() {
  if (_shopWeek !== G.gi) { _shopWeek = G.gi; _shopBought = {}; }
  return _shopBought;
}

export function buyBoost(itemId, btnEl) {
  var item = null;
  NIL_SHOP.forEach(function(x) { if (x.id === itemId) item = x; });
  if (!item) return;
  var bought = shopBoughtThisWeek();
  if (bought[itemId]) { toast('Already used this week.', 'var(--txt3)'); return; }
  if ((G.pts || 0) < item.cost) { toast('Not enough NIL points.', 'var(--red)'); return; }
  var t = G.teams[G.tid];
  if (!t) return;

  if (itemId === 'sellout') {
    G.nextHomeBonus = 3; // consumed by simGame for the user's next home game
    addLog('ev', G.gi, '<b>Sellout crowd</b> bought with NIL funds — +3 edge for the next home game.');
  } else if (itemId === 'film') {
    t.rost.forEach(function(p) {
      if (p.mins > 0) {
        p.sht = clamp(p.sht + 2, 30, 99);
        p.fin = clamp(p.fin + 2, 30, 99);
        p.def = clamp(p.def + 2, 30, 99);
      }
    });
    if (!G.buffs) G.buffs = [];
    G.buffs.push({ playerName: 'TEAM', attr: 'all', mod: 2, gamesLeft: 2 });
    addLog('ev', G.gi, '<b>Film session</b> — all attributes +2 for 2 games.');
  } else if (itemId === 'recovery') {
    var cleared = 0;
    if (G.buffs) {
      for (var i = G.buffs.length - 1; i >= 0; i--) {
        var bf = G.buffs[i];
        if (bf.mod < 0) {
          // Reverse the applied mod (mirrors events.js expiry logic)
          if (bf.playerName === 'TEAM') {
            t.rost.forEach(function(p) { if (p.mins > 0) { p.sht -= bf.mod; p.fin -= bf.mod; p.def -= bf.mod; } });
          } else {
            t.rost.forEach(function(p) { if (p.name === bf.playerName && bf.attr) p[bf.attr] = clamp((p[bf.attr] || 70) - bf.mod, 30, 99); });
          }
          G.buffs.splice(i, 1);
          cleared++;
        }
      }
    }
    if (!cleared) { toast('No negative effects to clear.', 'var(--txt3)'); return; }
    addLog('ev', G.gi, '<b>Recovery session</b> — cleared ' + cleared + ' negative effect' + (cleared > 1 ? 's' : '') + '.');
  }

  G.pts -= item.cost;
  noteSpend('boosts', item.cost);
  bought[itemId] = true;
  toast(item.name + ' activated', 'var(--grn)');
  saveState();
  updateAll(); // single refresh path — updates NIL balance + shop state
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  GAMECAST — Live game view (WATCH-ONLY, per jack)
//  Campus Dynasty pattern: matchup header, team rows with
//  circular logos and big scores, Gamecast / Team Stats /
//  Box Score tabs, speed slider, timestamped feed with
//  running score, big blue Sim Game button pinned at bottom.
//  All strategy happens BEFORE the game (Strategy screen).
// ═══════════════════════════════════════════════════════════

export function openModal(tH, tA, isTournament, roundName) {
  if (G.simInterval) { clearInterval(G.simInterval); G.simInterval = null; }
  var panel = ge('gmod').querySelector('.gpanel');
  if (panel) {
    var overlays = panel.querySelectorAll('div[style*="position:absolute"], div[style*="position: absolute"]');
    for (var oi = 0; oi < overlays.length; oi++) panel.removeChild(overlays[oi]);
  }
  LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0;
  LS.h1 = null; LS.a1 = null; LS.poss = 'A';
  if (typeof LS.possCount !== 'undefined') LS.possCount = 0;

  // Box-score snapshots: per-game deltas = live p.s minus snapshot.
  // Pure presentation — no sim changes.
  LS._boxSnap = {
    h: tH.rost.map(function(p) { return Object.assign({}, p.s); }),
    a: tA.rost.map(function(p) { return Object.assign({}, p.s); })
  };

  ge('gmod').classList.add('open');
  txt('gmod-title', teamAbbr(tA.name) + ' vs. ' + teamAbbr(tH.name) + (roundName ? '  ·  ' + roundName : ''));

  var ae = ge('sb-away'), he = ge('sb-home');
  ae.textContent = tA.name + (isTournament && tA._seed ? '  #' + tA._seed : '');
  ae.className = 'gc-name' + (tA.id === G.tid ? ' u' : '');
  he.textContent = tH.name + (isTournament && tH._seed ? '  #' + tH._seed : '');
  he.className = 'gc-name' + (tH.id === G.tid ? ' u' : '');
  var la = ge('gc-logo-a'), lh = ge('gc-logo-h');
  if (la) { la.textContent = teamAbbr(tA.name); }
  if (lh) { lh.textContent = teamAbbr(tH.name); }
  txt('gc-score-a', '0'); txt('gc-score-h', '0');
  txt('sb-clk', '20:00'); txt('sb-per', 'Half 1');

  switchGcastTab('cast');
  var log = ge('pbplog');
  if (log) log.innerHTML = pbpRow('20:00', 'Jump ball.', '0-0', '');

  var spd = ge('spd');
  function startInterval() {
    if (G.simInterval) clearInterval(G.simInterval);
    var v = parseInt(spd ? spd.value : 3);
    var delay = [600, 300, 150, 70, 25][v - 1];
    var plays = v >= 4 ? 3 : 1;
    G.simInterval = setInterval(function() {
      for (var i = 0; i < plays; i++) {
        if (!stepSim()) { clearInterval(G.simInterval); G.simInterval = null; finalizeModal(); return; }
      }
    }, delay);
  }
  if (spd) spd.oninput = function() {
    var labs = ['Slow', 'Slow', 'Med', 'Fast', 'Max'];
    txt('spd-v', labs[parseInt(spd.value) - 1]);
    startInterval();
  };
  startInterval();
}

// ── Feed row: timestamp | play text | running score ──────
function pbpRow(ts, text, score, cls) {
  return '<div class="pbp-row' + (cls ? ' ' + cls : '') + '">'
    + '<span class="p-ts">' + ts + '</span>'
    + '<span class="p-tx">' + text + '</span>'
    + '<span class="p-sc">' + score + '</span></div>';
}

// ── Gamecast tabs ───────────────────────────────────────
export function switchGcastTab(tab) {
  var tabs = document.querySelectorAll ? document.querySelectorAll('.gc-tab') : [];
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === tab);
  }
  ['cast', 'team', 'box'].forEach(function(k) {
    var p = ge('gc-pane-' + k);
    if (p) p.classList.toggle('on', k === tab);
  });
  if (tab === 'team') renderGcastTeam();
  if (tab === 'box') renderGcastBox();
}

function boxDeltas(team, snap) {
  var out = [];
  team.rost.forEach(function(p, i) {
    var s0 = (snap && snap[i]) || {};
    var d = function(k) { return (p.s[k] || 0) - (s0[k] || 0); };
    out.push({ p: p, pts: d('pts'), reb: d('reb'), ast: d('ast'), fgm: d('fgm'), fga: d('fga'), stl: d('stl'), blk: d('blk') });
  });
  return out;
}

function renderGcastTeam() {
  var el = ge('gc-pane-team');
  if (!el || !LS._boxSnap) return;
  function totals(team, snap) {
    var t = { pts: 0, fgm: 0, fga: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
    boxDeltas(team, snap).forEach(function(r) {
      t.pts += r.pts; t.fgm += r.fgm; t.fga += r.fga;
      t.reb += r.reb; t.ast += r.ast; t.stl += r.stl; t.blk += r.blk;
    });
    return t;
  }
  var a = totals(LS.tA, LS._boxSnap.a), h = totals(LS.tH, LS._boxSnap.h);
  function fg(t) { return t.fga > 0 ? (t.fgm / t.fga * 100).toFixed(1) + '%' : '--'; }
  var rows = [
    ['PTS', a.pts, h.pts], ['FG', a.fgm + '/' + a.fga, h.fgm + '/' + h.fga],
    ['FG%', fg(a), fg(h)], ['REB', a.reb, h.reb], ['AST', a.ast, h.ast],
    ['STL', a.stl, h.stl], ['BLK', a.blk, h.blk]
  ];
  var html = '<table><thead><tr><th></th><th class="num">' + teamAbbr(LS.tA.name) + '</th>'
    + '<th class="num">' + teamAbbr(LS.tH.name) + '</th></tr></thead><tbody>';
  rows.forEach(function(r) {
    html += '<tr><td class="pt-sub">' + r[0] + '</td>'
      + '<td class="num">' + r[1] + '</td>'
      + '<td class="num">' + r[2] + '</td></tr>';
  });
  el.innerHTML = html + '</tbody></table>';
}

function renderGcastBox() {
  var el = ge('gc-pane-box');
  if (!el || !LS._boxSnap) return;
  function teamTable(team, snap) {
    var rows = boxDeltas(team, snap)
      .filter(function(r) { return r.p.mins > 0; })
      .sort(function(x, y) { return y.pts - x.pts; });
    var html = '<div class="box-team">' + teamLogo(team.name, 'sm')
      + '<span>' + team.name + '</span></div>'
      + '<table><thead><tr><th>Player</th><th class="num">PTS</th>'
      + '<th class="num">REB</th><th class="num">AST</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      html += '<tr><td>' + r.p.name + ' <span class="pt-sub">' + r.p.pos + '</span></td>'
        + '<td class="num">' + r.pts + '</td>'
        + '<td class="num">' + r.reb + '</td>'
        + '<td class="num">' + r.ast + '</td></tr>';
    });
    return html + '</tbody></table>';
  }
  el.innerHTML = teamTable(LS.tA, LS._boxSnap.a) + teamTable(LS.tH, LS._boxSnap.h);
}

function refreshGcastTabs() {
  var tp = ge('gc-pane-team'), bp = ge('gc-pane-box');
  if (tp && tp.classList.contains('on')) renderGcastTeam();
  if (bp && bp.classList.contains('on')) renderGcastBox();
}

// ── Step Sim (one possession tick) ───────────────────────
export function stepSim() {
  if (LS.clock <= 0) {
    if (LS.half === 1) {
      LS.h1 = LS.hs; LS.a1 = LS.as; LS.half = 2; LS.clock = 1200;
      txt('sb-per', 'Half 2');
      G.momentum = { tid: -1, pts: 0 };
      var log = ge('pbplog');
      if (log) log.innerHTML = '<div class="pbp-banner">── Halftime ──</div>' + log.innerHTML;
      return true;
    } else if (LS.half === 2) {
      if (LS.hs === LS.as) { LS.half = 3; LS.clock = 300; txt('sb-per', 'OT'); return true; }
      return false;
    } else {
      if (LS.hs === LS.as) { LS.clock = 300; return true; }
      return false;
    }
  }

  var offT = LS.poss === 'H' ? LS.tH : LS.tA;
  var defT = LS.poss === 'H' ? LS.tA : LS.tH;
  if (typeof LS.possCount !== 'number') LS.possCount = 0;
  LS.possCount++;
  var res = simPoss(offT, defT);
  LS.clock -= Math.max(1, res.time);
  if (LS.poss === 'H') LS.hs += res.pts; else LS.as += res.pts;
  LS.poss = LS.poss === 'H' ? 'A' : 'H';
  var m = Math.max(0, Math.floor(LS.clock / 60));
  var s = ('0' + Math.max(0, LS.clock % 60)).slice(-2);
  var ts = m + ':' + s;
  var score = LS.as + '-' + LS.hs;
  txt('gc-score-a', String(LS.as));
  txt('gc-score-h', String(LS.hs));
  txt('sb-clk', ts);

  if (res.pbp) {
    var logEl = ge('pbplog');
    if (logEl) {
      var entry = '';
      if (res.run) {
        entry += '<div class="pbp-banner' + (res.run.isUser ? ' run-user' : ' run-opp') + '">' + res.run.text + '</div>';
      }
      entry += pbpRow(ts, res.pbp, score, res.big ? 'big' : (res.type === 'turn' || res.type === 'block' ? 'bad' : ''));
      if (logEl.childNodes && logEl.childNodes.length > 220) {
        while (logEl.childNodes.length > 220) logEl.removeChild(logEl.lastChild);
      }
      logEl.innerHTML = entry + logEl.innerHTML;
    }
    refreshGcastTabs();
  }
  return true;
}

// ── Skip Game ────────────────────────────────────────────
// LOGIC FIX (M4) — preserve in UI rebuild: snapshot/restore full stat objects
export function skipGame() {
  if (G.simInterval) { clearInterval(G.simInterval); G.simInterval = null; }
  // M4 FIX: snapshot FULL stat objects (not just GP) before simGame, then
  // restore them after. simGame sims a complete game on top of the partial
  // live-sim stats already accumulated; without this every stat
  // (pts/reb/ast/...) double-counts. Index-keyed, not name-keyed, so duplicate
  // player names can't collide. Object identity is preserved for the UI rebuild.
  function snapStats(team) {
    return team.rost.map(function(p) { return JSON.parse(JSON.stringify(p.s)); });
  }
  function restoreStats(team, snap) {
    team.rost.forEach(function(p, i) {
      var cur = p.s, sv = snap[i];
      Object.keys(cur).forEach(function(k) { delete cur[k]; });
      Object.keys(sv).forEach(function(k) { cur[k] = sv[k]; });
    });
  }
  var hSnap = snapStats(LS.tH), aSnap = snapStats(LS.tA);
  var res = simGame(LS.tH, LS.tA, LS.game.home);
  restoreStats(LS.tH, hSnap);
  restoreStats(LS.tA, aSnap);
  LS.hs = res.homeScore; LS.as = res.awayScore;
  finalizeModal();
}

// ── Finalize Modal ───────────────────────────────────────
export function finalizeModal() {
  if (G.simInterval) { clearInterval(G.simInterval); G.simInterval = null; }
  txt('sb-clk', 'Final');
  renderGcastTeam();
  renderGcastBox();

  if ((G.phase === 'conf_tourn' && LS.game && LS.game._type === 'conf') ||
      (G.phase === 'ncaa' && LS.game && LS.game._type === 'ncaa')) {
    if (_actions.showTournamentResult) _actions.showTournamentResult();
  } else {
    ge('gmod').classList.remove('open');
    if (_actions.recordResult) _actions.recordResult();
    if (_actions.simCPUWeek) _actions.simCPUWeek();
    if (_actions.advanceWeek) _actions.advanceWeek();
  }
}
