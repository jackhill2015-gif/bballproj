// Storage stress run (not part of run-all: takes a few minutes).
//   node test-harness/storage-stress.mjs [seasons=30] [out.json]
// Sims a long dynasty on the real modules, saving and reloading every
// offseason. Prints save size per season, time per save/load, and which
// parts of the save grow, so anything unbounded shows up.
import { G, S, ST, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
const N = +(process.argv[2] || 30);
const KEY = 'hoops_os_v3';
const kb = n => Math.round(n / 1024);
function parts(raw) {
  const s = JSON.parse(raw), out = {};
  for (const k of Object.keys(s)) out[k] = JSON.stringify(s[k] ?? null).length;
  return out;
}
newDynasty(40);
const rows = [];
let first = null;
for (let yr = 1; yr <= N; yr++) {
  runRegSeason(); runConfTourneys(); runNCAA();
  S.beginOffseason(); S.doOffseason();
  let t0 = performance.now(); ST.saveStateNow(); const tSave = performance.now() - t0;
  const raw = localStorage.getItem(KEY);
  t0 = performance.now(); S.buildUniverse(); ST.loadState(); const tLoad = performance.now() - t0;
  const p = parts(raw);
  if (!first) first = p;
  rows.push({ season: yr, yr: G.yr, kb: kb(raw.length), save: Math.round(tSave), load: Math.round(tLoad), p });
  console.log(`season ${String(yr).padStart(2)} (${G.yr})  ${String(kb(raw.length)).padStart(5)} KB  save ${Math.round(tSave)} ms  load ${Math.round(tLoad)} ms`);
}
if (process.argv[3]) (await import('node:fs')).writeFileSync(process.argv[3], localStorage.getItem(KEY));
const last = rows[rows.length - 1].p;
console.log('\nGrowth by part, season 1 -> ' + N + ' (KB):');
Object.keys(last).map(k => [k, kb(first[k] || 0), kb(last[k])]).filter(r => r[2] > 2)
  .sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]))
  .forEach(r => console.log('  ' + r[0].padEnd(20) + String(r[1]).padStart(6) + ' -> ' + String(r[2]).padStart(6)));
