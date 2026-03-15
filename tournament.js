// ═══════════════════════════════════════════════════════════
//  HOOPS OS — tournament.js
//  Conference tournaments, NCAA bracket generation,
//  Selection Sunday reveal, tournament game play/resolution.
// ═══════════════════════════════════════════════════════════

import { ge, txt } from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { simGame } from './simulation.js';

// ── Late-Binding Registry ────────────────────────────────
var _ext = {
  toast: null,
  addLog: null,
  updateAll: null,
  navTo: null,
  openModal: null,
  endSeason: null,
  renderBracket: null
};

export function registerTournamentCallbacks(callbacks) {
  Object.keys(callbacks).forEach(function(k) {
    if (_ext.hasOwnProperty(k)) _ext[k] = callbacks[k];
  });
}

function toast(msg, col) { if (_ext.toast) _ext.toast(msg, col); }
function addLog(type, wk, text) { if (_ext.addLog) _ext.addLog(type, wk, text); }
function updateAll() { if (_ext.updateAll) _ext.updateAll(); }
function navTo(v) { if (_ext.navTo) _ext.navTo(v); }

// ═══════════════════════════════════════════════════════════
//  ROUND NAME HELPERS
// ═══════════════════════════════════════════════════════════

export function getNCAAroundName() {
  if (!G.bracket) return 'NCAA Tournament';
  var active = G.bracket.filter(function(b) { return b.active; }).length;
  var names = {
    64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16',
    8: 'Elite Eight', 4: 'Final Four', 2: 'Championship Game'
  };
  return 'NCAA Tournament \u2014 ' + (names[active] || '');
}

export function getConfRoundName(ct, conf) {
  if (!ct || !ct.rounds) return (conf || '') + ' Tournament';
  var r = ct.rounds.length;
  var names = { 1: 'First Round', 2: 'Quarterfinals', 3: 'Semifinals', 4: 'Championship' };
  return (conf || '') + ' Tournament \u2014 ' + (names[r] || 'Round ' + r);
}

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENTS
// ═══════════════════════════════════════════════════════════

export function startConfTourney() {
  var confs = {};
  G.teams.forEach(function(t) {
    if (!confs[t.conf]) confs[t.conf] = [];
    confs[t.conf].push(t);
  });
  G.confTourneys = {};
  Object.keys(confs).forEach(function(conf) {
    var teams = confs[conf].slice().sort(function(a, b) {
      return b.cWins - a.cWins || b.pts - a.pts;
    });
    G.confTourneys[conf] = {
      seeds: teams,
      rounds: [],
      done: false, champ: null
    };
    buildNextConfRound(conf);
  });
  G.phase = 'conf_tourn';
  addLog('ev', G.gi, 'Conference tournaments begin!');
  toast('Conference Tournaments Begin!');
  saveState(); updateAll(); navTo('dashboard');
}

function buildNextConfRound(conf) {
  var ct = G.confTourneys[conf];
  if (!ct || ct.done) return;
  var survivors;
  if (ct.rounds.length === 0) {
    survivors = ct.seeds.slice();
  } else {
    var last = ct.rounds[ct.rounds.length - 1];
    survivors = last.map(function(m) { return m.winner; }).filter(Boolean);
  }
  if (survivors.length <= 1) {
    ct.done = true;
    ct.champ = survivors[0] || null;
    if (ct.champ) {
      ct.champ.pts += 200;
      if (ct.champ.id === G.tid) {
        G.confTitles++; G.prestige = Math.min(5, G.prestige + 1);
        addLog('ev', G.gi, '<b>' + conf + ' CONFERENCE CHAMPIONS!</b>');
        toast('CONFERENCE CHAMPIONS!', 'var(--gld)');
      } else {
        addLog('ev', G.gi, conf + ' won by <b>' + ct.champ.name + '</b>');
      }
    }
    return;
  }
  var round = [];
  for (var i = 0; i < survivors.length - 1; i += 2) {
    round.push({ t1: survivors[i], t2: survivors[i + 1], s1: null, s2: null, winner: null });
  }
  ct.rounds.push(round);
}

