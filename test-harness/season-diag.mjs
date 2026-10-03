// Season calibration report: home court, margins, scoring by position,
// rankings vs team strength, NCAA seeding sanity, awards.
import { G, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const N = +(process.argv[2] || 2);
const agg = { games: 0, homeW: 0, margins: [], pos: {}, aaPos: {}, leaders: [], badSeeds: [], seedRank: [], corrs: [] };
for (let run = 0; run < N; run++) {
  newDynasty(run * 37 % 365);
  const ovr = new Map(G.teams.map(t => [t.id, U.getTOvr(t)]));
  runRegSeason();
  // regular season games from schedules (home side only, avoids double count)
  for (const t of G.teams) for (const s of t.sched) if (s && s.played && s.home) {
    agg.games++; if (s.uScore > s.oScore) agg.homeW++; agg.margins.push(s.uScore - s.oScore);
  }
  // ranking quality: rank correlation of ranking metric vs roster strength
  const byPts = G.teams.slice().sort((a, b) => b.pts - a.pts);
  const top25 = byPts.slice(0, 25);
  agg.corrs.push(top25.reduce((s, t) => s + ovr.get(t.id), 0) / 25);
  runConfTourneys(); runNCAA();
  // seeding sanity: seed vs strength rank among the field
  const field = G.bracket.slice().sort((a, b) => ovr.get(b.team.id) - ovr.get(a.team.id));
  field.forEach((b, i) => { agg.seedRank.push([b.seed, Math.floor(i / 4) + 1]);
    if ((b.seed <= 2 && i >= 32) || (b.seed >= 13 && i < 12)) agg.badSeeds.push(`#${b.seed} ${b.team.name} (ovr ${ovr.get(b.team.id)}, ${b.team.wins}-${b.team.loss}, strength rank ${i + 1}/64)`); });
  // scoring by position (all players)
  for (const t of G.teams) for (const p of t.rost) { agg.pos[p.pos] = (agg.pos[p.pos] || 0) + p.s.pts; }
  const ps = []; for (const t of G.teams) for (const p of t.rost) if (p.s.gp >= 10) ps.push({ p, t, ppg: p.s.pts / p.s.gp, rpg: p.s.reb / p.s.gp, apg: p.s.ast / p.s.gp });
  ps.sort((a, b) => b.ppg - a.ppg);
  agg.leaders.push(ps.slice(0, 20).map(x => x.p.pos).join(' '));
  agg.topPpg = (agg.topPpg || []).concat([ps[0].ppg]);
  agg.top20 = (agg.top20 || 0) + ps.filter(x => x.ppg >= 20).length;
}
const m = agg.margins, mean = m.reduce((a, b) => a + b, 0) / m.length;
const sd = Math.sqrt(m.reduce((a, b) => a + (b - mean) ** 2, 0) / m.length);
const mam = m.reduce((a, b) => a + Math.abs(b), 0) / m.length;
const tot = Object.values(agg.pos).reduce((a, b) => a + b, 0);
console.log(`seasons=${N} reg games=${agg.games}`);
console.log(`home win% ${(agg.homeW / agg.games * 100).toFixed(1)}  (target 62–72)`);
console.log(`mean home margin ${mean.toFixed(2)}  (target ~+3)`);
console.log(`margin sd ${sd.toFixed(2)} (target 9.5–12.5)  mean |margin| ${mam.toFixed(2)} (target 10–14)`);
console.log('pts share by pos', Object.fromEntries(Object.entries(agg.pos).map(([k, v]) => [k, (v / tot * 100).toFixed(1) + '%'])));
console.log('top-20 scorers by pos per season:'); agg.leaders.forEach(l => console.log('  ' + l));
console.log('scoring leader ppg', agg.topPpg.map(x => x.toFixed(1)).join(', '), ' 20+ppg/season', (agg.top20 / N).toFixed(1));
console.log('avg roster ovr of ranked top 25 (end of reg season):', agg.corrs.map(x => x.toFixed(1)).join(', '));
console.log(`badly mis-seeded teams (${agg.badSeeds.length}):`); agg.badSeeds.slice(0, 12).forEach(s => console.log('  ' + s));
