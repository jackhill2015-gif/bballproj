// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/setup.js
//  Coach career setup: name → difficulty → job offers → start
//  Re-skinned into the Campus Dynasty design system.
//  Mobile-first: everything stacks vertically; the job grid
//  goes two-column only on wide screens. All setup flow
//  logic (prestige init, NC auto-gen, dynasty start) is
//  preserved with identical names/signatures.
// ═══════════════════════════════════════════════════════════

import { DIFF_DESC, calcSchoolPrestige, calcExpectations, ALL_TEAMS, teamsFor } from '../constants.js';
import { ri, ge, txt, getTier, getTOvr, fR } from '../utils.js';
import { G, SetupState, loadState, deleteSave, saveState } from '../state.js';
import { SLOTS, readSlot, removeSlot, activeSlot, setActiveSlot, storageMode, flushWrites } from '../storage.js';
import { buildSchedules, genRecruits, buildUniverse, setupUserOOC, pickBalancedOOC } from '../season.js';
import * as Acq from './acq.js';
import { teamLogo } from '../ui.js';

var _ext = { addLog: null, updateAll: null };
export function registerSetupCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }


var STEPS = [
  { id: 'coach-name', label: 'Coach' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'job-offers', label: 'Job' },
  { id: 'nc-schedule', label: 'Schedule' }
];

