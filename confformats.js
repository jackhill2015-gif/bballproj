// ═══════════════════════════════════════════════════════════
//  HOOPS OS — confformats.js
//  Real conference tournament formats (2026 men's tournaments; see
//  research notes in the commit). Each format lists, round by round,
//  which seeds ENTER that round. Winners of the previous round join the
//  entering seeds and the field is paired best seed vs worst seed.
//    q      — teams that qualify (top q by conference record)
//    enter  — [[firstSeed, lastSeed], ...] per round (1-based seeds)
//    campus — 'all': higher seed hosts every game; number n: the first
//             n rounds are on campus, the rest at a neutral site;
//             absent: neutral site throughout
//    note   — one line shown on the tournament screen
//  A conference whose size doesn't match its format (or isn't listed)
//  falls back to the standard format: everyone qualifies, the bottom
//  seeds play an opening round, then a 2^n bracket.
// ═══════════════════════════════════════════════════════════

export var CONF_FORMATS = {
  'Big Ten':  { size: 18, enter: [[15, 18], [9, 14], [5, 8], [1, 4]], note: 'All 18 teams. Seeds 1-4 get three byes, 5-8 two, 9-14 one. Chicago.' },
  'ACC':      { size: 18, q: 15, enter: [[10, 15], [5, 9], [1, 4]], note: 'Top 15 of 18 qualify. Seeds 1-4 get two byes, 5-9 one. Charlotte.' },
  'Big 12':   { size: 16, enter: [[9, 16], [5, 8], [1, 4]], note: 'All 16 teams. Seeds 1-4 get two byes, 5-8 one. Kansas City.' },
  'SEC':      { size: 16, enter: [[9, 16], [5, 8], [1, 4]], note: 'All 16 teams. Seeds 1-4 get two byes, 5-8 one. Nashville.' },
  'Big East': { size: 11, enter: [[6, 11], [1, 5]], note: 'All 11 teams. Seeds 1-5 get a bye. Madison Square Garden.' },
  'A-10':     { size: 14, enter: [[11, 14], [5, 10], [1, 4]], note: 'All 14 teams. Seeds 1-4 get two byes, 5-10 one. Pittsburgh.' },
  'American': { size: 13, q: 10, enter: [[7, 10], [5, 6], [3, 4], [1, 2]], note: 'Top 10 qualify. Stepladder: two seeds join each round, 1 and 2 enter in the semifinals.' },
  'MW':       { size: 12, enter: [[5, 12], [1, 4]], note: 'All 12 teams. Seeds 1-4 get a bye. Las Vegas.' },
  'WCC':      { size: 10, enter: [[7, 10], [5, 6], [3, 4], [1, 2]], note: 'Stepladder: two seeds join each round, 1 and 2 enter in the semifinals. Las Vegas.' },
  'MVC':      { size: 11, enter: [[6, 11], [1, 5]], note: 'All 11 teams. Seeds 1-5 get a bye. St. Louis.' },
  'CAA':      { size: 13, enter: [[12, 13], [5, 11], [1, 4]], note: 'All 13 teams. Seeds 1-4 get two byes, 5-11 one. Washington, D.C.' },
  'CUSA':     { size: 12, q: 10, enter: [[7, 10], [1, 6]], note: 'Top 10 qualify. Seeds 1-6 get a bye. Huntsville.' },
  'MAC':      { size: 13, q: 8, enter: [[1, 8]], note: 'Top 8 qualify, no byes. Cleveland.' },
  'Sun Belt': { size: 14, enter: [[11, 14], [9, 10], [7, 8], [5, 6], [3, 4], [1, 2]], note: 'All 14 teams. Stepladder: two seeds join each round, 1 and 2 enter in the semifinals. Pensacola.' },
  'WAC':      { size: 7, enter: [[6, 7], [3, 5], [1, 2]], note: 'All 7 teams. Seeds 1 and 2 go straight to the semifinals. Las Vegas.' },
  'Big West': { size: 11, q: 8, enter: [[5, 8], [3, 4], [1, 2]], note: 'Top 8 qualify. Stepladder: 1 and 2 enter in the semifinals. Henderson, Nev.' },
  'Horizon':  { size: 11, enter: [[6, 11], [1, 5]], campus: 1, note: 'All 11 teams. Opening round at the higher seed, then Indianapolis.' },
  'Summit':   { size: 9, enter: [[8, 9], [1, 7]], note: 'All 9 teams. Seeds 1-7 get a bye. Sioux Falls.' },
  'Southland':{ size: 12, q: 8, enter: [[5, 8], [3, 4], [1, 2]], note: 'Top 8 qualify. Stepladder: 1 and 2 enter in the semifinals. Lake Charles.' },
  'SWAC':     { size: 12, enter: [[9, 12], [7, 8], [1, 6]], note: 'All 12 teams. Seeds 1-6 get two byes, 7-8 one. Atlanta.' },
  'MEAC':     { size: 8, q: 7, enter: [[2, 7], [1, 1]], note: 'Top 7 qualify. The 1 seed goes straight to the semifinals. Norfolk.' },
  'OVC':      { size: 11, q: 8, enter: [[5, 8], [3, 4], [1, 2]], note: 'Top 8 qualify. Stepladder: 1 and 2 enter in the semifinals. Evansville.' },
  'Big Sky':  { size: 10, enter: [[7, 10], [1, 6]], note: 'All 10 teams. Seeds 1-6 get a bye. Boise.' },
  'Big South':{ size: 9, enter: [[8, 9], [1, 7]], note: 'All 9 teams. Seeds 1-7 get a bye. Johnson City.' },
  'SoCon':    { size: 10, enter: [[7, 10], [1, 6]], note: 'All 10 teams. Seeds 1-6 get a bye. Asheville.' },
  'Patriot':  { size: 10, enter: [[7, 10], [1, 6]], campus: 'all', note: 'All 10 teams. Seeds 1-6 get a bye. Every game, final included, at the higher seed.' },
  'America East': { size: 9, q: 8, enter: [[1, 8]], campus: 'all', note: 'Top 8 qualify, no byes. Every game at the higher seed.' },
  'NEC':      { size: 10, q: 8, enter: [[1, 8]], campus: 'all', note: 'Top 8 qualify, no byes. Every game at the higher seed.' },
  'MAAC':     { size: 13, q: 10, enter: [[7, 10], [1, 6]], note: 'Top 10 qualify. Seeds 1-6 get a bye. Atlantic City.' },
  'ASUN':     { size: 12, enter: [[5, 12], [1, 4]], note: 'All 12 teams. Seeds 1-4 get a bye. Jacksonville.' },
  'Ivy':      { size: 8, q: 4, enter: [[1, 4]], note: 'Top 4 only. Semifinals and final.' },
  'Pac-12':   { size: 2, enter: [[1, 2]], note: 'Two members this season: one game for the automatic bid.' }
};

