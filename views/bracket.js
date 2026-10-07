// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/bracket.js
//  Tournament Hub: conference tournaments, NCAA bracket,
//  scouting, results feed, cinderella watch.
//  Delegated actions, no inline onclick.
// ═══════════════════════════════════════════════════════════

import { ge, clamp, getTOvr, fmtScore, winProb } from '../utils.js';
import { G } from '../state.js';
import { allConfDone, getUserNCAAmatchup, getUserConfMatchup, getConfRoundName } from '../tournament.js';
import { getUiPrefs, setUiPrefs } from './ui-prefs.js';

// Team name link (same shape as the player pLink convention).
function tLink(tid, name) {
  return '<span class="tname-link" data-action="team" data-tid="' + tid + '" role="button" tabindex="0">' + name + '</span>';
}

export function renderBracket() {
  var el = ge('bracket-content');
  if (!el) return;
  var hub = bracketHubHTML();
  el.innerHTML = hub || '<div class="empty-state">The bracket opens after the regular season.</div>';
  bindBracket(el, renderBracket);
  scrollBracketToRound(el);
}

// Tournament hub HTML for embedding (home page auto-swaps to this in
// tournament phases). Returns '' when no tournament is active.
export function bracketHubHTML() {
  if (G.phase === 'conf_tourn' && G.confTourneys) return renderConfHub();
  if (G.bracket && G.bracket.length && (G.phase === 'ncaa' || G.phase === 'offseason')) return renderNCAA_Hub();
  return '';
}

// ═══════════════════════════════════════════════════════════
//  CONFERENCE TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

function renderConfHub() {
  var myConf = G.teams[G.tid].conf;
  var ct = G.confTourneys[myConf];
  var h = '<div style="margin-bottom:12px;"><div class="sec-head">Conference tournaments</div>'
    + '<div class="sec-sub">' + myConf + ' · Season ' + G.yr + '</div></div>';

  if (ct) h += renderConfBracketCard(myConf, ct, true);

  var confMatch = getUserConfMatchup();
  if (confMatch) h += renderScoutingCard(confMatch);
  else if (!allConfDone()) {
    // Your run is over (or you have a bye): a way forward without the top-bar menu
    h += '<div class="panel"><div class="panel-b" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:13.5px;">Your conference tournament is over. Selection Sunday is next.</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn-big secondary" style="width:auto;padding:0 16px;" data-action="play" data-mode="quick">Sim next round</button>'
      + '<button class="btn-big" style="width:auto;padding:0 16px;" data-action="play" data-mode="sim-conf">Sim to Selection Sunday</button>'
      + '</div></div></div>';
  }

  var others = Object.keys(G.confTourneys).filter(function(c) { return c !== myConf; });
  if (others.length) {
    // Every conference in one compact table: champion, or latest result,
    // or (at the start of a round) the next game
    h += '<div class="panel"><div class="panel-h"><span>Around the country</span><small>' + others.length + ' conferences</small></div>'
      + '<div class="panel-b flush"><div class="tbl-wrap"><table class="atc"><thead><tr><th>Conference</th><th>Status</th><th>Latest</th></tr></thead><tbody>';
    others.forEach(function(c) { h += confStatusRow(c, G.confTourneys[c]); });
    h += '</tbody></table></div></div></div>';
  }

  if (allConfDone() && (!G.bracket || !G.bracket.length)) {
    h += '<div class="panel"><div class="panel-h"><span>Conference tournaments</span></div><div class="panel-b">'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:10px;">All conference tournaments complete</div>'
      + '<button class="btn-big" data-action="build-ncaa">Selection Sunday</button>'
      + '<div class="sec-sub" style="margin:8px 0 0;">Use the Advance button up top to build the NCAA field.</div></div></div>';
  }
  return h;
}

