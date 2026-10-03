// Postseason games count in overall W-L: every team's wins+losses equals
// regular-season games + tournament games it played; conference W-L doesn't move.
import { G, newDynasty, runRegSeason, runConfTourneys, runNCAA } from './season-lib.mjs';
let fails = 0; const check = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) fails++; };
newDynasty(5); runRegSeason();
const reg = G.teams.map(t => ({ w: t.wins, l: t.loss, cw: t.cWins, cl: t.cLoss }));
runConfTourneys(); runNCAA();
const extra = G.teams.map(() => ({ w: 0, l: 0 }));
for (const c of Object.values(G.confTourneys)) for (const rd of c.rounds) for (const m of rd) {
  if (!m.winner) continue; const lo = m.winner === m.t1 ? m.t2 : m.t1;
  extra[m.winner.id].w++; extra[lo.id].l++;
}
// NCAA: count games from bracket progression (each eliminated team lost once; winners won rounds)
const champ = G.bracket.find(b => b.active);
let bad = 0;
G.teams.forEach((t, i) => {
  if (t.cWins !== reg[i].cw || t.cLoss !== reg[i].cl) bad++;
  const w = t.wins - reg[i].w - extra[i].w, l = t.loss - reg[i].l - extra[i].l;
  const inField = G.bracket.some(b => b.team.id === t.id);
  if (!inField && (w || l)) bad++;
  if (inField) { const isChamp = champ && champ.team.id === t.id; if (l !== (isChamp ? 0 : 1)) bad++; if (w < 0 || w > 6) bad++; }
});
check(bad === 0, 'every team: overall W-L = regular season + conf tourney + NCAA games; conf W-L unchanged (bad=' + bad + ')');
const ch = champ.team; check(ch.wins - reg[ch.id].w - extra[ch.id].w === 6, 'champion credited 6 NCAA wins');
console.log(fails ? fails + ' FAILURES' : 'ALL PASS'); process.exit(fails ? 1 : 0);
