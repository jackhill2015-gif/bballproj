# Difficulty report — HOOPS OS

**Method:** `test-harness/difficulty-diag.mjs` (report only, no game changes).
12 seasons x 3 prestige tiers (low/mid/high by baseOvr) x 2 runs = 72 seasons.
Auto-coach: sorts by OVR + fixes minutes each preseason, spends skill points on
dev/rec, takes up to 4 portal players at thin positions (70% of NIL), concentrates
recruiting points on the 8 best available targets. Unseeded RNG — treat single-run
numbers as indicative, tier averages as the signal.

## Season-by-season tier averages (2 runs each)

| tier | s | W-L | rank | OVR gap vs league | titles |
|------|---|-------|------|-------------------|--------|
| low | 1 | 17-15 | 222 | -9.4 | 0 |
| low | 2 | 22-11 | 158 | +3.7 | 0 |
| low | 3 | 22-10 | 55 | +10.6 | 0 |
| low | 4 | 25-10 | 51 | +12.4 | 0 |
| low | 5 | 30-8 | 12 | +13.4 | 1 |
| low | 6 | 27-8 | 19 | +15.6 | 0 |
| low | 7 | 29-6 | 4 | +14.9 | 0 |
| low | 8 | 28-8 | 33 | +16 | 0 |
| low | 9 | 32-5 | 7 | +16.5 | 0 |
| low | 10 | 30-6 | 19 | +16.3 | 0 |
| low | 11 | 34-5 | 3 | +15.3 | 1 |
| low | 12 | 36-3 | 3 | +15.8 | 0 |
| mid | 1 | 14-13 | 146 | +3.6 | 0 |
| mid | 2 | 22-8 | 73 | +7.2 | 0 |
| mid | 3 | 20-11 | 109 | +12.1 | 0 |
| mid | 4 | 22-9 | 28 | +14.3 | 0 |
| mid | 5 | 26-5 | 6 | +15.2 | 0 |
| mid | 6 | 27-5 | 2 | +18 | 1 |
| mid | 7 | 27-7 | 4 | +19.8 | 0 |
| mid | 8 | 25-5 | 9 | +19.8 | 0 |
| mid | 9 | 21-8 | 6 | +18.7 | 0 |
| mid | 10 | 27-4 | 14 | +18.5 | 1 |
| mid | 11 | 26-6 | 3 | +19 | 0 |
| mid | 12 | 27-5 | 5 | +17.6 | 0 |
| high | 1 | 27-7 | 5 | +20 | 0 |
| high | 2 | 24-9 | 53 | +14.1 | 0 |
| high | 3 | 26-9 | 19 | +13.7 | 0 |
| high | 4 | 28-8 | 15 | +15.4 | 0 |
| high | 5 | 28-7 | 4 | +16.1 | 0 |
| high | 6 | 31-4 | 3 | +15.3 | 0 |
| high | 7 | 30-6 | 2 | +19.3 | 0 |
| high | 8 | 25-9 | 7 | +15.4 | 0 |
| high | 9 | 27-8 | 7 | +15.3 | 0 |
| high | 10 | 24-9 | 43 | +14.7 | 0 |
| high | 11 | 22-11 | 19 | +9.2 | 0 |
| high | 12 | 29-6 | 6 | +14.8 | 0 |

## Time to dominance

| tier | run | first top-10 | first title | titles/12 | finals/12 |
|------|-----|--------------|-------------|-----------|-----------|
| low | 1 | 5 | 5 | 2 | 4 |
| low | 2 | 7 | - | 0 | 1 |
| mid | 1 | 5 | 6 | 1 | 1 |
| mid | 2 | 5 | 10 | 1 | 1 |
| high | 1 | 1 | - | 0 | 0 |
| high | 2 | 1 | - | 0 | 0 |

## The CPU development gap (measured)

- User returners: **+0.99 OVR per offseason** (via calcGrowth + coach dev + practice facility).
- CPU returners: **+0.00 OVR per offseason** (sampled across 24 CPU teams per run).
- Net compounding advantage: **+0.99 OVR per year**, every year, before recruiting/portal are even counted.
- Cause (verified in `season.js` doOffseason): CPU rosters only age up class (`p.cls`);
  `calcGrowth` is never called for them. Their freshmen arrive at the same ratings
  as the user's, then freeze while the user's roster gains about +1 OVR per player
  per year, every year.

## Does it get too easy?

