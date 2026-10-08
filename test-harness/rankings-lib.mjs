// Shared by rankings-calibration.mjs (full run) and rankings-test.mjs (fast):
// sims seasons on the real modules, watches every poll, and measures the
// same stats research/rankings/scripts/analyze.py measures on real AP polls.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { REPO } from './shim.mjs';
import { readFileSync } from 'node:fs';
const P = await import(REPO + '/poll.js');

export const REAL = JSON.parse(readFileSync(REPO + '/research/rankings/real-stats.json', 'utf8'));
const POWER = new Set(['ACC', 'Big Ten', 'Big 12', 'SEC']);
const HIGH = new Set(['Big East', 'MW', 'A-10', 'WCC', 'American', 'Pac-12']);
const tierOf = t => POWER.has(t.conf) ? 'power' : HIGH.has(t.conf) ? 'high' : 'mid';
const BLUE = ['Duke', 'Kansas', 'Kentucky', 'UNC', 'UCLA', 'Indiana'];
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
function spearman(pairs) {
  const rk = x => { const s = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = []; for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const a = rk(pairs.map(p => p[0])), b = rk(pairs.map(p => p[1])); const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
}

export function simulate(nSeasons, tid = 60, log = () => {}) {
  const st = { drops: {}, dropout: {}, unb: {}, unbTier: {}, churn: [], no1: [0, 0], tier: { power: 0, high: 0, mid: 0 },
    bestMid: [], pre: { hit: [], top5: [], corr: [], abs: [] }, blue: [0, 0], seeds: { top4: [0, 0], gap: [] }, twoL: [] };
  const push = (o, k, v) => { (o[k] = o[k] || []).push(v); };
  let season = null;
  const off = P.onPoll(ev => {
    if (ev.kind === 'pre') {
      season = { pre: ev.ids.slice(), lastReg: null, mids: [] };
      st.blue[1] += BLUE.length;
      BLUE.forEach(n => { const t = G.teams.find(x => x.name === n); if (t && ev.ids.includes(t.id)) st.blue[0]++; });
      ev.ids.forEach(id => { st.tier[tierOf(G.teams[id])]++; });
      return;
    }
    if (!season || ev.kind === 'final') return;
    const before = ev.before, after = ev.ids;
    const rB = {}, rA = {};
    before.forEach((id, i) => rB[id] = i + 1); after.forEach((id, i) => rA[id] = i + 1);
    if (ev.kind === 'reg') {
      st.churn.push(after.filter(id => !rB[id]).length);
      after.forEach(id => { st.tier[tierOf(G.teams[id])]++; if (tierOf(G.teams[id]) === 'mid') season.mids.push(rA[id]); });
      season.lastReg = after.slice();
    }
    st.no1[0]++; if (before[0] !== after[0]) st.no1[1]++;
    before.forEach((id, i) => {
      const r = i + 1, games = ev.res[id] || [];
      if (!games.length) return;
      const nr = rA[id] || 26;
      const band = r <= 5 ? '1-5' : r <= 15 ? '6-15' : '16-25';
      const L = games.filter(g => !g.won), W = games.filter(g => g.won);
      if (L.length === 1 && W.length === 1) {
        const or = rB[L[0].opp] || 0;
        const ob = or && or <= 10 ? 'top10' : or ? '11-25' : 'unranked';
        const d = nr - r;
        push(st.drops, '1L1W all', d); push(st.drops, '1L1W_opp ' + ob, d); push(st.drops, '1L1W_site ' + L[0].site.replace('N', 'N'), d); push(st.drops, '1L1W_band ' + band, d);
        const k = '1L1W ' + band; st.dropout[k] = st.dropout[k] || [0, 0]; st.dropout[k][0]++; if (!rA[id]) st.dropout[k][1]++;
      } else if (L.length === 2 && !W.length) st.twoL.push(nr - r);
      else if (!L.length && W.length) {
        const t = G.teams[id];
        if ((t.loss || 0) === 0) { push(st.unb, band, r - nr); push(st.unbTier, tierOf(t) + ' ' + band, r - nr); }
      }
    });
    if (ev.kind === 'sel') {
      // preseason vs the last regular-season poll (the real data's "final observed" poll)
      const fin = {}; (season.lastReg || after).forEach((id, i) => fin[id] = i + 1);
      season.pre.forEach((id, i) => {
        st.pre.hit.push(fin[id] ? 1 : 0);
        st.pre.abs.push(Math.abs((i + 1) - (fin[id] || 30)));
        if (i < 5) st.pre.top5.push(fin[id] && fin[id] <= 10 ? 1 : 0);
      });
      st.pre.corr.push(spearman(season.pre.map((id, i) => [i + 1, fin[id] || 30])));
      st.bestMid.push(season.mids.length ? Math.min(...season.mids) : null);
      season.sel = after.slice();
    }
  });
  newDynasty(tid);
  for (let s = 0; s < nSeasons; s++) {
    runRegSeason(); runConfTourneys();
    // seeds vs the Selection Sunday poll
    if (season && season.sel && G.bracket && G.bracket.length) {
      const seed = {}; G.bracket.forEach(b => { const id = typeof b.team === 'number' ? b.team : b.team && b.team.id; if (id !== undefined) seed[id] = Math.min(seed[id] || 99, b.seed); });
      (G.ncaaOpening && G.ncaaOpening.games || []).forEach(g => { [g.t1, g.t2].forEach(t => { if (t && seed[t.id] === undefined) seed[t.id] = 99; }); });
      season.sel.forEach((id, i) => {
        if (i < 4) { st.seeds.top4[1]++; if (seed[id] === 1) st.seeds.top4[0]++; }
        if (seed[id] && seed[id] <= 16) st.seeds.gap.push(seed[id] - Math.ceil((i + 1) / 4));
      });
    }
    runNCAA();
    log(s);
    if (s < nSeasons - 1) { S.beginOffseason(); S.doOffseason(); }
  }
  off();
  return st;
}

// Game vs real, with bands. Returns rows [label, game, real, band, ok]
export function compare(st, R = REAL, loose = 1) {
  const rows = [];
  // tracked: printed, but not held to the band. These are the stats the game's
  // parity keeps from matching (its top teams lose ~1 game in 3, real ones ~1
  // in 5): see research/rankings/findings.md.
  const add = (label, g, r, band, tracked) => { const ok = Number.isFinite(g) && Math.abs(g - r) <= band * loose; rows.push([label, +g.toFixed(2), +(+r).toFixed(2), '±' + (band * loose), ok, !!tracked]); };
  const L = R.losses, pct = s => parseFloat(String(s));
  add('Drop after a 1-loss-1-win week (all)', mean(st.drops['1L1W all'] || []), L['1L1W all'].mean, 1.0);
  add('  ... loss to an unranked team', mean(st.drops['1L1W_opp unranked'] || []), L['1L1W_opp unranked'].mean, 1.5);
  add('  ... loss to #11-25', mean(st.drops['1L1W_opp 11-25'] || []), L['1L1W_opp 11-25'].mean, 1.5);
  add('  ... loss to a top-10 team', mean(st.drops['1L1W_opp top10'] || []), L['1L1W_opp top10'].mean, 1.5);
  add('  ... home loss', mean(st.drops['1L1W_site H'] || []), L['1L1W_site H'].mean, 1.5);
  add('  ... road loss', mean(st.drops['1L1W_site A'] || []), L['1L1W_site A'].mean, 1.5);
  add('  ... ranked 1-5', mean(st.drops['1L1W_band 1-5'] || []), L['1L1W_band 1-5'].mean, 1.5, true);
  add('  ... ranked 6-15', mean(st.drops['1L1W_band 6-15'] || []), L['1L1W_band 6-15'].mean, 1.5);
  add('  ... ranked 16-25', mean(st.drops['1L1W_band 16-25'] || []), L['1L1W_band 16-25'].mean, 1.5);
  add('Spread (sd) of that drop', sd(st.drops['1L1W all'] || []), L['1L1W all'].sd, 1.0);
  add('Drop after an 0-2 week', mean(st.twoL), L['2L all'].mean, 2.0);
  const dr = k => { const v = st.dropout[k] || [0, 1]; return 100 * v[1] / Math.max(1, v[0]); };
  add('Out of the poll after 1L-1W, ranked 16-25 (%)', dr('1L1W 16-25'), pct(R.dropout_after_one_loss_pct['1L1W 16-25']), 12);
  add('Out of the poll after 1L-1W, ranked 6-15 (%)', dr('1L1W 6-15'), pct(R.dropout_after_one_loss_pct['1L1W 6-15']), 5);
  const U = R.unbeaten_climb_per_winning_week;
  add('Unbeaten climb per winning week, 1-5', mean(st.unb['1-5'] || []), U['1-5'].mean, 1.0);
  add('Unbeaten climb per winning week, 6-15', mean(st.unb['6-15'] || []), U['6-15'].mean, 1.0, true);
  add('Unbeaten climb per winning week, 16-25', mean(st.unb['16-25'] || []), U['16-25'].mean, 1.5, true);
  add('New teams per poll (churn)', mean(st.churn), R.churn_new_teams_per_week.mean, 1.0);
  add('#1 changes (% of polls)', 100 * st.no1[1] / Math.max(1, st.no1[0]), R.no1_changes.pct_of_weeks, 10);
  add('Preseason Top 25 still ranked at the end (%)', 100 * mean(st.pre.hit), R.preseason.preseason_top25_finish_ranked_pct, 10);
  add('Preseason top 5 that finish top 10 (%)', 100 * mean(st.pre.top5), R.preseason.preseason_top5_finish_top10_pct, 15, true);
  add('Preseason-to-final rank correlation', mean(st.pre.corr), mean(R.preseason.spearman_pre_vs_final_by_season), 0.15, true);
  add('Avg rank change preseason to final', mean(st.pre.abs), R.preseason.abs_rank_change_pre_to_final.mean, 2.0, true);
  const tot = st.tier.power + st.tier.high + st.tier.mid;
  add('Top 25 spots: power conferences (%)', 100 * st.tier.power / tot, R.top25_share_by_tier_pct.power, 10);
  add('Top 25 spots: mid-majors (%)', 100 * st.tier.mid / tot, R.top25_share_by_tier_pct.mid, 4);
  // bluebloods in the preseason poll (real: Duke, Kansas, Kentucky, North Carolina, UCLA, Indiana)
  const bl = Object.values(R.preseason.blueblood_starts_ranked).map(v => v.split(' of ').map(Number));
  add('Bluebloods in the preseason poll (%)', 100 * st.blue[0] / Math.max(1, st.blue[1]), 100 * bl.reduce((a, b) => a + b[0], 0) / bl.reduce((a, b) => a + b[1], 0), 15);
  const rm = Object.values(R.best_midmajor_rank_by_season);
  add('Seasons with a ranked mid-major (%)', 100 * st.bestMid.filter(x => x).length / Math.max(1, st.bestMid.length), 100 * rm.filter(x => x).length / rm.length, 30, true);
  const gm = st.bestMid.filter(x => x), rmm = rm.filter(x => x);
  if (gm.length) add('Best mid-major rank in a season (avg)', mean(gm), mean(rmm), 5, true);
  const realTop4 = String(R.final_poll_vs_seeds.final_top4_that_are_1_seeds).split(' of ').map(Number);
  add('Final top 4 that get 1 seeds (%)', 100 * st.seeds.top4[0] / Math.max(1, st.seeds.top4[1]), 100 * realTop4[0] / realTop4[1], 20);
  add('Seed line minus poll line (avg)', mean(st.seeds.gap), R.final_poll_vs_seeds.seed_minus_expected_line.mean, 1.0);
  return rows;
}

export function printTable(rows) {
  const w = Math.max(...rows.map(r => r[0].length));
  console.log('stat'.padEnd(w) + '    game    real   band');
  rows.forEach(r => console.log(r[0].padEnd(w) + String(r[1]).padStart(8) + String(r[2]).padStart(8) + String(r[3]).padStart(7) + (r[4] ? '' : r[5] ? '   (tracked gap)' : '   <<')));
}
