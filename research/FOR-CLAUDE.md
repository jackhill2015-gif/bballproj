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
