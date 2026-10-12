# Basketball Priority — Research Summary

**Date:** 2026-10-12
**Dataset:** `basketball-priority.json` (365 schools, keyed by `ALL_TEAMS` names from `constants.js`)

## Methodology

Each school is classified as **basketball-first**, **football-first**, or **balanced** based on:
1. **FBS football status** — the primary structural signal. Schools in the 10 FBS conferences (ACC, Big Ten, Big 12, SEC, American, CUSA, MAC, Mountain West, Pac-12, Sun Belt) plus FBS independents (Notre Dame, UConn, Army, Navy) were evaluated individually. Schools in non-FBS conferences default to basketball-first, since football (where it exists) is FCS or absent and draws a fraction of the money and attention.
2. **Money** — football accounts for roughly 75% of revenue at most big athletic programs (CNBC's 2024 valuations via Michael Ozanian). Schools where basketball is the revenue and donor driver (Duke, Kansas, Kentucky, UConn, Gonzaga, etc.) are basketball-first despite FBS membership.
3. **Identity and history** — national titles, Final Fours, iconic coaches, and fan culture. A school like Indiana (basketball blue blood, weak football) is basketball-first; Alabama (football blue blood) is football-first.
4. **NIL/revenue-share reporting** — where public reporting indicates which sport drives donor collectives.

## Results

| Priority | Count | Share |
|----------|-------|-------|
| basketball-first | 257 | 70% |
| balanced | 70 | 19% |
| football-first | 38 | 11% |

- **80 judgment calls** are flagged in the JSON (`judgment_call: true`). These are schools where reasonable people could disagree — typically Group-of-5 schools with no dominant sport, or power-conference schools with real strength in both (e.g., Michigan State, Florida, Baylor).
- All 22 non-FBS conferences default to basketball-first (257 of the 257 basketball-first schools are non-FBS, plus 8 FBS basketball schools: Duke, UNC, Kansas, Kentucky, UConn, Indiana, UCLA, Louisville, Syracuse, Purdue, Illinois, Maryland, Arizona, Houston, Memphis, Temple, San Diego State, New Mexico, UNLV, Gonzaga... — see JSON for the full list).

## Notable judgment calls

- **Virginia** → basketball-first (2019 title under Tony Bennett outweighs solid football).
- **NC State, Pitt, Stanford, Cal, Boston College** → balanced (real history in both).
- **Wake Forest** → basketball-first (small private; Duncan-era tradition).
- **Vanderbilt, UTEP, New Mexico State, Kent State, UMass, Western Kentucky** → basketball-first (basketball tradition, weak football).
- **Iowa, Mississippi State, Ole Miss, South Carolina** → football-first (football meaningfully bigger despite decent basketball).
- **Army, Navy, Air Force** → football-first (service academies; football is the institutional identity).
- **Wichita State, Grand Canyon** → basketball-first (no football program at all).
- **UConn** → basketball-first (basketball blue blood; FBS independent football is secondary).

## Sources

- NCAA Division I FBS conferences (10) and independents: https://en.wikipedia.org/wiki/NCAA_Division_I_Football_Bowl_Subdivision
- Group of Six membership: https://en.wikipedia.org/wiki/Group_of_Five_conferences
- Power conference membership 2025–26: https://en.wikipedia.org/wiki/Power_Five_conferences
- Athletic department revenue/valuations (football ~75% of revenue at big programs): https://www.nbcsportsphiladelphia.com/news/sports/most-valuable-college-athletic-programs/637222/ and https://247sports.com/college/michigan/longformarticle/college-athletics-25-powerhouses-who-produce-the-most-revenue-entering-2024-233312519/
- Conference realignment 2025 (Delaware/Missouri State to CUSA, UMass to MAC): https://en.wikipedia.org/wiki/2025_NCAA_Division_I_FBS_football_season

## Use in HOOPS OS

This dataset is intended to inform a "program pull" recruiting model: basketball-first schools should have an edge signing basketball recruits (and be more attractive to basketball coaches), football-first schools the reverse, balanced schools neutral. The `judgment_call` flag lets the game treat borderline cases with less confidence.
