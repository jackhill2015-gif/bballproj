// Minimal in-memory IndexedDB for node tests: just what storage.js uses
// (open + upgrade, one object store, get/put/delete, transaction events).
// Databases live in `dbs` so a second open (a "reload") sees the same data.
// Knobs: failOpen (open errors), failWrites (write transactions abort),
// corruptReads (get returns a changed value).
export function installIDB(opts = {}) {
  const dbs = opts.dbs || new Map();
  const later = fn => setTimeout(fn, 0);
  function makeDB(rec) {
    const db = {
      objectStoreNames: { contains: n => rec.stores.has(n) },
      createObjectStore(n) { rec.stores.set(n, new Map()); },
      close() {},
      transaction(name, mode) {
        const store = rec.stores.get(name);
        if (!store) throw new Error('NotFoundError');
        const ops = [];
        const tx = { error: null, oncomplete: null, onerror: null, onabort: null,
          objectStore() {
            const req = () => ({ result: undefined, onsuccess: null });
            return {
              get(k) { const r = req(); ops.push(() => { let v = store.get(k); if (opts.corruptReads && typeof v === 'string') v = v + ' '; r.result = v; r.onsuccess && r.onsuccess(); }); return r; },
              put(v, k) { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); const r = req(); ops.push(() => { store.set(k, v); r.onsuccess && r.onsuccess(); }); return r; },
              delete(k) { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); const r = req(); ops.push(() => { store.delete(k); r.onsuccess && r.onsuccess(); }); return r; },
            };
          },
        };
        later(() => {
          if (mode === 'readwrite' && opts.failWrites) { tx.error = new Error('QuotaExceededError'); tx.onabort && tx.onabort(); return; }
          ops.forEach(f => f());
          tx.oncomplete && tx.oncomplete();
        });
        return tx;
      },
    };
    return db;
  }
  globalThis.indexedDB = {
    open(name, ver) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      later(() => {
        if (opts.failOpen) { req.error = new Error('InvalidStateError'); req.onerror && req.onerror(); return; }
        let rec = dbs.get(name);
        const fresh = !rec || rec.version < ver;
        if (!rec) { rec = { version: ver, stores: new Map() }; dbs.set(name, rec); }
        rec.version = ver;
        req.result = makeDB(rec);
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
  return dbs;
}
export function removeIDB() { delete globalThis.indexedDB; }
