// School ratings use the real-results blend (research/program-strength):
// new dynasties take prestige from it; saves keep the prestige they stored.
import { G, S, ST, C, newDynasty } from './season-lib.mjs';
import { readFileSync } from 'node:fs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const blend = {};
JSON.parse(readFileSync(new URL('../research/program-strength/program-strength.json', import.meta.url), 'utf8')).forEach(e => { blend[e.n] = e.o_blend; });
newDynasty(0);
const off = G.teams.filter(t => blend[t.name] !== undefined && t.baseOvr !== blend[t.name]);
check(off.length === 0, `every school's base rating is its blend value (${off.length} differ)`);
const pr = n => G.teams.find(t => t.name === n).schoolPrestige;
check(pr('Gonzaga') === C.calcSchoolPrestige(92) && pr('UConn') === C.calcSchoolPrestige(90), `new dynasty prestige follows the blend (Gonzaga ${pr('Gonzaga')}, UConn ${pr('UConn')})`);
// An existing save: prestige as stored (here: the pre-blend values) survives load
const old = { Gonzaga: C.calcSchoolPrestige(90), UConn: C.calcSchoolPrestige(93), "Saint Mary's": C.calcSchoolPrestige(81) };
Object.keys(old).forEach(n => { G.teams.find(t => t.name === n).schoolPrestige = old[n]; });
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
check(Object.keys(old).every(n => pr(n) === old[n]), `a save keeps its stored prestige (${Object.keys(old).map(n => n + ' ' + pr(n)).join(', ')})`);
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
