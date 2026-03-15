// ═══════════════════════════════════════════════════════════
//  HOOPS OS — state.js
// ═══════════════════════════════════════════════════════════

import { getTOvr } from './utils.js';
import { RECRUIT_STATE_POOL } from './constants.js';

export const G = {
  tid: 0, yr: 2025, wk: 0, gi: 0, pts: 120, prestige: 3,
  momentum: { tid: -1, pts: 0 },
  phase: 'reg', difficulty: 'normal',
  teams: [], recruits: [], bracket: [], confTourneys: {},
  confTitles: 0, championships: 0,
  logs: [], history: [], leagueChamps: [], simInterval: null,
  // Recruiting
  recruitPhase: 0, recruitingBudget: 0, recruitingSpent: 0,
  recruitTargets: [],       // array of recruit IDs user is pursuing
  departingPlayers: [],     // set during roster turnover
  offseasonStep: 'turnover' // 'turnover' | 'recruiting' | done
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
  if(vals) Object.assign(LS,vals);
}

export const SetupState = {
  NC_PICKS:[],DIFF:'normal',SEL_TID:null,
  ACTIVE_VIEW:'dashboard',G_AUTO:false
};

export function calcRecruitingBudget() {
  var t=G.teams[G.tid]; if(!t) return 50;
  var open=Math.max(0,13-t.rost.length);
  return Math.min(225,Math.max(50,50+(G.prestige*10)+(open*10)));
}

export function saveState() {
  try {
    var lean = {
      tid:G.tid,yr:G.yr,gi:G.gi,wk:G.wk,pts:G.pts,prestige:G.prestige,
      phase:G.phase,difficulty:G.difficulty,
      confTitles:G.confTitles,championships:G.championships,
      logs:G.logs.slice(0,30),history:G.history||[],leagueChamps:G.leagueChamps||[],
      recruitPhase:G.recruitPhase,recruitingBudget:G.recruitingBudget,
      recruitingSpent:G.recruitingSpent,recruitTargets:G.recruitTargets||[],
      departingPlayers:G.departingPlayers||[],offseasonStep:G.offseasonStep||'turnover',
      teams:G.teams.map(function(t,i){
        var b={id:t.id,wins:t.wins,loss:t.loss,cWins:t.cWins,cLoss:t.cLoss,pts:t.pts,ts:t.ts};
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
    localStorage.setItem('hoops_os_v3',str);
    console.log('[Save] '+Math.round(str.length/1024)+'KB');
  } catch(e){console.error('Save failed',e);}
}

export function loadState() {
  try {
    var raw=localStorage.getItem('hoops_os_v3'); if(!raw)return false;
    var s=JSON.parse(raw);
    G.tid=s.tid;G.yr=s.yr;G.gi=s.gi||0;G.wk=s.wk||0;G.pts=s.pts;G.prestige=s.prestige;
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
    G.recruits.forEach(function(r){
      if(typeof r.points!=='number')r.points=0;
      if(typeof r.status!=='string')r.status=r.signed>=0?(r.signed===G.tid?'committed':'gone'):'open';
      if(!r.homeState)r.homeState=RECRUIT_STATE_POOL[Math.floor(Math.random()*RECRUIT_STATE_POOL.length)];
    });
    if(s.teams){s.teams.forEach(function(st,i){
      if(!G.teams[i])return;
      G.teams[i].wins=st.wins||0;G.teams[i].loss=st.loss||0;
      G.teams[i].cWins=st.cWins||0;G.teams[i].cLoss=st.cLoss||0;
      G.teams[i].pts=st.pts||G.teams[i].pts;G.teams[i].ts=st.ts||G.teams[i].ts;
      G.teams[i].sched=st.sched||[];
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
    console.log('[Load] Season '+G.yr+' gi='+G.gi);
    return true;
  }catch(e){console.error('Load failed',e);return false;}
}

export function deleteSave(){localStorage.removeItem('hoops_os_v3');}
export function hasSave(){return!!localStorage.getItem('hoops_os_v3');}
export function getRawSave(){
  var r=localStorage.getItem('hoops_os_v3');if(!r)return null;
  try{return JSON.parse(r);}catch(e){return null;}
}
