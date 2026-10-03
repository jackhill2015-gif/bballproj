// Fit margin = a + b*(homeOvr - awayOvr) on regular-season games; report residual sd
import { G, U, newDynasty, runRegSeason } from './season-lib.mjs';
newDynasty(0);
const ovr = new Map(G.teams.map(t => [t.id, U.getTOvr(t)]));
runRegSeason();
const xs = [], ys = [];
for (const t of G.teams) for (const s of t.sched) if (s && s.played && s.home) { xs.push(ovr.get(t.id) - ovr.get(s.opp)); ys.push(s.uScore - s.oScore); }
const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
const b = sxy / sxx, a = my - b * mx;
const res = ys.map((y, i) => y - a - b * xs[i]);
const rsd = Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n);
const xsd = Math.sqrt(sxx / n);
const homeW = ys.filter(y => y > 0).length / n;
console.log(`games ${n}  HCA(intercept) ${a.toFixed(2)}  pts per ovr ${b.toFixed(2)}  residual sd ${rsd.toFixed(2)}  ovr-diff sd ${xsd.toFixed(2)}  home win ${(homeW*100).toFixed(1)}%`);
const tov = G.teams.map(t => ovr.get(t.id)).sort((a, b) => a - b);
console.log('team ovr min/median/max', tov[0], tov[tov.length >> 1], tov[tov.length - 1]);
