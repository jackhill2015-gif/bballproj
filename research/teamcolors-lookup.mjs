// One-off helper: find ESPN candidates for leftover names. Prints matches.
import { get } from 'https';
import { ALL_TEAMS } from '../constants.js';

var ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500';
function fetchJson(url) {
  return new Promise(function(resolve, reject) {
    get(url, { headers: { 'User-Agent': 'hoops-os-colors/1.0' } }, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve(JSON.parse(body)); });
    }).on('error', reject);
  });
}
function norm(s) {
  return String(s || '').toLowerCase().replace(/[.'’\-()]/g, '').replace(/\bstate\b/g, 'st').replace(/\s+/g, ' ').trim();
}
var leftovers = ["UNC","Miami FL","Boston Coll","Cal","K-State","Miss State","Florida Atl","San Jose St","Loyola Chi","UNI","Middle Tenn","ULM","Cal Baptist","Abilene Chr","Cent Michigan","St Peter's","New Orleans","USC Upstate","UNCW","Tennessee Martin","Southern U","Md Eastern Shore","Albany","LIU","Fairleigh Dick","St Francis PA","CCSU","UCSB","CSU Fullerton","CSU Bakersfield","Queens","Eastern Ky","Lindenwood","Southern Indiana","UTRGV","St. Thomas (MN)"];

var data = await fetchJson(ESPN_URL);
var espn = data.sports[0].leagues[0].teams.map(function(w) { return w.team; });
leftovers.forEach(function(lo) {
  var nlo = norm(lo);
  var words = nlo.split(' ');
  var cands = espn.filter(function(t) {
    var hay = norm(t.displayName + ' ' + t.shortDisplayName + ' ' + t.location + ' ' + t.abbreviation);
    return words.every(function(w) { return w.length < 3 || hay.indexOf(w) >= 0; });
  }).slice(0, 4);
  console.log(lo + '  =>  ' + cands.map(function(t) {
    return t.displayName + ' [loc:' + t.location + ' short:' + t.shortDisplayName + ' abbr:' + t.abbreviation + ' c:' + t.color + '/' + t.alternateColor + ']';
  }).join('  |  '));
});
