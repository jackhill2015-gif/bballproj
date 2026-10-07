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
- **Claude → Muse (2026-10-07):** heads-up, the home screen markup changed: `#home-slots` is rendered by `showHomeScreen()` in views/setup.js (the static save card in index.html is gone). New styles are at the end of style.css under "HOME: SAVE SLOTS". Thanks for the QA pass: both departures issues are fixed (decided rows show Staying / Entering the portal + Change; the reason gets its own line).

## Recently shipped (newest first, keep about 8)

- Within reach scales with your program: a recruit is within reach if a top target's worth of points (2 x budget / open spots, at most the budget) gives 50%+ on signing day. Bluebloods see the 5-stars they can land (Duke: all 10), mid-majors top out at 4-stars, small schools see the best players at their level. *(Claude)*
- 2026-27 realignment for new dynasties: Pac-12 rebuilt (9), MW 10, Big West 12, WAC → UAC (9), MAAC → Metro, and the rest of Jack's list; St Francis PA leaves D1, West Florida takes its slot. 2027 tournament formats (announced ones exact, the rest marked "not announced yet; assumed"). Saves from before keep 2025-26 (`G.align`). Reclassifying schools can't take a bid: an ineligible champion's automatic bid goes to the runner-up. *(Claude)*
- Departures fixes from Muse's QA: decided NIL rows show the outcome with a quiet Change; not-returning reasons wrap on their own line. Flaky tests fixed (retention, s-fixes, features, opening-round). *(Claude)*
- Recruiting Board opens on "Within reach": recruits your fair share of points (budget / open spots) signs at 50%+, best players first; "Show everyone" in the Show filter (remembered). Walk-ons at season start: every position gets 2 and the roster 11 (replaces fill-to-10), well below the roster average, about 1 in 12 a high-potential gem who really grows; "Walk-on" tag on roster and player page, new-season log line. *(Claude)*
- Storage overhaul: saves in IndexedDB (read into memory at boot, written in the background), 3 save slots on the home screen (Continue / New / Back up / Delete), restore into a chosen slot. The old localStorage save moves into slot 1 on first run. localStorage fallback with a notice when IndexedDB is unavailable. 30-season stress test: save stays ~1.0-1.2 MB (CPU coach firing history was the only unbounded part; now capped at 5 per team). Also fixed: Back up on the home screen could overwrite the dynasty. *(Claude)*
- Team colors on face jerseys: ESPN team colors for all 365 schools (teamcolors.js), threaded through every face; 5 schools missing from ESPN's feed use a neutral grey. *(Muse)*
- First-time tips: short dismissable cards on Home, Roster, first offseason and Recruiting; "Got it" dismisses, "Show tips again" in the More sheet; dismissals in ui-prefs, not the save. *(Muse)*
- Tapping the Hoops OS logo in the top bar goes Home. *(Claude)*
- 390px QA playthrough: full season 2 plus offseasons into season 3 via real UI taps (dark mode, zero console errors); two departures-screen issues left on the board for Claude. *(Muse)*
- Faces on season recap roster table and game-detail box scores (small, deterministic). *(Muse)*

## Up next (Jack's queue)

1. NIT for teams that miss the NCAA. Then draft night + program alumni.
2. Rename the game (undecided). Don't rename anything yet.

## House rules

- **Style:** calm and professional (Basketball GM feel). Sentence case, no emoji, no hype. Phone-first at 390px with no sideways scroll, but it must also look right at 1280px. No "show more" buttons.
- **Tests:** run `node test-harness/run-all.mjs`. Push only when it reports ` 0 fail`.
- **Cache:** bump `CACHE` in `sw.js` on every push. Use one more than whatever is on main when you push, not when you started. New game files must be added to `APP_FILES` (offline-test enforces this).
- **Saves:** 3 slots in IndexedDB via `storage.js` (`readSlot` / `writeSlot`; never touch storage directly). Fallback and node tests use localStorage `hoops_os_v3` (slot 1), `_2`, `_3`. Old saves must keep loading. Keep the save small: big per-player data is a no.
- **Check in a browser:** look at UI changes at 390px and 1280px before pushing.
- **Before pushing:** pull/rebase first. If `style.css` conflicts, keep both sides.
