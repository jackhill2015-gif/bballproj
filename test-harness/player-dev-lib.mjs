// Player development measurements across a multi-season dynasty: league
// overall and minutes by class, the recruit pool against players leaving,
// how every roster spot gets filled, CPU roster sizes, and whether CPU
// programs move. Shared by player-dev.mjs (full report) and
// player-dev-test.mjs (fast, in run-all). Brief: HANDOFF.md "Up next" item 0.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { REPO } from './shim.mjs';
const R = await import(REPO + '/views/recruiting.js');
const P = await import(REPO + '/views/portal.js');
globalThis.window._genRecruits = S.genRecruits; // as main.js wires it

export const CLS = ['FR', 'SO', 'JR', 'SR'];
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ── A simple auto-coach for the user's team (one of 365) ──
function userOffseason() {
  const hst = (G.coach && G.coach.history) || [];
  if (hst.length && hst[hst.length - 1].action === 'Fired') { // take a similar job and carry on
    const ranked = G.teams.filter(t => t.id !== G.tid).sort((a, b) => (b.schoolPrestige || 0) - (a.schoolPrestige || 0));
    const nt = ranked[Math.floor(ranked.length / 2)];
    G.teams[G.tid].coach = { firstName: 'CPU', lastName: 'Coach', age: 50, off: 65, def: 65, dev: 65, rec: 65, tenure: 0 };
    G.tid = nt.id; G.offseasonStep = 'carousel';
    hst.push({ yr: G.yr, school: nt.name, action: 'Hired' });
  }
  R.stayAtSchool(); // departures, recruit class generated
  if (G.offseasonStep === 'retention') {
    (G.retention ? G.retention.asks : []).forEach(a => { a.decision = a.ask <= (G.pts || 0) * 0.3 ? 'keep' : 'go'; });
    R.finishRetention();
  }
  if (G.offseasonStep === 'portal') { P.advancePortalStage(); P.advancePortalStage(); P.advancePortalStage(); }
  // Recruiting: one top target's worth of points on the best players within reach
  G.recruitPhase = 1; G.recruitingBudget = ST.calcRecruitingBudget(); G.recruitingSpent = 0;
  G.recruits.forEach(r => { if (typeof r.points !== 'number') r.points = 0; });
  R.setBoardFilter({ fit: 'reach', near: false, targets: false, pos: 'All', stars: 0, sort: 'rank', dir: 1 });
  const board = R.boardList(G.recruits.filter(r => r.status === 'open'));
  for (const r of board) {
    const left = G.recruitingBudget - G.recruitingSpent;
    const amt = Math.min(left, Math.ceil(R.pointsFor50(r) * 1.15) || 5);
    if (amt < 5) break;
    R.adjustPoints(r.id, amt);
  }
  R.resolveRecruitingClass();
}

// ── One season's snapshot (after the NCAA tournament, before the offseason) ──
function seasonSnap() {
  const byCls = {}, mins = {}, eliteMins = {}, count = {};
  CLS.forEach(c => { byCls[c] = []; mins[c] = 0; eliteMins[c] = 0; count[c] = 0; });
  const ovrs = G.teams.map(t => [t, U.getTOvr(t)]).sort((a, b) => b[1] - a[1]);
  const elite = new Set(ovrs.slice(0, 25).map(x => x[0].id));
  const top5 = [];
  G.teams.forEach(t => {
    t.rost.forEach(p => {
      const c = CLS.includes(p.cls) ? p.cls : 'SR';
      byCls[c].push(p.ovr); count[c]++;
      const m = (p.mins || 0) * (p.s && p.s.gp || 0);
      mins[c] += m; if (elite.has(t.id)) eliteMins[c] += m;
    });
    const s = t.rost.map(p => p.ovr).sort((a, b) => b - a).slice(0, 5);
    top5.push(mean(s));
  });
  const share = o => { const tot = CLS.reduce((s, c) => s + o[c], 0) || 1; const r = {}; CLS.forEach(c => { r[c] = o[c] / tot; }); return r; };
  return {
    ovr: Object.fromEntries(CLS.map(c => [c, mean(byCls[c])])),
    mins: share(mins), eliteMins: share(eliteMins), count,
    top5Median: median(top5),
    team: (() => { const o = ovrs.map(x => x[1]); return { top25: mean(o.slice(0, 25)), med: median(o), p90: o[Math.floor(o.length * 0.9)] }; })(),
    teamOvr: Object.fromEntries(ovrs.map(([t, o]) => [t.id, o])),
  };
}

