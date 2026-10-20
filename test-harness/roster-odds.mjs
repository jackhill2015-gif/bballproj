// Roster building odds: high school recruiting vs the transfer portal, for a
// small, a mid and a power program. Plays one season, opens the offseason
// (departures, retention by the auto-coach rule, portal and recruit pool) and
// prices every player on both boards by the real signing-day rule.
//
//  even share   the budget split evenly over your open spots (recruiting
//               points for high school, NIL for the portal)
//  band         players at your rotation level: OVR between the 8th and 3rd
//               best on next season's roster
//  favored      the offer that gives a 50% signing-day chance
//  success      your signing-day chance at the even share, averaged over the
//               band (the "fair odds" number)
//  per OVR pt   cost to be favored / OVR, as % of the budget (x100)
//  best at even the average OVR of the best players (one per open spot) you
//               are favored for at the even share
//
// Usage: node test-harness/roster-odds.mjs [runs=3]
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { REPO } from './shim.mjs';
const R = await import(REPO + '/views/recruiting.js');
const P = await import(REPO + '/views/portal.js');
const SC = await import(REPO + '/views/scouting.js');
const SG = await import(REPO + '/views/signings.js');
globalThis.window._genRecruits = S.genRecruits;
R.registerRecruitingCallbacks({ toast() {}, addLog() {}, updateAll() {} });

const RUNS = +(process.argv[2] || 3);
const TIERS = [['small', 300], ['mid', 150], ['power', 8]]; // rank by school prestige
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// Smallest offer (in steps) that reaches 50%; Infinity past cap
function favoredAt(chance, step, cap) {
  if (chance(cap) < 0.5) return Infinity;
  let lo = 0, hi = cap;
  while (hi - lo > step) { const m = Math.round((lo + hi) / 2 / step) * step; if (m <= lo || m >= hi) break; if (chance(m) >= 0.5) hi = m; else lo = m; }
  return hi;
}

function measureBoard(list, chance, budget, spots, step, band) {
  const share = budget / Math.max(1, spots);
  const rows = list.map(x => {
    const fav = favoredAt(chance.bind(null, x), step, budget * 3);
    return { ovr: x.ovr, pot: x.pot || x.ovr, fav, even: chance(x, share), two: chance(x, Math.min(budget, 2 * share)) };
  });
  const inBand = rows.filter(r => r.ovr >= band[0] && r.ovr <= band[1]);
  const reach = rows.filter(r => r.fav <= share).sort((a, b) => b.ovr - a.ovr).slice(0, spots);
  // Top targets: the best players (one per open spot) you can be favored
  // for with up to two shares, the way Within reach picks them
  const top = rows.filter(r => r.fav <= Math.min(budget, 2 * share)).sort((a, b) => b.ovr - a.ovr).slice(0, spots);
  return {
    n: inBand.length,
    success: mean(inBand.map(r => r.even)),
    favPct: median(inBand.map(r => Math.min(r.fav, budget * 3) / budget * 100)),
    perOvr: median(inBand.map(r => Math.min(r.fav, budget * 3) / r.ovr / budget * 100 * 100)),
    reachable: inBand.filter(r => r.fav <= share).length / Math.max(1, inBand.length),
    bestEven: mean(reach.map(r => r.ovr)), bestEvenPot: mean(reach.map(r => r.pot)),
    topOvr: mean(top.map(r => r.ovr)), topPot: mean(top.map(r => r.pot)), topEven: mean(top.map(r => r.even)),
    topTwo: mean(top.map(r => r.two)), topFav: mean(top.map(r => r.fav / share * 100)),
    topPerOvr: mean(top.map(r => r.fav / r.ovr / budget * 100 * 100)),
    bandOvr: mean(inBand.map(r => r.ovr)), bandPot: mean(inBand.map(r => r.pot)),
  };
}

