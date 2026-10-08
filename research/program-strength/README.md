# Real program strength vs the game's school ratings

Applied 2026-10-08 (Jack approved the blend): every school's `o` in constants.js is now `o_blend`. It sets prestige and starting talent for new dynasties; existing saves keep their saved prestige.

## Method

ESPN results for every Division I game, 2016-17 through 2025-26 (sportsdataverse schedule files, the same source as research/rankings). For each season, a schedule-adjusted margin rating like the game's own power rating: margins capped at 20, 3.5 home points removed, rating = average margin + average opponent rating, solved across the league. Program strength = the ten-season average with the last five seasons counting double. Script: `scripts/rate.py`; per-season numbers in `program-strength.json`. All 365 schools matched (ESPN spells some differently or used older names, e.g. Pittsburgh, IUPUI, Texas A&M-Commerce); programs new to Division I have fewer seasons and lean on their current rating.

Each school's game rating (`o` in constants.js) sets its prestige (recruiting gates, CPU recruiting pull) and its starting talent. `o_new` hands out the game's own rating values in real-strength order, so the overall spread of talent stays the same. `o_blend` is halfway between today's value and `o_new`: it keeps brand (titles, history) in the mix.

## Top 40 by real strength

| Real | School | Conf | Strength | Game o (rank) | o_new | o_blend |
|---|---|---|---|---|---|---|
| 1 | Gonzaga | Pac-12 | 14.9 | 90 (#10) | 94 | 92 |
| 2 | Duke | ACC | 14.9 | 94 (#1) | 93 | 94 |
| 3 | Houston | Big 12 | 14.8 | 90 (#9) | 93 | 92 |
| 4 | Purdue | Big Ten | 13.9 | 91 (#7) | 92 | 92 |
| 5 | Arizona | Big 12 | 13.8 | 91 (#6) | 91 | 91 |
| 6 | Kansas | Big 12 | 13.2 | 93 (#2) | 91 | 92 |
| 7 | Tennessee | SEC | 13.1 | 91 (#8) | 91 | 91 |
| 8 | Auburn | SEC | 12.5 | 87 (#18) | 91 | 89 |
| 9 | Alabama | SEC | 12.3 | 89 (#12) | 90 | 90 |
| 10 | Michigan State | Big Ten | 12.1 | 86 (#21) | 90 | 88 |
| 11 | Florida | SEC | 11.9 | 85 (#26) | 89 | 87 |
| 12 | North Carolina | ACC | 11.8 | 91 (#5) | 89 | 90 |
| 13 | Kentucky | SEC | 11.8 | 92 (#4) | 88 | 90 |
| 14 | Michigan | Big Ten | 11.6 | 83 (#34) | 88 | 86 |
| 15 | Baylor | Big 12 | 11.5 | 89 (#11) | 88 | 88 |
| 16 | Texas Tech | Big 12 | 11.3 | 86 (#20) | 87 | 86 |
| 17 | UConn | Big East | 11.1 | 93 (#3) | 87 | 90 |
| 18 | Villanova | Big East | 11.1 | 86 (#24) | 87 | 86 |
| 19 | Saint Mary's | WCC | 10.7 | 81 (#51) | 87 | 84 |
| 20 | Illinois | Big Ten | 10.6 | 88 (#14) | 86 | 87 |
| 21 | Wisconsin | Big Ten | 10.4 | 85 (#25) | 86 | 86 |
| 22 | UCLA | Big Ten | 10.2 | 86 (#22) | 86 | 86 |
| 23 | Iowa State | Big 12 | 10.0 | 88 (#13) | 86 | 87 |
| 24 | Creighton | Big East | 9.8 | 86 (#23) | 86 | 86 |
| 25 | San Diego State | Pac-12 | 9.8 | 84 (#30) | 85 | 84 |
| 26 | Arkansas | SEC | 9.5 | 83 (#36) | 85 | 84 |
| 27 | Texas | SEC | 9.4 | 88 (#15) | 84 | 86 |
| 28 | Ohio State | Big Ten | 9.4 | 87 (#17) | 84 | 86 |
| 29 | Virginia | ACC | 9.3 | 87 (#16) | 84 | 86 |
| 30 | Marquette | Big East | 9.1 | 87 (#19) | 84 | 86 |
| 31 | Clemson | ACC | 9.0 | 79 (#63) | 83 | 81 |
| 32 | BYU | Big 12 | 8.9 | 83 (#32) | 83 | 83 |
| 33 | Iowa | Big Ten | 8.9 | 84 (#27) | 83 | 84 |
| 34 | St. John's | Big East | 8.7 | 82 (#47) | 83 | 82 |
| 35 | Oregon | Big Ten | 8.6 | 83 (#35) | 83 | 83 |
| 36 | Utah State | Pac-12 | 8.4 | 79 (#70) | 83 | 81 |
| 37 | Maryland | Big Ten | 8.3 | 82 (#42) | 83 | 82 |
| 38 | Oklahoma | SEC | 8.3 | 82 (#44) | 82 | 82 |
| 39 | Cincinnati | Big 12 | 8.1 | 82 (#40) | 82 | 82 |
| 40 | Xavier | Big East | 8.1 | 81 (#52) | 82 | 82 |

## Biggest moves with the blend

| School | Conf | Today | Blend | Real rank |
|---|---|---|---|---|
| Seattle U | WCC | 60 | 65 | 142 |
| Wofford | SoCon | 61 | 66 | 132 |
| Boise State | Pac-12 | 74 | 78 | 44 |
| Santa Clara | WCC | 66 | 70 | 89 |
| Montana | Big Sky | 60 | 64 | 157 |
| ETSU | SoCon | 64 | 68 | 123 |
| Eastern Washington | Big Sky | 59 | 63 | 176 |
| Northern Colorado | Big Sky | 58 | 62 | 174 |
| St. Thomas | Summit | 58 | 62 | 177 |
| Michigan | Big Ten | 83 | 86 | 14 |
| Nevada | MW | 75 | 78 | 50 |
| New Mexico | MW | 73 | 76 | 72 |
| Colorado State | Pac-12 | 73 | 76 | 69 |
| Saint Mary's | WCC | 81 | 84 | 19 |
| LMU | WCC | 63 | 66 | 161 |
| UConn | Big East | 93 | 90 | 17 |
| Western Michigan | MAC | 65 | 62 | 300 |
| Detroit Mercy | Horizon | 66 | 63 | 297 |
| IU Indianapolis | Horizon | 61 | 58 | 358 |
| Green Bay | Horizon | 64 | 61 | 318 |
| Manhattan | Metro | 64 | 61 | 319 |
| Siena | Metro | 67 | 64 | 244 |
| Lehigh | Patriot | 65 | 62 | 287 |
| Denver | WCC | 65 | 62 | 306 |
| NC A&T | CAA | 61 | 58 | 343 |
| Air Force | MW | 68 | 64 | 283 |
| Holy Cross | Patriot | 64 | 60 | 352 |
| Oral Roberts | Summit | 70 | 66 | 223 |
| Cal Poly | Big West | 64 | 60 | 327 |
| UTSA | American | 69 | 64 | 277 |

## What this does and doesn't fix

- The game's ratings already track reality well at the top. The clear misses are programs whose last decade beat their reputation in the game: Saint Mary's (81, real #19), Gonzaga (90, real #1), Auburn, Michigan State, Florida, Michigan, Clemson, Utah State, San Diego State, Boise State, Nevada.
- Results alone would drop UConn (93 to 87) and Kentucky (92 to 88): a ten-year average undercounts titles and brand, which is why the blend is the better choice for prestige.
- It won't, by itself, put mid-majors in the Top 25. Even on real results the best true mid-majors rate 73-78 (Yale 76, Belmont 74, UC Irvine 74, Liberty 74, Drake 74, Akron 72). Real ranked mid-majors come from single peak seasons: veteran rosters (fifth-year seniors, transfers who stay) that play well above the program's average. The game would need occasional experienced, high-continuity mid-major rosters for that. That is a separate change to roster turnover, not to prestige.
- Note: Gonzaga and Saint Mary's are not mid-majors in the game's tiers (Pac-12 from 2026, WCC counted as high-major like the rankings research).
