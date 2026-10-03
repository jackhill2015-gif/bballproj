# NIL money design — HOOPS OS

**Status:** Design only. No code. Replaces the single NIL number (`G.pts`) with a small,
legible money system. Written Oct 2026 as research for Jack; builds on Claude's facilities
tracks rather than competing with them.

**Note on sources:** `facilities.js` has been verified against Claude's actual code
(present in the repo as of his latest commit): three tracks (practice facility, arena,
training room), levels 1–5, one-time NIL costs via `upgradeCost(level) = 120 + level*90`,
arena gives +0.5 home court and +3 NIL/week per level. The money side below hooks into
exactly these functions — no parallel currency, no competing upgrades.

---

## 1. The problem

Right now NIL is one number on the screen. It goes up when you win (rank-based weekly
drip in `season.js`, offseason bonus in `views/recruiting.js`) and goes down in two places:
the dashboard boost shop (`NIL_SHOP` in `ui.js`) and escrowed transfer-portal offers
(`views/portal.js`). There is no story to it — no sense of *where it came from* or what
you gave up to spend it. Jack's note: "it's just that number that shows on the screen.
it's kinda boring."

The fix is not more numbers. It's giving the existing number a past and a future:
legible income streams tied to things the player already does, and spends that force
real tradeoffs against each other.

## 2. What the research says (condensed)

### Real-world NIL — only what matters for the game

- **The House settlement (final approval June 2025)** lets schools pay athletes directly:
  ~$20.5M per school per year, rising ~4% annually. On top of that, third-party NIL
  (collectives, brands) continues, now policed through the NIL Go clearinghouse for deals
  ≥ $600. Two money systems stacked: institutional revenue-share + outside NIL.
  *(fanarch.com, rallyfuel.com, frontofficesports.com — news search, Oct 2026)*
- **Collectives are the differentiator.** College basketball roster budgets run $1–4M;
  at least eight programs topped $10M for 2025–26. Star deals: $500K–$2.5M for starters
  at top programs, up to ~$4M (Texas Tech's JT Toppin took a reported $4M to skip the
  draft and stay; a guard moved for a reported $3.5M). Portal guards routinely draw
  $800K–$2.5M. The average D1 basketball NIL deal was ~$7,000 (Opendorse, 2025) — the
  money concentrates brutally at the top.
  *(on3.com, ball.sportroom.co.uk, collegefootballnetwork.com, cbsistatic.com)*
- **Retention is the emotional and strategic core.** Dabo Swinney's stated philosophy:
  *"Our NIL is for retention, not recruiting."* Over 50% of D1 men's players transfer in
  their careers; transfers were 40% of 2025 All-Americans. The portal is free agency, and
  bidding wars run on unverifiable numbers — "You can't even verify some of these
  numbers. What's real? What are we bidding against?" (Power-5 GM, via CBS).
  *(crunchupdates.com, civicintelligence.news)*
- **Design takeaways:** (a) the highest-stakes NIL decision is *keeping your own players*,
  not just buying new ones; (b) bidding against hidden rival numbers is already HOOPS
  OS's portal battle system — the real world validates the mechanic; (c) money follows
  winning (tournament runs → bigger budgets → better rosters), which is the virtuous
  cycle the game should make visible.

### Basketball GM finances — why it works without spreadsheet overload

Per the repo's own `research/competitor-notes.md` (which quotes the Basketball GM
manual; the live manual was not re-fetched for this doc, so mechanics below are stated
at design level):

- **One page, few numbers.** The Team Finances page shows revenue vs. expenses and a
  cash balance. Revenue streams are named and legible (tickets, sponsorship, TV);
  expenses are player salaries, luxury tax, staff.
- **The player makes a small number of real decisions.** The classic one is **ticket
  price**: raise it for more revenue now, at the cost of attendance and fan hype later.
  One slider, one tradeoff, endlessly interesting. Spending sliders (scouting, coaching,
  facilities) have gradual, explainable effects — e.g. scouting spend slowly improves
  rating accuracy over ~3 seasons, which buys a fog-of-war layer almost for free.
