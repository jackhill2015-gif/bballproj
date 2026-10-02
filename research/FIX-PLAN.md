# HOOPS OS — Consolidated Fix Plan
Derived from 7 audits: UI/responsive, recruiting/carousel, sim engine, season flow, game feel, execution bug-hunt (node harness), performance. Plus 2 research tracks (Basketball GM, Campus Dynasty deep-dive) feeding the UI rebuild.

## P0 — Data integrity (fix now, before UI rebuild)

### Season / schedule / state (season.js, state.js, constants.js, views/standings.js)
- S1: `recordResult` (season.js:345-382) must mirror the result onto the OPPONENT's schedule entry. Observed: 0/30 opponent entries vs user ever marked played → wins+losses ≠ games played for ~80 teams/season.
- S2: `buildSchedules` force-fill (season.js:134-137) must write BOTH sides of a matchup. Observed 130 one-sided entries → phantom extra results.
- S3: `setupUserOOC` mutual path is dead; force fallback (season.js:199-207) creates one-sided OOC games. Make OOC scheduling mutual or don't create the game.
- S4: `swapOOC` (season.js:217-228) must update both sides and handle the orphaned old opponent.
- S5: Dedupe ALL_TEAMS (constants.js): 332 entries, 324 unique. SMU, Hawaii, James Madison, UMKC, Stony Brook, Bellarmine, Austin Peay, Mercer each appear in TWO conferences. Also fix the "364 programs" claim everywhere.
- S6: Standings sort by win PCT, not raw wins (views/standings.js:74; conf-tourney seeding tournament.js~75). Delete dead root standings.js (not imported anywhere).
- S7: `recordSeasonHistory` must use `G.seasonAchievements.tourneyFinish` (season.js:587,611). Currently every non-champion is recorded "Runner-Up".
- S8: Wire skill-point achievement flags (confTitleThisYear, madeNCAA, sweet16, finalFour, champGame, natChamp). `endSeason` (season.js:620-625) reads them; nothing sets them → most skill points unwinnable.
- S9: Persist `G.prestige` in saveState/loadState (state.js); init it on the continue path `loadAndPlay` (views/setup.js:48-55). Currently NaN after continue → prestige stars permanently empty.
- S10: Slim saveState payload: serialize `bracket`/`confTourneys` as team IDs + rehydrate on load (currently embeds full team objects → 3.4MB saves); don't persist finalized `G.recruits`. Make saveState internally debounced (trailing ~1s) + expose saveStateNow() for checkpoints.

### Tournament (tournament.js)
- T1: Proper NCAA bracket seeding/mapping (1v16, 8v9…). Currently #1 plays #2 in Round 1 every year (tournament.js:319,493,507,143).
- T2: Bracket display must match simmed games (tournament.js:422 vs 350 — two inconsistent wrong models).
- T3: Odd survivor counts need byes in `buildNextConfRound` (tournament.js:108). 23/30 conferences silently drop a team per round.
- T4: Fix "32 automatic bids" text → 30 auto + 34 at-large (tournament.js:355).
- T5: Remove dead exports `simConfBtn`, `showRecap` or wire them up.

### Sim engine (simulation.js, utils.js, ui.js skipGame)
- M1: GP double-count for user games (simulation.js:315-316 + season.js:372-374). Remove one → user-team per-game averages currently halved.
- M2: Difficulty (`dm`) must NOT leak into CPU-vs-CPU games (simulation.js:296-298). Gate on user involvement.
- M3: User coach bonuses must NOT apply to CPU games (simulation.js:503-508). Gate on user involvement.
- M4: `skipGame` (ui.js:352-362) must snapshot/restore FULL stat objects, not just gp — currently double-counts all stats.
- M5: Live-sim putback must credit the FGA with the FGM (simulation.js~277-281) — currently inflates FG%.
- M6: Phantom points: credit press-turnover +2s and OT tiebreak to a player, or remove (simulation.js~353-357,~510).
- M7: Key minutes/fatigue/fouls by player identity, not name (simulation.js:321,328,513-514) — duplicate names scramble.
- M8: Wire `G.nextHomeBonus` (sellout crowd, events.js:159) into the sim, or remove the event.
- M9: Delete empty `distributeStats` + its calls (simulation.js:518-519, season.js:323-324). Optional: extend `freshS()` with 3PM/3PA, FTM/FTA, TO.
- M10: Rebalance guard vs big scoring if cheap (currently C 15.1 / PG 8.2 ppg on base-82 team — post play type funnels too much inside).