function getCurrentConfRound(conf) {
  var ct = G.confTourneys[conf];
  if (!ct || ct.done) return null;
  var last = ct.rounds[ct.rounds.length - 1];
  if (!last) return null;
  var unplayed = last.filter(function(m) { return m.winner === null; });
  if (unplayed.length > 0) return last;
  buildNextConfRound(conf);
  if (ct.done) return null;
  return ct.rounds[ct.rounds.length - 1];
}

export function getUserConfMatchup() {
  var myConf = G.teams[G.tid].conf;
  var ct = G.confTourneys[myConf];
  if (!ct || ct.done) return null;
  var round = getCurrentConfRound(myConf);
  if (!round) return null;
  for (var i = 0; i < round.length; i++) {
    var m = round[i];
    if (m.winner !== null) continue;
    if (m.t1.id === G.tid || m.t2.id === G.tid) return { matchup: m, conf: myConf, ct: ct };
  }
  return null;
}

export function getUserNCAAmatchup() {
  if (!G.bracket || !G.bracket.length) return null;
  var active = G.bracket.filter(function(b) { return b.active; });
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    if (b1.team.id === G.tid || b2.team.id === G.tid) return { b1: b1, b2: b2 };
  }
  return null;
}

// Legacy aliases
export function getUserConfGame() { return getUserConfMatchup(); }
export function getUserNCAAgame() { return getUserNCAAmatchup(); }

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENT SIM HELPERS
// ═══════════════════════════════════════════════════════════

export function simConfFull(conf) {
  var ct = G.confTourneys[conf];
  if (!ct || ct.done) return;
  var safety = 0;
  while (!ct.done && safety++ < 20) {
    var round = getCurrentConfRound(conf);
    if (!round) break;
    round.forEach(function(m) {
      if (m.winner !== null) return;
      var res = simGame(m.t1, m.t2, true);
      m.s1 = res.homeScore; m.s2 = res.awayScore;
      m.winner = res.homeScore > res.awayScore ? m.t1 : m.t2;
    });
    buildNextConfRound(conf);
  }
}

export function allConfDone() {
  if (!G.confTourneys || !Object.keys(G.confTourneys).length) return false;
  return Object.values(G.confTourneys).every(function(ct) { return ct.done; });
}

function advanceConfRoundExceptUser(conf) {
  var ct = G.confTourneys[conf];
  if (!ct || ct.done) return;
  var last = ct.rounds[ct.rounds.length - 1];
  if (!last) return;
  last.forEach(function(m) {
    if (m.winner !== null) return;
    if (m.t1.id === G.tid || m.t2.id === G.tid) return;
    var res = simGame(m.t1, m.t2, true);
    m.s1 = res.homeScore; m.s2 = res.awayScore;
    m.winner = res.homeScore > res.awayScore ? m.t1 : m.t2;
  });
  Object.keys(G.confTourneys).forEach(function(c) {
    if (c === conf) return;
    simConfFull(c);
  });
  var allDone = last.every(function(m) { return m.winner !== null; });
  if (allDone) {
    buildNextConfRound(conf);
    if (G.confTourneys[conf].done) {
      if (allConfDone() && !G.bracket.length) buildNCAA();
    }
  }
}

export function advanceConfTourney() {
  Object.keys(G.confTourneys).forEach(function(conf) { simConfFull(conf); });
  if (allConfDone() && !G.bracket.length) buildNCAA();
  saveState(); updateAll();
}

// Aliases used by doPlay
export function simConfRoundAll() { advanceConfTourney(); }
export function simConfRound(conf) { simConfFull(conf); }
export function simConfBtn(el) {
  var c = el.getAttribute('data-conf');
  if (c) simConfFull(c);
}

// ═══════════════════════════════════════════════════════════
//  NCAA BRACKET GENERATION & SELECTION SUNDAY
// ═══════════════════════════════════════════════════════════