function matchupMini(t1, t2, s1, s2, winner, seeds) {
  var played = winner !== null && winner !== undefined;
  var h = '<div class="br-mini">';
  [{ t: t1, s: s1 }, { t: t2, s: s2 }].forEach(function(e) {
    if (!e.t) return;
    var isu = e.t.id === G.tid;
    var isWin = played && winner && winner.id === e.t.id;
    var seedNum = seeds ? seeds.findIndex(function(x) { return x.id === e.t.id; }) + 1 : '';
    var cls = isu ? ' is-user' : isWin ? ' winner' : '';
    h += '<div class="br-team' + cls + '">'
      + '<span class="br-seed">' + seedNum + '</span>'
      + '<span class="br-tname">' + tLink(e.t.id, e.t.name) + '</span>'
      + (played ? '<span class="br-score">' + e.s + '</span>' : '') + '</div>';
  });
  return h + '</div>';
}

function renderConfBracketCard(conf, ct, expanded) {
  if (!ct || !ct.rounds) return '';
  var rnames = { 1: 'R1', 2: 'QF', 3: 'SF', 4: 'Final' };
  var rnamesFull = { 1: 'First round', 2: 'Quarterfinal', 3: 'Semifinal', 4: 'Final' };
  var h = '<div class="panel"><div class="panel-h"><span>' + conf + '</span>'
    + (ct.done && ct.champ
      ? '<small>Champion: ' + ct.champ.name + '</small>'
      : '<span class="tag t-rival">Live</span>') + '</div>'
    + '<div class="panel-b"><div class="br-region">';

  if (expanded) {
    h += '<div style="display:flex;overflow-x:auto;">';
    ct.rounds.forEach(function(round, ri) {
      h += '<div class="br-round-col">'
        + '<div class="br-round-name" title="' + (rnamesFull[ri + 1] || 'Round ' + (ri + 1)) + '">' + (rnames[ri + 1] || 'R' + (ri + 1)) + '</div>';
      round.forEach(function(m) { h += matchupMini(m.t1, m.t2, m.s1, m.s2, m.winner, ct.seeds); });
      h += '</div>';
    });
    h += '</div>';
  } else {
    var lastRound = ct.rounds[ct.rounds.length - 1];
    var shown = 0;
    if (lastRound) lastRound.forEach(function(m) {
      if (m.winner && shown < 3) {
        shown++;
        h += '<div class="br-result">'
          + '<span><b>' + m.winner.name + '</b> def. '
          + (m.winner.id === m.t1.id ? m.t2.name : m.t1.name) + '</span>'
          + '<span class="br-score" style="color:var(--txt3);">' + fmtScore(m.s1, m.s2, '-') + '</span></div>';
      }
    });
  }
  return h + '</div></div></div>';
}

// One row per conference for "Around the country"
function confStatusRow(conf, ct) {
  if (!ct || !ct.rounds) return '';
  var seedOf = function(t) { var i = (ct.seeds || []).findIndex(function(x) { return x && t && x.id === t.id; }); return i >= 0 ? i + 1 : ''; };
  var nm = function(t) { return t ? seedOf(t) + ' ' + t.name : 'TBD'; };
  if (ct.done && ct.champ) {
    var fin = ct.rounds[ct.rounds.length - 1] && ct.rounds[ct.rounds.length - 1][0];
    var score = fin && fin.winner ? ' ' + fmtScore(fin.s1, fin.s2, '-') : '';
    return '<tr><td><b>' + conf + '</b></td><td>Champion</td><td><b>' + ct.champ.name + '</b><span class="dim">' + score + '</span></td></tr>';
  }
  var rIdx = ct.rounds.length - 1, round = ct.rounds[rIdx] || [];
  var left = round.filter(function(m) { return !m.winner; }).length;
  var isFinal = round.length === 1 && !(ct.carry && ct.carry.length);
  var status = isFinal ? 'Final' : (round.length <= 2 && !(ct.carry && ct.carry.length) ? 'Semifinals' : 'Round ' + (rIdx + 1));
  // Latest decided game anywhere in the tournament
  var last = null;
  for (var r = ct.rounds.length - 1; r >= 0 && !last; r--) {
    var done = ct.rounds[r].filter(function(m) { return m.winner; });
    if (done.length) last = done[done.length - 1];
  }
  var latest = '';
  if (last) {
    var lo = last.winner.id === last.t1.id ? last.t2 : last.t1;
    latest += nm(last.winner) + ' def. ' + nm(lo) + ' <span class="dim">' + fmtScore(last.s1, last.s2, '-') + '</span>';
  }
  var next = round.filter(function(m) { return !m.winner; })[0];
  if (next) latest += (latest ? '<br>' : '') + '<span class="dim">Next: ' + nm(next.t1) + ' vs ' + nm(next.t2) + '</span>';
  return '<tr><td><b>' + conf + '</b></td><td>' + status + '</td><td>' + latest + '</td></tr>';
}

