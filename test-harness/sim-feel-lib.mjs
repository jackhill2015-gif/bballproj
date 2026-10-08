// Sim realism: how game results feel (talent holding up, tournament upsets,
// star scorers, overtime, home court, offensive boards, scheme effects).
// Shared by sim-feel.mjs (full) and sim-feel-test.mjs (fast, in run-all).
// Real numbers and sources: research/sim-feel.md.
import { G, S, SIM, U, newDynasty, runRegSeason, runConfTourneys } from './season-lib.mjs';

// Real targets (see research/sim-feel.md)
export const REAL = {
  // neutral-floor win % of the better team by team-overall gap
  winCurve: { 3: 60, 6: 75, 9: 85, 12: 93 },
  // lower seed's first-round win %, NCAA.com seed records 1985-2025
  upsets: { '1v16': 1.2, '2v15': 6.9, '3v14': 14.4, '4v13': 20.6, '5v12': 35.6, '6v11': 38.8, '7v10': 39.0, '8v9': 51.9 },
};

const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const fresh = t => t.rost.forEach(p => { p.s = U.freshS(); });

// One season of the real game (365 teams, real schedule), then a set of
// neutral-floor experiments on the same teams.
export function measure({ seasons = 2, curveGames = 1200, r64Reps = 60, schemeGames = 300 } = {}) {
  if (process.env.SIMTUNE) Object.assign(SIM.TUNE, JSON.parse(process.env.SIMTUNE));
  const out = { games: 0, margins: [], homeW: 0, homeG: 0, ot: 0, ot2: 0,
    share: [], leader: [], n20: [], oreb: 0, reb: 0, ts: { a: [], b: [], c: [], d: [] }, pos: {},
    curve: { 3: [0, 0], 6: [0, 0], 9: [0, 0], 12: [0, 0] }, curveMargins: [], byGap: { 3: [], 6: [], 9: [], 12: [] },
    upsets: {}, schemes: {}, starTs: { hi: [0, 0], mid: [0, 0] } };
  for (let si = 0; si < seasons; si++) {
    newDynasty(Math.floor(Math.random() * 300));
    runRegSeason();
    // regular-season games, each once
    G.teams.forEach(t => t.sched.forEach(s => {
      if (!s || !s.played || s.opp === undefined || s.opp === null || !s.home || typeof s.uScore !== 'number') return;
      out.games++; out.margins.push(s.uScore - s.oScore);
      out.homeG++; if (s.uScore > s.oScore) out.homeW++;
      if (s.ot) { out.ot++; if (s.ot >= 2) out.ot2++; }
    }));
    // players
    let lead = 0, n20 = 0; const bests = [];
    G.teams.forEach(t => {
      let tp = 0, best = 0;
      t.rost.forEach(p => {
        tp += p.s.pts; if (p.s.pts > best) best = p.s.pts;
        out.oreb += p.s.oreb || 0; out.reb += p.s.reb || 0;
        if (p.s.gp < 15) return;
        const ppg = p.s.pts / p.s.gp; if (ppg > lead) lead = ppg; if (ppg >= 20) n20++;
        const fgaG = p.s.fga / p.s.gp, tsa = p.s.fga + 0.44 * (p.s.fta || 0);
        if (tsa > 0) out.ts[fgaG < 8 ? 'a' : fgaG < 12 ? 'b' : fgaG < 15 ? 'c' : 'd'].push(p.s.pts / (2 * tsa));
        if (p.mins >= 24) {
          const o = out.pos[p.pos] = out.pos[p.pos] || { n: 0, tpaShare: 0, rpg: 0, bpg: 0, apg: 0 };
          o.n++; o.tpaShare += (p.s.tpa || 0) / Math.max(1, p.s.fga); o.rpg += p.s.reb / p.s.gp; o.bpg += (p.s.blk || 0) / p.s.gp; o.apg += p.s.ast / p.s.gp;
        }
      });
      if (tp > 0) out.share.push(best / tp);
      const gpT = Math.max(1, ...t.rost.map(p => p.s.gp)); bests.push(best / gpT);
    });
    out.leader.push(lead); out.n20.push(n20);
    out.bestPpg = (out.bestPpg || []).concat(bests);
    // NCAA field: replay each first-round game on a neutral floor
    runConfTourneys();
    const br = (G.bracket || []).map(b => ({ seed: b.seed, region: b.region, team: typeof b.team === 'number' ? G.teams[b.team] : b.team }));
    G.tid = -999; G.phase = 'ncaa'; SIM.SITE.campus = false;
    for (let r = 0; r < 4; r++) for (let hi = 1; hi <= 8; hi++) {
      const a = br.find(b => b.region === r && b.seed === hi), b = br.find(x => x.region === r && x.seed === 17 - hi);
      if (!a || !b || !a.team || !b.team) continue;
      const k = hi + 'v' + (17 - hi), u = out.upsets[k] = out.upsets[k] || [0, 0];
      for (let n = 0; n < r64Reps; n++) {
        const res = n % 2 ? SIM.simGame(a.team, b.team, false) : SIM.simGame(b.team, a.team, false);
        const loWon = n % 2 ? res.awayScore > res.homeScore : res.homeScore > res.awayScore;
        u[1]++; if (loWon) u[0]++;
      }
    }
    // win curve: random pairs at a given team-overall gap, neutral floor
    const ov = G.teams.map(t => [t, U.getTOvr(t)]);
    for (const gap of [3, 6, 9, 12]) {
      const per = Math.round(curveGames / seasons);
      for (let n = 0, tries = 0; n < per && tries < per * 200; tries++) {
        const [a, oa] = ov[Math.floor(Math.random() * ov.length)];
        const cands = ov.filter(([, o]) => Math.abs(oa - o - gap) <= 0.5);
        if (!cands.length) continue;
        const [b] = cands[Math.floor(Math.random() * cands.length)];
        const stars = [a, b].map(t => t.rost.filter(p => p.mins > 0).sort((x, y) => y.ovr - x.ovr)[0]);
        const pre = stars.map(p => [p.s.pts, p.s.fga, p.s.fta || 0]);
        const res = n % 2 ? SIM.simGame(a, b, false) : SIM.simGame(b, a, false);
        stars.forEach((p, i) => {
          const pts = p.s.pts - pre[i][0], fga = p.s.fga - pre[i][1], fta = (p.s.fta || 0) - pre[i][2], tsa = fga + 0.44 * fta;
          const k = fga >= 16 ? 'hi' : fga >= 9 && fga <= 13 ? 'mid' : null;
          if (k && tsa) { out.starTs[k][0] += pts; out.starTs[k][1] += 2 * tsa; }
        });
        const m = n % 2 ? res.homeScore - res.awayScore : res.awayScore - res.homeScore;
        out.curve[gap][1]++; if (m > 0) out.curve[gap][0]++;
        out.curveMargins.push(m); out.byGap[gap].push(m);
        n++;
      }
    }
    G.teams.forEach(fresh);
  }
  const res = [];
  for (const g of [3, 6, 9, 12]) { const a = out.byGap[g], m = mean(a); a.forEach(v => res.push(v - m)); }
  out.residSd = Math.sqrt(mean(res.map(v => v * v)));
  // schemes: same two rosters, swap one side's scheme, neutral floor
  out.schemes = schemeEffects(schemeGames);
  return out;
}