export function buildNCAA() {
  var sorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; }).slice(0, 64);
  G.bracket = sorted.map(function(t, i) {
    return { team: t, seed: i + 1, active: true, score: null, won: false };
  });
  G.phase = 'ncaa';
  var userSeed = G.bracket.findIndex(function(b) { return b.team.id === G.tid; }) + 1;
  if (userSeed > 0) {
    addLog('ev', G.gi, '<b>NCAA Tournament!</b> You are the #' + userSeed + ' seed.');
  } else {
    addLog('ev', G.gi, 'NCAA Tournament \u2014 your program did not qualify.');
  }
  saveState(); updateAll();
  showBracketReveal(userSeed);
}

export function showBracketReveal(userSeed) {
  var rev = ge('bracket-reveal');
  if (!rev) return;
  rev.style.display = 'block';
  if (userSeed > 0) {
    var uc = ge('br-user-card'); if (uc) uc.style.display = 'block';
    txt('br-user-team', G.teams[G.tid].name);
    txt('br-user-seed', '#' + userSeed + ' Seed \u2014 ' +
      (userSeed <= 4 ? 'Top 4 seed! Host site.' :
       userSeed <= 8 ? 'Top 8 seed.' :
       userSeed <= 16 ? 'Top half of bracket.' :
       'Lower seed \u2014 need an upset run.'));
    var idx = userSeed - 1;
    var oppIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    var opp = G.bracket[oppIdx];
    txt('br-user-opp', opp ? 'First round vs #' + opp.seed + ' ' + opp.team.name : 'First round opponent TBD');
    txt('br-seed-line', 'The field of 64 is set. You are in.');
  } else {
    txt('br-seed-line', 'The field of 64 is set. Your program did not qualify this year.');
  }
  // Build bracket visual — 4 columns of 16
  var wrap = ge('br-bracket');
  if (!wrap) return;
  wrap.innerHTML = '';
  var regions = ['East', 'West', 'South', 'Midwest'];
  for (var r = 0; r < 4; r++) {
    var col = document.createElement('div');
    col.style.cssText = 'background:var(--s1);border:1px solid var(--bdr);border-radius:6px;padding:10px;';
    var header = document.createElement('div');
    header.style.cssText = 'font-size:10px;font-weight:800;color:var(--red);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;text-align:center;';
    header.textContent = regions[r] + ' Region';
    col.appendChild(header);
    var seeds = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
    seeds.forEach(function(s) {
      var globalSeed = r * 16 + seeds.indexOf(s) + 1;
      var b = G.bracket[globalSeed - 1];
      if (!b) return;
      var isU = b.team.id === G.tid;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:3px;margin-bottom:2px;font-size:11px;' +
        (isU ? 'background:rgba(214,158,46,.15);border:1px solid var(--gld);' : '');
      row.innerHTML = '<span style="width:18px;font-family:monospace;font-size:10px;color:var(--txt3);flex-shrink:0;">' + b.seed + '</span>' +
        '<span style="font-weight:' + (isU ? '800' : '500') + ';color:' + (isU ? 'var(--gld2)' : 'var(--txt)') +
        ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + b.team.name + '</span>';
      col.appendChild(row);
    });
    wrap.appendChild(col);
  }
}

export function closeBracketReveal() {
  var rev = ge('bracket-reveal');
  if (rev) rev.style.display = 'none';
  navTo('dashboard');
}

// ═══════════════════════════════════════════════════════════
//  NCAA ROUND SIMULATION
// ═══════════════════════════════════════════════════════════

export function simNCAAround() {
  var active = G.bracket.filter(function(b) { return b.active; });
  if (active.length <= 1) return;
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    var res = simGame(b1.team, b2.team, true);
    b1.score = res.homeScore; b2.score = res.awayScore;
    if (res.homeScore > res.awayScore) { b1.won = true; b2.won = false; b2.active = false; }
    else { b2.won = true; b1.won = false; b1.active = false; }
  }
  checkNCAAdone();
  saveState(); updateAll();
  if (SetupState.ACTIVE_VIEW === 'bracket' && _ext.renderBracket) _ext.renderBracket();
}

function simNCAArimExceptUser() {
  var active = G.bracket.filter(function(b) { return b.active; });
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    if (b1.team.id === G.tid || b2.team.id === G.tid) continue;
    var res = simGame(b1.team, b2.team, true);
    b1.score = res.homeScore; b2.score = res.awayScore;
    if (res.homeScore > res.awayScore) { b1.won = true; b2.won = false; b2.active = false; }
    else { b2.won = true; b1.won = false; b1.active = false; }
  }
}