// ── One offseason: who leaves, how every spot is filled ──
function offseason() {
  const leaving0 = { grads: 0 };
  G.teams.forEach(t => t.rost.forEach(p => { if (p.cls === 'SR' && !p.rs) leaving0.grads++; }));
  const before = new Set(); G.teams.forEach(t => t.rost.forEach(p => before.add(p)));
  S.beginOffseason();
  const drafted = (G.draft && G.draft.picks || []).filter(x => x.cls !== 'SR').length; // seniors counted above
  userOffseason();
  const pool = G.recruits.slice();
  const stars = {}; pool.forEach(r => { stars[r.stars] = (stars[r.stars] || 0) + 1; });
  S.doOffseason();
  const added = { recruits: 0, walkons: 0, transfers: 0, topups: 0, juco: G.jucoAdds || 0 }, topupByTeam = {};
  const arrivals = { 5: [], 4: [], 3: [] };
  G.teams.forEach(t => t.rost.forEach(p => {
    if (before.has(p)) return;
    if (p.stars) { added.recruits++; if (arrivals[p.stars]) arrivals[p.stars].push(p.ovr); }
    else if (p.walkon) added.walkons++;
    else if (p.juco) return;
    else if (p.transfer) added.transfers++;
    else { added.topups++; topupByTeam[t.id] = (topupByTeam[t.id] || 0) + 1; }
  }));
  const cpu = G.teams.filter(t => t.id !== G.tid).map(t => t.rost.length);
  return {
    leaving: leaving0.grads + drafted, grads: leaving0.grads, drafted,
    pool: pool.length, stars, added, topupTeams: Object.keys(topupByTeam).length,
    arrive: { 5: mean(arrivals[5]), 4: mean(arrivals[4]), 3: mean(arrivals[3]) },
    cpuRost: { min: Math.min(...cpu), mean: mean(cpu), max: Math.max(...cpu), in13to15: cpu.filter(n => n >= 13 && n <= 15).length / cpu.length },
  };
}

// seasons: how many seasons to play (each followed by an offseason except the last)
// load: optional function that sets up the league instead of a new dynasty
// (e.g. loading an old save at the start of a season)
export function measure({ seasons = 6, tid = null, load = null } = {}) {
  if (load) load(); else newDynasty(tid === null ? Math.floor(Math.random() * 365) : tid);
  const startRost = G.teams.filter(t => t.id !== G.tid).map(t => t.rost.length);
  const out = { seasons: [], offseasons: [], startRost: mean(startRost) };
  for (let s = 0; s < seasons; s++) {
    U.fixMins(G.teams[G.tid].rost);
    runRegSeason(); runConfTourneys(); runNCAA();
    out.seasons.push(Object.assign({ yr: G.yr }, seasonSnap()));
    if (s < seasons - 1) out.offseasons.push(offseason());
  }
  // Programs moving: team overall rank in the first measured season vs the last
  const first = out.seasons[0].teamOvr, last = out.seasons[out.seasons.length - 1].teamOvr;
  const rank = o => { const ids = Object.keys(o).sort((a, b) => o[b] - o[a]); const m = {}; ids.forEach((id, i) => { m[id] = i + 1; }); return m; };
  const r0 = rank(first), r1 = rank(last);
  const ids = Object.keys(r0);
  out.moved40 = ids.filter(id => Math.abs(r0[id] - r1[id]) >= 40).length;
  out.newTop25 = ids.filter(id => r1[id] <= 25 && r0[id] > 50).length;
  // correlation of team overall with the school's base level, last season
  const xs = ids.map(id => G.teams[id].baseOvr), ys = ids.map(id => last[id]);
  const mx = mean(xs), my = mean(ys);
  const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  out.baseCorr = cov / Math.sqrt(mean(xs.map(x => (x - mx) ** 2)) * mean(ys.map(y => (y - my) ** 2)));
  return out;
}

