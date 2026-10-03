// ═══════════════════════════════════════════════════════════
//  HOOPS OS — state.js
//  Versioned save system with automatic migrations.
// ═══════════════════════════════════════════════════════════

import { getTOvr } from './utils.js';
import { RECRUIT_STATE_POOL, calcSchoolPrestige, COACH_FN, COACH_LN } from './constants.js';

// ── Current save version — bump this when adding new fields ──
var SAVE_VERSION = 10;
var SAVE_KEY = 'hoops_os_v3';

// ── Main Game State ──
export const G = {
  tid: 0, yr: 2025, wk: 0, gi: 0, pts: 120,
  momentum: { tid: -1, pts: 0 },
  phase: 'reg', difficulty: 'normal',
  teams: [], recruits: [], bracket: [], confTourneys: {},
  confTitles: 0, championships: 0, prestige: 3,
  logs: [], history: [], leagueChamps: [], simInterval: null,
  // Recruiting
  recruitPhase: 0, recruitingBudget: 0, recruitingSpent: 0,
  recruitTargets: [], departingPlayers: [],
  offseasonStep: 'turnover',
  // Transfer portal battle state (3-stage machine, views/battle.js).
  // Entrants persist so mid-battle reloads keep escrowed NIL offers.
  portalEntrants: [], portalStage: 0, portalCpuTakes: {}, portalUserSigns: 0,
  // Coach
  coach: {
    firstName: '', lastName: '', age: 30,
    off: 70, def: 70, dev: 70, rec: 70,
    xp: 0, level: 1,
    careerWins: 0, careerLoss: 0,
    tenure: 0, hotSeat: false,
    titles: 0, confTitles: 0, finalFours: 0, tourneyApps: 0,
    awards: [], history: []
  },
  seasonAchievements: {
    confTitleThisYear: false, madeNCAA: false,
    sweet16: false, finalFour: false,
    champGame: false, natChamp: false
  },
  // Record book + Hall of Fame (records.js). Null until first ensured;
  // old saves migrate cleanly via v8.
  records: null,
  expectations: null,
  skillPointsEarned: 0, skillPointsToSpend: 0
};

export const LS = {
  tH:null,tA:null,game:null,userTeam:null,
  clock:0,half:0,hs:0,as:0,h1:null,a1:null,poss:'A',
  streak_h:0,streak_a:0
};

export function resetLS(vals) {
  Object.keys(LS).forEach(function(k){LS[k]=null;});
  LS.clock=0;LS.half=0;LS.hs=0;LS.as=0;LS.poss='A';
  LS.streak_h=0;LS.streak_a=0;
  if(vals)Object.assign(LS,vals);
}

export const SetupState = {
  NC_PICKS:[],DIFF:'normal',SEL_TID:null,
  ACTIVE_VIEW:'dashboard',G_AUTO:false
};

export function calcRecruitingBudget() {
  var t=G.teams[G.tid];if(!t)return 50;
  var sp = t.schoolPrestige || 50;
  var open=Math.max(0,13-t.rost.length);
  var recBonus = Math.round(((G.coach ? G.coach.rec : 70) - 70) * 0.5);
  return Math.min(225,Math.max(50,50+Math.round(sp/5)+(open*10)+recBonus));
}

// ═══════════════════════════════════════════════════════════
//  MIGRATIONS
//  Each migration takes a raw save object and upgrades it.
//  They run in order: v1→v2→v3→v4→...
// ═══════════════════════════════════════════════════════════

