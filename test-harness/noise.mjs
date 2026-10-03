// Pure game noise: replay the same matchups many times; sd of margin around each matchup's mean.
import { G, S, SIM, U } from './season-lib.mjs';
S.buildUniverse(); G.tid = -1; G.coach = null; G.momentum = { tid: -1, pts: 0 }; G.nextHomeBonus = 0;
const pairs = []; for (let i = 0; i < 40; i++) pairs.push([G.teams[(i * 53) % 365], G.teams[(i * 97 + 11) % 365]]);
let ss = 0, n = 0, hw = 0, hm = 0, tot = 0, games = 0;
const posPts = {};
for (const [h, a] of pairs) {
  const ms = [];
  for (let k = 0; k < 60; k++) { const r = SIM.simGame(h, a, false); ms.push(r.homeScore - r.awayScore); tot += r.homeScore + r.awayScore; games++; }
  const mu = ms.reduce((x, y) => x + y) / ms.length; ms.forEach(m => { ss += (m - mu) ** 2; n++; });
}
// HCA: same pair both ways
let diff = 0, dn = 0;
for (const [h, a] of pairs) for (let k = 0; k < 30; k++) { const r1 = SIM.simGame(h, a, false), r2 = SIM.simGame(a, h, false); diff += ((r1.homeScore - r1.awayScore) + (r2.homeScore - r2.awayScore)) / 2; dn++; }
for (const t of G.teams) for (const p of t.rost) posPts[p.pos] = (posPts[p.pos] || 0) + p.s.pts;
const pt = Object.values(posPts).reduce((a, b) => a + b);
console.log(`noise sd ${Math.sqrt(ss / n).toFixed(2)}  HCA ${(diff / dn).toFixed(2)}  avg total ${(tot / games).toFixed(1)}  pos share`, Object.fromEntries(Object.entries(posPts).map(([k, v]) => [k, (v / pt * 100).toFixed(1)])));
