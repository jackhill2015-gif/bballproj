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
  // Sim only CPU games in the current round of user's conference
  last.forEach(function(m) {
    if (m.winner !== null) return;
    if (m.t1.id === G.tid || m.t2.id === G.tid) return;
    var res = simGame(m.t1, m.t2, true);
    m.s1 = res.homeScore; m.s2 = res.awayScore;
    m.winner = res.homeScore > res.awayScore ? m.t1 : m.t2;
  });
  // If all games in this round are done, build next round
  var allDone = last.every(function(m) { return m.winner !== null; });
  if (allDone) {
    buildNextConfRound(conf);
  }
}

export function advanceConfTourney() {
  var userConf = G.teams[G.tid].conf;

  // Advance OTHER conferences by one round each
  Object.keys(G.confTourneys).forEach(function(conf) {
    if (conf === userConf) return;
    var ct = G.confTourneys[conf];
    if (!ct || ct.done) return;
    var round = getCurrentConfRound(conf);
    if (!round) return;
    round.forEach(function(m) {
      if (m.winner !== null) return;
      var res = simGame(m.t1, m.t2, true);
      m.s1 = res.homeScore; m.s2 = res.awayScore;
      m.winner = res.homeScore > res.awayScore ? m.t1 : m.t2;
    });
    buildNextConfRound(conf);
  });

  // Check user's conference — advance CPU games in current round only
  var uct = G.confTourneys[userConf];
  if (uct && !uct.done) {
    advanceConfRoundExceptUser(userConf);
  }

  // Check if all done
  if (allConfDone() && !G.bracket.length) buildNCAA();
  saveState(); updateAll();
}

// Aliases used by doPlay
export function simConfRoundAll() { advanceConfTourney(); }
export function simConfRound(conf) {
  var ct = G.confTourneys[conf];
  if (!ct || ct.done) return;
  var round = getCurrentConfRound(conf);
  if (!round) return;
  round.forEach(function(m) {
    if (m.winner !== null) return;
    var res = simGame(m.t1, m.t2, true);
    m.s1 = res.homeScore; m.s2 = res.awayScore;
    m.winner = res.homeScore > res.awayScore ? m.t1 : m.t2;
  });
  buildNextConfRound(conf);
}
export function simConfBtn(el) {
  var c = el.getAttribute('data-conf');
  if (c) simConfFull(c);
}

// ═══════════════════════════════════════════════════════════
//  NCAA BRACKET GENERATION & SELECTION SUNDAY
// ═══════════════════════════════════════════════════════════

export function buildNCAA() {
  // ── SELECTION COMMITTEE ──
  // Step 1: Conference champs get automatic bids
  var autoBids = [];
  if (G.confTourneys) {
    Object.keys(G.confTourneys).forEach(function(conf) {
      var ct = G.confTourneys[conf];
      if (ct && ct.done && ct.champ) {
        autoBids.push(ct.champ);
      }
    });
  }

  // Step 2: Build resume score for at-large selection
  // Resume = NET pts + win% bonus + strength of schedule
  var allTeams = G.teams.map(function(t) {
    var totalGames = t.wins + t.loss;
    var winPct = totalGames > 0 ? t.wins / totalGames : 0;
    var winBonus = Math.round((winPct - 0.5) * 80); // +40 for .750, -40 for .250
    var isAutoBid = autoBids.some(function(ab) { return ab.id === t.id; });
    return {
      team: t,
      resume: t.pts + winBonus,
      isAutoBid: isAutoBid
    };
  });

  // Step 3: Sort by resume, pick auto-bids first, then fill to 64 with at-large
  allTeams.sort(function(a, b) { return b.resume - a.resume; });
  var field = [];
  var inField = {};

  // Auto-bids first
  autoBids.forEach(function(t) {
    if (!inField[t.id]) {
      field.push(t);
      inField[t.id] = true;
    }
  });

  // Fill remaining spots with at-large (best resume first)
  allTeams.forEach(function(entry) {
    if (field.length >= 64) return;
    if (inField[entry.team.id]) return;
    // At-large minimum: must have a winning record
    if (entry.team.wins <= entry.team.loss) return;
    field.push(entry.team);
    inField[entry.team.id] = true;
  });

  // If still not 64 (unlikely but safety), fill with best remaining
  allTeams.forEach(function(entry) {
    if (field.length >= 64) return;
    if (inField[entry.team.id]) return;
    field.push(entry.team);
    inField[entry.team.id] = true;
  });

  // Step 4: Seed by resume
  field.sort(function(a, b) {
    var aResume = allTeams.find(function(e) { return e.team.id === a.id; });
    var bResume = allTeams.find(function(e) { return e.team.id === b.id; });
    return (bResume ? bResume.resume : 0) - (aResume ? aResume.resume : 0);
  });

  G.bracket = field.slice(0, 64).map(function(t, i) {
    return { team: t, seed: i + 1, active: true, score: null, won: false };
  });
  G.phase = 'ncaa';

  var userSeed = G.bracket.findIndex(function(b) { return b.team.id === G.tid; }) + 1;
  if (userSeed > 0) {
    addLog('ev', G.gi, '<b>NCAA Tournament!</b> You are the #' + userSeed + ' seed.');
  } else {
    addLog('ev', G.gi, '<b>NIT bound.</b> Your program did not qualify for the NCAA Tournament.');
  }
  saveState(); updateAll();
  showBracketReveal(userSeed);
}

