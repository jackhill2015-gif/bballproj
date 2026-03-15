// ═══════════════════════════════════════════════════════════
//  HOOPS OS — ui.js
//  Central UI manager: toast, logging, navigation, topbar,
//  play button/dropdown, live sim modal (open/step/skip/finalize).
// ═══════════════════════════════════════════════════════════

import { ge, txt, html, fR } from './utils.js';
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
//  TOAST
// ═══════════════════════════════════════════════════════════

var _tt = null;
export function toast(msg, col) {
  var el = ge('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.borderColor = col || 'var(--bdr2)';
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(function() { el.classList.remove('show'); }, 3000);
}

// ═══════════════════════════════════════════════════════════
//  GAME LOG (sidebar)
// ═══════════════════════════════════════════════════════════

export function addLog(type, wk, text) {
  G.logs.unshift({ type: type, wk: wk, text: text });
  if (G.logs.length > 60) G.logs.pop();
  renderLog();
}

export function renderLog() {
  var el = ge('game-log');
  if (!el) return;
  el.innerHTML = G.logs.slice(0, 30).map(function(e) {
    return '<div class="log-item log-' + e.type + '">'
      + '<div class="log-wk">WK ' + e.wk + '</div>'
      + '<div class="log-txt">' + e.text + '</div></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════

export function navTo(v) {
  SetupState.ACTIVE_VIEW = v;
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
  if (v === 'roster' && _views.renderRoster) _views.renderRoster();
  if (v === 'stats' && _views.renderStats) _views.renderStats();
  if (v === 'schedule') {
    var h = _views.renderScheduleView ? _views.renderScheduleView() : '';
    html('schedule-content', h);
  }
  if (v === 'standings' && _views.renderStandings) _views.renderStandings();
  if (v === 'history' && _views.renderHistory) _views.renderHistory();
  if (v === 'bracket' && _views.renderBracket) _views.renderBracket();
  if (v === 'offseason' && _views.renderOffseason) _views.renderOffseason();
}

// ═══════════════════════════════════════════════════════════
//  MAIN UPDATE (topbar + sidebar + active view)
// ═══════════════════════════════════════════════════════════

export function updateAll() {
  if (!G.teams.length) return;
  var t = G.teams[G.tid];

  // Topbar
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
  var rank = sorted.findIndex(function(x) { return x.id === G.tid; }) + 1;
  txt('tb-rank', '#' + rank);
  txt('tb-yr', G.yr);
  txt('tb-rec', fR(t.wins, t.loss));
  var phases = { reg: 'REGULAR SEASON', conf_tourn: 'CONF TOURNEY', ncaa: 'MARCH MADNESS', offseason: 'OFFSEASON' };
  txt('tb-phase', phases[G.phase] || 'PRESEASON');

  // Play button
  updatePlayBtn();

  // Sidebar
  var stars = '';
  for (var i = 0; i < 5; i++) stars += i < G.prestige ? '\u2605' : '\u2606';
  txt('sf-stars', stars);
  txt('sf-yr', 'SEASON ' + G.yr + ' \u00b7 YR ' + (G.yr - 2025 + 1));

  // Active view
  refreshView();
}

// ═══════════════════════════════════════════════════════════
//  PLAY BUTTON & DROPDOWN
// ═══════════════════════════════════════════════════════════

export function updatePlayBtn() {
  var t = G.teams[G.tid];
  var btn = ge('play-btn');
  if (!btn) return;
  txt('tb-rec', fR(t.wins, t.loss));
  var phases = { reg: 'regular season', conf_tourn: 'conf tournament', ncaa: 'NCAA tournament', offseason: 'offseason' };
  var phaseTxt = G.yr + ' ' + (phases[G.phase] || G.phase);
  txt('tb-phase-label', phaseTxt);

  if (G.phase === 'reg') {
    var s = t.sched[G.gi];
    txt('tb-wk', 'GAME ' + (G.gi + 1) + '/30');
    if (s && s.opp !== undefined && !s.played) {
      var opp = G.teams[s.opp];
      if (opp) txt('tb-opp', (s.home ? 'vs ' : ' @ ') + opp.name);
      else txt('tb-opp', '---');
    } else if (s === null || s === undefined) {
      txt('tb-opp', 'Schedule NC games');
    } else {
      txt('tb-opp', '---');
    }
    btn.className = 'play-btn';
    txt('play-label', SetupState.G_AUTO ? 'STOP \u25a0' : 'PLAY \u25bc');
    updatePlayDropdown('reg');
  } else if (G.phase === 'conf_tourn') {
    var myConf = G.teams[G.tid].conf;
    var myCt = G.confTourneys ? G.confTourneys[myConf] : null;
    var confRound = myCt && myCt.rounds ? myCt.rounds.length : 0;
    var confRoundNames = { 1: 'First Round', 2: 'Quarterfinals', 3: 'Semifinals', 4: 'Championship' };
    var crn = confRoundNames[confRound] || 'Conf Tourney';
    txt('tb-wk', crn); txt('tb-opp', myConf + ' Tournament');
    btn.className = 'play-btn'; txt('play-label', 'PLAY \u25bc');
    updatePlayDropdown('conf_tourn');
  } else if (G.phase === 'ncaa') {
    var active = G.bracket ? G.bracket.filter(function(b) { return b.active; }).length : 0;
    var rn = { 64: 'Rd of 64', 32: 'Rd of 32', 16: 'Sweet 16', 8: 'Elite 8', 4: 'Final Four', 2: 'Title Game' };
    txt('tb-wk', rn[active] || 'NCAA'); txt('tb-opp', 'Tournament');
    btn.className = 'play-btn'; txt('play-label', 'PLAY \u25bc');
    updatePlayDropdown('ncaa');
  } else if (G.phase === 'offseason') {
    txt('tb-wk', 'OFFSEASON'); txt('tb-opp', '');
    var offLabel = G.offseasonStep === 'recap' ? 'CONTINUE \u25bc' : G.offseasonStep === 'turnover' ? 'CONTINUE \u25bc' : G.recruitPhase >= 3 ? 'FINALIZE \u25bc' : 'ADVANCE \u25bc';
    btn.className = 'play-btn'; txt('play-label', offLabel);
    updatePlayDropdown('offseason');
  }
}

export function updatePlayDropdown(phase) {
  var dd = ge('play-dropdown');
  if (!dd) return;
  var doPlay = _actions.doPlay || function() {};

  if (phase === 'reg') {
    var autoLbl = SetupState.G_AUTO ? 'Stop' : 'Until end of season';
    var autoSub = SetupState.G_AUTO ? 'Click to stop' : 'Runs until you stop';
    dd.innerHTML = '';
    var opts = [
      { label: 'One game', sub: 'Instant result', mode: 'quick' },
      { label: 'One game (live)', sub: 'Play by play', mode: 'live' }
    ];
    opts.forEach(function(o) {
      var d = document.createElement('div'); d.className = 'play-opt';
      d.innerHTML = o.label + ' <span class="play-opt-sub">' + o.sub + '</span>';
      d.onclick = function() { doPlay(o.mode); };
      dd.appendChild(d);
    });
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--bdr);margin:0 12px;';
    dd.appendChild(sep);
    var autoD = document.createElement('div'); autoD.className = 'play-opt'; autoD.id = 'auto-opt';
    autoD.innerHTML = '<span id="auto-label">' + autoLbl + '</span><span class="play-opt-sub" id="auto-sub">' + autoSub + '</span>';
    autoD.onclick = function() { doPlay('auto'); };
    dd.appendChild(autoD);
  } else if (phase === 'conf_tourn' || phase === 'ncaa') {
    dd.innerHTML = '';
    [{ label: 'One game', sub: 'Instant result', mode: 'quick' },
     { label: 'One game (live)', sub: 'Watch play by play', mode: 'live' }].forEach(function(o) {
      var d = document.createElement('div'); d.className = 'play-opt';
      d.innerHTML = o.label + ' <span class="play-opt-sub">' + o.sub + '</span>';
      d.onclick = function() { doPlay(o.mode); };
      dd.appendChild(d);
    });
  } else {
    dd.innerHTML = '';
    var phaseNames = { 1: 'Advance to Early Signing', 2: 'Advance to Late Signing', 3: 'Finalize Class & Start Season' };
    var label = G.offseasonStep === 'turnover' ? 'Proceed to Recruiting' : phaseNames[G.recruitPhase] || 'Advance';
    var sub = G.offseasonStep === 'turnover' ? 'Review departures, then recruit' : G.recruitPhase >= 3 ? 'Resolve all recruits and start next season' : 'Resolve current phase decisions';
    var d = document.createElement('div'); d.className = 'play-opt';
    d.innerHTML = label + ' <span class="play-opt-sub">' + sub + '</span>';
    d.onclick = function() { doPlay('advance'); };
    dd.appendChild(d);
  }
}

export function togglePlayMenu() {
  var dd = ge('play-dropdown');
  if (!dd) return;
  if (ge('play-btn').classList.contains('disabled')) return;
  dd.classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════
//  GAME MODAL — Live Simulation
// ═══════════════════════════════════════════════════════════

export function openModal(tH, tA, isTournament, roundName) {
  ge('gmod').classList.add('open');
  if (isTournament && roundName) {
    txt('gmod-title', roundName); txt('gmod-wk', 'TOURNAMENT GAME');
  } else {
    txt('gmod-title', 'LIVE SIMULATION'); txt('gmod-wk', 'GAME ' + (G.gi + 1) + ' of 30');
  }
  var ae = ge('sb-away'), he = ge('sb-home');
  var aName = tA.name + (isTournament && tA._seed ? ' #' + tA._seed : '');
  var hName = tH.name + (isTournament && tH._seed ? ' #' + tH._seed : '');
  ae.textContent = aName; ae.className = 'sb-t a' + (tA.id === G.tid ? ' u' : '');
  he.textContent = hName; he.className = 'sb-t h' + (tH.id === G.tid ? ' u' : '');
  ge('sb-score').textContent = '0 \u2013 0';
  txt('sb-clk', '20:00'); txt('sb-per', '1ST HALF');
  ge('pbplog').innerHTML = '<span style="color:var(--txt3)">\u25b6 TIP OFF</span>';
  ge('lplay').textContent = 'Tip off...'; ge('lplay').className = 'lplay';
  ['hc-a1', 'hc-h1', 'hc-a2', 'hc-h2', 'hc-aot', 'hc-hot', 'hc-af', 'hc-hf'].forEach(function(id) {
    var el = ge(id);
    if (el) { el.textContent = '\u2013'; el.className = 'hcell'; }
  });

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
    var labs = ['SLOW', 'SLOW', 'MED', 'FAST', 'MAX'];
    txt('spd-v', labs[parseInt(spd.value) - 1]);
    startInterval();
  };
  startInterval();
}

// ── Step Sim (one possession tick) ───────────────────────
export function stepSim() {
  if (LS.clock <= 0) {
    if (LS.half === 1) {
      LS.h1 = LS.hs; LS.a1 = LS.as; LS.half = 2; LS.clock = 1200;
      var h1e = ge('hc-h1'), a1e = ge('hc-a1');
      if (h1e) { h1e.textContent = LS.hs; h1e.className = 'hcell act'; }
      if (a1e) { a1e.textContent = LS.as; a1e.className = 'hcell act'; }
      txt('sb-per', '2ND HALF');
      G.momentum = { tid: -1, pts: 0 };
      var log = ge('pbplog');
      if (log) log.innerHTML = '<span style="color:var(--txt2)">\u2500\u2500 HALFTIME \u2500\u2500</span><br>' + log.innerHTML;
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
  var res = simPoss(offT, defT);
  LS.clock -= Math.max(1, res.time);
  if (LS.poss === 'H') LS.hs += res.pts; else LS.as += res.pts;
  LS.poss = LS.poss === 'H' ? 'A' : 'H';
  var m = Math.max(0, Math.floor(LS.clock / 60));
  var s = ('0' + Math.max(0, LS.clock % 60)).slice(-2);
  ge('sb-score').textContent = LS.as + ' \u2013 ' + LS.hs;
  txt('sb-clk', m + ':' + s);
  ge('mom-fill').style.width = (LS.hs / Math.max(1, LS.hs + LS.as) * 100) + '%';

  if (res.pbp) {
    var lp = ge('lplay');
    if (lp) {
      lp.innerHTML = res.pbp;
      lp.className = 'lplay' + (res.big ? ' big' : res.type === 'turn' || res.type === 'block' ? ' bad' : '');
    }
    var logEl = ge('pbplog');
    if (logEl) {
      var _entry = '<span class="p-ts">' + m + ':' + s + '</span>' + res.pbp + '<br>';
      if (res.run) {
        var _bc = res.run.isUser ? 'var(--gld)' : '#fc8181';
        _entry = '<div style="background:' + _bc + ';color:#000;font-weight:900;font-size:10px;padding:3px 8px;border-radius:3px;margin:2px 0;letter-spacing:.5px;">' + res.run.text + '</div>' + _entry;
      }
      logEl.innerHTML = _entry + logEl.innerHTML;
    }
  }
  return true;
}

// ── Skip Game ────────────────────────────────────────────
export function skipGame() {
  if (G.simInterval) { clearInterval(G.simInterval); G.simInterval = null; }
  var res = simGame(LS.tH, LS.tA, LS.game.home);
  LS.hs = res.homeScore; LS.as = res.awayScore;
  finalizeModal();
}

// ── Finalize Modal ───────────────────────────────────────
export function finalizeModal() {
  if (G.simInterval) { clearInterval(G.simInterval); G.simInterval = null; }
  var hf = ge('hc-hf'), af = ge('hc-af');
  if (hf) { hf.textContent = LS.hs; hf.className = 'hcell act'; }
  if (af) { af.textContent = LS.as; af.className = 'hcell act'; }
  ge('sb-score').textContent = LS.as + ' \u2013 ' + LS.hs;
  txt('sb-clk', 'FINAL');

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

// ═══════════════════════════════════════════════════════════
//  OUTSIDE-CLICK HANDLERS
// ═══════════════════════════════════════════════════════════

export function initOutsideClickHandlers() {
  document.addEventListener('click', function(e) {
    var dd = ge('play-dropdown'), btn = ge('play-btn');
    if (dd && btn && dd.classList.contains('open') && !dd.contains(e.target) && !btn.contains(e.target)) {
      dd.classList.remove('open');
    }
    var pd = ge('picker-dropdown'), pt = ge('picker-trigger');
    if (pd && pt && pd.style.display === 'block' && !pd.contains(e.target) && !pt.contains(e.target)) {
      pd.style.display = 'none';
    }
  });
}
