# How AP voters rank college basketball: 10 seasons measured

Research for the game's Top 25 (poll.js). Seasons 2016-17 through 2025-26, regular season and
conference tournaments, every week of the AP poll.

## Data

**Source.** Sports Reference, Wikipedia and collegepollarchive.com are all blocked by this
environment's network policy (proxy 403), so none of them could be used. The data comes from the
sportsdataverse ESPN men's college basketball archive on GitHub:

- `sportsdataverse-data` releases: one schedule file per season (every game, scores, home/away/neutral,
  conference). For 2022-23 onward it also has each team's rank at game time.
- `hoopR-mbb-raw`: ESPN's per-game JSON. For 2016-17 through 2021-22 the rank of both teams was read
  from each game's header (only the first part of each file was downloaded).

ESPN shows the AP Top 25 rank next to a team during the regular season and conference tournaments,
so a team's rank in a game is the AP poll in effect that week. Checks that this is the AP poll:

- every preseason #1 matches the real AP preseason #1 (Duke 2016-17 and 2017-18, Kansas 2018-19,
  Michigan State 2019-20, Gonzaga 2020-21 and 2021-22, North Carolina 2022-23, Kansas 2023-24 and
  2024-25, Purdue 2025-26), and the full 2023-24 preseason Top 25 matches;
- in all 10 seasons no team ever shows two different ranks in the same poll week (0 conflicts).

**Weekly polls are rebuilt from games.** A poll week runs Monday to Sunday (US Eastern), like the
real poll release. A team's rank for a week is the rank shown in its games that week. Teams that
didn't play in a week (mostly Christmas week) are missing that week, so movement is always measured
between a team's consecutive observed weeks. A few weeks show 26 teams: that's a real AP tie.

**Files** (`research/rankings/data/`, about 1.4 MB):

- `polls_<season>.csv`: season, week, week start, rank, team, conference, tier, record before the week.
- `games_<season>.csv`: every regular-season and conference tournament game involving a ranked team,
  plus the NCAA tournament (date, site, both teams, ranks, scores, conference, tier).
- `real-stats.json`: every number in this document (from `scripts/analyze.py`).
- `scripts/`: `fetch_espn_ranks.py` (game-time ranks), `build_data.py` (polls and games), `analyze.py`.

**Gaps.**

- 2016-17: 33 of 5,834 regular-season games had no readable header and are left out (no guessing).
- 2019-20: the season stopped in March (no NCAA tournament, the last poll weeks are thin).
- 2020-21: COVID season; many games were cancelled, so about 22 of the 25 ranked teams are seen each week.
- The post-tournament final poll is not in this source (ESPN shows NCAA seeds, not AP ranks, during
  the tournament). "Final poll" below means the last poll seen during the season: the one in effect
  during conference tournament week. The game's post-tournament final poll (champion #1) is a design
  choice, not a measured one.
- Conference tiers: power = ACC, Big Ten, Big 12, SEC (and the Pac-12 through 2023-24); high-major =
  Big East, Mountain West, A-10, WCC, American; mid-major = everyone else.

## What the game reads as "rankings": poll or efficiency

The game used one number, `t.pts` (ratings.js, an efficiency/NET-style rating), for both the
displayed Top 25 and the NCAA committee. They are now split. The efficiency formula is unchanged.

**Poll (poll.js): what the player reads as the rankings**

