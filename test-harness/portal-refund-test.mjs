// Every NIL unit offered in the portal is accounted for: it's either still
// escrowed, spent on a player who signed with you, or refunded in full
// when he picks another school or stays home.
import { G, S, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const P = await import('../views/portal.js');
const FI = await import('../finance.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

let checkedEarlyLoss = false;
for (let run = 0; run < 4; run++) {
  S.buildUniverse(); newDynasty(40 + run * 30);
  U.fixMins(G.teams[G.tid].rost);
  runRegSeason(); runConfTourneys(); runNCAA();
  S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool(); R.proceedToRecruiting();
  if (G.offseasonStep === 'retention') { G.retention.asks.forEach(a => { a.decision = 'go'; }); R.finishRetention(); }
  // trim roster so offers are allowed, then offer 10 on many entrants
  const t = G.teams[G.tid]; t.rost = t.rost.slice(0, 9);
  const START = 5000; G.pts = START;
  const spend0 = FI.ledger().spend.portal || 0;
  const offered = {};
  P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 40).forEach(e => { if (P.adjustOffer(e.pid, 10)) offered[e.name] = true; });
  const nOffered = Object.keys(offered).length;
  const signed = () => (G.teams[G.tid].rost.filter(p => p.portalYr === G.yr)).length;
  const inv = () => G.pts + FI.committed() + 10 * signed();
  check(inv() === START, `run ${run}: ${nOffered} offers placed, books balance`);
  for (let st = 0; st < 2; st++) {
    const before = Object.keys(offered).filter(n => G.portalEntrants.some(e => e.name === n)).length;
    P.advancePortalStage();
    const after = Object.keys(offered).filter(n => G.portalEntrants.some(e => e.name === n)).length;
    if (before - after > signed()) checkedEarlyLoss = true; // someone else signed a player you bid on
    check(inv() === START, `run ${run}, round ${st + 1}: books balance (${G.pts} free + ${FI.committed()} escrowed + ${signed()} signed)`);
  }
  if (G.offseasonStep === 'portal') P.advancePortalStage();
  check(G.pts + 10 * signed() === START, `run ${run}: after decision day only signed players cost NIL`);
  check((FI.ledger().spend.portal || 0) - spend0 === 10 * signed(), `run ${run}: ledger portal spend matches signings`);
}
check(!checkedEarlyLoss, 'players you have offered never sign elsewhere before decision day');
console.log(fails ? fails + ' FAILED' : 'all portal refund checks passed');
process.exit(fails ? 1 : 0);
