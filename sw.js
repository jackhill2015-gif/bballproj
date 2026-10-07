// ═══════════════════════════════════════════════════════════
//  HOOPS OS — sw.js (offline support)
//  Network first: online you always get the newest version from GitHub
//  Pages; offline (or on a stalled connection) the last copy is used.
//  Keep APP_FILES in sync with the repo — test-harness/offline-test.mjs
//  fails if a game file is missing from this list.
// ═══════════════════════════════════════════════════════════

var CACHE = 'hoops-os-v16';
var APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "backup.js",
  "confformats.js",
  "constants.js",
  "events.js",
  "facilities.js",
  "finance.js",
  "goals.js",
  "main.js",
  "morale.js",
  "ratings.js",
  "records.js",
  "season.js",
  "simulation.js",
  "state.js",
  "tournament.js",
  "ui.js",
  "utils.js",
  "views/acq.js",
  "views/battle.js",
  "views/bracket.js",
  "views/dashboard.js",
  "views/devreport.js",
  "views/help.js",
  "views/history.js",
  "views/player.js",
  "views/portal.js",
  "views/recap.js",
  "views/recruiting.js",
  "views/retention.js",
  "views/roster.js",
  "views/scouting.js",
  "views/signings.js",
  "views/schedule.js",
  "views/setup.js",
  "views/sheet.js",
  "views/standings.js",
  "views/stats.js",
  "views/strategy.js",
  "views/team.js",
  "views/trophies.js",
  "views/ui-prefs.js",
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(APP_FILES); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !font) return;
  e.respondWith(networkFirst(req));
});

function networkFirst(req) {
  return new Promise(function(resolve) {
    var done = false;
    var fromCache = function() {
      return caches.match(req, { ignoreSearch: true }).then(function(hit) { return hit || caches.match('index.html'); });
    };
    // A stalled connection shouldn't hang the game. Only the page itself
    // falls back quickly; game files wait longer, because mixing new files
    // with old cached ones breaks the game (a file asks for something the
    // other version doesn't have).
    var wait = req.mode === 'navigate' ? 3000 : 10000;
    var timer = setTimeout(function() {
      fromCache().then(function(hit) { if (hit && !done) { done = true; resolve(hit); } });
    }, wait);
    // 'no-cache' checks every file with the server, so a fresh deploy never
    // mixes with the browser's stored copies (GitHub Pages lets browsers
    // keep files for 10 minutes otherwise)
    var sameOrigin = new URL(req.url).origin === self.location.origin;
    fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined).then(function(res) {
      clearTimeout(timer);
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(req, copy); });
      }
      if (!done) { done = true; resolve(res); }
    }).catch(function() {
      clearTimeout(timer);
      fromCache().then(function(hit) { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  });
}
