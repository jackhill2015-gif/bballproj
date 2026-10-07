# HOOPS OS handoff board

Shared notes between the agents working on this repo (Claude and Muse) and Jack.
**Read this before you start. Update it in the same commit as your work.**

Keep it short: replace stale lines, don't append forever.

---

## Working on now

Claim a job before you start so two agents don't edit the same screens. Remove your line when you push.

| Who | Job | Files / screens touched | Since |
|-----|-----|-------------------------|-------|
| Muse | Dark mode + theme toggle | style.css (theme vars), index.html head, ui.js More sheet, views/ui-prefs.js, sw.js | 2026-10-06 |

## Messages

Leave a note for the other agent. Delete it once it's handled.

- **Claude → Muse (2026-10-06):** main moved while you were on dark mode (now 536c667+).
  - Rebase before pushing, and set the sw.js cache to v16.
  - New screens to check in dark mode: season recap (`.rc-*`), Targets tab (`.tg-*`), the "Before you move on" dialog (`.mo-*`), the new-dynasty schedule swap sheet (`.nc-ov`), and the update bar (`#upd-bar`).
  - `.nc-ov` and `.mo-ov` use a hard-coded `rgba(31,38,48,.45)` scrim.

## Recently shipped (newest first, keep about 8)

- 536c667 Season recap redesign: GM view (verdict vs expectations, roster stats, skill points + button). League awards on a second tab. *(Claude)*
- ad6ddc0 Portal/recruiting: one Targets tab (green signed, red lost), open spots in the header, one pursuit per open spot. *(Claude)*
- e562a10 Offseason one-tap fixes. Unspent skill points carry over. Move-on warnings are a dialog now. *(Claude)*
- d0a625e Fixed the season getting stuck at the end of the regular season. New-dynasty schedule step matches the yearly picker. *(Claude)*
- d174ae1 The service worker checks every file with the server. A reload bar shows on mixed or old versions. *(Claude)*
- 3204f1c 2027 NCAA format: 76 teams, 12-game Opening Round. *(Claude)*
- 29054b1 Real conference tournament formats (`confformats.js`). *(Claude)*

## Up next (Jack's queue)

1. Review dark mode once Muse pushes.
2. Player faces with facesjs (Apache-2.0). Store a seed per player, not the face. Start after dark mode lands.
3. 30-season stress test: save size and speed.
4. NIT for teams that miss the NCAA. Then draft night + program alumni.
5. Multiple save slots.
6. Rename the game (undecided). Don't rename anything yet.

## House rules

- **Style:** calm and professional (Basketball GM feel). Sentence case, no emoji, no hype. Phone-first at 390px with no sideways scroll, but it must also look right at 1280px. No "show more" buttons.
- **Tests:** run `node test-harness/run-all.mjs`. Push only when it reports ` 0 fail`.
- **Cache:** bump `CACHE` in `sw.js` on every push. Use one more than whatever is on main when you push, not when you started. New game files must be added to `APP_FILES` (offline-test enforces this).
- **Saves:** the save lives in localStorage `hoops_os_v3`. Old saves must keep loading. Keep the save small: big per-player data is a no.
- **Check in a browser:** look at UI changes at 390px and 1280px before pushing.
- **Before pushing:** pull/rebase first. If `style.css` conflicts, keep both sides.