export function showBracketReveal(userSeed) {
  var rev = ge('bracket-reveal');
  if (!rev) return;
  rev.style.display = 'block';
  G._revealStep = 0; // Track which region we're revealing

  // User card
  if (userSeed > 0) {
    var uc = ge('br-user-card'); if (uc) uc.style.display = 'block';
    txt('br-user-team', G.teams[G.tid].name);
    var seedDesc = userSeed <= 4 ? 'Top 4 seed! You could host.' :
                   userSeed <= 8 ? 'Strong seed. Favorable draw.' :
                   userSeed <= 12 ? 'Middle of the pack. Road gets tough.' :
                   'Low seed \u2014 the country loves an underdog.';
    txt('br-user-seed', '#' + userSeed + ' Seed \u2014 ' + seedDesc);
    var idx = userSeed - 1;
    var oppIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    var opp = G.bracket[oppIdx];
    var userRegion = Math.floor(idx / 16);
    var regions = ['East', 'West', 'South', 'Midwest'];
    txt('br-user-opp', opp ? regions[userRegion] + ' Region \u2014 First Round vs #' + opp.seed + ' ' + opp.team.name : '');
    txt('br-seed-line', '32 automatic bids confirmed. 32 at-large bids decided.');
  } else {
    txt('br-seed-line', 'The field of 64 is set. Your program did not qualify.');
    var uc2 = ge('br-user-card'); if (uc2) uc2.style.display = 'none';
  }

  // Build bubble report
  var bubble = ge('br-bubble');
  if (bubble) {
    var allSorted = G.teams.slice().sort(function(a, b) { return b.pts - a.pts; });
    var firstOut = [];
    for (var bi = 0; bi < allSorted.length; bi++) {
      var inBracket = G.bracket.some(function(br) { return br.team.id === allSorted[bi].id; });
      if (!inBracket && firstOut.length < 4 && allSorted[bi].wins > allSorted[bi].loss) firstOut.push(allSorted[bi]);
    }

    // Last Four In = at-large teams with worst resumes (not auto-bids)
    // Auto-bids are conf tournament champs — they get in regardless of record
    var autoBidIds = {};
    if (G.confTourneys) {
      Object.keys(G.confTourneys).forEach(function(c) {
        var ct = G.confTourneys[c];
        if (ct && ct.champ) autoBidIds[ct.champ.id] = true;
      });
    }
    var atLarge = G.bracket.filter(function(b) { return !autoBidIds[b.team.id]; });
    atLarge.sort(function(a, b) {
      var aResume = a.team.pts || 0; var bResume = b.team.pts || 0;
      return aResume - bResume;
    });
    var lastIn = atLarge.slice(0, 4).map(function(b) { return b.team; });

    var bh = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    bh += '<div style="background:var(--s1);border:1px solid var(--grn);border-radius:6px;padding:10px;">';
    bh += '<div style="font-size:9px;font-weight:800;color:var(--grn2);letter-spacing:1px;margin-bottom:6px;">LAST FOUR IN</div>';
    lastIn.forEach(function(t) {
      bh += '<div style="font-size:11px;padding:3px 0;color:' + (t.id === G.tid ? 'var(--gld2)' : 'var(--txt)') + ';font-weight:' + (t.id === G.tid ? '800' : '500') + ';">' + t.name + ' (' + t.wins + '-' + t.loss + ')</div>';
    });
    bh += '</div>';
    bh += '<div style="background:var(--s1);border:1px solid #dc2626;border-radius:6px;padding:10px;">';
    bh += '<div style="font-size:9px;font-weight:800;color:#dc2626;letter-spacing:1px;margin-bottom:6px;">FIRST FOUR OUT</div>';
    firstOut.forEach(function(t) {
      bh += '<div style="font-size:11px;padding:3px 0;color:var(--txt2);">' + t.name + ' (' + t.wins + '-' + t.loss + ')</div>';
    });
    bh += '</div></div>';
    bubble.innerHTML = bh;
    bubble.style.display = 'block';
  }

  // Clear bracket — will fill region by region
  var wrap = ge('br-bracket');
  if (wrap) wrap.innerHTML = '';

  // Set first reveal button
  var btn = ge('br-reveal-btn');
  if (btn) { btn.textContent = 'REVEAL EAST REGION \u25b6'; btn.onclick = function() { revealNextRegion(); }; }
}