- **Money is a second scoreboard.** Cash can go negative; sustained losses anger the
  owner. Profit is a parallel game to winning, and the two feed each other through
  attendance: winning fills seats, seats fund the roster.
- **Why it works:** every dollar has a visible cause, every spend is a choice rather
  than a tax, and the whole thing fits on one screen. That is the bar.

### Retro Bowl (College) facilities — why the tracks feel rewarding

From published guides (talkandroid.com beginner's guide; multiple Retro Bowl College
overviews — news/web search, Oct 2026):

- Four departments, one verb each: **stadium → happier fans** (bigger crowds, softer
  blowback from losses), **training facilities → faster player XP**, **rehab → faster
  injury recovery**. (The fourth, salary cap, doesn't apply to college.)
- **Why it feels good:** upgrades are permanent, costs escalate, each track maps to
  exactly one visible outcome, and there is no upkeep or micromanagement. The decision
  is *which track first and when* — timing, not arithmetic. That is the entire
  engagement model, and it works.

Claude's three tracks (practice gym → development, arena → home court, training room →
injury recovery) are the same shape. This design does not touch them; it makes NIL
the wallet they draw from and gives the arena a second job (bigger gate — see §4).

---

## 3. The design

### 3.1 The numbers the player must understand: three

1. **Budget** — NIL available to spend right now. Lives in the top bar (today's
   `#nil-balance`). This is the old `G.pts`, renamed in spirit.
2. **Season income** — NIL earned so far this season. One tap expands to the four
   streams below, each with a one-line cause ("Gate: 9 home games, strong form").
3. **Committed** — NIL locked up right now: escrowed portal offers + active player
   deals. Shown next to Budget so the player never wonders "where did my money go."

That's it. Everything else lives one tap deeper or on Claude's facilities screen
(level, effect, next cost — his surface, our currency).

### 3.2 Where money comes from: four streams, all automatic

Every stream is driven by things the player already does. No new chores.

| Stream | When it lands | What drives it | Real-world anchor |
|---|---|---|---|
| **Ticket sales** | After each home game | Recent form × prestige × arena level × ticket preset | Gate receipts; Oregon's "$10 ticket" debate |
| **Donor collective** | Once, each offseason | Prestige × last season's finish (floor for small schools) | Collectives as the differentiator |
| **Conference TV share** | Once, each preseason | Fixed by conference prestige tier | Media-rights payouts ($8.8B NCAA TV deal) |
| **Tournament payouts** | Per NCAA tournament win, escalating by round | How far you dance | NCAA basketball fund pays per game |

**What this replaces:** the abstract weekly rank drip in `season.js` (14–40/week for no
visible reason). Every dollar now has a cause the player can point to. Claude's AD
season-goal bonuses (+40 NIL each) slot in as a fifth income line, "AD bonuses" —
no change needed on his side.

**Illustrative magnitudes** (tuning starting points, not balance prescriptions — the
game currently deals in tens-to-hundreds, and abstract units stay readable; do *not*
switch to real $ millions):
- Home gate: 6–20 per game (form × arena × ticket preset)
- Donor check: 60–220 (prestige × finish)
- TV share: 40–120 (conference tier)
- Tournament win: 25 → 200 escalating by round (R64 → title)
- AD goal bonus: 40 (already set)

### 3.3 Where money goes: four buckets, each a decision

1. **Player deals — retention (NEW, the centerpiece).** Each offseason, 2–4 key
   players with real portal interest ask for a number to stay. One screen, one row per
   player: name, asking price, **Keep** / **Let go**. Paying signs them for one season;
   declining sends them into the portal pool, where you may still bid (existing
   battle system). This is the Toppin $4M moment, the Dabo doctrine, and the single
   most real-world-faithful mechanic in the proposal. Illustrative asks: 40–160 by
   player quality; stars cost star money.
