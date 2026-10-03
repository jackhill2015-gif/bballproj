// Every game file must be in the service worker's offline list, or the
// installed app breaks with no signal after the next deploy.
import fs from 'fs';
import { REPO } from './shim.mjs';
const sw = fs.readFileSync(REPO + '/sw.js', 'utf8');
const listed = new Set([...sw.matchAll(/"([^"]+)"/g)].map(m => m[1]));
const need = ['index.html', 'style.css', 'manifest.webmanifest']
  .concat(fs.readdirSync(REPO).filter(f => f.endsWith('.js') && f !== 'sw.js'))
  .concat(fs.readdirSync(REPO + '/views').filter(f => f.endsWith('.js')).map(f => 'views/' + f))
  .concat(fs.readdirSync(REPO + '/icons').map(f => 'icons/' + f));
const missing = need.filter(f => !listed.has(f));
const stale = [...listed].filter(f => f !== './' && !fs.existsSync(REPO + '/' + f));
if (missing.length || stale.length) {
  console.log('FAIL offline list out of date. Missing: ' + (missing.join(', ') || 'none') + '. Listed but gone: ' + (stale.join(', ') || 'none'));
  process.exit(1);
}
console.log('ALL PASS (' + need.length + ' files cached for offline)');
