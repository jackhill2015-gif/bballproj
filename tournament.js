// ═══════════════════════════════════════════════════════════
//  HOOPS OS — tournament.js
//  Conference tournaments, NCAA bracket generation,
//  Selection Sunday reveal, tournament game play/resolution.
// ═══════════════════════════════════════════════════════════

import { formatFor, roundsIn } from './confformats.js';
import { payTourneyWin, payOpeningWin } from './finance.js';
import { recomputeRatings, resumeScore } from './ratings.js';
import { selectionSundayPoll } from './poll.js';
import { ge, txt, fmtScore, otLabel } from './utils.js';
import { G, LS, SetupState, saveState } from './state.js';
import { simGame, SITE } from './simulation.js';
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
  if (openingPending()) return 'NCAA Tournament \u2014 Opening Round';
  var active = G.bracket.filter(function(b) { return b.active; }).length;
  var names = {
    64: 'Round of 64', 32: 'Round of 32', 16: 'Sweet 16',
    8: 'Elite Eight', 4: 'Final Four', 2: 'Championship Game'
  };
  return 'NCAA Tournament \u2014 ' + (names[active] || '');
}

// Round names count back from the final (an 18-team bracket has five
// rounds: first round, second round, quarterfinals, semifinals, final)
export function confRoundLabel(ct, ri, short) {
  var n = (ct && ct.seeds) ? ct.seeds.length : 8;
  var total = (ct && ct.fmt) ? roundsIn(ct.fmt) : Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
  var fromEnd = total - 1 - ri;
  if (fromEnd === 0) return short ? 'Final' : 'Championship';
  if (fromEnd === 1) return short ? 'SF' : 'Semifinals';
  if (fromEnd === 2) return short ? 'QF' : 'Quarterfinals';
  return short ? 'R' + (ri + 1) : (ri === 0 ? 'First round' : ri === 1 ? 'Second round' : 'Round ' + (ri + 1));
}
export function getConfRoundName(ct, conf) {
  if (!ct || !ct.rounds) return (conf || '') + ' tournament';
  return (conf || '') + ' tournament, ' + confRoundLabel(ct, ct.rounds.length - 1, false).toLowerCase();
}

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENTS
// ═══════════════════════════════════════════════════════════

// NCAA eligibility: schools still reclassifying in 2026-27 (constants.js
// INELIGIBLE_2026) can't take a bid. The game stays on 2026-27 status.
export function isEligible(t) {
  return !(t && t.ineligible);
}
// The conference's automatic bid: the champion, or, when he isn't eligible,
// the runner-up (the NEC plays an "AQ game"; this stands in for it), else
// the best eligible seed
export function autoBid(ct) {
  if (!ct) return null;
  return ct.bid !== undefined ? ct.bid : ct.champ;
}
function crownChampion(conf, ct, champ) {
  ct.done = true;
  ct.champ = champ;
  ct.bid = champ;
  if (!champ) return;
  if (champ.id === G.tid) {
    G.confTitles++; G.prestige = Math.min(5, G.prestige + 1);
    addLog('ev', G.gi, '<b>' + conf + ' tournament champions.</b>');
    toast(conf + ' tournament champions', 'var(--gld)');
  } else {
    addLog('ev', G.gi, conf + ' won by <b>' + champ.name + '</b>');
  }
  if (isEligible(champ)) return;
  var fin = ct.rounds.length ? ct.rounds[ct.rounds.length - 1] : [];
  var m = fin.filter(function(x) { return x.winner && x.winner.id === champ.id; })[0];
  var runnerUp = m ? (m.t1 && m.t1.id === champ.id ? m.t2 : m.t1) : null;
  ct.bid = (runnerUp && isEligible(runnerUp)) ? runnerUp : ((ct.seeds || []).filter(function(t) { return t && isEligible(t); })[0] || null);
  addLog('ev', G.gi, champ.name + ' is not eligible for the NCAA tournament yet' + (ct.bid ? '. <b>' + ct.bid.name + '</b> takes the ' + conf + '’s automatic bid.' : '.'));
}

