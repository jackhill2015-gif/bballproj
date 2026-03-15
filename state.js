// ═══════════════════════════════════════════════════════════
//  HOOPS OS — state.js
//  Versioned save system with automatic migrations.
// ═══════════════════════════════════════════════════════════

import { getTOvr } from './utils.js';
import { RECRUIT_STATE_POOL, calcSchoolPrestige, COACH_FN, COACH_LN } from './constants.js';

// ── Current save version — bump this when adding new fields ──
var SAVE_VERSION = 4;
var SAVE_KEY = 'hoops_os_v3';

// ── Main Game State ──
export const G = {
  tid: 0, yr: 2025, wk: 0, gi: 0, pts: 120,
  momentum: { tid: -1, pts: 0 },
  phase: 'reg', difficulty: 'normal',
  teams: [], recruits: [], bracket: [], confTourneys: {},
  confTitles: 0, championships: 0,
  logs: [], history: [], leagueChamps: [], simInterval: null,
  // Recruiting
  recruitPhase: 0, recruitingBudget: 0, recruitingSpent: 0,
  recruitTargets: [], departingPlayers: [],
  offseasonStep: 'turnover',
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
  }
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

export function saveState() {
  try {
    var lean = {
      _saveVersion: SAVE_VERSION,
      tid:G.tid,yr:G.yr,gi:G.gi,wk:G.wk,pts:G.pts,
      phase:G.phase,difficulty:G.difficulty,
      confTitles:G.confTitles,championships:G.championships,
      logs:G.logs.slice(0,30),history:G.history||[],leagueChamps:G.leagueChamps||[],
      recruitPhase:G.recruitPhase,recruitingBudget:G.recruitingBudget,
      recruitingSpent:G.recruitingSpent,recruitTargets:G.recruitTargets||[],
      departingPlayers:G.departingPlayers||[],offseasonStep:G.offseasonStep||'turnover',
      coach:G.coach,
      seasonAchievements:G.seasonAchievements,
      expectations:G.expectations,
      skillPointsEarned:G.skillPointsEarned,skillPointsToSpend:G.skillPointsToSpend,
      teams:G.teams.map(function(t,i){
        var b={id:t.id,wins:t.wins,loss:t.loss,cWins:t.cWins,cLoss:t.cLoss,
          pts:t.pts,ts:t.ts,schoolPrestige:t.schoolPrestige,coach:t.coach};
        if(i===G.tid){b.rost=t.rost;b.sched=t.sched;}
        else{b.sched=t.sched.map(function(s){
          if(!s||!s.played)return s;
          return{opp:s.opp,home:s.home,conf:s.conf,played:true,uScore:s.uScore,oScore:s.oScore};
        });}
        return b;
      }),
      recruits:G.recruits,bracket:G.bracket,confTourneys:G.confTourneys
    };
    var str=JSON.stringify(lean);
    localStorage.setItem(SAVE_KEY,str);
    console.log('[Save] v'+SAVE_VERSION+' '+Math.round(str.length/1024)+'KB');
  }catch(e){console.error('Save failed',e);}
}

// ═══════════════════════════════════════════════════════════
//  LOAD (with automatic migration)
// ═══════════════════════════════════════════════════════════

export function loadState() {
  try {
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
    G.bracket=s.bracket||[];G.confTourneys=s.confTourneys||{};
    G.recruits=s.recruits||[];
    G.recruitPhase=s.recruitPhase||0;G.recruitingBudget=s.recruitingBudget||0;
    G.recruitingSpent=s.recruitingSpent||0;
    G.recruitTargets=s.recruitTargets||[];
    G.departingPlayers=s.departingPlayers||[];
    G.offseasonStep=s.offseasonStep||'turnover';
    G.coach=s.coach||G.coach;
    G.seasonAchievements=s.seasonAchievements||G.seasonAchievements;
    G.expectations=s.expectations||null;
    G.skillPointsEarned=s.skillPointsEarned||0;
    G.skillPointsToSpend=s.skillPointsToSpend||0;

    // Recruits backward compat
    G.recruits.forEach(function(r){
      if(typeof r.points!=='number')r.points=0;
      if(typeof r.status!=='string')r.status=r.signed>=0?(r.signed===G.tid?'committed':'gone'):'open';
      if(!r.homeState)r.homeState=RECRUIT_STATE_POOL[Math.floor(Math.random()*RECRUIT_STATE_POOL.length)];
    });

    // Teams
    if(s.teams){s.teams.forEach(function(st,i){
      if(!G.teams[i])return;
      G.teams[i].wins=st.wins||0;G.teams[i].loss=st.loss||0;
      G.teams[i].cWins=st.cWins||0;G.teams[i].cLoss=st.cLoss||0;
      G.teams[i].pts=st.pts||G.teams[i].pts;G.teams[i].ts=st.ts||G.teams[i].ts;
      G.teams[i].sched=st.sched||[];
      if(st.schoolPrestige)G.teams[i].schoolPrestige=st.schoolPrestige;
      if(st.coach)G.teams[i].coach=st.coach;
      if(i===G.tid&&st.rost){
        G.teams[i].rost=st.rost;
        G.teams[i].rost.forEach(function(p){
          if(typeof p.pot!=='number'){
            var pg=p.cls==='FR'?12:p.cls==='SO'?8:p.cls==='JR'?4:1;
            p.pot=Math.min(99,p.ovr+pg);
          }
        });
      }
    });}
    console.log('[Load] v'+(s._saveVersion||1)+' Season '+G.yr+' gi='+G.gi);
    return true;
  }catch(e){console.error('Load failed',e);return false;}
}

export function deleteSave(){localStorage.removeItem(SAVE_KEY);}
export function hasSave(){return!!localStorage.getItem(SAVE_KEY);}
export function getRawSave(){
  var r=localStorage.getItem(SAVE_KEY);if(!r)return null;
  try{return JSON.parse(r);}catch(e){return null;}
}
