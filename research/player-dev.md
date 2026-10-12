# Player development

Two parts (HANDOFF.md, Up next item 0). Part 1, the recruit pool and CPU rosters, shipped 2026-10-08. Part 2, development (growth, hidden potential, coaching), shipped 2026-10-12; it's further down.

Numbers below use the program-strength prestige blend (research/program-strength, applied just before this re-check). The pre-blend run is noted where it differs.

Measure with `node test-harness/player-dev.mjs [seasons=8] [--rise runs]`. It plays a full dynasty on the real modules: every offseason runs the user's departures, portal, recruiting and signing day the way the game does, with a simple auto-coach for the user's school. The fast version is `player-dev-test.mjs` (4 seasons, in run-all). The shared code is in `player-dev-lib.mjs`. The script checks the part 1 and part 2 targets; `--rise 4` adds the low-school rise runs.

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

### Left for part 2 (done there)

- Freshmen are still finished products. A 5-star arrives at about 88.5. That's higher than main's 84 because the best recruits now concentrate at the best programs, where main gave them base-level freshmen. League OVR by class rises only 1.4 points from FR to SR.
- Freshmen get 14-22% of minutes overall and about 26-35% on the top 25. Real figures are about 11% overall and 14% on elite teams. Raw recruits plus growth should bring both down.

## Part 2: development

### What was wrong (main before this change, 8 seasons)

- Growth was tiny and flat: about 0.8 OVR per offseason (FR 1.0, SO 0.7, JR 0.6), 2.3 over a whole career (10th-90th percentile 1-3). No breakouts; 31% of offseasons were 0 or less.
- POT did nothing: a freshman with a 15-point POT gap grew 2.5 in his career, one with a 4-point gap 2.2. Seniors ended about 7 below their freshman POT.
- Growth landed on a random rating, so a center gained shooting as often as rebounding.
- Freshmen were finished products: OVR by class 71.2 / 71.9 / 72.3 / 72.4, freshmen played 19% of minutes (27% on the top 25). A 5-star arrived at 88 and was 87.5 as a junior.
- Playing time didn't matter (rotation players grew 0.9x as fast as benchwarmers, from class mix). Facility levels added a point here and there.

### What changed

