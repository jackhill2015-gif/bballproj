// test-harness/difficulty-diag.mjs
// REPORT ONLY — never changes game logic, numbers, or balance.
// Sims long dynasties (12 seasons x 3 prestige tiers x 2 runs) with a simple
// auto-coach to measure whether HOOPS OS gets too easy, how fast, and why.
// In particular it quantifies the known issue that CPU players don't develop
// in the offseason (user returners get calcGrowth; CPU returners get nothing).
//
// Usage: node test-harness/difficulty-diag.mjs
// Writes: research/difficulty-report.md
import './shim.mjs';
import { G, S, ST, U, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
import { REPO } from './shim.mjs';

const P = await import(REPO + '/views/portal.js');
const R = await import(REPO + '/views/recruiting.js');

const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const SEASONS = 12;
const RUNS = 2;

// ---------------------------------------------------------------------------
// Auto-coach: dumb but sane. Sorts by OVR, fixes minutes, spends skill points
// on dev/rec, takes portal players at thin positions, concentrates recruiting
// points on the best available targets.
// ---------------------------------------------------------------------------
function autoLineup() {
  const t = G.teams[G.tid];
  t.rost.sort((a, b) => b.ovr - a.ovr);
  U.fixMins(t.rost);
}

function autoSkills() {
  let guard = 0;
  while ((G.skillPointsToSpend || 0) > 0 && guard++ < 40) {
    const k = G.coach.dev < 90 ? 'dev' : (G.coach.rec < 90 ? 'rec' : 'off');
    R.allocateSkillPoint(k);
  }
}

function autoPortal() {
  P.genPortalEntrants();
  const t = G.teams[G.tid];
  const posCount = {};
  t.rost.forEach(p => { posCount[p.pos] = (posCount[p.pos] || 0) + 1; });
  const board = P.portalBoard().filter(e => e.fromTid !== G.tid && e.pickedBy === -1);
  const nilCap = Math.floor((G.pts || 0) * 0.7);
  let spent = 0, n = 0;
  for (const e of board) {
    if (n >= 4 || spent >= nilCap || t.rost.length >= 15) break;
    const need = (posCount[e.pos] || 0) < 2;
    if (!need && (t.rost.length >= 13 || e.ovr < 78)) continue;
    const cost = P.portalCost(e);
    if (spent + cost > nilCap) continue;
    if (P.adjustOffer(e.pid, cost)) { spent += cost; n++; posCount[e.pos] = (posCount[e.pos] || 0) + 1; }
  }
  P.advancePortalStage(); P.advancePortalStage(); P.advancePortalStage(); // 3rd call finalizes
  return n;
}

function autoRecruit() {
  G.recruitPhase = 1;
  G.recruitingBudget = ST.calcRecruitingBudget();
  G.recruitingSpent = 0;
  G.recruits.forEach(r => {
    r.points = 0;
    if (typeof r.status !== 'string') r.status = 'open';
    if (!r.homeState) r.homeState = 'CA';
  });
  // Respect the prestige gates (mirrors SCHOOL_RECRUIT_GATES): don't burn
  // points on stars we can't sign.
  const GATES = { 5: 80, 4: 60, 3: 35, 2: 10, 1: 0 };
  const sp = (G.teams[G.tid] && G.teams[G.tid].schoolPrestige) || 50;
  const targets = G.recruits
    .filter(r => r.status === 'open' && sp >= (GATES[r.stars] || 0))
    .sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const shares = [0.35, 0.22, 0.15, 0.10, 0.08, 0.05, 0.03, 0.02];
  targets.forEach((r, i) => {
    const amt = Math.floor(G.recruitingBudget * shares[i]);
    if (amt >= 5) R.adjustPoints(r.id, amt);
  });
  const before = G.recruits.filter(r => r.signed === G.tid).length;
  R.resolveRecruitingClass();
  return G.recruits.filter(r => r.signed === G.tid).length - before;
}

// If the auto-coach gets fired, take the best available job and continue.
function checkFired() {
  if (G.offseasonStep !== 'fired') return null;
  const cands = G.teams.filter(t => t.id !== G.tid)
    .sort((a, b) => (b.schoolPrestige || 0) - (a.schoolPrestige || 0));
  const nt = cands[0];
  const old = G.teams[G.tid];
  old.coach = { firstName: 'CPU', lastName: 'Coach', age: 50, off: 65, def: 65, dev: 65, rec: 65, tenure: 0 };
  G.tid = nt.id;
  nt.coach = { firstName: G.coach.firstName, lastName: G.coach.lastName, age: G.coach.age,
    off: G.coach.off, def: G.coach.def, dev: G.coach.dev, rec: G.coach.rec, tenure: 0, isUser: true };
  G.coach.tenure = 0;
  G.offseasonStep = 'carousel';
  return nt.name;
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------
function ncaaResult() {
  const sa = G.seasonAchievements || {};
  if (sa.natChamp) return 'CHAMP';
  if (sa.champGame) return 'Final';
  if (sa.finalFour) return 'F4';
  if (sa.tourneyFinish === 'Elite Eight') return 'E8';
  if (sa.sweet16) return 'S16';
  if (sa.madeNCAA) return 'R64+';
  return 'DNQ';
}

function rankOf(t) {
  if (t.lastRank) return t.lastRank;
  const sorted = G.teams.slice().sort((a, b) => b.pts - a.pts);
  return sorted.findIndex(x => x.id === t.id) + 1;
}

function measure() {
  const t = G.teams[G.tid];
  const ovrs = t.rost.map(p => p.ovr).sort((a, b) => b - a);
  const top5 = ovrs.slice(0, 5).reduce((s, x) => s + x, 0) / Math.max(1, Math.min(5, ovrs.length));
  const league = G.teams.reduce((s, x) => s + U.getTOvr(x), 0) / G.teams.length;
  return {
    school: t.name, w: t.wins, l: t.loss, rank: rankOf(t), ncaa: ncaaResult(),
    ovr: U.getTOvr(t), top5: Math.round(top5),
    leagueOvr: Math.round(league * 10) / 10,
    gap: Math.round((U.getTOvr(t) - league) * 10) / 10,
  };
}

// CPU development: snapshot non-seniors on sampled CPU teams before the
// offseason, compare after. User development comes from G.devReport.
function snapCpu(ids) {
  const s = {};
  ids.forEach(id => {
    const tm = G.teams[id];
    if (!tm || !tm.rost) return;
    tm.rost.forEach(p => { if (p.cls !== 'SR') s[id + '|' + p.name] = p.ovr; });
  });
  return s;
}
function cpuGain(snap, ids) {
  let sum = 0, n = 0;
  ids.forEach(id => {
    const tm = G.teams[id];
    if (!tm || !tm.rost) return;
    tm.rost.forEach(p => {
      const k = id + '|' + p.name;
      if (snap[k] !== undefined) { sum += p.ovr - snap[k]; n++; }
    });
  });
  return n ? sum / n : 0;
}
function userGain() {
  const rows = (G.devReport && G.devReport.rows) || [];
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + (r.ovrTo - r.ovrFrom), 0) / rows.length;
}

// ---------------------------------------------------------------------------
// Main: 3 tiers x 2 runs x 12 seasons
// ---------------------------------------------------------------------------
const TIERS = [
  { key: 'low', pick: ts => ts[8] },
  { key: 'mid', pick: ts => ts[Math.floor(ts.length / 2)] },
  { key: 'high', pick: ts => ts[ts.length - 9] },
];

const rows = [];
for (const tier of TIERS) {
  for (let run = 1; run <= RUNS; run++) {
    newDynasty(0);
    const sorted = G.teams.slice().sort((a, b) => a.baseOvr - b.baseOvr);
    const picked = tier.pick(sorted);
    newDynasty(picked.id);
    const school0 = G.teams[G.tid].name;
    const baseOvr0 = G.teams[G.tid].baseOvr;
    const cpuIds = G.teams.filter(t => t.id !== G.tid)
      .sort(() => Math.random() - 0.5).slice(0, 24).map(t => t.id);
    console.log(`\n### ${tier.key} run ${run}: ${school0} (baseOvr ${baseOvr0})`);
    for (let s = 1; s <= SEASONS; s++) {
      autoLineup();
      runRegSeason(); runConfTourneys(); runNCAA();
      const m = measure();
      const snap = snapCpu(cpuIds);
      S.beginOffseason();
      const newJob = checkFired();
      autoSkills();
      const portalN = autoPortal();
      const recN = autoRecruit();
      S.doOffseason();
      const row = {
        tier: tier.key, run, season: s, ...m,
        portal: portalN, recruits: recN,
        userDev: Math.round(userGain() * 10) / 10,
        cpuDev: Math.round(cpuGain(snap, cpuIds) * 10) / 10,
        fired: !!newJob, newSchool: newJob || '',
      };
      rows.push(row);
      console.log(`  s${s}: ${m.w}-${m.l} rk${m.rank} ${m.ncaa} ovr${m.ovr}/t5-${m.top5} lg${m.leagueOvr} gap${m.gap >= 0 ? '+' : ''}${m.gap} dev you${row.userDev}/cpu${row.cpuDev}${newJob ? ' FIRED->' + newJob : ''}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Aggregation + report
// ---------------------------------------------------------------------------
function avg(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

const byTierSeason = {};
rows.forEach(r => {
  const k = r.tier + '|' + r.season;
  (byTierSeason[k] = byTierSeason[k] || []).push(r);
});

console.log('\n=== per-tier season averages (2 runs) ===');
console.log('tier        s |  W-L  | rank | gap  | titles');
const tierSummary = {};
['low', 'mid', 'high'].forEach(tier => {
  tierSummary[tier] = [];
  for (let s = 1; s <= SEASONS; s++) {
    const rs = byTierSeason[tier + '|' + s] || [];
    const wins = Math.round(avg(rs.map(r => r.w)));
    const loss = Math.round(avg(rs.map(r => r.l)));
    const rank = Math.round(avg(rs.map(r => r.rank)));
    const gap = Math.round(avg(rs.map(r => r.gap)) * 10) / 10;
    const titles = rs.filter(r => r.ncaa === 'CHAMP').length;
    tierSummary[tier].push({ s, wins, loss, rank, gap, titles });
    console.log(`${tier.padEnd(11)} ${String(s).padStart(2)} | ${String(wins).padStart(2)}-${String(loss).padStart(2)} | ${String(rank).padStart(3)} | ${String(gap).padStart(5)} | ${titles}`);
  }
});

// Time to dominance per run
console.log('\n=== time to dominance (per run) ===');
const dom = [];
['low', 'mid', 'high'].forEach(tier => {
  for (let run = 1; run <= RUNS; run++) {
    const rs = rows.filter(r => r.tier === tier && r.run === run);
    const firstTop10 = rs.find(r => r.rank <= 10);
    const firstTitle = rs.find(r => r.ncaa === 'CHAMP');
    const titles = rs.filter(r => r.ncaa === 'CHAMP').length;
    const finals = rs.filter(r => r.ncaa === 'Final' || r.ncaa === 'CHAMP').length;
    dom.push({ tier, run, firstTop10: firstTop10 ? firstTop10.season : '-', firstTitle: firstTitle ? firstTitle.season : '-', titles, finals });
    console.log(`${tier} run ${run}: first top-10 season ${firstTop10 ? firstTop10.season : 'never'}, first title season ${firstTitle ? firstTitle.season : 'never'}, titles ${titles}/12`);
  }
});

// Development gap
const uDev = avg(rows.map(r => r.userDev));
const cDev = avg(rows.map(r => r.cpuDev));
console.log(`\n=== offseason development (avg OVR gain per returner) ===`);
console.log(`user: +${uDev.toFixed(2)} | cpu: +${cDev.toFixed(2)} | gap: +${(uDev - cDev).toFixed(2)}/yr`);

// Firings
const firings = rows.filter(r => r.fired);
console.log(`\n=== firings: ${firings.length} ===`);
firings.forEach(r => console.log(`  ${r.tier} run ${r.run} season ${r.season}: fired from ${r.school} -> ${r.newSchool}`));

// ---------------------------------------------------------------------------
// Write research/difficulty-report.md
// ---------------------------------------------------------------------------
import { writeFileSync } from 'fs';
const L = [];
L.push('# Difficulty report — HOOPS OS');
L.push('');
L.push('**Method:** `test-harness/difficulty-diag.mjs` (report only, no game changes).');
L.push('12 seasons x 3 prestige tiers (low/mid/high by baseOvr) x 2 runs = 72 seasons.');
L.push('Auto-coach: sorts by OVR + fixes minutes each preseason, spends skill points on');
L.push('dev/rec, takes up to 4 portal players at thin positions (70% of NIL), concentrates');
L.push('recruiting points on the 8 best available targets. Unseeded RNG — treat single-run');
L.push('numbers as indicative, tier averages as the signal.');
L.push('');
L.push('## Season-by-season tier averages (2 runs each)');
L.push('');
L.push('| tier | s | W-L | rank | OVR gap vs league | titles |');
L.push('|------|---|-------|------|-------------------|--------|');
['low', 'mid', 'high'].forEach(tier => {
  tierSummary[tier].forEach(r => {
    L.push(`| ${tier} | ${r.s} | ${r.wins}-${r.loss} | ${r.rank} | ${r.gap >= 0 ? '+' : ''}${r.gap} | ${r.titles} |`);
  });
});
L.push('');
L.push('## Time to dominance');
L.push('');
L.push('| tier | run | first top-10 | first title | titles/12 | finals/12 |');
L.push('|------|-----|--------------|-------------|-----------|-----------|');
dom.forEach(d => L.push(`| ${d.tier} | ${d.run} | ${d.firstTop10} | ${d.firstTitle} | ${d.titles} | ${d.finals} |`));
L.push('');
L.push('## The CPU development gap (measured)');
L.push('');
L.push(`- User returners: **+${uDev.toFixed(2)} OVR per offseason** (via calcGrowth + coach dev + practice facility).`);
L.push(`- CPU returners: **+${cDev.toFixed(2)} OVR per offseason** (sampled across 24 CPU teams per run).`);
L.push(`- Net compounding advantage: **+${(uDev - cDev).toFixed(2)} OVR per year**, every year, before recruiting/portal are even counted.`);
L.push('- Cause (verified in `season.js` doOffseason): CPU rosters only age up class (`p.cls`);');
L.push('  `calcGrowth` is never called for them. Their freshmen arrive at the same ratings');
L.push('  as the user\'s, then freeze while the user\'s roster gains ~+3-6 OVR per player per year.');
L.push('');
L.push('## Does it get too easy?');
L.push('');
L.push('(Filled from the tables above after the run.)');
L.push('');
L.push('## What drives it');
L.push('');
L.push('(Filled from the tables above after the run.)');
L.push('');
L.push('## Suggested fixes (not implemented — report only)');
L.push('');
L.push('(Filled from the tables above after the run.)');
L.push('');
L.push(`## Appendix: firings (${firings.length} across 72 seasons)`);
firings.forEach(r => L.push(`- ${r.tier} run ${r.run}, season ${r.season}: fired from ${r.school}, took ${r.newSchool}`));
if (!firings.length) L.push('- none');
L.push('');
writeFileSync(REPO + '/research/difficulty-report.md', L.join('\n'));
console.log('\nWrote research/difficulty-report.md (analysis sections filled in by hand after review)');