### Recruiting / carousel / portal (views/recruiting.js, views/setup.js, views/roster.js, season.js offseason 733+)
- R1: `r.signed` must store team id, not net rank (recruiting.js:188) — can wrongly add other schools' recruits to user roster.
- R2: CPU-signed recruits must JOIN CPU rosters (season.js:800-832 currently fills with walk-ons; signees vanish).
- R3: Rejected-jobs must hide by stable job id, not render index (recruiting.js:542-567,612).
- R4: Fired coach cannot "stay" — `stayAtSchool` must check fired state (recruiting.js:584,736; season.js:706-713).
- R5: Cap recruiting board at 30 rendered rows (recruiting.js:777 add .slice + pagination/"show more").
- R6: Enforce class-size cap in `doOffseason` (currently display-only).
- R7: Persist `_skillInitial` or re-derive on load (recruiting.js:456).
- R8: Roster slider must not silently drop minutes (views/roster.js:200).
- R9: NEW — Transfer portal: add `G.offseasonStep='portal'` between turnover and recruiting. Entrants drawn from low-minute/unhappy returners (mirrors events.js:260). Portal pickups fill roster gaps BEFORE walk-ons in `doOffseason`. Hook points: `proceedToRecruiting` (recruiting.js:199), `renderOffseason` router (recruiting.js:232), `doPlay` offseason router (season.js:474-493), `doOffseason` (season.js:761-798). Keep portal LOGIC separate from rendering (dedicated section or new file `views/portal.js`) so the UI rebuild can re-skin it.

### Dead code to remove
COM.run (constants.js), RECRUIT_PRESTIGE_GATES (constants.js), fmtR/pct/ord (utils.js), SKILL_POINT_TABLE import (season.js:7), root standings.js, dead exports simConfBtn/showRecap.

## P1 — Performance (data-layer now; view-layer REQUIRED in UI rebuild spec)
- saveState debounce + slim payload (S10) — do now in state.js.
- View-layer (for UI rebuild agent): cap lists at ~30 w/ pagination, in-place DOM updates (no full re-render per click), single render path (no double renders), O(1) log prepend w/ cap, batched auto-sim (no per-tick save/render), yield before heavy sim on click, cache derived leaders per week, batch renderLog, toast queue, event delegation.

## P2 — Game feel (implement WITH the UI rebuild; ranked by impact/effort)
1. NIL currency (`G.pts`) spendable weekly boost shop on dashboard (display balance in topbar).
2. Weekly in-season recruiting decision (small point budget per week).
3. Timeouts in live sim (3/game, kills opponent momentum).
4. Coach XP/level: XP per win/upset/title, visible XP bar, level-up perks.
5. Rank-movement arrows + poll history (G.rankHistory[]).
6. Mid-season award races panel (POY watch, user's players in stat races).
7. Milestone toasts + small rewards (win #100, ranked win, streaks, clinching).
8. Narrated game recaps in log (top scorer, key run, bubble context).
9. Rivalries: 1-2 persistent rivals/team, flagged games, stakes.
10. Record book + coaching milestones on history page.
11. Weekly briefing card after advanceWeek (rank move, scout note, headline, recruiting nudge).
12. Decision-based events (portal threat → promise minutes / let walk; etc.).
13. Visible offseason development report (+N arrows per returner).

## Regression checks (must stay true after every change)
- Full season sim: all 332 teams, wins+losses == games played for EVERY team.
- NCAA: 64 unique teams, correct 1v16-style seeding, exactly one champion.
- No NaN/undefined/Infinity in any score, stat, or rating (node harness: ~/workspace/bballproj/test-harness/harness.mjs).
- Conf tournaments: teams-1 games per conference (byes for odd counts).
- Save/load roundtrip preserves prestige, phase, and standings.
