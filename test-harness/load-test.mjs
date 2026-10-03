// Smoke test: the whole app (main.js and every view) loads without errors.
// Catches broken imports/exports that unit tests on single modules miss.
import { REPO } from './shim.mjs';
try { await import(REPO + '/main.js'); console.log('ALL PASS (main.js loaded)'); process.exit(0); }
catch (e) { console.log('FAIL main.js did not load: ' + e.message); process.exit(1); }