function checkNCAAdone() {
  var still = G.bracket.filter(function(b) { return b.active; });
  if (still.length === 1) {
    var ch = still[0].team;
    if (ch.id === G.tid) {
      G.championships++; G.prestige = 5;
      addLog('ev', G.gi, '<b>NATIONAL CHAMPIONS! \ud83c\udfc6</b>');
      toast('NATIONAL CHAMPIONS!!!', 'var(--gld)');
    } else {
      addLog('ev', G.gi, ch.name + ' wins the National Championship.');
      if (!G.leagueChamps) G.leagueChamps = [];
      G.leagueChamps.push({ year: G.yr, name: ch.name, tid: ch.id });
    }
    if (_ext.endSeason) _ext.endSeason();
  }
}

// ═══════════════════════════════════════════════════════════
//  TOURNAMENT GAME PLAY (user games — conf & NCAA)
// ═══════════════════════════════════════════════════════════

export function playTournamentGame(watch) {
  if (G.phase === 'conf_tourn') {
    var um = getUserConfMatchup();
    if (um) {
      var m = um.matchup;
      LS.tH = m.t1; LS.tA = m.t2;
      LS.game = {
        home: true, conf: true, played: false, uScore: 0, oScore: 0,
        _matchup: m, _conf: um.conf, _ct: um.ct, _type: 'conf'
      };
      LS.userTeam = G.teams[G.tid];
      LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0;
      LS.h1 = null; LS.a1 = null; LS.poss = 'A';
      if (watch) {
        var rn = getConfRoundName(um.ct, um.conf);
        if (um.ct && um.ct.seeds) {
          m.t1._seed = um.ct.seeds.findIndex(function(t) { return t.id === m.t1.id; }) + 1;
          m.t2._seed = um.ct.seeds.findIndex(function(t) { return t.id === m.t2.id; }) + 1;
        }
        if (_ext.openModal) _ext.openModal(m.t1, m.t2, true, rn);
      } else {
        var res = simGame(m.t1, m.t2, true);
        LS.hs = res.homeScore; LS.as = res.awayScore;
        resolveTournamentGame();
      }
    } else {
      advanceConfTourney();
    }
  } else if (G.phase === 'ncaa') {
    var um2 = getUserNCAAmatchup();
    if (um2) {
      LS.tH = um2.b1.team; LS.tA = um2.b2.team;
      LS.game = {
        home: true, conf: false, played: false, uScore: 0, oScore: 0,
        _b1: um2.b1, _b2: um2.b2, _type: 'ncaa'
      };
      LS.userTeam = G.teams[G.tid];
      LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0;
      LS.h1 = null; LS.a1 = null; LS.poss = 'A';
      if (watch) {
        um2.b1.team._seed = um2.b1.seed;
        um2.b2.team._seed = um2.b2.seed;
        if (_ext.openModal) _ext.openModal(um2.b1.team, um2.b2.team, true, getNCAAroundName());
      } else {
        var res2 = simGame(um2.b1.team, um2.b2.team, true);
        LS.hs = res2.homeScore; LS.as = res2.awayScore;
        resolveTournamentGame();
      }
    } else {
      simNCAAround();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  RESOLVE TOURNAMENT RESULT
// ═══════════════════════════════════════════════════════════

export function resolveTournamentGame() {
  var game = LS.game;
  if (!game) return;
  var userTeam = G.teams[G.tid];
  if (game._type === 'conf') {
    var m = game._matchup;
    var conf = game._conf;
    m.s1 = LS.hs; m.s2 = LS.as;
    m.winner = LS.hs > LS.as ? m.t1 : m.t2;
    var userWon = (m.winner.id === G.tid);
    var oppName = (m.t1.id === G.tid ? m.t2 : m.t1).name;
    if (userWon) {
      toast(userTeam.name + ' ADVANCES! ' + LS.hs + '-' + LS.as, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName + '</b> ' + LS.hs + '\u2013' + LS.as + ' (Conf Tourney)');
    } else {
      toast('Eliminated by ' + oppName + ' ' + LS.hs + '-' + LS.as, 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName + '</b> ' + LS.hs + '\u2013' + LS.as + ' (Conf Tourney)');
    }
    advanceConfRoundExceptUser(conf);
  } else if (game._type === 'ncaa') {
    var b1 = game._b1, b2 = game._b2;
    b1.score = LS.hs; b2.score = LS.as;
    if (LS.hs > LS.as) { b1.won = true; b2.won = false; b2.active = false; }
    else { b2.won = true; b1.won = false; b1.active = false; }
    var userWon2 = (LS.hs > LS.as) === (b1.team.id === G.tid);
    var oppName2 = (b1.team.id === G.tid ? b2 : b1).team.name;
    if (userWon2) {
      toast(userTeam.name + ' ADVANCES! ' + LS.hs + '-' + LS.as, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName2 + '</b> ' + LS.hs + '\u2013' + LS.as + ' (NCAA)');
    } else {
      toast('Eliminated by ' + oppName2 + ' ' + LS.hs + '-' + LS.as, 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName2 + '</b> ' + LS.hs + '\u2013' + LS.as + ' (NCAA)');
    }
    simNCAArimExceptUser();
    checkNCAAdone();
  }
  saveState(); updateAll();
  if (SetupState.ACTIVE_VIEW === 'bracket' && _ext.renderBracket) _ext.renderBracket();
}

// ═══════════════════════════════════════════════════════════
//  TOURNAMENT RESULT OVERLAY (live sim modal)
// ═══════════════════════════════════════════════════════════

export function showTournamentResult() {
  var won = LS.hs > LS.as;
  var userIsHome = LS.tH.id === G.tid;
  var uScore = userIsHome ? LS.hs : LS.as;
  var oScore = userIsHome ? LS.as : LS.hs;
  var opp = userIsHome ? LS.tA : LS.tH;
  var roundName = G.phase === 'ncaa' ? getNCAAroundName() : getConfRoundName(LS.game._ct, LS.game._conf);
  var panel = ge('gmod').querySelector('.gpanel');
  if (!panel) { ge('gmod').classList.remove('open'); resolveTournamentGame(); return; }
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:var(--s1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;border-radius:10px;z-index:10;';
  overlay.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:2px;text-transform:uppercase;">' + roundName + '</div>'
    + '<div style="font-size:40px;font-weight:900;color:' + (won ? 'var(--grn2)' : '#fc8181') + ';">' + (won ? 'VICTORY' : 'ELIMINATED') + '</div>'
    + '<div style="display:flex;align-items:center;gap:24px;">'
    + '<div style="text-align:center;"><div style="font-size:13px;font-weight:700;color:var(--red);">' + G.teams[G.tid].name + '</div>'
    + '<div style="font-size:52px;font-weight:900;font-family:monospace;color:' + (won ? 'var(--grn2)' : '#fc8181') + ';">' + uScore + '</div></div>'
    + '<div style="font-size:18px;color:var(--bdr2);">\u2014</div>'
    + '<div style="text-align:center;"><div style="font-size:13px;font-weight:700;color:var(--txt2);">' + opp.name + '</div>'
    + '<div style="font-size:52px;font-weight:900;font-family:monospace;color:var(--txt2);">' + oScore + '</div></div>'
    + '</div>'
    + (won ? '<div style="font-size:12px;color:var(--txt2);">Advancing to the next round</div>' :
             '<div style="font-size:12px;color:var(--txt2);">Your tournament run is over</div>')
    + '<div class="btn btn-red" style="padding:12px 32px;font-size:13px;" onclick="closeTournamentResult(this)">CONTINUE</div>';
  panel.style.position = 'relative';
  panel.appendChild(overlay);
}

export function closeTournamentResult(btn) {
  var panel = ge('gmod').querySelector('.gpanel');
  if (panel) {
    var ov = panel.querySelector('div[style*="position:absolute"]');
    if (ov) panel.removeChild(ov);
  }
  ge('gmod').classList.remove('open');
  resolveTournamentGame();
}
