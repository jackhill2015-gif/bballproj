// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/setup.js
//  Coach career setup: name → difficulty → job offers → start
//  Re-skinned into the Campus Dynasty design system.
//  Mobile-first: everything stacks vertically; the job grid
//  goes two-column only on wide screens. All setup flow
//  logic (prestige init, NC auto-gen, dynasty start) is
//  preserved with identical names/signatures.
// ═══════════════════════════════════════════════════════════

import { DIFF_DESC, calcSchoolPrestige, calcExpectations, ALL_TEAMS } from '../constants.js';
import { ri, ge, txt, getTier, getTOvr, fR } from '../utils.js';
import { G, SetupState, loadState, deleteSave, saveState } from '../state.js';
import { buildSchedules, genRecruits, buildUniverse, setupUserOOC } from '../season.js';
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

export function showHomeScreen() {
  // Reveal first: if a storage read throws below (blocked storage in some
  // browsers/WebViews), the home screen must still appear — never white-screen.
  var hs = ge('home-screen'); if (hs) hs.style.display = 'flex';
  ge('setup').style.display = 'none';
  var raw = null;
  try { raw = localStorage.getItem('hoops_os_v3'); } catch (e) { raw = null; }
  if (raw) {
    try {
      var saved = JSON.parse(raw);
      var t = saved.teams && saved.teams[saved.tid];
      if (t) {
        // Saves store team results only; name/conference come from the team table
        var td = ALL_TEAMS[saved.tid] || {};
        t = Object.assign({ name: td.n, conf: td.c }, t);
        var coachName = saved.coach ? saved.coach.firstName + ' ' + saved.coach.lastName : 'Coach';
        txt('home-team-name', t.name || '---');
        var phases = { reg: 'Regular season', conf_tourn: 'Conf tournament', ncaa: 'NCAA tournament', offseason: 'Offseason' };
        var phaseStr = phases[saved.phase] || 'Preseason';
        var seasonNum = saved.yr ? saved.yr - 2024 : 1;
        txt('home-dynasty-meta', coachName + ' \u00b7 ' + (t.conf || '') + ' \u00b7 ' + phaseStr);
        txt('home-record', fR(t.wins, t.loss));
        txt('home-year', saved.yr || 2025);
        txt('home-seasons', seasonNum);
        txt('home-titles', (saved.championships || 0) + (saved.confTitles || 0));
        var slot = ge('home-save-slot'); if (slot) slot.style.display = 'block';
      }
    } catch (e) { console.error('Home screen load error', e); }
  }
}

