# Player development

Two parts (HANDOFF.md, Up next item 0). Part 1, the recruit pool and CPU rosters, is done. Part 2 (growth, hidden potential, development coach) waits for Jack.

Numbers below use the program-strength prestige blend (research/program-strength, applied just before this re-check). The pre-blend run is noted where it differs.

Measure with `node test-harness/player-dev.mjs [seasons=8]`. It plays a full dynasty on the real modules: every offseason runs the user's departures, portal, recruiting and signing day the way the game does, with a simple auto-coach for the user's school. The fast version is `player-dev-test.mjs` (4 seasons, in run-all). The shared code is in `player-dev-lib.mjs`; part 2 will add its targets to the same script.

## Part 1: recruit pool and CPU rosters

### What was wrong (main before this change, 8 seasons)

- 400 recruits a year (10/40/100/150/100 by stars) for 365 schools, while about 1,090-1,250 players left each year (seniors plus about 45 early draft picks).
- About 340 recruits a year reached rosters. CPU schools were refilled to 10 with about 620 generated freshmen a year (up to 800) at the school's fixed base level, so CPU programs kept snapping back to their base.
- CPU rosters fell from 13 to about 10.7 (only 10-17% of schools had 13-15).
- The one-year shortfall echoed: a class of about 550 next to classes of about 1,100-1,200, moving up one year each season (freshmen 8% of minutes, then sophomores 11%, juniors 13%, seniors 15%), then back again.

### What changed

- **Pool** (`recruitpool.js`): about 4.2 recruits per school (1,533 for 365). 3.6 per school are drawn at the level of a real school, pulled 15% toward the middle (the best recruits now go to the best programs, which would otherwise widen the gap between them), plus a tail of recruits at the level of the weakest quarter so every school can fill its class. Stars by national rank: 25 five-stars, 110 four-stars, 330 three-stars, 520 two-stars, the rest one-star. If schools need more than usual (an old save with short rosters), the pool grows to 15% over the total need.
- **Recruiting pull** orders programs for recruiting: half current strength (the ranking score), half school prestige, plus a yearly recruiting form per school (a good or bad year, 0.35 standard scores, fixed for the offseason). **Rival schools** for each recruit are programs near his level by pull (a recruit who usually lands at the #40 program hears from about #18-#72), so winning and prestige both pull the best players. A blueblood's down year costs it some recruits but not its place, and a rising school climbs as it wins. Without the prestige half, bluebloods fell to 58% of preseason polls (real 85%). Without the yearly form, programs barely moved (69 moved 40+ places in 7 years, team strength vs base level r = 0.95) and preseason polls were too sticky. The form trades two poll stats against each other: more form pushes ranked 16-25 teams out of the poll after a split week more often (0.4: about 28%, band edge 28.1), less makes the preseason Top 25 too sticky (0.3: about 73%, band edge 72.6). 0.35 sits inside both.
- **CPU classes**: a school signs only while it has room. Its class size is halfway between what it loses and an even class (target / 4), and its roster always ends at 13-15 (the target is 13, 14 or 15, varying by school and year). Early signings and signing day go to the suitor with room; if none of his suitors has room, he signs with the nearest program at his level that does. Schools still short after signing day, or after the portal, sign recruits nobody took. A generated freshman is the last resort.
- **Class balance**: if next season's returning classes are uneven (under 85% of an even class), CPU schools add junior college transfers in the thin classes, at about their returners' level. This does nothing in a normal league; it is there for saves made before this change, which carry the echo.
- **Starting rosters** are 13-15 (was 13 for everyone), the size schools keep, so the first offseason doesn't create one big freshman class. The 14th and 15th players are end-of-bench level (6 below the school), so the rotation is as before (sim-feel's star share needed it).
- **No pool during the season.** The class is generated when recruiting opens (it always was regenerated there; the in-season copy went unused). In the save the pool is packed like the rosters: 163 KB for 1,533 recruits (unpacked it would be 780 KB).
- **Board**: Within reach lists the best prospects you can land, up to 40 plus 10 per open spot, in your chosen sort; anyone you pursue always shows; Show everyone lists the whole class.
- **Bug fixed on the way**: the "rival commits" event stored a whole school object as the recruit's team.

### Before and after (8 seasons; seasons 2-8 averaged where it says so)

