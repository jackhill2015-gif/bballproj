// Storage overhaul: an existing localStorage save ("hoops_os_v3") moves into
// IndexedDB slot 1 on first run, plays on from there, and survives a reload.
// The localStorage copy is only removed once IndexedDB reads back identical.
import { G, S, ST, newDynasty, runRegSeason } from './season-lib.mjs';
import { REPO } from './shim.mjs';
import { installIDB, removeIDB } from './idb-mock.mjs';
const STO = await import(REPO + '/storage.js');
let fails = 0;
const check = (c, msg) => { console.log((c ? '  ok  ' : '  FAIL ') + msg); if (!c) fails++; };
const league = () => JSON.stringify(G.teams.map(t => ({ r: t.rost.map(p => [p.name, p.ovr, p.cls, p.s.pts]), w: t.wins, l: t.loss })));
const fresh = async () => import(REPO + '/storage.js?r=' + Math.random()); // a page reload

// 1. A save from before the change (localStorage, no slot pref)
newDynasty(30);
for (let i = 0; i < 200 && G.gi < 8; i++) { const g = G.teams[G.tid].sched[G.gi]; if (!g || g.played) { S.simCPUWeek(); S.advanceWeek(); } else S.launchSim(false); }
ST.saveStateNow();
const legacy = localStorage.getItem('hoops_os_v3');
const before = league();
check(!!legacy && STO.storageMode().backend === 'local', 'before init: save written to localStorage hoops_os_v3');

// 2a. IndexedDB write fails: keep the localStorage copy, keep playing
{
  installIDB({ failWrites: true });
  const M = await fresh();
  await M.initStorage();
  check(localStorage.getItem('hoops_os_v3') === legacy, 'failed migration keeps the localStorage save');
  check(M.readSlot(1) === legacy, 'failed migration still reads the save');
  // and a save that can't reach IndexedDB lands in localStorage instead
  const newer = legacy.replace(/"_savedAt":\d+/, '"_savedAt":' + (Date.now() + 5));
  M.writeSlot(1, newer); await M.flushWrites();
  check(localStorage.getItem('hoops_os_v3') === newer, 'failed IndexedDB write kept in localStorage');
  localStorage.setItem('hoops_os_v3', legacy);
}
// 2b. Read-back differs: keep the localStorage copy
{
  installIDB({ corruptReads: true });
  const M = await fresh();
  await M.initStorage();
  check(localStorage.getItem('hoops_os_v3') === legacy, 'read-back mismatch keeps the localStorage save');
}

// 3. First run with IndexedDB
const dbs = installIDB();
await STO.initStorage();
check(STO.storageMode().backend === 'idb', 'IndexedDB in use after init');
check(localStorage.getItem('hoops_os_v3') === null, 'localStorage copy removed after verified migration');
check(STO.readSlot(1) === legacy, 'slot 1 holds the old save, byte for byte');
check(STO.activeSlot() === 1, 'active slot defaults to 1');
S.buildUniverse(); ST.loadState();
check(league() === before, 'migrated save loads identically (Continue)');

// 4. Play on: saves go to IndexedDB in the background, never localStorage
runRegSeason();
ST.saveStateNow();
await STO.flushWrites();
const stored = dbs.get('hoops_os').stores.get('saves').get('slot1');
check(stored === STO.readSlot(1) && stored !== legacy, 'new save written to IndexedDB');
check(localStorage.getItem('hoops_os_v3') === null, 'nothing written back to localStorage');
const after = league();

// 5. Debounced save + flush on hide (pagehide path)
G.teams[G.tid].wins += 0; ST.saveState(); ST.flushPendingSave(); await STO.flushWrites();
check(dbs.get('hoops_os').stores.get('saves').get('slot1') === STO.readSlot(1), 'flushPendingSave reaches IndexedDB');

// 6. Reload: a fresh storage module reads the latest save
{
  const M = await fresh();
  await M.initStorage();
  check(M.readSlot(1) === STO.readSlot(1), 'after reload slot 1 has the latest save');
}
S.buildUniverse(); ST.loadState();
check(league() === after, 'latest save loads identically');

// 7. No IndexedDB (private mode): falls back to localStorage
{
  removeIDB();
  const M = await fresh();
  await M.initStorage();
  check(M.storageMode().backend === 'local', 'no IndexedDB: localStorage fallback');
  installIDB({ failOpen: true });
  const M2 = await fresh();
  await M2.initStorage();
  check(M2.storageMode().backend === 'local', 'IndexedDB open error: localStorage fallback');
}
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
