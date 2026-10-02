const REPO='/home/hatch/workspace/bballproj';
const _store={};
globalThis.localStorage={getItem:k=>_store[k]??null,setItem:(k,v)=>{_store[k]=String(v);},removeItem:k=>{delete _store[k];}};
const se=()=>({textContent:'',innerHTML:'',value:'',onclick:null,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},removeChild(){},querySelector(){return null;},querySelectorAll(){return[];},setAttribute(){},getAttribute(){return null;},addEventListener(){},remove(){}});
globalThis.document={getElementById:()=>se(),createElement:()=>se(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:se()};
globalThis.window={};
const S=await import(REPO+'/season.js'),T=await import(REPO+'/tournament.js'),ST=await import(REPO+'/state.js');
const {G,LS,SetupState}=ST;
S.registerSeasonCallbacks({addLog(){},updateAll(){},navTo(){},startConfTourney(){T.startConfTourney();},playTournamentGame(w){T.playTournamentGame(w);},openModal(){}});
T.registerTournamentCallbacks({toast(){},addLog(){},updateAll(){},navTo(){},openModal(){},endSeason(){S.endSeason();},renderBracket(){}});
S.buildUniverse();
Object.assign(G,{tid:0,yr:2025,gi:0,wk:0,phase:'reg',difficulty:'normal',bracket:[],confTourneys:{},prestige:3,
 coach:{firstName:'T',lastName:'C',age:40,off:70,def:70,dev:70,rec:70,xp:0,level:1,careerWins:0,careerLoss:0,tenure:0,hotSeat:false,titles:0,confTitles:0,finalFours:0,tourneyApps:0,awards:[],history:[]},
 injuries:[],buffs:[],nextHomeBonus:0,momentum:{tid:-1,pts:0}});
ST.resetLS(); S.buildSchedules();
const t=G.teams[0],pool=G.teams.filter(x=>x.id!==0&&x.conf!==t.conf);
for(let i=pool.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[pool[i],pool[k]]=[pool[k],pool[i]];}
SetupState.NC_PICKS=pool.slice(0,10).map(x=>x.id);
S.setupUserOOC(); S.genRecruits();
const userOpps=[]; for(let w=0;w<30;w++){const s=G.teams[0].sched[w]; if(s) userOpps.push({w,oid:s.opp,conf:s.conf});}
let guard=0;
while(G.phase==='reg'&&G.gi<30){ if(++guard>500) break;
 const g=G.teams[0].sched[G.gi];
 if(!g||g.played){S.simCPUWeek();S.advanceWeek();} else S.launchSim(false); }
for(const {w,oid,conf} of userOpps){ const tm=G.teams[oid]; let played=0; for(const s of tm.sched) if(s&&s.played) played++;
 const d=(tm.wins+tm.loss)-played;
 console.log(`${tm.name} w${w} conf=${conf} diff=${d} (${tm.wins}-${tm.loss} vs ${played})`);
}
process.exit(0);
