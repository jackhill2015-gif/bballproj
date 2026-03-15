// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/recruiting.js
//  Roster Turnover + Tab-Based Recruiting System
// ═══════════════════════════════════════════════════════════

import { ge, clamp } from '../utils.js';
import { TEAM_STATES, STATE_TO_REGION, STATE_NAMES, SCHOOL_RECRUIT_GATES } from '../constants.js';
import { G, SetupState, saveState, calcRecruitingBudget } from '../state.js';

var _ext = { toast: null, addLog: null, updateAll: null };
export function registerRecruitingCallbacks(cb) {
  Object.keys(cb).forEach(function(k) { if (_ext.hasOwnProperty(k)) _ext[k] = cb[k]; });
}
function toast(m,c) { if(_ext.toast)_ext.toast(m,c); }
function addLog(t,w,x) { if(_ext.addLog)_ext.addLog(t,w,x); }
function updateAll() { if(_ext.updateAll)_ext.updateAll(); }

// ── Current recruiting tab ──
var _tab = 'board';
var _filter = { pos: 'All', stars: 0, sort: 'rank' };
var _detailId = -1; // recruit ID shown in detail, -1 = none

// ═══════════════════════════════════════════════════════════
//  PHASE CONFIG
// ═══════════════════════════════════════════════════════════
var PHASES = {
  1:{name:'Evaluation Period',tag:'PHASE 1 OF 3',desc:'Browse and target recruits. No decisions yet.',btnLabel:'ADVANCE TO EARLY SIGNING \u25b6',btnAction:'advanceRecruitPhase()',decisionRate:0.30,cpuAgg:0.8},
  2:{name:'Early Signing Period',tag:'PHASE 2 OF 3',desc:'Top prospects decide. Refunded points can be reinvested.',btnLabel:'ADVANCE TO LATE SIGNING \u25b6',btnAction:'advanceRecruitPhase()',decisionRate:0.55,cpuAgg:1.1},
  3:{name:'Late Signing Period',tag:'PHASE 3 OF 3',desc:'All remaining recruits make their decision.',btnLabel:'FINALIZE CLASS & START SEASON \u25b6',btnAction:'doOffseason()',decisionRate:1.0,cpuAgg:1.4}
};

// ═══════════════════════════════════════════════════════════
//  GEO + BID HELPERS
// ═══════════════════════════════════════════════════════════
function getTeamState(t){return TEAM_STATES[t.name]||'XX';}
function getGeoBonus(ts,rs){if(!ts||!rs||ts==='XX')return 0;if(ts===rs)return 0.20;var tr=STATE_TO_REGION[ts],rr=STATE_TO_REGION[rs];if(tr&&tr===rr)return 0.10;return 0;}
function getGeoLabel(ts,rs){if(!ts||!rs||ts==='XX')return'';if(ts===rs)return'HOME';var tr=STATE_TO_REGION[ts],rr=STATE_TO_REGION[rs];if(tr&&tr===rr)return'REGION';return'';}

function calcUserBid(r) {
  var sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  var recMod = 0.7 + ((G.coach ? G.coach.rec : 70) / 100) * 0.6;
  var us = getTeamState(G.teams[G.tid]);
  var geo = getGeoBonus(us, r.homeState);
  var base = ((r.points||0) * recMod * 1.5 + r.interest * 0.4) * (1 + geo);
  var gatePrestige = SCHOOL_RECRUIT_GATES[r.stars] || 0;
  if (sp < gatePrestige) {
    var deficit = gatePrestige - sp;
    base *= Math.max(0.1, 1 - (deficit / 50));
  }
  return base;
}

function calcSchoolChances(r) {
  var ranked = G.teams.slice().sort(function(a,b){return b.pts-a.pts;});
  var cpuAgg = (PHASES[G.recruitPhase]||PHASES[1]).cpuAgg;
  var schools = [];

  // User bid (only if invested)
  var userBid = calcUserBid(r);
  if((r.points||0)>0) {
    var userGeo = getGeoLabel(getTeamState(G.teams[G.tid]),r.homeState);
    schools.push({name:G.teams[G.tid].name,bid:userBid,isUser:true,geo:userGeo,rank:ranked.findIndex(function(t){return t.id===G.tid;})+1});
  }

  // Use PERSISTENT rivals from recruit generation — never reshuffles
  var rivals = r.rivals || [];
  rivals.forEach(function(rv){
    var team = G.teams[rv.tid];
    if(!team) return;
    var rk = ranked.findIndex(function(t){return t.id===rv.tid;})+1;
    var pw = rk<=10?1.8:rk<=25?1.4:rk<=64?1.0:0.65;
    var sb = r.stars>=5?1.6:r.stars>=4?1.3:r.stars>=3?1.0:0.7;
    var geo = getGeoBonus(getTeamState(team),r.homeState);
    // Deterministic bid based on rank + star + geo (seeded by recruit id + rival id)
    var seed = ((r.id * 7 + rv.tid * 13) % 100) / 100;
    var bid = (seed*30+20)*pw*sb*cpuAgg*(1+geo);
    var geoL = getGeoLabel(getTeamState(team),r.homeState);
    schools.push({name:rv.name,bid:bid,isUser:false,geo:geoL,rank:rk});
  });

  // Convert to percentages
  var total = schools.reduce(function(s,x){return s+x.bid;},0);
  if(total===0) total=1;
  schools.forEach(function(s){s.pct=Math.round((s.bid/total)*100);});
  schools.sort(function(a,b){return b.pct-a.pct;});
  schools.forEach(function(s){if(s.pct<1&&s.bid>0)s.pct=1;});
  return schools;
}

