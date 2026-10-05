// ═══════════════════════════════════════════════════════════
//  HOOPS OS — tournament.js
//  Conference tournaments, NCAA bracket generation,
//  Selection Sunday reveal, tournament game play/resolution.
// ═══════════════════════════════════════════════════════════

import { payTourneyWin } from './finance.js';
import { recomputeRatings, resumeScore } from './ratings.js';
import { ge, txt, fmtScore } from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { simGame } from './simulation.js';
import { recordGameMorale } from './morale.js';
import { snapRoster, userLinesFromRes, surfaceUserGameRecords } from './records.js';

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

// Postseason games count in each team's overall record (conference and
// NCAA tournaments), like real season W-L. Conference W-L is unaffected.
function tallyPostseason(winner, loser) {
  if (!winner || !loser) return;
  winner.wins = (winner.wins || 0) + 1;
  loser.loss = (loser.loss || 0) + 1;
}

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
      carry: [], // teams holding a bye into the next round
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
  ct.carry = ct.carry || [];
  var survivors;
  if (ct.rounds.length === 0) {
    survivors = ct.seeds.slice();
  } else {
    var last = ct.rounds[ct.rounds.length - 1];
    survivors = last.map(function(m) { return m.winner; }).filter(Boolean);
  }
  // Fold in teams holding a bye — they advance without playing a game,
  // so nobody is ever silently dropped when the count is odd.
  if (ct.carry.length) {
    survivors = ct.carry.concat(survivors);
    ct.carry = [];
  }
  if (survivors.length <= 1) {
    ct.done = true;
    ct.champ = survivors[0] || null;
    if (ct.champ) {
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
  // Rank survivors by original tournament seed (ct.seeds is best-first)
  var rank = {};
  ct.seeds.forEach(function(t, i) { rank[t.id] = i; });
  function seedRank(t) { return rank[t.id] === undefined ? 1e9 : rank[t.id]; }
  var ranked = survivors.slice().sort(function(a, b) { return seedRank(a) - seedRank(b); });
  // Byes: while the survivor count is odd, the best remaining seed
  // advances automatically instead of dropping the last team.
  while (survivors.length % 2 === 1) {
    var byeTeam = ranked.shift();
    var bi = survivors.findIndex(function(t) { return t.id === byeTeam.id; });
    if (bi >= 0) survivors.splice(bi, 1);
    ct.carry.push(byeTeam);
  }
  var round = [];
  if (ct.rounds.length === 0) {
    // Opening round: proper seeding — 1vN, 2v(N-1), … (never #1 vs #2)
    var n = ranked.length;
    for (var i = 0; i < n / 2; i++) {
      round.push({ t1: ranked[i], t2: ranked[n - 1 - i], s1: null, s2: null, winner: null });
    }
  } else {
    // Later rounds: fixed bracket — winners meet in game order
    for (var j = 0; j < survivors.length - 1; j += 2) {
      round.push({ t1: survivors[j], t2: survivors[j + 1], s1: null, s2: null, winner: null });
    }
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
      tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
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
    tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
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
      tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
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
    tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
  });
  buildNextConfRound(conf);
}

// ═══════════════════════════════════════════════════════════
//  NCAA BRACKET MODEL (single source of truth)
// ───────────────────────────────────────────────────────────
// G.bracket is a flat 64-entry array in winner-advancement order:
// region by region, each region stored as its 8 first-round games
// [1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15].
// Adjacent entries ALWAYS play each other — in round 1 AND every later
// round, because filtering to winners preserves order. `seed` is the
// REGION seed (1-16). The sim (simNCAAround) and every display read this
// same layout, so they cannot disagree with each other.
// ═══════════════════════════════════════════════════════════
var NCAA_REGIONS = ['East', 'West', 'South', 'Midwest'];
var NCAA_FIRST_ROUND = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

