// Player development measurements across a multi-season dynasty: league
// overall and minutes by class, the recruit pool against players leaving,
// how every roster spot gets filled, CPU roster sizes, and whether CPU
// programs move. Shared by player-dev.mjs (full report) and
// player-dev-test.mjs (fast, in run-all). Brief: HANDOFF.md "Up next" item 0.
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { REPO } from './shim.mjs';
const F = await import(REPO + '/facilities.js');
const POLL = await import(REPO + '/poll.js');
const R = await import(REPO + '/views/recruiting.js');
const P = await import(REPO + '/views/portal.js');
globalThis.window._genRecruits = S.genRecruits; // as main.js wires it

export const CLS = ['FR', 'SO', 'JR', 'SR'];
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ── A simple auto-coach for the user's team (one of 365) ──
// strong: also spends skill points (recruiting, then development) and bids
// on the best transfers it can afford, like an engaged player would
function userOffseason(strong) {
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
  if (strong) {
    for (let g = 0; (G.skillPointsToSpend || 0) > 0 && g < 60; g++) R.allocateSkillPoint(G.coach.rec < 85 || G.coach.dev >= 99 ? 'rec' : 'dev');
  }
  if (G.offseasonStep === 'portal' && strong) {
    const t = G.teams[G.tid];
    const fifth = (t.rost.map(p => p.ovr).sort((a, b) => b - a)[4]) || 0;
    const board = P.portalBoard().filter(e => e.fromTid !== G.tid && e.pickedBy === -1 && e.ovr > fifth);
    const cap = Math.floor((G.pts || 0) * 0.7);
    let spent = 0;
    for (const e of board) {
      const cost = P.portalCost(e);
      if (spent + cost > cap) continue;
      if (P.adjustOffer(e.pid, cost)) spent += cost; else if (spent) break;
    }
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
// Every player gets a measurement id (dropped by transfers, which build a
// new player object; those careers simply end in the tracking)
let _mid = 0;
function seasonSnap() {
  const ranks = {}; G.teams.map(t => [t.id, U.getTOvr(t)]).sort((a, b) => b[1] - a[1]).forEach((x, i) => { ranks[x[0]] = i + 1; });
  const track = new Map();
  G.teams.forEach(t => {
    const byOvr = t.rost.slice().sort((a, b) => b.ovr - a.ovr);
    const byMins = t.rost.slice().sort((a, b) => (b.mins || 0) - (a.mins || 0));
    const fac = F.facilitiesFor(t.id);
    const dev = t.id === G.tid ? (G.coach.dev || 70) : ((t.coach && t.coach.dev) || 70);
    t.rost.forEach(p => {
      if (!p._mid) p._mid = ++_mid;
      track.set(p._mid, { ovr: p.ovr, pot: p.pot || p.ovr, tp: p.tp, cls: p.cls, rs: !!p.rs, tid: t.id, stars: p.stars || 0,
        walkon: !!p.walkon, mins: p.mins || 0, gp: (p.s && p.s.gp) || 0, teamRank: ranks[t.id],
        ovrRank: byOvr.indexOf(p) + 1, starter: byMins.indexOf(p) < 5, dev, practice: fac.practice || 0, user: t.id === G.tid });
    });
  });
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
    track,
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
  out.dev = devStats(out.seasons);
  out.seasons.forEach(x => { delete x.track; });
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

// ── Part 2: development, from the per-player tracking ──
// One offseason's growth for every player who stayed on a roster (same
// player object, class moved up or a redshirt year), and FR-to-SR careers.
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
export function devStats(seasons) {
  const steps = [];
  for (let k = 0; k + 1 < seasons.length; k++) {
    const a = seasons[k].track, b = seasons[k + 1].track;
    a.forEach((x, id) => {
      const y = b.get(id);
      if (!y || x.cls === 'SR' && !x.rs) return;
      steps.push({ k, cls: x.cls, rs: x.rs, d: y.ovr - x.ovr, gap: x.pot - x.ovr, tgap: typeof x.tp === 'number' ? x.tp - x.ovr : null,
        dev: x.dev, practice: x.practice, mins: x.mins, walkon: x.walkon, user: x.user, ovr: x.ovr });
    });
  }
  const norm = steps.filter(s => !s.rs && !s.walkon);
  const byCls = {};
  ['FR', 'SO', 'JR'].forEach(c => {
    const d = norm.filter(s => s.cls === c).map(s => s.d);
    byCls[c] = { n: d.length, mean: mean(d), p10: pct(d, 0.1), p90: pct(d, 0.9), breakout: d.filter(v => v >= 6).length / Math.max(1, d.length), stall: d.filter(v => v <= 0).length / Math.max(1, d.length) };
  });
  const all = norm.map(s => s.d);
  // Growth relative to the class average (so class mix doesn't confound
  // coach, facility and minutes comparisons)
  const clsMean = Object.fromEntries(Object.entries(byCls).map(([c, v]) => [c, v.mean]));
  // With a true potential, growth per point of gap to it; before there was
  // one, growth against the class average
  const rel = s => s.tgap !== null ? s.d / Math.max(1, s.tgap) : s.d / Math.max(0.1, clsMean[s.cls]);
  const ratio = (f, g) => mean(norm.filter(f).map(rel)) / Math.max(0.01, mean(norm.filter(g).map(rel)));
  const grp = f => { const d = norm.filter(f); return { n: d.length, mean: mean(d.map(s => s.d)) }; };
  // Careers: freshmen (not walk-ons) still on the same roster three seasons later as seniors
  const careers = [];
  for (let k = 0; k + 3 < seasons.length; k++) {
    seasons[k].track.forEach((x, id) => {
      if (x.cls !== 'FR' || x.walkon) return;
      const so = seasons[k + 1].track.get(id), jr = seasons[k + 2].track.get(id), sr = seasons[k + 3].track.get(id);
      if (!sr || sr.cls !== 'SR' || so.rs || jr.rs || x.rs) return;
      careers.push({ k, d: sr.ovr - x.ovr, gap: x.pot - x.ovr, tgap: typeof x.tp === 'number' ? x.tp - x.ovr : null, fr: x.ovr, sr: sr.ovr, pot: x.pot, tp: x.tp, stars: x.stars });
    });
  }
  const cd = careers.map(c => c.d);
  const cg = careers.slice().sort((a, b) => a.gap - b.gap), t3 = Math.floor(cg.length / 3);
  // Recruits by the strength of the school they joined (team overall rank
  // as freshmen): overall as FR/SO/JR, rank on the roster, starter as FR
  const recruits = {};
  for (let k = 1; k < seasons.length; k++) {
    seasons[k].track.forEach((x, id) => {
      if (x.cls !== 'FR' || !x.stars || x.stars < 3 || x.rs) return;
      const prev = seasons[k - 1].track.get(id); if (prev) return; // arrived this year
      const tier = x.teamRank <= 50 ? 'top 50' : x.teamRank <= 100 ? '51-100' : '101+';
      const key = x.stars + '* ' + tier;
      const r = recruits[key] || (recruits[key] = { n: 0, fr: [], so: [], jr: [], frRank: [], starter: 0, best: 0, jrRank: [] });
      r.n++; r.fr.push(x.ovr); r.frRank.push(x.ovrRank); if (x.starter) r.starter++; if (x.ovrRank === 1) r.best++;
      const so = seasons[k + 1] && seasons[k + 1].track.get(id), jr = seasons[k + 2] && seasons[k + 2].track.get(id);
      if (so && !so.rs) r.so.push(so.ovr);
      if (jr && !jr.rs && so && !so.rs) { r.jr.push(jr.ovr); r.jrRank.push(jr.ovrRank); }
    });
  }
  // A typical 4-star (every 4-star freshman, wherever he signed) set against
  // the rosters of low schools (team overall rank 151-250): would he start
  // as a freshman, is he already their best player, how good by his
  // junior year
  const low = { pairs: 0, starts: 0, best: 0, fr: [], jr: [], lowBest: [], lowFifth: [], p90: [] };
  for (let k = 1; k + 2 < seasons.length; k++) {
    const byTeam = {};
    seasons[k].track.forEach(x => { if (x.teamRank > 150 && x.teamRank <= 250) (byTeam[x.tid] || (byTeam[x.tid] = [])).push(x.ovr); });
    const tops = Object.values(byTeam).map(a => a.sort((p, q) => q - p)).map(a => [a[0], a[4] || 0]);
    seasons[k].track.forEach((x, id) => {
      if (x.cls !== 'FR' || x.stars !== 4 || x.rs || seasons[k - 1].track.get(id)) return;
      low.fr.push(x.ovr);
      tops.forEach(([b, f]) => { low.pairs++; if (x.ovr >= f) low.starts++; if (x.ovr > b) low.best++; });
      const so = seasons[k + 1].track.get(id), jr = seasons[k + 2].track.get(id);
      if (so && jr && !so.rs && !jr.rs) low.jr.push(jr.ovr);
    });
    tops.forEach(([b, f]) => { low.lowBest.push(b); low.lowFifth.push(f); });
    low.p90.push(pct([...seasons[k].track.values()].map(x => x.ovr), 0.9));
  }
  return {
    low4: { starter: low.starts / Math.max(1, low.pairs), best: low.best / Math.max(1, low.pairs), fr: mean(low.fr), jr: mean(low.jr), lowBest: mean(low.lowBest), lowFifth: mean(low.lowFifth), p90: mean(low.p90) },
    byCls, steps: norm.length, yearMean: mean(all),
    breakout: all.filter(v => v >= 6).length / Math.max(1, all.length), stall: all.filter(v => v <= 0).length / Math.max(1, all.length),
    devTop: grp(s => s.dev >= 85), devLow: grp(s => s.dev <= 55), devRatio: ratio(s => s.dev >= 85, s => s.dev <= 55),
    facHi: grp(s => s.practice >= 2), facLo: grp(s => s.practice === 0), facRatio: ratio(s => s.practice >= 2, s => s.practice === 0),
    rotation: grp(s => s.mins >= 12), buried: grp(s => s.mins === 0), minsRatio: ratio(s => s.mins >= 12, s => s.mins === 0),
    careers: careers.length, career: { mean: mean(cd), p10: pct(cd, 0.1), p50: pct(cd, 0.5), p90: pct(cd, 0.9) },
    potLow: mean(cg.slice(0, t3).map(c => c.d)), potHigh: mean(cg.slice(cg.length - t3).map(c => c.d)),
    potLowGap: mean(cg.slice(0, t3).map(c => c.gap)), potHighGap: mean(cg.slice(cg.length - t3).map(c => c.gap)),
    srVsPot: mean(careers.map(c => c.sr - c.pot)),
    recruits,
  };
}

export function printDev(d) {
  console.log('\nGrowth per offseason (OVR, regular players; walk-ons and redshirt years left out):');
  ['FR', 'SO', 'JR'].forEach(c => { const v = d.byCls[c]; console.log(`  ${c} -> next: mean ${f1(v.mean)}, 10th-90th pct ${v.p10} to ${v.p90}, breakouts (+6) ${pc(v.breakout)}, stalls (0 or less) ${pc(v.stall)}  (n ${v.n})`); });
  console.log(`  All: mean ${f1(d.yearMean)}, breakouts ${pc(d.breakout)}, stalls ${pc(d.stall)}`);
  console.log(`  Development coach 85+ vs 55 or less: ${f1(d.devTop.mean)} vs ${f1(d.devLow.mean)} a year (adjusted ratio ${d.devRatio.toFixed(2)}; n ${d.devTop.n}/${d.devLow.n})`);
  console.log(`  Practice facility 2+ vs 0: ${f1(d.facHi.mean)} vs ${f1(d.facLo.mean)} (adjusted ratio ${d.facRatio.toFixed(2)}; n ${d.facHi.n}/${d.facLo.n})`);
  console.log(`  Rotation (12+ min) vs buried (0 min): ${f1(d.rotation.mean)} vs ${f1(d.buried.mean)} (adjusted ratio ${d.minsRatio.toFixed(2)})`);
  console.log(`Careers FR to SR on one roster (n ${d.careers}): mean ${f1(d.career.mean)}, 10th/50th/90th pct ${d.career.p10}/${d.career.p50}/${d.career.p90}; senior OVR minus freshman POT ${f1(d.srVsPot)}`);
  console.log(`  By POT gap as a freshman: lowest third (gap ${f1(d.potLowGap)}) grew ${f1(d.potLow)}, highest third (gap ${f1(d.potHighGap)}) grew ${f1(d.potHigh)}`);
  console.log('Recruits by stars and school (team overall rank as freshmen): n, OVR FR/SO/JR, rank on roster FR -> JR, starter as FR, best on team as FR');
  console.log(`4-star freshman vs low schools' rosters (team rank 151-250; best player ${f1(d.low4.lowBest)}, 5th best ${f1(d.low4.lowFifth)}): arrives ${f1(d.low4.fr)}, would start ${pc(d.low4.starter)}, would be their best player ${pc(d.low4.best)}; ${f1(d.low4.jr)} as a junior (league's top 10% of players: ${f1(d.low4.p90)} and up)`);
  Object.keys(d.recruits).sort().reverse().forEach(k => {
    const r = d.recruits[k];
    console.log(`  ${k.padEnd(11)} ${String(r.n).padStart(4)}  ${f1(mean(r.fr))}/${f1(mean(r.so))}/${f1(mean(r.jr))}  rank ${f1(mean(r.frRank))} -> ${f1(mean(r.jrRank))}  starter ${pc(r.starter / r.n)}  best ${pc(r.best / r.n)}`);
  });
}

// ── How fast a low school rises ──
// The user's auto-coach (strong: skill points, transfers, recruiting
// within reach) at a bottom-tier school. Records the poll (any week and
// final), team overall rank, and whether a superteam forms: a team at
// least 3 OVR clear of the next best, anywhere in the league.
export function rise({ runs = 4, seasons = 8, pickRank = 0.9 } = {}) {
  const out = [];
  for (let run = 0; run < runs; run++) {
    newDynasty(0);
    const bases = G.teams.slice().sort((a, b) => b.baseOvr - a.baseOvr);
    const tid = bases[Math.floor(pickRank * bases.length) + ri3()].id;
    newDynasty(tid);
    const school = G.teams[tid].name, base = G.teams[tid].baseOvr;
    let inPoll = 0;
    const off = POLL.onPoll(() => { const r = POLL.pollRank(G.tid); if (r && (!inPoll || r < inPoll)) inPoll = r; });
    const rows = [];
    for (let s = 0; s < seasons; s++) {
      inPoll = 0;
      U.fixMins(G.teams[G.tid].rost);
      runRegSeason(); runConfTourneys(); runNCAA();
      const o = G.teams.map(t => [t.id, U.getTOvr(t)]).sort((a, b) => b[1] - a[1]);
      rows.push({ yr: G.yr, tid: G.tid, best: inPoll, final: POLL.pollRank(G.tid) || 0,
        ovrRank: o.findIndex(x => x[0] === G.tid) + 1, ovr: U.getTOvr(G.teams[G.tid]), lead: o[0][1] - o[1][1], topTid: o[0][0], top: o[0][1],
        w: G.teams[G.tid].wins, l: G.teams[G.tid].loss });
      if (s < seasons - 1) { S.beginOffseason(); userOffseason(true); S.doOffseason(); }
    }
    off();
    out.push({ school, base, tid, rows });
  }
  return out;
}
function ri3() { return Math.floor(Math.random() * 7) - 3; }

export function printRise(rr) {
  console.log('\nLow school rise (auto-coach with skill points, transfers and recruiting; bottom-tier school):');
  console.log('  school (base)        by season: best poll rank this season (- = unranked) / team OVR rank');
  rr.forEach(r => console.log(`  ${(r.school + ' (' + r.base + ')').padEnd(26)} ${r.rows.map(x => (x.best || '-') + '/' + x.ovrRank).join('  ')}`));
  const first = f => rr.map(r => { const i = r.rows.findIndex(f); return i < 0 ? null : i + 1; });
  const fmt = a => a.map(v => v === null ? '-' : v).join(', ');
  const t25 = first(x => x.best > 0), f25 = first(x => x.final > 0), o10 = first(x => x.ovrRank <= 10), o1 = first(x => x.ovrRank === 1);
  console.log(`  First season in the poll: ${fmt(t25)}; in the final Top 25: ${fmt(f25)}; top 10 by team OVR: ${fmt(o10)}; #1 team OVR: ${fmt(o1)}`);
  const sup = rr.flatMap(r => r.rows.filter((x, i) => i > 0));
  const own = rr.flatMap(r => r.rows.filter(x => x.lead >= 3 && x.topTid === r.tid)).length;
  console.log(`  Superteam (a team 3+ OVR clear of the next best): ${sup.filter(x => x.lead >= 3).length} of ${sup.length} seasons after the first; the low school was the superteam in ${own}`);
  return { t25, f25, o10, o1 };
}
