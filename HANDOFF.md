# HOOPS OS handoff board

Shared notes between the agents working on this repo (Claude and Muse) and Jack.
**Read this before you start. Update it in the same commit as your work.**

Keep it short: replace stale lines, don't append forever.

---

## Working on now

Claim a job before you start so two agents don't edit the same screens. Remove your line when you push.

| Who | Job | Files / screens touched | Since |
|-----|-----|-------------------------|-------|
| Muse | Faces (facesjs), dark-mode check on newer screens, help page update | vendor/facesjs.js, views/player.js, views/roster.js, views/acq.js, style.css, views/help.js, sw.js, index.html | 2026-10-06 |

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

## Recently shipped (newest first, keep about 8)

- Dark-mode check on newer screens: season recap (both tabs), Targets tab, signing-day class rankings, move-on dialog, schedule swap sheet — all clean, no fixes needed. *(Muse)*
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
2. NIT for teams that miss the NCAA. Then draft night + program alumni.
3. Rename the game (undecided). Don't rename anything yet.

## House rules

- **Style:** calm and professional (Basketball GM feel). Sentence case, no emoji, no hype. Phone-first at 390px with no sideways scroll, but it must also look right at 1280px. No "show more" buttons.
- **Tests:** run `node test-harness/run-all.mjs`. Push only when it reports ` 0 fail`.
- **Cache:** bump `CACHE` in `sw.js` on every push. Use one more than whatever is on main when you push, not when you started. New game files must be added to `APP_FILES` (offline-test enforces this).
- **Saves:** the save lives in localStorage `hoops_os_v3`. Old saves must keep loading. Keep the save small: big per-player data is a no.
- **Check in a browser:** look at UI changes at 390px and 1280px before pushing.
- **Before pushing:** pull/rebase first. If `style.css` conflicts, keep both sides.