// Cache school chances per recruit per phase
function getSchoolChances(r) {
  if(!r._schools||r._schoolsPhase!==G.recruitPhase){
    r._schools=calcSchoolChances(r);r._schoolsPhase=G.recruitPhase;
  }
  return r._schools;
}

function recalcSpent(){
  G.recruitingSpent=G.recruits.reduce(function(s,r){return s+(r.status==='open'?(r.points||0):0);},0);
}

function initRecruitingIfNeeded(){
  if(G.recruitPhase===0){G.recruitPhase=1;G.recruitingBudget=calcRecruitingBudget();G.recruitingSpent=0;}
  G.recruits.forEach(function(r){
    if(typeof r.points!=='number')r.points=0;
    if(typeof r.status!=='string')r.status=r.signed>=0?(r.signed===G.tid?'committed':'gone'):'open';
    if(!r.homeState)r.homeState='CA';
  });
}

// ═══════════════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════════════

export function adjustPoints(rid,delta){
  var r=G.recruits.find(function(x){return x.id===rid;});
  if(!r||r.status!=='open')return;
  var nv=(r.points||0)+delta;if(nv<0)return;
  var left=G.recruitingBudget-G.recruitingSpent;
  if(delta>0&&left<delta)return;
  r.points=nv; delete r._schools; delete r._schoolsPhase;
  recalcSpent();saveState();renderOffseason();
}
window.adjustPoints=adjustPoints;

export function addTarget(rid){
  if(G.recruitTargets.indexOf(rid)<0)G.recruitTargets.push(rid);
  saveState();renderOffseason();
}
window.addTarget=addTarget;

export function removeTarget(rid){
  G.recruitTargets=G.recruitTargets.filter(function(x){return x!==rid;});
  var r=G.recruits.find(function(x){return x.id===rid;});
  if(r){r.points=0;delete r._schools;delete r._schoolsPhase;}
  recalcSpent();saveState();renderOffseason();
}
window.removeTarget=removeTarget;

export function showDetail(rid){_detailId=rid;renderOffseason();}
window.showDetail=showDetail;

export function closeDetail(){_detailId=-1;renderOffseason();}
window.closeDetail=closeDetail;

export function setRecruitTab(tab){_tab=tab;_detailId=-1;renderOffseason();}
window.setRecruitTab=setRecruitTab;

export function setRecruitFilter(key,val){_filter[key]=val;renderOffseason();}
window.setRecruitFilter=setRecruitFilter;

export function proceedToRecruiting(){
  // Remove departing players from roster
  var t=G.teams[G.tid];
  var dominated=G.departingPlayers.map(function(d){return d.name;});
  t.rost=t.rost.filter(function(p){return dominated.indexOf(p.name)<0;});
  G.offseasonStep='recruiting';
  genRecruitsFn();
  saveState();renderOffseason();
}
window.proceedToRecruiting=proceedToRecruiting;

// We need to call genRecruits from season.js — use window bridge
function genRecruitsFn(){if(window._genRecruits)window._genRecruits();}

// ═══════════════════════════════════════════════════════════
//  PHASE RESOLUTION
// ═══════════════════════════════════════════════════════════

