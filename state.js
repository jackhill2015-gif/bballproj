// ═══════════════════════════════════════════════════════════
//  HOOPS OS — state.js
//  Central game state, live-sim state, setup state.
//  Save / Load to localStorage.
// ═══════════════════════════════════════════════════════════

import { getTOvr } from './utils.js';

// ── Main Game State ──────────────────────────────────────
// Exported as a mutable singleton. Other modules import G
// and read/write its properties directly.
export const G = {
  tid: 0,
  yr: 2025,
  wk: 0,
  gi: 0,
  pts: 120,
  prestige: 3,
  momentum: { tid: -1, pts: 0 },
  phase: 'reg',
  difficulty: 'normal',
  teams: [],
  recruits: [],
  bracket: [],
  confTourneys: {},
  confTitles: 0,
  championships: 0,
  logs: [],
  history: [],
  leagueChamps: [],
  simInterval: null
};

// ── Live Sim State ───────────────────────────────────────
// Holds ephemeral data during a live or quick game simulation.
export const LS = {
  tH: null, tA: null, game: null, userTeam: null,
  clock: 0, half: 0, hs: 0, as: 0,
  h1: null, a1: null, poss: 'A',
  streak_h: 0, streak_a: 0
};

// Reset LS to a clean state (called before each game)
export function resetLS(vals) {
  Object.keys(LS).forEach(function(k) { LS[k] = null; });
  LS.clock = 0; LS.half = 0; LS.hs = 0; LS.as = 0; LS.poss = 'A';
  LS.streak_h = 0; LS.streak_a = 0;
  if (vals) Object.assign(LS, vals);
}

// ── Setup / UI State ─────────────────────────────────────
// These are used during the setup wizard and runtime navigation.
// Exported as a mutable object so modules can read/write.
export const SetupState = {
  NC_PICKS: [],
  DIFF: 'normal',
  SEL_TID: null,
  ACTIVE_VIEW: 'dashboard',
  G_AUTO: false       // auto-sim running flag
};

// ── Save State ───────────────────────────────────────────
export function saveState() {
  try {
    var lean = {
      tid: G.tid, yr: G.yr, gi: G.gi, wk: G.wk,
      pts: G.pts, prestige: G.prestige,
      phase: G.phase, difficulty: G.difficulty,
      confTitles: G.confTitles, championships: G.championships,
      logs: G.logs.slice(0, 30),
      history: G.history || [],
      leagueChamps: G.leagueChamps || [],
      teams: G.teams.map(function(t, i) {
        var base = {
          id: t.id, wins: t.wins, loss: t.loss,
          cWins: t.cWins, cLoss: t.cLoss,
          pts: t.pts, ts: t.ts
        };
        if (i === G.tid) {
          base.rost = t.rost;
          base.sched = t.sched;
        } else {
          base.sched = t.sched.map(function(s) {
            if (!s || !s.played) return s;
            return {
              opp: s.opp, home: s.home, conf: s.conf,
              played: true, uScore: s.uScore, oScore: s.oScore
            };
          });
        }
        return base;
      }),
      recruits: G.recruits,
      bracket: G.bracket,
      confTourneys: G.confTourneys
    };
    var str = JSON.stringify(lean);
    localStorage.setItem('hoops_os_v3', str);
    console.log('[Save] ' + Math.round(str.length / 1024) + 'KB');
  } catch (e) {
    console.error('Save failed', e);
  }
}

// ── Load State ───────────────────────────────────────────
// NOTE: Caller must call buildUniverse() BEFORE loadState()
// so that G.teams is populated with full roster data.
// loadState then overwrites records/schedules/user roster.
export function loadState() {
  try {
    var raw = localStorage.getItem('hoops_os_v3');
    if (!raw) return false;
    var saved = JSON.parse(raw);

    // Restore saved fields onto G
    G.tid = saved.tid;
    G.yr = saved.yr;
    G.gi = saved.gi || 0;
    G.wk = saved.wk || 0;
    G.pts = saved.pts;
    G.prestige = saved.prestige;
    G.phase = saved.phase;
    G.difficulty = saved.difficulty || 'normal';
    G.confTitles = saved.confTitles || 0;
    G.championships = saved.championships || 0;
    G.logs = saved.logs || [];
    G.history = saved.history || [];
    G.leagueChamps = saved.leagueChamps || [];
    G.bracket = saved.bracket || [];
    G.confTourneys = saved.confTourneys || {};
    G.recruits = saved.recruits || [];

    // Restore team records and schedules
    if (saved.teams) {
      saved.teams.forEach(function(st, i) {
        if (!G.teams[i]) return;
        G.teams[i].wins = st.wins || 0;
        G.teams[i].loss = st.loss || 0;
        G.teams[i].cWins = st.cWins || 0;
        G.teams[i].cLoss = st.cLoss || 0;
        G.teams[i].pts = st.pts || G.teams[i].pts;
        G.teams[i].ts = st.ts || G.teams[i].ts;
        G.teams[i].sched = st.sched || [];
        // Restore full roster for user team only
        if (i === G.tid && st.rost) G.teams[i].rost = st.rost;
      });
    }

    console.log('[Load] Season ' + G.yr + ' gi=' + G.gi);
    return true;
  } catch (e) {
    console.error('Load failed', e);
    return false;
  }
}

// ── Delete Save ──────────────────────────────────────────
export function deleteSave() {
  localStorage.removeItem('hoops_os_v3');
}

// ── Check for existing save ──────────────────────────────
export function hasSave() {
  return !!localStorage.getItem('hoops_os_v3');
}

export function getRawSave() {
  var raw = localStorage.getItem('hoops_os_v3');
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (e) { return null; }
}
