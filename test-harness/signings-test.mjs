// Signings are explicit: every player who joins (or leaves) your program in
// the portal or recruiting is in the log, the signing day screen shows the
// class before the season starts, and Home recaps it afterwards.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const R = await import('../views/recruiting.js');
const P = await import('../views/portal.js');
const SG = await import('../views/signings.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
S.buildUniverse(); newDynasty(80); U.fixMins(G.teams[G.tid].rost);
runRegSeason(); runConfTourneys(); runNCAA(); S.beginOffseason(); R.finishSkillPoints(); R.stayAtSchool(); R.proceedToRecruiting();
if (G.offseasonStep === 'retention') { G.pts = 9999; G.retention.asks.forEach((a, i) => { a.decision = i === 0 ? 'go' : 'keep'; }); R.finishRetention(); }
check(G.offseasonStep === 'portal', 'portal open');
// trim roster so we can sign people, then offer on 25 players
const t = G.teams[G.tid]; t.rost = t.rost.slice(0, 9); G.pts = 5000;
P.portalBoard().filter(e => e.fromTid !== G.tid).slice(0, 25).forEach((e, i) => { for (let k = 0; k < (i < 10 ? 25 : 6); k++) P.adjustOffer(e.pid, 10); });
P.advancePortalStage();
check(G.signings && G.signings.report && /initial offers/.test(G.signings.report.title), 'round 1 report exists: ' + (G.signings.report || {}).title);
P.advancePortalStage(); P.advancePortalStage(); // decision day → recruiting
check(G.offseasonStep === 'recruiting', 'portal closed, on to recruiting');
check(/decision day/.test(G.signings.report.title), 'decision day report shown on the recruiting screen');
const portalIn = G.signings.log.filter(x => x.kind === 'portal' && x.outcome === 'you').map(x => x.name).sort();
const rosterIn = t.rost.filter(p => p.portalYr === G.yr).map(p => p.name).sort();
check(JSON.stringify(portalIn) === JSON.stringify(rosterIn), `every transfer on your roster is logged as signed with you (${rosterIn.length})`);
const pursuedOut = G.signings.log.filter(x => x.kind === 'portal' && (x.outcome === 'other' || x.outcome === 'stayed' || x.outcome === 'full'));
check(portalIn.length + pursuedOut.length === 25, `all 25 players you offered have an outcome (${portalIn.length} signed, ${pursuedOut.length} elsewhere)`);
check(pursuedOut.filter(x => x.outcome === 'other').every(x => x.school), 'players who chose elsewhere name the school');
const letGo = G.retention.asks[0].name;
check(G.signings.log.some(x => x.name === letGo && (x.outcome === 'left' || x.outcome === 'returns')), 'your let-go player shows as transferred out or came back');
// recruiting: target and spend on 12 recruits
G.recruitingBudget = 500; G.recruitingSpent = 0;
G.recruits.slice(20, 32).forEach(r => { R.addTarget(r.id); R.adjustPoints(r.id, 20); });
R.advanceRecruitPhase(); R.advanceRecruitPhase();
R.finishSigningDay();
check(G.offseasonStep === 'signed', 'signing day screen before the season starts');
const recIn = G.recruits.filter(r => r.signed === G.tid).map(r => r.name).sort();
const recLog = G.signings.log.filter(x => x.kind === 'recruit' && x.outcome === 'you').map(x => x.name).sort();
check(JSON.stringify(recIn) === JSON.stringify(recLog), `every signed recruit is logged (${recIn.length})`);
const recOther = G.signings.log.filter(x => x.kind === 'recruit' && x.outcome === 'other');
check(recIn.length + recOther.length === 12, `all 12 targeted recruits have an outcome (${recIn.length} signed, ${recOther.length} elsewhere)`);
const html = SG.signingDayHTML();
check(recIn.every(n => html.includes(n)) && html.includes('data-to-schedule'), 'signing day screen lists the class and leads to the schedule');
ST.saveStateNow(); const before = JSON.stringify(G.signings); ST.loadState();
check(JSON.stringify(G.signings) === before, 'signing log survives a save and reload');
// non-conference schedule step: 10 picks, swap one, and they become next season's games
R.toSchedule();
check(G.offseasonStep === 'schedule' && G.ncPicks.length === 10, 'schedule step offers 10 non-conference opponents');
check(G.ncPicks.every(id => G.teams[id].conf !== G.teams[G.tid].conf && id !== G.tid), 'all picks are outside your conference');
const swapIn = G.teams.find(t => t.conf !== G.teams[G.tid].conf && t.id !== G.tid && !G.ncPicks.includes(t.id));
G.ncPicks[3] = swapIn.id;
const chosen = G.ncPicks.slice().sort((a, b) => a - b);
const yr = G.yr; S.doOffseason();
const ooc = G.teams[G.tid].sched.filter(g => g && !g.conf).map(g => g.opp).sort((a, b) => a - b);
check(JSON.stringify(ooc) === JSON.stringify(chosen), 'next season\'s non-conference games are exactly your picks (incl. the swap)');
check(G.yr === yr + 1 && G.phase === 'reg', 'season starts after signing day');
const made = recIn.filter(n => G.teams[G.tid].rost.some(p => p.name === n));
check(made.length === recIn.length || G.teams[G.tid].rost.length === 15, `signed recruits join the new roster (${made.length} of ${recIn.length}; cut only when the roster is full)`);
const moves = SG.offseasonMovesHTML();
check(moves.includes('Offseason moves') && made.every(n => moves.includes(n)), 'Home shows offseason moves in the new season');
console.log(fails ? fails + ' FAILED' : 'all signings checks passed');
process.exit(fails ? 1 : 0);
