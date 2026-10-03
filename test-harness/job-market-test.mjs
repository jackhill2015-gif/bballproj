// Coaching carousel: the job list is fixed for the offseason (saved), a
// rejection marks the job instead of reshuffling, and a fired coach turned
// down everywhere still gets an offer.
import { G, S, ST, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
// modal stubs: overlay.querySelector('#job-ok') must return a clickable stub
const mk = () => { const e = { style: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, addEventListener(t, f) { e._f = f; }, querySelector() { return mk(); }, appendChild() {}, removeChild() {} }; return e; };
document.createElement = mk; document.body = mk();
newDynasty(3); runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason();
G.offseasonStep = 'carousel';
R.renderOffseason(); const ids1 = (window._carouselJobs || []).map(j => j.team.id);
R.renderOffseason(); const ids2 = (window._carouselJobs || []).map(j => j.team.id);
check(ids1.length > 0 && JSON.stringify(ids1) === JSON.stringify(ids2), 'job list identical across re-renders (' + ids1.length + ' jobs)');
const rnd = Math.random; Math.random = () => 0.999; // force a rejection
R.applyForJob(ids1[0]); Math.random = rnd;
R.renderOffseason(); const ids3 = (window._carouselJobs || []).map(j => j.team.id);
check(JSON.stringify(ids1) === JSON.stringify(ids3), 'rejection keeps the same list');
check(G.jobMarket.rejected.indexOf(ids1[0]) >= 0, 'rejected job is marked');
ST.saveStateNow(); S.buildUniverse(); ST.loadState();
check(G.jobMarket && JSON.stringify(G.jobMarket.jobs.map(j => j.tid)) === JSON.stringify(ids1), 'job market survives save/load');
// fired coach rejected everywhere → guaranteed fallback offer
G.coach.history.push({ yr: G.yr, school: 'X', action: 'Fired' });
G.jobMarket.rejected = ids1.slice();
R.renderOffseason(); const jobs = window._carouselJobs || [];
check(jobs.some(j => j.guaranteed) && R.calcOfferChance(jobs.find(j => j.guaranteed)) === 100, 'fired coach gets a guaranteed offer');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
