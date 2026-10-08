# School display names — changes

Source: ESPN public team data (site.api.espn.com, mens-college-basketball, fetched 2026-10-07),
then Jack's naming rules. 365 teams total, 79 renamed. Unchanged names map to themselves
in research/team-names.json.

## Renamed schools (current -> new)

- `Abilene Chr` -> `Abilene Christian`
- `Alabama St` -> `Alabama State`
- `Albany` -> `UAlbany`
- `Alcorn St` -> `Alcorn State`
- `Arizona St` -> `Arizona State`
- `Arkansas St` -> `Arkansas State`
- `Arkansas-Pine Bluff` -> `UAPB`
- `Boise St` -> `Boise State`
- `Boston Coll` -> `Boston College`
- `Boston U` -> `Boston University`
- `CSU Fullerton` -> `Cal State Fullerton`
- `CSU Northridge` -> `Cal State Northridge`
- `Cal` -> `California`
- `Cent Michigan` -> `Central Michigan`
- `Charleston So` -> `Charleston Southern`
- `Chicago St` -> `Chicago State`
- `Cleveland St` -> `Cleveland State`
- `Colorado St` -> `Colorado State`
- `Coppin St` -> `Coppin State`
- `Delaware St` -> `Delaware State`
- `E Michigan` -> `Eastern Michigan`
- `Eastern Ky` -> `Eastern Kentucky`
- `Fairleigh Dick` -> `FDU`
- `Florida Atl` -> `Florida Atlantic`
- `Florida St` -> `Florida State`
- `Fresno St` -> `Fresno State`
- `Georgia St` -> `Georgia State`
- `IU Indy` -> `IU Indianapolis`
- `Illinois St` -> `Illinois State`
- `Indiana St` -> `Indiana State`
- `Jackson St` -> `Jackson State`
- `Jacksonville St` -> `Jacksonville State`
- `K-State` -> `Kansas State`
- `Kennesaw St` -> `Kennesaw State`
- `Long Beach St` -> `Long Beach State`
- `Loyola Chi` -> `Loyola Chicago`
- `Md Eastern Shore` -> `Maryland Eastern Shore`
- `Miami FL` -> `Miami`
- `Miami OH` -> `Miami (OH)`
- `Michigan St` -> `Michigan State`
- `Middle Tenn` -> `Middle Tennessee`
- `Miss State` -> `Mississippi State`
- `Mississippi Valley State` -> `MVSU`
- `Missouri St` -> `Missouri State`
- `Morehead St` -> `Morehead State`
- `Morgan St` -> `Morgan State`
- `N Illinois` -> `Northern Illinois`
- `N Kentucky` -> `Northern Kentucky`
- `New Mexico St` -> `New Mexico State`
- `Norfolk St` -> `Norfolk State`
- `North Carolina Central` -> `NC Central`
- `North Dakota St` -> `North Dakota State`
- `Northwestern St` -> `Northwestern State`
- `Oklahoma St` -> `Oklahoma State`
- `Prairie View` -> `Prairie View A&M`
- `S Illinois` -> `Southern Illinois`
- `San Diego St` -> `San Diego State`
- `San Jose St` -> `San Jose State`
- `South Dakota St` -> `South Dakota State`
- `Southeast Missouri State` -> `Southeast Missouri`
- `Southern U` -> `Southern`
- `St Bonaventure` -> `St. Bonaventure`
- `St Francis PA` -> `Saint Francis`
- `St John's` -> `St. John's`
- `St Peter's` -> `Saint Peter's`
- `St. Thomas (MN)` -> `St. Thomas`
- `Stephen F Austin` -> `Stephen F. Austin`
- `Tarleton St` -> `Tarleton State`
- `Tennessee Martin` -> `UT Martin`
- `Texas A&M-Corpus Christi` -> `Texas A&M-CC`
- `Texas St` -> `Texas State`
- `UNC` -> `North Carolina`
- `UNCW` -> `UNC Wilmington`
- `Utah St` -> `Utah State`
- `W Illinois` -> `Western Illinois`
- `W Michigan` -> `Western Michigan`
- `Western Ky` -> `Western Kentucky`
- `Wichita St` -> `Wichita State`
- `Youngstown St` -> `Youngstown State`

## Judgment calls

- Initials kept where fans actually use them, beyond the listed examples: ETSU, FIU, FDU, LIU, LMU,
  UCSB, UTRGV, ULM, UNI, CCSU, NC A&T, MVSU, UAPB. (VMI, UTEP, UTSA, SIUE were already initials.)
- Middle Tennessee and Western Kentucky kept spelled out (ESPN/broadcast standard) rather than MTSU/WKU.
- Penn, Pitt, American kept short: school brands, and "Pennsylvania" would read as Penn State.
- SC State kept short: the school brands itself SC State (scsu.edu).
- California Baptist -> "Cal Baptist": common short form; ESPN's full name is 20 characters.
- New Orleans: ESPN lists the odd "LSU New Orleans"; broadcasts say "New Orleans".
- St. Thomas (MN) -> "St. Thomas": only one in D1, so no disambiguator needed.
- Hawaii kept without the okina (ESPN: "Hawai'i").
- Saint Francis (PA): absent from ESPN's feed (moved to D3); used the school's own "Saint Francis".
- Southern Indiana (20 chars), Queens, Lindenwood: absent from ESPN's feed; kept as-is.
- Cal State Fullerton (19) and Cal State Northridge (20): kept per the system-school branding rule,
  slightly over the 18-character aim.
- Charleston Southern (19): kept as the actual school name.
- Maryland Eastern Shore (22): Jack's explicit example; kept despite length.
- Southeast Missouri State -> "Southeast Missouri" (18) rather than "SEMO".
- East Texas A&M: ESPN has renamed the school (was Texas A&M-Commerce); used the current name.
- IU Indy -> "IU Indianapolis": school renamed from IUPUI.
- K-State -> "Kansas State": rule 3 ("State" always spelled out) wins over the nickname.

## For Claude (applying the list)

- team-names.json maps CURRENT constants.js ALL_TEAMS names to new names. Old saves store the
  current names, so the rename needs a migration or lookup that handles both.
- teamcolors.js is keyed by school name: its keys must follow the renames (79 schools).