// Standard format for any size: bottom seeds play an opening round,
// the rest get a bye into a 2^n bracket
export function standardFormat(n) {
  var P = 1; while (P * 2 <= n) P *= 2;
  if (P === n) return { q: n, enter: [[1, n]] };
  var games = n - P;
  return { q: n, enter: [[n - 2 * games + 1, n], [1, n - 2 * games]] };
}

// The format a conference uses this season, checked so every round pairs up
export function formatFor(conf, n) {
  var f = CONF_FORMATS[conf];
  if (f && f.size === n && validFormat(f.q || n, f.enter)) return { q: f.q || n, enter: f.enter, campus: f.campus || null, note: f.note || '' };
  var s = standardFormat(n);
  return { q: s.q, enter: s.enter, campus: null, note: 'All ' + n + ' teams.' };
}

// How many rounds a format plays (Big Ten: 6)
export function roundsIn(fmt) {
  var alive = 0, r = 0;
  for (; r < fmt.enter.length; r++) { alive = (alive + fmt.enter[r][1] - fmt.enter[r][0] + 1) / 2; }
  while (alive > 1) { alive /= 2; r++; }
  return r;
}

// Every seed 1..q enters exactly once and every round has an even field
export function validFormat(q, enter) {
  var seen = {}, alive = 0;
  for (var r = 0; r < enter.length; r++) {
    for (var s = enter[r][0]; s <= enter[r][1]; s++) { if (seen[s]) return false; seen[s] = true; alive++; }
    if (alive % 2) return false;
    alive /= 2;
  }
  for (var k = 1; k <= q; k++) if (!seen[k]) return false;
  while (alive > 1) { if (alive % 2) return false; alive /= 2; }
  return alive === 1;
}
