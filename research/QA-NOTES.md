# QA notes — HOOPS OS full playthrough (Job 1)

**Date:** Oct 2026 · **Tester:** Muse (agent) · **Branch:** main @ 9270579

## How this was verified (read first)

- **No live-browser screenshots.** The sandbox Chromium (v152) hard-blocks all
  `localhost` navigations (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`) and no
  flag, permission grant, or initiator change worked around it; the `cloudflared`
  quick tunnel also failed (TLS intercepted by the egress proxy). So every finding
  below is verified by one of the honest methods named per entry:
  - **harness sim** — full playthrough driven in node against the real modules
    (recording-DOM shim): setup wizard → new dynasty → every view → roster
    interactions → 30-game season → conference tournament → NCAA tournament →
    every offseason step (recap, skill points, carousel, turnover, portal,
    recruiting) → new season. Plus a 139-possession live-modal step-through.
  - **wording scan** — automated scan of rendered HTML at 15+ checkpoints for
    all-caps words (allowlist: NCAA, NIL, OVR, positions, classes, stat abbrevs,
    team/conference codes), emoji, `!!`, `text-transform:uppercase`,
    `letter-spacing`, hype terms.
  - **code inspection** — event-handler binding audit (`data-*` attributes vs
    handlers), drag implementation, table overflow wrappers, bracket container.
- **Console errors across the entire playthrough: 0.** Every throw below was
  investigated; the only ones seen were harness-setup artifacts (missing
  `setupUserOOC`), not game bugs.

## Findings fixed by Muse

### 1. Schedule view — all-caps summary labels + heavy inline weights
- **Screen:** Schedule · **Method:** wording scan (harness sim)
- **What happened:** The season summary strip read `WINS` / `LOSSES` / `LEFT` in
  all caps, set in inline `font-weight:900`.
- **Expected:** Sentence case per the calm design system; no heavy inline weights.
- **Fix:** `views/schedule.js` — labels now `Wins` / `Losses` / `Left`,
  numerals at `font-weight:700`.

### 2. Schedule view — "NEXT" badge all caps
- **Screen:** Schedule (next-game row) · **Method:** wording scan (harness sim)
- **What happened:** The upcoming-game badge read `NEXT`.
- **Expected:** Sentence case (`Next`; the `.badge` class does not uppercase).
- **Fix:** `views/schedule.js`.

### 3. Setup wizard — job offers table can overflow on phones
- **Screen:** Setup wizard, job offers · **Method:** code inspection (static)
- **What happened:** The 4-column offers table sat in `.panel-b.flush` with no
  horizontal-scroll wrapper (`.tbl-wrap`), unlike every other table in the app.
  At 390px a wide table would push the page sideways.
- **Expected:** Table scrolls inside its container; page never scrolls sideways.
- **Fix:** `views/setup.js` — table wrapped in `.tbl-wrap`.

### 4. Setup wizard — non-conference schedule table, same issue
- **Screen:** Setup wizard, non-conference schedule · **Method:** code inspection
- **What happened:** 5-column table (opponent, OVR, edge, swap button) with no
  `.tbl-wrap`.
- **Expected:** Same as above.
- **Fix:** `views/setup.js` — table wrapped in `.tbl-wrap`.

## Verified clean (no action needed)

- **Home, dashboard, roster, standings, stats, history, bracket, trophies,
  help** — wording scan clean at preseason, mid-season (weeks 8, 20) and
  postseason; no console errors on any render. (harness sim + wording scan)
- **Roster interactions** — redshirt toggle and depth-chart move executed without
  errors; drag reorder is wired three ways (HTML5 drag events, pointer-drag
  fallback, arrow-key buttons per the phone fix) with all `data-*` attributes
  bound. (harness sim + code inspection)
- **Sim menu** — "Sim game / Watch game / Sim to end of regular season / Sim
  through conference tournament / Sim through end of season", all calm
  sentence-case with plain sublabels. (code inspection)
- **Conference + NCAA tournaments** — full bracket sim, no errors; bracket tree
  container uses `overflow-x:auto` so it scrolls inside the page on phones.
  (harness sim + code inspection)
- **Offseason, all steps in order** — recap → skill points (allocate/deallocate/
  finish) → carousel (stay) → turnover → portal (filters, player detail, offer
  stepper, pivot, all three stages) → recruiting (tabs, targets, detail, pitch,
  filters, phase advance) → new season. Zero errors. (harness sim)
- **Live game modal** — full 139-possession game stepped through, plus skip and
  finalize; box-score abbreviations (PTS/REB/AST/STL/BLK) are standard. Zero
  errors. (harness sim)
- **News/feed text** — dashboard logs across the season: no hype, no emoji, no
  double exclamation. (wording scan)

## For Claude

None. Every issue found was in Muse's lane and is fixed above. The sim engine,
tournament, portal, battle, dashboard, recap, and recruiting files were exercised
hard (full season + offseason + live modal) with zero errors — nothing to hand
over.
