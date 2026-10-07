// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/ui-prefs.js
//  Remember-view-settings store. UI-only preferences (portal filters,
//  recruiting filters, stats category, rankings tab, bracket region).
//  Everything lives under ONE localStorage key ("hoops_os_ui") and is
//  completely separate from the game save. Every read and write is
//  try/catch wrapped (private-mode browsers throw); on any failure the
//  module silently falls back to in-memory defaults. Stored values are
//  validated on read: a stale or unknown value is ignored and the
//  default is used for that field.
// ═══════════════════════════════════════════════════════════

var KEY = 'hoops_os_ui';

var POS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
var FIT = ['all', 'start', 'rot', 'need'];
var PORTAL_TIERS = ['all', 'a', 'b', 'c', 'd', 'e'];
var PORTAL_SORTS = ['ovr', 'pot', 'odds', 'ask', 'name', 'pos', 'offer', 'from'];
var RECRUIT_SORTS = ['rank', 'ovr', 'pot', 'stars', 'name', 'pos'];
var STAT_CATS = ['poy', 'ppg', 'rpg', 'apg', 'fg', 'spg', 'bpg'];

var DEFAULTS = {
  portal: { pos: 'All', tier: 'all', mine: false, fit: 'all', sort: 'ovr', dir: -1 },
  recruiting: { pos: 'All', stars: 0, sort: 'rank', dir: 1, near: false, targets: false, fit: 'all' },
  stats: { category: 'poy' },
  rankings: { tab: 'nat', conf: null },
  bracket: { region: null }
};

function oneOf(v, list, dflt) { return list.indexOf(v) >= 0 ? v : dflt; }
function bool(v, dflt) { return typeof v === 'boolean' ? v : dflt; }
function dir(v, dflt) { return v === 1 || v === -1 ? v : dflt; }

function validateSection(name, raw) {
  raw = (raw && typeof raw === 'object') ? raw : {};
  var d = DEFAULTS[name], o = {};
  if (name === 'portal') {
    o.pos = oneOf(raw.pos, POS, d.pos);
    o.tier = oneOf(raw.tier, PORTAL_TIERS, d.tier);
    o.mine = bool(raw.mine, d.mine);
    o.fit = oneOf(raw.fit, FIT, d.fit);
    o.sort = oneOf(raw.sort, PORTAL_SORTS, d.sort);
    o.dir = dir(raw.dir, d.dir);
  } else if (name === 'recruiting') {
    o.pos = oneOf(raw.pos, POS, d.pos);
    o.stars = (typeof raw.stars === 'number' && raw.stars >= 0 && raw.stars <= 5) ? Math.floor(raw.stars) : d.stars;
    o.sort = oneOf(raw.sort, RECRUIT_SORTS, d.sort);
    o.dir = dir(raw.dir, d.dir);
    o.near = bool(raw.near, d.near);
    o.targets = bool(raw.targets, d.targets);
    o.fit = oneOf(raw.fit, FIT, d.fit);
  } else if (name === 'stats') {
    o.category = oneOf(raw.category, STAT_CATS, d.category);
  } else if (name === 'rankings') {
    o.tab = oneOf(raw.tab, ['nat', 'conf'], d.tab);
    o.conf = (typeof raw.conf === 'string' && raw.conf) ? raw.conf : null;
  } else if (name === 'bracket') {
    o.region = (raw.region === null || raw.region === 'ff' || raw.region === 'open' ||
      (typeof raw.region === 'number' && raw.region >= 0 && raw.region <= 3)) ? raw.region : d.region;
  }
  return o;
}

// Read once per page load; then serve from memory.
var _cache = null;
function loadCache() {
  if (_cache) return _cache;
  _cache = {};
  var raw = null;
  try {
    var s = window.localStorage.getItem(KEY);
    raw = s ? JSON.parse(s) : null;
  } catch (e) { raw = null; }
  Object.keys(DEFAULTS).forEach(function(name) {
    _cache[name] = validateSection(name, raw && raw[name]);
  });
  return _cache;
}

function writeCache() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(_cache));
  } catch (e) { /* private mode etc.: keep in-memory copy only */ }
}

// Read a section's prefs (validated, defaults merged).
export function getUiPrefs(section) {
  var c = loadCache();
  if (!DEFAULTS.hasOwnProperty(section)) return {};
  var copy = {};
  Object.keys(DEFAULTS[section]).forEach(function(k) { copy[k] = c[section][k]; });
  return copy;
}

// Merge values into a section and write through.
export function setUiPrefs(section, values) {
  if (!DEFAULTS.hasOwnProperty(section) || !values || typeof values !== 'object') return;
  var c = loadCache();
  var merged = {};
  Object.keys(DEFAULTS[section]).forEach(function(k) {
    merged[k] = values.hasOwnProperty(k) ? values[k] : c[section][k];
  });
  c[section] = validateSection(section, merged);
  writeCache();
}