export function advanceRecruitPhase(){
  var phase=PHASES[G.recruitPhase];if(!phase)return;
  var open=G.recruits.filter(function(r){return r.status==='open';});
  var num=Math.max(1,Math.round(open.length*phase.decisionRate));
  open.sort(function(a,b){return((b.points||0)+b.interest)-((a.points||0)+a.interest);});
  var deciding=open.slice(0,num);
  var newC=[],newG=[],refund=0;
  deciding.forEach(function(r){
    var ub=calcUserBid(r);
    var schools=calcSchoolChances(r);
    var bestCPU=schools.filter(function(s){return!s.isUser;}).sort(function(a,b){return b.bid-a.bid;})[0];
    var bestBid=bestCPU?bestCPU.bid:0;
    if(r.points>=10&&ub>bestBid){r.signed=G.tid;r.status='committed';newC.push(r);}
    else if(r.points>=5&&ub>bestBid*0.85&&Math.random()<0.35){r.signed=G.tid;r.status='committed';newC.push(r);}
    else if(r.points>0&&ub>bestBid*0.7&&Math.random()<0.15){r.signed=G.tid;r.status='committed';newC.push(r);}
    else if(bestCPU){
      var ch=r.stars>=5?0.80:r.stars>=4?0.70:r.stars>=3?0.55:0.40;
      ch*=phase.cpuAgg;
      if(Math.random()<ch){r.signed=bestCPU.rank;r.status='gone';r.goneTo=bestCPU.name;newG.push(r);}
    }
    if(r.status!=='open'&&r.points>0){refund+=r.points;r.points=0;}
  });
  G.recruitTargets=G.recruitTargets.filter(function(id){var r=G.recruits.find(function(x){return x.id===id;});return r&&r.status==='open';});
  G.recruits.forEach(function(r){delete r._schools;delete r._schoolsPhase;});
  recalcSpent();
  newC.forEach(function(r){addLog('ev',G.gi,r.name+' ('+r.stars+'\u2605) <b>commits!</b>');});
  newG.forEach(function(r){addLog('ev',G.gi,r.name+' signed with <b>'+(r.goneTo||'another school')+'</b>.');});
  var parts=[];
  if(newC.length)parts.push(newC.length+' commit'+(newC.length>1?'s':''));
  if(newG.length)parts.push(newG.length+' lost');
  if(refund>0)parts.push(refund+' pts refunded');
  parts.push(G.recruits.filter(function(r){return r.status==='open';}).length+' still open');
  toast(phase.name+': '+parts.join(' \u00b7 '),newC.length?'var(--grn)':'var(--gld)');
  if(G.recruitPhase<3)G.recruitPhase++;
  saveState();updateAll();renderOffseason();
}
window.advanceRecruitPhase=advanceRecruitPhase;

export function resolveRecruitingClass(){
  if(G.recruitPhase<3){while(G.recruitPhase<3)advanceRecruitPhase();}
  G.recruits.forEach(function(r){
    if(r.status!=='open')return;
    var ub=calcUserBid(r);var schools=calcSchoolChances(r);
    var best=schools.filter(function(s){return!s.isUser;}).sort(function(a,b){return b.bid-a.bid;})[0];
    var bb=best?best.bid:0;
    if(r.points>=5&&ub>bb*0.7){r.signed=G.tid;r.status='committed';addLog('ev',G.gi,r.name+' ('+r.stars+'\u2605) <b>commits!</b> (late)');}
    else if(best){r.signed=-1;r.status='gone';r.goneTo=best.name;}
    else{r.status='gone';r.signed=-1;}
    r.points=0;
  });
  var tot=G.recruits.filter(function(r){return r.signed===G.tid;});
  toast('Class finalized: '+tot.length+' signee'+(tot.length!==1?'s':'')+'!',tot.length>=3?'var(--grn)':'var(--gld)');
  G.recruitPhase=0;G.recruitingBudget=0;G.recruitingSpent=0;G.recruitTargets=[];
  saveState();
}
window.resolveRecruitingClass=resolveRecruitingClass;

// ═══════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════

export function renderOffseason(){
  var el=ge('offseason-content');if(!el)return;

  // Route to correct screen
  if(G.offseasonStep==='recap'){
    // Render recap inside the offseason view
    if(window._renderSeasonRecap) el.innerHTML=window._renderSeasonRecap();
    else el.innerHTML='<div style="padding:40px;text-align:center;color:var(--txt3);">Season recap loading...</div>';
    return;
  }

  if(G.offseasonStep==='turnover'||!G.offseasonStep){
    el.innerHTML=renderTurnover();return;
  }

  initRecruitingIfNeeded();
  var phase=PHASES[G.recruitPhase]||PHASES[1];
  var left=G.recruitingBudget-G.recruitingSpent;
  var commits=G.recruits.filter(function(r){return r.status==='committed';});
  var open=G.recruits.filter(function(r){return r.status==='open';});
  var h='';

  // ── Header bar ──
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
    +'<div><div style="font-size:18px;font-weight:900;">Recruiting '+G.yr+'</div>'
    +'<div style="font-size:11px;color:var(--txt2);">'+phase.name+' \u2014 '+phase.desc+'</div></div>'
    +'<div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1.5px;background:rgba(229,62,62,.1);padding:4px 12px;border-radius:4px;">'+phase.tag+'</div></div>';

  // ── Stats bar ──
  h+='<div style="display:flex;gap:16px;margin-bottom:12px;padding:10px 14px;background:var(--s1);border:1px solid var(--bdr);border-radius:6px;">'
    +'<div style="text-align:center;"><div style="font-size:18px;font-weight:900;color:'+(left>30?'var(--grn2)':left>0?'var(--gld2)':'#fc8181')+';">'+left+'</div><div style="font-size:9px;color:var(--txt3);">BUDGET</div></div>'
    +'<div style="text-align:center;"><div style="font-size:18px;font-weight:900;">'+((G.teams[G.tid]&&G.teams[G.tid].schoolPrestige)||50)+'</div><div style="font-size:9px;color:var(--txt3);">PRESTIGE</div></div>'
    +'<div style="text-align:center;"><div style="font-size:18px;font-weight:900;">'+Math.max(0,13-G.teams[G.tid].rost.length)+'</div><div style="font-size:9px;color:var(--txt3);">OPEN SPOTS</div></div>'
    +'<div style="text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--grn2);">'+commits.length+'</div><div style="font-size:9px;color:var(--txt3);">COMMITS</div></div>'
    +'<div style="flex:1;"></div>'
    +'<div style="display:flex;align-items:center;gap:6px;">';
  for(var pi=1;pi<=3;pi++){
    var ds=pi<G.recruitPhase?'done':pi===G.recruitPhase?'active':'future';
    var db=ds==='done'?'var(--grn)':ds==='active'?'var(--red)':'var(--bdr2)';
    h+='<div style="width:8px;height:8px;border-radius:50%;background:'+db+';"></div>';
  }
  h+='</div></div>';

  // ── Tabs ──
  var tabs=[{id:'board',label:'Board ('+open.length+')'},{id:'targets',label:'Targets ('+G.recruitTargets.length+')'},{id:'commits',label:'Commits ('+commits.length+')'},{id:'roster',label:'Roster'}];
  h+='<div style="display:flex;gap:0;margin-bottom:14px;border-bottom:2px solid var(--bdr);">';
  tabs.forEach(function(tb){
    var on=_tab===tb.id;
    h+='<div onclick="setRecruitTab(\''+tb.id+'\')" style="padding:8px 16px;font-size:12px;font-weight:'+(on?'800':'600')+';color:'+(on?'#fff':'var(--txt3)')+';cursor:pointer;border-bottom:2px solid '+(on?'var(--red)':'transparent')+';margin-bottom:-2px;">'+tb.label+'</div>';
  });
  h+='</div>';

  // ── Tab content ──
  if(_tab==='board') h+=renderBoard(open,left);
  else if(_tab==='targets') h+=renderTargets(left);
  else if(_tab==='commits') h+=renderCommits(commits);
  else if(_tab==='roster') h+=renderRosterNeeds();

  // ── Advance button ──
  h+='<div style="margin-top:16px;text-align:center;">'
    +'<div class="btn btn-red" style="display:inline-block;padding:14px 40px;font-size:13px;font-weight:800;" onclick="'+phase.btnAction+'">'+phase.btnLabel+'</div></div>';

  el.innerHTML=h;
}

