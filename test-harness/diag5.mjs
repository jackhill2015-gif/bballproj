import { REPO } from './shim.mjs';
const _store={};
globalThis.localStorage={getItem:k=>_store[k]??null,setItem:(k,v)=>{_store[k]=String(v);},removeItem:k=>{delete _store[k];}};
const se=()=>({textContent:'',innerHTML:'',value:'',onclick:null,style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},removeChild(){},querySelector(){return null;},querySelectorAll(){return[];},setAttribute(){},getAttribute(){return null;},addEventListener(){},remove(){}});
globalThis.document={getElementById:()=>se(),createElement:()=>se(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},body:se()};
globalThis.window={};
const S=await import(REPO+'/season.js'),ST=await import(REPO+'/state.js');
const {G,SetupState}=ST;
S.registerSeasonCallbacks({addLog(){},updateAll(){},navTo(){},startConfTourney(){},playTournamentGame(){},openModal(){}});
S.buildUniverse(); G.tid=0; ST.resetLS(); S.buildSchedules();
// hand-build the legitimate mutual state that setupUserOOC's "shared free week" path produces
G.teams[0].sched[0]={opp:10,home:true,conf:false,played:false,uScore:0,oScore:0};
G.teams[10].sched[0]={opp:0,home:false,conf:false,played:false,uScore:0,oScore:0};
console.log('before: mutual Duke<->'+G.teams[10].name);
S.swapOOC(0, 20);
console.log('after swapOOC(0,20):');
console.log('  user slot0 ->', G.teams[G.teams[0].sched[0].opp].name);
console.log('  old opp ('+G.teams[10].name+') sched[0].opp =', G.teams[10].sched[0].opp, '-> still vs Duke: DANGLING (simCPUWeek skips entries vs user team, so this game can never be played or recorded)');
// now simulate that week to show the old opponent's game just vanishes
G.gi=0; S.simCPUWeek();
console.log('  old opp sched[0].played =', G.teams[10].sched[0].played, '| record:', G.teams[10].wins+'-'+G.teams[10].loss);
process.exit(0);
