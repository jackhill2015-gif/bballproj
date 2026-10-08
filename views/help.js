// ═══════════════════════════════════════════════════════════
//  HOOPS OS — views/help.js
//  "How it works" page: calm, plain-language explanations of
//  every system, verified against the code. Static content —
//  no game state needed.
// ═══════════════════════════════════════════════════════════

import { ge } from '../utils.js';

function panel(title, body) {
  return '<div class="panel"><div class="panel-h"><span>' + title + '</span></div>'
    + '<div class="panel-b help-body">' + body + '</div></div>';
}

function sec(title, text) {
  return panel(title, '<p>' + text + '</p>');
}

export function renderHelp() {
  var el = ge('help-content');
  if (!el) return;

  var h = '<div class="dash-sum"><div class="dash-team"><h1>How it works</h1>'
    + '<div class="sub">Every system in the game, in plain language.</div></div></div>';

  h += sec('Playing and simming games',
    'Use the advance button in the top bar. Sim game gives an instant result; '
    + 'watch game opens the live gamecast with play-by-play. During the regular season you can also '
    + 'sim to the end of the regular season, through the conference tournament (stopping at '
    + 'Selection Sunday), or through the end of the season (stopping at the offseason). '
    + 'In the offseason the button changes with the step: begin the offseason, finish skill points, '
    + 'advance recruiting, or finalize the class and start the new season.');

  h += sec('How games play out',
    'The better team usually wins, about as often as in real college basketball: a team rated 3 points '
    + 'higher wins about 60 to 65 percent of the time on a neutral floor, 6 points about 75 percent, '
    + 'and 12 points about 93 percent. Upsets still happen, and NCAA tournament upsets come at close '
    + 'to the real rates by seed (a 12 seed beats a 5 seed about a third of the time). '
    + 'The win percentage on your schedule uses the same numbers. Home court is worth about 3 to 4 '
    + 'points; conference and NCAA tournament games are on a neutral floor. '
    + 'Your best player takes the most shots, and the second option the next most, so stars put up '
    + 'big lines, but a player who shoots a lot in one game gets a little less efficient. '
    + 'Tied games go to overtime: a full 5-minute period, as many as it takes. Scores show OT or 2OT. '
    + 'Watching a game and simming it play exactly the same basketball.');

  h += sec('Depth chart and minutes',
    'The top five players on the roster screen start; the next four are the rotation. '
    + 'There are 200 minutes to hand out each game. Drag a row by its handle (or use the arrow keys) '
    + 'to reorder, and set minutes with the sliders — minutes are conserved, so raising one player '
    + 'takes minutes from teammates at his position first. Auto set fills a sensible rotation if you '
    + 'would rather not fiddle.');

  h += sec('Gameplan schemes',
    'Pick an offensive and a defensive scheme in the gameplan panel on the roster screen; '
    + 'changes apply from your next game. Offenses: balanced, motion, drive, set, and early — each '
    + 'shifts pace and where shots come from. Defenses: man-to-man, 2-3 zone, 3-2 zone, 1-3-1 zone, '
    + 'and box-and-one — each with a clear tradeoff, like protecting the paint at the cost of open threes. '
    + 'A scheme changes a game by a point or two, not more: players decide games.');

  h += sec('Redshirts',
    'A player can redshirt once in his career, as long as he has played four games or fewer that '
    + 'season. He sits out the rest of the year, keeps his class year, and develops a little extra '
    + 'in the offseason. You can undo it during the season if you change your mind.');

  h += sec('Rankings',
    'The Top 25 is a voters\u2019 poll, modeled on ten seasons of real AP polls. The preseason poll '
    + 'weighs roster talent, last season\u2019s final poll and program reputation. A new poll comes out '
    + 'every other week. Voters move teams by what they did: a loss to an unranked team costs the most, '
    + 'a road loss to a top-10 team the least, and the top five fall less than everyone else. Teams '
    + 'just outside the poll are listed as receiving votes and move in when they earn it. After the '
    + 'NCAA tournament a final poll puts the champion at #1. '
    + 'The NET column is a separate efficiency rating (margin adjusted for schedule strength). The NCAA '
    + 'committee picks and seeds the field on NET and record, not on the poll, so a team can be ranked and still '
    + 'be seeded lower. Conference tables sort by conference win percentage, not raw wins.');

  h += sec('Season goals',
    'Each season the athletic director sets three goals sized to your program: a wins target, '
    + 'a conference finish, and a postseason or signature-win goal. They show on the home screen '
    + 'with live progress. Each goal you meet is worth one skill point and 40 NIL; meet all three '
    + 'and school prestige rises.');

  h += sec('Facilities',
    'Three upgrade tracks, each with five levels, bought once with NIL: the practice facility '
    + 'speeds up offseason development, the arena strengthens your home court and raises ticket sales, '
    + 'and the training room gives injured players a weekly chance to heal early. '
    + 'Facilities belong to the school — take a new job and you start over with that program\'s levels.');

  h += sec('NIL and program finances',
    'NIL is your program budget, shown in the top bar. It comes from ticket sales after each home game, '
    + 'your conference TV share after week 1, the donor collective\'s check each offseason (bigger after a '
    + 'deep March run), NCAA tournament wins (each round pays more) and season-goal bonuses. You spend it on '
    + 'player retention deals, transfer portal offers, facilities and boosts. The Program screen (in the menu) shows '
    + 'every source and what you\'ve spent this season, plus facilities and your coaching career. Its boost shop sells '
    + 'three weekly boosts: sellout crowd (80 NIL, +3 edge in your next home game), film session '
    + '(50 NIL, +2 to shooting, finishing and defense for two games), and recovery session '
    + '(60 NIL, clears every slump and negative effect on the roster). Each can be bought once per week.');

  h += sec('Injuries and morale',
    'Players can get hurt any week — typically out two to four weeks with their minutes set to zero '
    + 'until they return. Academic suspensions cost two games. Morale drifts with results, streaks, '
    + 'and whether a player\'s minutes match his quality; it nudges ratings slightly and unhappy '
    + 'players are far more likely to enter the transfer portal. The roster shows a mood tag only '
    + 'when it matters.');

  h += sec('The offseason, in order',
    'Season recap (spend your skill points right there — unspent points carry over to next season), the coaching carousel, departures (who is leaving, '
    + 'and NIL requests from players who want to stay), the transfer portal, recruiting, signing day, and your '
    + 'non-conference schedule for next season. Each step advances with the button at the bottom or the top-bar '
    + 'button. Before a step where it matters, you get a heads-up (unspent skill points, open roster spots with '
    + 'no offers out, unspent recruiting points, a position with nobody next season); tap again to continue anyway.');

  h += sec('Conference tournaments',
    'Each conference runs its tournament the way it really does (2026 formats). Some take every team, others only '
    + 'the top finishers: the ACC takes 15 of 18, the MAC and Big West 8, the Ivy League 4. Top seeds get byes, often two '
    + 'or three (the Big Ten\'s top four skip three rounds). Several leagues use a stepladder where two seeds join each '
    + 'round. Most play at a neutral site, but the Patriot, America East and NEC play every game on the higher seed\'s '
    + 'court, and the Horizon opens on campus. The format for your league shows above its bracket. The champion gets '
    + 'the automatic NCAA bid.');

  h += sec('NCAA tournament',
    'The field is 76 teams (the 2027 format). Fifty-two are seeded straight into the bracket of 64. The 12 lowest-rated '
    + 'at-large teams and the 12 lowest-rated conference champions play a 12-game Opening Round first: at-large winners '
    + 'become 11 and 12 seeds, champion winners become 15 and 16 seeds. From there it is the usual six rounds.');

  h += sec('Non-conference schedule',
    'Every offseason, after signing day, you set next season\'s 10 non-conference games. The game suggests a '
    + 'balanced slate (a few tough, mostly even, a few easier); tap any game to swap the opponent, or auto-pick again.');

  h += sec('Auto-manage lineup',
    'On the roster screen, turn on Auto-manage and your best healthy players start, the next four rotate, and '
    + 'injured or redshirting players sit. Minutes reset every week, after injuries and returns, and when a new '
    + 'season starts. Turn it off to set the depth chart and minutes yourself.');

  h += sec('Player retention',
    'Before the portal opens, your two or three best returning players ask for an NIL deal to stay '
    + '(a fourth may ask if he is unhappy). Keep pays the ask and he will not enter the portal this year. '
    + 'Let go sends him into the portal; if no school signs him, he stays. Asks grow with rating, '
    + 'production and your program\'s size, and happier players ask for less. All requests together never cost more than three quarters of what your program earned that season. You can switch a decision '
    + 'until you open the portal; switching a keep to let go refunds it.');

  h += sec('Who signed where',
    'After every round of the transfer portal and recruiting, a Round results panel lists who signed with you, '
    + 'who chose another school (and which one), and which of your own players left or came back. Your incoming '
    + 'class panel keeps a running list of transfers in, recruits signed, and open roster spots. On signing day you '
    + 'see the whole class before the season starts, and Home recaps your offseason moves for the first few weeks.');

  h += sec('Recruiting and the transfer portal: the layout',
    'Both screens work the same way. The Board lists every player: his type (for example Floor general or Rim protector) '
    + 'and where he would land on your roster next season: Best player, Starter, Rotation or Bench. Need means he upgrades '
    + 'your roster\'s thinnest area. Tap a player for his page: Overview (your offer or recruiting points, plus fit with your '
    + 'roster), Ratings (strengths, weaknesses and rating bars) and Odds (every school\'s chance to sign him, yours included). Filters live behind the '
    + 'Filter button; tap a filter chip to clear it. You can pursue at most one player per open roster spot, '
    + 'so nobody who signs is ever cut for room. Targets is where you manage everyone you are pursuing: '
    + 'players who signed with you show green, players who went elsewhere show red. '
    + 'Your class shows round results and who has signed. Roster shows your depth chart for next season. The button at '
    + 'the bottom closes the round.');

  h += sec('The transfer portal',
    'The portal runs in three rounds: initial offers, follow-up, and decision day. Offers are '
    + 'escrowed in NIL, placed in steps of 10, and your odds against the field of suitor schools '
    + 'are shown before you commit. Withdrawing after the first round refunds 75% of the offer. '
    + 'Players with a clear leader can sign early, and rival schools bid harder as the rounds '
    + 'advance, so odds decay unless you keep investing. Elite transfers are gated by prestige — '
    + 'a small school can dream, but the math punishes it.');

  h += sec('Recruiting',
    'Mark prospects as targets, then spend recruiting points from a budget built in plain sight: '
    + 'you start with a base amount, add points for every open roster spot (each spot is worth more '
    + 'at a prestigious school), and your coach\'s recruiting skill nudges it higher. More open spots '
    + 'and more prestige mean more points. It runs on the same three-round rhythm as the portal: '
    + 'concentrate points on a few prospects or spread them, watch the odds move, and drop out after '
    + 'round one for a 75% refund. The odds shown are your real chance to sign him on signing day, '
    + 'not a flavor number. Signing day ends with class rankings for every school, for recruiting '
    + 'classes and transfer classes alike.');

  h += sec('Job security',
    'Every season comes with a win expectation based on your roster. Finish below the danger line '
    + 'and you land on the hot seat; keep underperforming and you are fired. Four straight losing '
    + 'years ends it regardless. If you are fired, you find a new job in the carousel — with a '
    + 'small hit to your coach ratings.');

  h += sec('Trophy room',
    'Your career record, national titles, Final Fours, tournament trips, and conference titles, '
    + 'plus a season-by-season table, your season-goal history, and twenty career achievements — '
    + 'from a first win to back-to-back championships.');

  h += sec('Open source',
    'Player faces are generated by facesjs, used under the Apache 2.0 license. '
    + 'A copy of the license is included in the game files.');

  el.innerHTML = h;
}