var MIGRATIONS = {
  // v1→v2: Added recruiting system
  2: function(s) {
    if (!s.recruitPhase) s.recruitPhase = 0;
    if (!s.recruitingBudget) s.recruitingBudget = 0;
    if (!s.recruitingSpent) s.recruitingSpent = 0;
    if (!s.recruitTargets) s.recruitTargets = [];
    if (!s.departingPlayers) s.departingPlayers = [];
    if (!s.offseasonStep) s.offseasonStep = 'turnover';
    return s;
  },
  // v2→v3: Added coaching system + school prestige
  3: function(s) {
    if (!s.coach) {
      s.coach = {
        firstName: 'Coach', lastName: 'User', age: 30,
        off: 70, def: 70, dev: 70, rec: 70,
        xp: 0, level: 1, careerWins: 0, careerLoss: 0,
        tenure: 0, hotSeat: false,
        titles: s.championships || 0, confTitles: s.confTitles || 0,
        finalFours: 0, tourneyApps: 0, awards: [], history: []
      };
    }
    if (!s.seasonAchievements) {
      s.seasonAchievements = { confTitleThisYear:false, madeNCAA:false, sweet16:false, finalFour:false, champGame:false, natChamp:false };
    }
    if (typeof s.skillPointsEarned !== 'number') s.skillPointsEarned = 0;
    if (typeof s.skillPointsToSpend !== 'number') s.skillPointsToSpend = 0;
    // Add school prestige to teams
    if (s.teams) {
      s.teams.forEach(function(t) {
        if (!t.schoolPrestige && t.id !== undefined) {
          var baseOvr = t.baseOvr || t.pts / 10 || 70;
          t.schoolPrestige = calcSchoolPrestige(baseOvr);
        }
        if (!t.coach) {
          t.coach = {
            firstName: COACH_FN[Math.floor(Math.random() * COACH_FN.length)],
            lastName: COACH_LN[Math.floor(Math.random() * COACH_LN.length)],
            age: Math.floor(Math.random() * 30) + 35,
            off: 70, def: 70, dev: 70, rec: 70, tenure: 1
          };
        }
      });
    }
    return s;
  },
  // v3→v4: Added coach history, expectations, cleaned up prestige
  4: function(s) {
    if (s.coach && !s.coach.history) s.coach.history = [];
    if (s.coach && !s.coach.awards) s.coach.awards = [];
    if (!s.expectations) s.expectations = null;
    // Ensure all coach fields exist
    var cd = { firstName:'Coach',lastName:'User',age:30,off:70,def:70,dev:70,rec:70,xp:0,level:1,careerWins:0,careerLoss:0,tenure:0,hotSeat:false,titles:0,confTitles:0,finalFours:0,tourneyApps:0,awards:[],history:[] };
    Object.keys(cd).forEach(function(k) {
      if (s.coach && s.coach[k] === undefined) s.coach[k] = cd[k];
    });
    return s;
  },
  // v4→v5: Added hot seat, firing, expectations failsafe
  5: function(s) {
    if (s.coach && s.coach.hotSeat === undefined) s.coach.hotSeat = false;
    if (!s.expectations) s.expectations = { low: 12, high: 18, danger: 7, base: 15 };
    if (!s.seasonAchievements) s.seasonAchievements = { confTitleThisYear:false, madeNCAA:false, sweet16:false, finalFour:false, champGame:false, natChamp:false };
    if (typeof s.skillPointsEarned !== 'number') s.skillPointsEarned = 0;
    if (typeof s.skillPointsToSpend !== 'number') s.skillPointsToSpend = 0;
    return s;
  },
  // v5→v6: Added mid-season events (injuries, buffs, home bonus)
  6: function(s) {
    if (!s.injuries) s.injuries = [];
    if (!s.buffs) s.buffs = [];
    if (typeof s.nextHomeBonus !== 'number') s.nextHomeBonus = 0;
    return s;
  },
  // v6→v7: Persist coach prestige (S9) — derive from user's school prestige like a new game does
  7: function(s) {
    if (typeof s.prestige !== 'number') {
      var ut = s.teams && s.teams[s.tid];
      var sp = (ut && ut.schoolPrestige) || 50;
      s.prestige = Math.max(1, Math.round(sp / 20));
    }
    return s;
  },
  // v7→v8: Record book + Hall of Fame — start empty, fill as you play
  8: function(s) {
    if (!s.records) s.records = null;
    return s;
  },
  // v8→v9: Portal battle state — persist entrants/offers mid-battle
  9: function(s) {
    if (!Array.isArray(s.portalEntrants)) s.portalEntrants = [];
    if (typeof s.portalStage !== 'number') s.portalStage = 0;
    if (!s.portalCpuTakes) s.portalCpuTakes = {};
    if (typeof s.portalUserSigns !== 'number') s.portalUserSigns = 0;
    return s;
  },
  // v9→v10: Whole league persists (every CPU roster, strategy, coach history).
  // Older saves only stored the user's roster; CPU teams in those saves keep
  // the freshly generated rosters from buildUniverse() — nothing to migrate.
  10: function(s) { return s; }
};

function runMigrations(s) {
  var ver = s._saveVersion || 1;
  while (ver < SAVE_VERSION) {
    ver++;
    if (MIGRATIONS[ver]) {
      console.log('[Migration] v' + (ver-1) + ' → v' + ver);
      s = MIGRATIONS[ver](s);
    }
  }
  s._saveVersion = SAVE_VERSION;
  return s;
}

// ═══════════════════════════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════════════════════════