2. **Portal offers.** The existing escrow system (`views/portal.js`) — unchanged,
   now funded by a budget the player understands.
3. **Facilities.** Claude's tracks. The long-term-vs-short-term tradeoff that carries
   the whole design: a level-4 arena pays NIL back *every week, forever* (+3/week per
   level in his code); that same NIL could have kept your senior point guard. No new
   hookup needed — the arena's money effect already exists, so the facilities screen
   just needs to show it plainly next to the cost.
4. **Boost shop.** The existing weekly `NIL_SHOP` (sellout crowd, film session,
   recovery) — unchanged, optional small spends. It already works; leave it alone.

**Deliberately not added:** staff salaries, facility upkeep, multi-year contracts
(deals are per-season — simpler and matches the portal-era one-year rhythm),
HS-recruiting NIL (the points system in `views/battle.js` stays; NIL stays a
portal/retention currency).

### 3.4 The core loop

**Win games → fans show up → bigger gate + bigger donor check + tournament payouts →
bigger budget → choose: keep your stars, win portal battles, or build facilities →
better team → win more.**

Losing inverts it: less money, harder choices — which is exactly when the game gets
interesting. The loop is visible on the dashboard because income lines name their
causes.

### 3.5 What the player decides, and when

| When | Decision | Time cost |
|---|---|---|
| Preseason | **Ticket preset:** Value / Standard / Premium. Three words, not a number. Premium = more gate now, slower fan growth; Value = the reverse. Set once, revisit yearly. (The Basketball GM steal, casual-sized.) | 10 seconds |
| Anytime | **Facility upgrades:** which track, and when. The permanent-vs-now tradeoff. | 1 minute |
| Weekly (optional) | **Boost shop:** as today. | 30 seconds |
| Offseason | **Portal battles:** concentrate or spread offers (exists today). | 5 minutes |
| Offseason | **Retention calls:** keep or let go, 2–4 players (new). | 2 minutes |

Five decisions, none of them arithmetic. The offseason becomes a genuine mini-game:
donor check lands → retention calls → portal battles → facility upgrade with what's
left → next season.

### 3.6 What the player sees

- **Top bar:** Budget number (keep the existing `#nil-balance` element; maybe relabel
  the tooltip "NIL budget").
- **Dashboard — new "Program finances" panel:** the three numbers (Budget, Season
  income, Committed), the four income streams with one-line causes, and a season net
  line ("+180 in, −120 out"). Follows the existing `.panel > .panel-h + .panel-b`
  pattern and sentence-case rules.