// ═══════════════════════════════════════════════════════════
//  TURNOVER SCREEN
// ═══════════════════════════════════════════════════════════

function renderTurnover(){
  var dep=G.departingPlayers||[];
  var t=G.teams[G.tid];
  var returning=t.rost.filter(function(p){
    return!dep.some(function(d){return d.name===p.name;});
  });
  var openSpots=Math.max(0,13-returning.length);
  var lostMins=dep.reduce(function(s,d){return s+(d.mins||0);},0);

  // Position needs
  var posCount={PG:0,SG:0,SF:0,PF:0,C:0};
  returning.forEach(function(p){if(posCount.hasOwnProperty(p.pos))posCount[p.pos]++;});
  var needs=[];
  Object.keys(posCount).forEach(function(pos){if(posCount[pos]<2)needs.push(pos);});

  var h='';

  // Header
  h+='<div style="text-align:center;margin-bottom:20px;">'
    +'<div style="font-size:11px;color:var(--red);font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">OFFSEASON '+G.yr+'</div>'
    +'<div style="font-size:32px;font-weight:900;">Roster Turnover</div>'
    +'<div style="height:2px;width:60px;background:var(--red);margin:14px auto;"></div>'
    +'<div style="font-size:13px;color:var(--txt2);">'+t.name+' \u2014 Review your departures and returning squad before recruiting.</div></div>';

  // Summary cards — bigger
  h+='<div style="display:flex;gap:14px;margin-bottom:20px;">'
    +'<div class="card" style="flex:1;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:900;color:#fc8181;">'+dep.length+'</div><div style="font-size:11px;color:var(--txt3);font-weight:700;margin-top:4px;">DEPARTING</div></div>'
    +'<div class="card" style="flex:1;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:900;color:var(--grn2);">'+returning.length+'</div><div style="font-size:11px;color:var(--txt3);font-weight:700;margin-top:4px;">RETURNING</div></div>'
    +'<div class="card" style="flex:1;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:900;color:var(--gld2);">'+openSpots+'</div><div style="font-size:11px;color:var(--txt3);font-weight:700;margin-top:4px;">OPEN SPOTS</div></div>'
    +'<div class="card" style="flex:1;padding:20px;text-align:center;"><div style="font-size:32px;font-weight:900;">'+lostMins+'</div><div style="font-size:11px;color:var(--txt3);font-weight:700;margin-top:4px;">MINS TO REPLACE</div></div></div>';

  // Position needs bar
  if(needs.length){
    h+='<div style="margin-bottom:16px;padding:10px 14px;background:rgba(229,62,62,.06);border:1px solid rgba(229,62,62,.15);border-radius:6px;font-size:12px;color:#fc8181;font-weight:700;">'
      +'Position needs: '+needs.join(', ')+' \u2014 target these in recruiting</div>';
  }

  // Two-column layout
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

  // LEFT: Departing
  h+='<div class="card" style="padding:16px;">'
    +'<div class="card-title" style="font-size:13px;">Departing Players <span style="color:#fc8181;">'+dep.length+'</span></div>';
  if(dep.length){
    dep.forEach(function(d){
      var reasonCol=d.reason==='Graduated'?'var(--txt3)':'var(--gld2)';
      var gp=1;
      h+='<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.03);">'
        +'<div class="pos-chip" style="margin-right:10px;">'+d.pos+'</div>'
        +'<div style="flex:1;">'
        +'<div style="font-size:13px;font-weight:700;color:#fff;">'+d.name+'</div>'
        +'<div style="font-size:11px;color:var(--txt2);margin-top:2px;">'+d.cls+' \u00b7 '+d.ppg+' PPG \u00b7 '+d.rpg+' RPG \u00b7 '+(d.apg||'0.0')+' APG \u00b7 '+d.mins+' MIN</div>'
        +'</div>'
        +'<div style="text-align:right;">'
        +'<div style="font-family:monospace;font-size:16px;font-weight:900;color:var(--red);">'+d.ovr+'</div>'
        +'<div style="font-size:10px;font-weight:700;color:'+reasonCol+';margin-top:2px;">'+d.reason+'</div>'
        +'</div></div>';
    });
  } else {
    h+='<div style="padding:20px 0;text-align:center;color:var(--txt3);font-size:12px;">No players departing. Full squad returning.</div>';
  }
  h+='</div>';

  // RIGHT: Returning — FULL roster, no truncation
  returning.sort(function(a,b){return b.ovr-a.ovr;});
  h+='<div class="card" style="padding:16px;">'
    +'<div class="card-title" style="font-size:13px;">Returning Roster <span style="color:var(--grn2);">'+returning.length+' players</span></div>';
  returning.forEach(function(p){
    var gp=p.s.gp||0;
    var ppg=gp?(p.s.pts/gp).toFixed(1):'--';
    var rpg=gp?(p.s.reb/gp).toFixed(1):'--';
    var apg=gp?(p.s.ast/gp).toFixed(1):'--';
    var pot=p.pot||p.ovr;
    var potCol=pot>p.ovr+8?'var(--grn2)':pot>p.ovr+3?'var(--gld2)':'var(--txt3)';
    var clsCol=p.cls==='FR'?'var(--grn2)':p.cls==='SO'?'var(--gld2)':p.cls==='JR'?'#63b3ed':'var(--txt3)';
    h+='<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);">'
      +'<div class="pos-chip" style="margin-right:10px;">'+p.pos+'</div>'
      +'<div style="flex:1;">'
      +'<div style="font-size:13px;font-weight:700;color:#fff;">'+p.name+' <span style="font-size:10px;font-weight:800;color:'+clsCol+';">'+p.cls+'</span></div>'
      +'<div style="font-size:11px;color:var(--txt2);margin-top:2px;">'+ppg+' PPG \u00b7 '+rpg+' RPG \u00b7 '+apg+' APG \u00b7 '+p.mins+' MIN</div>'
      +'</div>'
      +'<div style="text-align:right;display:flex;gap:8px;align-items:center;">'
      +'<div style="font-family:monospace;font-size:16px;font-weight:900;color:var(--red);">'+p.ovr+'</div>'
      +'<div style="font-family:monospace;font-size:12px;font-weight:700;color:'+potCol+';">'+pot+'</div>'
      +'</div></div>';
  });
  h+='</div>';

  h+='</div>'; // close grid

  // Proceed button
  h+='<div style="text-align:center;margin-top:20px;">'
    +'<div class="btn btn-red" style="display:inline-block;padding:16px 48px;font-size:15px;font-weight:800;" onclick="proceedToRecruiting()">PROCEED TO RECRUITING \u25b6</div></div>';

  return h;
}

