# Campus Dynasty — Exhaustive Deep Dive

Research for the HOOPS OS UI rebuild. Researched Oct 2, 2026. **No code changes.**
Companion file: `campus-dynasty-questions-for-jack.md` (things only a player could verify).

**Verification key used throughout:**
- ✅ **VERIFIED** — seen directly (official listing, App Store screenshots I inspected, official changelog text, review text I read in full)
- 🔶 **RECONSTRUCTED** — pieced together from multiple partial sources (changelog + review fragments); likely right, treat as working hypothesis
- ❌ **UNVERIFIED** — could not confirm; listed as-is and mirrored in the questions file

---

## 1. Game identity & vital stats (✅ VERIFIED)

| Fact | Detail |
|---|---|
| Title | **Campus Dynasty** |
| App Store ID | `1463300145` — https://apps.apple.com/us/app/campus-dynasty/id1463300145 |
| Developer | Scott Johnson ("Scott Johnson Studios") — solo dev; one reviewer says he was "a kid in college... an Econ major" at the time |
| Released | May 19–20, 2019 (v0.8.03) |
| Latest version | **0.8.33** (Sept 8/9, 2019) — effectively **abandoned**, no update in 7 years |
| Rating | 4.6★, ~1.6–1.7K App Store ratings; 4.49★ / 1,265 reviews on Google Play before removal |
| Downloads | 50,000+ on Play (removed from Google Play **Oct 16, 2023**); iOS-only since |
| Price | Free. **No ads. No in-app purchases. No stamina/energy timers.** Offline-capable |
| Size | ~52–54 MB. "Extremely fast simulation speeds; very light on battery" (reviewer, 50 hrs played) |
| Age / languages | 4+, English only |
| Universe | **256 fictional teams in 16 conferences** (16 teams each) |
| Season structure | Regular-season weeks + conference tournaments + **64-team national bracket** ("March Madness") |
| Season length | Weeks numbered to at least **Week 25** (seen in screenshots); perfect seasons are **40-0** (fan-tracked: 51 perfect 40-0 title runs across 425 simulated seasons) |
| Dev contact | campusdynasty@scottjohnsonstudios.com (via topalter.com); scottjohnsonstudios.com **no longer resolves**; no findable Twitter/X presence |
| Follow-up | "Franchise Dynasty" announced as "from the maker of the highly successful Campus Dynasty College Basketball Game" (iOS + Android) — status unknown |

**Official description (App Store, verbatim):** "Start your coaching career at a small school and build your reputation. Challenged with school expectations, dynamic play styles, and recruiting battles, your goal is to win as many conference championships and national titles as possible... Create a mobile version of yourself and choose your offensive and defensive schemes. Manage your lineups and player usage rates to form a competitive team. Analyze statistics to adjust your strategy and give your team the greatest chance to win each game. Compete in conference tournaments to secure a bid to the national tournament, and continue that momentum to cut down the nets."

---

## 2. Sources used & reliability