function renderScoutingCard(confMatch) {
  var m = confMatch.matchup;
  var opp = m.t1.id === G.tid ? m.t2 : m.t1;
  var wp = winProb(getTOvr(G.teams[G.tid]), getTOvr(opp), 0, 0);
  var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
  return '<div class="panel"><div class="panel-h"><span>Your next game</span><small>' + getConfRoundName(confMatch.ct, confMatch.conf) + '</small></div>'
    + '<div class="panel-b">'
    + '<div class="matchup-opp">' + opp.name + '</div>'
    + '<div class="matchup-meta"><span class="tag t-cf">Conf tourney</span>'
    + '<span>OVR ' + getTOvr(opp) + ' · ' + opp.wins + '-' + opp.loss + '</span></div>'
    + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';">' + wp + '%</span></div>'
    + '<div class="prob-bar"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>'
    + '<div class="big-btn-row"><button class="btn-big" data-action="play" data-mode="quick">Sim game</button>'
    + '<button class="btn-big secondary" data-action="play" data-mode="live">Watch game</button></div></div></div>';
}

// ═══════════════════════════════════════════════════════════
//  NCAA TOURNAMENT HUB
// ═══════════════════════════════════════════════════════════

var REGIONS = ['East', 'West', 'South', 'Midwest'];
var ROUND_NAMES = ['First round', 'Second round', 'Sweet 16', 'Elite Eight', 'Final Four', 'Championship'];
var _brView = getUiPrefs('bracket').region; // region index 0-3, or 'ff'; null = pick automatically

// ── Bracket model ─────────────────────────────────────────
// G.bracket holds 64 entries in winner-advancement order (16 per region).
// Each entry's b.sc is its score in every round it played (0 = first round),
// so any round's matchups can be rebuilt from the first-round order.
function playedRound(b, k) { return !!(b && b.sc && b.sc.length > k); }
function wonRound(b, k) {
  if (!playedRound(b, k)) return false;
  return b.sc.length > k + 1 || b.active;
}
// Matches for one region: rounds[k] = [{ a, b }] (a/b null until known)
function regionRounds(r) {
  var ent = G.bracket.slice(r * 16, r * 16 + 16);
  var rounds = [[]];
  for (var i = 0; i < 16; i += 2) rounds[0].push({ a: ent[i], b: ent[i + 1] });
  for (var k = 1; k < 4; k++) {
    rounds[k] = [];
    for (var m = 0; m < rounds[k - 1].length; m += 2) {
      rounds[k].push({ a: matchWinner(rounds[k - 1][m], k - 1), b: matchWinner(rounds[k - 1][m + 1], k - 1) });
    }
  }
  return rounds;
}
function matchWinner(mt, k) {
  if (!mt) return null;
  if (mt.a && wonRound(mt.a, k)) return mt.a;
  if (mt.b && wonRound(mt.b, k)) return mt.b;
  return null;
}
function finalFour() {
  var champs = [0, 1, 2, 3].map(function(r) { var rr = regionRounds(r); return matchWinner(rr[3][0], 3); });
  var semis = [{ a: champs[0], b: champs[1] }, { a: champs[2], b: champs[3] }];
  var title = { a: matchWinner(semis[0], 4), b: matchWinner(semis[1], 4) };
  return { semis: semis, title: title, champ: matchWinner(title, 5) };
}
export function _bracketModel() { return { regionRounds: regionRounds, finalFour: finalFour, wonRound: wonRound }; }
function hasHistory() { return G.bracket.some(function(b) { return b.sc && b.sc.length; }); }

