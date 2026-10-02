# CBB Calibration Targets — HOOPS OS Sim Engine

**Purpose:** Real-world NCAA Division I men's basketball numbers that the HOOPS OS
sim engine must reproduce. Focus seasons: 2023-24, 2024-25, 2025-26 (as available).
Each row has: real value/range → source → **SIM MUST HIT** tolerance band.
Bands are concrete and testable against a simulated season of ~350+ D1 teams.

**How to use:** After simming a full season, check every "SIM MUST HIT" line.
A simulated season that falls outside a band is out of calibration. Ranges marked
**(est.)** are estimates where no hard published figure was found — treat them as
looser targets.

---

## 1. Team Offense

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 1.1 | D1 average team points/game | ~75.3 ppg early 2024-25 (all games incl. guarantee games; highest since 1989-90). D1-vs-D1 full-season averages in the KenPom era run ~70–74. | FanSided, Dec 2024 (https://fansided.com/best-offenses-in-college-basketball-alabama-is-impossible-to-stop) | Simulated D1 average team PPG must fall within **70–76** |
| 1.2 | Top-10 offense team PPG | #1 Alabama 90.8 ppg (entering 2025 Sweet 16); early-season top 10 ranged 86.3–91.1 ppg | 247sports (https://www.247sports.com/longformarticle/march-madness-2025-kenpom-rankings-for-ncaa-tournament-sweet-16-teams-247676476/amp/); FanSided | Simulated #1–10 scoring offenses must average **82–92 ppg** |
| 1.3 | Bottom-10 offense team PPG | **(est.)** Worst D1 offenses typically score ~55–62 ppg (worst KenPom team 2024-25 was Mississippi Valley State, #364) | Estimate — no hard figure retrieved | Simulated bottom-10 offenses must average **54–64 ppg** |
| 1.4 | Average offensive efficiency | National average adjusted offensive efficiency set a new record each of 2023-24, 2024-25, 2025-26; 2025-26 average = 108.7 pts/100 poss (prior 26 seasons it sat 100–105) | Yardbarker/CBB similarity via smur_cbb (https://www.yardbarker.com/college_basketball/articles/do_the_2015_wisconsin_badgers_still_have_the_best_offense_in_recent_history/s1_17003_43478313) | Simulated national average raw offensive efficiency must be **102–110 pts/100 poss** |
| 1.5 | Elite team efficiency | Best AdjO ever: Purdue 131.6 (2025-26); Duke 130.1 (2024-25); top-20 2025 ranged 119.4–128.6 | SI (https://www.si.com/college/purdue/basketball/purdue-ends-2025-26-basketball-season-making-kenpom-history); SI KenPom 2025 preview | Simulated best-team AdjO must fall **118–132 pts/100 poss**; at least 10 teams ≥118 |
| 1.6 | Typical final score range | Elite-vs-elite games land ~75–95; typical D1 game total ~135–155; blowouts vs overmatched foes reach 100+ (Alabama cracked 100 nine times in 2024-25) | Alabama team stats (rolltide.com PDF); NBC Sports/AP on Alabama's 113-88 Sweet 16 win | **≥90% of simulated games must finish with both teams between 45 and 110 points**; combined totals under 100 or over 200 must be <2% of games |
| 1.7 | Scoring margin distribution | Per KenPom-style modeling, college scoring margins are ~normal with σ ≈ 11 points (3-pt favorite ≈ 60.7% win prob; 10-pt favorite ≈ 81.9%) | Poologic calibration via northstar-synergy SKILL.md (https://github.com/cheadlee10/northstar-synergy) | Simulated margin-of-victory distribution must have **σ between 9.5 and 12.5**; mean absolute margin **10–14** |

---

## 2. Pace

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 2.1 | D1 average tempo | ~66–68 possessions/40 min (KenPom AdjT; D1 average). One analytics repo uses ~65 as a conservative NCAA average. | jgamblin/ncaa-prediction docs (https://github.com/jgamblin/ncaa-prediction/blob/HEAD/docs/STEP2_ADJUSTED_EFFICIENCY_IMPLEMENTATION.md); KenPom convention | Simulated D1 average possessions/team/game must be **64–70** |
| 2.2 | Fastest team tempo | Cal Poly 74.7 AdjT (2024-25, fastest in country). Rule of thumb: >72 poss = fast. | Busting Brackets citing KenPom (https://bustingbrackets.com/ncaa-basketball-5-teams-that-play-the-fastest-pace-in-cbb-this-2024-25-season) | Simulated fastest teams must reach **72–78** poss/game; no team above 82 |
| 2.3 | Slowest team tempo | **(est.)** Slowest D1 teams sit ~59–62 AdjT (e.g., Cleveland State 305th in pace 2024-25; North Texas perennially among slowest). Rule of thumb: <65 poss = slow. | Yardbarker (https://www.yardbarker.com/college_basketball/articles/9_underrated_college_basketball_tempo_changes_to_help_you_beat_mispriced_totals/s1_17354_42990222); tommeng sports-betting skill | Simulated slowest teams must be **58–64** poss/game; no team below 55 |
| 2.4 | Tempo spread | Fastest-minus-slowest AdjT gap is ~13–16 possessions (e.g., ~74.7 vs ~59–62) | Same as 2.2/2.3 | Simulated tempo spread (max team avg − min team avg) must be **≥10 and ≤20** possessions |
| 2.5 | Pace vs scoring link | Faster teams score more: the pace→scoring gradient is real but modest (top tempo quartile outscores bottom by roughly 8–12 ppg at D1 level) | Consensus across cited tempo analyses | Simulated correlation between team tempo and team PPG must be **positive, r = 0.3–0.7** |

---

## 3. Shooting

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 3.1 | D1 average FG% | **(est.)** ~.435–.445. Opponent-sample anchors: vs UNC .435; vs Alabama .437; vs Minnesota .420–.426; vs Texas .448 | UNC/Alabama/Minnesota/Texas 2024-25 cumulative team stats (goheels.com, rolltide.com PDF, gophersports.com, texaslonghorns.com) | Simulated D1 average FG% must be **.425–.455** |
| 3.2 | D1 average 3P% | ~.340 (stable for years despite volume surge; 68 teams shot ≥36% in 2024-25) | NCAA.com (https://www.ncaa.com/news/basketball-men/article/2025-02-25/7-surprising-facts-about-2024-25-college-basketball-three-point-barrage?amp) | Simulated D1 average 3P% must be **.325–.355** |
| 3.3 | 3-point attempt rate | Record volume in 2024-25: most 3PA/game in D1 history; 290 teams attempted 20+ threes/game (all-time high); 85 teams attempted 25+ (more than double two years prior) | NCAA.com, same as 3.2 | Simulated 3PA share of FGA must average **36–42%**; **≥75% of teams** must attempt 20+ threes/game |
| 3.4 | Team 3PA/game extremes | Alabama attempted 51 threes in a game (NCAA tourney record, 25 makes vs BYU); Michigan State (top-25 team) attempted only 19.0/game (328th) | NBC Sports/AP (https://www.nbcsportsphiladelphia.com/ncaa/ncaab/alabama-3-point-record-march-madness/657406/); NCAA.com | Simulated team 3PA/game range must span **~17 to ~32**; no team above 36/game |
| 3.5 | D1 average FT% | **(est.)** ~.705–.725. Samples: UNC .735, Alabama .726, Minnesota .690, Texas .743; opponents .697–.759 | Same cumulative team stats as 3.1 | Simulated D1 average FT% must be **.690–.740** |
| 3.6 | FT attempt rate | Samples: Alabama 463 FTA/18 gm (25.7/gm); UNC 649 FTA/30 gm (21.6/gm); Minnesota ~23/gm; ~0.30–0.40 FTA per FGA | Same cumulative team stats | Simulated team FTA/game must average **19–25**; FTA/FGA ratio **0.28–0.42** |
| 3.7 | eFG% (national) | **(est.)** ~.500–.515 (derived from FG% ~.44 and 3PA rate ~39%) | Derived from 3.1–3.3; KenPom convention | Simulated D1 average eFG% must be **.490–.525** |
| 3.8 | Individual 3P% (volume shooter) | Eric Dixon 2024-25: 40.7% on 7.2 3PA/game (led nation in scoring) | RealGM (https://basketball.realgm.com/player/Eric-Dixon/NCAA/120024) | Simulated high-volume (5+ 3PA/gm) shooters must top out **.380–.450**; league of such shooters averages .330–.370 |

---

## 4. Rebounds

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 4.1 | Offensive rebound % (national) | **(est.)** ~28–29% of available offensive rebounds secured. Heuristic used in analytics tooling: "estimate ~28% offensive" | jackdavisathletics/ncaa-four-factors (https://github.com/jackdavisathletics/ncaa-four-factors/blob/HEAD/CLAUDE.md); KenPom convention (~28% typical) | Simulated D1 average OR% must be **26–31%** |
| 4.2 | Team offensive rebounds/game | Top 2024-25: Tennessee 16.1, Florida 15.8, South Florida 15.5 ORPG | NCAA.com stats (https://www.ncaa.com/stats/basketball-men/d1/current/team/857) | Simulated team ORPG must average **10.5–13.5**; top teams 14–17; no team above 18 |
| 4.3 | Team total rebounds/game | Samples: Alabama 42.1, Texas 37.5, UNC 36.7, Minnesota 34.5–36.2; opponents 30.5–36.3 | Same cumulative team stats as 3.1 | Simulated D1 average team RPG must be **33–38** |
| 4.4 | Individual rebounding leader | 2024-25: Carson Towt (N. Arizona) 12.4 rpg; 2023-24: Enrique Freeman 12.9; 2021-22: Oscar Tshiebwe 15.1 | Wikipedia — List of NCAA D1 season rebounding leaders (https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_men%27s_basketball_season_rebounding_leaders) | Simulated national rebounding leader must be **11.0–14.5 rpg**; no player above 16 rpg |
| 4.5 | Typical team rebounding leader | **(est.)** Average team's top rebounder grabs ~7–9 rpg (e.g., Villanova's leader had 7.0) | Estimate anchored by Villanova 2024-25 (villanova.sidearmsports.com) | Simulated median team rebounding leader must be **6.5–9.5 rpg** |

---

## 5. Turnovers / Defense

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 5.1 | D1 average turnover % | **(est.)** ~17–19% of possessions end in a turnover. Anchors: UNC 14.2% (25th best), Georgia Tech 18.9% (293rd) | Tar Heel Tribune KenPom comparison (http://tarheeltribune.com/2026/01/29/no-16-unc-at-georgia-tech-tv-info-stats-scouting-jackets-keys-to-game-comparisons-and-notes/) | Simulated D1 average TO% must be **16–20%** |
| 5.2 | Team turnovers/game | Samples: UNC 10.9, Minnesota 11.7, Texas 10.7, Alabama 13.1; Houston committed only 8.5/gm (289 in 34 gm) while forcing 13.7/gm | Cumulative team stats; NCAA.com TO-margin leaders (https://www.ncaa.com/stats/basketball-men/d1/current/team/519) | Simulated D1 average team TO/game must be **10.5–13.5** |
| 5.3 | Best turnover-forcing teams | 2024-25: McNeese forced 559 (16.9/gm, +7.3 margin), High Point 558 (+7.1), Houston 466 (+5.2) | NCAA.com, same as 5.2 | Simulated best TO margin must be **+5.0 to +8.0**; worst **−5.0 to −8.0** |
| 5.4 | Steals/game (team) | D1 leader 2025-26: Bowling Green 13.0 spg (team); individual leader Javontae Campbell 3.69 spg. Typical good teams: 6–8 spg (Minnesota 7.2, Texas 5.6, Alabama 5.7) | NCAA.com (https://www.ncaa.com/news/basketball-men/article/2025-12-23/straight-10-college-basketballs-early-statistical-standouts?amp); cumulative team stats | Simulated D1 average team steals/game must be **6.0–8.5**; national leader 9.5–13.5 |
| 5.5 | Blocks/game (team) | Samples: Alabama 4.3, Texas ~3.6 (opp), Minnesota 3.0–3.3 | Cumulative team stats | Simulated D1 average team blocks/game must be **3.0–4.5** |
| 5.6 | Assist/turnover ratio (team) | Samples: UNC 1.3, Alabama 1.3, Minnesota 1.5–1.7, Texas 1.2 | Cumulative team stats | Simulated D1 average team A/TO ratio must be **1.1–1.6** |
| 5.7 | Assists/game (team) | Samples: Minnesota 18.4, Alabama 16.8, UNC 14.6, Texas 12.4 | Cumulative team stats | Simulated D1 average team assists/game must be **13–17** |

---

## 6. Player Lines

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 6.1 | National scoring leader | 2024-25: Eric Dixon (Villanova) 23.3 ppg on .451/.407/.813, 35 games | Wikipedia (https://en.wikipedia.org/wiki/Eric_Dixon_(basketball)); RealGM | Simulated national scoring leader must be **21–26 ppg**; no player above 28 ppg |
| 6.2 | Star-on-good-team scoring | Consensus All-American / conference POY tier: ~18–23 ppg (Dixon was 3rd-team All-American at 23.3 on a bubble team; Final Four stars typically 17–21) | Same as 6.1 + general consensus | Simulated top-25 KenPom teams must each have a leading scorer of **15–23 ppg** |
| 6.3 | Average team's leading scorer | **(est.)** ~12–14 ppg on a middle-of-the-pack D1 team | Estimate | Simulated median team's leading scorer must be **11–15 ppg** |
| 6.4 | Players in double figures per team | Bubble-team anchor: Villanova (20-15) had three 10+ ppg scorers (23.3, 15.3, 11.1) plus a 9.3 fourth | Villanova 2024-25 stats (http://villanova.sidearmsports.com/sports/mens-basketball/stats/2024-25) | Simulated average team must have **3–4 players ≥10.0 ppg** (league-wide average 3.0–4.2) |
| 6.5 | National assists leader | 2024-25: Ryan Nembhard (Gonzaga) 9.8 apg, 344 total (5th-most in D1 history) | Gonzaga athletics (https://gozags.com/sports/mens-basketball/roster/ryan-nembhard/5314); Wikipedia assists leaders list | Simulated national assists leader must be **8.0–10.5 apg**; no player above 11.5 apg |
| 6.6 | Typical team assists leader | **(est.)** ~4–6 apg (e.g., Villanova's leader 4.7 apg in 36 gm) | Estimate anchored by Villanova 2024-25 | Simulated median team's assists leader must be **3.5–6.5 apg** |
| 6.7 | 20+ ppg scorers per season | Only a handful nationally each year (typically 3–8 players clear 20 ppg) | General consensus; Dixon led at 23.3 | Simulated season must produce **2–10 players ≥20.0 ppg** |
| 6.8 | Double-doubles frequency | Elite rebounders (e.g., Delrecco Gillespie: 11 double-doubles in 12 games, 2025-26) show bigs regularly double-dip; national leader ~20+ double-doubles/season | NCAA.com (same as 5.4) | **(est.)** Simulated national double-double leader: **15–25** in a season |

---

## 7. Home Court Advantage

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 7.1 | Home win % (all D1) | Average D1 team wins **68.5%** at home vs **34.1%** on the road, since 2000; median home win% 67.7% (end of 2017-18) | NCAA.com (https://www.ncaa.com/news/basketball-men/article/2018-08-14/these-are-toughest-home-courts-college-basketball); arXiv 1909.04817 (https://arxiv.org/pdf/1909.04817) | Simulated home teams must win **62–72%** of non-neutral games |
| 7.2 | Home court point value | KenPom-style HCA ≈ **+3.0 points** for the D1 average; power-conference arenas run higher (Big 12 +3.5, SEC +3.3, Big Ten +3.2, ACC +2.8; low majors +2.0–2.5). Individual elite arenas (UConn/Marquette/Creighton tier) 3.5–3.9 | CBB analytics skill citing KenPom blog (https://github.com/cheadlee10/northstar-synergy); The Boneyard on 2024 KenPom (https://the-boneyard.com/threads/2024-kenpom.194140/) | If the sim models HCA as points, the effective boost must be **+2.5 to +4.0** for the average team; sim must also reproduce **7.1** (win%) as the binding check |
| 7.3 | Conference-play home win % | Big Ten Jan 2024: home teams won 73.2% (30 of 41) — conference play runs hotter than the overall average | 247sports (https://www.247sports.com/college/maryland/article/where-big-ten-basketball-stands-in-mid-january-maryland-terps-ncaa-tournament-projections-kenpom-net-ratings-purdue-wisconsin-indiana-illinois-northwestern-iowa-michigan-225596473/) | Simulated conference-game home win% must be **60–75%** |
| 7.4 | Neutral-site effect | Neutral games remove HCA (≈0 boost); KenPom win-probability math treats them as true neutral | Same modeling sources as 7.2 | Simulated neutral-site games must show **no systematic edge** (48–52% win rate for the nominal "home" team in title games) |

---

## 8. Competitive Balance

| # | Metric | Real-world value | Source | SIM MUST HIT |
|---|--------|------------------|--------|--------------|
| 8.1 | Top-to-bottom rating gap | 2024-25 final KenPom: #1 Duke +39.62 (highest since 1999) down to #364 Mississippi Valley State (AdjEM roughly −20s). Realistic full-range ≈ **55–65 efficiency points** | College Sports Network (https://collegefootballnetwork.com/mens-college-basketball/2025-final-four-new-benchmark-all-teams-above-35-00-kenpom-ratings/); Saturday Down South on 2024-25 preseason (No. 1 Houston to No. 364 MVSU) | Simulated best-minus-worst net efficiency gap must be **45–70 pts/100 poss** |
| 8.2 | Power-conference vs low-major gap | 2024-25: SEC was the best conference (preseason #1; six teams in KenPom top 25); 2023-24 avg KenPom rank: SEC 38.4 vs Big 12 42.2. Jan-2025 avg ranks: MWC 128, A-10 138, CUSA 153, MVC 155, AAC 169, WAC 207, Sun Belt 231, MAC 236. **(est.)** Avg AdjEM: top conferences ≈ +15 to +19; weakest ≈ −13 to −17 | Saturday Down South (https://www.saturdaydownsouth.com/news/college-basketball/kenpom-college-basketball-rankings-initial-projections-for-all-16-sec-squads/); Surly Horns (https://www.surlyhorns.com/board/topic/32591-kenpom-2024/); CSN BBS (https://csnbbs.com/thread-1003790.html) | If the sim has conferences: average team rating of the best conference must exceed the worst by **25–40 efficiency points** |
| 8.3 | #16-over-#1 upset rate | All-time (1985–2025): **2 of 160** (1.2%) — UMBC over Virginia 2018, FDU over Purdue 2023 | NCAA.com (https://www.ncaa.com/news/basketball-men/bracketiq/2022-03-14/7-signs-you-picked-too-many-ncaa-tournament-upsets); SportsBettingDime (158-2 record) | Simulated #1-vs-#16 tournament games: underdog win rate **0–4%** over many simmed tournaments |
| 8.4 | #15-over-#2 upset rate | All-time: **11 of 160** (6.9%) | SportsBettingDime (https://www.sportsbettingdime.com/college-basketball/march-madness/first-round-upsets/) | Simulated #2-vs-#15 games: underdog win rate **3–12%** |
| 8.5 | Full first-round upset table | All-time favorite win%: #1 98.8% / #2 93.1% / #3 85.6% / #4 79.4% / #5 64.4% / #6 62.2% / #7 60.7% / #8 48.1%. Upsets/year: 5–13, avg 7–9 | SportsBettingDime, same as 8.4 | Simulated 64-team tournaments must reproduce this gradient within **±5 percentage points per seed line** over ≥50 simmed tournaments; upsets per tournament **4–14** |
| 8.6 | 12-over-5 and 11-over-6 | #12 beats #5 35.6% all-time; #11 beats #6 37.8% (and 12-8 over last 5 years — 11s now upset more than 12s) | SportsBettingDime, same as 8.4 | Simulated #12 win rate **28–44%**; #11 win rate **30–46%** |
| 8.7 | Parity signal: single-season outliers | Mid-majors regularly crack the top 25 (Gonzaga #9 KenPom 2025 at +27.29; Houston's Final Four run etc.) — a good low-major is roughly a #25–40 power team | SI KenPom 2025 top-20 (http://si.com/college-basketball/kenpom-stats-say-about-2025-ncaa-tournament-predictions-favorites-top-offenses-defenses) | Simulated top mid-major teams must be able to reach **top-40 overall** in some seasons |

---

## Quick-check summary (the 10 numbers that matter most)

1. Avg team PPG: **70–76** (real ~73–75)
2. Avg tempo: **64–70** poss/game (real ~66–68)
3. Avg FG% / 3P% / FT%: **.425–.455 / .325–.355 / .690–.740**
4. 3PA share of FGA: **36–42%**
5. Avg OR%: **26–31%**; avg TO%: **16–20%**
6. Home win%: **62–72%**; HCA ≈ **+3 points**
7. Scoring leader: **21–26 ppg**; assists leader: **8–10.5 apg**; rebounding leader: **11–14.5 rpg**
8. 3–4 players ≥10 ppg per team; team's top scorer on a median team **11–15 ppg**
9. Best-minus-worst efficiency gap: **45–70 pts/100 poss**
10. Tournament upset gradient must match 8.3–8.6 (±5 pts per seed line); **4–14** first-round upsets per tournament

## Caveats
- Some figures above are early-season or partial-season samples (noted in Source column); bands were set wide enough to absorb that.
- SportsBettingDime's upset-history page contains two factual errors (it dates FDU-over-Purdue to 2025 and UMBC's win count); the win/loss records table (158-2 etc.) is consistent with NCAA.com's "twice in 40 tournaments" and was used instead.
- Rows marked **(est.)** could not be tied to a published hard figure in this pass — flag for re-verification against KenPom/BartTorvik season-summary tables before finalizing engine tuning.
