// Builds dist/ with only the files players need (the list in sw.js
// APP_FILES, plus vendor licenses). Notes, research, tests and the
// handoff board stay out of the public site.
//   node tools/build.mjs        → dist/
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'dist');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const list = sw.slice(sw.indexOf('APP_FILES'), sw.indexOf('];', sw.indexOf('APP_FILES')));
const files = [...list.matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(f => f !== './');
files.push('sw.js');
(function walk(dir) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = dir + '/' + f;
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
    else if (/license|notice/i.test(f) && !files.includes(rel)) files.push(rel);
  }
})('vendor');

fs.rmSync(OUT, { recursive: true, force: true });
let n = 0;
for (const f of files) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.error('missing: ' + f); process.exitCode = 1; continue; }
  const dst = path.join(OUT, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  n++;
}
console.log('dist/: ' + n + ' files');
