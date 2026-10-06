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

---

# QA notes — Job 6 copy/consistency pass (Oct 2026)

**Tester:** Muse (agent) · **Branch:** main · **Scope:** Program, Player retention,
NCAA bracket, Selection Sunday reveal, scouting reports, Rankings tabs, Stats
chips. String-only changes; help.js untouched.

## Method

- Live headless-Chromium screenshots at 1280px and 390px of every audited
  screen, driven through the real game (setup → season → conf tourney →
  Selection Sunday → NCAA → offseason retention). No sideways page scrolling at
  either width (scrollWidth == clientWidth on all touched views).
- Automated scan of all views + index.html for ALL-CAPS words and emoji;
  grep for sim/watch label variants across the codebase.

## Copy fixes made (commit: see below)

- **Bracket hub, "Your next game" scouting card** — the only place in the
  product still using the old labels: `Quick sim` / `Live sim` → `Sim game` /
  `Watch game` (`views/bracket.js` renderScoutingCard). Verified in DOM.
- **Conf bracket round labels** — `R1`/`QF`/`SF`/`Final` now carry
  `title="First round"` / `"Quarterfinal"` / `"Semifinal"` (compact labels kept;
  9px column headers can't fit full words).
- **Rankings → Conference standings** — `GB` / `Natl` headers now have
  `title="Games behind"` / `title="National rank"`.
- **Stats → Player of the year race / league leaders** — `RK` headers now have
  `title="Rank"`. Chips already spelled out (Points, Rebounds, Assists,
  Field goal %, Steals, Blocks); `PPG`/`RPG`/`APG` column headers left as-is
  (standard, explained by the active chip).
- **Scouting report** — "would rank #N on your roster by overall" →
  "by overall rating" (`views/scouting.js`).
- **test-harness/feature-tourney-home.mjs** — one assertion checked for the
  old `Quick sim` copy; updated to the canonical `Sim game`/`Watch game`.

## Judgment calls (left unchanged)

- `PPG`/`RPG`/`APG`, `OVR`/`POT`, `SPG`/`BPG`, `NCAA`, `NIL` kept — standard
  sports abbreviations, explained by context.
- `Chg` / `Rtg` in the national top-25 kept — the subhead already explains
  them ("Power rating adjusted for schedule strength. Arrows show movement
  since last week.").
- "Elite shooting" style strength tags (`views/scouting.js`) kept — "elite" is
  an adjective there, not hype.
- "Begin offseason" (recap advance button) vs "Open offseason" (dashboard
  season-complete panel): two different verbs for similar actions, left alone —
  the canonical-label list for this job only covered the sim/watch pair. Flag
  for a future decision.
- Title attributes are hover-only and don't help on touch — noted in
  research/FOR-CLAUDE.md as a possible follow-up to spell `GB`/`Natl`/`RK` out
  if column widths allow.

## Verification

- `node test-harness/run-all.mjs`: 24/24 pass (see job report for any flakes).
- Screenshots (all 1280 + 390): Program, Stats (with live data after 8 games),
  Rankings national + conference tabs, Scouting report (module-rendered into a
  scratch view), Conf-tourney hub (Sim game/Watch game labels in DOM), Selection
  Sunday reveal (button state), post-reveal field, NCAA bracket, Retention.
