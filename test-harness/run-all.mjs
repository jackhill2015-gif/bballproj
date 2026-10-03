// run-all.mjs — runs the whole test-harness suite and prints a one-line
// pass/fail summary per file. Run from anywhere:
//   node test-harness/run-all.mjs
// Covers every *-test.mjs plus harness.mjs, mfixes.mjs and
// feature-tourney-home.mjs.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 180000;

const files = readdirSync(DIR)
  .filter(f => f.endsWith('-test.mjs'))
  .concat(['harness.mjs', 'mfixes.mjs', 'feature-tourney-home.mjs'])
  .filter((f, i, a) => a.indexOf(f) === i)
  .sort();

let pass = 0, fail = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(DIR, f)], {
    timeout: TIMEOUT_MS, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  if (ok) { pass++; console.log('PASS ' + f); }
  else {
    fail++;
    const reason = r.error ? 'error: ' + r.error.message : 'exit ' + r.status;
    const tail = ((r.stderr || r.stdout || '').trim().split('\n').pop() || '').slice(0, 120);
    console.log('FAIL ' + f + ' (' + reason + ')' + (tail ? ' — ' + tail : ''));
  }
}
console.log('---');
console.log(files.length + ' files: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
