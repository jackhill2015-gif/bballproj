# Sim realism: how game results feel

Measured with `node test-harness/sim-feel.mjs` (16 seasons of the real game: 365 teams, real
schedules, conference tournaments and the NCAA field). The fast version, `sim-feel-test.mjs`, runs in
run-all with loose bands. League averages stay in `test-harness/calib.mjs`
(research/cbb-calibration-targets.md), which passes.

## Real numbers and sources

**Win curve.** KenPom-style predictions treat a game's margin as normal around the expected
margin, with a standard deviation of about 11 points (AlphaTheory, "March Madness Math", using
KenPom's suggested sd; research/cbb-calibration-targets.md 1.7: a 3-point favorite wins about 61%,
a 10-point favorite about 82%). The brief's curve (+3 about 60%, +6 75%, +9 85%, +12 93% by team
overall) is that model with about 1.3 points of margin per overall point, so it stays the target.
Note that the curve is a design choice about what one overall point is worth; the real anchor is the
11-point spread, and the NCAA seed lines below check the scale.

**NCAA first round, lower seed's win %** (NCAA.com, "Records for every seed in March Madness from
1985 to 2025"; the page itself is blocked here, the numbers come from its search summary):

| Matchup | Record (favorite) | Upset % |
|---|---|---|
| 1 v 16 | 158-2 | 1.2 |
| 2 v 15 | 149-11 | 6.9 |
| 3 v 14 | 137-23 | 14.4 |
| 4 v 13 | 127-33 | 20.6 |
| 5 v 12 | 103-57 | 35.6 |
| 6 v 11 | 98-62 | 38.8 |
| 7 v 10 | 97-62 | 39.0 |
| 8 v 9 | 77-83 | 51.9 |

These match the brief's numbers. Each line is 160 games, so the real rates themselves carry about
±4 points of sampling noise.

**Scorers.** In 2024-25 the third-best scorer in Division I averaged 21.8 ppg (Memphis), so only about
10-15 players reach 20 ppg and the national leader sits around 23-26. That makes the brief's share
targets (best player 22-25% of team points at the median, 28-32% for the top 10% of teams) too high:
at about 72 team ppg, a 28% share is 20 ppg, which would put 35+ players over 20. Typical real
shares: Duke 2024-25 leader 18.9 of 82.6 (23%), Alabama 18.6 of 90.7 (21%), Florida 17.5 of 85 (21%),
Villanova 23.3 of 75 (31%, the national leader). The game targets 20-25% median and 24-30% for the top
10%, and holds the 20+ ppg count to 5-15.

**Overtime.** No national figure was reachable. ACC teams have played a little over 9 overtime games a
season since 2014 (about 5% of league games); the NBA runs about 6%. Target 4-7%.

**Home court.** Real home edge is about 3-3.5 points; home teams win about 64-68% of all games
(non-conference games are mostly stronger teams at home).

## What changed (simulation.js unless noted)

All engine knobs are in `TUNE` at the top of the engine section.

1. **Talent holds up.** A matchup's rating gap (shooter against defender, ball handler against
   defender) moves shot and turnover odds 2.5 times as much as before (`TUNE.skill`).