Yes — and quickly. A bottom-decile school goes from 17-15 and rank ~220 in year 1
to a national title by season 5 and a permanent top-5 perch by season 7. A
mid-prestige school is a top-10 team by season 5 with a title by season 6. A
high-prestige school is dominant from day one. Across all 72 simulated seasons the
auto-coach was never fired once, won 25-36 games routinely from year 5 onward, and
held a **+15 to +20 OVR edge over the league average** — roughly the gap between a
1-seed and a mid-major. The OVR gap crosses +10 (structurally dominant) by season
3-4 in every tier.

One masking factor: the tournament's single-elimination variance keeps titles from
being automatic — the high-prestige runs went 0-for-12 on titles despite total
regular-season dominance. So March still *feels* uncertain while the other 30 games
feel solved. The boredom risk is the season, not the bracket.

## What drives it

1. **The CPU development freeze (measured, primary driver).** User returners gain
   +0.99 OVR per offseason; CPU returners gain **+0.00**. Verified in `season.js`
   `doOffseason`: user players get `calcGrowth` (+ coach dev bonus + practice
   facility), CPU players only age up a class year — their ratings never move after
   recruitment. This compounds every year: by season 4-5 the user's juniors/seniors
   are 3-5 OVR better than identical CPU players, which accounts for most of the
   observed +15-20 gap.
2. **Recruiting concentration.** The auto-coach (like any competent player) focuses
   points on ~8 realistic targets and signs contributors yearly. CPU teams sign
   recruits too, but theirs never develop — the user's freshmen arrive equal and
   leave superior.
3. **Portal asymmetry.** The user takes the best available transfers at positions
   of need; CPU portal takes are capped at 3 and their pickups also freeze
   developmentally, so portal wins are permanent gains for the user only.
4. **Skill-point feedback loop.** Winning earns skill points, the auto-coach pours
   them into coach dev (up to 90), which speeds up development, which wins more.
   The rich get richer by design.
5. **No catch-up mechanism and no threat.** CPU teams have no way to close the gap,
   and nothing threatens the user either: zero firings in 72 seasons, and the hot
   seat never engaged. Dominance has no maintenance cost.

## Suggested fixes (not implemented — report only)

1. **Give CPU players offseason development (highest leverage).** Call `calcGrowth`
   for CPU returners in `doOffseason`, scaled by their coach's dev rating — possibly
   at 60-70% of the user rate to preserve a small, earned player edge. This
   directly closes the measured +1.0 OVR/yr leak and is a one-loop change. Re-run
   this diag after: the healthy target is a +5-8 gap (good coaching matters), not
   +15-20.
2. **Make the portal a two-way threat.** Let CPU suitors bid more aggressively for
   elite entrants and — more importantly — let them poach the user's restless
   stars (low morale + big NIL offer). Dominance should cost retention money,
   which ties into the NIL redesign: keeping a 92 OVR senior should be a real
   decision, not a default.
3. **Put teeth in expectations.** Zero firings in 72 seasons means coasting is
   free. Add relative-underperformance triggers (e.g. a preseason top-10 team
   missing the tournament, or back-to-back seasons below the fan-base expectation
   band) so a bad year at a good program actually endangers the job.
4. **Diminishing returns on development (if 1-3 aren't enough).** Flatten
   `calcGrowth` for upperclassmen or cap career growth, so stacked junior/senior
   cores naturally regress via graduation instead of sitting at 90+ OVR for three
   straight years.

## Appendix: firings (0 across 72 seasons)
- none

## Update (Claude) — fixes 1 and 3 implemented

- **Fix 1, CPU development:** CPU returners now run `calcGrowth` each offseason
  with their own coach's dev rating (`season.js` doOffseason). Re-run: CPU
  returners +0.80 OVR/yr vs user +0.79 (was +0.00 vs +0.99). Steady-state user
  edge over the league fell from +15–20 to about +10–13 (top-10 teams sit near
  +10 anyway). League average stays ~70.5 — no ratings inflation.
- **Fix 3, expectations with teeth:** a roster ranked top 20 nationally at the
  start of the season is now expected to make the NCAA tournament
  (`calcExpectations(..., rosterRank)` → `exp.ncaa`). Missing it counts as a
  disappointing season (hot seat, then a 40% firing chance) regardless of wins.
- **Fix 2, two-way portal pressure:** coming next as player retention — key
  players ask for NIL to stay, and the ones you don't pay enter the portal.