let uid = 0;
function mkTeam(base, off, def) {
  const POS = ['PG', 'SG', 'SF', 'PF', 'C'], CLS = ['FR', 'SO', 'JR', 'SR'];
  const rost = [];
  for (let j = 0; j < 13; j++) rost.push(SIM.genPlayer(base, POS[j % 5], CLS[j % 4]));
  U.fixMins(rost);
  return { id: 7000 + (uid++), name: 'S' + uid, rost, strat: { off, def } };
}
// Average margin change from switching team A's scheme away from balanced/man,
// over many paired rosters (A and B are rebuilt every 10 games)
function schemeEffects(nGames) {
  G.tid = -999; G.phase = 'ncaa'; SIM.SITE.campus = false;
  const res = {};
  const settings = [['off', 'motion'], ['off', 'drive'], ['off', 'set'], ['off', 'early'], ['def', '2-3'], ['def', '3-2'], ['def', '1-3-1'], ['def', 'box1'], ['def', 'press']];
  for (const [side, val] of settings) {
    let diff = 0, n = 0, A, B;
    for (let g = 0; g < nGames; g++) {
      if (g % 10 === 0) { A = mkTeam(80, 'balanced', 'man'); B = mkTeam(80, 'balanced', 'man'); }
      const base = { off: 'balanced', def: 'man' };
      A.strat = Object.assign({}, base); const r1 = SIM.simGame(A, B, false);
      A.strat = Object.assign({}, base, { [side]: val }); const r2 = SIM.simGame(A, B, false);
      diff += (r2.homeScore - r2.awayScore) - (r1.homeScore - r1.awayScore); n++;
    }
    res[side + ':' + val] = diff / n;
  }
  return res;
}