export function revealNextRegion() {
  var step = G._revealStep || 0;
  var regions = ['East', 'West', 'South', 'Midwest'];
  var wrap = ge('br-bracket');
  var btn = ge('br-reveal-btn');
  if (!wrap || step >= 4) return;

  // Build region card
  var regionStart = step * 16;
  var matchupSeeds = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

  var col = document.createElement('div');
  col.style.cssText = 'background:var(--s1);border:1px solid var(--bdr);border-radius:8px;overflow:hidden;opacity:0;transition:opacity 0.6s;';

  var header = document.createElement('div');
  header.style.cssText = 'font-size:12px;font-weight:800;color:var(--red);letter-spacing:1.5px;text-transform:uppercase;padding:10px 14px;border-bottom:1px solid var(--bdr);text-align:center;background:var(--s2);';
  header.textContent = regions[step] + ' Region';
  col.appendChild(header);

  var hasUser = false;
  matchupSeeds.forEach(function(pair) {
    var s1 = pair[0], s2 = pair[1];
    var idx1 = regionStart + s1 - 1;
    var idx2 = regionStart + s2 - 1;
    var b1 = G.bracket[idx1], b2 = G.bracket[idx2];
    if (!b1 || !b2) return;

    var isU1 = b1.team.id === G.tid, isU2 = b2.team.id === G.tid;
    if (isU1 || isU2) hasUser = true;

    var matchup = document.createElement('div');
    matchup.style.cssText = 'border-bottom:1px solid rgba(0,0,0,.04);';

    [{ b: b1, s: s1, isu: isU1 }, { b: b2, s: s2, isu: isU2 }].forEach(function(entry, idx) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;'
        + (entry.isu ? 'background:rgba(214,158,46,.12);border-left:3px solid var(--gld);' : 'border-left:3px solid transparent;')
        + (idx === 0 ? 'border-bottom:1px solid rgba(0,0,0,.03);' : '');
      row.innerHTML = '<span style="width:18px;font-family:monospace;font-size:10px;color:' + (entry.isu ? 'var(--gld2)' : 'var(--txt3)') + ';font-weight:700;text-align:right;">' + entry.s + '</span>'
        + '<span style="flex:1;font-weight:' + (entry.isu ? '800' : '500') + ';color:' + (entry.isu ? 'var(--gld2)' : 'var(--txt)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + entry.b.team.name + '</span>'
        + '<span style="font-family:monospace;font-size:10px;color:var(--txt3);">' + entry.b.team.wins + '-' + entry.b.team.loss + '</span>';
      matchup.appendChild(row);
    });
    col.appendChild(matchup);
  });

  wrap.appendChild(col);
  // Fade in
  setTimeout(function() { col.style.opacity = '1'; }, 50);

  // If user's region, add gold pulse
  if (hasUser) {
    col.style.border = '2px solid var(--gld)';
    col.style.boxShadow = '0 0 12px rgba(214,158,46,.2)';
  }

  G._revealStep = step + 1;

  // Update button
  if (step + 1 < 4) {
    btn.textContent = 'REVEAL ' + regions[step + 1].toUpperCase() + ' REGION \u25b6';
  } else {
    btn.textContent = "LET\u2019S DANCE \u25b6";
    btn.onclick = function() { closeBracketReveal(); };
  }
}