| | Main | Now |
|---|---|---|
| Recruit pool per year | 400 | 1,535 |
| Players leaving per year | 1,087 | 1,304 |
| Recruits joining rosters per year | 339 | 1,303 |
| Generated top-up freshmen per year | 622 (max 804) | 0.3 (max 1) |
| CPU rosters (min / mean / max) | 10 / 10.7 / 15 | 13 / 14.0 / 15 |
| CPU schools at 13-15, worst season | 10% | 100% |
| Players per class, lowest to highest | 535-1,205 | 1,205-1,327 |
| Freshman minutes share, by season | 8%-27% | 15%-24% |
| OVR by class FR / SO / JR / SR | 68.8 / 69.8 / 70.6 / 71.0 | 71.2 / 71.9 / 72.3 / 72.4 |
| Minutes FR / SO / JR / SR | 21 / 24 / 26 / 30% | 17 / 24 / 28 / 30% |
| Freshman minutes on the top 25 | 24% | 29% |
| Team OVR: top 25 / median / 90th percentile down | 82.1 / 71.9 / 66.1 | 85.8 / 73.0 / 68.0 |
| Teams moving 40+ places (season 1 to 8) | 134 | 119 |
| Team OVR vs school base level, r | 0.85 | 0.91 |
| 5-star / 4-star arrives at | 84.0 / 79.1 | 89.0 / 82.2 |

(Main's column is on the old school ratings.)

On main, much of the movement was noise from random top-ups. Now programs move through recruiting (results, prestige, a good or bad recruiting year) and the portal. Part 2's development (breakouts, stalls, coaching) should add more rise and fall.

**Calibration** (final code, blend applied): sim-feel has all targets within bands. Rankings calibration, six runs (160 seasons) at form 0.35: averages are in band with 1 tracked gap (main: 3). Ranked 16-25 teams out after a split week average 27.2% (band edge 28.1, real 16%, main about 25%), close enough to the edge that a single 20-season run crosses it now and then (2 of 6 runs did). It is a poll-behaviour stat (poll.js); part 2's development variance or a poll tweak is the place to bring it down. Preseason Top 25 still ranked at the end averages 70.8% (real 63%, main 66%), preseason-to-final correlation is 0.35-0.45 (real 0.43, main 0.17), and bluebloods are in 70-77% of preseason polls (real 85%).

A 16-season run (before recruiting pull was added) holds: classes 1,215-1,327, rosters 13-15 every season, at most 1 top-up a year, top-25 team OVR 84-87, median 73.

Generated season 1 (the same in both) is top 25 / median 88.4 / 73. Main drifted the top down to about 81 because elite schools were refilled with base-level freshmen; now they hold near the generated league, which is what sim-feel and the poll were tuned on.

**Old saves** (a main save with rosters at 10.0 and a sophomore class of 292): the first offseason adds about 1,120 junior college transfers across the thin classes, and every school signs to 13-15. Classes are 1,176-1,447 the next season and 1,187-1,432 after that, with no top-ups.

**Difficulty check** (before recruiting pull). The best five recruits a school can land at 50%+ are about the same as on main: low school 79.8 (main 80.7), low-mid 79.7 (81.6), mid 84.9 (83.6), top-25 89.8 (87.7), Duke 91.5 (90.5). Part 1 doesn't make the pinned "low school rises too fast" issue worse. Part 2 measures it properly.

### Still for part 2

- Freshmen are still finished products. A 5-star arrives at about 88.5. That's higher than main's 84 because the best recruits now concentrate at the best programs, where main gave them base-level freshmen. League OVR by class rises only 1.4 points from FR to SR.
- Freshmen get 14-22% of minutes overall and about 26-35% on the top 25. Real figures are about 11% overall and 14% on elite teams. Raw recruits plus growth should bring both down.

## Real-life reference (for part 2's targets)

- D1 men's basketball roster limit: 15 from 2025-26, replacing 13 scholarships plus walk-ons ([Inside the Hall](https://www.insidethehall.com/2024/07/24/report-scholarship-limit-in-basketball-increasing-from-13-to-15/)). With 365 schools at 13-15, about 1,200-1,400 players have to arrive each year to replace graduates and early entrants.
- Star counts per class (about 25 five-stars, 100-150 four-stars) follow the shape of the 247Sports Composite. The exact cut lines are a game choice.