// rows: [label, value, target text, ok]
export function report(o, loose = 1) {
  const rows = [];
  const add = (label, v, lo, hi, fmt = x => x.toFixed(1)) => {
    const w = (hi - lo) * (loose - 1) / 2;
    rows.push([label, fmt(v), fmt(lo) + '-' + fmt(hi), v >= lo - w && v <= hi + w]);
  };
  for (const g of [3, 6, 9, 12]) {
    const [w, n] = o.curve[g];
    add('Win % at +' + g + ' overall (neutral)', 100 * w / Math.max(1, n), REAL.winCurve[g] - 5, REAL.winCurve[g] + 5);
  }
  // spread of the margin around each gap's average (KenPom-style sigma)
  add('Margin sd around the expected margin', o.residSd, 10.5, 12);
  for (const k of ['1v16', '2v15', '3v14', '4v13', '5v12', '6v11', '7v10', '8v9']) {
    const [w, n] = o.upsets[k] || [0, 0];
    add('Upset % ' + k, 100 * w / Math.max(1, n), Math.max(0, REAL.upsets[k] - 7), REAL.upsets[k] + 7);
  }
  // Brief asked 22-25 / 28-32; with real 2024-25 scoring (third-best scorer
  // 21.8 ppg, so only about 10-15 players at 20+) the shares can't be that
  // high: 20-25 / 24-30 (research/sim-feel.md)
  add('Best player share of team points, median (%)', 100 * pct(o.share, 0.5), 20, 25);
  add('... top 10% of teams (%)', 100 * pct(o.share, 0.9), 24, 30);
  add('Scoring leader (ppg)', mean(o.leader), 22, 26);
  add('Players at 20+ ppg', mean(o.n20), 5, 15);
  const ts = k => mean(o.ts[k]);
  const sts = k => o.starTs[k][0] / Math.max(1, o.starTs[k][1]);
  add('Star TS%: 16+ FGA nights minus 9-13 FGA nights', 100 * (sts('hi') - sts('mid')), -4, -1);
  add('Overtime games (%)', 100 * o.ot / Math.max(1, o.games), 4, 7);
  add('Home win %', 100 * o.homeW / Math.max(1, o.homeG), 64, 68);
  add('Offensive rebound % (of all boards)', 100 * o.oreb / Math.max(1, o.reb), 26, 31);
  const sch = Object.values(o.schemes).map(Math.abs);
  add('Largest scheme effect (pts/game)', Math.max(...sch), 0, 2);
  return rows;
}

export function printReport(o, rows) {
  const w = Math.max(...rows.map(r => r[0].length)) + 2;
  console.log('stat'.padEnd(w) + 'game'.padStart(8) + '   target');
  rows.forEach(r => console.log(r[0].padEnd(w) + String(r[1]).padStart(8) + '   ' + r[2] + (r[3] ? '' : '   <<')));
  console.log('\nTS% by shot volume (FGA/g <8, 8-12, 12-15, 15+): ' + ['a', 'b', 'c', 'd'].map(k => (100 * mean(o.ts[k])).toFixed(1) + ' (n=' + o.ts[k].length + ')').join(', '));
  console.log('Starters by position (3PA share / RPG / BPG / APG):');
  for (const p of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const x = o.pos[p]; if (!x) continue;
    console.log('  ' + p + ': ' + (x.tpaShare / x.n).toFixed(2) + ' / ' + (x.rpg / x.n).toFixed(1) + ' / ' + (x.bpg / x.n).toFixed(1) + ' / ' + (x.apg / x.n).toFixed(1) + '  (n=' + x.n + ')');
  }
  console.log('Scheme effects vs balanced/man (pts/game): ' + Object.entries(o.schemes).map(([k, v]) => k + ' ' + (v >= 0 ? '+' : '') + v.toFixed(1)).join(', '));
  console.log('Team top scorer ppg p50/p90/p97/max: ' + [0.5, 0.9, 0.97, 0.999].map(q => pct(o.bestPpg, q).toFixed(1)).join(' / '));
  console.log('Overtime: ' + o.ot + ' of ' + o.games + ' games, ' + o.ot2 + ' with 2+ OT. Regular season, every game: margin sd ' + sd(o.margins).toFixed(1) + ', mean |margin| ' + mean(o.margins.map(Math.abs)).toFixed(1) + ', home margin ' + mean(o.margins).toFixed(1));
}