export function loadAndPlay() {
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

export function startNewDynasty() {
  var hs = ge('home-screen'); if (hs) hs.style.display = 'none';
  ge('setup').style.display = 'flex';
  showStep('coach-name');
}

export function deleteFromHome() {
  if (confirm('Delete your dynasty? This cannot be undone.')) {
    deleteSave();
    var slot = ge('home-save-slot'); if (slot) slot.style.display = 'none';
    txt('home-team-name', '---');
  }
}

export function newDynasty() {
  if (confirm('Delete your entire dynasty? This cannot be undone.')) {
    deleteSave(); location.reload();
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

// (overall gaps sized for the v11 overall scale)
function autoGenNC() {
  var myOvr = getTOvr(G.teams[G.tid]);
  var pool = G.teams.filter(function(t) { return t.conf !== G.teams[G.tid].conf && t.id !== G.tid; });
  var tough = pool.filter(function(t) { return Math.abs(getTOvr(t) - myOvr) <= 6; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 3);
  var mid = pool.filter(function(t) { return getTOvr(t) >= myOvr - 11 && getTOvr(t) < myOvr + 4; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 4);
  var easy = pool.filter(function(t) { return getTOvr(t) < myOvr - 8; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 3);
  var picks = tough.concat(mid).concat(easy);
  var seen = {}; SetupState.NC_PICKS = [];
  picks.forEach(function(t) { if (!seen[t.id] && SetupState.NC_PICKS.length < 10) { seen[t.id] = true; SetupState.NC_PICKS.push(t.id); } });
  while (SetupState.NC_PICKS.length < 10) {
    var t = pool[ri(0, pool.length - 1)];
    if (!seen[t.id]) { seen[t.id] = true; SetupState.NC_PICKS.push(t.id); }
  }
}

function renderNCSchedule() {
  var t = G.teams[G.tid];
  var h = '<div class="setup-wrap" style="max-width:720px;">'
    + stepHeader(t.name, t.conf + ' · Prestige ' + t.schoolPrestige + ' · OVR ' + getTOvr(t))
    + '<div class="panel"><div class="panel-h"><span>Non-conference schedule</span><small>Auto-generated · swap any opponent</small></div>'
    + '<div class="panel-b flush"><div class="tbl-wrap"><table>'
    + '<thead><tr><th></th><th>Opponent</th><th class="num">OVR</th><th class="num">Edge</th><th></th></tr></thead><tbody>';
  SetupState.NC_PICKS.forEach(function(id, i) {
    var opp = G.teams[id];
    var myOvr = getTOvr(t);
    var diff = getTOvr(opp) - myOvr;
    var diffCol = diff >= 4 ? 'var(--red)' : diff >= -4 ? 'var(--gld2)' : 'var(--grn2)';
    var diffStr = diff > 0 ? '+' + diff : '' + diff;
    h += '<tr>'
      + '<td>' + teamLogo(opp.name, 'sm') + '</td>'
      + '<td><div>' + opp.name + '</div><div class="pt-sub">' + (i % 2 === 0 ? 'Home' : 'Away') + ' · ' + opp.conf + '</div></td>'
      + '<td class="num">' + getTOvr(opp) + '</td>'
      + '<td class="num" style="color:' + diffCol + ';">' + diffStr + '</td>'
      + '<td><button class="btn-quiet" data-swapnc="' + i + '">Swap</button></td></tr>';
  });
  h += '</tbody></table></div></div></div>'
    + '<div class="big-btn-row">'
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
  var pool = G.teams.filter(function(t) {
    return t.conf !== G.teams[G.tid].conf && t.id !== G.tid && SetupState.NC_PICKS.indexOf(t.id) < 0;
  }).sort(function(a, b) { return b.baseOvr - a.baseOvr; });
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(31,38,48,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;';
  overlay.innerHTML = '<div class="panel" style="width:min(480px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;margin-bottom:0;" role="dialog" aria-label="Swap opponent">'
    + '<div class="panel-h"><span>Swap opponent</span>'
    + '<button class="btn-quiet" id="swap-close">Close</button></div>'
    + '<input id="swap-search" class="setup-input" placeholder="Search teams..." style="border:none;border-bottom:1px solid var(--bdr);border-radius:0;" autocomplete="off">'
    + '<div id="swap-list" style="overflow-y:auto;"></div></div>';
  document.body.appendChild(overlay);
  function renderSwapList(f) {
    var list = document.getElementById('swap-list'); list.innerHTML = '';
    pool.filter(function(t) { return !f || t.name.toLowerCase().indexOf(f) >= 0 || t.conf.toLowerCase().indexOf(f) >= 0; })
    .forEach(function(t) {
      var d = document.createElement('div');
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;';
      d.innerHTML = '<span style="font-weight:600;">' + t.name + '</span><span style="color:var(--txt3);font-size:11px;flex-shrink:0;">' + t.conf + ' · OVR ' + getTOvr(t) + '</span>';
      function pick() { SetupState.NC_PICKS[idx] = t.id; document.body.removeChild(overlay); showStep('nc-schedule'); }
      d.addEventListener('click', pick);
      d.addEventListener('keydown', function(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      list.appendChild(d);
    });
  }
  renderSwapList('');
  document.getElementById('swap-search').addEventListener('input', function() { renderSwapList(this.value.toLowerCase()); });
  document.getElementById('swap-close').addEventListener('click', function() { document.body.removeChild(overlay); });
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