function oneTier(rankWanted) {
  newDynasty(0);
  const byPrestige = G.teams.slice().sort((a, b) => (b.schoolPrestige || 0) - (a.schoolPrestige || 0));
  const team = byPrestige[rankWanted - 1];
  newDynasty(team.id);
  U.fixMins(G.teams[G.tid].rost);
  runRegSeason(); runConfTourneys(); runNCAA();
  S.beginOffseason();
  R.stayAtSchool();
  if (G.offseasonStep === 'retention') {
    (G.retention ? G.retention.asks : []).forEach(a => { a.decision = a.ask <= (G.pts || 0) * 0.3 ? 'keep' : 'go'; });
    R.finishRetention();
  }
  G.recruitPhase = 1; G.recruitingBudget = ST.calcRecruitingBudget(); G.recruitingSpent = 0;
  G.recruits.forEach(r => { if (typeof r.points !== 'number') r.points = 0; });
  const spots = SG.openSpots();
  const nxt = SC.nextSeasonRoster().map(x => x.ovr).sort((a, b) => b - a);
  const band = [nxt[Math.min(7, nxt.length - 1)] || 0, nxt[2] || 99];
  const rankOf = {};
  G.teams.slice().sort((a, b) => b.pts - a.pts).forEach((t, i) => { rankOf[t.id] = i + 1; });
  const hs = measureBoard(G.recruits.filter(r => r.status === 'open'),
    (r, pts) => R.recruitChanceAt(r, pts, rankOf), G.recruitingBudget, spots, 5, band);
  const pt = measureBoard(P.portalBoard().filter(e => e.fromTid !== G.tid && e.pickedBy === -1),
    (e, nil) => P.portalChanceAt(e, nil), G.pts || 0, spots, P.PORTAL_OFFER_STEP, band);
  return { prestige: G.teams[G.tid].schoolPrestige, spots, band, budget: G.recruitingBudget, nil: G.pts || 0, hs, pt };
}

const f = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '-';
const pc = v => Number.isFinite(v) ? Math.round(v * 100) + '%' : '-';
const out = {};
for (const [name, rk] of TIERS) {
  out[name] = [];
  for (let i = 0; i < RUNS; i++) out[name].push(oneTier(rk));
}
console.log('Roster building odds, ' + RUNS + ' run(s) per tier (means over runs)');
console.log('Band = players at your rotation level. Top = best you can be favored for with up to 2 shares (one per open spot).');
console.log('tier   prest spots  band   budget  NIL | board   band: n  success fav%bud per-OVR | top: OVR/POT   at even  at 2x  fav (% of share) per-OVR');
for (const [name] of TIERS) {
  const rs = out[name], m = k => mean(rs.map(k));
  for (const b of ['hs', 'pt']) {
    const g = k => mean(rs.map(r => r[b][k]).filter(Number.isFinite));
    console.log(`${name.padEnd(6)} ${f(m(r => r.prestige), 0).padStart(4)}  ${f(m(r => r.spots)).padStart(4)}  ${f(m(r => r.band[0]), 0)}-${f(m(r => r.band[1]), 0)}  ${f(m(r => r.budget), 0).padStart(5)} ${f(m(r => r.nil), 0).padStart(4)} | ${b === 'hs' ? 'HS    ' : 'portal'} ${f(g('n'), 0).padStart(5)}    ${pc(g('success')).padStart(4)}   ${f(g('favPct'), 0).padStart(4)}%  ${f(g('perOvr'), 2).padStart(5)} |  ${f(g('topOvr'))}/${f(g('topPot'))}    ${pc(g('topEven')).padStart(4)}   ${pc(g('topTwo')).padStart(4)}     ${f(g('topFav'), 0).padStart(4)}%        ${f(g('topPerOvr'), 2)}`);
  }
}
console.log('SUMMARY ' + TIERS.map(([n]) => n + ' HS ' + pc(mean(out[n].map(r => r.hs.success))) + '/' + pc(mean(out[n].map(r => r.hs.topEven))) + ' portal ' + pc(mean(out[n].map(r => r.pt.success))) + '/' + pc(mean(out[n].map(r => r.pt.topEven)))).join(' · ') + ' (band/top success at even share)');
