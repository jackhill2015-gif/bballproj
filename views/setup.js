// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/setup.js
//  Home screen, setup wizard, team picker, difficulty,
//  non-conference schedule editor.
// ═══════════════════════════════════════════════════════════

import { DIFF_DESC } from '../constants.js';
import { ri, ge, txt, getTier, getTOvr, fR } from '../utils.js';
import { G, SetupState, loadState, deleteSave, saveState } from '../state.js';
import { buildSchedules, genRecruits, buildUniverse } from '../season.js';

// ── Late-binding ─────────────────────────────────────────
var _ext = { addLog: null, updateAll: null };

export function registerSetupCallbacks(callbacks) {
  Object.keys(callbacks).forEach(function(k) {
    if (_ext.hasOwnProperty(k)) _ext[k] = callbacks[k];
  });
}

function addLog(type, wk, text) { if (_ext.addLog) _ext.addLog(type, wk, text); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }

// ═══════════════════════════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════════════════════════

export function showHomeScreen() {
  var raw = localStorage.getItem('hoops_os_v3');
  var hs = ge('home-screen');
  if (hs) hs.style.display = 'flex';
  ge('setup').style.display = 'none';
  if (raw) {
    try {
      var saved = JSON.parse(raw);
      var t = saved.teams && saved.teams[saved.tid];
      if (t) {
        txt('home-team-name', t.name);
        var phases = { reg: 'Regular Season', conf_tourn: 'Conf Tournament', ncaa: 'NCAA Tournament', offseason: 'Offseason' };
        var phaseStr = phases[saved.phase] || 'Preseason';
        var seasonNum = saved.yr ? saved.yr - 2024 : 1;
        txt('home-dynasty-meta', t.conf + ' \u00b7 ' + phaseStr + ' \u00b7 ' + saved.difficulty.charAt(0).toUpperCase() + saved.difficulty.slice(1));
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
  buildPicker();
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
    deleteSave();
    location.reload();
  }
}

// ═══════════════════════════════════════════════════════════
//  SETUP WIZARD — STEP 1
// ═══════════════════════════════════════════════════════════

export function buildPicker() {
  var list = ge('picker-list'); if (!list) return;
  var power = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Big East'];
  var sorted = G.teams.slice().sort(function(a, b) {
    var ai = power.indexOf(a.conf), bi = power.indexOf(b.conf);
    if (ai < 0) ai = 99; if (bi < 0) bi = 99;
    if (ai !== bi) return ai - bi;
    if (a.conf !== b.conf) return a.conf.localeCompare(b.conf);
    return b.baseOvr - a.baseOvr;
  });
  function render(f) {
    list.innerHTML = '';
    sorted.filter(function(t) { return !f || t.name.toLowerCase().indexOf(f) >= 0 || t.conf.toLowerCase().indexOf(f) >= 0; })
    .forEach(function(t) {
      var d = document.createElement('div'); d.className = 'picker-opt';
      d.innerHTML = '<span>' + t.name + ' <span style="font-size:10px;color:var(--txt3);">' + t.conf + '</span></span>'
        + '<span style="font-family:monospace;font-size:11px;color:var(--red);">' + getTOvr(t) + '</span>';
      d.onclick = function() { selectTeam(t.id); };
      list.appendChild(d);
    });
  }
  render('');
  var ps = ge('picker-search');
  if (ps) ps.oninput = function() { render(ps.value.toLowerCase()); };
}

export function togglePicker() {
  var dd = ge('picker-dropdown'); if (!dd) return;
  var open = dd.style.display === 'block';
  dd.style.display = open ? 'none' : 'block';
  if (!open) { var s = ge('picker-search'); if (s) { s.value = ''; s.dispatchEvent(new Event('input')); setTimeout(function() { s.focus(); }, 30); } }
}

export function selectTeam(id) {
  SetupState.SEL_TID = id;
  var t = G.teams[id];
  txt('picker-label', t.name);
  var tr = ge('picker-trigger'); if (tr) tr.className = 'picker-trigger sel';
  ge('picker-dropdown').style.display = 'none';
  var btn = ge('step1-btn');
  if (btn) {
    btn.setAttribute('data-disabled', 'false'); btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
    btn.textContent = 'CONTINUE WITH ' + t.name.toUpperCase() + ' \u203a';
  }
  renderProfile(t);
}

export function pickRandom() {
  if (G.teams.length) selectTeam(G.teams[ri(0, G.teams.length - 1)].id);
}

export function setDiff(d) {
  SetupState.DIFF = d;
  document.querySelectorAll('.diff-btn').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-diff') === d); });
  txt('diff-desc', DIFF_DESC[d] || '');
  if (SetupState.SEL_TID !== null) renderProfile(G.teams[SetupState.SEL_TID]);
}

function renderProfile(t) {
  var panel = ge('program-profile'); if (!panel) return;
  var tier = getTier(t.baseOvr);
  var ovr = getTOvr(t);
  var confT = G.teams.filter(function(x) { return x.conf === t.conf; });
  var confRank = confT.slice().sort(function(a, b) { return b.baseOvr - a.baseOvr; }).findIndex(function(x) { return x.id === t.id; }) + 1;
  var exp = ovr >= 90 ? 'Win the national title' : ovr >= 85 ? 'Deep tournament run' : ovr >= 78 ? 'Top 25 contender' : ovr >= 70 ? 'Win your conference' : 'Build the program';
  panel.innerHTML = '<div style="margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">' + t.conf + '</div>'
    + '<div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:8px;">' + t.name + '</div>'
    + '<div class="tier-badge" style="color:' + tier.col + ';">' + tier.label + '</div>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px;">' + tier.desc + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">'
    + '<div class="stat-box"><div class="stat-box-l">Rating</div><div class="stat-box-v" style="color:var(--red);">' + ovr + '</div></div>'
    + '<div class="stat-box"><div class="stat-box-l">Conf Rank</div><div class="stat-box-v" style="color:#fff;">#' + confRank + '/' + confT.length + '</div></div>'
    + '</div>'
    + '<div style="padding:12px;background:rgba(255,255,255,.03);border:1px solid var(--bdr);border-radius:6px;">'
    + '<div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Expectations</div>'
    + '<div style="font-size:13px;color:#fff;font-weight:600;">' + exp + '</div>'
    + '</div>';
}

// ═══════════════════════════════════════════════════════════
//  SETUP WIZARD — STEP 2 (NC Schedule)
// ═══════════════════════════════════════════════════════════

export function goToStep2() {
  if (SetupState.SEL_TID === null) return;
  G.tid = SetupState.SEL_TID;
  G.difficulty = SetupState.DIFF;
  G.prestige = Math.max(1, Math.round((getTOvr(G.teams[G.tid]) - 60) / 8));
  buildSchedules();
  autoGenNC();
  ge('step1').style.display = 'none'; ge('step2').style.display = 'flex';
  renderNCAutoList();
}

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

export function renderNCAutoList() {
  var cont = ge('nc-auto-list'); if (!cont) return;
  cont.innerHTML = '';
  SetupState.NC_PICKS.forEach(function(id, i) {
    var t = G.teams[id];
    var myOvr = getTOvr(G.teams[G.tid]);
    var diff = getTOvr(t) - myOvr;
    var diffCol = diff >= 5 ? '#fc8181' : diff >= -5 ? 'var(--gld2)' : 'var(--grn2)';
    var diffStr = diff > 0 ? '+' + diff : diff + '';
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--s2);border:1px solid var(--bdr);border-radius:5px;';
    card.innerHTML = '<div>'
      + '<div style="font-size:12px;font-weight:700;color:#fff;">' + t.name + '</div>'
      + '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">' + t.conf + ' &nbsp;&bull;&nbsp; OVR ' + getTOvr(t) + ' <span style="color:' + diffCol + ';">(' + diffStr + ')</span></div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;">'
      + '<div style="font-size:10px;color:var(--txt3);">' + (i % 2 === 0 ? 'HOME' : 'AWAY') + '</div>'
      + '<div class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;" data-idx="' + i + '" onclick="swapNC(' + i + ')">SWAP</div>'
      + '</div>';
    cont.appendChild(card);
  });
}

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
    + '<div id="swap-list" style="overflow-y:auto;max-height:360px;"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  function renderSwapList(f) {
    var list = document.getElementById('swap-list'); list.innerHTML = '';
    pool.filter(function(t) { return !f || t.name.toLowerCase().indexOf(f) >= 0 || t.conf.toLowerCase().indexOf(f) >= 0; })
    .forEach(function(t) {
      var d = document.createElement('div');
      d.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);display:flex;justify-content:space-between;font-size:12px;';
      d.innerHTML = '<span style="font-weight:600;color:#fff;">' + t.name + '</span><span style="color:var(--txt3);">' + t.conf + ' &bull; ' + getTOvr(t) + '</span>';
      d.onmouseover = function() { this.style.background = 'rgba(229,62,62,.08)'; };
      d.onmouseout = function() { this.style.background = ''; };
      d.onclick = function() {
        SetupState.NC_PICKS[idx] = t.id;
        document.body.removeChild(overlay);
        renderNCAutoList();
      };
      list.appendChild(d);
    });
  }
  renderSwapList('');
  document.getElementById('swap-search').oninput = function() { renderSwapList(this.value.toLowerCase()); };
  document.getElementById('swap-close').onclick = function() { document.body.removeChild(overlay); };
}

export function goToStep1() {
  ge('step2').style.display = 'none'; ge('step1').style.display = 'flex';
}

export function startDynasty() {
  if (SetupState.NC_PICKS.length < 10) { autoGenNC(); }
  SetupState.NC_PICKS.forEach(function(id, i) {
    G.teams[G.tid].sched[i] = { opp: id, home: i % 2 === 0, conf: false, played: false, uScore: 0, oScore: 0 };
  });
  genRecruits();
  ge('setup').style.display = 'none';
  addLog('ev', 0, 'Season ' + G.yr + ' begins at <b>' + G.teams[G.tid].name + '</b>.');
  updateAll(); saveState();
}