// Real-format round builder: last round's winners + the seeds entering
// this round, paired best seed vs worst. Campus games: higher seed hosts.
function buildFormatRound(conf, ct) {
  var r = ct.rounds.length, fmt = ct.fmt;
  var field = r === 0 ? [] : ct.rounds[r - 1].map(function(m) { return m.winner; }).filter(Boolean);
  var ent = fmt.enter[r];
  if (ent) for (var s = ent[0]; s <= ent[1]; s++) if (ct.seeds[s - 1]) field.push(ct.seeds[s - 1]);
  if (field.length <= 1 && !fmt.enter[r + 1]) {
    crownChampion(conf, ct, field[0] || null);
    return;
  }
  var rank = {};
  ct.seeds.forEach(function(t, i) { rank[t.id] = i; });
  field.sort(function(a, b) { return rank[a.id] - rank[b.id]; });
  var campus = fmt.campus === 'all' || (typeof fmt.campus === 'number' && r < fmt.campus);
  var round = [], n = field.length;
  for (var i = 0; i < Math.floor(n / 2); i++) {
    round.push({ t1: field[i], t2: field[n - 1 - i], s1: null, s2: null, winner: null, campus: campus });
  }
  ct.rounds.push(round);
}

// Conference game: neutral site unless the format puts it on campus
// (then t1, the higher seed, hosts)
function simConf(m) {
  SITE.campus = !!m.campus;
  try { return simGame(m.t1, m.t2, true); } finally { SITE.campus = false; }
}

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
    var fmt = formatFor(conf, teams.length); // real format (confformats.js)
    G.confTourneys[conf] = {
      seeds: teams,            // every team, ranked; the top fmt.q qualify
      fmt: fmt,
      rounds: [],
      carry: [], // teams holding a bye into the next round (older saves)
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
  if (ct.fmt) { buildFormatRound(conf, ct); return; }
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
    crownChampion(conf, ct, survivors[0] || null);
    return;
  }
  // Rank survivors by original tournament seed (ct.seeds is best-first)
  var rank = {};
  ct.seeds.forEach(function(t, i) { rank[t.id] = i; });
  function seedRank(t) { return rank[t.id] === undefined ? 1e9 : rank[t.id]; }
  var ranked = survivors.slice().sort(function(a, b) { return seedRank(a) - seedRank(b); });
  var round = [];
  var n = ranked.length;
  var isPow2 = (n & (n - 1)) === 0;
  if (ct.rounds.length === 0 && !isPow2) {
    // Opening round with byes (how real conference tournaments work):
    // with N teams and P the largest power of two below N, the bottom
    // 2*(N-P) seeds play N-P games and everyone else waits one round.
    // 18 teams → seeds 15-18 play two games; seeds 1-14 get a bye.
    var P = 1; while (P * 2 <= n) P *= 2;
    var games = n - P;
    var playIn = ranked.slice(n - 2 * games);
    ct.carry = ranked.slice(0, n - 2 * games);
    for (var k = 0; k < games; k++) {
      round.push({ t1: playIn[k], t2: playIn[playIn.length - 1 - k], s1: null, s2: null, winner: null });
    }
  } else {
    // Every other round: best remaining seed plays the worst (1 v 16, 2 v 15 …)
    if (n % 2 === 1) { ct.carry.push(ranked.shift()); n--; } // safety net, never hit with the format above
    for (var i = 0; i < n / 2; i++) {
      round.push({ t1: ranked[i], t2: ranked[n - 1 - i], s1: null, s2: null, winner: null });
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
  if (openingPending()) return null; // the 64 starts after the Opening Round
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
      var res = simConf(m);
      m.s1 = res.homeScore; m.s2 = res.awayScore; if (res.ot) m.ot = res.ot;
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
    var res = simConf(m);
    m.s1 = res.homeScore; m.s2 = res.awayScore; if (res.ot) m.ot = res.ot;
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
      var res = simConf(m);
      m.s1 = res.homeScore; m.s2 = res.awayScore; if (res.ot) m.ot = res.ot;
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
    var res = simConf(m);
    m.s1 = res.homeScore; m.s2 = res.awayScore; if (res.ot) m.ot = res.ot;
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

// ═══ 2027 FORMAT: 76 TEAMS, 12-GAME OPENING ROUND ═══
var FIELD_SIZE = 76;
// Overall seed index (0-63) = (seed - 1) * 4 + region
var OPEN_AL_POS = [40, 41, 42, 43, 44, 45];   // the four 11 seeds, 12 seeds in regions 0-1
var OPEN_AUTO_POS = [58, 59, 60, 61, 62, 63]; // 15 seeds in regions 2-3, the four 16 seeds

export function openingPending() { return !!(G.ncaaOpening && !G.ncaaOpening.done); }
export function getUserOpeningGame() {
  if (!G.ncaaOpening) return null;
  for (var i = 0; i < G.ncaaOpening.games.length; i++) {
    var g = G.ncaaOpening.games[i];
    if (!g.winner && (g.t1.id === G.tid || g.t2.id === G.tid)) return g;
  }
  return null;
}
export function bracketEntryAt(pos) {
  var region = pos % 4, seed = Math.floor(pos / 4) + 1;
  for (var i = 0; i < (G.bracket || []).length; i++) if (G.bracket[i].region === region && G.bracket[i].seed === seed) return G.bracket[i];
  return null;
}
function scoreOpening(g, s1, s2, ot) {
  g.s1 = s1; g.s2 = s2;
  if (ot) g.ot = ot;
  g.winner = s1 > s2 ? g.t1 : g.t2;
  tallyPostseason(g.winner, g.winner === g.t1 ? g.t2 : g.t1);
}
// Opening Round winners take their bracket slots
function finishOpening() {
  if (!G.ncaaOpening || G.ncaaOpening.done) return;
  if (G.ncaaOpening.games.some(function(g) { return !g.winner; })) return;
  G.ncaaOpening.games.forEach(function(g) {
    var e = bracketEntryAt(g.pos);
    if (e) { e.team = g.winner; delete e.pending; }
  });
  G.ncaaOpening.done = true;
  recomputeRatings();
  addLog('ev', G.gi, 'NCAA Opening Round complete. The field of 64 is set.');
}
// Sim every Opening Round game (skipping yours when you are playing it)
export function simOpeningRound(skipUser) {
  if (!openingPending()) return;
  G.ncaaOpening.games.forEach(function(g) {
    if (g.winner) return;
    if (skipUser && (g.t1.id === G.tid || g.t2.id === G.tid)) return;
    var res = simGame(g.t1, g.t2, true);
    scoreOpening(g, res.homeScore, res.awayScore, res.ot);
  });
  finishOpening();
}

export function buildNCAA() {
  // Rankings fold in the conference tournaments before the committee meets.
  recomputeRatings();
  selectionSundayPoll();
  // ── SELECTION COMMITTEE ──
  // Step 1: Conference champs get automatic bids
  var autoBids = [];
  if (G.confTourneys) {
    Object.keys(G.confTourneys).forEach(function(conf) {
      var ct = G.confTourneys[conf];
      if (ct && ct.done && autoBid(ct)) {
        autoBids.push(autoBid(ct));
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

  // Step 3: Sort by resume, pick auto-bids first, then fill to 76 with at-large
  // (2027 format: 76 teams — 52 go straight into the bracket, the 12 lowest
  // at-large teams and the 12 lowest automatic qualifiers play an Opening Round)
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
    if (field.length >= FIELD_SIZE) return;
    if (inField[entry.team.id]) return;
    if (!isEligible(entry.team)) return;
    // At-large minimum: a .550 record (no 16-15 at-large bids)
    var gpA = entry.team.wins + entry.team.loss;
    if (!gpA || entry.team.wins / gpA < 0.55) return;
    field.push(entry.team);
    inField[entry.team.id] = true;
  });

  // If still short (unlikely), fill with best remaining
  allTeams.forEach(function(entry) {
    if (field.length >= FIELD_SIZE) return;
    if (inField[entry.team.id]) return;
    if (!isEligible(entry.team)) return;
    field.push(entry.team);
    inField[entry.team.id] = true;
  });

  // Step 4: Opening Round. The 12 lowest-rated at-large teams and the 12
  // lowest-rated automatic qualifiers pair up (similar teams play each
  // other); each game feeds one bracket slot: at-large games → the four
  // 11 seeds and two 12 seeds, automatic-bid games → two 15 seeds and the
  // four 16 seeds. Everyone else is seeded straight into the 64.
  var resumeOf = {};
  allTeams.forEach(function(e) { resumeOf[e.team.id] = e.resume; });
  var byResume = function(a, b) { return (resumeOf[b.id] || 0) - (resumeOf[a.id] || 0); };
  var autoSet = {}; autoBids.forEach(function(t) { autoSet[t.id] = true; });
  var autosF = field.filter(function(t) { return autoSet[t.id]; }).sort(byResume);
  var atlF = field.filter(function(t) { return !autoSet[t.id]; }).sort(byResume);
  var openAL = atlF.length >= 12 ? atlF.slice(-12) : [];
  var openAuto = autosF.length >= 12 ? autosF.slice(-12) : [];
  var inOpen = {};
  openAL.concat(openAuto).forEach(function(t) { inOpen[t.id] = true; });
  var games = [];
  function pairUp(list, slots, kind) {
    for (var k = 0; k + 1 < list.length && k / 2 < slots.length; k += 2) {
      games.push({ t1: list[k], t2: list[k + 1], s1: null, s2: null, winner: null, pos: slots[k / 2], kind: kind });
    }
  }
  pairUp(openAL, OPEN_AL_POS, 'al');
  pairUp(openAuto, OPEN_AUTO_POS, 'auto');
  var slotGame = {};
  games.forEach(function(g, gi) { slotGame[g.pos] = gi; });
  var direct = field.filter(function(t) { return !inOpen[t.id]; }).sort(byResume);
  var overall = new Array(64), di = 0;
  for (var oi = 0; oi < 64; oi++) {
    if (slotGame[oi] !== undefined) overall[oi] = games[slotGame[oi]].t1; // placeholder until the game is played
    else overall[oi] = direct[di++];
  }
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
      pair.forEach(function(sd) {
        var entry = { team: byRegion[r][sd - 1], seed: sd, region: r, active: true, score: null, won: false };
        var pos = (sd - 1) * 4 + r;
        if (slotGame[pos] !== undefined) entry.pending = slotGame[pos];
        G.bracket.push(entry);
      });
    });
  }
  G.ncaaOpening = games.length ? { done: false, games: games } : null;
  G.phase = 'ncaa';

  var userEntry = null;
  var userOpen = getUserOpeningGame();
  for (var bi = 0; bi < G.bracket.length; bi++) {
    if (G.bracket[bi].team.id === G.tid && G.bracket[bi].pending === undefined) { userEntry = G.bracket[bi]; break; }
  }
  if (userOpen) userEntry = bracketEntryAt(userOpen.pos);
  var userSeed = userEntry ? userEntry.seed : 0;
  if (userOpen) {
    var _oo = userOpen.t1.id === G.tid ? userOpen.t2 : userOpen.t1;
    addLog('ev', G.gi, '<b>NCAA tournament:</b> you are in the Opening Round against ' + _oo.name + '. The winner is the ' + NCAA_REGIONS[userEntry.region] + ' ' + userSeed + ' seed.');
  } else if (userSeed > 0) {
    addLog('ev', G.gi, '<b>NCAA Tournament!</b> You are the #' + userSeed + ' seed.');
  } else {
    addLog('ev', G.gi, '<b>NIT bound.</b> Your program did not qualify for the NCAA Tournament.');
  }
  saveState(); updateAll();
  showBracketReveal(userSeed);
}

// Every team in the field: the 52 seeded straight in plus the 24 Opening Round teams
function fieldTeams() {
  var out = G.bracket.filter(function(b) { return b.pending === undefined; }).map(function(b) { return b.team; });
  ((G.ncaaOpening && G.ncaaOpening.games) || []).forEach(function(g) { out.push(g.t1, g.t2); });
  return out;
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
      if (cct && autoBid(cct)) autoCount++;
    });
  }
  var field = fieldTeams();
  var bidLine = autoCount + ' automatic bids, ' + (field.length - autoCount) + ' at-large bids';
  var userOpen = getUserOpeningGame();

  // User card
  if (userSeed > 0) {
    var uc = ge('br-user-card'); if (uc) uc.style.display = 'block';
    txt('br-user-team', G.teams[G.tid].name);
    txt('br-user-seed', userOpen ? 'Opening Round' : userSeed + ' seed');
    // Find the user's entry, then its real first-round opponent: the team
    // holding the paired seed in the same region — the exact game the sim
    // will play (see NCAA BRACKET MODEL above).
    var userEntry = null;
    for (var bi2 = 0; bi2 < G.bracket.length; bi2++) {
      if (G.bracket[bi2].team.id === G.tid && G.bracket[bi2].pending === undefined) { userEntry = G.bracket[bi2]; break; }
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
    if (userOpen) {
      var oSlot = bracketEntryAt(userOpen.pos);
      // No opponent here: revealing the field shows the matchups
      txt('br-user-opp', 'You play in the Opening Round. Win and you are the ' + NCAA_REGIONS[oSlot.region] + ' ' + oSlot.seed + ' seed.');
    } else txt('br-user-opp', userRegionName ? userRegionName + ' region. Reveal the field to see your first-round matchup.' : '');
    txt('br-seed-line', bidLine.charAt(0).toUpperCase() + bidLine.slice(1) + ' confirmed.');
  } else {
    txt('br-seed-line', 'The field of ' + field.length + ' is set (' + bidLine + '). Your program did not qualify.');
    var uc2 = ge('br-user-card'); if (uc2) uc2.style.display = 'none';
  }

  // Build bubble report
  var bubble = ge('br-bubble');
  if (bubble) {
    var allSorted = G.teams.slice().sort(function(a, b) { return resumeScore(b) - resumeScore(a); });
    var firstOut = [];
    for (var bi = 0; bi < allSorted.length; bi++) {
      var inBracket = field.some(function(ft) { return ft.id === allSorted[bi].id; });
      if (!inBracket && firstOut.length < 4 && allSorted[bi].wins > allSorted[bi].loss) firstOut.push(allSorted[bi]);
    }

    // Last Four In = at-large teams with worst resumes (not auto-bids)
    // Auto-bids are conf tournament champs — they get in regardless of record
    var autoBidIds = {};
    if (G.confTourneys) {
      Object.keys(G.confTourneys).forEach(function(c) {
        var ct = G.confTourneys[c];
        if (ct && autoBid(ct)) autoBidIds[autoBid(ct).id] = true;
      });
    }
    var atLarge = field.filter(function(ft) { return !autoBidIds[ft.id]; });
    atLarge.sort(function(a, b) { return resumeScore(a) - resumeScore(b); });
    var lastIn = atLarge.slice(0, 4);

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
  var userOpenR = getUserOpeningGame();
  var hasUser = G.bracket.some(function(b) { return b.region === step && b.team.id === G.tid && b.pending === undefined; })
    || (userOpenR && userOpenR.pos % 4 === step);
  var h = '<div class="panel-h"><span>' + NCAA_REGIONS[step] + ' region</span><small>' + (hasUser ? 'Your region' : 'First round') + '</small></div><div class="panel-b"><div class="brv-games">';
  NCAA_FIRST_ROUND.forEach(function(pair) {
    var b1 = ncaaSeedEntry(step, pair[0]), b2 = ncaaSeedEntry(step, pair[1]);
    if (!b1 || !b2) return;
    var isMe = function(b) {
      if (b.pending !== undefined && G.ncaaOpening) { var og = G.ncaaOpening.games[b.pending]; return og.t1.id === G.tid || og.t2.id === G.tid; }
      return b.team.id === G.tid;
    };
    var mine = isMe(b1) || isMe(b2);
    h += '<div class="bx' + (mine ? ' mine' : '') + '">';
    [b1, b2].forEach(function(b) {
      var og = b.pending !== undefined && G.ncaaOpening ? G.ncaaOpening.games[b.pending] : null;
      h += '<div class="bx-team' + (isMe(b) ? ' me' : '') + (og ? ' tbd' : '') + '"><span class="bx-seed">' + b.seed + '</span>'
        + '<span class="bx-name">' + (og ? 'Opening Round winner' : b.team.name) + '</span><span class="bx-sc">' + (og ? '' : b.team.wins + '-' + b.team.loss) + '</span></div>';
    });
    h += '</div>';
  });
  col.innerHTML = h + '</div></div>';
  return col;
}

// Full-field reveal: ONE click spawns the entire bracket at once — all four
// regions, immediately. No region-by-region stepping.
// Opening Round games, shown once the field is revealed (not before: no spoilers)
function openingRevealCard() {
  var col = document.createElement('div');
  col.className = 'panel brv-fade brv-open';
  var h = '<div class="panel-h"><span>Opening Round</span><small>12 games for the last 12 spots</small></div><div class="panel-b flush"><table><tbody>';
  G.ncaaOpening.games.forEach(function(g) {
    var sl = bracketEntryAt(g.pos), mine = g.t1.id === G.tid || g.t2.id === G.tid;
    h += '<tr' + (mine ? ' class="hl"' : '') + '><td>' + g.t1.name + ' vs ' + g.t2.name + '</td><td class="dim" style="white-space:nowrap;">For ' + NCAA_REGIONS[sl.region] + ' ' + sl.seed + '</td></tr>';
  });
  col.innerHTML = h + '</tbody></table></div>';
  return col;
}

export function revealFullBracket() {
  var wrap = ge('br-bracket');
  var btn = ge('br-reveal-btn');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (G.ncaaOpening) wrap.appendChild(openingRevealCard());
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
function scoreNCAAgame(b1, b2, s1, s2, ot) {
  if (!b1.sc) b1.sc = [];
  if (!b2.sc) b2.sc = [];
  b1.sc.push(s1); b2.sc.push(s2);
  // overtime periods by round, only kept when a game went to OT
  if (ot) [b1, b2].forEach(function(b) { b.ot = b.ot || []; b.ot[b.sc.length - 1] = ot; });
  b1.score = s1; b2.score = s2;
  if (s1 > s2) { b1.won = true; b2.won = false; b2.active = false; }
  else { b2.won = true; b1.won = false; b1.active = false; }
  tallyPostseason(b1.won ? b1.team : b2.team, b1.won ? b2.team : b1.team);
}

export function simNCAAround() {
  if (openingPending()) {
    simOpeningRound(false);
    saveState(); updateAll();
    if (SetupState.ACTIVE_VIEW === 'bracket' && _ext.renderBracket) _ext.renderBracket();
    return;
  }
  var active = G.bracket.filter(function(b) { return b.active; });
  if (active.length <= 1) return;
  for (var i = 0; i < active.length - 1; i += 2) {
    var b1 = active[i], b2 = active[i + 1];
    var res = simGame(b1.team, b2.team, true);
    scoreNCAAgame(b1, b2, res.homeScore, res.awayScore, res.ot);
  }
  recomputeRatings(); // rankings keep moving through March
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
    scoreNCAAgame(b1, b2, res.homeScore, res.awayScore, res.ot);
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
        addLog('ev', G.gi, '<b>National champions as a double-digit seed.</b>');
      }
      addLog('ev', G.gi, '<b>National champions.</b> School prestige +12.');
      toast('National champions', 'var(--gld)');
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
  // Saves stuck between the regular season and the brackets: build them now
  if (G.phase === 'conf_tourn' && (!G.confTourneys || !Object.keys(G.confTourneys).length)) {
    startConfTourney();
    return;
  }
  if (G.phase === 'conf_tourn') {
    var um = getUserConfMatchup();
    if (um) {
      var m = um.matchup;
      LS.tH = m.t1; LS.tA = m.t2;
      LS.game = {
        home: true, conf: true, played: false, uScore: 0, oScore: 0,
        _matchup: m, _conf: um.conf, _ct: um.ct, _type: 'conf', _campus: !!m.campus
      };
      LS.userTeam = G.teams[G.tid];
      LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0; LS.ot = 0;
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
        var res = simConf(m);
        LS.hs = res.homeScore; LS.as = res.awayScore; LS.ot = res.ot || 0;
        LS._recLines = userLinesFromRes(res);
        resolveTournamentGame();
      }
    } else {
      advanceConfTourney();
    }
  } else if (G.phase === 'ncaa' && openingPending()) {
    var og = getUserOpeningGame();
    if (!og) { simNCAAround(); return; }
    LS.tH = og.t1; LS.tA = og.t2;
    LS.game = { home: true, conf: false, played: false, uScore: 0, oScore: 0, _og: og, _type: 'opening' };
    LS.userTeam = G.teams[G.tid];
    LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0; LS.ot = 0;
    LS.h1 = null; LS.a1 = null; LS.poss = 'A';
    if (watch) {
      LS._recPre = { h: snapRoster(og.t1), a: snapRoster(og.t2), hid: og.t1.id, aid: og.t2.id };
      if (_ext.openModal) _ext.openModal(og.t1, og.t2, true, getNCAAroundName());
    } else {
      var reso = simGame(og.t1, og.t2, true);
      LS.hs = reso.homeScore; LS.as = reso.awayScore; LS.ot = reso.ot || 0;
      LS._recLines = userLinesFromRes(reso);
      resolveTournamentGame();
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
      LS.clock = 1200; LS.half = 1; LS.hs = 0; LS.as = 0; LS.ot = 0;
      LS.h1 = null; LS.a1 = null; LS.poss = 'A';
      if (watch) {
        um2.b1.team._seed = um2.b1.seed;
        um2.b2.team._seed = um2.b2.seed;
        // Records: snapshot for the post-game diff (live path)
        LS._recPre = { h: snapRoster(um2.b1.team), a: snapRoster(um2.b2.team), hid: um2.b1.team.id, aid: um2.b2.team.id };
        if (_ext.openModal) _ext.openModal(um2.b1.team, um2.b2.team, true, getNCAAroundName());
      } else {
        var res2 = simGame(um2.b1.team, um2.b2.team, true);
        LS.hs = res2.homeScore; LS.as = res2.awayScore; LS.ot = res2.ot || 0;
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
    m.s1 = LS.hs; m.s2 = LS.as; if (LS.ot) m.ot = LS.ot;
    m.winner = LS.hs > LS.as ? m.t1 : m.t2;
    tallyPostseason(m.winner, m.winner === m.t1 ? m.t2 : m.t1);
    var userWon = (m.winner.id === G.tid);
    var oppName = (m.t1.id === G.tid ? m.t2 : m.t1).name;
    var oppTeam = (m.t1.id === G.tid ? m.t2 : m.t1);
    G.lastResult = { yr: G.yr, oppId: oppTeam.id, home: null, u: uScore, o: oScore, won: userWon, wk: G.gi, label: conf + ' tournament', ot: LS.ot || 0 };
    // Morale: tournament games swing moods too
    recordGameMorale(userWon ? userTeam : oppTeam, userWon ? oppTeam : userTeam);
    if (userWon) {
      toast(userTeam.name + ' advances, ' + fmtScore(uScore, oScore, '-', LS.ot), 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (Conf Tourney)');
    } else {
      toast('Eliminated by ' + oppName + ', ' + fmtScore(uScore, oScore, '-', LS.ot), 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (Conf Tourney)');
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
        var res3 = simConf(rm);
        rm.s1 = res3.homeScore; rm.s2 = res3.awayScore; if (res3.ot) rm.ot = res3.ot;
        rm.winner = res3.homeScore > res3.awayScore ? rm.t1 : rm.t2;
        tallyPostseason(rm.winner, rm.winner === rm.t1 ? rm.t2 : rm.t1);
      });
      buildNextConfRound(c);
    });
    // Check if everything is done
    if (allConfDone() && !G.bracket.length) buildNCAA();
  } else if (game._type === 'opening') {
    var og2 = game._og;
    scoreOpening(og2, LS.hs, LS.as, LS.ot);
    var wonO = og2.winner.id === G.tid;
    var oppO = og2.t1.id === G.tid ? og2.t2 : og2.t1;
    G.lastResult = { yr: G.yr, oppId: oppO.id, home: null, u: uScore, o: oScore, won: wonO, wk: G.gi, label: 'NCAA Opening Round', ot: LS.ot || 0 };
    recordGameMorale(wonO ? userTeam : oppO, wonO ? oppO : userTeam);
    if (wonO) {
      payOpeningWin();
      var slot = bracketEntryAt(og2.pos);
      toast(userTeam.name + ' wins, ' + fmtScore(uScore, oScore, '-', LS.ot) + '. Into the field as the ' + (slot ? NCAA_REGIONS[slot.region] + ' ' + slot.seed : '') + ' seed.', 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppO.name + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (NCAA Opening Round)');
    } else {
      G.seasonAchievements = G.seasonAchievements || {};
      G.seasonAchievements.tourneyFinish = 'Opening round';
      toast('Season over. Lost in the Opening Round, ' + fmtScore(uScore, oScore, '-', LS.ot), 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppO.name + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (NCAA Opening Round)');
    }
    simOpeningRound(true);
  } else if (game._type === 'ncaa') {
    var b1 = game._b1, b2 = game._b2;
    // Sim the rest of the round FIRST, while the user's pair is still
    // adjacent in the active order. Resolving the user's game first would
    // drop its loser from the list, shifting every later pairing and even
    // leaving one team with no game at all (T1).
    simNCAArimExceptUser();
    scoreNCAAgame(b1, b2, LS.hs, LS.as, LS.ot);
    recomputeRatings(); // rankings keep moving through March
    var userWon2 = (b1.team.id === G.tid) ? (LS.hs > LS.as) : (LS.as > LS.hs);
    var oppName2 = (b1.team.id === G.tid ? b2 : b1).team.name;
    var oppTeam2 = (b1.team.id === G.tid ? b2 : b1).team;
    // Morale: tournament games swing moods too
    recordGameMorale(userWon2 ? userTeam : oppTeam2, userWon2 ? oppTeam2 : userTeam);
    // Teams left AFTER the full round: 32 / 16 / 8 / 4 / 2 / 1
    var remaining = G.bracket.filter(function(b) { return b.active; }).length;
    G.lastResult = { yr: G.yr, oppId: oppTeam2.id, home: null, u: uScore, o: oScore, won: userWon2, wk: G.gi, label: 'NCAA tournament', ot: LS.ot || 0 };
    // Tournament payout per win, larger each round (remaining after the round: 32 → round of 64 win)
    if (userWon2) payTourneyWin({ 32: 0, 16: 1, 8: 2, 4: 3, 2: 4, 1: 5 }[remaining] || 0);

    if (userWon2) {
      // Round-specific headlines and prestige bonuses
      var userSeed = (b1.team.id === G.tid) ? b1.seed : b2.seed;
      var oppSeed = (b1.team.id === G.tid) ? b2.seed : b1.seed;
      var isUpset = userSeed > oppSeed + 3;
      var roundMsg = '';
      var prestigeGain = 0;

      if (remaining <= 1) { roundMsg = 'On to the title game.'; prestigeGain = 8; }
      else if (remaining <= 2) { roundMsg = 'On to the Final Four.'; prestigeGain = 5; }
      else if (remaining <= 4) { roundMsg = 'On to the Elite Eight.'; prestigeGain = 3; }
      else if (remaining <= 8) { roundMsg = 'On to the Sweet 16.'; prestigeGain = 2; }
      else if (remaining <= 16) { roundMsg = 'On to the second round.'; prestigeGain = 1; }
      else { roundMsg = 'On to the next round.'; prestigeGain = 1; }

      // Cinderella bonus: 11+ seed reaching Sweet 16+
      if (userSeed >= 11 && remaining <= 8) {
        prestigeGain += 5;
        if (!G.cinderellaRun) G.cinderellaRun = true;
        addLog('ev', G.gi, '\ud83d\udc60 <b>CINDERELLA ALERT!</b> #' + userSeed + ' ' + userTeam.name + ' keeps dancing! The country is watching.');
      }

      // Upset bonus
      if (isUpset) {
        prestigeGain += 2;
        addLog('ev', G.gi, '\ud83d\udea8 <b>UPSET!</b> #' + userSeed + ' ' + userTeam.name + ' stuns #' + oppSeed + ' ' + oppName2 + '! ' + fmtScore(uScore, oScore, '-', LS.ot));
      }

      // Apply prestige
      var t = G.teams[G.tid];
      t.schoolPrestige = Math.min(100, (t.schoolPrestige || 50) + prestigeGain);

      toast(userTeam.name + ' advances. ' + roundMsg, 'var(--grn)');
      addLog('w', G.gi, '<b>W</b> vs <b>' + oppName2 + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (NCAA \u2014 ' + roundMsg + ')');
    } else {
      // Elimination — record how far we got (post-round team counts)
      var finalRound = remaining <= 1 ? 'Championship Game' : remaining <= 2 ? 'Final Four' : remaining <= 4 ? 'Elite Eight' : remaining <= 8 ? 'Sweet 16' : remaining <= 16 ? 'Round of 32' : 'Round of 64';
      toast('Season over. Eliminated in the ' + finalRound + '.', 'var(--red)');
      addLog('l', G.gi, '<b>L</b> vs <b>' + oppName2 + '</b> ' + fmtScore(uScore, oScore, '', LS.ot) + ' (NCAA \u2014 ' + finalRound + ')');
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
    ? (LS.game._type === 'opening' ? 'Into the field of 64.' : G.phase === 'ncaa' ? 'On to the next round.' : 'On to the next round of the conference tournament.')
    : (G.phase === 'ncaa' ? 'Your NCAA tournament run is over.' : 'Your conference tournament is over.');
  overlay.innerHTML = '<div class="tres-in">'
    + '<div class="tres-k">' + roundName.replace('NCAA Tournament \u2014 ', 'NCAA tournament, ') + ' · Final</div>'
    + '<div class="tres-v ' + (won ? 'w' : 'l') + '">' + (won ? 'Win' : 'Loss') + '</div>'
    + '<div class="tres-rows">'
    + '<div class="tres-row' + (won ? ' w' : '') + '"><span>' + me.name + '</span><b>' + uScore + '</b></div>'
    + '<div class="tres-row' + (won ? '' : ' w') + '"><span>' + opp.name + '</span><b>' + oScore + '</b></div>'
    + (LS.ot ? '<div class="tres-ot">Final/' + otLabel(LS.ot) + '</div>' : '')
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