// ── S10: saveState is internally debounced (trailing ~1s) so rapid successive
// calls (advanceWeek, sim ticks) batch into a single write. saveStateNow()
// performs an immediate checkpoint write. loadState()/getRawSave() flush any
// pending debounced save first, so a read always sees the latest state.
var _saveTimer = null;

export function saveState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function() {
    _saveTimer = null;
    _writeSave();
  }, 1000);
  // Don't hold the node event loop open for the trailing write alone
  if (_saveTimer && typeof _saveTimer.unref === 'function') _saveTimer.unref();
}

export function saveStateNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _writeSave();
}

function _flushPendingSave() {
  if (_saveTimer) saveStateNow();
}

// ── S10: slim serializers. bracket/confTourneys embed full team objects
// (with 13-player rosters) — serialize them as team IDs and rehydrate on load.
// Recruits persist fully while unsigned, but finalized (signed) recruits only
// keep outcome data; transient UI caches (_schools) are never persisted.
function _slimBracket(bracket) {
  return (bracket || []).map(function(b) {
    var t = b.team;
    return {
      team: (t === null || t === undefined) ? null : (typeof t === 'number' ? t : t.id),
      seed: b.seed, region: b.region, active: !!b.active, score: b.score, won: !!b.won
    };
  });
}

function _slimConfTourneys(cts) {
  var out = {};
  Object.keys(cts || {}).forEach(function(conf) {
    var ct = cts[conf];
    var idOf = function(t) { return (t === null || t === undefined) ? null : (typeof t === 'number' ? t : t.id); };
    out[conf] = {
      seeds: (ct.seeds || []).map(idOf),
      rounds: (ct.rounds || []).map(function(rd) {
        return rd.map(function(m) {
          return { t1: idOf(m.t1), t2: idOf(m.t2), s1: m.s1, s2: m.s2, winner: idOf(m.winner) };
        });
      }),
      carry: (ct.carry || []).map(idOf), // T3: teams holding a bye into the next round
      done: !!ct.done,
      champ: idOf(ct.champ)
    };
  });
  return out;
}

function _slimRecruits(recruits) {
  return (recruits || []).map(function(r) {
    var slim = {};
    Object.keys(r).forEach(function(k) {
      if (k === '_schools' || k === '_schoolsPhase') return; // transient UI cache
      slim[k] = r[k];
    });
    if (r.signed >= 0) {
      // Finalized recruit: recruiting is over, drop per-school bidding state.
      // (interest is kept — calcUserBid reads it unguarded.)
      delete slim.rivals;
      delete slim.points;
    }
    return slim;
  });
}

// ── v10: compact roster packing. Every team's roster is saved (the whole
// league must survive Continue). Players are packed column-wise against a
// shared key table so 365 x 13 players stays well inside localStorage limits.
function _packRosters(teams) {
  var schemas = [], schemaIdx = {};
  function schemaFor(o) {
    var keys = Object.keys(o);
    var sig = keys.join('|');
    if (schemaIdx[sig] === undefined) { schemaIdx[sig] = schemas.length; schemas.push(keys); }
    return schemaIdx[sig];
  }
  function pack(o) {
    var si = schemaFor(o), keys = schemas[si], row = [si];
    for (var i = 0; i < keys.length; i++) {
      var v = o[keys[i]];
      // nested plain objects (season stats) are packed too, flagged with {_:row}
      row.push(v && typeof v === 'object' && !Array.isArray(v) ? { _: pack(v) } : v);
    }
    return row;
  }
  return {
    schemas: schemas,
    rosters: teams.map(function(t) { return (t.rost || []).map(pack); })
  };
}

function _unpackRosters(packed) {
  var schemas = packed.schemas || [];
  function unpack(row) {
    var keys = schemas[row[0]], o = {};
    for (var i = 0; i < keys.length; i++) {
      var v = row[i + 1];
      o[keys[i]] = v && typeof v === 'object' && !Array.isArray(v) && v._ ? unpack(v._) : v;
    }
    return o;
  }
  return (packed.rosters || []).map(function(r) { return (r || []).map(unpack); });
}

