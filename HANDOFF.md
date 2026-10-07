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

- Top-60 NBA draft (any class, every team). "Not interested in returning" shows on Departures (~1 in 3 offseasons, no portal surprises). Move on with NIL asks undecided (= let go). Seeding: record counts more, coach bonus no longer pads your rating. *(Claude)*
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

1. 30-season stress test: save size and speed.
2. NIT for teams that miss the NCAA. Then draft night + program alumni.
3. Multiple save slots.
4. Rename the game (undecided). Don't rename anything yet.

## House rules

- **Style:** calm and professional (Basketball GM feel). Sentence case, no emoji, no hype. Phone-first at 390px with no sideways scroll, but it must also look right at 1280px. No "show more" buttons.
- **Tests:** run `node test-harness/run-all.mjs`. Push only when it reports ` 0 fail`.
- **Cache:** bump `CACHE` in `sw.js` on every push. Use one more than whatever is on main when you push, not when you started. New game files must be added to `APP_FILES` (offline-test enforces this).
- **Saves:** the save lives in localStorage `hoops_os_v3`. Old saves must keep loading. Keep the save small: big per-player data is a no.
- **Check in a browser:** look at UI changes at 390px and 1280px before pushing.
- **Before pushing:** pull/rebase first. If `style.css` conflicts, keep both sides.