function stepHeader(title, sub) {
  var h = '<div class="setup-steps" aria-hidden="true">';
  var curIdx = 0;
  STEPS.forEach(function(s, i) { if (s.id === _currentStep) curIdx = i; });
  STEPS.forEach(function(s, i) {
    h += '<div class="setup-step' + (i <= curIdx ? ' on' : '') + '"><div class="sdot"></div><div class="slbl">' + s.label + '</div></div>';
  });
  h += '</div>';
  h += '<div class="setup-hero">'
    + '<div class="setup-title">Hoops <em>OS</em></div>'
    + '<div class="sec-head">' + title + '</div>'
    + (sub ? '<div class="sec-sub">' + sub + '</div>' : '')
    + '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════════════════════════

var PHASE_NAMES = { reg: 'Regular season', conf_tourn: 'Conf tournament', ncaa: 'NCAA tournament', offseason: 'Offseason' };

function esc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// Home-card summary of a saved dynasty (team, season, record, coach), or
// null for an empty or unreadable slot
export function slotSummary(raw) {
  if (!raw) return null;
  try {
    var saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    var t = saved && saved.teams && saved.teams[saved.tid];
    if (!t) return null;
    // Saves store team results only; name/conference come from the team table
    var td = teamsFor(saved.align || 2025)[saved.tid] || {}; // the save's own conference alignment
    return {
      team: t.name || td.n || '---',
      conf: t.conf || td.c || '',
      coach: saved.coach ? (saved.coach.firstName + ' ' + saved.coach.lastName).trim() : 'Coach',
      phase: PHASE_NAMES[saved.phase] || 'Preseason',
      yr: saved.yr || 2026,
      season: saved.yr ? saved.yr - (saved.alignYr0 || 2025) + 1 : 1, // saves from before started in 2025
      record: fR(t.wins || 0, t.loss || 0),
      titles: (saved.championships || 0) + (saved.confTitles || 0)
    };
  } catch (e) { return null; }
}

function slotCard(n, sum) {
  var h = '<div class="home-save home-slot">'
    + '<div class="home-save-title">Slot ' + n + '</div>';
  if (!sum) {
    return h + '<div class="home-new home-slot-new" data-action="new-dynasty-start" data-slot="' + n + '" role="button" tabindex="0" aria-label="Start a new dynasty in slot ' + n + '">'
      + '<div class="home-new-icon">+</div>'
      + '<div><div class="home-new-label">New dynasty</div><div class="home-new-sub">Empty slot</div></div>'
      + '</div></div>';
  }
  return h + '<div class="home-dynasty-row">'
    + '<div class="home-dynasty-info">'
    + '<div class="home-dynasty-team">' + esc(sum.team) + '</div>'
    + '<div class="home-dynasty-meta">' + esc(sum.coach) + ' · ' + esc(sum.conf) + ' · ' + esc(sum.phase) + '</div>'
    + '<div class="home-dynasty-stats">'
    + '<div class="home-dynasty-stat"><div class="home-dynasty-stat-v">' + esc(sum.record) + '</div><div class="home-dynasty-stat-l">Record</div></div>'
    + '<div class="home-dynasty-stat"><div class="home-dynasty-stat-v">' + esc(sum.yr) + '</div><div class="home-dynasty-stat-l">Year</div></div>'
    + '<div class="home-dynasty-stat"><div class="home-dynasty-stat-v">' + esc(sum.season) + '</div><div class="home-dynasty-stat-l">Season</div></div>'
    + '<div class="home-dynasty-stat"><div class="home-dynasty-stat-v">' + esc(sum.titles) + '</div><div class="home-dynasty-stat-l">Titles</div></div>'
    + '</div></div>'
    + '<div class="home-play-btn" data-action="load-play" data-slot="' + n + '" role="button" tabindex="0" aria-label="Continue ' + esc(sum.team) + '">Continue</div>'
    + '</div>'
    + '<div class="home-delete">'
    + '<button class="btn-quiet" data-action="backup" data-slot="' + n + '">Back up</button>'
    + '<button class="home-delete-btn" data-action="delete-save" data-slot="' + n + '">Delete</button>'
    + '</div></div>';
}

export function showHomeScreen() {
  // Reveal first: if a storage read throws below (blocked storage in some
  // browsers/WebViews), the home screen must still appear — never white-screen.
  var hs = ge('home-screen'); if (hs) hs.style.display = 'flex';
  ge('setup').style.display = 'none';
  var html = '';
  SLOTS.forEach(function(n) {
    var sum = null;
    try { sum = slotSummary(readSlot(n)); } catch (e) { console.error('Home screen load error', e); }
    html += slotCard(n, sum);
  });
  var el = ge('home-slots'); if (el) el.innerHTML = html;
  var note = ge('home-storage-note');
  if (note) note.hidden = storageMode().reason !== 'unavailable';
}

export function loadAndPlay(slot) {
  if (slot) setActiveSlot(slot);
  var hs = ge('home-screen'); if (hs) hs.style.display = 'none';
  buildUniverse();
  var loaded = loadState();
  if (loaded) {
    // S9: prestige must survive the continue path — default it if missing/NaN
    if (typeof G.prestige !== 'number' || isNaN(G.prestige)) {
      var _pt = G.teams[G.tid];
      G.prestige = Math.max(1, Math.round(((_pt && _pt.schoolPrestige) || 50) / 20));
    }
    // R4: a fired coach can never resume at the old school — bounce a stale
    // save (fired, but past the carousel without a new job) back to the carousel
    var _ch = (G.coach && G.coach.history && G.coach.history.length) ? G.coach.history[G.coach.history.length - 1] : null;
    if (_ch && _ch.action === 'Fired' &&
        (G.offseasonStep === 'turnover' || G.offseasonStep === 'retention' || G.offseasonStep === 'portal' || G.offseasonStep === 'signed' || G.offseasonStep === 'schedule' ||
         G.offseasonStep === 'recruiting' || G.offseasonStep === 'skillpoints')) {
      G.offseasonStep = 'carousel';
    }
    updateAll();
  }
}

export function startNewDynasty(slot) {
  if (slot) setActiveSlot(slot);
  var hs = ge('home-screen'); if (hs) hs.style.display = 'none';
  ge('setup').style.display = 'flex';
  showStep('coach-name');
}

export function deleteFromHome(slot) {
  slot = slot || activeSlot();
  var sum = slotSummary(readSlot(slot));
  if (!sum) return;
  if (confirm('Delete the ' + sum.team + ' dynasty in slot ' + slot + '? This cannot be undone.')) {
    removeSlot(slot);
    showHomeScreen();
  }
}

export function newDynasty() {
  if (confirm('Delete your entire dynasty? This cannot be undone.')) {
    deleteSave();
    flushWrites().then(function() { location.reload(); });
  }
}

// ═══════════════════════════════════════════════════════════
//  SETUP WIZARD — Step management
// ═══════════════════════════════════════════════════════════

var _currentStep = 'coach-name';
var _jobOffers = [];

function showStep(step) {
  _currentStep = step;
  var el = ge('setup-content');
  if (!el) return;

  if (step === 'coach-name') el.innerHTML = renderCoachName();
  else if (step === 'difficulty') el.innerHTML = renderDifficulty();
  else if (step === 'job-offers') el.innerHTML = renderJobOffers();
  else if (step === 'nc-schedule') el.innerHTML = renderNCSchedule();
  bindSetup(el);
}

// Container-level delegation: no inline onclick strings.
function bindSetup(el) {
  el.onclick = function(e) {
    var q = function(sel) { return e.target.closest ? e.target.closest(sel) : null; };
    var m;
    if (q('[data-setup="coach-name-submit"]')) { submitCoachName(); return; }
    if (q('[data-setup="diff-submit"]')) { submitDifficulty(); return; }
    if ((m = q('[data-diff]'))) { setDiff(m.getAttribute('data-diff')); return; }
    if ((m = q('[data-job]'))) { selectJob(parseInt(m.getAttribute('data-job'), 10)); return; }
    if (q('[data-setup="back-jobs"]')) { goBackToJobs(); return; }
    if (q('[data-setup="start-dynasty"]')) { startDynasty(); return; }
    if (q('[data-setup="nc-auto"]')) { autoGenNC(); showStep('nc-schedule'); return; }
    if ((m = q('[data-swapnc]'))) { swapNC(parseInt(m.getAttribute('data-swapnc'), 10)); return; }
  };
  el.onkeydown = function(e) {
    if (e.key === 'Enter' && _currentStep === 'coach-name') {
      var t = e.target;
      if (t && (t.id === 'coach-first' || t.id === 'coach-last')) { e.preventDefault(); submitCoachName(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && _currentStep === 'job-offers') {
      var r = e.target.closest ? e.target.closest('tr[data-job]') : null;
      if (r) { e.preventDefault(); selectJob(parseInt(r.getAttribute('data-job'), 10)); }
    }
  };
}

// ═══════════════════════════════════════════════════════════
//  STEP 1: Coach Name
// ═══════════════════════════════════════════════════════════

function renderCoachName() {
  return '<div class="setup-wrap">'
    + stepHeader('Create your coach', 'Your legacy starts on the sideline.')
    + '<div class="panel"><div class="panel-h"><span>Name</span></div><div class="panel-b">'
    + '<div style="margin-bottom:12px;"><div class="field-label">First name</div>'
    + '<input id="coach-first" class="setup-input" type="text" placeholder="John" maxlength="20" autocomplete="off"></div>'
    + '<div style="margin-bottom:16px;"><div class="field-label">Last name</div>'
    + '<input id="coach-last" class="setup-input" type="text" placeholder="Smith" maxlength="20" autocomplete="off"></div>'
    + '<button class="btn-big btn-full" data-setup="coach-name-submit">Continue</button>'
    + '</div></div></div>';
}

export function submitCoachName() {
  var first = (ge('coach-first') || {}).value || '';
  var last = (ge('coach-last') || {}).value || '';
  first = first.trim(); last = last.trim();
  if (!first || !last) { alert('Please enter your first and last name.'); return; }
  G.coach.firstName = first;
  G.coach.lastName = last;
  G.coach.age = 30;
  G.coach.off = 70; G.coach.def = 70; G.coach.dev = 70; G.coach.rec = 70;
  G.coach.careerWins = 0; G.coach.careerLoss = 0;
  G.coach.tenure = 0; G.coach.hotSeat = false;
  G.coach.titles = 0; G.coach.confTitles = 0; G.coach.finalFours = 0; G.coach.tourneyApps = 0;
  G.coach.awards = []; G.coach.history = [];
  showStep('difficulty');
}
window.submitCoachName = submitCoachName;

// ═══════════════════════════════════════════════════════════
//  STEP 2: Difficulty (Strategy-screen scheme-row rhythm)
// ═══════════════════════════════════════════════════════════

function renderDifficulty() {
  var h = '<div class="setup-wrap">'
    + stepHeader('Welcome, Coach ' + G.coach.lastName, 'Age 30 · first year on the sideline')
    + '<div class="panel"><div class="panel-h"><span>Difficulty</span></div><div class="panel-b">';
  ['easy', 'normal', 'hard', 'legend'].forEach(function(key) {
    var on = SetupState.DIFF === key;
    var label = key.charAt(0).toUpperCase() + key.slice(1);
    h += '<button class="scheme-row' + (on ? ' picked' : '') + '" data-diff="' + key + '" role="radio" aria-checked="' + on + '">'
      + '<span class="sm-body"><span class="sm-name">' + label + '</span>'
      + '<span class="sm-desc" style="display:block;">' + DIFF_DESC[key] + '</span></span>'
      + '<span class="scheme-check">' + (on ? '✓' : '') + '</span></button>';
  });
  h += '<button class="btn-big btn-full" style="margin-top:14px;" data-setup="diff-submit">Find a job</button>'
    + '</div></div></div>';
  return h;
}

export function setDiff(d) {
  SetupState.DIFF = d;
  showStep('difficulty');
}
window.setDiff = setDiff;

export function submitDifficulty() {
  G.difficulty = SetupState.DIFF;
  // Build universe first so we have teams to offer
  buildUniverse();
  generateJobOffers();
  showStep('job-offers');
}
window.submitDifficulty = submitDifficulty;

// ═══════════════════════════════════════════════════════════
//  STEP 3: Job Offers (20 low-tier schools)
// ═══════════════════════════════════════════════════════════

function generateJobOffers() {
  // For a new coach, offer only low-tier schools (prestige < 50)
  var eligible = G.teams.filter(function(t) { return t.schoolPrestige <= 50; });
  // Shuffle
  for (var i = eligible.length - 1; i > 0; i--) {
    var j = ri(0, i); var tmp = eligible[i]; eligible[i] = eligible[j]; eligible[j] = tmp;
  }
  _jobOffers = eligible.slice(0, 20);
}

function renderJobOffers() {
  var h = '<div class="setup-wrap" style="max-width:720px;">'
    + stepHeader('Job offers', 'As a first-year coach, these programs will take a chance on you.')
    + '<div class="panel"><div class="panel-h"><span>Open positions</span><small>' + _jobOffers.length + ' programs</small></div>'
    + '<div class="panel-b flush"><div class="tbl-wrap"><table>'
    + '<thead><tr><th></th><th>Program</th><th class="num">OVR</th><th class="num">Prestige</th></tr></thead><tbody>';
  _jobOffers.forEach(function(t) {
    var tier = getTier(t.baseOvr);
    h += '<tr data-job="' + t.id + '" tabindex="0" role="button" aria-label="Take the job at ' + t.name + '" style="cursor:pointer;">'
      + '<td>' + teamLogo(t.name, 'sm') + '</td>'
      + '<td><div>' + t.name + '</div><div class="pt-sub">' + t.conf + ' · ' + tier.label + '</div></td>'
      + '<td class="num">' + getTOvr(t) + '</td>'
      + '<td class="num">' + t.schoolPrestige + '</td></tr>';
  });
  h += '</tbody></table></div></div></div></div>';
  return h;
}

export function selectJob(tid) {
  SetupState.SEL_TID = tid;
  G.tid = tid;
  G.coach.tenure = 0;

  // Replace NPC coach with user coach
  var t = G.teams[tid];
  t.coach = {
    firstName: G.coach.firstName,
    lastName: G.coach.lastName,
    age: G.coach.age,
    off: G.coach.off, def: G.coach.def, dev: G.coach.dev, rec: G.coach.rec,
    tenure: 0, isUser: true
  };

  // Set prestige on G for backward compat
  G.prestige = Math.max(1, Math.round(t.schoolPrestige / 20));

  buildSchedules();
  autoGenNC();
  showStep('nc-schedule');
}
window.selectJob = selectJob;

// ═══════════════════════════════════════════════════════════
//  STEP 4: NC Schedule
// ═══════════════════════════════════════════════════════════

// Same balanced slate and look as the yearly schedule picker
// (a few tough, mostly even, a few easier)
function autoGenNC() {
  SetupState.NC_PICKS = pickBalancedOOC();
}

function ncEdge(opp) {
  var d = getTOvr(opp) - getTOvr(G.teams[G.tid]);
  return d >= 4 ? { l: 'Tough', c: 'var(--red)' } : d >= -4 ? { l: 'Even', c: 'var(--gld2)' } : { l: 'Easier', c: 'var(--grn2)' };
}

function renderNCSchedule() {
  var t = G.teams[G.tid];
  var counts = { Tough: 0, Even: 0, Easier: 0 };
  SetupState.NC_PICKS.forEach(function(id) { if (G.teams[id]) counts[ncEdge(G.teams[id]).l]++; });
  var h = '<div class="setup-wrap" style="max-width:720px;">'
    + stepHeader(t.name, t.conf + ' · Prestige ' + t.schoolPrestige + ' · OVR ' + getTOvr(t))
    + Acq.header('Non-conference schedule', 'Season ' + G.yr + ' · 10 games before ' + t.conf + ' play',
      [{ v: counts.Tough, l: 'tough' }, { v: counts.Even, l: 'even' }, { v: counts.Easier, l: 'easier' }])
    + '<div class="acq-tool"><span class="sec-sub" style="margin:0;">Tap a game to swap the opponent.</span>'
    + '<button class="acq-filter-btn" style="margin-left:auto;" data-setup="nc-auto">Auto-pick again</button></div>'
    + '<div class="acq-list">';
  SetupState.NC_PICKS.forEach(function(id, i) {
    var opp = G.teams[id]; if (!opp) return;
    var e = ncEdge(opp);
    h += Acq.row({ open: 'data-swapnc="' + i + '"', name: opp.name,
      sub: (i % 2 === 0 ? 'Home' : 'Away') + ' · ' + opp.conf,
      big: getTOvr(opp), small: '<span style="color:' + e.c + ';">' + e.l + '</span>' });
  });
  h += '</div>'
    + '<div class="big-btn-row" style="margin-top:14px;">'
    + '<button class="btn-big secondary" data-setup="back-jobs">Back</button>'
    + '<button class="btn-big" data-setup="start-dynasty">Start season</button></div>'
    + '</div>';
  return h;
}

export function goBackToJobs() {
  showStep('job-offers');
}
window.goBackToJobs = goBackToJobs;

export function swapNC(idx) {
  var me = G.teams[G.tid], cur = G.teams[SetupState.NC_PICKS[idx]];
  var pool = G.teams.filter(function(t) {
    return t.conf !== me.conf && t.id !== G.tid && SetupState.NC_PICKS.indexOf(t.id) < 0;
  }).sort(function(a, b) { return getTOvr(b) - getTOvr(a); });
  var band = 'all', text = '';
  var overlay = document.createElement('div');
  overlay.className = 'nc-ov';
  overlay.innerHTML = '<div class="panel nc-ov-p" role="dialog" aria-label="Swap opponent">'
    + '<div class="panel-h"><span>Swap opponent</span><button class="btn-quiet" data-ov="close">Close</button></div>'
    + '<div class="nc-ov-top"><div class="pp-note" style="margin-bottom:8px;">Replacing ' + (cur ? '<b>' + cur.name + '</b>' : 'this game') + ' (' + (idx % 2 === 0 ? 'home' : 'away') + ').</div>'
    + '<input class="setup-input" data-ov="search" placeholder="Search schools or conferences" autocomplete="off" style="width:100%;margin-bottom:8px;">'
    + '<div class="fbar" data-ov="bands"></div></div>'
    + '<div class="acq-list nc-ov-list" data-ov="list"></div></div>';
  document.body.appendChild(overlay);
  var q = function(k) { return overlay.querySelector('[data-ov="' + k + '"]'); };
  function close() { if (overlay.parentNode) document.body.removeChild(overlay); }
  function draw() {
    q('bands').innerHTML = [['all', 'All'], ['Tough', 'Tough'], ['Even', 'Even'], ['Easier', 'Easier']].map(function(b) {
      return '<button class="fchip' + (band === b[0] ? ' on' : '') + '" data-band="' + b[0] + '">' + b[1] + '</button>';
    }).join('');
    q('list').innerHTML = pool.filter(function(t) {
      return (band === 'all' || ncEdge(t).l === band) && (!text || (t.name + ' ' + t.conf).toLowerCase().indexOf(text) >= 0);
    }).map(function(t) {
      var e = ncEdge(t);
      return '<div class="acq-row" data-pick="' + t.id + '" role="button" tabindex="0">'
        + '<div class="acq-main"><div class="acq-name">' + t.name + '</div><div class="acq-sub">' + t.conf + '</div></div>'
        + '<div class="acq-right"><div class="acq-big">' + getTOvr(t) + '</div><div class="acq-small" style="color:' + e.c + ';">' + e.l + '</div></div></div>';
    }).join('') || '<div class="empty-state">No schools match.</div>';
  }
  function pick(id) { SetupState.NC_PICKS[idx] = id; close(); showStep('nc-schedule'); }
  overlay.addEventListener('click', function(ev) {
    var el = ev.target;
    if (el === overlay || (el.closest && el.closest('[data-ov="close"]'))) { close(); return; }
    var b = el.closest && el.closest('[data-band]');
    if (b) { band = b.getAttribute('data-band'); draw(); return; }
    var r = el.closest && el.closest('[data-pick]');
    if (r) pick(parseInt(r.getAttribute('data-pick'), 10));
  });
  overlay.addEventListener('keydown', function(ev) {
    if (ev.key === 'Escape') { close(); return; }
    var r = ev.target.closest && ev.target.closest('[data-pick]');
    if (r && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pick(parseInt(r.getAttribute('data-pick'), 10)); }
  });
  q('search').addEventListener('input', function() { text = this.value.toLowerCase(); draw(); });
  draw();
}
window.swapNC = swapNC;

export function startDynasty() {
  if (SetupState.NC_PICKS.length < 10) autoGenNC();
  setupUserOOC();
  genRecruits();

  // Calculate season expectations
  var t = G.teams[G.tid];
  var confTeams = G.teams.filter(function(x) { return x.conf === t.conf; });
  var confAvgOvr = confTeams.reduce(function(s, x) { return s + getTOvr(x); }, 0) / (confTeams.length || 1);
  var _myO = getTOvr(t);
  G.expectations = calcExpectations(_myO, confAvgOvr, G.teams.filter(function(x) { return getTOvr(x) > _myO; }).length + 1);
  G.seasonAchievements = { confTitleThisYear: false, madeNCAA: false, sweet16: false, finalFour: false, champGame: false, natChamp: false };

  ge('setup').style.display = 'none';
  addLog('ev', 0, 'Coach ' + G.coach.lastName + ' takes over at <b>' + t.name + '</b>. Season ' + G.yr + ' begins. Expectations: ' + G.expectations.low + '-' + G.expectations.high + ' wins.');
  updateAll(); saveState();
}
window.startDynasty = startDynasty;

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS (kept for main.js compat)
// ═══════════════════════════════════════════════════════════
export function buildPicker() {}
export function togglePicker() {}
export function selectTeam(id) { selectJob(id); }
export function pickRandom() {}
export function goToStep2() {}
export function goToStep1() { goBackToJobs(); }
export function renderNCAutoList() {}
