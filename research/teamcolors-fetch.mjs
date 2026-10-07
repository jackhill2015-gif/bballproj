// One-off: fetch ESPN's public D1 men's basketball team colors and match them
// to our ALL_TEAMS names (constants.js). Writes ../teamcolors.js.
// Run: node research/teamcolors-fetch.mjs
import { get } from 'https';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ALL_TEAMS } from '../constants.js';

var ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500';
var HERE = dirname(fileURLToPath(import.meta.url));

function fetchJson(url) {
  return new Promise(function(resolve, reject) {
    get(url, { headers: { 'User-Agent': 'hoops-os-colors/1.0' } }, function(res) {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Normalize for matching: lowercase, strip punctuation, state<->st.
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[.'’\-()]/g, '')
    .replace(/\bstate\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hand-mapped leftovers (our name -> ESPN displayName), verified below.
var HANDMAP = {
  "UNC": "North Carolina Tar Heels",
  "Miami FL": "Miami Hurricanes",
  "Boston Coll": "Boston College Eagles",
  "Cal": "California Golden Bears",
  "K-State": "Kansas State Wildcats",
  "Miss State": "Mississippi State Bulldogs",
  "Florida Atl": "Florida Atlantic Owls",
  "San Jose St": "San Jose State Spartans",
  "Loyola Chi": "Loyola Chicago Ramblers",
  "UNI": "Northern Iowa Panthers",
  "Middle Tenn": "Middle Tennessee Blue Raiders",
  "ULM": "UL Monroe Warhawks",
  "Cal Baptist": "California Baptist Lancers",
  "Abilene Chr": "Abilene Christian Wildcats",
  "Cent Michigan": "Central Michigan Chippewas",
  "St Peter's": "Saint Peter's Peacocks",
  "New Orleans": "LSU New Orleans Privateers",
  "USC Upstate": "South Carolina Upstate Spartans",
  "UNCW": "UNC Wilmington Seahawks",
  "Tennessee Martin": "UT Martin Skyhawks",
  "Southern U": "Southern Jaguars",
  "Md Eastern Shore": "Maryland Eastern Shore Hawks",
  "Albany": "UAlbany Great Danes",
  "LIU": "Long Island University Sharks",
  "Fairleigh Dick": "Fairleigh Dickinson Knights",
  "St Francis PA": "Saint Francis Red Flash",
  "CCSU": "Central Connecticut Blue Devils",
  "UCSB": "UC Santa Barbara Gauchos",
  "CSU Fullerton": "Cal State Fullerton Titans",
  "CSU Bakersfield": "Cal State Bakersfield Roadrunners",
  "Queens": "Queens Royals",
  "Eastern Ky": "Eastern Kentucky Colonels",
  "Lindenwood": "Lindenwood Lions",
  "Southern Indiana": "Southern Indiana Screaming Eagles",
  "UTRGV": "UT Rio Grande Valley Vaqueros",
  "St. Thomas (MN)": "St. Thomas Tommies"
};

// In our 2025 data but absent from ESPN's D1 endpoint (moved down or not
// listed): they get the calm neutral fallback, no failure.
var EXPECTED_MISSING = ["San Jose St", "St Francis PA", "Queens", "Lindenwood", "Southern Indiana"];
delete HANDMAP["San Jose St"];
delete HANDMAP["St Francis PA"];
delete HANDMAP["Queens"];
delete HANDMAP["Lindenwood"];
delete HANDMAP["Southern Indiana"];

var data = await fetchJson(ESPN_URL);
var espn = (data.sports[0].leagues[0].teams || []).map(function(w) { return w.team; });
console.log('ESPN teams:', espn.length);

var byLoc = {}, byShort = {}, byDisp = {};
espn.forEach(function(t) {
  byLoc[norm(t.location)] = t;
  byShort[norm(t.shortDisplayName)] = t;
  byDisp[norm(t.displayName)] = t;
});

var matched = {}, leftovers = [];
ALL_TEAMS.forEach(function(t) {
  var n = norm(t.n);
  var hit = byLoc[n] || byShort[n] || byDisp[n];
  if (hit) { matched[t.n] = hit; return; }
  var hand = HANDMAP[t.n];
  if (hand && byDisp[norm(hand)]) {
    matched[t.n] = byDisp[norm(hand)];
    console.log('HANDMAP ' + t.n + ' -> ' + matched[t.n].displayName + ' (' + matched[t.n].color + '/' + matched[t.n].alternateColor + ')');
    return;
  }
  leftovers.push(t.n + (hand ? ' [handmap missed: ' + hand + ']' : ''));
});

var unexpected = leftovers.filter(function(n) {
  return EXPECTED_MISSING.indexOf(n.split(' [')[0]) < 0;
});
console.log('Matched:', Object.keys(matched).length, '/', ALL_TEAMS.length);
console.log('Expected missing (neutral fallback):', EXPECTED_MISSING.join(', '));
if (unexpected.length) {
  console.log('UNEXPECTED UNMATCHED (' + unexpected.length + '):');
  unexpected.forEach(function(n) { console.log('  - ' + n); });
  process.exit(1);
}

function clean(hex) {
  hex = String(hex || '').replace('#', '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? '#' + hex : null;
}
var NEUTRAL = '#5c6571'; // calm grey fallback
var out = {};
Object.keys(matched).sort().forEach(function(name) {
  var t = matched[name];
  var primary = clean(t.color) || NEUTRAL;
  var secondary = clean(t.alternateColor);
  if (!secondary || secondary === primary || (primary === '#ffffff' && secondary === '#ffffff')) {
    secondary = NEUTRAL;
  }
  out[name] = [primary, secondary];
});
EXPECTED_MISSING.forEach(function(name) { out[name] = [NEUTRAL, NEUTRAL]; });

var js = '// Team colors for face jerseys, keyed by ALL_TEAMS name in constants.js.\n'
  + '// Source: ESPN\'s public team data (site.api.espn.com, mens-college-basketball/teams).\n'
  + '// If the game ever moves to fictional schools, replace this file.\n'
  + 'export const TEAM_COLORS = ' + JSON.stringify(out, null, 2) + ';\n';
writeFileSync(join(HERE, '..', 'teamcolors.js'), js);
console.log('Wrote teamcolors.js with', Object.keys(out).length, 'entries.');