- **Hidden true potential** (`p.tp`, overall scale) on every player. The POT shown is a scouted estimate: for a recruit, the truth give or take about 3.5 points (your recruiting rating sets it: 50 gives 5, 70 gives 3.5, 90 gives 2). Each year a player is on a roster, the estimate closes half its error, so a senior's POT is within about half a point.
- **Recruits arrive raw.** A recruit is rolled as before (a finished player at his school's level), his true potential is set a little above that (4.5 points, less near the top of the scale so 90+ stays rare), and he starts about 8 points below it (sd 2.5). The generated league at the start of a dynasty uses the same rule for older classes, so season 1 already has the class steps. National rank (and stars) go by what scouts see: half today's overall, half the POT estimate.
- **Growth** (`developPlayer` in simulation.js, the same for every team): each offseason a player closes part of his gap to his true potential: 40% after his freshman year, 38% after his sophomore year, 36% after his junior year (a redshirt year counts at his class's rate and he keeps his class, so it is a real extra year). That is multiplied by the coach's development rating (0.6% per point from 70, so 99 is +17% and 40 is -18%), the practice facility (+5% a level) and playing time (0.85 at no minutes to 1.12 at 30+), and a normal year varies about 30% either way. About 1 in 20 offseasons is a breakout (+6 to +10, and his ceiling rises with it) and 1 in 14 a stall (nothing).
- **Where the growth goes:** one rating point at a time, each landing on a rating with odds by its weight in his position's overall to the power 1.5 (a center: defense and rebounding about 70% of the points, shooting and playmaking about 12%).
- **Walk-on gems** keep working on the same rules: a gem's true potential is 12-20 above him, so he grows about 4-6 a year.
- **Old saves**: every player, recruit and portal entrant without a true potential gets one within 2 of his shown POT (never below his overall) on load. Ratings, OVR and POT don't change on load.
- **Preseason poll** (poll.js): talent 1.8, last season's finish 0.45, brand 1.1 (was 1.2 / 0.55 / 1.25). With development, rosters change more between seasons and last season's finish predicts less; without this the preseason-to-final correlation fell to 0.21-0.27 (real 0.43).
- Screens: the development report shows POT (estimate, and how it moved) under each player's OVR and tags breakouts and stalls; Help has a Player development section (and the redshirt and facility lines changed); the recruit page says POT is your staff's estimate, give or take N; the player page reads "POT (est.)"; the practice facility reads "+5% offseason development" per level.

### Before and after (8 seasons, seasons 2-8 averaged)

| | Main | Now | Target |
|---|---|---|---|
| OVR by class FR / SO / JR / SR | 71.2 / 71.9 / 72.3 / 72.4 | 67.9 / 70.6 / 72.3 / 73.5 | a clear step each year |
| Freshman share of minutes | 19% | 11% | about 10-15% (real 11%) |
| ... on the top 25 by team OVR | 27% | 12% | higher than overall (real 14%) |
| Growth per offseason FR / SO / JR | 1.0 / 0.7 / 0.6 | 2.9 / 2.0 / 1.5 | |
| Career growth FR to SR (10th-90th pct) | 2.3 (1-3) | 6.4 (3-10) | several times today's, real spread |
| Career growth, lowest vs highest third of POT gap | 2.2 vs 2.5 | 5.4 vs 7.4 | higher POT grows more |
| Breakouts (+6 or more in an offseason) | 0% | 6% | about 1 in 20 |
| Stalls (0 or less) | 31% | 13% | about 1 in 10 |
| Development coach 85+ vs 55 or less (per point of gap) | 1.0 vs 0.6 a year, flat by gap | 1.28x | 25-40% |
| Practice facility 2+ vs 0 (per point of gap) | not measurable | 1.21x | |
| Rotation (12+ min) vs bench (0 min) | 0.90x | 1.23x | rotation grows faster |
| 5-star: freshman / sophomore / junior OVR | 88.0 / 87.3 / 87.5 | 84.3 / 87.3 / 88.1 | |
| 4-star: freshman / junior OVR | 82.0 / about 83 | 78.9 / 84 | |
| A 4-star against low-school rosters (team rank 151-250) | | starts on 100%, their best player on 61%; 83.8 as a junior (league top 10% starts at 81.2) | starter, very good by his junior year, not an instant star |
| Senior OVR minus his freshman POT | -6.9 | -1.7 | |
| Team OVR top 25 / median / 90th pct down | 85.3 / 72.9 / 68.3 | 86.1 / 73.0 / 67.7 | about the same |
| CPU rosters | 13-15, mean 14.0 | 13-15, mean 14.0 | 13-15 every season |
| Teams moving 40+ places by team OVR (season 1 to 8) | 129 | 142 | |

(Coach and facility ratios are measured as growth per point of a player's gap to his true potential, so class mix and roster level don't confound them; main had no true potential, so its coach number is against the class average.)

### How fast a low school rises

`node test-harness/player-dev.mjs 8 --rise 4`: the auto-coach spends skill points (recruiting first, then development), bids on transfers better than its fifth-best player with 70% of its NIL, and recruits the best players within reach. 4 runs of 8 seasons at a bottom-tier school (base 58, about #330 of 365) and 4 at a lower-middle one (base 62, about #255). By season: best poll rank / team OVR rank.

Main (before part 2):

    LIU (58)          -/309  -/173  -/115  15/72  25/93  -/82   24/84  -/140
    New Hampshire (58) -/309 -/197  -/119  -/92   -/107  -/66   -/79   -/125
    LIU (58)          -/325  -/247  -/184  -/121  -/123  -/92   -/82   -/96
    LIU (58)          -/344  -/217  -/155  -/111  -/140  -/66   -/95   -/214
    Lower-middle (62): never ranked; best team OVR rank in seasons 7-8: 72-122

Now:

    New Hampshire (58) -/340 -/236  -/205  20/103 -/120  -/85   -/107  -/111
    NC A&T (58)       -/340  -/233  -/116  -/59   -/65   -/87   -/81   -/49
    NC A&T (58)       -/301  -/253  -/128  -/150  -/323  -/131  -/36   -/38
    FDU (58)          -/339  -/306  -/117  -/67   -/73   -/110  -/87   -/87
    Lower-middle (62): never ranked; best team OVR rank in seasons 7-8: 31-249

- **Seasons to the Top 25:** one run in four reached the poll, in season 4 (main: also one in four, season 4). Nobody reached a final Top 25 after season 4, the top 10 by team overall, or #1. Typical path: about #330 to #110-#200 by team overall in two seasons, then #40-#110 by seasons 4-8.
- **Superteams** (a team at least 3 OVR clear of the next best, anywhere in the league): none in 56 seasons (main: 1 in 56).
- This is a simple auto-coach; a person plays better (aggressive NIL on retention and the portal, facilities, picking winnable recruits). So read these as a floor. The pinned concern ("a low school becomes a power in 2-3 seasons") isn't reproduced by the auto-coach on main or now. Part 2 makes the start slower in one way (your 4-stars arrive at about 79, not 82, and take two years to become 84s) and faster in another (your development rating and facilities now matter, and so does your players' playing time).

### Calibration (final code)

- **Sim-feel** (16 seasons, three runs on the final code): win curve, margins, upsets, home win, overtime and schemes in band. Two runs were all in band; the third flagged the top-tenth share at 24.0 (rounding at the band edge). The scoring stats sit near the band edges: best player's share of team points 20.0-20.1% median (band 20-25; main 19.6, outside), top tenth 24.0-24.2% (band 24-30; main 23.7, outside), players at 20+ ppg 13.7-14.7 (band 5-15; main 10.8). Class steps put more talent on juniors and seniors, so stars stand out more; the potential noise was set to the lowest level that keeps the share in band without pushing 20-ppg scorers over 15 (the two pull against each other).
- **Rankings calibration** (20 seasons): every stat in band and no tracked gaps after the preseason reweighting; preseason-to-final correlation 0.43 (real 0.43), preseason top 5 finishing top 10 58% (real 61%), bluebloods in the preseason poll 80% (real 85%), out of the poll after a split week at 16-25 26% (real 16%, band edge 28%).
- **Tests**: run-all 42 of 42. player-dev-test now also checks the class steps, freshman minutes, breakout and stall rates, coaching and playing-time effects, position-weighted growth, the POT estimate and old saves.
- r-test's "CPU signees exist" check failed 3 times in about 110 runs (main: 0 in 60). It runs on a 14-team fixture with 64 recruits, where only a handful of recruits decide early and each CPU signing is a 10-40% roll; I found no link to ratings (CPU bids don't use them), so it may be chance.

## Real-life reference (for part 2's targets)

- D1 men's basketball roster limit: 15 from 2025-26, replacing 13 scholarships plus walk-ons ([Inside the Hall](https://www.insidethehall.com/2024/07/24/report-scholarship-limit-in-basketball-increasing-from-13-to-15/)). With 365 schools at 13-15, about 1,200-1,400 players have to arrive each year to replace graduates and early entrants.
- Star counts per class (about 25 five-stars, 100-150 four-stars) follow the shape of the 247Sports Composite. The exact cut lines are a game choice.
