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
