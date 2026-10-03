// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/setup.js
//  Coach career setup: name → difficulty → job offers → start
//  Re-skinned into the Campus Dynasty design system.
//  Mobile-first: everything stacks vertically; the job grid
//  goes two-column only on wide screens. All setup flow
//  logic (prestige init, NC auto-gen, dynasty start) is
//  preserved with identical names/signatures.
// ═══════════════════════════════════════════════════════════

import { DIFF_DESC, calcSchoolPrestige, calcExpectations } from '../constants.js';
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
  h += '<div style="text-align:center;margin-bottom:20px;">'
    + '<div class="setup-title">HOOPS<em>OS</em></div>'
    + '<div style="font-size:17px;font-weight:900;margin-top:10px;">' + title + '</div>'
    + (sub ? '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">' + sub + '</div>' : '')
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
        var coachName = saved.coach ? saved.coach.firstName + ' ' + saved.coach.lastName : 'Coach';
        txt('home-team-name', t.name || '---');
        var phases = { reg: 'Regular Season', conf_tourn: 'Conf Tournament', ncaa: 'NCAA Tournament', offseason: 'Offseason' };
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
        (G.offseasonStep === 'turnover' || G.offseasonStep === 'portal' ||
         G.offseasonStep === 'recruiting' || G.offseasonStep === 'skillpoints')) {
      G.offseasonStep = 'carousel';
    }
    addLog('ev', G.gi, 'Dynasty restored. Season ' + G.yr + '.');
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
  };
}

// ═══════════════════════════════════════════════════════════
//  STEP 1: Coach Name
// ═══════════════════════════════════════════════════════════

