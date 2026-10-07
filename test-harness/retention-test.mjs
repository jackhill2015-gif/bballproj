// Player retention: top returners ask for NIL before the portal opens.
// Keep = paid, never enters the portal this year. Let go = always enters.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const FI = await import('../finance.js');
const R = await import('../views/recruiting.js');
const RT = await import('../views/retention.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

function toTurnover() {
  U.fixMins(G.teams[G.tid].rost); // a normal rotation, like a real coach sets
  runRegSeason(); runConfTourneys(); runNCAA();
  S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool();
}

console.log('── retention step ──');
S.buildUniverse();
const tid = G.teams.findIndex(t => (t.schoolPrestige || 50) >= 45 && (t.schoolPrestige || 50) < 60);
newDynasty(tid);
toTurnover();
check(G.offseasonStep === 'retention', 'staying goes straight to departures');
R.proceedToRecruiting();
check(G.offseasonStep === 'retention', 'proceedToRecruiting stops at retention');
const asks = G.retention.asks;
check(asks.length >= 2 && asks.length <= 4, '2-4 players ask (' + asks.length + ')');
check(asks.every(a => a.ask >= 25 && a.ask <= 200 && a.ask % 5 === 0), 'asks are 25-200 NIL in steps of 5 (' + asks.map(a => a.ask).join(', ') + ')');
const roster = G.teams[G.tid].rost;
check(asks.every(a => { const p = roster.find(x => x.name === a.name); return p && p.cls !== 'SR' && !p.rs; }), 'only returning, non-redshirt players ask');
const best = roster.filter(p => p.cls !== 'SR' && !p.rs && p.notReturningYr !== G.yr).sort((a, b) => b.ovr - a.ovr)[0]; // not-interested players don't ask
check(asks.some(a => a.name === best.name), 'best returner (who wants to stay) always asks');
check(R.moveOnWarning(() => {}) === true && R.moveOnWarning(() => {}) === false, 'undecided requests get a heads-up first, then you can move on');

G.pts = 0;
check(!RT.decideRetention(0, 'keep').ok, 'keeping without enough NIL is refused');
G.pts = 1000;
const spend0 = FI.ledger().spend.retention || 0;
check(RT.decideRetention(0, 'keep').ok && G.pts === 1000 - asks[0].ask, 'keep charges the ask');
check(FI.ledger().spend.retention === spend0 + asks[0].ask, 'retention spend logged in the ledger');
RT.decideRetention(0, 'go');
check(G.pts === 1000 && FI.ledger().spend.retention === spend0, 'switching to let go refunds the deal');
RT.decideRetention(0, 'keep');
// Decided rows show the decision and a quiet Change, not live Keep / Let go
const row0 = () => RT.renderRetention().split('class="ret-row').filter(x => x.indexOf('data-ri="0"') >= 0)[0] || '';
check(/Staying/.test(row0()) && !/data-ret="keep"/.test(row0()) && !/data-ret="go"/.test(row0()) && /data-ret="undo"/.test(row0()), 'kept row: "Staying" + Change, no live Keep / Let go');
check(RT.decideRetention(0, 'undo').ok && !asks[0].decision && G.pts === 1000, 'Change undoes the decision and refunds the deal');
check(/data-ret="keep"/.test(row0()) && /data-ret="go"/.test(row0()), 'undecided row shows Keep and Let go again');
RT.decideRetention(0, 'go');
check(/Entering the portal/.test(row0()) && !/data-ret="keep"/.test(row0()), 'let-go row: "Entering the portal" + Change');
RT.decideRetention(0, 'undo'); RT.decideRetention(0, 'keep');
for (let i = 1; i < asks.length; i++) RT.decideRetention(i, 'go');

// survives a save round trip
ST.saveStateNow(); const saved = JSON.stringify(G.retention);
ST.loadState && ST.loadState();
check(JSON.stringify(G.retention) === saved, 'retention decisions persist in the save');

check(R.finishRetention() === true && G.offseasonStep === 'portal', 'all decided → portal opens');
const keptName = asks[0].name;
const mine = G.portalEntrants.filter(e => e.fromTid === G.tid);
check(!mine.some(e => e.name === keptName), 'kept player is not in the portal');
const goNames = asks.slice(1).map(a => a.name);
check(goNames.every(n => mine.some(e => e.name === n && e.reason === 'NIL deal')), 'every let-go player entered the portal (' + goNames.length + ')');
check(!roster.some(p => p.forcePortal), 'portal flags cleared after use');

console.log('── affordability by tier (asks vs season income) ──');
for (const [label, lo, hi] of [['small', 0, 35], ['mid', 45, 60], ['power', 80, 101]]) {
  S.buildUniverse();
  const t = G.teams.findIndex(x => (x.schoolPrestige || 50) >= lo && (x.schoolPrestige || 50) < hi);
  newDynasty(t); G.pts = 0;
  toTurnover(); R.proceedToRecruiting();
  const tot = (G.retention.asks || []).reduce((s, a) => s + a.ask, 0);
  const inc = FI.totals().income;
  console.log('  ' + label.padEnd(6) + ' asks ' + String(tot).padStart(4) + ' / income ' + inc + '  (' + G.retention.asks.map(a => a.ovr + ':' + a.ask).join(' ') + ')');
  check(tot <= Math.max(inc * 0.75, G.retention.asks.length * 25), label + ': keeping everyone costs at most 75% of a season of income (' + Math.round(tot / inc * 100) + '%)');
}

// Moving on with requests undecided lets those players go
console.log('── undecided = let go ──');
S.buildUniverse(); newDynasty(tid); toTurnover(); R.proceedToRecruiting();
const und = G.retention.asks.map(a => a.name);
R.finishRetention();
check(G.offseasonStep === 'portal' && G.retention.asks.every(a => a.decision === 'go'), 'undecided requests become let go');
check(und.every(n => G.portalEntrants.some(e => e.fromTid === G.tid && e.name === n)), 'and those players enter the portal');
const mineIn = G.portalEntrants.filter(e => e.fromTid === G.tid);
check(mineIn.every(e => e.forced), 'none of your players enter the portal by surprise (only let-go or not-interested)');

console.log(fails ? fails + ' FAILED' : 'all retention checks passed');
process.exit(fails ? 1 : 0);
