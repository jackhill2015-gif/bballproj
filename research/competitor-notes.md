# Competitor Research Notes — HOOPS OS UI Rebuild

Target: a clean, simple, snappy vanilla-JS browser college-basketball dynasty sim.
Researched Oct 2, 2026. Research-only; no code changes.

- Target 1: **Basketball GM** (basketball-gm.com) — deep research below.
- Target 2: **Campus Dynasty** (Scott Johnson Studios, iOS/Android) — brief summary only; a separate agent is doing exhaustive Campus Dynasty research.

---

# PART 1 — BASKETBALL GM (deep dive)

Free, browser-based, single-player sports-management sim by Jeremy Scheff (ZenGM). No signup, no download, saves locally in the browser (IndexedDB). Current version ~v2026.10. Completely free, no ads.

## 1. UI structure

**Global frame (inside a league):**
- **Top navigation bar** with grouped dropdown menus — the entire game is reachable from it. Sections are roughly: *League* (Dashboard, Standings, Playoffs, Power Rankings, History, Transactions, Leaders, Team Stats, Team History, Awards, Hall of Fame, Player Bios), *Team* (Roster, Depth Chart/Lineup, Stats, Schedule, Team Finances, Trade, Free Agents), *Draft/Players* (Draft, Draft Lottery, Scouting, Watch List), *Tools* (God Mode, Export/Import League, Edit League Info, Multi-Team Mode). New players never need to memorize this — the Play button (below) does the driving.
- **The Play Menu — the single most important UI element** (manual's own words: *"the most important user interface element is the Play Menu, which you can access with the big green Play button at the top of the screen. Any context-dependent action, like playing a game or moving from one phase to another, is done from the Play Menu"*). It's a big green button, always visible, whose contents change with game state: during the season it offers *Play Game / Play Week / Play Month / Play Until All-Star Game / Play Until End of Regular Season / Play Until Playoffs*; in the offseason it becomes *Run Draft Lottery / Start Draft / Advance to Re-Signing / Start Free Agency*, etc. The player never asks "what do I click next?" — the answer is always the green button.
- **Multi-league dashboard** (play.basketball-gm.com root): cards for every league/save you've created, each showing team, season, record at a glance, plus "create new league" (random players, real-player rosters for any historical season, or custom rosters). Infinite parallel saves, zero friction.

**Key screens and their layouts:**
- **League Dashboard (home screen):** the "since you were away" digest. Current phase, your team's record, upcoming games, recent results/scores, news items (injuries, trades around the league, award races), quick links to roster/schedule. Information hierarchy is strictly: *what changed → what needs my decision → what's next*.
- **Roster page:** a dense sortable table. Every player row shows **ovr** (overall) and **pot** (potential) ratings at a glance, contract, age — plus tiny **skill symbols** next to names (e.g. `3` = three-point shooter, `A` = athlete, `B` = ball handler, `Di` = interior defender, `Dp` = perimeter defender, `Po` = post scorer, `Ps` = passer, `R` = rebounder, `V` = volume scorer). Hovering explains them. Recent versions added an **"Acquired" column** (drafted / traded for / signed) because fast-simmers forgot where players came from, and **team ratings (0–100)** on the Roster and Power Rankings pages. Lesson: glanceability is engineered — you can evaluate a whole roster in ~5 seconds.
- **Ratings system:** 0–100 scale, whole scale used, typical = 50. Benchmarks are documented in the manual (85+ = all-time great, 75+ = MVP candidate, 65+ = All-League, 55+ = starter, 45+ = role player). Displayed ratings are **scout estimates, not true ratings** — spending more on scouting (Team Finances page) gradually makes them more accurate over ~3 seasons. This creates a whole uncertainty/fog-of-war layer for free.
- **Team Finances page:** revenue/expense breakdown with sliders for scouting, coaching, facilities, etc. Spending choices have gradual, explainable effects.
- **Depth chart / lineup:** set starters and rotation; AI can auto-set. Out-of-position penalties apply.
- **Trade screen:** propose trades with AI teams; AI evaluates and counter-offers. There's a trade finder and the AI will *send you offers* unprompted.
- **Draft room:** pick-by-pick draft with a live draft board showing ovr/pot of available prospects.
- **Live game sim:** optional play-by-play view with a live-updating box score — you can *watch* a game unfold possession by possession, or skip it. Big games feel like events.
- **History pages:** every season's standings, playoff results, awards, champions; **Hall of Fame** page; career leaderboards (points, rebounds, etc.); **team history** pages; league records. Achievements/trophies system layered on top. This is the game's memory — nothing you do is ever lost.
- **God Mode** (Tools menu): edit anything — ratings, contracts, teams, league rules (salary cap, draft length, etc.). It's a sandbox release valve: when the sim frustrates you, you can bend it instead of quitting.
- **News/transaction log:** every signing, trade, injury, firing across the league is logged and surfaced on the dashboard.

## 2. Core loop — minute by minute

**A typical session:**
1. Open league → **dashboard digest** (30 sec): record, last night's scores, news (injury? trade offer? award race movement?).
2. Handle anything needing a decision: counter a trade offer, adjust lineup for an injury, re-sign talks (5 min).
3. Hit the **green Play button** → pick a sim chunk (a game, a week, a month) → watch results roll in (2–10 min).
4. React: check box scores of close games, look at the standings, scan the draft lottery odds if tanking, tweak finances (5 min).
5. Repeat steps 3–4 until the season phase changes; the Play button walks you into the next phase (playoffs → lottery → draft → re-sign → free agency → preseason).
6. Offseason is its own mini-game with distinct screens and tension at each step: lottery (hope), draft (evaluation), re-signing (negotiation with player "mood traits"), free agency (bidding).
7. Quit anywhere — autosave means zero session-commitment anxiety.

**Season loop:** Preseason (player development/aging) → Regular season (sim at your pace) → Playoffs (bracket) → Draft lottery → Draft → Re-sign players → Free agency → repeat. The manual states it plainly: *"There is no real way to 'win' at Basketball GM. The game never ends."*

**Why the loop never gets stale:** the player sets their own goal (most titles, most profit, develop a rookie into a legend, rebuild a laughingstock), and the game supports all of them. Difficulty and even league rules are customizable, and God Mode removes any hard wall.

## 3. Why it's addictive (addictiveness drivers)

1. **Zero friction to start and to continue.** Free, browser, no signup, no install. One click = new league. Autosave = you can quit mid-season with no penalty. This is the #1 driver — every other game in the genre makes you download, register, or sit through ads first.
2. **The Play button removes decision paralysis.** You never wonder what to do next; the game always offers exactly the right next action. Momentum is preserved. This is the pattern most worth stealing (see steal list).
3. **Player-controlled sim granularity.** One game, one week, one month, whole season, or watch live play-by-play. A 5-minute check-in and a 3-hour marathon are both first-class. Fast sims = tight feedback loops = "just one more week."
4. **Emergent narratives.** A 2nd-round pick with B-pot becomes an MVP; your aging star falls off a cliff; a rival team wins 3 straight titles. The history/HoF/records system *remembers* all of it, which turns random numbers into stories. The "Acquired" column exists precisely because players form attachments and forget origins.
5. **Variable-ratio rewards.** Draft lottery, player development jumps (progs), upset playoff runs, free-agent signings — unpredictable payoffs on a fast loop.
6. **Glanceable mastery.** ovr/pot + skill symbols mean an expert can evaluate a roster in seconds, while a beginner gets the benchmarks spelled out (85+ = all-time great, etc.). Depth that reads instantly.
7. **Sandbox release valves.** God Mode, custom rosters (including real historical NBA rosters now built in), editable league rules, multi-team control, export/import leagues, and even a JS console API. When the game frustrates, you bend it instead of leaving. The real-rosters feature and community custom rosters give endless "what-if" scenarios.
8. **Achievements + legacy systems.** Trophies for feats; Hall of Fame; career leaderboards; franchise history pages. Goals beyond "win the title this year."
9. **The developer's stated philosophy — "fun over realism."** The All-Star Game was added explicitly as a pure diversion: *"Yes, even a text-based simulator like Basketball GM still needs to be fun."* Features that don't matter strategically still get built if they're delightful. (If your team has an All-Star captain, *you* get to draft his team — silly, unrealistic, fun.)
10. **Sunk-cost legacy.** After 20 simmed seasons with full history, your league is *yours*. Quitting feels like abandoning a world.

## 4. Patterns worth stealing (BBGM-specific, detail in steal list §6)

- The context-aware Play/Advance button as the single primary action.
- Dashboard-as-digest home screen ("what changed, what needs you, what's next").
- ovr/pot + one-glance skill tags on every player row.
- Scout-accuracy-as-fog-of-war (displayed ratings are estimates; spending improves them gradually).
- Sim granularity (game/week/month/season + optional live watch).
- Phased offseason where each step is its own tense screen.
- Permanent history: HoF, records, career leaderboards, team history pages.
- Achievements beyond championships.
- God Mode / sandbox editing as a frustration release valve.
- Multi-save dashboard with one-click new leagues.
- AI-initiated events (trade offers, contract demands) that come to *you*.

---

# PART 2 — CAMPUS DYNASTY (brief summary)

*Scope note: a separate agent is doing exhaustive Campus Dynasty research. This is a short summary from App Store data, verified user reviews, and gameplay writeups.*

**What it is:** College-basketball dynasty management sim for iOS/Android by Scott Johnson Studios (solo dev, an econ major in college at the time). 256 teams in 16 conferences. Last updated v0.8.33 (Sep 2019) — effectively abandoned, yet still 4.6★ (~1,600+ iOS reviews), free, **no ads, no IAP, no stamina/energy mechanics**.

**Core loop:** Create a coach → pick offensive/defensive schemes → take over a small school → **recruiting battles** (limited recruiting-points budget; spend points to raise a prospect's interest %, fight powerhouses for talent; home-state prospects are cheaper) → set lineups and player usage rates → sim or watch text-based games → conference tournament → 64-team national bracket → offseason: prestige update, **coaching carousel** (with an "interest gauge" showing which schools want you) → repeat. Win → prestige rises → better recruits → bigger jobs.

**What players praise (verbatim themes from reviews):**
- *"No ads, no waiting for stamina and no monetary upgrade options… it doesn't require a ton of attention but just enough to keep you engaged."*
- *"The recruiting battles are surprisingly tense… you have to balance your limited 'points' to convince high school stars to choose your program over established powerhouses."*
- *"It's great going from worst to first… tedious, but in a way it feels fulfilling."*
- *"Super addictive, and very fun to play when offline"* — fast sims, light on battery, respects your time.
- Simplicity/clean UI: *"I love the simplicity. It's so easy to understand and pick the game up."* One reviewer played ~50 hours and won 5 national titles.
- Real-teams community mods extended its life for years.

**What players complain about:**
- Abandoned (no updates since 2019); missing transfer portal/redshirts (in early versions); becomes too easy after ~10 seasons; a prestige bug that clamps prestige at 80; even at 99–100% recruit interest you can still lose the recruit (RNG frustration); games are sim-only text with no watchable action; wants press conferences, practice intensity, firings with teeth.

**Mobile patterns worth noting:**
- **Ruthless scope control:** the whole game is ~4 verbs — recruit, scheme, lineup, sim. Stripped-down menus; nothing that isn't a decision.
- **Scarce-point recruiting with visible odds** = the entire tension engine, and it fits a phone: one screen, a budget, percentages, tap to allocate.
- **Session-friendly:** seasons sim in seconds; playable offline in short bursts; no timers or energy bars blocking progress.
- **Underdog fantasy as the default start** (small school → build prestige → earn the big job) rather than handing the player Duke on day one.

---

# PART 3 — THE STEAL LIST

Ranked by value for HOOPS OS: a clean, simple, snappy college-basketball dynasty game. Each item: what it is, who does it, why it works, how it maps to HOOPS OS.

## 1. One persistent context-aware "Advance" button (BBGM's Play Menu)
- **What:** A single big primary button, always visible, whose label and options change with game state: "Sim Game," "Sim Week," "Sim to Selection Sunday," "Open Recruiting," "Advance Offseason," etc.
- **Who:** Basketball GM's big green Play button — *"Any context-dependent action, like playing a game or moving from one phase to another, is done from the Play Menu."*
- **Why it works:** Eliminates "what do I click next?" paralysis. Every session has exactly one obvious next action, which preserves momentum and makes 5-minute sessions viable.
- **HOOPS OS mapping:** A fixed-position primary button (top bar or floating) that always names the next step, e.g. "▶ Sim vs Kansas (Tue)" → "▶ Sim Week" → "▶ Start Conference Tourney." Secondary options in its dropdown for other granularities. This should be the single most prominent element in the UI.

## 2. Dashboard-as-digest home screen (BBGM)
- **What:** Home = "since you were away" digest: record, recent scores, news (injuries, upsets, award races, carousel rumors), items needing a decision, and what's next — not a menu of links.
- **Who:** BBGM League Dashboard.
- **Why it works:** Information hierarchy answers three questions in order: what changed → what needs me → what's next. Returning players re-orient in 30 seconds.
- **HOOPS OS mapping:** Home screen is a chronological feed: last sim's results, recruiting updates ("4★ PF Jamal Carter 72% → you lead"), injuries, upcoming game preview. Decisions (unsigned recruits, open scholarships) pinned at top.

## 3. Recruiting as a scarce-points battle with visible odds (Campus Dynasty)
- **What:** A fixed recruiting-points budget per cycle; spend points on prospects to raise their interest %; you see your live win probability against rival schools; home-region prospects cost less.
- **Who:** Campus Dynasty — reviewers call it the highlight: *"it actually feels like you're fighting for talent."*
- **Why it works:** Scarcity + visible probability = tension on every tap. It's the whole game compressed into one screen, perfect for short sessions.
- **HOOPS OS mapping:** Recruiting screen shows each target with a live commit-% bar, points spent, and rival schools in the race. Points budget refreshes each signing period. Never hide the odds — the odds *are* the game.

## 4. One-glance player evaluation: ratings + skill tags (BBGM)
- **What:** Every player row shows two numbers (overall / potential) plus tiny skill badges (`3` sharpshooter, `Dp` perimeter defender, `Ps` passer, `R` rebounder…); hovering explains; benchmarks are documented (55+ = starter, 65+ = all-league).
- **Who:** BBGM roster page + manual.
- **Why it works:** Experts evaluate a roster in 5 seconds; beginners get the scale spelled out. Badges create narrative identity ("my lockdown guy") at zero UI cost.
- **HOOPS OS mapping:** Player rows/cards always show OVR/POT chips + 2–4 badge tags (e.g. "Sharpshooter," "Floor General," "Rim Protector," "Microwave"). Define the scale publicly in a help tooltip (e.g. 80+ = All-American level).

## 5. Player-controlled sim granularity + optional live watch (BBGM)
- **What:** Sim one game, one week, one month, or a full season in seconds — plus an optional live play-by-play view with updating box score for games you care about.
- **Who:** BBGM Play menu + live game sim.
- **Why it works:** 5-minute check-ins and 3-hour marathons are both first-class. Fast sims = tight feedback loops = "just one more week." The live view makes big games feel like events without forcing you to watch every game.
- **HOOPS OS mapping:** Advance button offers Sim Game / Sim Week / Sim to [milestone]. Add a skippable live play-by-play + box score for rivalry games, tournament games, and Top-25 matchups. Default to fast; make the spectacle opt-in.

## 6. A permanent dynasty almanac: history, records, Hall of Fame (BBGM)
- **What:** Every season archived (standings, brackets, awards, champions); career leaderboards; a Hall of Fame; team history pages; records that get flagged when broken.
- **Who:** BBGM history/HoF/records system.
- **Why it works:** Turns random numbers into legacy. Sunk-cost attachment ("my 30-season world") is the strongest retention mechanic in the genre. The "Acquired" column exists because players bond with players and forget origins — design for attachment.
- **HOOPS OS mapping:** A "History" section from day one: past champions, Final Fours, award winners, your program's season-by-season record, career record book (points, wins), a Hall of Fame for players and coaches. Flash a "New school record!" moment when one falls.

## 7. Worst-to-first career arc with a visible job ladder (Campus Dynasty)
- **What:** You start at a small school with low prestige; winning raises prestige and unlocks better jobs via a coaching carousel that shows an "interest gauge" of which schools want you; each school states its expectations (e.g. "make the tournament by year 3").
- **Who:** Campus Dynasty (start-small design + carousel interest gauge); BBGM has firings/job pressure in some configs.
- **Why it works:** The climb *is* the fantasy — *"great going from worst to first… tedious, but in a way it feels fulfilling."* Visible expectations turn each season into a quest with stakes (get fired or get poached).
- **HOOPS OS mapping:** HOOPS OS already plans a coaching carousel — add: (a) start-small default, (b) an interest meter per open job, (c) explicit school expectations shown on the dashboard ("Expectation: .500+ in conference"), (d) real firing risk for missing them repeatedly (reviewers explicitly asked for firings "with teeth").

## 8. A phased offseason where each step is its own tense screen (BBGM)
- **What:** Offseason isn't one screen — it's a sequence: draft lottery (hope) → draft (evaluation) → re-signing (negotiation, with player mood traits) → free agency (bidding). The Play button walks you through; each phase has distinct UI and tension.
- **Who:** BBGM season phases.
- **Why it works:** Breaks a complex blob into a series of small gambles, each with its own reveal moment. Pacing variety keeps the loop fresh 50 seasons in.
- **HOOPS OS mapping:** Structure the offseason as visible phases with distinct screens: Transfer Portal window → Recruiting signing period(s) → Coaching carousel → Player development reveals ("+4 OVR!"). Give each phase a reveal beat, not just a results table.

## 9. Scout accuracy as fog-of-war (BBGM)
- **What:** Displayed ratings are your scouts' *estimates*, not true ratings. Spending on scouting gradually sharpens them over ~3 seasons.
- **Who:** BBGM manual: *"The displayed ratings are not the real ratings. They are estimates from your scouts."*
- **Why it works:** A whole uncertainty/strategy layer for free — do you trust the 72-ovr freshman or pay to find out? Creates busts and sleepers, the lifeblood of dynasty stories.
- **HOOPS OS mapping:** Show rating ranges or confidence ("OVR 68–74?") for recruits; invest program resources or scout visits to narrow them. Cheap to implement, huge narrative payoff.

## 10. Achievements beyond championships (BBGM)
- **What:** A trophy/achievement system for feats: undefeated season, 10 straight tournament bids, developing a walk-on into a starter, biggest upset, etc.
- **Who:** BBGM achievements.
- **Why it works:** Gives players self-directed goals when the title race is out of reach — the manual's *"your goal can be whatever you want"* made concrete. Keeps losing seasons interesting.
- **HOOPS OS mapping:** A trophy case on the coach profile: First Upset, Giant Killer (beat a 1-seed), Program Builder (take a sub-70 prestige school to the Final Four), Lifer (10 seasons at one school). Show progress toward the next one.

## 11. Ruthless menu reduction — every screen must pose a decision (Campus Dynasty)
- **What:** The entire game is ~4 verbs: recruit, scheme, lineup, sim. No bloated submenus; text-first; nothing that isn't a decision.
- **Who:** Campus Dynasty — *"strips away the bloated menus of console sims and focuses on what matters"*; *"I love the simplicity."*
- **Why it works:** On any screen size, cognitive load is the enemy. Campus Dynasty's clean UI is cited as a core strength even by critics of its depth.
- **HOOPS OS mapping:** Design rule: each screen gets one headline decision (Recruiting = where do my points go?; Lineup = who's in the rotation?; Schemes = what's our identity?). If a screen doesn't pose a decision, merge it or cut it.

## 12. Respect the player's time: no blockers, instant local saves, parallel saves (both)
- **What:** No ads, no energy/stamina timers, no IAP gates; autosave after everything; multiple save slots; one click starts a new dynasty; seasons sim in seconds; playable offline.
- **Who:** Both — BBGM (free/browser/autosave/multi-league dashboard) and Campus Dynasty (*"no ads at all… no stamina… respects your time"*; *"very light on battery"*).
- **Why it works:** The genre's audience plays in stolen minutes. Every blocker (ad, timer, login wall) is a quit point. Reviewers literally wrote their first-ever App Store review just to praise the *absence* of monetization friction.
- **HOOPS OS mapping:** localStorage autosave, multiple save slots, zero mandatory onboarding gates, sub-second sims. Never add energy mechanics, ever. This is a values-level decision worth writing down.

## 13. Team quality feedback: power rankings + visible prestige (BBGM + Campus Dynasty)
- **What:** BBGM's 0–100 team ratings on the Roster and Power Rankings pages; Campus Dynasty's dynamic school prestige that gates recruiting and jobs.
- **Who:** Both.
- **Why it works:** A single number that moves up/down after your decisions is the tightest feedback loop in the genre. It makes rebuilding *feel* like progress before the wins come.
- **HOOPS OS mapping:** Show program prestige and team OVR prominently and animate the change ("Prestige 64 → 71 ▲"). Tie it visibly to recruiting power and carousel interest so the number *means* something.

## 14. AI-initiated events that come to you (BBGM)
- **What:** Trade offers, contract demands, and award-race news arrive unprompted on the dashboard; you react rather than hunt.
- **Who:** BBGM transaction/news feed.
- **Why it works:** Pushes variety into the loop without menu-diving. Every dashboard visit can contain a surprise — the "what happened while I was away" dopamine hit.
- **HOOPS OS mapping:** Recruit decommitment scares, assistant coach poaching, 5-star surprise interest, booster demands, preseason tournament invites — delivered as dashboard news items with a one-tap response.

## 15. "Fun over realism" set pieces (BBGM)
- **What:** Features built purely for delight with no strategic weight: the All-Star Game (with a draft *you* run if your player is captain), real historical rosters for what-if scenarios, God Mode sandboxing.
- **Who:** BBGM — *"Yes, even a text-based simulator like Basketball GM still needs to be fun."*
- **Why it works:** Gives players toys, not just systems. These are the moments people tell friends about, and they cost little to build.
- **HOOPS OS mapping:** Plan 2–3 pure-fun set pieces: a midseason multi-team invitational tournament you can watch live, rivalry-week presentation (trophy games), and a sandbox/God Mode for what-if edits. Explicitly budget for at least one "silly but fun" feature per milestone.

---

## Sources

- Basketball GM manual: https://basketball-gm.com/manual/
- Basketball GM homepage/feature list: https://basketball-gm.com/
- ZenGM blog, "All-Star Game" post (Play-menu design + fun-over-realism philosophy): https://github.com/zengm-games/zengm.com/blob/HEAD/src/posts/2019-09-30-all-star-game.md
- Campus Dynasty App Store data + user reviews via https://www.iofreeonline.com/IOS/game/Campus-Dynasty.html (aggregates App Store listing: 4.6★, ~1,617 reviews, v0.8.33, Sep 2019)
- Campus Dynasty store/changelog details: https://appwisp.com/app/ios/com.campusdynasty.basketball

## Caveats for the rebuild team

- BBGM is a **pro-basketball (NBA-style)** game with drafts, salary caps, and trades — mechanics that don't transfer 1:1 to college. Steal its *UI patterns and loop structure*, not its systems. (E.g. "trade finder" → "recruiting battles"; "free agency" → "transfer portal.")
- BBGM's UI is desktop-first dense tables; on a phone it's cramped. Campus Dynasty is the better reference for **small-screen information density**.
- Campus Dynasty's #1 complaint is that it was abandoned and got too easy — HOOPS OS should plan difficulty scaling and job pressure from the start rather than bolting them on.
