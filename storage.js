// ═══════════════════════════════════════════════════════════
//  HOOPS OS — storage.js
//  Where saves live. Three save slots in IndexedDB (room for long
//  dynasties), read into memory at boot so the game stays synchronous:
//  reads come from memory, writes go to memory at once and to IndexedDB
//  in the background, one transaction per write (a save is either fully
//  written or not at all).
//
//  Without IndexedDB (some private modes, node tests) saves fall back to
//  localStorage: slot 1 is the old "hoops_os_v3" key, slots 2-3 are
//  "hoops_os_v3_2" / "_3". Until initStorage() finishes, the fallback is
//  used, so state.js works the same with or without it.
// ═══════════════════════════════════════════════════════════

export var SLOTS = [1, 2, 3];
var LEGACY_KEY = 'hoops_os_v3';
var SLOT_PREF = 'hoops_os_slot';
var PERSIST_PREF = 'hoops_os_persist_asked';
var DB_NAME = 'hoops_os';
var DB_VERSION = 1;
var STORE = 'saves';
var OPEN_TIMEOUT_MS = 4000;

var _backend = 'local';   // 'idb' once initStorage() has read the saves
var _reason = null;       // why we're on the fallback in a browser: 'unavailable'
var _db = null;
var _mem = {};            // idb mode: slot -> save string (or null)
var _queue = {};          // idb mode: slot -> { busy, has, val }
var _waiters = [];        // flushWrites() promises
var _onError = null;

function _ls() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}
function _lsKey(slot) { return slot === 1 ? LEGACY_KEY : LEGACY_KEY + '_' + slot; }
function _idbKey(slot) { return 'slot' + slot; }
function _validSlot(n) { n = Number(n); return SLOTS.indexOf(n) >= 0 ? n : 1; }

// ── Active slot: a small localStorage pref, slot 1 by default ──
export function activeSlot() {
  var s = _ls(), v = null;
  try { v = s ? s.getItem(SLOT_PREF) : null; } catch (e) { v = null; }
  return _validSlot(v || 1);
}
export function setActiveSlot(n) {
  var s = _ls();
  try { if (s) s.setItem(SLOT_PREF, String(_validSlot(n))); } catch (e) {}
}

export function storageMode() { return { backend: _backend, reason: _reason }; }
// Called with (error) when a background write fails (main.js shows a toast)
export function onStorageError(cb) { _onError = cb; }

// ── Read / write / remove a slot (synchronous) ──
export function readSlot(slot) {
  slot = _validSlot(slot);
  if (_backend === 'idb') return _mem[slot] || null;
  var s = _ls();
  if (!s) return null;
  try { return s.getItem(_lsKey(slot)); } catch (e) { return null; }
}

// Fallback mode throws when localStorage is full (state.js retries smaller)
export function writeSlot(slot, str) {
  slot = _validSlot(slot);
  if (_backend === 'idb') { _mem[slot] = str; _enqueue(slot, str); return; }
  var s = _ls();
  if (!s) throw new Error('No storage available');
  s.setItem(_lsKey(slot), str);
}

export function removeSlot(slot) {
  slot = _validSlot(slot);
  if (_backend === 'idb') { _mem[slot] = null; _enqueue(slot, null); return; }
  var s = _ls();
  try { if (s) s.removeItem(_lsKey(slot)); } catch (e) {}
}

// Write and wait until it's on disk (restore uses this before reloading)
export function writeSlotNow(slot, str) {
  try { writeSlot(slot, str); } catch (e) { return Promise.reject(e); }
  return flushWrites();
}

// Resolves once every queued background write has finished
export function flushWrites() {
  if (_backend !== 'idb' || _idle()) return Promise.resolve();
  return new Promise(function(res) { _waiters.push(res); });
}

// ── Background writer: one write in flight per slot, newest value wins ──
function _idle() {
  return SLOTS.every(function(n) { var q = _queue[n]; return !q || (!q.busy && !q.has); });
}
function _enqueue(slot, val) {
  var q = _queue[slot] || (_queue[slot] = { busy: false, has: false, val: null });
  q.has = true; q.val = val;
  _pump(slot);
}
function _pump(slot) {
  var q = _queue[slot];
  if (q.busy) return;
  if (!q.has) {
    if (_idle()) { var w = _waiters; _waiters = []; w.forEach(function(r) { r(); }); }
    return;
  }
  var val = q.val;
  q.has = false; q.val = null; q.busy = true;
  var done = function(err) {
    q.busy = false;
    if (err) {
      console.error('[Storage] write failed', err);
      // Keep the progress in localStorage instead; the next boot moves the
      // newer copy back into IndexedDB
      var kept = val === null;
      if (!kept) { var ls = _ls(); try { if (ls) { ls.setItem(_lsKey(slot), val); kept = true; } } catch (e) {} }
      if (!kept && _onError) { try { _onError(err); } catch (e) {} }
    }
    _pump(slot);
  };
  try {
    var tx = _db.transaction(STORE, 'readwrite');
    var st = tx.objectStore(STORE);
    if (val === null) st.delete(_idbKey(slot)); else st.put(val, _idbKey(slot));
    tx.oncomplete = function() { done(null); };
    tx.onabort = tx.onerror = function() { done(tx.error || new Error('write aborted')); };
    if (typeof tx.commit === 'function') { try { tx.commit(); } catch (e) {} } // don't wait for the event loop (tab closing)
  } catch (e) { done(e); }
}

