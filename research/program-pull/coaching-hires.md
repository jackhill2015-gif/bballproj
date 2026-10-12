# Coaching Hires 2010–2025 — Research Summary

**Date:** 2026-10-12
**Dataset:** `coaching-hires.json` — 70 notable Division I men's head-coaching hires, 2009–2025 (65 with complete before/after data; 5 from 2025 marked "too-early").

Each entry has: school, year, coach, previous job, 3 seasons before (wins, losses, NCAA appearance, best finish), 3 seasons after, recruiting rank where notable, whether transfers/recruits followed, an outcome label, and notes.

## Outcome definitions

- **Flop** (for flop-rate purposes): the hire failed — fired for performance, never reached the NCAA, or the program clearly declined. Includes: `flop`, `historic-flop`, `mediocre`, `mediocre-fired`, `decline`, `flash-then-flop`, `flash-then-fade`, `fired`, `flop-scandal`.
- **Success**: reached the NCAA and improved the program's standing.
- **Turnaround**: took over a bad program and made it good within 3 years.

## Key findings

### Flop rate: ~31%
20 of 65 completed hires (30.8%) flopped by the definition above. The most spectacular:
- **Kenny Payne, Louisville (2022)**: 4-28 then 8-24 — the worst seasons in program history.
- **Kevin Ollie, UConn (2012)**: won the 2014 title, then collapsed and was fired for violations.
- **Archie Miller, Indiana (2017)**: never reached the NCAA in 4 years.
- **Kyle Neptune, Villanova (2022)**: Final Four roster to three straight non-NCAA seasons.
- **Fred Hoiberg, Nebraska (2019)**: three straight 20-loss seasons to start.

### Turnaround speed: median 1 year to first NCAA
Of the 40 hires who reached the NCAA within 3 years, the **average was 1.6 years** and the **median was 1 year**. The big-name instant successes:
- **John Calipari, Kentucky (2009)**: Elite Eight year 1, title year 3.
- **Tommy Lloyd, Arizona (2021)**: 33-4 and Sweet 16 year 1.
- **Dusty May, Michigan (2024)**: 8-24 to 27-10 and Big Ten title year 1.
- **Pat Kelsey, Louisville (2024)**: 8-24 to 27-8 year 1.
- **Todd Golden, Florida (2022)**: 16-17 year 1, national title year 3.

The slow builds who became elite:
- **Tony Bennett, Virginia (2009)**: 3 years to first NCAA, title in year 10.
- **Kelvin Sampson, Houston (2014)**: 13-19 year 1 (teardown), then 8 straight 22+ win seasons, 2025 title game.
- **Dan Hurley, UConn (2018)**: 3 years to first NCAA, then back-to-back titles.

### Portal era (2021+) moves FASTER
Splitting at 2021 (the first full portal/NIL era):

| Metric | Pre-2021 (n=34) | 2021+ (n=31) |
|--------|-----------------|--------------|
| Avg years to first NCAA | 1.9 | 1.3 |
| Year-1 NCAA rate | 17.6% | 48.4% |
| Flop rate | 29.4% | 32.3% |

**Portal-era hires reach the NCAA faster** (1.3 vs 1.9 years) and **nearly half make it in year 1** (48% vs 18%). The transfer portal lets a new coach rebuild a roster in one offseason — Dusty May (Michigan), Pat Kelsey (Louisville), and Mark Byington (Vanderbilt) all flipped losing programs via the portal in a single year.

**But the flop rate is unchanged** (~30% both eras). The portal raises the ceiling (faster turnarounds) without lowering the floor — bad hires still fail at the same rate. It also creates volatility: Dennis Gates (Missouri) went 25-10 → 8-24 → 22-12 on portal-built rosters.

### Do recruits/transfers follow?
Yes, and it matters:
- **Calipari** brought the one-and-done pipeline to Kentucky (2010 #1 class: Wall, Cousins, Bledsoe).
- **Dusty May** brought FAU's Final Four core concept to Michigan via portal stars (Wolf, Donaldson).
- **Jerome Tang** (Kansas State) built a year-1 Elite Eight on portal stars (Nowell, Johnson) — then faded when they left.
- **Josh Schertz** brought his Indiana State core (Avila, Swope) to Saint Louis.
- **Darian DeVries** has had his son Tucker follow him from Drake to West Virginia to Indiana.

The pattern: coaches who bring proven players (via portal or recruiting) win immediately; coaches who bet on development take 2-3 years.

## Sources

- Season-by-season coaching records: https://www.sports-reference.com/cbb/coaches/ (Calipari, Hurley, and others verified here)
- Tony Bennett Virginia record: https://www.sportingnews.com/us/ncaa-basketball/news/tony-bennett-retire-virginia-basketball-coach-cavaliers/dcf2d599ba3ba1b816254343 and https://en.wikipedia.org/wiki/Tony_Bennett_(basketball)
- Dan Hurley UConn record: https://uconnhuskies.com/documents/download/2025/8/19/25-26_Record_Book_V3.pdf and https://en.wikipedia.org/wiki/Dan_Hurley
- Kelvin Sampson Houston record: https://uhcougars.com/sports/mens-basketball/roster/coaches/kelvin-sampson/1798 and https://en.wikipedia.org/wiki/Kelvin_Sampson
- John Calipari record: https://www.sports-reference.com/cbb/coaches/john-calipari-1.html and https://basketballquant.com/coaches/john-calipari
- FBS conference structure: https://en.wikipedia.org/wiki/NCAA_Division_I_Football_Bowl_Subdivision

## Use in HOOPS OS

This dataset informs a coaching-carousel model:
- **Base flop rate**: ~30% — a new hire has roughly a 1-in-3 chance of failing outright.
- **Turnaround speed**: median 1 year to NCAA; elite hires can win immediately, slow-builders take 3 years.
- **Portal era modifier**: post-2021 hires should get a "portal rebuild" boost — faster year-1 improvement, but higher variance (boom/bust).
- **Follower mechanic**: when a successful coach moves, there's a chance key players follow (transfer or recruit).
- **Patience**: the best long-term hires (Bennett, Sampson, Golden) looked mediocre in year 1-2. A "hot seat" system should account for this.