const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const pc = v => Math.round(v * 100) + '%';
export function printReport(o) {
  console.log('Season  OVR by class (FR SO JR SR)   minutes share FR SO JR SR   FR min elite   players FR SO JR SR   median top-5   team OVR top 25 / median / 90th pct down');
  o.seasons.forEach((s, i) => {
    console.log(`  ${i + 1} ${s.yr}  ${CLS.map(c => f1(s.ovr[c])).join(' ')}      ${CLS.map(c => pc(s.mins[c]).padStart(4)).join(' ')}          ${pc(s.eliteMins.FR).padStart(4)}       ${CLS.map(c => String(s.count[c]).padStart(4)).join(' ')}     ${f1(s.top5Median)}         ${f1(s.team.top25)} / ${s.team.med} / ${s.team.p90}`);
  });
  console.log('\nOffseason  leaving (grads+early draft)  recruit pool (5/4/3/2/1 stars)   joined: recruits walk-ons transfers top-ups (teams) juco   CPU roster min/mean/max, 13-15   arrive 5*/4*/3*');
  o.offseasons.forEach((x, i) => {
    const st = [5, 4, 3, 2, 1].map(k => x.stars[k] || 0).join('/');
    console.log(`  ${i + 1}  ${String(x.leaving).padStart(5)} (${x.grads}+${x.drafted})   ${String(x.pool).padStart(5)} (${st})   ${String(x.added.recruits).padStart(5)} ${String(x.added.walkons).padStart(4)} ${String(x.added.transfers).padStart(4)} ${String(x.added.topups).padStart(5)} (${x.topupTeams}) ${String(x.added.juco).padStart(4)}   ${x.cpuRost.min}/${f1(x.cpuRost.mean)}/${x.cpuRost.max}, ${pc(x.cpuRost.in13to15)}   ${f1(x.arrive[5])}/${f1(x.arrive[4])}/${f1(x.arrive[3])}`);
  });
  console.log(`\nCPU rosters at the start: ${f1(o.startRost)}. Programs moving (first to last season): ${o.moved40} teams moved 40+ places by team overall, ${o.newTop25} entered the top 25 from outside the top 50; team overall vs school base level r = ${o.baseCorr.toFixed(2)}`);
}

// Summary over seasons 2..n (season 1 is the generated league)
export function summary(o) {
  const ss = o.seasons.slice(1), os = o.offseasons;
  const avg = f => mean(ss.map(f));
  const frMins = ss.map(s => s.mins.FR);
  return {
    ovr: Object.fromEntries(CLS.map(c => [c, avg(s => s.ovr[c])])),
    mins: Object.fromEntries(CLS.map(c => [c, avg(s => s.mins[c])])),
    eliteFR: avg(s => s.eliteMins.FR),
    frMinsMin: Math.min(...frMins), frMinsMax: Math.max(...frMins),
    classMin: Math.min(...ss.flatMap(s => CLS.map(c => s.count[c]))),
    classMax: Math.max(...ss.flatMap(s => CLS.map(c => s.count[c]))),
    pool: mean(os.map(x => x.pool)), leaving: mean(os.map(x => x.leaving)),
    recruitsJoined: mean(os.map(x => x.added.recruits)), topups: mean(os.map(x => x.added.topups)),
    topupsMax: Math.max(...os.map(x => x.added.topups)), jucoMax: Math.max(...os.map(x => x.added.juco)),
    cpuMin: Math.min(...os.map(x => x.cpuRost.min)), cpuMax: Math.max(...os.map(x => x.cpuRost.max)),
    cpuMean: mean(os.map(x => x.cpuRost.mean)), cpuIn13to15: Math.min(...os.map(x => x.cpuRost.in13to15)),
    arrive5: mean(os.map(x => x.arrive[5]).filter(v => v > 0)), arrive4: mean(os.map(x => x.arrive[4]).filter(v => v > 0)),
    top5Median: avg(s => s.top5Median),
    teamTop25: avg(s => s.team.top25), teamMed: avg(s => s.team.med), teamP90: avg(s => s.team.p90),
  };
}