function _writeSave() {
  try {
    var lean = {
      _saveVersion: SAVE_VERSION,
      tid:G.tid,yr:G.yr,gi:G.gi,wk:G.wk,pts:G.pts,
      phase:G.phase,difficulty:G.difficulty,
      confTitles:G.confTitles,championships:G.championships,prestige:G.prestige,
      logs:G.logs.slice(0,30),history:G.history||[],leagueChamps:G.leagueChamps||[],
      records:G.records||null,
      recruitPhase:G.recruitPhase,recruitingBudget:G.recruitingBudget,
      recruitingSpent:G.recruitingSpent,recruitTargets:G.recruitTargets||[],
      departingPlayers:G.departingPlayers||[],offseasonStep:G.offseasonStep||'turnover',
      portalEntrants:G.portalEntrants||[],portalStage:G.portalStage||0,
      portalCpuTakes:G.portalCpuTakes||{},portalUserSigns:G.portalUserSigns||0,
      coach:G.coach,
      seasonAchievements:G.seasonAchievements,
      expectations:G.expectations,
      skillPointsEarned:G.skillPointsEarned,skillPointsToSpend:G.skillPointsToSpend,
      teams:G.teams.map(function(t,i){
        var b={id:t.id,wins:t.wins,loss:t.loss,cWins:t.cWins,cLoss:t.cLoss,
          pts:t.pts,ts:t.ts,schoolPrestige:t.schoolPrestige,coach:t.coach,
          strat:t.strat,streak:t.streak||0,coachHistory:t.coachHistory||[],lastRank:t.lastRank||0,rating:t.rating||0};
        if(i===G.tid){b.sched=t.sched;}
        else{
          // v10: CPU schedule entries packed as [opp, home, conf, played, uScore, oScore]
          b.sched=t.sched.map(function(s){
            if(!s)return null;
            return[s.opp,s.home?1:0,s.conf?1:0,s.played?1:0,s.uScore||0,s.oScore||0];
          });}
        return b;
      }),
      // v10: every roster in the league (user's included), packed
      rosters:_packRosters(G.teams),
      recruits:_slimRecruits(G.recruits),
      bracket:_slimBracket(G.bracket),
      confTourneys:_slimConfTourneys(G.confTourneys),
      injuries:G.injuries||[],buffs:G.buffs||[],nextHomeBonus:G.nextHomeBonus||0,
      lastResult:G.lastResult||null
    };
    var str=JSON.stringify(lean);
    try { localStorage.setItem(SAVE_KEY,str); }
    catch (qe) {
      // Out of space: drop the activity log (non-essential) and retry once
      lean.logs = [];
      str = JSON.stringify(lean);
      localStorage.setItem(SAVE_KEY,str);
    }
    console.log('[Save] v'+SAVE_VERSION+' '+Math.round(str.length/1024)+'KB');
  }catch(e){console.error('Save failed',e);}
}

// ═══════════════════════════════════════════════════════════
//  LOAD (with automatic migration)
// ═══════════════════════════════════════════════════════════

// ── S10: rehydrate slimmed tournament data. Team refs may already be full
// objects (legacy saves) or team ids (v7+) — accept both.
function _teamRef(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return G.teams[x] || null;
  // Legacy full team object: re-resolve to the live team by id
  if (typeof x.id === 'number' && G.teams[x.id]) return G.teams[x.id];
  return x;
}

function _fattenBracket(slim) {
  return (slim || []).map(function(b) {
    return { team: _teamRef(b.team), seed: b.seed, region: b.region, active: !!b.active, score: b.score, won: !!b.won };
  });
}

function _fattenConfTourneys(slim) {
  var out = {};
  Object.keys(slim || {}).forEach(function(conf) {
    var ct = slim[conf];
    out[conf] = {
      seeds: (ct.seeds || []).map(_teamRef),
      rounds: (ct.rounds || []).map(function(rd) {
        return rd.map(function(m) {
          return { t1: _teamRef(m.t1), t2: _teamRef(m.t2), s1: m.s1, s2: m.s2, winner: _teamRef(m.winner) };
        });
      }),
      carry: (ct.carry || []).map(_teamRef), // T3: restore bye teams
      done: !!ct.done,
      champ: _teamRef(ct.champ)
    };
  });
  return out;
}

