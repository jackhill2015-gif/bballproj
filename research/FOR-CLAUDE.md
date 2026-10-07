# For Claude

Notes from Muse's UI jobs (Oct 2026). These need changes in files you own —
I didn't touch them per the file rules.

## Player-name click convention (needs your screens)

Job 1 added clickable player profiles. The convention is documented in a comment
at the top of `views/player.js`:

- Preferred: `<span class="pname" data-action="player" data-player="<tid>:<roster index>" role="button" tabindex="0">Name</span>`
- Fallback (no roster index handy): `<span class="pname" data-action="player" data-player-name="Full Name" data-tid="<tid>" role="button" tabindex="0">Name</span>`

`ui.js` `handleAction` has a single `'player'` case that reads `data-player`
first, then `data-player-name` + `data-tid`, and opens the profile overlay.
Please add the attribute on your screens: **portal, recruiting, dashboard**
(and anywhere else you render player names). No other wiring needed — the
`.pname` class and the action already exist.

## Recap awards need the attribute (views/recap.js)

`awardCard` renders Player of the year / Freshman of the year / All-American
names, but the flattened award objects from `calcAwards()` carry `tid` and no
roster index — so the **fallback** form fits best:

`<span class="pname" data-action="player" data-player-name="<name>" data-tid="<tid>" role="button" tabindex="0"><name></span>`

(Coach of the year is a coach, not a player — leave that one alone.)

## Trophy room has no player names (views/trophies.js)

Checked: the trophy room shows seasons, goals, and achievements — no player
names anywhere. Nothing to link there; no action needed. Mentioning it only
because the job spec listed it.

## scouting-test failure: pass-first PG typed "All-around guard" (views/scouting.js)

Pre-existing failure, present on clean main (b5b57ca) with no UI-job changes
applied. Reproduces with `node test-harness/scouting-test.mjs` (23/24 pass,
only this one fails):

```js
const pg = { name: 'Test PG', pos: 'PG', ovr: 80, sht: 82, fin: 78, def: 80, reb: 62, ply: 92, cls: 'FR' };
// FAIL: a pass-first PG is a Floor general (All-around guard)
SC.playerType(pg); // returns 'All-around guard', test expects 'Floor general'
```

The synthetic PG has playmaking (92) 12 points above his next-best skill, but
`relProfile()` judges him against the generated positional norms, and the
standout threshold (`z[s[0]] < 4` → all-around) apparently isn't met. Likely
the PG positional norms in a fresh dynasty sit high enough that ply 92 isn't
4+ points above the mean-removed relative profile. Worth a look when you're
next in scouting.js — my job was not allowed to touch that file.

## portal-pitch-test flaked once under run-all (Muse QOL job 2, Oct 2026)

While running `node test-harness/run-all.mjs` after adding the offseason
progress strip (views/recruiting.js, display-only), portal-pitch-test.mjs
failed once with exit 1. It passes standalone with the same changes applied
(both before and after), passed on clean main via `git stash`, and passed in
a second full `run-all.mjs` run (24/24). So this looks like pre-existing
randomness/timing flakiness in the portal battle sim, not a regression from
the strip. Worth knowing if you see it flake again: re-run standalone before
investigating.

## Job 6 copy pass leftovers (Muse, Oct 2026 — out of scope, not fixed)

1. **Roster view hamburger glyph** — `views/roster.js` renders
   "Drag ☰ to reorder; sliders set minutes." The ☰ is a UI glyph rather than an
   emoji, but if the calm-system rule is "no glyphs as icons", consider an SVG
   or the word "drag the handle". Out of my audit scope (screens were Program /
   retention / bracket / reveal / scouting / rankings / stats), so I left it.
2. **Schedule view "BYE" chip** — `views/schedule.js` labels bye weeks `BYE`
   (all caps, intentional sports term). Left as-is; if sentence case is the
   house rule even for sports shorthand, it's `Bye`.