// Current round index from how many teams are still alive
function curRound() {
  var n = G.bracket.filter(function(b) { return b.active; }).length;
  return { 64: 0, 32: 1, 16: 2, 8: 3, 4: 4, 2: 5, 1: 6 }[n] !== undefined ? { 64: 0, 32: 1, 16: 2, 8: 3, 4: 4, 2: 5, 1: 6 }[n] : 0;
}

// ── One matchup box ───────────────────────────────────────
function slotRow(b, k, mt) {
  if (!b) return '<div class="bx-team tbd"><span class="bx-seed"></span><span class="bx-name">&nbsp;</span><span class="bx-sc"></span></div>';
  var played = playedRound(b, k);
  var other = mt.a === b ? mt.b : mt.a;
  var won = played && wonRound(b, k);
  var lost = played && !won && other && playedRound(other, k);
  var cls = (b.team.id === G.tid ? ' me' : '') + (won ? ' w' : '') + (lost ? ' l' : '');
  return '<div class="bx-team' + cls + '"><span class="bx-seed">' + b.seed + '</span>'
    + '<span class="bx-name">' + tLink(b.team.id, b.team.name) + '</span>'
    + '<span class="bx-sc">' + (played ? b.sc[k] : '') + '</span></div>';
}
function matchBox(mt, k) {
  var mine = (mt.a && mt.a.team.id === G.tid) || (mt.b && mt.b.team.id === G.tid);
  return '<div class="bx-m"><div class="bx' + (mine ? ' mine' : '') + '">' + slotRow(mt.a, k, mt) + slotRow(mt.b, k, mt) + '</div></div>';
}

// Region tree: four columns, connector lines drawn by CSS
function regionTree(r) {
  var rounds = regionRounds(r), cr = curRound();
  var h = '<div class="bx-scroll" data-bx-scroll="' + Math.min(cr, 3) + '"><div class="bx-tree">';
  for (var k = 0; k < 4; k++) {
    h += '<div class="bx-col' + (k === cr ? ' cur' : '') + '"><div class="bx-rh">' + ROUND_NAMES[k] + '</div><div class="bx-body">';
    if (k < 3) {
      for (var m = 0; m < rounds[k].length; m += 2) {
        h += '<div class="bx-pair">' + matchBox(rounds[k][m], k) + matchBox(rounds[k][m + 1], k) + '</div>';
      }
    } else {
      h += '<div class="bx-single">' + matchBox(rounds[3][0], 3) + '</div>';
    }
    h += '</div></div>';
  }
  var champ = matchWinner(rounds[3][0], 3);
  h += '<div class="bx-col bx-win"><div class="bx-rh">Region champion</div><div class="bx-body"><div class="bx-single"><div class="bx-m">'
    + (champ ? '<div class="bx-champ' + (champ.team.id === G.tid ? ' me' : '') + '"><span class="bx-seed">' + champ.seed + '</span>' + champ.team.name + '</div>' : '<div class="bx-champ tbd">To be decided</div>')
    + '</div></div></div></div>';
  return h + '</div></div>';
}