function renderCoachName() {
  return '<div class="setup-wrap">'
    + stepHeader('Create your coach', 'Your legacy starts on the sideline.')
    + '<div style="margin-bottom:16px;"><div class="field-label">First Name</div>'
    + '<input id="coach-first" class="setup-input" type="text" placeholder="John" maxlength="20" autocomplete="off"></div>'
    + '<div style="margin-bottom:20px;"><div class="field-label">Last Name</div>'
    + '<input id="coach-last" class="setup-input" type="text" placeholder="Smith" maxlength="20" autocomplete="off"></div>'
    + '<button class="btn-big btn-full" data-setup="coach-name-submit">Continue ›</button>'
    + '</div>';
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
    + '<div class="field-label" style="margin-bottom:10px;">Select difficulty</div>';
  ['easy', 'normal', 'hard', 'legend'].forEach(function(key) {
    var on = SetupState.DIFF === key;
    var label = key.charAt(0).toUpperCase() + key.slice(1);
    h += '<button class="scheme-row' + (on ? ' picked' : '') + '" data-diff="' + key + '" role="radio" aria-checked="' + on + '">'
      + '<span class="sm-body"><span class="sm-name">' + label + '</span>'
      + '<span class="sm-desc" style="display:block;">' + DIFF_DESC[key] + '</span></span>'
      + '<span class="scheme-check">' + (on ? '✓' : '') + '</span></button>';
  });
  h += '<button class="btn-big btn-full" style="margin-top:16px;" data-setup="diff-submit">Find a job ›</button>'
    + '</div>';
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
    + stepHeader('Job Offers', 'As a first-year coach, these programs will take a chance on you.')
    + '<div class="job-grid">';
  _jobOffers.forEach(function(t) {
    var tier = getTier(t.baseOvr);
    var sp = t.schoolPrestige;
    h += '<button class="scheme-row" data-job="' + t.id + '" style="margin-bottom:0;">'
      + teamLogo(t.name, 'sm')
      + '<span class="sm-body"><span class="sm-name">' + t.name + '</span>'
      + '<span class="sm-desc" style="display:block;">' + t.conf + ' · Prestige ' + sp + ' · <span style="color:' + tier.col + ';font-weight:700;">' + tier.label + '</span></span></span>'
      + '<span style="font-family:var(--mono);font-size:17px;font-weight:900;color:var(--blu);flex-shrink:0;">' + getTOvr(t) + '</span></button>';
  });
  h += '</div></div>';
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

function autoGenNC() {
  var myOvr = getTOvr(G.teams[G.tid]);
  var pool = G.teams.filter(function(t) { return t.conf !== G.teams[G.tid].conf && t.id !== G.tid; });
  var tough = pool.filter(function(t) { return Math.abs(getTOvr(t) - myOvr) <= 8; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 3);
  var mid = pool.filter(function(t) { return getTOvr(t) >= myOvr - 15 && getTOvr(t) < myOvr + 5; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 4);
  var easy = pool.filter(function(t) { return getTOvr(t) < myOvr - 10; }).sort(function() { return 0.5 - Math.random(); }).slice(0, 3);
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
    + '<div class="sec-head">Non-Conference Schedule</div>'
    + '<div class="sec-sub">Auto-generated. Swap any opponent you don\'t want.</div>'
    + '<div class="nc-grid">';
  SetupState.NC_PICKS.forEach(function(id, i) {
    var opp = G.teams[id];
    var myOvr = getTOvr(t);
    var diff = getTOvr(opp) - myOvr;
    var diffCol = diff >= 5 ? 'var(--red)' : diff >= -5 ? 'var(--gld2)' : 'var(--grn2)';
    var diffStr = diff > 0 ? '+' + diff : '' + diff;
    h += '<div class="nc-row">'
      + teamLogo(opp.name, 'sm')
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + opp.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);">' + (i % 2 === 0 ? 'HOME' : 'AWAY') + ' · ' + opp.conf + ' · OVR ' + getTOvr(opp) + ' <span style="color:' + diffCol + ';font-weight:800;">(' + diffStr + ')</span></div></div>'
      + '<button class="btn-quiet" data-swapnc="' + i + '">Swap</button></div>';
  });
  h += '</div>'
    + '<div style="display:flex;gap:8px;margin-top:20px;align-items:center;">'
    + '<button class="btn-quiet" data-setup="back-jobs" aria-label="Back to job offers">‹ Back</button>'
    + '<button class="btn-big" style="flex:1;" data-setup="start-dynasty">Start season</button></div>'
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,25,50,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;';
  overlay.innerHTML = '<div style="background:#fff;border:1px solid var(--bdr);border-radius:12px;width:min(480px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;">'
    + '<div style="padding:14px 16px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
    + '<div style="font-size:14px;font-weight:800;color:var(--txt);">Swap Opponent</div>'
    + '<button class="btn btn-ghost btn-sm" id="swap-close" aria-label="Close">✕</button></div>'
    + '<input id="swap-search" class="setup-input" placeholder="Search teams..." style="border:none;border-bottom:1px solid var(--bdr);border-radius:0;" autocomplete="off">'
    + '<div id="swap-list" style="overflow-y:auto;max-height:50vh;"></div></div>';
  document.body.appendChild(overlay);
  function renderSwapList(f) {
    var list = document.getElementById('swap-list'); list.innerHTML = '';
    pool.filter(function(t) { return !f || t.name.toLowerCase().indexOf(f) >= 0 || t.conf.toLowerCase().indexOf(f) >= 0; })
    .forEach(function(t) {
      var d = document.createElement('div');
      d.style.cssText = 'padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;font-size:13px;min-height:52px;';
      d.innerHTML = '<span style="font-weight:700;color:var(--txt);">' + t.name + '</span><span style="color:var(--txt3);font-size:11px;">' + t.conf + ' • OVR ' + getTOvr(t) + '</span>';
      d.addEventListener('click', function() { SetupState.NC_PICKS[idx] = t.id; document.body.removeChild(overlay); showStep('nc-schedule'); });
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
  G.expectations = calcExpectations(getTOvr(t), confAvgOvr);
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