export function loadState() {
  try {
    _flushPendingSave();
    var raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;
    var s=JSON.parse(raw);

    // Run migrations if needed
    var ver = s._saveVersion || 1;
    if (ver < SAVE_VERSION) {
      console.log('[Load] Save version ' + ver + ', current ' + SAVE_VERSION + ' — migrating...');
      s = runMigrations(s);
      // Re-save migrated data
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      console.log('[Load] Migration complete.');
    }

    // Apply to G
    G.tid=s.tid;G.yr=s.yr;G.gi=s.gi||0;G.wk=s.wk||0;G.pts=s.pts;
    G.phase=s.phase;G.difficulty=s.difficulty||'normal';
    G.confTitles=s.confTitles||0;G.championships=s.championships||0;
    G.logs=s.logs||[];G.history=s.history||[];G.leagueChamps=s.leagueChamps||[];
    G.records=s.records||null;
    G.recruits=s.recruits||[];
    // S9: restore persisted prestige (v7+); older saves get the v7 migration,
    // and anything else falls back to the new-game derivation
    if (typeof s.prestige === 'number') {
      G.prestige = s.prestige;
    } else {
      var _ut = G.teams[G.tid || s.tid];
      G.prestige = _ut ? Math.max(1, Math.round(((_ut.schoolPrestige) || 50) / 20)) : 3;
    }
    G.recruitPhase=s.recruitPhase||0;G.recruitingBudget=s.recruitingBudget||0;
    G.recruitingSpent=s.recruitingSpent||0;
    G.recruitTargets=s.recruitTargets||[];
    G.departingPlayers=s.departingPlayers||[];
    G.offseasonStep=s.offseasonStep||'turnover';
    G.portalEntrants=s.portalEntrants||[];
    G.portalStage=s.portalStage||0;
    G.portalCpuTakes=s.portalCpuTakes||{};
    G.portalUserSigns=s.portalUserSigns||0;
    G.coach=s.coach||G.coach;
    G.seasonAchievements=s.seasonAchievements||G.seasonAchievements;
    G.expectations=s.expectations||null;
    G.skillPointsEarned=s.skillPointsEarned||0;
    G.skillPointsToSpend=s.skillPointsToSpend||0;
    G.injuries=s.injuries||[];
    G.buffs=s.buffs||[];
    G.nextHomeBonus=s.nextHomeBonus||0;
    G.lastResult=s.lastResult||null;

    // Recruits backward compat
    G.recruits.forEach(function(r){
      if(typeof r.points!=='number')r.points=0;
      if(typeof r.status!=='string')r.status=r.signed>=0?(r.signed===G.tid?'committed':'gone'):'open';
      if(!r.homeState)r.homeState=RECRUIT_STATE_POOL[Math.floor(Math.random()*RECRUIT_STATE_POOL.length)];
    });

    // Teams
    var _rosters = s.rosters ? _unpackRosters(s.rosters) : null;
    if(s.teams){s.teams.forEach(function(st,i){
      if(!G.teams[i])return;
      G.teams[i].wins=st.wins||0;G.teams[i].loss=st.loss||0;
      G.teams[i].cWins=st.cWins||0;G.teams[i].cLoss=st.cLoss||0;
      G.teams[i].pts=st.pts||G.teams[i].pts;G.teams[i].ts=st.ts||G.teams[i].ts;
      G.teams[i].sched=(st.sched||[]).map(function(e){
        if(!Array.isArray(e))return e;
        return{opp:e[0],home:!!e[1],conf:!!e[2],played:!!e[3],uScore:e[4],oScore:e[5]};
      });
      if(st.schoolPrestige)G.teams[i].schoolPrestige=st.schoolPrestige;
      if(st.coach)G.teams[i].coach=st.coach;
      if(st.strat)G.teams[i].strat=st.strat;
      if(typeof st.streak==='number')G.teams[i].streak=st.streak;
      if(st.coachHistory)G.teams[i].coachHistory=st.coachHistory;
      if(st.lastRank)G.teams[i].lastRank=st.lastRank;
      if(typeof st.rating==='number')G.teams[i].rating=st.rating;
      // v10 saves carry every roster; v9 and older only had the user's (st.rost)
      var _r = (_rosters && _rosters[i] && _rosters[i].length) ? _rosters[i] : (i===G.tid ? st.rost : null);
      if(_r)G.teams[i].rost=_r;
      if(_r){
        G.teams[i].rost.forEach(function(p){
          if(typeof p.pot!=='number'){
            var pg=p.cls==='FR'?12:p.cls==='SO'?8:p.cls==='JR'?4:1;
            p.pot=Math.min(99,p.ovr+pg);
          }
          if(typeof p.morale!=='number')p.morale=50; // morale system (v8)
        });
      }
    });}
    // S10: rehydrate slimmed tournament data (team IDs → team objects)
    G.bracket=_fattenBracket(s.bracket);
    G.confTourneys=_fattenConfTourneys(s.confTourneys);
    console.log('[Load] v'+(s._saveVersion||1)+' Season '+G.yr+' gi='+G.gi);
    return true;
  }catch(e){console.error('Load failed',e);return false;}
}

export function deleteSave(){
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
export function hasSave(){ try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function getRawSave(){
  _flushPendingSave();
  var r = null;
  try { r = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  if(!r)return null;
  try{return JSON.parse(r);}catch(e){return null;}
}
