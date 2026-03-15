// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/setup.js
//  Coach career setup: name → difficulty → job offers → start
// ═══════════════════════════════════════════════════════════

import { DIFF_DESC, calcSchoolPrestige } from '../constants.js';
import { ri, ge, txt, getTier, getTOvr, fR } from '../utils.js';
import { G, SetupState, loadState, deleteSave, saveState } from '../state.js';
import { buildSchedules, genRecruits, buildUniverse } from '../season.js';

var _ext = { addLog: null, updateAll: null };
export function registerSetupCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function addLog(t, w, x) { if (_ext.addLog) _ext.addLog(t, w, x); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }

// ═══════════════════════════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════════════════════════

export function showHomeScreen() {
  var raw = localStorage.getItem('hoops_os_v3');
  var hs = ge('home-screen'); if (hs) hs.style.display = 'flex';
  ge('setup').style.display = 'none';
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
}

// ═══════════════════════════════════════════════════════════
//  STEP 1: Coach Name
// ═══════════════════════════════════════════════════════════

function renderCoachName() {
  return '<div style="max-width:500px;margin:0 auto;padding:40px 20px;">'
    + '<div style="text-align:center;margin-bottom:32px;">'
    + '<div class="setup-title">HOOPS<em>OS</em></div>'
    + '<div style="font-size:13px;color:var(--txt2);margin-top:8px;">Create your coaching legacy.</div></div>'
    + '<div style="margin-bottom:20px;">'
    + '<div style="font-size:11px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">First Name</div>'
    + '<input id="coach-first" type="text" placeholder="John" style="width:100%;padding:12px 14px;background:var(--s2);border:1px solid var(--bdr);border-radius:6px;color:#fff;font-family:Inter,sans-serif;font-size:15px;outline:none;" maxlength="20">'
    + '</div>'
    + '<div style="margin-bottom:28px;">'
    + '<div style="font-size:11px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Last Name</div>'
    + '<input id="coach-last" type="text" placeholder="Smith" style="width:100%;padding:12px 14px;background:var(--s2);border:1px solid var(--bdr);border-radius:6px;color:#fff;font-family:Inter,sans-serif;font-size:15px;outline:none;" maxlength="20">'
    + '</div>'
    + '<div class="btn btn-red btn-full" style="padding:14px;font-size:14px;" onclick="submitCoachName()">CONTINUE \u203a</div>'
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
//  STEP 2: Difficulty
// ═══════════════════════════════════════════════════════════

function renderDifficulty() {
  var name = G.coach.firstName + ' ' + G.coach.lastName;
  return '<div style="max-width:500px;margin:0 auto;padding:40px 20px;">'
    + '<div style="text-align:center;margin-bottom:24px;">'
    + '<div style="font-size:20px;font-weight:900;">Welcome, Coach ' + G.coach.lastName + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">Age 30 \u00b7 First year coaching</div></div>'
    + '<div style="font-size:11px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Select Difficulty</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">'
    + renderDiffBtn('easy', 'Easy', DIFF_DESC.easy)
    + renderDiffBtn('normal', 'Normal', DIFF_DESC.normal)
    + renderDiffBtn('hard', 'Hard', DIFF_DESC.hard)
    + renderDiffBtn('legend', 'Legend', DIFF_DESC.legend)
    + '</div>'
    + '<div id="diff-chosen" style="font-size:11px;color:var(--txt3);margin-bottom:20px;text-align:center;">' + DIFF_DESC[SetupState.DIFF] + '</div>'
    + '<div class="btn btn-red btn-full" style="padding:14px;font-size:14px;" onclick="submitDifficulty()">FIND A JOB \u203a</div>'
    + '</div>';
}

function renderDiffBtn(key, label, desc) {
  var on = SetupState.DIFF === key;
  return '<div onclick="setDiff(\'' + key + '\')" style="padding:14px 16px;background:' + (on ? 'rgba(229,62,62,.12)' : 'var(--s2)') + ';border:1px solid ' + (on ? 'var(--red)' : 'var(--bdr)') + ';border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">'
    + '<div><div style="font-size:13px;font-weight:700;color:' + (on ? '#fff' : 'var(--txt2)') + ';">' + label + '</div>'
    + '<div style="font-size:10px;color:var(--txt3);">' + desc + '</div></div>'
    + (on ? '<div style="width:10px;height:10px;border-radius:50%;background:var(--red);"></div>' : '')
    + '</div>';
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
  var h = '<div style="max-width:700px;margin:0 auto;padding:20px;">';
  h += '<div style="text-align:center;margin-bottom:20px;">'
    + '<div style="font-size:10px;color:var(--red);font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">COACHING CAROUSEL</div>'
    + '<div style="font-size:24px;font-weight:900;">Job Offers</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">As a first-year coach, these programs are willing to take a chance on you.</div></div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  _jobOffers.forEach(function(t) {
    var tier = getTier(t.baseOvr);
    var sp = t.schoolPrestige;
    h += '<div onclick="selectJob(' + t.id + ')" style="padding:14px;background:var(--s1);border:1px solid var(--bdr);border-radius:8px;cursor:pointer;transition:all .15s;" onmouseover="this.style.borderColor=\'var(--red)\';this.style.background=\'rgba(229,62,62,.04)\'" onmouseout="this.style.borderColor=\'var(--bdr)\';this.style.background=\'var(--s1)\'">'
      + '<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px;">' + t.name + '</div>'
      + '<div style="font-size:11px;color:var(--txt2);margin-bottom:8px;">' + t.conf + '</div>'
      + '<div style="display:flex;gap:12px;">'
      + '<div><div style="font-size:16px;font-weight:900;color:var(--red);">' + getTOvr(t) + '</div><div style="font-size:9px;color:var(--txt3);">OVR</div></div>'
      + '<div><div style="font-size:16px;font-weight:900;">' + sp + '</div><div style="font-size:9px;color:var(--txt3);">PRESTIGE</div></div>'
      + '<div><div style="font-size:12px;font-weight:700;color:' + tier.col + ';">' + tier.label + '</div><div style="font-size:9px;color:var(--txt3);">TIER</div></div>'
      + '</div></div>';
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
  var h = '<div style="max-width:700px;margin:0 auto;padding:20px;">';
  h += '<div style="text-align:center;margin-bottom:16px;">'
    + '<div style="font-size:10px;color:var(--red);font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">YOUR NEW JOB</div>'
    + '<div style="font-size:28px;font-weight:900;">' + t.name + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-top:4px;">' + t.conf + ' \u00b7 Prestige ' + t.schoolPrestige + ' \u00b7 OVR ' + getTOvr(t) + '</div></div>';

  h += '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:8px;">Non-Conference Schedule</div>'
    + '<div style="font-size:11px;color:var(--txt3);margin-bottom:12px;">Auto-generated. Swap any opponent you don\'t want.</div>';

  h += '<div id="nc-auto-list" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
  SetupState.NC_PICKS.forEach(function(id, i) {
    var opp = G.teams[id];
    var myOvr = getTOvr(t);
    var diff = getTOvr(opp) - myOvr;
    var diffCol = diff >= 5 ? '#fc8181' : diff >= -5 ? 'var(--gld2)' : 'var(--grn2)';
    var diffStr = diff > 0 ? '+' + diff : '' + diff;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;">'
      + '<div><div style="font-size:12px;font-weight:700;color:#fff;">' + opp.name + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">' + opp.conf + ' \u00b7 OVR ' + getTOvr(opp) + ' <span style="color:' + diffCol + ';">(' + diffStr + ')</span></div></div>'
      + '<div style="display:flex;gap:6px;align-items:center;">'
      + '<div style="font-size:10px;color:var(--txt3);">' + (i % 2 === 0 ? 'HOME' : 'AWAY') + '</div>'
      + '<div class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" onclick="swapNC(' + i + ')">SWAP</div>'
      + '</div></div>';
  });
  h += '</div>';

  h += '<div style="display:flex;gap:8px;margin-top:16px;">'
    + '<div class="btn btn-ghost" style="flex:1;text-align:center;padding:12px;" onclick="goBackToJobs()">\u2190 Back</div>'
    + '<div class="btn btn-red" style="flex:2;text-align:center;padding:14px;font-size:14px;font-weight:800;" onclick="startDynasty()">START SEASON \u25b6</div></div>';

  h += '</div>';
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:var(--s1);border:1px solid var(--bdr);border-radius:8px;width:480px;max-height:500px;display:flex;flex-direction:column;overflow:hidden;">'
    + '<div style="padding:14px 16px;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
    + '<div style="font-size:13px;font-weight:700;color:#fff;">Swap Opponent</div>'
    + '<div style="cursor:pointer;color:var(--txt3);font-size:16px;" id="swap-close">\u2715</div></div>'
    + '<input id="swap-search" placeholder="Search..." style="padding:10px 14px;background:var(--s2);border:none;border-bottom:1px solid var(--bdr);color:#fff;font-family:Inter,sans-serif;font-size:12px;outline:none;">'
    + '<div id="swap-list" style="overflow-y:auto;max-height:360px;"></div></div>';
  document.body.appendChild(overlay);
  function renderSwapList(f) {
    var list = document.getElementById('swap-list'); list.innerHTML = '';
    pool.filter(function(t) { return !f || t.name.toLowerCase().indexOf(f) >= 0 || t.conf.toLowerCase().indexOf(f) >= 0; })
    .forEach(function(t) {
      var d = document.createElement('div');
      d.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);display:flex;justify-content:space-between;font-size:12px;';
      d.innerHTML = '<span style="font-weight:600;color:#fff;">' + t.name + '</span><span style="color:var(--txt3);">' + t.conf + ' \u2022 ' + getTOvr(t) + '</span>';
      d.onmouseover = function() { this.style.background = 'rgba(229,62,62,.08)'; };
      d.onmouseout = function() { this.style.background = ''; };
      d.onclick = function() { SetupState.NC_PICKS[idx] = t.id; document.body.removeChild(overlay); showStep('nc-schedule'); };
      list.appendChild(d);
    });
  }
  renderSwapList('');
  document.getElementById('swap-search').oninput = function() { renderSwapList(this.value.toLowerCase()); };
  document.getElementById('swap-close').onclick = function() { document.body.removeChild(overlay); };
}
window.swapNC = swapNC;

export function startDynasty() {
  if (SetupState.NC_PICKS.length < 10) autoGenNC();
  SetupState.NC_PICKS.forEach(function(id, i) {
    G.teams[G.tid].sched[i] = { opp: id, home: i % 2 === 0, conf: false, played: false, uScore: 0, oScore: 0 };
  });
  genRecruits();
  ge('setup').style.display = 'none';
  addLog('ev', 0, 'Coach ' + G.coach.lastName + ' takes over at <b>' + G.teams[G.tid].name + '</b>. Season ' + G.yr + ' begins.');
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