| Where | What |
|---|---|
| views/standings.js | Top 25 tab: the poll, "others receiving votes", arrows since the last poll. Conference tab: a small rank tag next to ranked teams. |
| views/dashboard.js | Home card "Top 25" rank and arrow; briefing line when a new poll comes out; "#N" on the next game; scout line "Ranked #N". |
| views/schedule.js | "#N" before ranked opponents. |
| views/team.js | Team page "Top 25" stat (NR when unranked). |
| ui.js | `userRank`, `rankDelta` (arrows), milestone toasts (first Top 25, top 10, #1), game narration and XP for ranked opponents (`teamRankOf`). |
| goals.js | "Beat a ranked team", top-10 win, beat #1, "Crack the Top 25", "Reach #1". |
| events.js | College GameDay (ranked teams only), the "#N falls to an unranked opponent" headline. |
| season.js | Season history keeps the final poll rank (`poll`) next to the NET rank (`rank`). |
| views/recap.js | "Final poll" on your season recap; the league tab's final top 10. |
| views/history.js, views/trophies.js | Best final Top 25 rank; season rows show the final poll rank (older seasons keep their NET rank). |

**Efficiency (ratings.js `t.pts`, `resumeScore`): team strength, unchanged**

| Where | What |
|---|---|
| tournament.js | NCAA selection, seeding, bubble lists (`resumeScore`); conference tournament seeding tie-breaks. |
| views/dashboard.js | Projected seed (efficiency rank); scout "winnable resume game" (efficiency top 64). |
| goals.js | How hard the season's goals are (`effRankOf`). |
| season.js | Recruit rival pools (which schools chase which stars). |
| views/recruiting.js | Rival bid strength, Within reach. |
| views/portal.js | Portal suitors, "weak program" check. |
| dashboard, schedule, standings, recap, events, goals | Conference standings tie-breaks. |
| views/standings.js | The NET column on both tabs. |
| views/recap.js | Coach of the year uses wins against roster talent (no rankings). |

## Measurements (10 seasons, real AP poll)

Spots are poll positions. "Dropped" counts a team that falls out as #26. Spread is the standard
deviation, plus the middle half (25th-75th percentile) where useful.

### 1. Preseason

- **63% of the preseason Top 25 are still ranked in the final poll** (154 of 246 team-seasons).
- **61% of the preseason top 5 finish in the top 10.**
- Rank correlation between preseason and final poll (Spearman, unranked = 30): 0.24 to 0.57 by
  season, average 0.43.
- A preseason team moves 9.3 spots by the end on average (sd 6.6; middle half 4 to 14).
- Bluebloods start ranked almost every year: Duke, Kansas, Kentucky and North Carolina 10 of 10,
  UCLA 8 of 10, Indiana 3 of 10.

### 2. Losses

A ranked team plays 1.8 games a poll week (2 games in 67% of weeks, 1 in 26%, 3 in 7%), so the
same loss shows up two ways:

| Week | Drop (avg) | Spread (sd) | n |
|---|---|---|---|
| One game, a loss | 4.3 | 2.8 | 207 |
| A loss and a win | 2.5 | 2.7 | 922 |
| Two losses | 6.5 | 3.0 | 182 |
| Any week with exactly one loss | 2.8 | 2.8 | 1,217 |

**(a) By the opponent's rank** (loss-and-a-win weeks; one-game weeks in brackets):

| Lost to | Drop | sd |
|---|---|---|
| Unranked team | 3.2 (5.2) | 2.7 |
| #11-25 | 2.1 (4.3) | 2.5 |
| Top 10 | 1.2 (2.5) | 2.1 |

**(b) By site:**

| Site | Drop | sd |
|---|---|---|
| Home loss | 2.8 (4.7) | 2.8 |
| Road loss | 2.3 (4.0) | 2.5 |
| Neutral | 3.7 (4.7) | 3.3 |

**(c) By the losing team's rank:**

| Ranked | Drop | sd |
|---|---|---|
| 1-5 | 2.8 (3.3) | 2.5 |
| 6-15 | 2.9 (4.8) | 2.7 |
| 16-25 | 1.8 (3.9) | 2.5 (capped: falling out counts as #26) |

**Falling out after one loss:** 18% of teams ranked 16-25 (16% when they also won a game that week);
under 1% of teams ranked 6-15; never in the top 5 (0 of 211).

### 3. Wins

Spots gained in a week with only wins:

| Ranked | All winners | Unbeaten teams |
|---|---|---|
| 1-5 | 0.4 | 0.35 (sd 0.8) |
| 6-15 | 1.8 | 1.5 (sd 2.0) |
| 16-25 | 2.8 | 2.7 (sd 3.0) |

Most of a winner's climb is other teams losing: a top-5 team that keeps winning barely moves.

**Mid-major unbeatens climb slower.** Unbeaten and ranked 16-25: power conference +2.9 a week,
high-major +2.6, mid-major +1.2 (22 weeks). Mid-majors almost never get past 16-25 while unbeaten
(1 week in 10 seasons).

### 4. Weekly churn

- **2.4 new teams enter the Top 25 a week** (sd 1.25; middle half 2 to 3).
- **#1 changes in 29% of weeks** (47 of 160): 3 to 6 times a season, and never in 2020-21 (Gonzaga
  stayed #1 all season).

### 5. Who gets ranked

- Share of all Top 25 spots: **power 74.5%, high-major 24.1%, mid-major 1.4%.**
- The best mid-major reaches about #19 (#14 to #24 by season); in 2 of 10 seasons no mid-major
  was ranked at all.

### 6. Final poll vs NCAA seeds

- **31 of 36 final top-4 teams got a 1 seed** (86%; 2019-20 had no tournament).
- Seed line minus poll line (poll line = rank / 4, rounded up): +0.15 on average, sd 1.1. The
  committee and the voters mostly agree; a ranked team is rarely seeded more than a line off.
- 1 seeds were ranked #2.9 on average in the final poll.

## Rules the game should follow

1. **Preseason sticks, but not too much.** About 63% of the preseason Top 25 is still ranked at the
   end, and about 60% of the preseason top 5 finish in the top 10.
2. **Big programs start ranked.** Duke, Kansas, Kentucky and North Carolina were in all 10 preseason
   polls.
3. **Bad losses hurt most.** In a loss-and-a-win week: about 3 spots for losing to an unranked team,
   2 to a #11-25 team, 1 to a top-10 team. A lone loss costs about 4.3.
4. **A second loss in a week doubles the damage**: two losses cost about 6.5 spots.
5. **The top five are steady.** They never fell out after one loss, and when they keep winning they
   barely move (0.4 spots).
6. **The bottom of the poll is fragile.** After one loss, about 1 in 6 teams ranked 16-25 drops out;
   a team in the top 15 almost never does.
7. **Winners rise mostly because others lose**: about 2 to 3 spots a week in the bottom half, under
   half a spot at the top.
8. **Mid-majors climb slowly**: an unbeaten mid-major gains about 1 spot a week, less than half the
   pace of a power-conference team, and peaks around #19.
9. **About 2 or 3 new teams a week**, and #1 changes about 3 to 6 times a season.
10. **Three quarters of the poll is power conference teams**; mid-majors hold about 1 in 70 spots.
11. **By March the poll and the committee agree**: the final top 4 are almost always 1 seeds, and
    seeds rarely differ from the poll line by more than one.

## The game's poll

`poll.js` is a voters' poll, separate from the efficiency rating. It does not re-sort a formula each
week; it starts from last week's poll and moves teams by what they did, like a voter would.

**Cadence.** A ranked team plays about 1.8 games a real poll week, and the game plays one game a
week, so the game's poll comes out every other game week: a preseason poll, 15 regular-season polls,
a Selection Sunday poll after the conference tournaments, and a final poll after the NCAA tournament
(18 a season, like the real one).

**Preseason.** A blend of roster talent (the efficiency rating's preseason prior), last season's final
poll and program prestige, with a little noise. Bluebloods usually start ranked.

**Each poll.** Every team starts at its rank; unranked teams line up behind #25 (last poll's
"others receiving votes" first). Then, per game since the last poll:

- a loss costs spots: 8.5 to an unranked team, 6.5 to #11-25, 4.5 to a top-10 team; times 1.19 at
  home, 1.05 neutral, 0.77 on the road; a second loss costs 0.9 of the first;
- a top-5 team's loss costs about an eighth of that (see parity below);
- a win over a top-10 team earns 1 spot, over #11-25 0.6, plus 0.1 on the road;
- every team drifts toward a strength order (efficiency, record, and less benefit of the doubt for
  low-prestige programs). The drift is 12% of the gap early and grows to 48% by March, so the poll
  and the committee mostly agree at the end. On Selection Sunday voters close half the gap to the
  committee's own resume order;
- a little noise (about one spot; a tenth of that in the top 5).

The top 25 by the result is the poll; the next 10 are "others receiving votes". The final poll after
the tournament moves teams up about 3 spots per tournament win, drops ranked teams that lost their
first game, and puts the champion at #1.

**Save.** `G.poll` holds 25 team ids, 10 receiving votes, last poll's 25 ids (for arrows) and a few
fields: under 300 bytes. Saves from before the poll build one from the strength order on load.

### Parity: what the poll can't match

In the game, ranked teams win 63% of their games (top 5: 66%). Real ranked teams win 72% (top 5:
81%). With more losses at the top, a poll that dropped teams as much as real voters do would churn
far more than the real poll and change #1 every other week. The model keeps the behaviors the player
feels (how much a loss costs, how many teams enter each week, how often #1 changes, how sticky the
preseason poll is) and lets these differ. They are printed as "tracked gap", not enforced:

- a top-5 team's drop after a loss-and-a-win week (smaller in the game, because top teams lose
  more often);
- how far unbeaten teams climb (further in the game: with more losses above them, there's more room
  to move up);
- how often the preseason top 5 finish in the top 10, the preseason-to-final rank correlation, and
  how far a preseason team moves by the end (preseason favorites are less dominant in the game);
- seasons with a ranked mid-major (game mid-majors are rarely strong enough).

Fixing these needs stronger top teams in the game sim, not a different poll, and that is outside
this job (the efficiency rating and game sim were not changed).

### Game vs real

`node test-harness/rankings-calibration.mjs 20 --md` (20 simulated seasons, real = the 10-season
averages above). The fast version (4 seasons, bands doubled on the key rows) runs in run-all as
`rankings-test.mjs`.

| Stat | Game | Real | Band | |
|---|---|---|---|---|
| Drop after a 1-loss-1-win week (all) | 1.82 | 2.5 | ±1 | ok |
| ... loss to an unranked team | 2.16 | 3.23 | ±1.5 | ok |
| ... loss to #11-25 | 1.26 | 2.11 | ±1.5 | ok |
| ... loss to a top-10 team | 0.56 | 1.15 | ±1.5 | ok |
| ... home loss | 3.14 | 2.8 | ±1.5 | ok |
| ... road loss | 1.08 | 2.25 | ±1.5 | ok |
| ... ranked 1-5 | 0.82 | 2.82 | ±1.5 | tracked gap |
| ... ranked 6-15 | 2.57 | 2.87 | ±1.5 | ok |
| ... ranked 16-25 | 1.55 | 1.84 | ±1.5 | ok |
| Spread (sd) of that drop | 2.73 | 2.65 | ±1 | ok |
| Drop after an 0-2 week | 5.93 | 6.54 | ±2 | ok |
| Out of the poll after 1L-1W, ranked 16-25 (%) | 25.64 | 16.1 | ±12 | ok |
| Out of the poll after 1L-1W, ranked 6-15 (%) | 0.21 | 0.5 | ±5 | ok |
| Unbeaten climb per winning week, 1-5 | 0.76 | 0.35 | ±1 | ok |
| Unbeaten climb per winning week, 6-15 | 2.62 | 1.54 | ±1 | tracked gap |
| Unbeaten climb per winning week, 16-25 | 6.31 | 2.69 | ±1.5 | tracked gap |
| New teams per poll (churn) | 2.67 | 2.43 | ±1 | ok |
| #1 changes (% of polls) | 28.13 | 29.4 | ±10 | ok |
| Preseason Top 25 still ranked at the end (%) | 60.4 | 62.6 | ±10 | ok |
| Preseason top 5 that finish top 10 (%) | 43 | 60.8 | ±15 | tracked gap |
| Preseason-to-final rank correlation | 0.25 | 0.43 | ±0.15 | tracked gap |
| Avg rank change preseason to final | 10.46 | 9.25 | ±2 | ok |
| Top 25 spots: power conferences (%) | 64.67 | 74.5 | ±10 | ok |
| Top 25 spots: mid-majors (%) | 0.1 | 1.4 | ±4 | ok |
| Bluebloods in the preseason poll (%) | 70.83 | 85 | ±15 | ok |
| Seasons with a ranked mid-major (%) | 20 | 80 | ±30 | tracked gap |
| Best mid-major rank in a season (avg) | 21.75 | 19.13 | ±5 | ok |
| Final top 4 that get 1 seeds (%) | 80 | 86.11 | ±20 | ok |
| Seed line minus poll line (avg) | 0.26 | 0.15 | ±1 | ok |

Run to run, 20 seasons is still a small sample for the season-level stats (preseason Top 25 still
ranked, rank change preseason to final, top 4 that get 1 seeds): in three 20-season runs
with the final settings, two had every target within its band and one had the preseason-to-final
rank change at 11.4 (band 7.25 to 11.25). That row follows the rank correlation, so it is tracked
with it; every other target held in all three runs.

## Update after the sim realism job (2026-10-08)

The game engine now lets better teams win about as often as real ones (research/sim-feel.md), so
the parity gap above mostly closed. The poll's unranked waiting line was respaced (`entrySpacing`
1.8, was 0.9) so teams at 16-25 don't fall out too easily now that strong unranked teams push
harder; nothing else in the voter model changed. 20 seasons:

| Stat | Game | Real | Band | |
|---|---|---|---|---|
| Drop after a 1-loss-1-win week (all) | 2.34 | 2.5 | ±1 | ok |
| ... loss to an unranked team | 2.77 | 3.23 | ±1.5 | ok |
| ... loss to #11-25 | 1.89 | 2.11 | ±1.5 | ok |
| ... loss to a top-10 team | 1.05 | 1.15 | ±1.5 | ok |
| ... home loss | 3.61 | 2.8 | ±1.5 | ok |
| ... road loss | 1.81 | 2.25 | ±1.5 | ok |
| ... ranked 1-5 | 1.18 | 2.82 | ±1.5 | tracked gap |
| ... ranked 6-15 | 3.3 | 2.87 | ±1.5 | ok |
| ... ranked 16-25 | 1.91 | 1.84 | ±1.5 | ok |
| Spread (sd) of that drop | 2.89 | 2.65 | ±1 | ok |
| Drop after an 0-2 week | 6.21 | 6.54 | ±2 | ok |
| Out of the poll after 1L-1W, ranked 16-25 (%) | 25.44 | 16.1 | ±12 | ok |
| Out of the poll after 1L-1W, ranked 6-15 (%) | 0.76 | 0.5 | ±5 | ok |
| Unbeaten climb per winning week, 1-5 | 0.22 | 0.35 | ±1 | ok |
| Unbeaten climb per winning week, 6-15 | 1.38 | 1.54 | ±1 | ok |
| Unbeaten climb per winning week, 16-25 | 3.46 | 2.69 | ±1.5 | ok |
| New teams per poll (churn) | 1.9 | 2.43 | ±1 | ok |
| #1 changes (% of polls) | 25 | 29.4 | ±10 | ok |
| Preseason Top 25 still ranked at the end (%) | 66.2 | 62.6 | ±10 | ok |
| Preseason top 5 that finish top 10 (%) | 46 | 60.8 | ±15 | ok |
| Preseason-to-final rank correlation | 0.27 | 0.43 | ±0.15 | tracked gap |
| Avg rank change preseason to final | 9.68 | 9.25 | ±2 | ok |
| Top 25 spots: power conferences (%) | 76.1 | 74.5 | ±10 | ok |
| Top 25 spots: mid-majors (%) | 0 | 1.4 | ±4 | ok |
| Bluebloods in the preseason poll (%) | 81.67 | 85 | ±15 | ok |
| Seasons with a ranked mid-major (%) | 0 | 80 | ±30 | tracked gap |
| Final top 4 that get 1 seeds (%) | 88.75 | 86.11 | ±20 | ok |
| Seed line minus poll line (avg) | 0.1 | 0.15 | ±1 | ok |

Tracked gaps left: top-5 teams drop less after a loss, the preseason-to-final correlation is a
little low, and mid-majors are almost never ranked (game mid-majors are rarely strong enough).
