// v10 save: whole league survives Continue (save → fresh buildUniverse → load)
import { REPO } from './shim.mjs';
const S = await import(REPO + '/season.js');
const ST = await import(REPO + '/state.js');
const { G } = ST;
S.buildUniverse(); G.tid = 7; G.yr = 2027;
G.coach = { firstName:'T', lastName:'C', history:[], awards:[] };
S.buildSchedules();
// give some CPU players stats so nested packing is exercised
G.teams[100].rost[0].s.pts = 321; G.teams[100].rost[0].s.gp = 20;
G.teams[100].sched[0].played = true; G.teams[100].sched[0].uScore = 71; G.teams[100].sched[0].oScore = 64;
const snap = JSON.stringify(G.teams.map(t => ({ r: t.rost, strat: t.strat, sc: t.sched })));
ST.saveStateNow();
const raw = localStorage.getItem('hoops_os_v3');
console.log('save size KB', Math.round(raw.length / 1024));
S.buildUniverse();                     // what Continue does before loadState()
const changed = JSON.stringify(G.teams.map(t => ({ r: t.rost, strat: t.strat, sc: t.sched }))) !== snap;
console.log('fresh universe differs (expected):', changed);
ST.loadState();
const ok = JSON.stringify(G.teams.map(t => ({ r: t.rost, strat: t.strat, sc: t.sched }))) === snap;
console.log(ok ? 'PASS league restored exactly' : 'FAIL league differs after load');
process.exit(ok ? 0 : 1);