// ═══════════════════════════════════════════════════════════
//  BOARD TAB
// ═══════════════════════════════════════════════════════════

function renderBoard(open,left){
  var h='';
  // Filters
  h+='<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">';
  h+='<select onchange="setRecruitFilter(\'pos\',this.value)" style="background:var(--s2);border:1px solid var(--bdr);border-radius:4px;color:#fff;padding:4px 8px;font-size:11px;">';
  ['All','PG','SG','SF','PF','C'].forEach(function(p){h+='<option value="'+p+'"'+((_filter.pos===p)?' selected':'')+'>'+p+'</option>';});
  h+='</select>';
  h+='<select onchange="setRecruitFilter(\'stars\',parseInt(this.value))" style="background:var(--s2);border:1px solid var(--bdr);border-radius:4px;color:#fff;padding:4px 8px;font-size:11px;">';
  [{v:0,l:'All Stars'},{v:5,l:'5\u2605'},{v:4,l:'4\u2605+'},{v:3,l:'3\u2605+'},{v:2,l:'2\u2605+'}].forEach(function(o){h+='<option value="'+o.v+'"'+((_filter.stars===o.v)?' selected':'')+'>'+o.l+'</option>';});
  h+='</select>';
  h+='<div style="flex:1;"></div>';
  h+='<div style="font-size:10px;color:var(--txt3);">'+open.length+' available</div>';
  h+='</div>';

  // Filter
  var filtered=open.filter(function(r){
    if(_filter.pos!=='All'&&r.pos!==_filter.pos)return false;
    if(_filter.stars>0&&r.stars<_filter.stars)return false;
    return true;
  });

  // Show detail panel if active
  if(_detailId>=0){
    var dr=G.recruits.find(function(x){return x.id===_detailId;});
    if(dr) h+=renderDetailPanel(dr,left);
  }

  // List (max 30)
  filtered.forEach(function(r){
    var stars='';for(var i=0;i<5;i++)stars+=i<r.stars?'\u2605':'\u2606';
    var isTarget=G.recruitTargets.indexOf(r.id)>=0;
    var stName=STATE_NAMES[r.homeState]||r.homeState;
    var userGeo=getGeoLabel(getTeamState(G.teams[G.tid]),r.homeState);
    var geoBadge=userGeo==='HOME'?'<span style="font-size:8px;font-weight:900;color:var(--grn2);background:rgba(56,161,105,.15);padding:1px 5px;border-radius:2px;margin-left:4px;">HOME</span>'
      :userGeo==='REGION'?'<span style="font-size:8px;font-weight:900;color:#63b3ed;background:rgba(49,130,206,.12);padding:1px 5px;border-radius:2px;margin-left:4px;">REGION</span>':'';
    var sp=(G.teams[G.tid]&&G.teams[G.tid].schoolPrestige)||50;
    var gatePrestige=SCHOOL_RECRUIT_GATES[r.stars]||0;
    var gated=sp<gatePrestige;
    var gateBadge=gated?'<span style="font-size:8px;font-weight:900;color:#fc8181;background:rgba(229,62,62,.12);padding:1px 5px;border-radius:2px;margin-left:4px;">LONG SHOT</span>':'';

    h+='<div onclick="showDetail('+r.id+')" style="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.03);cursor:pointer;'+(isTarget?'background:rgba(49,130,206,.06);border-left:3px solid var(--blu);':'')+(r.id===_detailId?'background:rgba(229,62,62,.06);':'')+'transition:background .1s;" onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\''+(isTarget?'rgba(49,130,206,.06)':'')+'\'">'
      +'<div style="width:32px;font-family:monospace;font-size:11px;color:var(--txt3);flex-shrink:0;">#'+r.natRank+'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="display:flex;align-items:center;gap:5px;">'
      +'<span style="font-size:12px;font-weight:700;color:#fff;">'+r.name+'</span>'
      +'<span style="font-size:8px;color:var(--gld2);">'+stars+'</span>'
      +geoBadge+gateBadge
      +'</div>'
      +'<div style="font-size:10px;color:var(--txt3);">'+r.pos+' \u00b7 '+stName+'</div></div>'
      +'<div style="width:36px;text-align:center;font-family:monospace;font-size:13px;font-weight:800;color:var(--red);">'+r.ovr+'</div>'
      +'<div style="width:36px;text-align:center;font-family:monospace;font-size:12px;font-weight:700;color:'+(r.pot>r.ovr+8?'var(--grn2)':r.pot>r.ovr+3?'var(--gld2)':'var(--txt3)')+';">'+(r.pot||r.ovr)+'</div>'
      +'</div>';
  });
  if(!filtered.length) h+='<div style="padding:20px;text-align:center;color:var(--txt3);">No recruits match filters.</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  DETAIL PANEL
// ═══════════════════════════════════════════════════════════

function renderDetailPanel(r,left){
  var stars='';for(var i=0;i<5;i++)stars+=i<r.stars?'\u2605':'\u2606';
  var stName=STATE_NAMES[r.homeState]||r.homeState;
  var isTarget=G.recruitTargets.indexOf(r.id)>=0;
  var schools=getSchoolChances(r);
  var pts=r.points||0;

  var h='<div style="background:var(--s1);border:1px solid var(--bdr);border-radius:8px;padding:16px;margin-bottom:14px;">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'
    +'<div>'
    +'<div style="font-size:16px;font-weight:900;color:#fff;">'+r.name+'</div>'
    +'<div style="font-size:11px;color:var(--gld2);margin-top:2px;">'+stars+' \u00b7 #'+r.natRank+' National \u00b7 #'+r.posRank+' '+r.pos+'</div>'
    +'<div style="font-size:11px;color:var(--txt2);margin-top:2px;">'+r.pos+' \u00b7 OVR '+r.ovr+' \u00b7 POT '+(r.pot||r.ovr)+' \u00b7 '+stName+'</div></div>'
    +'<div onclick="closeDetail()" style="cursor:pointer;color:var(--txt3);font-size:16px;padding:4px 8px;">\u2715</div></div>';

  // Action: add to targets or adjust points
  if(!isTarget){
    h+='<div class="btn btn-red btn-sm" style="margin-bottom:12px;" onclick="event.stopPropagation();addTarget('+r.id+')">+ ADD TO TARGETS</div>';
  } else {
    h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
      +'<span style="font-size:11px;font-weight:700;color:var(--blu);">TARGETED</span>'
      +'<div onclick="event.stopPropagation();adjustPoints('+r.id+',-5)" style="width:28px;height:28px;border-radius:4px;background:'+(pts>=5?'var(--s3)':'var(--s2)')+';border:1px solid var(--bdr);color:'+(pts>=5?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;cursor:pointer;user-select:none;">\u2212</div>'
      +'<div style="font-family:monospace;font-size:16px;font-weight:900;color:'+(pts>0?'var(--red)':'var(--txt3)')+';">'+pts+'</div>'
      +'<div onclick="event.stopPropagation();adjustPoints('+r.id+',5)" style="width:28px;height:28px;border-radius:4px;background:'+(left>=5?'var(--red)':'var(--s2)')+';border:1px solid '+(left>=5?'var(--red)':'var(--bdr)')+';color:'+(left>=5?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;cursor:pointer;user-select:none;">+</div>'
      +'<span style="font-size:10px;color:var(--txt3);margin-left:4px;">pts invested</span>'
      +'<div style="flex:1;"></div>'
      +'<div onclick="event.stopPropagation();removeTarget('+r.id+')" style="font-size:10px;color:#fc8181;cursor:pointer;text-decoration:underline;">Remove</div></div>';
  }

  // Schools competing
  h+='<div style="font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:1px;margin-bottom:6px;">SCHOOLS IN THE RACE</div>';
  if(!schools.length){
    h+='<div style="font-size:11px;color:var(--txt3);font-style:italic;">Add to targets to see competition.</div>';
  } else {
    schools.forEach(function(s){
      var barCol=s.isUser?'var(--red)':'var(--bdr2)';
      var nameCol=s.isUser?'var(--red)':'#fff';
      h+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">'
        +'<div style="width:120px;font-size:11px;font-weight:'+(s.isUser?'800':'600')+';color:'+nameCol+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+s.name+(s.geo?' <span style="font-size:8px;color:'+(s.geo==='HOME'?'var(--grn2)':'#63b3ed')+';">'+s.geo+'</span>':'')+'</div>'
        +'<div style="flex:1;height:6px;background:var(--s2);border-radius:3px;overflow:hidden;">'
        +'<div style="height:100%;width:'+s.pct+'%;background:'+(s.isUser?'var(--red)':'var(--txt3)')+';border-radius:3px;transition:width .2s;"></div></div>'
        +'<div style="width:36px;text-align:right;font-family:monospace;font-size:12px;font-weight:800;color:'+(s.isUser?'var(--red)':'var(--txt2)')+';">'+s.pct+'%</div></div>';
    });
  }
  h+='</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
//  TARGETS TAB
// ═══════════════════════════════════════════════════════════

function renderTargets(left){
  var h='';
  if(!G.recruitTargets.length){
    return '<div style="padding:30px;text-align:center;color:var(--txt3);">No targets yet. Browse the Board and add recruits you want to pursue.</div>';
  }
  G.recruitTargets.forEach(function(rid){
    var r=G.recruits.find(function(x){return x.id===rid;});
    if(!r||r.status!=='open')return;
    var stars='';for(var i=0;i<5;i++)stars+=i<r.stars?'\u2605':'\u2606';
    var pts=r.points||0;
    var schools=getSchoolChances(r);
    var userSchool=schools.find(function(s){return s.isUser;});
    var userPct=userSchool?userSchool.pct:0;
    var leader=schools.length?schools[0]:null;
    var leading=leader&&leader.isUser;

    h+='<div style="padding:12px;margin-bottom:8px;background:var(--s1);border:1px solid var(--bdr);border-radius:6px;'+(leading?'border-left:3px solid var(--grn);':'border-left:3px solid var(--bdr2);')+'">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      +'<div style="font-family:monospace;font-size:10px;color:var(--txt3);">#'+r.natRank+'</div>'
      +'<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">'+r.name+'</div>'
      +'<div style="font-size:10px;color:var(--txt3);">'+stars+' \u00b7 '+r.pos+' \u00b7 OVR '+r.ovr+' \u00b7 '+(STATE_NAMES[r.homeState]||r.homeState)+'</div></div>'
      +'<div style="font-size:18px;font-weight:900;color:'+(leading?'var(--grn2)':'var(--txt2)')+';">'+userPct+'%</div></div>';

    // Point stepper
    h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">'
      +'<div onclick="adjustPoints('+r.id+',-5)" style="width:28px;height:28px;border-radius:4px;background:'+(pts>=5?'var(--s3)':'var(--s2)')+';border:1px solid var(--bdr);color:'+(pts>=5?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:pointer;user-select:none;">\u2212</div>'
      +'<div style="font-family:monospace;font-size:15px;font-weight:800;color:'+(pts>0?'var(--red)':'var(--txt3)')+';">'+pts+' pts</div>'
      +'<div onclick="adjustPoints('+r.id+',5)" style="width:28px;height:28px;border-radius:4px;background:'+(left>=5?'var(--red)':'var(--s2)')+';border:1px solid '+(left>=5?'var(--red)':'var(--bdr)')+';color:'+(left>=5?'#fff':'var(--txt3)')+';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:pointer;user-select:none;">+</div>'
      +'<div style="flex:1;"></div>'
      +'<div onclick="removeTarget('+r.id+')" style="font-size:10px;color:#fc8181;cursor:pointer;">Remove</div></div>';

    // Top 3 schools
    schools.slice(0,3).forEach(function(s){
      h+='<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:10px;">'
        +'<span style="width:90px;color:'+(s.isUser?'var(--red)':'var(--txt2)')+';font-weight:'+(s.isUser?'800':'500')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+s.name+(s.geo?' <span style="font-size:8px;color:'+(s.geo==='HOME'?'var(--grn2)':'#63b3ed')+';">'+s.geo+'</span>':'')+'</span>'
        +'<div style="flex:1;height:4px;background:var(--s2);border-radius:2px;overflow:hidden;">'
        +'<div style="height:100%;width:'+s.pct+'%;background:'+(s.isUser?'var(--red)':'var(--txt3)')+';border-radius:2px;"></div></div>'
        +'<span style="font-family:monospace;font-weight:700;color:'+(s.isUser?'var(--red)':'var(--txt3)')+';">'+s.pct+'%</span></div>';
    });
    h+='</div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  COMMITS TAB
// ═══════════════════════════════════════════════════════════

function renderCommits(commits){
  if(!commits.length) return '<div style="padding:30px;text-align:center;color:var(--txt3);">No commits yet. Target recruits and advance phases.</div>';
  var avgOvr=Math.round(commits.reduce(function(s,r){return s+r.ovr;},0)/commits.length);
  var h='<div style="margin-bottom:12px;font-size:12px;color:var(--txt2);">'+commits.length+' commit'+(commits.length>1?'s':'')+' \u00b7 Avg OVR '+avgOvr+'</div>';
  commits.forEach(function(r){
    var stars='';for(var i=0;i<5;i++)stars+=i<r.stars?'\u2605':'\u2606';
    h+='<div style="display:flex;align-items:center;padding:10px;margin-bottom:6px;background:var(--s1);border:1px solid var(--bdr);border-radius:6px;border-left:3px solid var(--grn);">'
      +'<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">'+r.name+'</div>'
      +'<div style="font-size:10px;color:var(--gld2);">'+stars+' \u00b7 '+r.pos+' \u00b7 '+(STATE_NAMES[r.homeState]||r.homeState)+'</div></div>'
      +'<div style="text-align:right;"><div style="font-family:monospace;font-size:16px;font-weight:900;color:var(--grn2);">'+r.ovr+'</div>'
      +'<div style="font-size:10px;color:var(--txt3);">POT '+(r.pot||r.ovr)+'</div></div></div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  ROSTER TAB
// ═══════════════════════════════════════════════════════════

function renderRosterNeeds(){
  var t=G.teams[G.tid];
  var posNeeds={PG:0,SG:0,SF:0,PF:0,C:0};
  t.rost.forEach(function(p){if(posNeeds.hasOwnProperty(p.pos))posNeeds[p.pos]++;});
  var h='<div style="margin-bottom:12px;font-size:12px;color:var(--txt2);">Current roster: '+t.rost.length+' players</div>';

  // Position breakdown
  h+='<div style="display:flex;gap:8px;margin-bottom:14px;">';
  Object.keys(posNeeds).forEach(function(pos){
    var ct=posNeeds[pos];
    var need=ct<2;
    h+='<div style="flex:1;padding:10px;text-align:center;background:var(--s1);border:1px solid '+(need?'rgba(229,62,62,.3)':'var(--bdr)')+';border-radius:6px;">'
      +'<div style="font-size:20px;font-weight:900;color:'+(need?'#fc8181':'#fff')+';">'+ct+'</div>'
      +'<div style="font-size:10px;color:var(--txt3);">'+pos+'</div>'
      +(need?'<div style="font-size:8px;color:#fc8181;font-weight:700;margin-top:2px;">NEED</div>':'')+'</div>';
  });
  h+='</div>';

  // Player list
  t.rost.sort(function(a,b){return b.ovr-a.ovr;});
  t.rost.forEach(function(p){
    var gp=p.s.gp||0;var ppg=gp?(p.s.pts/gp).toFixed(1):'--';
    h+='<div style="display:flex;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.02);">'
      +'<div class="pos-chip" style="margin-right:8px;">'+p.pos+'</div>'
      +'<div style="flex:1;font-size:11px;font-weight:600;color:#fff;">'+p.name+' <span style="font-size:9px;color:var(--txt3);">'+p.cls+'</span></div>'
      +'<div style="font-size:10px;color:var(--txt2);margin-right:8px;">'+ppg+' PPG</div>'
      +'<div style="font-family:monospace;font-size:12px;font-weight:700;color:var(--red);">'+p.ovr+'</div></div>';
  });
  return h;
}

// ═══════════════════════════════════════════════════════════
//  LEGACY EXPORTS
// ═══════════════════════════════════════════════════════════
export function resolvePitchWeek(id){adjustPoints(id,5);return{userBoost:5,rivals:[],signed:-1};}
export function pitchRecruit(id){adjustPoints(id,5);}