function ncaaSeedEntry(region, seed) {
  for (var i = 0; i < G.bracket.length; i++) {
    var b = G.bracket[i];
    if (b.region === region && b.seed === seed) return b;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
//  NCAA BRACKET GENERATION & SELECTION SUNDAY
// ═══════════════════════════════════════════════════════════

export function buildNCAA() {
  // Rankings fold in the conference tournaments before the committee meets.
  recomputeRatings();
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
  // Resume = SOS-adjusted power rating + small win% credit (ratings.js)
  var allTeams = G.teams.map(function(t) {
    var totalGames = t.wins + t.loss;
    var winPct = totalGames > 0 ? t.wins / totalGames : 0;
    var isAutoBid = autoBids.some(function(ab) { return ab.id === t.id; });
    return {
      team: t,
      resume: resumeScore(t),
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

  // Step 4: Seed by resume → overall seeds 1..64, then deal them into
  // 4 regions: overall seed i becomes region ((i-1)%4), region-seed
  // floor((i-1)/4)+1. So the four #1 seeds are the top-4 overall teams,
  // the four #2 seeds the next four, etc. (standard distribution —
  // no more #1 playing #2 in round 1).
  field.sort(function(a, b) {
    var aResume = allTeams.find(function(e) { return e.team.id === a.id; });
    var bResume = allTeams.find(function(e) { return e.team.id === b.id; });
    return (bResume ? bResume.resume : 0) - (aResume ? aResume.resume : 0);
  });
  var overall = field.slice(0, 64);
  var byRegion = [[], [], [], []];
  overall.forEach(function(t, i) {
    byRegion[i % 4][Math.floor(i / 4)] = t; // index = region seed - 1
  });

  // Step 5: Lay out the bracket in winner-advancement order (see
  // NCAA BRACKET MODEL above): region by region, each region stored as
  // [1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15].
  G.bracket = [];
  for (var r = 0; r < 4; r++) {
    NCAA_FIRST_ROUND.forEach(function(pair) {
      pair.forEach(function(s) {
        G.bracket.push({ team: byRegion[r][s - 1], seed: s, region: r, active: true, score: null, won: false });
      });
    });
  }
  G.phase = 'ncaa';

  var userEntry = null;
  for (var bi = 0; bi < G.bracket.length; bi++) {
    if (G.bracket[bi].team.id === G.tid) { userEntry = G.bracket[bi]; break; }
  }
  var userSeed = userEntry ? userEntry.seed : 0;
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

  // Bid split: every conference champ is an automatic bid, the rest are at-large
  var autoCount = 0;
  if (G.confTourneys) {
    Object.keys(G.confTourneys).forEach(function(c) {
      var cct = G.confTourneys[c];
      if (cct && cct.champ) autoCount++;
    });
  }
  var bidLine = autoCount + ' automatic bids, ' + (G.bracket.length - autoCount) + ' at-large bids';

  // User card
  if (userSeed > 0) {
    var uc = ge('br-user-card'); if (uc) uc.style.display = 'block';
    txt('br-user-team', G.teams[G.tid].name);
    var seedDesc = userSeed === 1 ? 'a top seed' : userSeed <= 4 ? 'a protected seed' : userSeed <= 8 ? 'a middle seed' : 'a double-digit seed';
    txt('br-user-seed', userSeed + ' seed, ' + seedDesc);
    // Find the user's entry, then its real first-round opponent: the team
    // holding the paired seed in the same region — the exact game the sim
    // will play (see NCAA BRACKET MODEL above).
    var userEntry = null;
    for (var bi2 = 0; bi2 < G.bracket.length; bi2++) {
      if (G.bracket[bi2].team.id === G.tid) { userEntry = G.bracket[bi2]; break; }
    }
    var opp = null, userRegionName = '';
    if (userEntry) {
      userRegionName = NCAA_REGIONS[userEntry.region];
      for (var mi = 0; mi < NCAA_FIRST_ROUND.length; mi++) {
        var pair = NCAA_FIRST_ROUND[mi];
        if (pair[0] === userEntry.seed) opp = ncaaSeedEntry(userEntry.region, pair[1]);
        else if (pair[1] === userEntry.seed) opp = ncaaSeedEntry(userEntry.region, pair[0]);
      }
    }
    txt('br-user-opp', opp ? userRegionName + ' region. First round vs ' + opp.seed + ' ' + opp.team.name + ' (' + opp.team.wins + '-' + opp.team.loss + ').' : '');
    txt('br-seed-line', bidLine.charAt(0).toUpperCase() + bidLine.slice(1) + ' confirmed.');
  } else {
    txt('br-seed-line', 'The field of 64 is set (' + bidLine + '). Your program did not qualify.');
    var uc2 = ge('br-user-card'); if (uc2) uc2.style.display = 'none';
  }

  // Build bubble report
  var bubble = ge('br-bubble');
  if (bubble) {
    var allSorted = G.teams.slice().sort(function(a, b) { return resumeScore(b) - resumeScore(a); });
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
      var aResume = resumeScore(a.team); var bResume = resumeScore(b.team);
      return aResume - bResume;
    });
    var lastIn = atLarge.slice(0, 4).map(function(b) { return b.team; });

    function bubbleList(title, list, note) {
      var h = '<div class="panel"><div class="panel-h"><span>' + title + '</span><small>' + note + '</small></div><div class="panel-b flush"><table><tbody>';
      list.forEach(function(t) {
        h += '<tr' + (t.id === G.tid ? ' class="hl"' : '') + '><td>' + t.name + '</td><td class="dim">' + t.conf + '</td><td class="num">' + t.wins + '-' + t.loss + '</td></tr>';
      });
      return h + '</tbody></table></div></div>';
    }
    var bh = '<div class="grid-2">' + bubbleList('Last four in', lastIn, 'At-large') + bubbleList('First four out', firstOut, 'Missed the field') + '</div>';
    bubble.innerHTML = bh;
    bubble.style.display = 'block';
  }

  // Clear bracket — one click reveals the entire field at once
  var wrap = ge('br-bracket');
  if (wrap) wrap.innerHTML = '';

  // Single reveal button: one action spawns all four regions immediately
  var btn = ge('br-reveal-btn');
  if (btn) { btn.textContent = 'Reveal the field'; btn.onclick = function() { revealFullBracket(); }; }
}

// Builds one region's reveal card from G.bracket layout — the same layout
// the sim plays, so the reveal always matches the games.
function buildRevealRegionCard(step) {
  var col = document.createElement('div');
  col.className = 'panel brv-fade';
  var hasUser = G.bracket.some(function(b) { return b.region === step && b.team.id === G.tid; });
  var h = '<div class="panel-h"><span>' + NCAA_REGIONS[step] + ' region</span><small>' + (hasUser ? 'Your region' : 'First round') + '</small></div><div class="panel-b"><div class="brv-games">';
  NCAA_FIRST_ROUND.forEach(function(pair) {
    var b1 = ncaaSeedEntry(step, pair[0]), b2 = ncaaSeedEntry(step, pair[1]);
    if (!b1 || !b2) return;
    var mine = b1.team.id === G.tid || b2.team.id === G.tid;
    h += '<div class="bx' + (mine ? ' mine' : '') + '">';
    [b1, b2].forEach(function(b) {
      h += '<div class="bx-team' + (b.team.id === G.tid ? ' me' : '') + '"><span class="bx-seed">' + b.seed + '</span>'
        + '<span class="bx-name">' + b.team.name + '</span><span class="bx-sc">' + b.team.wins + '-' + b.team.loss + '</span></div>';
    });
    h += '</div>';
  });
  col.innerHTML = h + '</div></div>';
  return col;
}

// Full-field reveal: ONE click spawns the entire bracket at once — all four
// regions, immediately. No region-by-region stepping.
export function revealFullBracket() {
  var wrap = ge('br-bracket');
  var btn = ge('br-reveal-btn');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (var step = 0; step < 4; step++) {
    wrap.appendChild(buildRevealRegionCard(step));
  }
  // Simultaneous fade-in for the dramatic full reveal
  var cols = wrap.children;
  for (var i = 0; i < cols.length; i++) {
    (function(col) { setTimeout(function() { col.style.opacity = '1'; }, 60); })(cols[i]);
  }
  if (btn) {
    btn.textContent = "Go to the tournament";
    btn.onclick = function() { closeBracketReveal(); };
  }
}

export function closeBracketReveal() {
  var rev = ge('bracket-reveal');
  if (rev) rev.style.display = 'none';
  // Home page auto-shows the tournament in ncaa phase — land there.
  navTo('dashboard');
}

// ═══════════════════════════════════════════════════════════
//  NCAA ROUND SIMULATION
// ═══════════════════════════════════════════════════════════

// Resolve one NCAA game. Each entry keeps its score from every round in
// b.sc (round 0 = round of 64), so the bracket view can draw the full tree.
function scoreNCAAgame(b1, b2, s1, s2) {
  if (!b1.sc) b1.sc = [];
  if (!b2.sc) b2.sc = [];
  b1.sc.push(s1); b2.sc.push(s2);
  b1.score = s1; b2.score = s2;
  if (s1 > s2) { b1.won = true; b2.won = false; b2.active = false; }
  else { b2.won = true; b1.won = false; b1.active = false; }
  tallyPostseason(b1.won ? b1.team : b2.team, b1.won ? b2.team : b1.team);
}

export function simNCAAround() {
  var active = G.bracket.filter(function(b) { return b.active; });
  if (active.length <= 1) return;
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    var res = simGame(b1.team, b2.team, true);
    scoreNCAAgame(b1, b2, res.homeScore, res.awayScore);
  }
  checkNCAAdone();
  saveState(); updateAll();
  if (SetupState.ACTIVE_VIEW === 'bracket' && _ext.renderBracket) _ext.renderBracket();
}

function simNCAArimExceptUser() {
  // Sim every game of the current round except the user's. MUST be called
  // while the user's pair is still adjacent in the active order (i.e. before
  // the user's own game is resolved) — the id check below then skips exactly
  // that pair and every other pairing stays bracket-correct.
  var active = G.bracket.filter(function(b) { return b.active; });
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    if (b1.team.id === G.tid || b2.team.id === G.tid) continue;
    var res = simGame(b1.team, b2.team, true);
    scoreNCAAgame(b1, b2, res.homeScore, res.awayScore);
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
        addLog('ev', G.gi, '<b>Cinderella run:</b> #' + b.seed + ' ' + b.team.name + ' advances.');
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
        // Records: snapshot for the post-game diff (live path)
        LS._recPre = { h: snapRoster(m.t1), a: snapRoster(m.t2), hid: m.t1.id, aid: m.t2.id };
        if (_ext.openModal) _ext.openModal(m.t1, m.t2, true, rn);
      } else {
        var res = simGame(m.t1, m.t2, true);
        LS.hs = res.homeScore; LS.as = res.awayScore;
        LS._recLines = userLinesFromRes(res);
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
        // Records: snapshot for the post-game diff (live path)
        LS._recPre = { h: snapRoster(um2.b1.team), a: snapRoster(um2.b2.team), hid: um2.b1.team.id, aid: um2.b2.team.id };
        if (_ext.openModal) _ext.openModal(um2.b1.team, um2.b2.team, true, getNCAAroundName());
      } else {
        var res2 = simGame(um2.b1.team, um2.b2.team, true);
        LS.hs = res2.homeScore; LS.as = res2.awayScore;
        LS._recLines = userLinesFromRes(res2);
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
    tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
    var userWon = (m.winner.id === G.tid);
    var oppName = (m.t1.id === G.tid ? m.t2 : m.t1).name;
    var oppTeam = (m.t1.id === G.tid ? m.t2 : m.t1);
    G.lastResult = { yr: G.yr, oppId: oppTeam.id, home: null, u: uScore, o: oScore, won: userWon, wk: G.gi, label: conf + ' tournament' };
    // Morale: tournament games swing moods too
    recordGameMorale(userWon ? userTeam : oppTeam, userWon ? oppTeam : userTeam);
    if (userWon) {
      toast(userTeam.name + ' ADVANCES! ' + fmtScore(uScore, oScore, '-'), 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName + '</b> ' + fmtScore(uScore, oScore) + ' (Conf Tourney)');
    } else {
      toast('Eliminated by ' + oppName + ', ' + fmtScore(uScore, oScore, '-'), 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName + '</b> ' + fmtScore(uScore, oScore) + ' (Conf Tourney)');
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
        tallyPostseason(rm.winner, rm.winner === rm.t1 ? rm.t2 : rm.t1);
      });
      buildNextConfRound(c);
    });
    // Check if everything is done
    if (allConfDone() && !G.bracket.length) buildNCAA();
  } else if (game._type === 'ncaa') {
    var b1 = game._b1, b2 = game._b2;
    // Sim the rest of the round FIRST, while the user's pair is still
    // adjacent in the active order. Resolving the user's game first would
    // drop its loser from the list, shifting every later pairing and even
    // leaving one team with no game at all (T1).
    simNCAArimExceptUser();
    scoreNCAAgame(b1, b2, LS.hs, LS.as);
    var userWon2 = (b1.team.id === G.tid) ? (LS.hs > LS.as) : (LS.as > LS.hs);
    var oppName2 = (b1.team.id === G.tid ? b2 : b1).team.name;
    var oppTeam2 = (b1.team.id === G.tid ? b2 : b1).team;
    // Morale: tournament games swing moods too
    recordGameMorale(userWon2 ? userTeam : oppTeam2, userWon2 ? oppTeam2 : userTeam);
    // Teams left AFTER the full round: 32 / 16 / 8 / 4 / 2 / 1
    var remaining = G.bracket.filter(function(b) { return b.active; }).length;
    G.lastResult = { yr: G.yr, oppId: oppTeam2.id, home: null, u: uScore, o: oScore, won: userWon2, wk: G.gi, label: 'NCAA tournament' };
    // Tournament payout per win, larger each round (remaining after the round: 32 → round of 64 win)
    if (userWon2) payTourneyWin({ 32: 0, 16: 1, 8: 2, 4: 3, 2: 4, 1: 5 }[remaining] || 0);

    if (userWon2) {
      // Round-specific headlines and prestige bonuses
      var userSeed = (b1.team.id === G.tid) ? b1.seed : b2.seed;
      var oppSeed = (b1.team.id === G.tid) ? b2.seed : b1.seed;
      var isUpset = userSeed > oppSeed + 3;
      var roundMsg = '';
      var prestigeGain = 0;

      if (remaining <= 1) { roundMsg = 'CHAMPIONSHIP BOUND!'; prestigeGain = 8; }
      else if (remaining <= 2) { roundMsg = 'FINAL FOUR!'; prestigeGain = 5; }
      else if (remaining <= 4) { roundMsg = 'ELITE EIGHT!'; prestigeGain = 3; }
      else if (remaining <= 8) { roundMsg = 'SWEET 16!'; prestigeGain = 2; }
      else if (remaining <= 16) { roundMsg = 'Moving on!'; prestigeGain = 1; }
      else { roundMsg = 'ADVANCING!'; prestigeGain = 1; }

      // Cinderella bonus: 11+ seed reaching Sweet 16+
      if (userSeed >= 11 && remaining <= 8) {
        prestigeGain += 5;
        if (!G.cinderellaRun) G.cinderellaRun = true;
        addLog('ev', G.gi, '\ud83d\udc60 <b>CINDERELLA ALERT!</b> #' + userSeed + ' ' + userTeam.name + ' keeps dancing! The country is watching.');
      }

      // Upset bonus
      if (isUpset) {
        prestigeGain += 2;
        addLog('ev', G.gi, '\ud83d\udea8 <b>UPSET!</b> #' + userSeed + ' ' + userTeam.name + ' stuns #' + oppSeed + ' ' + oppName2 + '! ' + fmtScore(uScore, oScore, '-'));
      }

      // Apply prestige
      var t = G.teams[G.tid];
      t.schoolPrestige = Math.min(100, (t.schoolPrestige || 50) + prestigeGain);

      toast(userTeam.name + ' ADVANCES! ' + roundMsg, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName2 + '</b> ' + fmtScore(uScore, oScore) + ' (NCAA \u2014 ' + roundMsg + ')');
    } else {
      // Elimination — record how far we got (post-round team counts)
      var finalRound = remaining <= 1 ? 'Championship Game' : remaining <= 2 ? 'Final Four' : remaining <= 4 ? 'Elite Eight' : remaining <= 8 ? 'Sweet 16' : remaining <= 16 ? 'Round of 32' : 'Round of 64';
      toast('Season over. Eliminated in the ' + finalRound + '.', 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName2 + '</b> ' + fmtScore(uScore, oScore) + ' (NCAA \u2014 ' + finalRound + ')');
      G.seasonAchievements = G.seasonAchievements || {};
      G.seasonAchievements.tourneyFinish = finalRound;
    }

    // Detect CPU Cinderellas now that the full round is decided
    detectCPUCinderellas();

    checkNCAAdone();
  }
  // Records: surface any broken single-game school records (no-op if none).
  surfaceUserGameRecords();
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
  overlay.className = 'tres';
  overlay.style.cssText = 'position:absolute;inset:0;z-index:10;';
  var me = G.teams[G.tid];
  var nextLine = won
    ? (G.phase === 'ncaa' ? 'On to the next round.' : 'On to the next round of the conference tournament.')
    : (G.phase === 'ncaa' ? 'Your NCAA tournament run is over.' : 'Your conference tournament is over.');
  overlay.innerHTML = '<div class="tres-in">'
    + '<div class="tres-k">' + roundName.replace('NCAA Tournament \u2014 ', 'NCAA tournament, ') + ' · Final</div>'
    + '<div class="tres-v ' + (won ? 'w' : 'l') + '">' + (won ? 'Win' : 'Loss') + '</div>'
    + '<div class="tres-rows">'
    + '<div class="tres-row' + (won ? ' w' : '') + '"><span>' + me.name + '</span><b>' + uScore + '</b></div>'
    + '<div class="tres-row' + (won ? '' : ' w') + '"><span>' + opp.name + '</span><b>' + oScore + '</b></div>'
    + '</div>'
    + '<div class="tres-s">' + nextLine + '</div>'
    + '<button class="btn-big" style="width:auto;padding:0 32px;" onclick="closeTournamentResult(this)">Continue</button>'
    + '</div>';
  panel.style.position = 'relative';
  panel.appendChild(overlay);
}

export function closeTournamentResult(btn) {
  var panel = ge('gmod').querySelector('.gpanel');
  if (panel) {
    var ov = panel.querySelector('.tres') || panel.querySelector('div[style*="position:absolute"]');
    if (ov) panel.removeChild(ov);
  }
  ge('gmod').classList.remove('open');
  resolveTournamentGame();
}
