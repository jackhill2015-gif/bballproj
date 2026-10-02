const REPO='/home/hatch/workspace/bballproj';
const _store={};
globalThis.localStorage={getItem:k=>_store[k]??null,setItem:(k,v)=>{_store[k]=String(v);},removeItem:k=>{delete _store[k];}};
const se=()=>({textContent:'',innerHTML:'',value:'',onclick:null,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},removeChild(){},querySelector(){return null;},querySelectorAll(){return[];},setAttribute(){},getAttribute(){return null;},addEventListener(){},remove(){}});
globalThis.document={getElementById:()=>se(),createElement:()=>se(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:se()};
globalThis.window={};
const S=await import(REPO+'/season.js'),T=await import(REPO+'/tournament.js'),ST=await import(REPO+'/state.js');
const {G}=ST;
S.registerSeasonCallbacks({addLog(){},updateAll(){},navTo(){},startConfTourney(){T.startConfTourney();},playTournamentGame(w){T.playTournamentGame(w);},openModal(){}});
T.registerTournamentCallbacks({toast(){},addLog(){},updateAll(){},navTo(){},openModal(){},endSeason(){S.endSeason();},renderBracket(){}});
// simulate loadAndPlay(): buildUniverse + loadState, NO G.prestige set (as in views/setup.js loadAndPlay)
S.buildUniverse();
Object.assign(G,{tid:0,yr:2025,gi:30,phase:'conf_tourn',difficulty:'normal',bracket:[],confTourneys:{},
 coach:{firstName:'T',lastName:'C',age:40,off:70,def:70,dev:70,rec:70,xp:0,level:1,careerWins:0,careerLoss:0,tenure:0,hotSeat:false,titles:0,confTitles:0,finalFours:0,tourneyApps:0,awards:[],history:[]},
 injuries:[],buffs:[],nextHomeBonus:0,momentum:{tid:-1,pts:0}});
console.log('G.prestige after load-path init:', G.prestige);
T.startConfTourney();
// rig user's conference: user team wins every game it appears in
const conf=G.teams[G.tid].conf; let guard=0;
while(!G.confTourneys[conf].done && guard++<20){
  const ct=G.confTourneys[conf], round=ct.rounds[ct.rounds.length-1];
  round.forEach(m=>{ if(m.winner) return;
    m.winner=(m.t1.id===G.tid||m.t2.id===G.tid)?G.teams[G.tid]:m.t1; m.s1=70; m.s2=60; });
  T.simConfRound(conf);
}
console.log('conf champ:', G.confTourneys[conf].champ && G.confTourneys[conf].champ.name);
console.log('G.prestige after winning conf tourney:', G.prestige, '| isNaN:', Number.isNaN(G.prestige));
// ui.js:124 star rendering consequence
let stars=''; for(let i=0;i<5;i++) stars += i < G.prestige ? '★' : '☆';
console.log('rendered prestige stars:', stars);
process.exit(0);