1. **App Store listing** (fetched directly): description, version history, ratings — ✅
2. **Two actual App Store screenshots** (downloaded from Apple's CDN, inspected visually) — ✅ (saved: `dashboard-iphone.jpg`, `dashboard-ipad.jpg`)
3. **Official changelog via apps112.com** — full version history 0.8.03 → 0.8.33 with per-version feature notes — ✅
4. **App Store reviews** (13 distinct, full text): via iofreeonline.com (8 reviews) + worldsapps.com (5 reviews) — ✅ (these aggregate real App Store reviews; authors + dates captured)
5. **iofreeonline.com game page** — features list, tips, Q&A — ✅ (editorial, not official, but specific)
6. **r/CampusDynasty** — ❌ blocked by tool policy; only secondhand snippets (real-teams import text files, dev participation, recruiting-slider complaints)
7. **TouchArcade forums** — ❌ no results found
8. **YouTube** — ❌ effectively nothing: one gameplay-overview embed on worldsapps (video `Rql_yOzxN8Y`, could not fetch — rate-limited), two tiny tutorial videos on appsmenow's walkthrough page ("Level 1" by The Fresh Take, Mar 2025, 78 views; "Level 3" by Sayan Gaming 613, May 2021, ~182 views). No real YouTube community
9. **smcsus GitHub fan project** (`custom-college-basketball-universe-simulation`) — ✅ confirms 16-conference structure, import-via-text-file mechanic, 40-0 perfect-season concept; its conference names are a *custom* universe, not the default
10. **SEO-spam "guide" PDFs** (vaccination.gov.ng etc.) — treated as noise, not used

---

## 3. Screen inventory

### 3a. Dashboard — ✅ VERIFIED (inspected two screenshots)
- **Purpose:** home hub; everything funnels through it.
- **Layout:** bright blue background; blue header bar with **hamburger menu** (left) and centered title "Dashboard". Content is white rounded cards.
- **Elements (top → bottom):**
  1. **School card:** circular logo with school initial ("C" in red circle for "Champaign"), school name ("Champaign"), mascot ("Illini"), conference label ("Midwest", right-aligned). Huge centered **W-L record ("15-9")**, then three columns: **National rank (58) · Conference rank (7) · Seed (15)**. On the iPad shot: 11-5, National 86, Conference 8, **Seed N/A** (early season — seed projection only appears later).
  2. **Notifications row:** bell icon, "Notifications", collapse chevron — a collapsible feed.
  3. **Game cards:** each shows opponent logo-initial circle, opponent name, week label ("Week 24"/"Week 25"), right-aligned score or record. A **green "W" circle** marks a won game with the score ("69-67"); an upcoming game shows the opponent's rank ("12") + their record ("19-5"/"12-4"). Opponents are fictional stand-ins ("Milwaukee", "East Lansing State", "College Park" = Michigan, Illinois, Michigan State, Maryland).
  4. **Two big bottom buttons:** "▶ **Play Game**" and "⏩ **Sim Game**" — the entire game action lives here.
- **Design notes for HOOPS OS:** card-based, one headline number (record) + three sub-stats; the two giant sim buttons at thumb reach. Seed projection displayed mid-season = a "where do we stand" teaser.

### 3b. Game feed / live text view — 🔶 RECONSTRUCTED
- Chosen via "Play Game" = **watch the game slowly** through a text **game feed**; "Sim Game" = instant result.
- The feed and **box score** were revamped in 0.8.32 ("Updated game feed and box score"); **school links inside the box score** (0.8.15) let you tap through to team pages.
- ❌ No visuals: reviewers explicitly ask for "some crowd noise when teams score (if you watch it slowly)" and "a simple court with the players and the ball" — so **in-game is pure text**, no court animation, no audio feedback.
- 🔶 Per one reviewer: during "Play Game" you **cannot** call timeout on a cold streak or switch schemes (man↔zone) — they beg for it. So the in-game experience is **read-only spectating**.

### 3c. Game preview screen — ✅ VERIFIED (changelog 0.8.32)
- "Added game preview" + "Added ability to **watch games that your school is not playing in**" — so there's a pre-game preview (likely matchup, records, maybe stats) and a spectator mode for any game in the universe.

### 3d. Schedule screen — 🔶 RECONSTRUCTED
- Shows **customized non-conference schedule** (you choose your non-con games — ✅ 0.8.16/0.8.33), with **opponent overall rating shown** while scheduling (0.8.33), plus **home/away and overtime indicators** on results (0.8.15).

### 3e. Recruiting screens — 🔶 RECONSTRUCTED (from changelog + reviews + tips)
Mechanics attested across sources:
- You spend a **limited pool of recruiting points ("influence")** on prospects; a review mentions sliders to assign points per recruit.
- Each recruit shows an **interest/chance %**; there are **"crystal ball" predictions** of where they'll commit (0.8.33 patched for "more accuracy and consistency in crystal ball predictions" and "more logical commitment choices").
- Recruiting runs in **multiple stages** ("greater ability to recruit prospects after the first stage" — 0.8.33).
- **Location matters:** the game computes distance between the recruit's home state and the school's home state to influence desire (0.8.32; the tip: "Focus your recruiting efforts on players in your home state first. They are easier to convince and require fewer recruiting points").
- **Playing time matters** as a recruiting factor (0.8.32).
- **Penalties:** an explicit penalty for **recruiting multiple players at the same position** (strengthened in 0.8.33); a previous penalty for **spending too much on one recruit was removed** (0.8.33) — evidence of active tuning.
- **Filter recruits by archetype** (0.8.15); **recruiting class rankings** screen (re-tuned "for a more even distribution" in 0.8.33).
- RNG stings: "you can have 99% to 100% of the recruit's interest and they still do not commit" — and a separate review: losing 1–2 players a year even at 100% "seems ridiculous."
- Scholarships: **13 scholarship slots**; walk-ons don't consume one (0.8.33).

### 3f. Roster / player screens — 🔶 RECONSTRUCTED
- Player cards with attributes; 0.8.32 "Updated interface to focus on **most important attributes**."
- **Player usage rates** are set by the coach (official description) — likely a per-player slider.
- **Player history** page (bug fixed 0.8.12); **record of school draft picks** (0.8.16).
- ⚠️ **Depth chart is NOT meaningfully user-controllable** — a 4★ review: "I have actually no control over the depth chart, I'm the head coach not just a GM... changing someone's position doesn't move them to that position, it just keeps them at their previous spot. Ex. I have an 88 PF starting and an 86 PF on the bench, but I also have a 63 SF starting." This is one of the most actionable UI complaints.

### 3g. Training screen — ✅ VERIFIED (changelog)
- **Manual player training in the offseason** (0.8.15) with **training points** you assign per player; **auto-assign option** (0.8.15).
- Algorithm "modified to balance in-season and offseason" (0.8.3), "favor in-season training over offseason training" (0.8.16), and "emphasize coach development trait" (0.8.18) — so training is a real lever with in-season vs offseason split and a coach trait tied to it.

### 3h. Schemes / gameplan screen — 🔶 RECONSTRUCTED
- You "choose your offensive and defensive schemes" at coach creation (✅ description); a tip references **defensive intensity** and switching to **'box-and-one'** to shut down an opponent's star (iofreeonline Gameplays section) — so per-game defensive gameplanning exists at minimum (intensity + scheme vs. star player).

### 3i. Coach page — ✅ VERIFIED (changelog)
- **Coach awards display**, **tournament record**, **Hall of Famers coached**, **coach prestige trend** (0.8.16/0.8.3), **highlights for previous user coaches** (i.e., your past careers are memorialized), **manual retirement option** (0.8.15). "Create a mobile version of yourself" (avatar) at start (✅ description).

### 3j. Coaching carousel / Available Jobs — ✅ VERIFIED (changelog) + 🔶
- "Added **interest gauge** to carousel" (0.8.33) — each open job shows how interested that school is in you.
- **Sort Available Jobs by program rating, prestige, or interest** (0.8.15); **option to decline job offers** (0.8.15).
- Hiring algorithm "favors consistent success and current school prestige" (0.8.16); "fixed various issues with coach hiring system" (0.8.32).
- Reviewer asks for **firings with teeth**: 2–3 bad seasons at a Duke-level job should get you fired and make it harder to land another big job — implying current firing pressure is weak.

### 3k. Conference page — ✅ VERIFIED (changelog)
- Added 0.8.32 with an **option to change prestige boundaries** (i.e., what prestige bands mean — customizable).

### 3l. Season Review screen — ✅ VERIFIED (changelog)
- Shows **prestige change** for the season (0.8.16).

### 3m. Rankings — ✅ VERIFIED (changelog) + 🔶
- National Top-25-style poll + conference ranks; reviewer went from Top 25 to **#42 after one loss** (so rankings extend past 25 and are volatile); **RPI** added to the ranking system (0.8.052); rankings update **during and after the conference tournament** and "better reflect conference tournament results" (0.8.052/0.8.15).

### 3n. News screen — ✅ VERIFIED (changelog)
- **News stories link to box scores** (0.8.15) — a league news feed with tappable results.

### 3o. Custom universe / import — ✅ VERIFIED
- **Custom universe import** via text file (0.8.052); **web import of custom schools** (0.8.15); r/CampusDynasty shares a **full 256-team real-NCAA text file** (import: copy into Notes → Share → Save to Files → import in-game). **School logo customization** and **secondary color picker** (0.8.052/0.8.15). Q&A confirms you can **manually edit school names and logos**.

### 3p. Settings — 🔶
- **Difficulty presets** attested by one reviewer (Dinsun, "Accessibility: Difficulty Presets"); a prestige-boundaries option lives on the conference page. ❌ Full settings list unknown.

### 3q. Loading — ✅ VERIFIED
- **"Commencing Classes"** loading screen on season start (changelog note), then the Dashboard. Multiple **save files** ("Just choose your save file and play" — review), plus an **"unlocked" mode** where you can choose any team (review fragment; exact unlock mechanism ❌ unknown).

---

## 4. Every flow

### 4a. Career start — 🔶 RECONSTRUCTED
1. Pick a save slot (multiple saves supported).
2. Choose a school — default expectation is you **start small** (official: "Start your coaching career at a small school"); an "unlocked" mode lets you pick anyone (❌ unlock condition unknown).
3. Create your coach avatar ("mobile version of yourself").
4. Choose **offensive and defensive schemes** — your tactical identity.
5. Land on the Dashboard ("Commencing Classes" → Dashboard).

### 4b. Recruiting — 🔶 RECONSTRUCTED step-by-step
1. Open the recruiting board: list of prospects with **position, archetype** (filterable), home state, ratings, and your **current interest/chance %**.
2. Spend from a **finite pool of recruiting points** across prospects (slider per recruit; home-state recruits cost less because distance boosts their desire).
3. Watch **crystal-ball predictions** shift as you and rival schools spend — a live win-probability readout.
4. Survive **multiple stages** — recruiting continues "after the first stage," with commitments resolving over time.
5. Manage constraints: only **13 scholarships**; **penalty for stacking one position**; commitments are RNG-gated even at 99–100% interest.
6. Season-end: **recruiting class rankings** screen compares your class against the nation (re-tuned for a fairer distribution).

### 4c. Gameplan / pre-game — 🔶 RECONSTRUCTED
1. From the Dashboard, open the upcoming game (game preview screen — opponent record, maybe stats).
2. Adjust **lineups and player usage rates**.
3. Set **defensive intensity** and scheme — e.g., flip to **box-and-one** against a superstar (per tips).
4. Optionally set a **custom non-conference schedule** in the preseason, scouting opponent overall ratings while scheduling.
5. Tap **Play Game** (watch text feed slowly) or **Sim Game** (instant).

### 4d. In-game — ✅/🔶
- **What you CAN do:** choose Play vs Sim; **watch other schools' games** you're not involved in (spectator mode).
- **What you CANNOT do:** call timeouts, change schemes/intensity mid-game, make substitutions — the feed is **read-only**. (Explicitly requested by reviewers; treat as confirmed-absent.)
- Game feed + box score; results marked W/L with home/away and **overtime indicators**.

### 4e. Season arc — ✅/🔶
- Weekly games (Week 1 → ~Week 25+), rankings (poll + RPI) updating through the season, **conference tournaments**, then the **64-team national bracket** → "cut down the nets."
- **School expectations** gate your job security (✅ description; exact expectations UI ❌).
- Season Review shows your **prestige change**; school prestige is dynamic and gates both recruiting power and carousel jobs.

### 4f. Offseason — 🔶 RECONSTRUCTED
1. **Season Review** (record vs expectations, prestige delta).
2. **Player training:** assign offseason training points manually or auto-assign.
3. **Draft:** underclassmen may declare (dev patched to reduce declarations); school's draft-pick history tracked. ❌ No interaction confirmed — reviewers wish they could "convince players to not leave for the draft."
4. **Coaching carousel:** job offers arrive with an **interest gauge**; sort by program rating / prestige / interest; **decline offers** or jump. Get fired for bad seasons (weak in practice, per reviewers).
5. **Retirement:** manual option; retired coaches get a prestige trend; start a new career after retiring; past coaches' highlights are kept. One reviewer is in **year 2150**; a fan tracked 425 seasons (2019–2444).

### 4g. Coaching carousel / job changes — ✅ (see 3j)
Interest gauge + sorting + decline offers; hiring favors sustained success + current prestige.

### 4h. Settings / difficulty — 🔶
Difficulty presets exist; prestige boundaries adjustable on the conference page; ❌ full list unknown.

---

## 5. The core loop, minute-to-minute

**A session feels like this** (🔶 reconstructed from reviews + UI):
1. Open the app → pick your save → Dashboard: your record, ranks, seed projection, notifications, next game. (~30 sec)
2. Set your gameplan for the next game or two (lineup, usage, defensive scheme vs. their star). (~2 min)
3. Hit **Play Game** (watch the text feed of a big game) or **Sim Game** — then check the box score, your rank movement, the news feed. (~1–5 min)
4. Mid-season: check the recruiting board, nudge points onto a prospect, watch your crystal-ball % move. (~2 min)
5. Offseason (every ~15–20 min of play): Season Review → assign training points → watch the carousel (do bigger schools want me? do I jump?) → new recruiting cycle begins.
6. Close anytime — nothing is timed, gated, or ad-blocked. Reopen mid-week with zero penalty.

**Decisions per session:** where recruiting points go (the big one); lineup/usage tweaks; defensive scheme vs. next opponent; schedule cupcakes vs. resume-builders in non-con; stay or jump in the carousel; when to retire.

**Session length:** designed for stolen minutes — one reviewer: *"it doesn't require a ton of attention but just enough to keep you engaged"*; another: sim is so fast you can burn a whole season in a sitting ("just one more season").

---

## 6. WHAT MAKES IT ADDICTIVE — concrete, not vague

1. **Scarce-points recruiting with visible odds is the entire tension engine.** A fixed budget, per-prospect interest %, and a crystal ball that moves as rivals spend. Reviewers: *"The recruiting battles are surprisingly tense, as you have to balance your limited 'points' to convince high school stars to choose your program over established powerhouses"*; Dinsun: *"The recruiting is the highlight — it actually feels like you're fighting for talent."* The never-quite-100% RNG (losing recruits at 99–100%) is frustrating *and* the reason the next cycle hooks you — variable-ratio reward on a visible probability bar.
2. **Worst-to-first progression with a number that moves.** Prestige visibly rises as you pull upsets and win tournaments, which *mechanically* unlocks better recruits and better carousel jobs. *"Watching your small school's prestige rise as you pull off upsets in the national tournament is a great feeling."* One number, always climbing, always meaningful.
3. **Zero friction, zero blockers.** No ads, no IAP, no stamina, no timers, works offline, autosaves, multiple save slots, seasons sim in seconds. Reviewers wrote their *first-ever* App Store reviews just to praise the absence of monetization: *"Sadly, the best compliment of this game is the fact that you aren't held back by anything."* Every blocker in a competitor is a quit point Campus Dynasty never has.
4. **Tournament drama as a scheduled payoff.** Conference tournaments → 64-team bracket → "cut down the nets" is a season-long drumbeat with a fixed, legible climax. Single-elimination = upset stories ("win like 8 games in a row, become top 25... lose to a very good team").
5. **Fast sims + fast.** "Ext" + "Ext� to 42, " a NIT-type tournament for teams who almost made the tournament" |
| "Cinema" 5★ | Rankings too volatile; wants an NIT for bubble teams |
| "TRANSFER PORTAL" 5★ | Transfer portal, most-requested feature |
| "Amazing game, but I have one problem" 4★ | **No depth-chart control**; position changes don't re-slot players (88 PF benched behind 63 SF) |
| "Game Potential" 2★ | Loses to unranked teams every season; "no perk to keep playing"; boring once figured out |
| Mitchell3520 (appsmenow) | Wants a way to **convince players not to declare for the draft** |
| Sam4461 (appsmenow) | Mac version can't scroll |
| JohnCracker (appsmenow) | Bug: after a few seasons "won't let me sim" |

**Praise themes (what they love):**
- Simplicity / clean UI / easy to pick up ("I love the simplicity")
- Addictive "one more season" loop ("so addicting! I can't put it down")
- No ads / no IAP / no stamina — the single most-cited praise point, multiple first-ever reviews
- Fast sims, offline play, light on battery ("very fun to play when offline")
- Tense recruiting battles; fulfilling worst-to-first climb
- Real-teams mod community extended the game's life for years
- Longevity: players with 50+ hours, 5 national titles, saves in year 2150

**Beg list (ranked by frequency):**
1. Transfer portal (with transfer points, playing-time logic) — #1 by far
2. In-game management: timeouts, mid-game scheme changes, something to *watch* (court view, crowd noise)
3. Promises / convincing players to stay (anti-draft-declare, anti-transfer)
4. Redshirts
5. Firings with teeth + job-market consequences
6. Press conferences affecting coach popularity/recruiting
7. Practice levels affecting energy/morale; injuries requiring depth
8. NIT-style secondary tournament
9. All-time coach rankings after retirement (vs. K/Wooden stand-ins)
10. UI/visual refresh (same fonts/colors since 2019)
11. College football version (constant refrain)

---

## 8. Strengths to steal (each tied to HOOPS OS)

1. **The two giant buttons: "Play Game / Sim Game" on the Dashboard.** The primary action is always visible, thumb-reachable, and unambiguous. HOOPS OS should have one persistent, context-aware primary action ("▶ Sim vs Duke" → "▶ Sim Week" → "▶ Start Tournament") — never make the player hunt for "next."
2. **Dashboard as identity card + next action.** School name/mascot/conference, one huge record, three sub-ranks (national/conf/seed), then the next game. HOOPS OS home screen should open with *who you are, how you're doing, what's next* — no menu-diving.
3. **Scarce-points recruiting with visible win % and a crystal ball.** The single best mobile recruiting UI pattern in the genre: one screen, a budget, live odds, rival schools in the race. Steal the *legibility* (percent bar + prediction), fix the RNG feel (never let a displayed 100% lose silently).
4. **Seed projection as a mid-season teaser.** Showing "Seed: 15" (or N/A early) turns every week into bracket speculation. HOOPS OS: a live "tournament pulse" on the dashboard all season.
5. **Worst-to-first as the default fantasy.** Start small, prestige-gate everything, make the carousel's interest gauge the visible job ladder. HOOPS OS already plans a carousel — add the per-job interest meter and explicit school expectations.
6. **Ruthless verb reduction.** The whole game is recruit → scheme → lineup → sim. Every screen poses exactly one decision. Adopt as a design rule: if a screen doesn't pose a decision, merge or cut it.
7. **Respect-the-player's-time as a values decision.** No ads, no energy, offline, autosave, multi-save, instant sims. Reviewers treat this as the game's defining feature. Write it down as a HOOPS OS principle, not just a nice-to-have.
8. **Spectate-any-game.** Letting players watch games they're not coaching turns the universe into a living thing and makes tournament season an event. Cheap to build (same feed renderer), high delight.
9. **Custom universe import.** A text-file/URL import created a mod community that kept the game alive for years after abandonment. HOOPS OS: support importable team sets from day one.
10. **Coach legacy.** Retired-coach prestige trends, Hall of Famers coached, past-career highlights. HOOPS OS: a coach profile that accumulates a permanent legacy (trophy case, HoF) even across saves.

## 9. Weaknesses to avoid (each tied to HOOPS OS)

1. **Read-only games.** No timeouts, no mid-game adjustments, not even crowd noise. The #2 complaint cluster. HOOPS OS: any "watch game" mode must let the player *do* something (timeout to kill a run, switch defense, ride the hot hand).
2. **Fake depth chart.** Letting players change a position label without re-slotting the depth chart is worse than no control at all — it teaches distrust. If HOOPS OS shows a depth chart, every drag/drop must actually change who plays.
3. **The 80-prestige clamp bug.** A progression number that silently stops moving kills the core fantasy. Any prestige/XP system needs visible, debuggable movement — and edge-case testing at the boundaries.
4. **Difficulty cliff.** "Becomes too easy after 10 seasons." Plan difficulty scaling (smarter AI recruiting, rising expectations, carousel poaching of your assistants/players) from the start.
5. **Weak job pressure.** Reviewers had to *ask* to be fired. School expectations should have real teeth (firing, forced resignation, job-market cooldown) or they're set dressing.
6. **Dated, frozen UI.** Seven years of identical fonts/colors reads as abandonment. Build HOOPS OS's visual system on tokens so a refresh is cheap.
7. **No transfer portal / no roster churn systems.** The single most-begged feature. HOOPS OS should ship a portal (or equivalent) at launch, not as an afterthought.
8. **Abandonment.** The dev vanished after Sept 2019 (even the Android build got delisted). Community goodwill curdled into "don't waste your time, developers don't care." Ship a game you can sustain, or open the data formats so the community can.

---

## 10. Version history (official changelog highlights — ✅)

- **0.8.03 (May 20, 2019)** — launch
- **0.8.05 / 0.8.052 (June 2019)** — custom universe import; coach records; school logo customization; RPI added to rankings; ranking updates during/after conference tourney; archetype tuning; recruiting stabilization
- **0.8.12 (Jul 1)** — player history bugfix
- **0.8.15 (Jul 15)** — offseason manual training + auto-assign; web import of custom schools; box-score school links; coach awards on Coach page; job sorting (program rating/prestige/interest); recruit archetype filter; secondary color picker; tutorials; home/away + OT indicators; decline job offers; manual retirement
- **0.8.16 (Jul 16)** — custom non-conference schedules; school draft-pick records; prestige change in Season Review; tournament record + Hall of Famers on Coach page; past-coach highlights; training favors in-season; hiring favors sustained success + prestige; fewer underclassmen declare
- **0.8.17 (Jul 22)** — fix new-career-after-retirement bug; coach prestige trend for retired coaches; training balance; hiring algorithm for new coaches
- **0.8.3 (Aug 25)** — (see 0.8.17 items; version numbering is messy)
- **0.8.32 (Sep 4)** — conference page + changeable prestige boundaries; game preview; spectate other schools' games; deeper drafted-player info; recruiting favors location + playing time; attribute UI refocus; game feed + box score revamp; storage optimization ("Commencing Classes" loader → Dashboard); coach hiring fixes
- **0.8.33 (Sep 8)** — stronger same-position recruiting penalty; opponent overall rating in custom scheduling; interest gauge on carousel; class-ranking distribution fix; removed overspend-on-one-recruit penalty; 13 scholarships, walk-ons freed

---

## 11. Community & mods (🔶/❌)

- **r/CampusDynasty** exists; the dev participated. Community shares a **full 256-team real-NCAA text file** (import via Notes → Files). One snippet mentions recruiting-point sliders "have been tricky."
- **Real-teams mod** is cited by multiple reviewers as how they play every save — the import feature is the game's afterlife.
- **Fan reference site** (smcsus GitHub): tracks custom-universe title history across 425 seasons, 51 perfect 40-0 runs — evidence of extreme long-session play (one reviewer at year 2150).
- ❌ Could not verify thread topics, dev-post contents, or Discord existence (no Discord found).

---

## 12. What I could NOT verify (see questions file)

- Step-by-step recruiting UI (point totals, stage count, how crystal ball is displayed)
- What "Play Game" actually shows moment-to-moment (feed speed, quarter structure, any interaction)
- Full scheme list (offensive/defensive scheme names)
- How usage rates and lineups are set; whether depth chart is truly read-only
- Notifications content; school-expectations UI; firing sequence
- Carousel mechanics (do offers come to you? can you apply?)
- Season/week structure details; conference tournament format; how the 64-team field is selected (auto-bids? at-large?)
- Draft interaction (or lack thereof); walk-on mechanics; "unlocked" mode rules
- Settings/difficulty preset contents; coach avatar options
- Screenshot evidence beyond the Dashboard (only 2 screenshots exist on the App Store)

---

## 13. Source links

- App Store: https://apps.apple.com/us/app/campus-dynasty/id1463300145
- Full changelog: https://campus-dynasty-ios.apps112.com
- Reviews (8, full text): https://www.iofreeonline.com/IOS/game/Campus-Dynasty.html
- Reviews (5 more): https://worldsapps.com/download-campus-dynasty
- Walkthrough/videos: https://appsmenow.com/walkthrough/168337-campus-dynasty
- Fan universe tracker: https://github.com/smcsus/custom-college-basketball-universe-simulation
- Dev contact: campusdynasty@scottjohnsonstudios.com (site dead, no social found)
