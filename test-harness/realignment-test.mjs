// 2026-27 realignment: new dynasties use the new conferences and 2027
// tournament formats; saves from before keep 2025-26. Teams that aren't
// NCAA-eligible yet never take a bid.
import { G, S, ST, T, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const C = await import('../constants.js');
const F = await import('../confformats.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
const confOf = n => (G.teams.find(t => t.name === n) || {}).conf;
const sizes = () => { const by = {}; G.teams.forEach(t => { by[t.conf] = (by[t.conf] || 0) + 1; }); return by; };

// New dynasty: 2026-27 alignment
newDynasty(5);
const by = sizes();
const want = { 'Pac-12': 9, MW: 10, WCC: 10, 'Big West': 12, UAC: 9, 'Big Sky': 11, ASUN: 8, OVC: 9, SoCon: 11, CUSA: 10, 'Sun Belt': 14, MAC: 12, Horizon: 12, Summit: 8, NEC: 9, Metro: 13, 'Big Ten': 18, SEC: 16 };
check(Object.keys(want).every(c => by[c] === want[c]), 'conference sizes match 2026-27 (' + Object.keys(want).filter(c => by[c] !== want[c]).map(c => c + ' ' + by[c]).join(', ') + ')');
check(!by.WAC && !by.MAAC, 'WAC is now the UAC and the MAAC is the Metro');
check(confOf('Gonzaga') === 'Pac-12' && confOf('Texas St') === 'Pac-12' && confOf('Hawaii') === 'MW' && confOf('Denver') === 'WCC' && confOf('N Illinois') === 'Horizon' && confOf('Little Rock') === 'UAC' && confOf('Tennessee Tech') === 'SoCon', 'sample moves');
check(!G.teams.some(t => t.name === 'St Francis PA') && confOf('West Florida') === 'ASUN' && G.teams.length === 365, 'St Francis PA leaves D1, West Florida joins (365 teams, ids unchanged)');
check(Object.keys(by).every(c => [F.CONF_FORMATS[c], F.CONF_FORMATS_2026[c]].some(x => x && x.size === by[c])), 'every conference has a listed 2027 format');
check(F.formatFor('Pac-12', 9).enter.length === 4 && F.formatFor('MW', 10).enter[0].join() === '7,10', 'Pac-12 and MW 2027 brackets');

// Old save (no align field): keeps 2025-26 on load
ST.saveStateNow();
const raw = JSON.parse(localStorage.getItem('hoops_os_v3'));
check(raw.align === 2026, 'new saves record their alignment');
delete raw.align; delete raw.alignYr0;
localStorage.setItem('hoops_os_v3', JSON.stringify(raw));
S.buildUniverse(); ST.loadState();
check(G.align === 2025 && confOf('Gonzaga') === 'WCC' && confOf('St Francis PA') === 'NEC' && sizes()['Pac-12'] === 2 && sizes().WAC === 7, 'a save from before keeps the 2025-26 alignment');
const homeSum = (await import('../views/setup.js')).slotSummary(raw);
check(homeSum && homeSum.team === C.ALL_TEAMS[raw.tid].n, 'home card names the team from the save\'s alignment');

// Full season on the new alignment, with an ineligible team made to win the NEC
newDynasty(40);
const merc = G.teams.find(t => t.name === 'Mercyhurst');
check(merc.conf === 'NEC' && !T.isEligible(merc) && T.isEligible(G.teams.find(t => t.name === 'Le Moyne')), 'Mercyhurst not eligible in 2026-27, Le Moyne is');
const rig = (t, v) => t.rost.forEach(p => { ['sht', 'fin', 'def', 'reb', 'ply'].forEach(a => { p[a] = v; }); p.ovr = U.getOvr(p); });
G.teams.filter(t => t.conf === 'NEC').forEach(t => rig(t, t === merc ? 99 : 38)); // the rest of the NEC can't win
runRegSeason(); runConfTourneys();
const nec = G.confTourneys.NEC;
check(nec && nec.done && nec.champ && nec.champ.name === 'Mercyhurst', 'Mercyhurst wins the NEC (rigged)');
check(nec.bid && nec.bid.name !== 'Mercyhurst' && T.isEligible(nec.bid), 'the automatic bid goes to an eligible team (' + (nec.bid && nec.bid.name) + ')');
// every conference tournament played its real format
const fmtOk = Object.keys(G.confTourneys).every(c => { const ct = G.confTourneys[c]; return ct.done && ct.champ && ct.rounds.length === F.roundsIn(F.formatFor(c, sizes()[c])); });
check(fmtOk, 'every conference tournament played its 2027 format to a champion');
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
check(G.confTourneys.NEC.bid && G.confTourneys.NEC.bid.name === nec.bid.name, 'the automatic bid survives save and load');
const field = G.bracket.filter(b => b.pending === undefined).map(b => b.team).concat(((G.ncaaOpening && G.ncaaOpening.games) || []).flatMap(g => [g.t1, g.t2]));
check(field.length === 76, 'NCAA field of 76 (' + field.length + ')');
check(field.every(t => T.isEligible(t)) && !field.some(t => t.name === 'Mercyhurst'), 'no ineligible team in the NCAA field');
runNCAA();
// No reclassification: the 2026-27 status holds in later seasons too
S.beginOffseason(); S.doOffseason();
check(G.yr === 2027 && ['Mercyhurst', 'West Georgia', 'New Haven', 'West Florida'].every(n => !T.isEligible(G.teams.find(t => t.name === n))), 'ineligible schools stay ineligible the next season (2026-27 status)');
// New dynasties start in 2026, and the home card counts seasons from the dynasty's first year
ST.saveStateNow();
const sum2 = (await import('../views/setup.js')).slotSummary(localStorage.getItem('hoops_os_v3'));
check(sum2.yr === 2027 && sum2.season === 2, 'second season of a 2026 dynasty shows as season 2 (' + sum2.yr + ', season ' + sum2.season + ')');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