2. **Less garbage-time randomness, not more.** Second-half leads past 7 points tighten a little more
   (leader's shooting down 0.8 points per point of lead, up to 10), which trims blowouts.
3. **Stars.** The best player on the floor takes 1.5 times his normal share of shots and the second
   option 1.15 times (`star1`, `star2`; half that in motion offense). The old curve that gave every
   good player more shots league-wide is off (`usageExp: 0`); it inflated whole lineups instead of
   stars. Past 12 shots in a game, each attempt is 1.5 points harder (`volFree`, `volPen`).
4. **Real overtime.** Each overtime is a full 5-minute period: an eighth of the game's possessions,
   as many periods as it takes (up to six, then a safety net). Results carry `ot` (1, 2, ...).
   Late and close, teams play for the tie: down three you shoot a three, down one or two you take a
   two, and the leader milking the clock gets a slightly tougher shot (`lateTrips`, `lateSqueeze`).
5. **Home court** is added after the per-shot limits (it was being clipped), 8 shooting points,
   half that on threes.
6. **Boards and blocks.** Offensive rebound chance 34% (was 32%). Blocks go to a shot blocker picked
   by length and position (centers first), not a random defender. Rebounding weight eased a little so
   the national leader stays in range.
7. **Schemes** stay as designed with smaller extremes: press turnover bump 1.5 (was 5-6) and fewer
   run-outs, 1-3-1 turnover bump 2 (was 5), 2-3 zone gives up fewer threes and offensive boards.
   Watched games use the same sizes.
8. **Non-conference schedules** (season.js): CPU teams pick opponents in random order. In list order
   power-conference teams only ever played each other (about 17 power vs non-power games a season in
   the whole league), so the power ratings could not compare the two groups. Once talent decided
   more games, mid-majors that crushed weak leagues climbed above better power teams. Now about 560
   such games a season, like real November schedules.
9. **Selection** (ratings.js): the committee's extra weight on record is 60 (was 200). At 200, 30-2
   teams from weak leagues landed on the 4-6 lines ahead of stronger power teams, and first-round
   upsets ran far above the real rates (1 v 16 upsets at 13%).
10. **Win % shown before games** (utils.js `winProb`) uses the same curve as the engine.

Saves: no format changes except the optional `ot` on results (schedule entries, `G.lastResult`,
conference tournament matches). Old saves load and play; checked in the browser with a save from
before this change.

## Before and after (16 seasons each)

Before = main before this job, same measurement script.

| Target | Real / goal | Before | After |
|---|---|---|---|
| Win % at +3 overall, neutral | ~60 (55-65) | 59.0 | 64.6 |
| Win % at +6 | ~75 (70-80) | 66.0 | 76.5 |
| Win % at +9 | ~85 (80-90) | 73.9 | 87.4 |
| Win % at +12 | ~93 (88-98) | 80.4 | 93.2 |
| Margin sd around the expected margin | 10.5-12 | 11.4 | 11.1 |
| Upset % 1 v 16 | 1.2 | 12.8 | 2.0 |
| Upset % 2 v 15 | 6.9 | 20.6 | 6.8 |
| Upset % 3 v 14 | 14.4 | 30.0 | 11.7 |
| Upset % 4 v 13 | 20.6 | 37.6 | 17.8 |
| Upset % 5 v 12 | 35.6 | 37.4 | 34.9 |
| Upset % 6 v 11 | 38.8 | 39.3 | 38.1 |
| Upset % 7 v 10 | 39.0 | 43.5 | 43.7 |
| Upset % 8 v 9 | 51.9 | 53.5 | 51.0 |
| Best player share of team points, median | 20-25% | 18.5 | 20.5 |
| ... top 10% of teams | 24-30% | 22.6 | 24.3 |
| Scoring leader (ppg) | 22-26 | 21.5 | 25.1 |
| Players at 20+ ppg | 5-15 | 2.3 | 14.1 |
| Star TS%, 16+ shot nights minus 9-13 | slightly lower | -1.8 | -1.8 |
| Overtime games | 4-7% | 0 (hidden) | 4.1 |
| Home win % | 64-68 | 64.6 | 66.1 |
| Offensive rebound % (of all boards) | 26-31 | 26.6 | 27.4 |
| Largest scheme effect (pts/game) | 0-2 | 4.3 (press) | 1.3 |

Also: centers average 1.0 blocks a game (was 0.5, the same as guards); point guards 3.9 assists;
shooting guards take 47% of their shots from three, centers 29%. Overtime games: 13% of them go to a
second overtime. In calib.mjs: avg PPG 71.7, eFG .513, OR% .271, home edge 3.6, margin sd 11.2,
scoring leader 23, rebounding leader 12, assists leader 9.4.

**calib.mjs changes.** Its margin check measured the raw spread of a round robin where base-60 teams
play base-94 teams, which grows whenever talent counts more; the cited source (sd about 11) is the
spread around the expected margin, so calib now fits expected margin from the talent gap and checks
the spread around it. The home edge is the fit's intercept (talent-adjusted). Hosting follows the
game's rule (in a mismatch the stronger program hosts 4 times in 5). The universe is 365 teams with
a bell-shaped spread of talent (an even spread over-weights mismatches), so the national leader
bands compare like with like.

**Rankings.** With better teams winning like real ones, the poll calibration
(`rankings-calibration.mjs`) improved: preseason-to-final rank change 9.2 (real 9.25), unbeaten
climbs in band, power conferences 75% of Top 25 spots (real 74.5%). The poll's unranked waiting line
was respaced (1.8) so teams at 16-25 don't fall out too easily now that strong unranked teams push
harder. Remaining tracked gaps: top-5 teams drop less after a loss, preseason favorites are a little
less sticky, and mid-majors are almost never ranked.

## Update: one engine for watched games

Watched games used a separate, older copy of the possession logic (no star usage, volume dip or
late-game play; bigger scheme effects; no difficulty edge). Now `createGame()` in simulation.js runs
every game and `simPoss()` plays it one possession at a time for the game screen, with the clock
deciding clutch and late-game play. Nothing on the players changes during a game (difficulty and
morale are offsets, fouled-out players a set), so a save in the middle of a watched game is safe.
The coach's offense and defense now work as a small shooting edge (about the same points as before)
instead of points added at the horn, so the score always equals the players' points.
`sim-feel-test.mjs` plays 400 watched games against quick sims of the same matchups: same win rate
and scoring.

**Win-curve target at +3.** The brief's 75 / 85 / 93% at +6 / +9 / +12 is a normal margin model with
about 1.35 points of margin per overall point and an 11-point spread; that same model gives 64% at +3,
not 60%. The target is now 64 (59-69). With the shared engine and a slightly smaller matchup effect
(skill 2.4) and top-option boost (1.45), 16 seasons: +3 64.7, +6 77.4, +9 86.4, +12 93.3; spread 11.1;
upsets 1v16 2.1, 2v15 6.1, 3v14 11.7, 4v13 17.7, 5v12 31.5, 6v11 40.1, 7v10 41.6, 8v9 47.7; leader
24.2 ppg, 11 players at 20+; overtime 4.3%; home 66.3%; biggest scheme effect 1.9.
