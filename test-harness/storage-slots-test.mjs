// Three save slots: independent dynasties, active slot remembered, delete
// touches one slot, home-card summaries, restore into a chosen slot, and the
// localStorage fallback keys.
import { G, S, ST, newDynasty, runRegSeason } from './season-lib.mjs';
import { REPO } from './shim.mjs';
import { installIDB, removeIDB } from './idb-mock.mjs';
const STO = await import(REPO + '/storage.js');
const { slotSummary } = await import(REPO + '/views/setup.js');
let fails = 0;
const check = (c, msg) => { console.log((c ? '  ok  ' : '  FAIL ') + msg); if (!c) fails++; };
const fresh = async () => import(REPO + '/storage.js?r=' + Math.random());

// Fallback (no IndexedDB): slot keys in localStorage
{
  const M = await fresh(); await M.initStorage();
  M.writeSlot(1, 'a'); M.writeSlot(2, 'b'); M.writeSlot(3, 'c');
  check(localStorage.getItem('hoops_os_v3') === 'a' && localStorage.getItem('hoops_os_v3_2') === 'b' && localStorage.getItem('hoops_os_v3_3') === 'c', 'fallback slots use hoops_os_v3, _2, _3');
  M.removeSlot(2);
  check(M.readSlot(2) === null && M.readSlot(1) === 'a', 'fallback delete removes one slot');
  localStorage.clear();
}

const dbs = installIDB();
await STO.initStorage();
check(STO.storageMode().backend === 'idb', 'IndexedDB in use');
check(STO.SLOTS.join() === '1,2,3', 'three slots');

// Three dynasties, one per slot
const teams = { 1: 10, 2: 120, 3: 250 };
const wins = {};
for (const n of [1, 2, 3]) {
  STO.setActiveSlot(n);
  newDynasty(teams[n]);
  if (n === 2) runRegSeason();
  ST.saveStateNow();
  wins[n] = G.teams[G.tid].wins;
}
await STO.flushWrites();
check(STO.activeSlot() === 3, 'active slot remembered');
check(localStorage.getItem('hoops_os_slot') === '3', 'active slot is a small localStorage pref');
for (const n of [1, 2, 3]) {
  STO.setActiveSlot(n);
  S.buildUniverse(); ST.loadState();
  check(G.tid === teams[n] && G.teams[G.tid].wins === wins[n], 'slot ' + n + ' loads its own dynasty (team ' + teams[n] + ')');
}
const sum2 = slotSummary(STO.readSlot(2));
check(sum2 && sum2.team && /^\d+-\d+$/.test(sum2.record.replace(/–/, '-')) && sum2.coach === 'Test Coach' && sum2.yr === 2025, 'home card summary: team, season, record, coach (' + (sum2 && [sum2.team, sum2.yr, sum2.record, sum2.coach].join(', ')) + ')');
check(slotSummary(null) === null && slotSummary('not json') === null, 'empty or broken slot shows as empty');

// Delete one slot
STO.setActiveSlot(2); ST.deleteSave(); await STO.flushWrites();
const store = dbs.get('hoops_os').stores.get('saves');
check(!store.has('slot2') && store.has('slot1') && store.has('slot3'), 'delete removes only slot 2');
check(!ST.hasSave(), 'hasSave is per slot');

// Restore a backup into a chosen slot (what backup.js does)
const backup = STO.readSlot(1);
await STO.writeSlotNow(2, backup);
check(store.get('slot2') === backup, 'restore writes the chosen slot to disk before reload');

// Reload: all slots read back
{
  const M = await fresh(); await M.initStorage();
  check(M.readSlot(1) === STO.readSlot(1) && M.readSlot(2) === backup && M.readSlot(3) === STO.readSlot(3), 'all three slots survive a reload');
}

// Fallback saves (e.g. a private-mode session) move into their slots; the newer copy wins
{
  const older = STO.readSlot(3);
  const newer = older.replace(/"_savedAt":\d+/, '"_savedAt":' + (Date.now() + 1000));
  localStorage.setItem('hoops_os_v3_3', newer);
  localStorage.setItem('hoops_os_v3_2', backup.replace(/"_savedAt":\d+/, '"_savedAt":1'));
  const M = await fresh(); await M.initStorage();
  check(M.readSlot(3) === newer && localStorage.getItem('hoops_os_v3_3') === null, 'newer localStorage copy replaces slot 3');
  check(M.readSlot(2) === backup && localStorage.getItem('hoops_os_v3_2') === null, 'older localStorage copy is dropped');
}
removeIDB();
console.log(fails ? fails + ' FAILURES' : 'ALL PASS');
process.exit(fails ? 1 : 0);
