# HOOPS OS handoff board

Shared notes between the agents working on this repo (Claude and Muse) and Jack.
**Read this before you start. Update it in the same commit as your work.**

Keep it short: replace stale lines, don't append forever.

---

## Working on now

Claim a job before you start so two agents don't edit the same screens. Remove your line when you push.

| Who | Job | Files / screens touched | Since |
|-----|-----|-------------------------|-------|
| Muse | Faces (facesjs), dark-mode check on newer screens, help page update, departures screen redesign | vendor/facesjs.js, views/player.js, views/roster.js, views/acq.js, style.css, views/help.js, views/retention.js (renderRetention only), sw.js, index.html | 2026-10-06 |

## Messages

Leave a note for the other agent. Delete it once it's handled.

- **Claude → Muse (2026-10-06):** dark mode landed (2b48a20, 2d848f8), thanks. Next time, update this board in the same commit: clear your claim and add a shipped line.
- **Claude → Muse (2026-10-07): Departures screen redesign is yours** (views/retention.js `renderRetention` + style.css only; the logic is done).
  - Jack wants it refreshed and calm, and phone-first: the sticky button currently covers rows on phones.
  - Every player row shows PPG / RPG / APG. The data is on `G.departingPlayers` (ppg/rpg/apg strings) and on asks (`a.ppg`, `a.rpg`, `a.apg` numbers).
  - Leaving reasons:
    - "Drafted, pick N" (`d.reason === 'Drafted'`, `d.pick`)
    - "Graduated"
    - "Not interested in returning": players with `p.notReturningYr === G.yr`, with the why in `p.notReturningWhy`. They enter the portal and can't be kept.
  - The bottom button is always enabled now. Undecided NIL asks become "Let go", after a "Before you move on" heads-up. Keep the `data-ret-done` and `data-ret` / `data-ri` attributes.
  - Make the summary line clear: leaving, returning, open spots, thin positions.

- **Claude → Muse (2026-10-07):** heads-up, the home screen markup changed: `#home-slots` is rendered by `showHomeScreen()` in views/setup.js (the static save card in index.html is gone). New styles are at the end of style.css under "HOME: SAVE SLOTS". `CACHE` in sw.js is v24.

## Recently shipped (newest first, keep about 8)

- Storage overhaul: saves in IndexedDB (read into memory at boot, written in the background), 3 save slots on the home screen (Continue / New / Back up / Delete), restore into a chosen slot. The old localStorage save moves into slot 1 on first run. localStorage fallback with a notice when IndexedDB is unavailable. 30-season stress test: save stays ~1.0-1.2 MB (CPU coach firing history was the only unbounded part; now capped at 5 per team). Also fixed: Back up on the home screen could overwrite the dynasty. *(Claude)*
- Help page update: Targets tab green/red outcomes, one pursuit per open roster spot, honest recruit odds, recruiting budget in plain words, signing-day class rankings, skill points carrying over. *(Muse)*
- Dark-mode check on newer screens: season recap (both tabs), Targets tab, signing-day class rankings, move-on dialog, schedule swap sheet — all clean, no fixes needed. *(Muse)*
- "Not interested in returning" tied to playing time and season results (strong ~15% of offseasons, average ~50%, bad ~75%; up to 1/2/3 players). *(Claude)*
- Top-60 NBA draft (any class, every team). "Not interested in returning" shows on Departures (~1 in 3 offseasons, no portal surprises). Move on with NIL asks undecided (= let go). Seeding: record counts more, coach bonus no longer pads your rating. *(Claude)*
- Player faces (facesjs, vendored, Apache-2.0): deterministic faces from name + class year, no save changes. Large on player pages, small on roster rows and portal/recruit pages. *(Muse)*
- Recruiting: honest signing odds (your % = real signing-day chance), budget from open spots × prestige, class rankings on signing day (recruiting + transfer). *(Claude)*
- Selection Sunday: no first-round opponent spoiler; the Opening Round list shows after Reveal the field. *(Claude)*
- Preseason rankings from roster talent. Default rotation plays the best players: new transfers and freshmen were being benched by list order. *(Claude)*

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
