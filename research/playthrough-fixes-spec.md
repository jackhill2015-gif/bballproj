# Playthrough bug fixes — spec (Muse's lane), Oct 4 2026

From the live playthrough triage (2026-10-03). All four are Muse-lane UI/wording bugs.
**IMPORTANT: this local checkout is 3+ commits behind origin/main** (Claude's
5627e0e, b9e6b41, e246788 are on origin; `git fetch` failed from this VM).
Work from a fresh origin/main checkout and re-verify locations before editing.

## 1. Setup Continue silently dead on empty name fields — views/setup.js

`submitCoachName()` (currently ~line 196) validates with `alert(...)`. In the live
playthrough nothing happened on click — `alert()` is silently swallowed in some
contexts and is poor UX regardless.
**Fix:** replace the alert with an inline error inside the screen:
- In `renderCoachName()`, add `<div id="coach-name-err" class="setup-err" style="display:none;color:var(--red);font-size:13px;margin-bottom:12px;"></div>` above the Continue button.
- In `submitCoachName()`: on empty fields, set the div's text to
  "Enter your first and last name to continue." and show it; return. On valid
  submit, hide it. Keep all existing G.coach assignments unchanged.

## 2. Schedule Edge column reads from the opponent's perspective — views/setup.js

`renderNCSchedule()` computes `diff = getTOvr(opp) - myOvr`, so +4 (red) means the
*opponent* is better. Flip to the user's perspective:
- `var diff = myOvr - getTOvr(opp);`
- `diffCol`: `diff >= 4 ? 'var(--grn2)' : diff >= -4 ? 'var(--gld2)' : 'var(--red)'`
- Keep `diffStr` sign logic as-is (`+` for positive). Now positive = your edge, green.

## 3. Conference-title victory copy — tournament.js (check lane first)

`showTournamentResult()` (~line 875) prints "Advancing to the next round" after
*every* tournament win, including the championship game where there is no next round.
**Fix:** detect the final via `roundName` (it already renders `getNCAAroundName()` /
`getConfRoundName()`): if the round name contains "Championship" (case-insensitive),
print "Conference champions!" (conf) / "National champions!" (ncaa) instead.
**Lane note:** tournament.js is likely Claude's file. If so, do not edit — move this
item to research/FOR-CLAUDE.md instead.

## 4. Feed text missing spaces (~30 cases, e.g. 'signed early withMercyhurst')

**Verified against this local tree (2026-10-04): NOT reproducible.** Every `addLog`
string in events.js, views/portal.js, views/recruiting.js, and `narrateResult()` in
ui.js has correct spacing, and `calm()` in ui.js only collapses runs of whitespace.
The deployed build is newer than this checkout, so the defect is almost certainly in
one of Claude's origin commits (e.g. the 5627e0e portal rewrite or the e246788 help
finance update). **Do not guess — on fresh origin/main, run:**
`grep -rEnE "'[a-zA-Z]+'[ ]*\+[ ]*'<(b|i|span)" --include="*.js" .`
and eyeball addLog strings in views/portal.js (~line 464), views/recruiting.js (~340),
ui.js (boost shop + addLog, ~line 680-710), and views/help.js. Fix each missing-space
concat at the source string.

## 5. 'Film session—' missing space + help page paragraphs rendered twice in the DOM

Same story: **not reproducible locally.** ui.js:691 reads
`'<b>Film session</b> — all attributes +2 for 2 games.'` (spaced), and
views/help.js `renderHelp()` does a single `el.innerHTML = h` on a single
`#help-content` element — no double-append path exists in this tree. Both defects
are likely in Claude's origin commits; verify on fresh origin/main before touching.

## Test

Run the full suite (`node --test` per test-harness convention) and confirm 20/20
pass before pushing. style.css is append-only; update sw.js APP_FILES if any file is
added. Commit in Muse's lane only (never Claude's files); Claude-lane items go in
research/FOR-CLAUDE.md.