3. **Abbreviation follow-up (Muse's call, your files)** — I added `title=`
   tooltips for `GB`/`Natl` (views/standings.js), `RK` (views/stats.js), and
   `R1`/`QF`/`SF` (views/bracket.js conf card). Titles don't help on touch.
   If column widths allow, spelling these out would be better. Also an open
   question: "Begin offseason" (recap advance button) vs "Open offseason"
   (dashboard season-complete panel) — two verbs for similar actions.
4. **Selection Sunday reveal copy** (tournament.js `showBracketReveal`) —
   audited as part of Job 6; already sentence case, no emoji, no hype. No
   changes made. Mentioning it so nobody re-audits it.

## Job 7 full-playthrough QA (Muse, Oct 2026)

Played **two full seasons** in headless Chromium (Playwright, Python) against a
local static server, using only real UI clicks — no harness shortcuts for UI
paths. Route: new dynasty (setup wizard: coach name → difficulty → job offers →
non-conf schedule → start) → season 1 as Milwaukee (watched 2 games live in the
gamecast modal incl. box-score tab + skip-to-final; simmed the rest) →
conference tournament (watched R1 loss, then top-bar Play round menu →
"Sim through conference tournament") → Selection Sunday reveal modal → NCAA
tournament ("Sim the …" round buttons to completion; auto-advanced to the
offseason recap when the title game resolved) → full offseason (recap → Begin
offseason → skill points → carousel/Stay → departures → retention (4 asks,
keep/let-go) → portal (3 stages, offers placed; filter-chip persistence
verified across reload + Continue: chip stayed `on`, 160/160 entrants intact)
→ recruiting (3 phases, targets + pitches) → season 2 (watched a game,
simmed, conf tourney, NCAA) → done. Widths: 1280px desktop for season halves
and offseason start; 390px phone (bottom nav + More sheet) for a live game,
half of season 1, the entire offseason, toasts, and season-2 start.

**Console errors across the whole playthrough: 0.** (One `ERR_TUNNEL_CONNECTION_FAILED`
for the Google Fonts stylesheet is a sandbox egress-proxy artifact, not a game bug.)

Fixed by Muse (1 cosmetic CSS fix, committed separately):
- **Top-bar advance button below the 36px phone tap-target floor** — at 390px
  `#advance-btn` measured 32px tall (Job 5 raised content targets to 36px but
  the top bar kept its 32px rule). Fix: `style.css` append-only block
  `/* Muse: playthrough QA fixes */`, `@media (max-width: 480px) {
  #advance-btn { min-height: 36px; } }`. Verified at 390px: button is 36px,
  top bar 49px, no layout shift.

Verified clean (no action needed):
- Player profile overlay (Job 1): type ("Scoring guard"), tags ("Elite
  finishing" / "Weak playmaking"), rating bars; opens from roster `.pname`,
  closes cleanly.
- Offseason progress strip (Job 2): rendered on every offseason screen with ✓
  on completed steps and the current step highlighted; wraps to two lines at
  390px without breaking.
- Phone toasts (Job 3): buying an NIL boost showed one toast above the bottom
  nav; auto-dismissed within ~3s; no stacking issues.
- Persisted filters (Job 4): portal filter chip stayed `on` across a full page
  reload + home-screen Continue; all 160 entrants and their offer steppers
  restored. (Note: after reload, Continue lands on the dashboard in offseason
  phase — the user then taps "Open offseason". That's the designed resume path
  and it works.)
- Tap targets (Job 5): 12 visible buttons audited on the dashboard at 390px;
  after the fix above, all ≥ 36px.
- Play-by-play feed spacing (Job 1–6 fix): lines like "In and out. Heartbreak
  for Kyrie Scott on that attempt." and "Xavier Howard (1) signed early with
  Campbell." render with proper spaces.
- Empty states: bracket view mid-season ("The bracket opens after the regular
  season."), retention with no asks path not hit (4 asks this run).
- Save/resume: home screen save slot correctly shows "Offseason" phase after
  reload; Continue restores the dynasty.

### Annoyance

1. **Conference-tournament hub has no in-content advance control after your
   team is eliminated** (`views/bracket.js` `renderConfHub`).
   - Screen: Home (tournament hub), phase `conf_tourn`. Widths: both.
   - Repro: lose (or have already lost) your conference-tournament game. The
     hub shows your conference bracket, the scouting card is gone, and
     "Around the country" lists other conferences mid-round — but there is no
     button to advance. The only path is the top-bar "Play round ▾" menu →
     "Sim through conference tournament".
   - Expected: an in-content control like the NCAA hub's "Sim the <round>"
     button (`renderNCAA_Hub` line ~333), so a user who never opens the top-bar
     menu isn't stuck wondering how to move on.
   - Not a dead end (the top-bar menu always works), but undiscoverable.

### Nits (your files — calm-system copy)

2. **"ADVANCES!" toast is all-caps** (`tournament.js`
   `resolveTournamentGame`, conf-tourney branch):
   `toast(userTeam.name + ' ADVANCES! ' + fmtScore(...), 'var(--grn)')`
   renders e.g. "Milwaukee ADVANCES! 73-66". `toast()` in ui.js only
   sentence-cases fully-uppercase strings, so the mixed-case shout survives.
   Calm-system read: "Milwaukee advances! 73-66".
   - Repro: win any conference-tournament game (quick-sim or watched).

3. **Emoji + all-caps in championship log/toast** (`tournament.js`
   `checkNCAAdone`): `addLog` lines contain `🏀🏆 <b>CINDERELLA
   CHAMPIONS!</b> …` and `<b>NATIONAL CHAMPIONS! 🏆</b> …`, and
   `toast('NATIONAL CHAMPIONS!!!', 'var(--gld)')`. The toast gets
   sentence-cased by `toast()` ("National champions!!!") but keeps the `!!!`;
   the log lines keep raw emoji.
   - Repro: win the national championship (or sim a season where a CPU
     cinderella does — the log lines fire either way).

4. **Departures "Open transfer portal" button mislabels the next step when
   retention asks exist** (`views/recruiting.js` `renderTurnover`):
   the button is `data-proceed-portal` labeled "Open transfer portal", but
   `proceedToRecruiting()` routes to the retention screen first when
   `buildRetentionAsks()` is non-empty.
   - Repro: finish a season where at least one returner gets a retention ask;
     on the departures screen the button says "Open transfer portal" yet lands
     on "Player retention".
   - Suggestion: label it "Continue" (the top-bar advance menu already uses
     step-specific labels like "Open the transfer portal" only on the
     retention screen itself).

5. **Likely-dead UI branches** (not user-facing bugs, flagging so nobody
   tests them as live paths):
   - Dashboard "Regular season complete → Start conference tournament"
     (`views/dashboard.js` `renderGameCard`, `G.phase === 'reg'` with `gi >=
     30`): after the 30th game `advanceWeek` flips phase to `conf_tourn`
     immediately, so this panel never renders through the real click flow.
   - NCAA hub champCard "Season recap" button (`views/bracket.js`): 
     `checkNCAAdone()` calls `endSeason()` synchronously when the title game
     resolves, so phase is already `offseason` by the time the hub
     re-renders; the button (gated on `G.phase === 'ncaa'`) is nearly
     unreachable.

## Tap-to-see-more: per-game data needed for a real box score (Muse, 2026-10-06)

The schedule game-detail sheet (`views/team.js` `openGameDetail`) currently
shows final score + both teams' *season* scoring leaders, because schedule
entries don't store per-game player lines.

What I checked: every team's `sched[w]` entry is
`{opp, home, conf, played, uScore, oScore}` (set in `season.js`
`buildSchedules` ~L114-224, mirrored per team with uScore/oScore swapped at
~L417-429). Player season totals live in `p.s` (`{gp, pts, reb, ast, stl,
blk, fga, fgm}`), but nothing is snapshotted per game.

To render a real box score in the future, each played entry would need one
added field (save-format change — yours to make, not mine):
- `box`: `{ home: [{name, min, pts, reb, ast, stl, blk, fgm, fga}], away: [...] }`
  recorded at final-whistle time in the same place `played`/`uScore`/`oScore`
  are written (both the user's `advanceWeek` path and the CPU sim path), so
  every team's sheet has both sides. Old saves would simply lack `box` and
  keep the current leaders fallback.