// ── IndexedDB helpers (promise wrappers) ──
function _open() {
  return new Promise(function(res, rej) {
    var settled = false;
    var finish = function(fn, v) { if (!settled) { settled = true; fn(v); } };
    // Some private modes never answer: give up and use the fallback
    var timer = setTimeout(function() { finish(rej, new Error('IndexedDB open timed out')); }, OPEN_TIMEOUT_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
    var req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { clearTimeout(timer); finish(rej, e); return; }
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function() {
      clearTimeout(timer);
      if (settled) { try { req.result.close(); } catch (e) {} return; }
      finish(res, req.result);
    };
    req.onerror = function() { clearTimeout(timer); finish(rej, req.error || new Error('IndexedDB open failed')); };
    req.onblocked = function() { /* another tab is upgrading; onsuccess follows */ };
  });
}

function _getAll(db) {
  return new Promise(function(res, rej) {
    var out = {};
    var tx = db.transaction(STORE, 'readonly');
    var st = tx.objectStore(STORE);
    SLOTS.forEach(function(n) {
      var r = st.get(_idbKey(n));
      r.onsuccess = function() { out[n] = typeof r.result === 'string' ? r.result : null; };
    });
    tx.oncomplete = function() { res(out); };
    tx.onabort = tx.onerror = function() { rej(tx.error || new Error('read failed')); };
  });
}

function _put(db, slot, val) {
  return new Promise(function(res, rej) {
    var tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, _idbKey(slot));
    tx.oncomplete = function() { res(); };
    tx.onabort = tx.onerror = function() { rej(tx.error || new Error('write failed')); };
  });
}

function _get(db, slot) {
  return new Promise(function(res, rej) {
    var tx = db.transaction(STORE, 'readonly');
    var r = tx.objectStore(STORE).get(_idbKey(slot));
    tx.oncomplete = function() { res(r.result); };
    tx.onabort = tx.onerror = function() { rej(tx.error || new Error('read failed')); };
  });
}

// Save time stamp written near the top of every save (state.js)
function _savedAt(str) {
  var m = /"_savedAt":(\d+)/.exec(String(str || '').slice(0, 200));
  return m ? Number(m[1]) : 0;
}

// Move localStorage saves (the pre-slots save, or saves written while
// IndexedDB was unavailable) into IndexedDB. The localStorage copy is only
// removed once the IndexedDB copy reads back identical.
function _migrate(db, mem) {
  var s = _ls();
  if (!s) return Promise.resolve();
  var chain = Promise.resolve();
  SLOTS.forEach(function(n) {
    chain = chain.then(function() {
      var local = null;
      try { local = s.getItem(_lsKey(n)); } catch (e) { local = null; }
      if (!local) return;
      if (mem[n] === local) { try { s.removeItem(_lsKey(n)); } catch (e) {} return; }
      // Both exist and differ: keep the newer one
      if (mem[n] && _savedAt(mem[n]) >= _savedAt(local)) { try { s.removeItem(_lsKey(n)); } catch (e) {} return; }
      return _put(db, n, local)
        .then(function() { return _get(db, n); })
        .then(function(back) {
          if (back !== local) throw new Error('read-back mismatch');
          mem[n] = local;
          try { s.removeItem(_lsKey(n)); } catch (e) {}
          console.log('[Storage] moved slot ' + n + ' save into IndexedDB (' + Math.round(local.length / 1024) + ' KB)');
        })
        .catch(function(e) {
          // Play from the localStorage copy this session (it stays put); the
          // next boot tries again and keeps whichever copy is newer
          console.warn('[Storage] migration of slot ' + n + ' deferred', e);
          if (!mem[n] || _savedAt(local) > _savedAt(mem[n])) mem[n] = local;
        });
    });
  });
  return chain;
}

function _askPersist() {
  var s = _ls();
  try {
    if (s && s.getItem(PERSIST_PREF)) return;
    if (s) s.setItem(PERSIST_PREF, '1');
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function() {});
    }
  } catch (e) {}
}

// Boot: open IndexedDB, read all slots into memory, migrate. Always
// resolves; on any failure the game keeps using localStorage.
var _initP = null;
export function initStorage() {
  if (_initP) return _initP;
  _initP = new Promise(function(resolve) {
    var browser = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof navigator !== 'undefined';
    var idb = null;
    try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
    if (!idb) { if (browser) _reason = 'unavailable'; resolve(storageMode()); return; }
    var db = null, mem = null;
    _open()
      .then(function(d) { db = d; return _getAll(db); })
      .then(function(m) { mem = m; return _migrate(db, mem); })
      .then(function() {
        _db = db; _mem = mem; _backend = 'idb';
        db.onversionchange = function() { try { db.close(); } catch (e) {} };
        _askPersist();
        resolve(storageMode());
      })
      .catch(function(e) {
        console.warn('[Storage] IndexedDB unavailable, using localStorage', e);
        if (db) { try { db.close(); } catch (e2) {} }
        if (browser) _reason = 'unavailable';
        resolve(storageMode());
      });
  });
  return _initP;
}