- **Facilities (Claude's screen):** no structural changes proposed. Two requests for
  coherence: (a) arena shows its gate effect ("Level 3 arena: +30% gate"), (b) all
  costs read from the same Budget number — no second currency.
- **Retention (new offseason step):** dense table — player, class, OVR, asking price,
  Keep / Let go. Plain verbs, no hype copy. Sits between the donor check landing and
  the portal battle in the offseason flow.
- **Season recap:** one "money" section — income by stream, spending by bucket, net.
  Makes the loop legible in hindsight.

### 3.7 Tone

Calm front-office, per the game's design system: sentence case, plain verbs
("Keep", "Let go", "Upgrade", "Make an offer"), no exclamation points, no slang.
Money copy should read like an athletic department memo, not a casino.

---

## 4. Interface with Claude's systems (verified against his code)

- **facilities.js:** practice facility / arena / training room, levels 1–5, one-time
  NIL costs (`upgradeCost(level) = 120 + level*90`, deducted from `G.pts`). Money side
  needs from it: current level + next cost per track (to display and deduct) — both
  already exposed via `facilitiesFor(tid)` / `myFacilities()` / `upgradeFacility(id)`.
  Arena's money effect (+3 NIL/week/level via `arenaNil`) is the gate hookup; no
  ticket multiplier needed in v1.
- **Season goals (AD):** +1 skill point and +40 NIL per goal, prestige boost for all
  three. No change; the +40s appear as "AD bonuses" under season income.
- **Achievements / trophy room:** no money interaction in v1. (Future option: small
  NIL bonus for milestone achievements.)
- **Redshirts:** no money interaction. A redshirted player does not ask for a
  retention deal that season — one-line rule for whoever implements retention.

## 5. Scope cuts — explicitly not in this design

- **No salary cap or luxury tax.** College has no cap; the constraint is the budget
  itself.
- **No debt or bankruptcy.** Budget floors at zero. Being broke means you can't
  spend — the punishment is competitive (worse roster), not a game-over screen.
  (Whether the AD should apply *career* pressure for sustained losing is open —
  see §6.)
- **No facility upkeep.** Upgrades are one-time purchases (Retro Bowl rule: upkeep
  is a tax, not a decision).
- **No staff salaries, no donor mini-game, no transfer fees, no collective
  management screen.** Donors are a number with a cause, not a system.
- **No HS-recruiting NIL.** Points stay points.
- **No multi-year deals.** One-season retention deals match the portal era and keep
  the math trivial.

## 6. Decisions (final — no open questions)

1. **Being broke is soft.** Budget floors at zero; you simply can't spend. The
   punishment is competitive (thinner roster, lost portal battles), not a game-over
   screen. No firing tied to money in v1.
2. **CPU spending is news-only flavor.** No rival budgets are simulated. Occasional
   news lines ("Kentucky signed a top-3 portal class") create arms-race pressure
   without a sim behind them.
3. **Ticket presets stay in v1.** Value / Standard / Premium, set once per preseason,
   ~10 seconds. It's the signature Basketball-GM-style decision and the cheapest
   interesting choice in the doc.
4. **Retention is offseason-only, 2–4 players.** Stars and key starters with real
   portal interest ask for a number; Keep / Let go. No mid-season extensions in v1.
5. **Abstract units.** The economy stays in today's small numbers (tens–hundreds),
   not real $ millions. Readability beats realism here.
6. **Tournament payouts go entirely to the program.** No splits, no bonus choices.

## 7. Sources and verification notes

- **Real-world NIL:** web news search, Oct 2026. Key pages: House settlement explainer
  (frontofficesports.com), NIL platform reset post-settlement (blog.rallyfuel.com),
  basketball collective budgets and portal deal sizes (on3.com, ball.sportroom.co.uk,
  collegefootballnetwork.com, sportsfly.cbsistatic.com), retention-vs-recruiting
  (civicintelligence.news on Clemson/Swinney), competitive-balance effects
  (crunchupdates.com). Deal sizes are *reported* figures from agents/collectives —
  the market is famously unverifiable; treat magnitudes as directional.
- **Basketball GM finances:** `research/competitor-notes.md` in this repo (a prior
  research pass quoting the Basketball GM manual). The live manual was not re-fetched;
  finance mechanics above are stated at design level, which is all this doc needs.
- **Retro Bowl facilities:** web search, Oct 2026 — Retro Bowl beginner's guide
  (talkandroid.com) for the four departments and their effects; multiple Retro Bowl
  College overviews for the college variant.
- **HOOPS OS current state:** grepped this clone — `G.pts` as the single NIL number
  (`ui.js` NIL_SHOP, `views/portal.js` escrowed offers, `season.js` rank drip,
  `views/recruiting.js` offseason bonus, `index.html`/`ui.js` top-bar display).
- **Claude's systems:** verified against the actual `facilities.js` in the repo
  (3 tracks × 5 levels, `upgradeCost(level) = 120 + level*90`, arena +0.5 home court
  and +3 NIL/week per level). Season goals (+40 NIL each), achievements/trophy room,
  and redshirts per his commit message; interface points in §4 are confirmed, not
  assumed.