function finalFourTree() {
  var ff = finalFour(), cr = curRound();
  var h = '<div class="bx-scroll" data-bx-scroll="0"><div class="bx-tree ff">';
  h += '<div class="bx-col' + (cr === 4 ? ' cur' : '') + '"><div class="bx-rh">Final Four</div><div class="bx-body"><div class="bx-pair">'
    + matchBox(ff.semis[0], 4) + matchBox(ff.semis[1], 4) + '</div></div></div>';
  h += '<div class="bx-col' + (cr === 5 ? ' cur' : '') + '"><div class="bx-rh">Championship</div><div class="bx-body"><div class="bx-single">' + matchBox(ff.title, 5) + '</div></div></div>';
  h += '<div class="bx-col bx-win"><div class="bx-rh">National champion</div><div class="bx-body"><div class="bx-single"><div class="bx-m">'
    + (ff.champ ? '<div class="bx-champ' + (ff.champ.team.id === G.tid ? ' me' : '') + '"><span class="bx-seed">' + ff.champ.seed + '</span>' + ff.champ.team.name + '</div>' : '<div class="bx-champ tbd">To be decided</div>')
    + '</div></div></div></div>';
  h += '</div></div>';
  h += '<div class="bx-note">' + REGIONS[0] + ' plays ' + REGIONS[1] + ', ' + REGIONS[2] + ' plays ' + REGIONS[3] + '.</div>';
  return h;
}

function defaultView() {
  var alive = G.bracket.filter(function(b) { return b.active; }).length;
  if (alive <= 4) return 'ff';
  var me = G.bracket.find(function(b) { return b.team && b.team.id === G.tid; });
  return me ? me.region : 0;
}

function bracketPanel() {
  if (!hasHistory() && G.bracket.some(function(b) { return !b.active; })) {
    // Older save from before round-by-round results were kept
    return '';
  }
  var v = _brView === null ? defaultView() : _brView;
  var me = G.bracket.find(function(b) { return b.team && b.team.id === G.tid; });
  var h = '<div class="panel"><div class="panel-h"><span>Bracket</span><small>' + (me ? 'You: #' + me.seed + ' seed, ' + REGIONS[me.region] : 'You did not make the field') + '</small></div>'
    + '<div class="panel-b"><div class="fbar" style="margin-bottom:10px;">';
  REGIONS.forEach(function(name, r) {
    var alive = G.bracket.slice(r * 16, r * 16 + 16).filter(function(b) { return b.active; }).length;
    h += '<button class="fchip' + (v === r ? ' on' : '') + '" data-brview="' + r + '">' + name + '</button>';
  });
  h += '<button class="fchip' + (v === 'ff' ? ' on' : '') + '" data-brview="ff">Final Four</button></div>';
  h += v === 'ff' ? finalFourTree() : regionTree(v);
  return h + '</div></div>';
}

