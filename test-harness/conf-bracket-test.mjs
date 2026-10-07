// Conference tournaments follow each league's real format (confformats.js):
// right number of qualifiers, byes only by seed, every winner advances,
// champion plays every round from the one it enters
import { G, S, T, U, newDynasty, runRegSeason, runConfTourneys } from './season-lib.mjs';
const CF = await import('../confformats.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
check(Object.keys(CF.CONF_FORMATS).every(c => { const f = CF.CONF_FORMATS[c]; return CF.validFormat(f.q || f.size, f.enter); }), 'every listed format pairs up cleanly');
S.buildUniverse(); newDynasty(10); U.fixMins(G.teams[G.tid].rost); runRegSeason(); runConfTourneys();
let bad = [];
Object.keys(G.confTourneys).forEach(conf => {
  const ct = G.confTourneys[conf], f = ct.fmt, n = ct.seeds.length;
  const played = {}, lost = {};
  ct.rounds.forEach((rd, ri) => rd.forEach(m => {
    [m.t1, m.t2].forEach(t => { (played[t.id] = played[t.id] || []).push(ri); });
    const loser = m.winner === m.t1 ? m.t2 : m.t1;
    if (lost[m.winner.id]) bad.push(conf + ': a team that lost played on');
    lost[loser.id] = true;
  }));
  for (let r = 1; r < ct.rounds.length; r++) {
    const inRound = new Set(ct.rounds[r].flatMap(m => [m.t1.id, m.t2.id]));
    ct.rounds[r - 1].forEach(m => { if (!inRound.has(m.winner.id)) bad.push(conf + ': a round ' + r + ' winner was skipped'); });
  }
  const total = ct.rounds.reduce((a, rd) => a + rd.length, 0);
  if (total !== f.q - 1) bad.push(conf + ': ' + total + ' games for ' + f.q + ' qualifiers');
  const qualifiers = new Set(Object.keys(played).map(Number));
  ct.seeds.forEach((t, i) => { if ((i < f.q) !== qualifiers.has(t.id)) bad.push(conf + ': seed ' + (i + 1) + (i < f.q ? ' did not play' : ' should not qualify')); });
  const cr = played[ct.champ.id];
  for (let k = 1; k < cr.length; k++) if (cr[k] !== cr[k - 1] + 1) bad.push(conf + ': champion skipped a round after entering');
  if (cr[cr.length - 1] !== ct.rounds.length - 1) bad.push(conf + ': champion did not play the final');
});
const fq = c => G.confTourneys[c] && G.confTourneys[c].fmt.q;
check(bad.length === 0, 'all ' + Object.keys(G.confTourneys).length + ' conference tournaments valid' + (bad.length ? ' — ' + bad.slice(0, 5).join('; ') : ''));
check(fq('ACC') === 15 && fq('Big Ten') === 18 && fq('SEC') === 16 && fq('Ivy') === 4 && fq('MAC') === 8, 'real qualifier counts (ACC 15, Big Ten 18, SEC 16, Ivy 4, MAC 8)');
const bt = G.confTourneys['Big Ten'];
check(bt.rounds[0].length === 2 && bt.rounds.length === 6, 'Big Ten: 2 opening games, six rounds (top 4 seeds get three byes)');
const pat = G.confTourneys['Patriot'];
check(pat.rounds.every(rd => rd.every(m => m.campus)) && G.confTourneys['SEC'].rounds.every(rd => rd.every(m => !m.campus)), 'Patriot games on campus, SEC neutral');
// format survives a save/reload mid-tournament
const ST = await import('../state.js');
S.buildUniverse(); newDynasty(12); U.fixMins(G.teams[G.tid].rost); runRegSeason();
T.advanceConfTourney && (T.getUserConfMatchup() ? T.playTournamentGame(false) : T.advanceConfTourney());
ST.saveStateNow(); ST.loadState();
check(Object.values(G.confTourneys).every(ct => ct.fmt && ct.fmt.enter), 'formats survive a save and reload mid-tournament');
runConfTourneys();
check(G.confTourneys['ACC'].rounds.reduce((a, r) => a + r.length, 0) === 14, 'ACC still plays 14 games (15 teams) after the reload');
console.log(fails ? fails + ' FAILED' : 'all conference tournament checks passed');
process.exit(fails ? 1 : 0);
