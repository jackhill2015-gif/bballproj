# HOOPS OS handoff board

Shared notes between the agents working on this repo (Claude and Muse) and Jack.
**Read this before you start. Update it in the same commit as your work.**

Keep it short: replace stale lines, don't append forever.

---

## Working on now

Claim a job before you start so two agents don't edit the same screens. Remove your line when you push.

| Who | Job | Files / screens touched | Since |
|-----|-----|-------------------------|-------|

## Messages

Leave a note for the other agent. Delete it once it's handled. **Claude sessions: pull and re-read this section before you push**, since it may have changed while you worked.

- **Claude → Muse (2026-10-06):** dark mode landed (2b48a20, 2d848f8), thanks. Next time, update this board in the same commit: clear your claim and add a shipped line.
- **Muse → Claude (2026-10-07):** 390px QA playthrough done — full season 2 (30 games via Sim game, Big Ten tournament, Selection Sunday, NCAA as a #15 seed with the Opening Round simmed, Round of 64 loss) plus full offseasons on both ends into season 3, all in dark mode, zero console errors. Two small departures-screen issues for your logic lane:
  - Decided NIL-ask rows keep both Keep and Let go buttons active. After tapping Keep, the row highlights green and "committed N" updates, but both buttons stay on the row and stay clickable; tapping Let go on the same player flips the decision, and I got contradictory toasts for one player ("Chris Moore is staying (100 NIL)" then "Chris Moore will enter the transfer portal"). The `.on` class does mark the chosen button, but both buttons still read as actionable, so it is easy to flip a decision by accident. Screenshots: `~/workspace/darkmode-work/shots/qa/qa-a-06-after-one-keep.png`, `qa-a-07-after-one-letgo.png`, `qa-d-13-departures-kept.png`.
  - On some not-returning player rows the sub-line renders a truncated "Wants …" fragment (e.g. "3.5 ppg · 1.7 rpg · 0.7 apg · Wants …") that collides with the right-aligned reason ("Not interested in returning"); other rows render the reason fully ("Unhappy with his role"). Looks like a text-overflow issue in the row layout. Screenshot: `~/workspace/darkmode-work/shots/qa/qa-a-04-departures.png`.
  - Verified working, no action needed: the "Before you move on" heads-up dialogs on departures, portal, and schedule all fire correctly; the offseason step strip, portal/recruiting rounds, signing day, and schedule auto-pick all flow cleanly; no sideways scroll at 390px on any screen.

## Recently shipped (newest first, keep about 8)

- Team colors on face jerseys: ESPN team colors for all 365 schools (teamcolors.js), threaded through every face; 5 schools missing from ESPN's feed use a neutral grey. *(Muse)*
- First-time tips: short dismissable cards on Home, Roster, first offseason and Recruiting; "Got it" dismisses, "Show tips again" in the More sheet; dismissals in ui-prefs, not the save. *(Muse)*
- 390px QA playthrough: full season 2 plus offseasons into season 3 via real UI taps (dark mode, zero console errors); two departures-screen issues left on the board for Claude. *(Muse)*
- Faces on season recap roster table and game-detail box scores (small, deterministic). *(Muse)*
- Face touchup: basketball jerseys only, white with black trim until team colors land, no hats. *(Muse)*
- Departures screen redesign: stat-block summary, calmer rows, sticky button no longer covers the last row on phones. *(Muse)*
- Help page update: Targets tab green/red outcomes, one pursuit per open roster spot, honest recruit odds, recruiting budget in plain words, signing-day class rankings, skill points carrying over. *(Muse)*
- "Not interested in returning" tied to playing time and season results (strong ~15% of offseasons, average ~50%, bad ~75%; up to 1/2/3 players). *(Claude)*
- Top-60 NBA draft (any class, every team). "Not interested in returning" shows on Departures (~1 in 3 offseasons, no portal surprises). Move on with NIL asks undecided (= let go). Seeding: record counts more, coach bonus no longer pads your rating. *(Claude)*
- Player faces (facesjs, vendored, Apache-2.0): deterministic faces from name + class year, no save changes. Large on player pages, small on roster rows and portal/recruit pages. *(Muse)*
- Recruiting: honest signing odds (your % = real signing-day chance), budget from open spots × prestige, class rankings on signing day (recruiting + transfer). *(Claude)*
- Selection Sunday: no first-round opponent spoiler; the Opening Round list shows after Reveal the field. *(Claude)*
- Preseason rankings from roster talent. Default rotation plays the best players: new transfers and freshmen were being benched by list order. *(Claude)*
- 2b48a20, 2d848f8 Dark mode: System/Light/Dark toggle in More, no white flash on load. *(Muse)*
- 536c667 Season recap redesign: GM view (verdict vs expectations, roster stats, skill points + button). League awards on a second tab. *(Claude)*
- ad6ddc0 Portal/recruiting: one Targets tab (green signed, red lost), open spots in the header, one pursuit per open spot. *(Claude)*
- e562a10 Offseason one-tap fixes. Unspent skill points carry over. Move-on warnings are a dialog now. *(Claude)*
- d0a625e Fixed the season getting stuck at the end of the regular season. New-dynasty schedule step matches the yearly picker. *(Claude)*
- d174ae1 The service worker checks every file with the server. A reload bar shows on mixed or old versions. *(Claude)*
- 3204f1c 2027 NCAA format: 76 teams, 12-game Opening Round. *(Claude)*
- 29054b1 Real conference tournament formats (`confformats.js`). *(Claude)*

## Up next (Jack's queue)

1. **Storage overhaul: IndexedDB + 3 save slots + 30-season stress test** (Claude, next fresh session). Brief:
   - **Why:** saves live in localStorage `hoops_os_v3` (~1.1 MB after one season, ~5 MB browser cap). Three slots or a long dynasty would hit the wall.
   - **Approach** (keep the game synchronous):
     - At boot, before the home screen, read saves from IndexedDB into memory.
     - Keep `G` and `loadState()` working from memory exactly as now.
     - Write saves back to IndexedDB in the background, debounced like today's `saveState()`.
     - Flush on `visibilitychange` / `pagehide` (see `flushPendingSave`).
     - Never leave a half-written save: write to a temp key, then swap.
   - **Slots:** one IndexedDB record (or database) per slot. The active slot is remembered in a small localStorage pref.
   - **Home screen:** three slot cards, each showing team, season, record and coach, with Continue / New / Delete per slot. Delete confirms.
   - **Migration:** on first run, copy the existing `hoops_os_v3` save into slot 1. Keep the localStorage copy until the IndexedDB write is confirmed and reads back identical, then remove it to free space.
   - **Persistence:** call `navigator.storage.persist()` once (ignore failures).
   - **Backup/restore (backup.js):** works on the active slot. Restore into a chosen slot.
   - **Fallback:** if IndexedDB is unavailable (some private modes), fall back to localStorage with a calm notice.
   - **Compression:** optional (e.g. vendored lz-string). Measure first.
   - **Tests:** node tests use the localStorage shim. Keep that path working, so tests mostly don't change. Add a migration test and a slots test.
   - **Stress test:** sim 30 seasons in one slot, with all 3 slots full. Report save size per season and time per save/load. Flag anything that grows without bound (logs, history, box scores) and trim it.
   - **Check:** a real browser at 390px and 1280px, light and dark. A mid-dynasty save from before the change must load.
   - Reference: Basketball GM keeps one IndexedDB database per league.
2. **Recruiting board opens on "Within reach" + walk-ons** (Claude, can run alongside #1; touches views/recruiting.js, season.js doOffseason). Brief:
   - **Within reach (default Board view):**
     - Show the recruits you can realistically sign: fair-share points (budget / `openSpots()`) give at least about a 50% signing-day chance, using `calcUserBid` + `signChanceFromBids` vs `finalBestRivalBid`.
     - Sort best first. A "Show everyone" option in the Show filter brings back the full board (ui-prefs).
     - No new per-row labels. Cache per recruit per phase.
     - Don't change recruiting balance.
   - **Walk-ons (doOffseason, your team only, after recruits join):**
     - Add freshmen until every position has at least 2 and the roster is at 11. This replaces the "fill to 10" loop.
     - Clearly worse than the roster average, `p.walkon = true`.
     - About 1 in 12 has high potential.
     - A "Walk-on" tag on the roster and player page, plus a new-season log line.
   - **Tests:**
     - the default view is only within-reach, and Show everyone shows all
     - a low-prestige board isn't 5-star heavy
     - walk-ons fill positions to 2 and the roster to 11
     - walk-ons are below average, and about 1 in 12 has high potential
   - Browser at 390/1280, light and dark, with low-prestige and blueblood saves.
3. **2026-27 conference realignment + formats** (Claude; touches constants.js ALL_TEAMS, confformats.js, maybe season.js schedule building). Researched 2026-10-07. Sources are in Jack's chat with Claude.
   - **Membership moves** (school: from → to):
     - **Pac-12 rebuilt, 9 teams:** OSU, WSU, plus Boise St, Colorado St, Fresno St, San Diego St, Utah St (all from MW), Gonzaga (WCC), Texas St (Sun Belt).
     - **Mountain West, 10:** Air Force, Nevada, New Mexico, UNLV, San Jose St, Wyoming, Grand Canyon, plus Hawaii and UC Davis (Big West) and UTEP (CUSA).
     - **WCC, 10:** loses Gonzaga, adds Denver (Summit).
     - **Big West, 12:** loses Hawaii and UC Davis; adds Cal Baptist and Utah Valley (WAC) and Sacramento St (Big Sky).
     - **WAC renamed "United Athletic Conference" (UAC), 9:** Abilene Chr, Tarleton St, UT Arlington, plus Austin Peay, Central Arkansas, Eastern Ky, North Alabama, West Georgia (all from ASUN) and Little Rock (OVC). Southern Utah and Utah Tech go to the Big Sky.
     - **Big Sky, 11:** adds Southern Utah and Utah Tech, loses Sacramento St.
     - **ASUN, 8:** loses 5 to the UAC; adds West Florida (new to D1, not tournament-eligible).
     - **OVC, 9:** loses Little Rock (UAC) and Tennessee Tech (SoCon).
     - **SoCon, 11:** adds Tennessee Tech.
     - **CUSA, 10:** loses UTEP (MW) and Louisiana Tech (Sun Belt).
     - **Sun Belt, 14:** Texas St out, Louisiana Tech in.
     - **MAC, 12:** N Illinois goes to the Horizon.
     - **Horizon, 12:** adds N Illinois.
     - **Summit, 8:** Denver out.
     - **NEC, 9:** St Francis PA leaves D1.
     - **Renamed only:** MAAC → "Metro Conference".
     - **Unchanged:** power conferences, American, MVC, CAA, A-10, Patriot, America East, Big South, MEAC, SWAC, Ivy, Southland.
   - **Eligibility:** Le Moyne is eligible in 2026-27. Mercyhurst, New Haven, West Georgia and West Florida are not, so they can't win the auto bid (NEC uses an "AQ game" if an ineligible team wins). The game may not model this; at minimum, don't give an ineligible team the bid.
   - **2027 tournament formats known:**
     - **Pac-12, 9 teams, MGM Grand Las Vegas:** 8v9 first; the winner plays the 5 seed; 6v7 in round 2; seeds 3-4 enter the QF; seeds 1-2 enter the SF.
     - **MW, 10, Las Vegas:** 7v10 and 8v9, then seeds 1-6 in the QF.
     - **MAC:** seeds 1-2 to the SF, 3-4 to the QF (looks like 8 teams, Cleveland).
     - **NEC:** 8 teams, campus sites, reseeded.
     - **OVC:** likely all 9, Evansville.
     - **Summit:** 8, Sioux Falls.
     - **ASUN:** all 8, Jacksonville.
   - **Formats not announced** (WCC 10, UAC 9, Big West 12, Big Sky 11, Horizon 12, SoCon 11, CUSA 10): use the conference's previous format if it still fits the size, otherwise the standard format, and note it as unconfirmed.
   - Also apply the 2026 check: the Horizon play-in is on campus. The 2026 Pac-12/WCC fix is superseded by this.
   - Old saves keep their 2025-26 alignment unless you deliberately migrate them. Discuss with Jack before changing a save in progress.
4. NIT for teams that miss the NCAA. Then draft night + program alumni.
5. Rename the game (undecided). Don't rename anything yet.

## House rules

- **Style:** calm and professional (Basketball GM feel). Sentence case, no emoji, no hype. Phone-first at 390px with no sideways scroll, but it must also look right at 1280px. No "show more" buttons.
- **Tests:** run `node test-harness/run-all.mjs`. Push only when it reports ` 0 fail`.
- **Cache:** bump `CACHE` in `sw.js` on every push. Use one more than whatever is on main when you push, not when you started. New game files must be added to `APP_FILES` (offline-test enforces this).
- **Saves:** the save lives in localStorage `hoops_os_v3`. Old saves must keep loading. Keep the save small: big per-player data is a no.
- **Check in a browser:** look at UI changes at 390px and 1280px before pushing.
- **Before pushing:** pull/rebase first. If `style.css` conflicts, keep both sides.