// ── Your status card ──────────────────────────────────────
function userCard(cr) {
  var me = G.bracket.find(function(b) { return b.team && b.team.id === G.tid; });
  var um = getUserNCAAmatchup();
  var alive = G.bracket.filter(function(b) { return b.active; }).length;
  if (um && alive > 1) {
    var uIsB1 = um.b1.team.id === G.tid;
    var ue = uIsB1 ? um.b1 : um.b2, oe = uIsB1 ? um.b2 : um.b1, opp = oe.team;
    var wp = winProb(getTOvr(ue.team), getTOvr(opp), 0, 0);
    var col = wp >= 55 ? 'var(--grn2)' : wp >= 40 ? 'var(--gld2)' : 'var(--red)';
    var stars = opp.rost.filter(function(p) { return p.mins > 0; }).sort(function(a, b) { return b.ovr - a.ovr; }).slice(0, 3);
    var h = '<div class="panel"><div class="panel-h"><span>' + ROUND_NAMES[cr] + '</span><small>' + REGIONS[ue.region] + (cr >= 4 ? '' : ' region') + ', neutral site</small></div><div class="panel-b">'
      + '<div class="mu">'
      + '<div class="mu-t"><span class="mu-seed">' + ue.seed + '</span><div><div class="mu-n me">' + ue.team.name + '</div><div class="mu-m">' + ue.team.wins + '-' + ue.team.loss + ' · OVR ' + getTOvr(ue.team) + '</div></div></div>'
      + '<div class="mu-vs">vs</div>'
      + '<div class="mu-t r"><div><div class="mu-n">' + opp.name + '</div><div class="mu-m">' + opp.wins + '-' + opp.loss + ' · OVR ' + getTOvr(opp) + '</div></div><span class="mu-seed">' + oe.seed + '</span></div>'
      + '</div>'
      + '<div class="prob-row"><span>Win probability</span><span style="color:' + col + ';font-weight:600;">' + wp + '%</span></div>'
      + '<div class="prob-bar" style="margin-bottom:10px;"><div class="prob-fill" style="width:' + wp + '%;background:' + col + ';"></div></div>';
    if (stars.length) {
      h += '<div class="mu-watch"><span>Watch for</span> ' + stars.map(function(p) {
        var gp = p.s.gp || 1;
        return '<b>' + p.name + '</b> ' + p.pos + ', ' + (p.s.pts / gp).toFixed(1) + ' ppg';
      }).join(' · ') + '</div>';
    }
    h += '<div class="big-btn-row"><button class="btn-big" data-action="play" data-mode="quick">Sim game</button>'
      + '<button class="btn-big secondary" data-action="play" data-mode="live">Watch game</button></div></div></div>';
    return h;
  }
  if (alive <= 1) return '';
  var line;
  if (!me) line = G.teams[G.tid].name + ' did not make the field this year.';
  else {
    var k = (me.sc || []).length - 1;
    var rr = k >= 0 && k < 4 ? regionRounds(me.region)[k] : null, opp2 = null;
    if (rr) rr.forEach(function(mt) { if (mt.a === me) opp2 = mt.b; else if (mt.b === me) opp2 = mt.a; });
    if (k >= 4) { var ff = finalFour(); var m2 = k === 4 ? (ff.semis[0].a === me || ff.semis[0].b === me ? ff.semis[0] : ff.semis[1]) : ff.title; opp2 = m2.a === me ? m2.b : m2.a; }
    line = 'Your run ended in the ' + (k >= 0 ? ROUND_NAMES[k].toLowerCase() : 'first round')
      + (opp2 && opp2.sc ? ', ' + me.sc[k] + '-' + opp2.sc[k] + ' to #' + opp2.seed + ' ' + opp2.team.name : '') + '.';
  }
  return '<div class="panel"><div class="panel-b" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
    + '<div style="font-size:13.5px;">' + line + '</div>'
    + '<button class="btn-big" style="flex:0 0 auto;width:auto;padding-left:20px;padding-right:20px;" data-action="play" data-mode="quick">Sim the ' + (cr < 2 ? ROUND_NAMES[cr].toLowerCase() : ROUND_NAMES[cr]) + '</button></div></div>';
}

function champCard() {
  var ff = finalFour();
  var c = ff.champ || (G.bracket.filter(function(b) { return b.active; })[0]);
  if (!c) return '';
  var isu = c.team.id === G.tid;
  var t = ff.title, ru = t && (t.a === c ? t.b : t.a);
  var score = ru && c.sc && ru.sc ? c.sc[5] + '-' + ru.sc[5] + ' over #' + ru.seed + ' ' + ru.team.name : '';
  var h = '<div class="panel"><div class="panel-b champ-card">'
    + '<div class="champ-k">' + G.yr + ' national champion</div>'
    + '<div class="champ-n' + (isu ? ' me' : '') + '"><span class="mu-seed">' + c.seed + '</span>' + c.team.name + '</div>'
    + '<div class="champ-s">' + REGIONS[c.region] + ' region · ' + c.team.wins + '-' + c.team.loss + (score ? ' · ' + score : '') + '</div>';
  if (G.phase === 'ncaa') h += '<div style="margin-top:12px;"><button class="btn-big" data-action="end-season">Season recap</button></div>';
  return h + '</div></div>';
}