export function closeBracketReveal() {
  var rev = ge('bracket-reveal');
  if (rev) rev.style.display = 'none';
  navTo('bracket');
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

function detectCPUCinderellas() {
  if (!G.bracket) return;
  if (!G.cinderellas) G.cinderellas = [];
  var active = G.bracket.filter(function(b) { return b.active; });
  active.forEach(function(b) {
    if (b.seed >= 11 && b.team.id !== G.tid) {
      var already = G.cinderellas.some(function(c) { return c.tid === b.team.id; });
      if (!already) {
        G.cinderellas.push({ tid: b.team.id, name: b.team.name, seed: b.seed, round: active.length });
        addLog('ev', G.gi, '\ud83d\udc60 <b>Cinderella!</b> #' + b.seed + ' ' + b.team.name + ' advances \u2014 the clock hasn\u2019t struck midnight!');
      }
    }
  });
}

function checkNCAAdone() {
  var still = G.bracket.filter(function(b) { return b.active; });
  if (still.length === 1) {
    var ch = still[0].team;
    if (ch.id === G.tid) {
      G.championships++;
      var t = G.teams[G.tid];
      t.schoolPrestige = Math.min(100, (t.schoolPrestige || 50) + 12);
      if (G.coach) G.coach.rec = Math.min(99, (G.coach.rec || 70) + 3);
      if (G.cinderellaRun) {
        t.schoolPrestige = Math.min(100, t.schoolPrestige + 8);
        G.coach.rec = Math.min(99, G.coach.rec + 5);
        addLog('ev', G.gi, '\ud83d\udc60\ud83c\udfc6 <b>CINDERELLA CHAMPIONS!</b> The greatest underdog story in tournament history!');
      }
      addLog('ev', G.gi, '<b>NATIONAL CHAMPIONS! \ud83c\udfc6</b> +12 prestige!');
      toast('NATIONAL CHAMPIONS!!!', 'var(--gld)');
    } else {
      addLog('ev', G.gi, ch.name + ' wins the National Championship.');
      if (!G.leagueChamps) G.leagueChamps = [];
      G.leagueChamps.push({ year: G.yr, name: ch.name, tid: ch.id });
    }
    G.cinderellas = [];
    G.cinderellaRun = false;
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
  var userIsHome = LS.tH && LS.tH.id === G.tid;
  var uScore = userIsHome ? LS.hs : LS.as;
  var oScore = userIsHome ? LS.as : LS.hs;

  if (game._type === 'conf') {
    var m = game._matchup;
    var conf = game._conf;
    m.s1 = LS.hs; m.s2 = LS.as;
    m.winner = LS.hs > LS.as ? m.t1 : m.t2;
    var userWon = (m.winner.id === G.tid);
    var oppName = (m.t1.id === G.tid ? m.t2 : m.t1).name;
    if (userWon) {
      toast(userTeam.name + ' ADVANCES! ' + uScore + '-' + oScore, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName + '</b> ' + uScore + '\u2013' + oScore + ' (Conf Tourney)');
    } else {
      toast('Eliminated by ' + oppName + ' ' + uScore + '-' + oScore, 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName + '</b> ' + uScore + '\u2013' + oScore + ' (Conf Tourney)');
    }
    advanceConfRoundExceptUser(conf);
    // Also advance other conferences one round
    Object.keys(G.confTourneys).forEach(function(c) {
      if (c === conf) return;
      var oct = G.confTourneys[c];
      if (!oct || oct.done) return;
      var round = getCurrentConfRound(c);
      if (!round) return;
      round.forEach(function(rm) {
        if (rm.winner !== null) return;
        var res3 = simGame(rm.t1, rm.t2, true);
        rm.s1 = res3.homeScore; rm.s2 = res3.awayScore;
        rm.winner = res3.homeScore > res3.awayScore ? rm.t1 : rm.t2;
      });
      buildNextConfRound(c);
    });
    // Check if everything is done
    if (allConfDone() && !G.bracket.length) buildNCAA();
  } else if (game._type === 'ncaa') {
    var b1 = game._b1, b2 = game._b2;
    b1.score = LS.hs; b2.score = LS.as;
    if (LS.hs > LS.as) { b1.won = true; b2.won = false; b2.active = false; }
    else { b2.won = true; b1.won = false; b1.active = false; }
    var userWon2 = (b1.team.id === G.tid) ? (LS.hs > LS.as) : (LS.as > LS.hs);
    var oppName2 = (b1.team.id === G.tid ? b2 : b1).team.name;
    var remaining = G.bracket.filter(function(b) { return b.active; }).length;

    if (userWon2) {
      // Round-specific headlines and prestige bonuses
      var userSeed = (b1.team.id === G.tid) ? b1.seed : b2.seed;
      var oppSeed = (b1.team.id === G.tid) ? b2.seed : b1.seed;
      var isUpset = userSeed > oppSeed + 3;
      var roundMsg = '';
      var prestigeGain = 0;

      if (remaining <= 2) { roundMsg = 'CHAMPIONSHIP BOUND!'; prestigeGain = 8; }
      else if (remaining <= 4) { roundMsg = 'FINAL FOUR!'; prestigeGain = 5; }
      else if (remaining <= 8) { roundMsg = 'ELITE EIGHT!'; prestigeGain = 3; }
      else if (remaining <= 16) { roundMsg = 'SWEET 16!'; prestigeGain = 2; }
      else if (remaining <= 32) { roundMsg = 'Moving on!'; prestigeGain = 1; }
      else { roundMsg = 'ADVANCING!'; prestigeGain = 1; }

      // Cinderella bonus: 11+ seed reaching Sweet 16+
      if (userSeed >= 11 && remaining <= 16) {
        prestigeGain += 5;
        if (!G.cinderellaRun) G.cinderellaRun = true;
        addLog('ev', G.gi, '\ud83d\udc60 <b>CINDERELLA ALERT!</b> #' + userSeed + ' ' + userTeam.name + ' keeps dancing! The country is watching.');
      }

      // Upset bonus
      if (isUpset) {
        prestigeGain += 2;
        addLog('ev', G.gi, '\ud83d\udea8 <b>UPSET!</b> #' + userSeed + ' ' + userTeam.name + ' stuns #' + oppSeed + ' ' + oppName2 + '! ' + uScore + '-' + oScore);
      }

      // Apply prestige
      var t = G.teams[G.tid];
      t.schoolPrestige = Math.min(100, (t.schoolPrestige || 50) + prestigeGain);

      toast(userTeam.name + ' ADVANCES! ' + roundMsg, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName2 + '</b> ' + uScore + '\u2013' + oScore + ' (NCAA \u2014 ' + roundMsg + ')');
    } else {
      // Elimination — record how far we got
      var finalRound = remaining <= 2 ? 'Championship Game' : remaining <= 4 ? 'Final Four' : remaining <= 8 ? 'Elite Eight' : remaining <= 16 ? 'Sweet 16' : remaining <= 32 ? 'Round of 32' : 'Round of 64';
      toast('Season over. Eliminated in the ' + finalRound + '.', 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName2 + '</b> ' + uScore + '\u2013' + oScore + ' (NCAA \u2014 ' + finalRound + ')');
      G.seasonAchievements = G.seasonAchievements || {};
      G.seasonAchievements.tourneyFinish = finalRound;
    }

    // Detect CPU Cinderellas and upsets
    detectCPUCinderellas();

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
  var userIsHome = LS.tH && LS.tH.id === G.tid;
  var uScore = userIsHome ? LS.hs : LS.as;
  var oScore = userIsHome ? LS.as : LS.hs;
  var won = uScore > oScore;
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
