// Diagnostic: categorize standings mismatches after one regular season
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const _store = {};
globalThis.localStorage = { getItem:k=>_store[k]??null, setItem:(k,v)=>{_store[k]=String(v);}, removeItem:k=>{delete _store[k];} };
const se=()=>({textContent:'',innerHTML:'',value:'',onclick:null,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},removeChild(){},querySelector(){return null;},querySelectorAll(){return[];},setAttribute(){},getAttribute(){return null;},addEventListener(){},remove(){}});
globalThis.document={getElementById:()=>se(),createElement:()=>se(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:se()};
globalThis.window={};
const S=await import(REPO+'/season.js'), T=await import(REPO+'/tournament.js'),
      ST=await import(REPO+'/state.js'), U=await import(REPO+'/utils.js'), C=await import(REPO+'/constants.js');
const {G,LS,SetupState}=ST;
S.registerSeasonCallbacks({addLog(){},updateAll(){},navTo(){},startConfTourney(){T.startConfTourney();},playTournamentGame(w){T.playTournamentGame(w);},openModal(){}});
T.registerTournamentCallbacks({toast(){},addLog(){},updateAll(){},navTo(){},openModal(){},endSeason(){S.endSeason();},renderBracket(){}});

S.buildUniverse();
Object.assign(G,{tid:0,yr:2025,gi:0,wk:0,phase:'reg',difficulty:'normal',bracket:[],confTourneys:{},prestige:3,
  coach:{firstName:'T',lastName:'C',age:40,off:70,def:70,dev:70,rec:70,xp:0,level:1,careerWins:0,careerLoss:0,tenure:0,hotSeat:false,titles:0,confTitles:0,finalFours:0,tourneyApps:0,awards:[],history:[]},
  injuries:[],buffs:[],nextHomeBonus:0,momentum:{tid:-1,pts:0}});
ST.resetLS();
S.buildSchedules();
const t=G.teams[0], pool=G.teams.filter(x=>x.id!==0&&x.conf!==t.conf);
for(let i=pool.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[pool[i],pool[k]]=[pool[k],pool[i]];}
SetupState.NC_PICKS=pool.slice(0,10).map(x=>x.id);
S.setupUserOOC(); S.genRecruits();

// check for double-booked weeks right after buildSchedules (before any sim)
let dbl=0; const dblExamples=[];
for(const tm of G.teams){ for(let w=0;w<30;w++){ const s=tm.sched[w]; if(!s) continue;
  const opp=G.teams[s.opp]; const back=opp.sched[w];
  if(!back || back.opp!==tm.id){ dbl++; if(dblExamples.length<5) dblExamples.push(`${tm.name} w${w} vs ${opp.name}, opp side: ${back?('vs '+G.teams[back.opp].name+' played='+back.played):'null'}`); }
}}
console.log('one-sided schedule entries after build:', dbl);
dblExamples.forEach(e=>console.log('  ex:',e));

// user opponents set
const userOpps=new Set(); for(let w=0;w<30;w++){const s=G.teams[0].sched[w]; if(s) userOpps.add(s.opp);}

let guard=0;
while(G.phase==='reg'&&G.gi<30){ if(++guard>500) break;
  const g=G.teams[0].sched[G.gi];
  if(!g||g.played){S.simCPUWeek();S.advanceWeek();} else S.launchSim(false);
}
// categorize mismatches
let plus=0, minus=0, userOppBad=0, otherBad=0;
for(const tm of G.teams){ let played=0; for(const s of tm.sched) if(s&&s.played) played++;
  const d=(tm.wins+tm.loss)-played;
  if(d!==0){ if(d>0)plus++; else minus++;
    if(userOpps.has(tm.id)) userOppBad++; else otherBad++;
    if(Math.abs(d)>1) console.log(`  BIG: ${tm.name} diff=${d} (${tm.wins}-${tm.loss} vs ${played} played)`);
  }
}
console.log(`mismatched: +extra results=${plus}, -missing results=${minus}; user-opponents bad=${userOppBad}/30, others bad=${otherBad}`);
// how many user-opponent entries got marked played on opponent side?
let oppMarked=0; for(const oid of userOpps){ for(let w=0;w<30;w++){const s=G.teams[oid].sched[w]; if(s&&s.played&&s.opp===0) oppMarked++; } }
console.log('opponent-side entries vs user marked played:', oppMarked, '(expect 30 if recordResult mirrored)');
process.exit(0);