// ── Upsets and Cinderellas (one compact panel) ────────────
function upsetsPanel() {
  var ups = [];
  var cr = curRound();
  function scan(mt, k) {
    if (!mt || !mt.a || !mt.b || !playedRound(mt.a, k) || !playedRound(mt.b, k)) return;
    var w = wonRound(mt.a, k) ? mt.a : mt.b, l = w === mt.a ? mt.b : mt.a;
    if (w.seed - l.seed >= 4) ups.push({ k: k, w: w, l: l });
  }
  for (var r = 0; r < 4; r++) regionRounds(r).forEach(function(round, k) { round.forEach(function(mt) { scan(mt, k); }); });
  var ff = finalFour(); ff.semis.forEach(function(mt) { scan(mt, 4); }); scan(ff.title, 5);
  // Cinderellas: double-digit seeds still alive once the first round is done
  var cind = cr >= 1 ? G.bracket.filter(function(b) { return b.active && b.seed >= 10; }) : [];
  if (!ups.length && !cind.length) return '';
  ups.sort(function(a, b) { return b.k - a.k || (b.w.seed - b.l.seed) - (a.w.seed - a.l.seed); });
  var h = '<div class="panel"><div class="panel-h"><span>Upsets</span><small>' + ups.length + ' so far</small></div><div class="panel-b flush"><div class="tbl-wrap"><table class="ups"><tbody>';
  ups.slice(0, 8).forEach(function(u) {
    var mine = u.w.team.id === G.tid || u.l.team.id === G.tid;
    h += '<tr' + (mine ? ' class="hl"' : '') + '>'
      + '<td><b>' + u.w.seed + ' ' + u.w.team.name + '</b> def. ' + u.l.seed + ' ' + u.l.team.name
      + '<div class="ups-r">' + ROUND_NAMES[u.k] + '</div></td>'
      + '<td class="num" style="white-space:nowrap;">' + u.w.sc[u.k] + '-' + u.l.sc[u.k] + '</td></tr>';
  });
  if (!ups.length) h = '<div class="panel"><div class="panel-h"><span>Upsets</span><small>None yet</small></div><div class="panel-b flush">';
  else h += '</tbody></table></div>';
  if (cind.length && cr < 6) {
    h += '<div style="padding:8px 12px;font-size:12.5px;color:var(--txt2);border-top:1px solid var(--bdr);">Still alive at 10 or worse: '
      + cind.map(function(b) { return '<b>' + b.seed + ' ' + b.team.name + '</b>'; }).join(', ') + '</div>';
  }
  return h + '</div></div>';
}

function renderNCAA_Hub() {
  var cr = curRound();
  var h = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:12px;">'
    + '<div><div class="sec-head" style="margin:0;">NCAA tournament</div><div class="sec-sub" style="margin:2px 0 0;">' + G.yr + ' · 64 teams, four regions</div></div>'
    + '<span class="tag">' + (cr >= 6 ? 'Complete' : ROUND_NAMES[cr]) + '</span></div>';
  h += cr >= 6 ? champCard() : userCard(cr);
  h += bracketPanel();
  h += upsetsPanel();
  return h;
}

// Region chips + auto-scroll to the current round (phones)
export function bindBracket(el, rerender) {
  if (!el || el._bxBound) return;
  el._bxBound = true;
  el.addEventListener('click', function(e) {
    var c = e.target.closest && e.target.closest('[data-brview]');
    if (!c) return;
    var v = c.getAttribute('data-brview');
    _brView = v === 'ff' ? 'ff' : parseInt(v, 10);
    setUiPrefs('bracket', { region: _brView });
    rerender();
  });
}
export function scrollBracketToRound(el) {
  var sc = el && el.querySelector('[data-bx-scroll]');
  if (!sc) return;
  var k = parseInt(sc.getAttribute('data-bx-scroll'), 10) || 0;
  var cols = sc.querySelectorAll('.bx-col');
  if (!cols[k] || sc.scrollWidth <= sc.clientWidth) return;
  var x = cols[k].getBoundingClientRect().left - cols[0].getBoundingClientRect().left;
  sc.style.scrollBehavior = 'auto';
  sc.scrollLeft = Math.max(0, x);
  sc.style.scrollBehavior = '';
}
