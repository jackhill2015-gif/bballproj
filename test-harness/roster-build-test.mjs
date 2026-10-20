// Build your roster (HANDOFF R1): one odds rule for recruits and transfers,
// portal entrants never come back, open spots are exact, transfers and
// recruits share the open spots, CPU rosters stay 13-15, and old saves
// parked on the separate portal or recruiting step load onto the new screen.
import { G, S, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const P = await import('../views/portal.js');
const B = await import('../views/battle.js');
const BLD = await import('../views/build.js');
const SG = await import('../views/signings.js');
const SC = await import('../views/scouting.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };

console.log('── one odds rule ──');
for (const rule of [B.HS_ODDS, B.PORTAL_ODDS]) {
  check(Math.abs(B.chanceVsBest(rule.even * 100, 100, rule) - 0.5) < 1e-9, 'even odds at ' + rule.even + 'x the best rival');
  check(B.chanceVsBest(200, 100, rule) <= rule.cap && B.chanceVsBest(1, 100, rule) >= rule.floor, 'floor and cap hold');
  check(Math.abs(B.chanceVsBest(B.offerFor(0.8, 100, rule), 100, rule) - 0.8) < 1e-9, 'offerFor inverts the curve');
}
check(B.chanceVsBest(130, 100, B.PORTAL_ODDS) > B.chanceVsBest(130 * 0.7, 100, B.HS_ODDS), 'a clear lead is surer for a transfer than for a recruit');
check(B.PORTAL_ODDS.cap > B.HS_ODDS.cap, 'no recruit is a lock; a transfer can be close to certain');

function toBuild(tid) {
  S.buildUniverse(); newDynasty(tid); U.fixMins(G.teams[G.tid].rost);
  runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool();
  if (G.offseasonStep === 'retention') { G.retention.asks.forEach(a => { a.decision = 'go'; }); R.finishRetention(); }
}
toBuild(120);
check(G.offseasonStep === 'build' && G.recruitPhase === 1 && (G.portalStage || 0) === 0, 'departures open Build your roster, round 1 for both');

console.log('── odds on the screen are the odds that decide ──');
const t = G.teams[G.tid]; G.pts = 3000;
const ent = P.portalBoard().filter(e => e.fromTid !== G.tid && isFinite(P.nilFor50(e))).slice(0, 3);
check(ent.length === 3, 'transfers you can be favored for exist');
ent.forEach(e => {
  const fav = P.nilFor50(e);
  check(P.portalChanceAt(e, fav) >= 0.5 && (fav <= P.PORTAL_OFFER_STEP || P.portalChanceAt(e, fav - P.PORTAL_OFFER_STEP) < 0.5),
    e.name + ': ' + fav + ' NIL to be favored (' + Math.round(P.portalChanceAt(e, fav) * 100) + '%)');
  check(P.portalChanceAt(e, fav + 100) > P.portalChanceAt(e, fav), 'more NIL, better odds');
});
const rec = G.recruits.filter(r => r.status === 'open' && isFinite(R.pointsFor50(r)) && R.pointsFor50(r) > 0).slice(0, 3);
rec.forEach(r => {
  const fav = R.pointsFor50(r);
  check(Math.abs(R.recruitChanceAt(r, fav) - 0.5) < 0.01, r.name + ': ' + Math.round(fav) + ' points to be favored');
});

console.log('── one pursuit per open spot, transfers and recruits together ──');
t.rost = t.rost.slice(0, 11);
const spots = SG.openSpots();
G.recruitingBudget = 500; G.recruitingSpent = 0;
const half = Math.floor(spots / 2);
P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, half).forEach(e => P.adjustOffer(e.pid, 50));
G.recruits.filter(r => r.status === 'open').slice(0, 20).forEach(r => { R.addTarget(r.id); R.adjustPoints(r.id, 10); });
check(SG.pursuitsOut() === spots, `${SG.pursuitsOut()} in the running for ${spots} open spots`);
check(!P.adjustOffer(P.portalBoard().find(e => e.fromTid !== G.tid && !(e.offer > 0)).pid, 10), 'no new offer once every spot has someone');

console.log('── Build your roster screen ──');
R.renderOffseason();
const html = BLD.renderBuild();
check(/Needs: <b>/.test(html) && /High school/.test(html) && /Transfers/.test(html), 'needs line and High school / Transfers tabs');
check(/To be favored/.test(html) && /Fits your budget/.test(html), 'cost to be favored and budget fit shown');
const need = BLD.rosterNeeds();
check(['g', 'w', 'b'].every(k => need[k] >= 0), 'needs by position group: ' + JSON.stringify(need));

console.log('── entrants are gone for good ──');
const mineBefore = P.portalBoard().filter(e => e.fromTid === G.tid).map(e => e.name);
const nextBefore = SC.nextSeasonRoster().length;
R.advanceBuild(); R.advanceBuild();
check(G.recruitPhase === 3 && G.portalStage === 2, 'two rounds closed for both');
R.advanceBuild(); // decision day
check(G.offseasonStep === 'signed' && G.portalStage === 3, 'decision day resolves the portal and the class');
check(!(G.portalEntrants || []).length, 'nobody is left in the portal');
let flags = 0; G.teams.forEach(tm => tm.rost.forEach(p => { if (p._portalPid) flags++; }));
check(flags === 0, 'every entrant left his old roster (no flags left)');
check(mineBefore.every(n => !t.rost.some(p => p.name === n)), `your ${mineBefore.length} entrants are off your roster`);
const joined = G.signings.log.filter(x => x.outcome === 'you').length;
check(SC.nextSeasonRoster().length === nextBefore + joined && SC.nextSeasonRoster().length === 15 - SG.openSpots(), 'open spots were exact: next season = before + signings');
check(!G.signings.log.some(x => x.outcome === 'returns' || x.outcome === 'stayed'), 'nobody comes back or stays home');
S.doOffseason();
const cpu = G.teams.filter(x => x.id !== G.tid).map(x => x.rost.length);
check(Math.min(...cpu) >= 13 && Math.max(...cpu) <= 15, `CPU rosters ${Math.min(...cpu)}-${Math.max(...cpu)}`);
check((G.topUps || 0) <= 5, 'generated top-up freshmen stay rare (' + (G.topUps || 0) + ')');

console.log('── old saves mid-offseason ──');
toBuild(200);
G.offseasonStep = 'portal'; G.portalStage = 1; G.recruitPhase = 0; // the old portal step, round 2
R.renderOffseason();
check(G.offseasonStep === 'build' && G.recruitPhase === 1 && G.portalStage === 1, 'a save on the portal step opens Build your roster');
R.advanceBuild();
check(G.recruitPhase === 2 && G.portalStage === 1, 'the portal waits for recruiting to catch up');
R.advanceBuild();
check(G.recruitPhase === 3 && G.portalStage === 2, 'then both move together');
toBuild(240);
P.advancePortalStage(); P.advancePortalStage(); P.advancePortalStage(); // the old flow closed the portal first
G.offseasonStep = 'recruiting';
R.renderOffseason();
check(G.offseasonStep === 'build' && G.portalStage === 3, 'a save on the recruiting step opens Build your roster with the portal closed');
R.advanceBuild(); R.advanceBuild(); R.advanceBuild();
check(G.offseasonStep === 'signed', 'and reaches decision day');

console.log(fails ? fails + ' FAILED' : 'all roster building checks passed');
process.exit(fails ? 1 : 0);
