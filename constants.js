// ═══════════════════════════════════════════════════════════
//  HOOPS OS — constants.js
//  Pure data: teams, commentary, tiers, names, difficulty.
//  No imports. No side effects.
// ═══════════════════════════════════════════════════════════

// ── Difficulty ────────────────────────────────────────────
export const DIFF_DESC = {
  easy:   'Recruits favor you. Opponents are weaker.',
  normal: 'Balanced challenge. CPU recruits aggressively.',
  hard:   'CPU is ruthless. Every win matters.',
  legend: 'Maximum difficulty. Good luck.'
};

export const DIFF_MOD = { easy: 5, normal: 0, hard: -6, legend: -12 };

// ── Recruiting Prestige Gates ────────────────────────────
// ── Positions & Classes ──────────────────────────────────
export const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
export const CLS = ['FR', 'SO', 'JR', 'SR'];

// ── Name Pools ───────────────────────────────────────────
export const FN = [
  "Jalen","Marcus","Tyler","Isaiah","Jordan","Caleb","DeShawn","Malik","Xavier","Jaylen",
  "Brandon","Chris","Andre","Devon","Darius","Trevon","Kendall","Aaron","Elijah","Nathan",
  "Trae","Paolo","Cade","Evan","Scoot","Miles","Bam","Franz","RJ","Walker",
  "Cam","Alperen","Keyonte","Colby","Brandin","Jarace","Terrence","LaQuan","Donta","Zaire",
  "Quentin","Derrick","Damian","Kyrie","Devin","DeMar","Klay","Draymond","Anthony","Donovan"
];

export const LN = [
  "Williams","Johnson","Smith","Brown","Jones","Davis","Wilson","Moore","Taylor","Anderson",
  "Thomas","Jackson","White","Harris","Martin","Thompson","Garcia","Martinez","Robinson","Clark",
  "Rodriguez","Lewis","Lee","Walker","Hall","Allen","Young","King","Wright","Scott",
  "Green","Baker","Adams","Nelson","Carter","Mitchell","Perez","Reed","Cook","Morgan",
  "Bell","Murphy","Cooper","Bailey","Rivera","Richardson","Cox","Howard","Ward"
];

// ── Tiers ────────────────────────────────────────────────
export const TIERS = [
  { min: 90, label: 'Elite',         col: '#fc8181', desc: 'National title expectations every year.' },
  { min: 85, label: 'High Major',    col: '#f6ad55', desc: 'Regular tournament program.' },
  { min: 78, label: 'Mid Major',     col: '#68d391', desc: 'Conference contender.' },
  { min: 70, label: 'Low Major',     col: '#63b3ed', desc: 'Every win is earned.' },
  { min: 0,  label: 'Small Program', col: '#b794f4', desc: 'Starting from scratch.' }
];

// ── D1 Teams (365 programs · real 2025-26 universe) ─────────
// NOTE: entry order is stable for save compatibility (tid = index).
// The `c` field is authoritative for conference membership.
export const ALL_TEAMS = [
  // ACC
  {n:"Duke",c:"ACC",o:94},{n:"North Carolina",c:"ACC",o:90},{n:"Virginia",c:"ACC",o:86},{n:"Syracuse",c:"ACC",o:80},
  {n:"Miami",c:"ACC",o:81},{n:"Florida State",c:"ACC",o:80},{n:"Louisville",c:"ACC",o:80},{n:"NC State",c:"ACC",o:80},
  {n:"Clemson",c:"ACC",o:81},{n:"Wake Forest",c:"ACC",o:78},{n:"Pitt",c:"ACC",o:76},{n:"Georgia Tech",c:"ACC",o:74},
  {n:"Notre Dame",c:"ACC",o:78},{n:"Boston College",c:"ACC",o:70},{n:"Virginia Tech",c:"ACC",o:80},{n:"SMU",c:"ACC",o:80},
  {n:"Stanford",c:"ACC",o:78},{n:"California",c:"ACC",o:71},
  // Big 12
  {n:"Kansas",c:"Big 12",o:92},{n:"Houston",c:"Big 12",o:92},{n:"Baylor",c:"Big 12",o:88},{n:"Arizona",c:"Big 12",o:91},
  {n:"Iowa State",c:"Big 12",o:87},{n:"BYU",c:"Big 12",o:83},{n:"Texas Tech",c:"Big 12",o:86},{n:"TCU",c:"Big 12",o:82},
  {n:"Utah",c:"Big 12",o:78},{n:"Colorado",c:"Big 12",o:78},{n:"Kansas State",c:"Big 12",o:82},{n:"Cincinnati",c:"Big 12",o:82},
  {n:"UCF",c:"Big 12",o:79},{n:"Oklahoma State",c:"Big 12",o:80},{n:"West Virginia",c:"Big 12",o:80},{n:"Arizona State",c:"Big 12",o:78},
  // Big Ten
  {n:"Purdue",c:"Big Ten",o:92},{n:"Illinois",c:"Big Ten",o:87},{n:"Wisconsin",c:"Big Ten",o:86},{n:"Ohio State",c:"Big Ten",o:86},
  {n:"Michigan State",c:"Big Ten",o:88},{n:"Michigan",c:"Big Ten",o:86},{n:"Indiana",c:"Big Ten",o:82},{n:"Maryland",c:"Big Ten",o:82},
  {n:"Iowa",c:"Big Ten",o:84},{n:"Northwestern",c:"Big Ten",o:80},{n:"Penn State",c:"Big Ten",o:80},{n:"Rutgers",c:"Big Ten",o:77},
  {n:"Nebraska",c:"Big Ten",o:78},{n:"Minnesota",c:"Big Ten",o:76},{n:"UCLA",c:"Big Ten",o:86},{n:"USC",c:"Big Ten",o:82},
  {n:"Oregon",c:"Big Ten",o:83},{n:"Washington",c:"Big Ten",o:76},
  // SEC
  {n:"Kentucky",c:"SEC",o:90},{n:"Tennessee",c:"SEC",o:91},{n:"Alabama",c:"SEC",o:90},{n:"Auburn",c:"SEC",o:89},
  {n:"Florida",c:"SEC",o:87},{n:"Texas A&M",c:"SEC",o:83},{n:"Arkansas",c:"SEC",o:84},{n:"Texas",c:"SEC",o:86},
  {n:"Oklahoma",c:"SEC",o:82},{n:"LSU",c:"SEC",o:81},{n:"Missouri",c:"SEC",o:79},{n:"Georgia",c:"SEC",o:78},
  {n:"Ole Miss",c:"SEC",o:80},{n:"Mississippi State",c:"SEC",o:80},{n:"Vanderbilt",c:"SEC",o:77},{n:"South Carolina",c:"SEC",o:76},
  // American
  {n:"Memphis",c:"American",o:82},{n:"Tulsa",c:"American",o:70},{n:"East Carolina",c:"American",o:67},
  {n:"South Florida",c:"American",o:68},{n:"Temple",c:"American",o:72},{n:"Wichita State",c:"American",o:78},{n:"UAB",c:"American",o:74},
  {n:"North Texas",c:"American",o:74},{n:"UTSA",c:"American",o:64},{n:"Rice",c:"American",o:66},{n:"Florida Atlantic",c:"American",o:72},
  // Mountain West
  {n:"San Diego State",c:"MW",o:84},{n:"Nevada",c:"MW",o:78},{n:"New Mexico",c:"MW",o:76},{n:"UNLV",c:"MW",o:74},
  {n:"Utah State",c:"MW",o:81},{n:"Boise State",c:"MW",o:78},{n:"Colorado State",c:"MW",o:76},{n:"Air Force",c:"MW",o:64},
  {n:"Wyoming",c:"MW",o:68},{n:"Fresno State",c:"MW",o:71},{n:"San Jose State",c:"MW",o:63},
  // WCC
  {n:"Gonzaga",c:"WCC",o:92},{n:"Saint Mary's",c:"WCC",o:84},{n:"San Francisco",c:"WCC",o:76},{n:"Pacific",c:"WCC",o:64},
  {n:"Pepperdine",c:"WCC",o:65},{n:"Santa Clara",c:"WCC",o:70},{n:"Portland",c:"WCC",o:62},{n:"Montana",c:"Big Sky",o:64},
  {n:"LMU",c:"WCC",o:66},{n:"San Diego",c:"WCC",o:64},
  // A-10
  {n:"Dayton",c:"A-10",o:82},{n:"VCU",c:"A-10",o:81},{n:"Davidson",c:"A-10",o:76},{n:"Saint Louis",c:"A-10",o:75},
  {n:"Rhode Island",c:"A-10",o:72},{n:"Richmond",c:"A-10",o:72},{n:"George Mason",c:"A-10",o:72},{n:"Fordham",c:"A-10",o:65},
  {n:"La Salle",c:"A-10",o:64},{n:"Duquesne",c:"A-10",o:70},{n:"Saint Joseph's",c:"A-10",o:70},{n:"Massachusetts",c:"MAC",o:68},
  {n:"St. Bonaventure",c:"A-10",o:72},{n:"George Washington",c:"A-10",o:68},
  // MVC
  {n:"Drake",c:"MVC",o:74},{n:"Loyola Chicago",c:"A-10",o:73},{n:"Bradley",c:"MVC",o:72},{n:"Illinois State",c:"MVC",o:68},
  {n:"Indiana State",c:"MVC",o:70},{n:"Missouri State",c:"CUSA",o:70},{n:"Southern Illinois",c:"MVC",o:68},{n:"Evansville",c:"MVC",o:62},
  {n:"UNI",c:"MVC",o:72},{n:"Belmont",c:"MVC",o:74},
  // C-USA
  {n:"Liberty",c:"CUSA",o:74},{n:"Jacksonville State",c:"CUSA",o:68},{n:"New Mexico State",c:"CUSA",o:71},{n:"Sam Houston",c:"CUSA",o:69},
  {n:"Western Kentucky",c:"CUSA",o:72},{n:"UTEP",c:"CUSA",o:66},{n:"Louisiana Tech",c:"CUSA",o:71},{n:"Middle Tennessee",c:"CUSA",o:70},
  {n:"FIU",c:"CUSA",o:62},{n:"Charlotte",c:"American",o:66},{n:"Old Dominion",c:"Sun Belt",o:66},{n:"Southern Miss",c:"Sun Belt",o:62},
  // Sun Belt
  {n:"Troy",c:"Sun Belt",o:68},{n:"Georgia Southern",c:"Sun Belt",o:66},{n:"Louisiana",c:"Sun Belt",o:68},{n:"App State",c:"Sun Belt",o:66},
  {n:"South Alabama",c:"Sun Belt",o:66},{n:"Arkansas State",c:"Sun Belt",o:65},{n:"Texas State",c:"Sun Belt",o:66},{n:"ULM",c:"Sun Belt",o:60},
  {n:"Georgia State",c:"Sun Belt",o:66},{n:"Marshall",c:"Sun Belt",o:70},{n:"Coastal Carolina",c:"Sun Belt",o:64},{n:"James Madison",c:"Sun Belt",o:68},
  // WAC
  {n:"Utah Valley",c:"WAC",o:72},{n:"Grand Canyon",c:"MW",o:75},{n:"Cal Baptist",c:"WAC",o:68},{n:"Abilene Christian",c:"WAC",o:66},
  {n:"Tarleton State",c:"WAC",o:64},{n:"Southern Utah",c:"WAC",o:62},{n:"Seattle U",c:"WCC",o:65},
  {n:"Chicago State",c:"NEC",o:55},{n:"Lamar",c:"Southland",o:60},
  // Big East
  {n:"UConn",c:"Big East",o:90},{n:"Marquette",c:"Big East",o:86},{n:"Creighton",c:"Big East",o:86},{n:"Providence",c:"Big East",o:81},
  {n:"Villanova",c:"Big East",o:86},{n:"Xavier",c:"Big East",o:82},{n:"Seton Hall",c:"Big East",o:80},{n:"Georgetown",c:"Big East",o:72},
  {n:"DePaul",c:"Big East",o:69},{n:"Butler",c:"Big East",o:76},{n:"St. John's",c:"Big East",o:82},
  // MAC
  {n:"Toledo",c:"MAC",o:72},{n:"Akron",c:"MAC",o:72},{n:"Ball State",c:"MAC",o:65},{n:"Ohio",c:"MAC",o:69},
  {n:"Miami (OH)",c:"MAC",o:65},{n:"Buffalo",c:"MAC",o:68},{n:"Kent State",c:"MAC",o:69},{n:"Western Michigan",c:"MAC",o:62},
  {n:"Eastern Michigan",c:"MAC",o:62},{n:"Bowling Green",c:"MAC",o:62},{n:"Northern Illinois",c:"MAC",o:61},{n:"Central Michigan",c:"MAC",o:60},
  // Horizon
  {n:"Cleveland State",c:"Horizon",o:66},{n:"Wright State",c:"Horizon",o:70},{n:"Detroit Mercy",c:"Horizon",o:63},{n:"Oakland",c:"Horizon",o:68},
  {n:"Youngstown State",c:"Horizon",o:63},{n:"Milwaukee",c:"Horizon",o:62},{n:"IU Indianapolis",c:"Horizon",o:58},{n:"Green Bay",c:"Horizon",o:61},
  {n:"Northern Kentucky",c:"Horizon",o:67},{n:"Purdue Fort Wayne",c:"Horizon",o:64},
  // MAAC
  {n:"Iona",c:"MAAC",o:72},{n:"Rider",c:"MAAC",o:63},{n:"Manhattan",c:"MAAC",o:61},{n:"Niagara",c:"MAAC",o:61},
  {n:"Quinnipiac",c:"MAAC",o:64},{n:"Fairfield",c:"MAAC",o:62},{n:"Canisius",c:"MAAC",o:60},{n:"Marist",c:"MAAC",o:60},
  {n:"Siena",c:"MAAC",o:64},{n:"Saint Peter's",c:"MAAC",o:65},
  // Southland
  {n:"Stephen F. Austin",c:"Southland",o:68},{n:"SE Louisiana",c:"Southland",o:60},{n:"McNeese",c:"Southland",o:64},
  {n:"Nicholls",c:"Southland",o:61},{n:"Houston Christian",c:"Southland",o:56},{n:"Incarnate Word",c:"Southland",o:56},
  {n:"Northwestern State",c:"Southland",o:60},{n:"New Orleans",c:"Southland",o:58},
  // Big South
  {n:"UNC Asheville",c:"Big South",o:65},{n:"High Point",c:"Big South",o:64},{n:"Longwood",c:"Big South",o:62},
  {n:"Charleston Southern",c:"Big South",o:58},{n:"Presbyterian",c:"Big South",o:57},{n:"Campbell",c:"CAA",o:62},
  {n:"Winthrop",c:"Big South",o:68},{n:"Gardner-Webb",c:"Big South",o:60},{n:"USC Upstate",c:"Big South",o:57},
  // Colonial (CAA)
  {n:"Towson",c:"CAA",o:70},{n:"Hofstra",c:"CAA",o:70},{n:"Drexel",c:"CAA",o:64},{n:"UNC Wilmington",c:"CAA",o:68},
  {n:"Delaware",c:"CUSA",o:64},{n:"Elon",c:"CAA",o:60},{n:"William & Mary",c:"CAA",o:62},
  {n:"Charleston",c:"CAA",o:72},{n:"Stony Brook",c:"CAA",o:62},{n:"Hampton",c:"CAA",o:58},
  // OVC
  {n:"Tennessee Tech",c:"OVC",o:60},{n:"Little Rock",c:"OVC",o:60},{n:"Tennessee State",c:"OVC",o:60},
  {n:"Morehead State",c:"OVC",o:62},{n:"SIUE",c:"OVC",o:59},{n:"UT Martin",c:"OVC",o:58},
  // Patriot
  {n:"Colgate",c:"Patriot",o:68},{n:"Lehigh",c:"Patriot",o:62},{n:"American",c:"Patriot",o:62},{n:"Navy",c:"Patriot",o:62},
  {n:"Army",c:"Patriot",o:60},{n:"Holy Cross",c:"Patriot",o:60},{n:"Bucknell",c:"Patriot",o:64},{n:"Lafayette",c:"Patriot",o:59},
  {n:"Boston University",c:"Patriot",o:63},
  // Summit
  {n:"South Dakota State",c:"Summit",o:72},{n:"South Dakota",c:"Summit",o:66},{n:"North Dakota State",c:"Summit",o:67},
  {n:"North Dakota",c:"Summit",o:61},{n:"Denver",c:"Summit",o:62},{n:"Oral Roberts",c:"Summit",o:66},{n:"Omaha",c:"Summit",o:60},
  {n:"Western Illinois",c:"OVC",o:58},{n:"Kansas City",c:"Summit",o:60},
  // SWAC
  {n:"Grambling",c:"SWAC",o:60},{n:"Southern",c:"SWAC",o:62},{n:"Prairie View A&M",c:"SWAC",o:60},{n:"Texas Southern",c:"SWAC",o:62},
  {n:"Jackson State",c:"SWAC",o:60},{n:"Alabama A&M",c:"SWAC",o:56},{n:"Alabama State",c:"SWAC",o:58},{n:"Bethune-Cookman",c:"SWAC",o:58},
  {n:"Florida A&M",c:"SWAC",o:58},{n:"Alcorn State",c:"SWAC",o:57},
  // MEAC
  {n:"Howard",c:"MEAC",o:60},{n:"Morgan State",c:"MEAC",o:58},{n:"Delaware State",c:"MEAC",o:54},{n:"Coppin State",c:"MEAC",o:54},
  {n:"NC A&T",c:"CAA",o:58},{n:"Norfolk State",c:"MEAC",o:64},{n:"SC State",c:"MEAC",o:56},{n:"Maryland Eastern Shore",c:"MEAC",o:53},
  // America East
  {n:"Vermont",c:"America East",o:72},{n:"UMBC",c:"America East",o:63},{n:"UAlbany",c:"America East",o:60},{n:"UMass Lowell",c:"America East",o:60},
  {n:"Binghamton",c:"America East",o:56},{n:"Maine",c:"America East",o:56},{n:"New Hampshire",c:"America East",o:58},
  // Northeast (NEC)
  {n:"Merrimack",c:"MAAC",o:61},{n:"Sacred Heart",c:"MAAC",o:60},{n:"LIU",c:"NEC",o:58},{n:"Wagner",c:"NEC",o:58},
  {n:"FDU",c:"NEC",o:58},{n:"Saint Francis",c:"NEC",o:56},{n:"New Haven",c:"NEC",o:54},{n:"Bryant",c:"America East",o:60},
  {n:"CCSU",c:"NEC",o:55},
  // SoCon
  {n:"Furman",c:"SoCon",o:70},{n:"Chattanooga",c:"SoCon",o:68},{n:"Mercer",c:"SoCon",o:66},{n:"ETSU",c:"SoCon",o:68},
  {n:"Western Carolina",c:"SoCon",o:61},{n:"VMI",c:"SoCon",o:56},{n:"The Citadel",c:"SoCon",o:56},{n:"UNC Greensboro",c:"SoCon",o:68},
  {n:"Samford",c:"SoCon",o:66},{n:"Wofford",c:"SoCon",o:66},
  // Ivy
  {n:"Yale",c:"Ivy",o:76},{n:"Princeton",c:"Ivy",o:73},{n:"Penn",c:"Ivy",o:66},{n:"Harvard",c:"Ivy",o:66},
  {n:"Columbia",c:"Ivy",o:61},{n:"Cornell",c:"Ivy",o:64},{n:"Dartmouth",c:"Ivy",o:60},{n:"Brown",c:"Ivy",o:62},
  // Big West
  {n:"UC Irvine",c:"Big West",o:74},{n:"UCSB",c:"Big West",o:70},{n:"Long Beach State",c:"Big West",o:66},{n:"UC San Diego",c:"Big West",o:68},
  {n:"Cal Poly",c:"Big West",o:60},{n:"Hawaii",c:"Big West",o:66},{n:"UC Davis",c:"Big West",o:64},{n:"UC Riverside",c:"Big West",o:62},
  {n:"Cal State Fullerton",c:"Big West",o:61},{n:"CSU Bakersfield",c:"Big West",o:59},{n:"Cal State Northridge",c:"Big West",o:58},
  // ASUN
  {n:"Kennesaw State",c:"CUSA",o:62},{n:"Jacksonville",c:"ASUN",o:62},{n:"Lipscomb",c:"ASUN",o:66},{n:"North Florida",c:"ASUN",o:60},
  {n:"Queens",c:"ASUN",o:62},{n:"Eastern Kentucky",c:"ASUN",o:63},{n:"Florida Gulf Coast",c:"ASUN",o:66},{n:"Bellarmine",c:"ASUN",o:60},
  {n:"Austin Peay",c:"ASUN",o:62},{n:"Central Arkansas",c:"ASUN",o:60},
  // ── 2025-26 expansion: full 365-team D1 universe (order stable for save compat) ──
  {n:"NJIT",c:"America East",o:56},
  {n:"Tulane",c:"American",o:69},
  {n:"North Alabama",c:"ASUN",o:60},
  {n:"Stetson",c:"ASUN",o:60},
  {n:"West Georgia",c:"ASUN",o:54},
  {n:"Eastern Washington",c:"Big Sky",o:63},
  {n:"Idaho",c:"Big Sky",o:58},
  {n:"Idaho State",c:"Big Sky",o:58},
  {n:"Montana State",c:"Big Sky",o:63},
  {n:"Northern Arizona",c:"Big Sky",o:58},
  {n:"Northern Colorado",c:"Big Sky",o:62},
  {n:"Portland State",c:"Big Sky",o:60},
  {n:"Weber State",c:"Big Sky",o:64},
  {n:"Radford",c:"Big South",o:62},
  {n:"Sacramento State",c:"Big Sky",o:60},
  {n:"Monmouth",c:"CAA",o:64},
  {n:"Northeastern",c:"CAA",o:63},
  {n:"Robert Morris",c:"Horizon",o:62},
  {n:"Mount St. Mary's",c:"MAAC",o:60},
  {n:"NC Central",c:"MEAC",o:60},
  {n:"Murray State",c:"MVC",o:70},
  {n:"UIC",c:"MVC",o:62},
  {n:"Valparaiso",c:"MVC",o:64},
  {n:"Le Moyne",c:"NEC",o:56},
  {n:"Mercyhurst",c:"NEC",o:55},
  {n:"Stonehill",c:"NEC",o:54},
  {n:"Eastern Illinois",c:"OVC",o:56},
  {n:"Lindenwood",c:"OVC",o:55},
  {n:"Southeast Missouri",c:"OVC",o:60},
  {n:"Southern Indiana",c:"OVC",o:56},
  {n:"Oregon State",c:"Pac-12",o:71},
  {n:"Washington State",c:"Pac-12",o:72},
  {n:"Loyola Maryland",c:"Patriot",o:58},
  {n:"East Texas A&M",c:"Southland",o:58},
  {n:"Texas A&M-CC",c:"Southland",o:62},
  {n:"UTRGV",c:"Southland",o:60},
  {n:"UAPB",c:"SWAC",o:54},
  {n:"MVSU",c:"SWAC",o:52},
  {n:"St. Thomas",c:"Summit",o:62},
  {n:"UT Arlington",c:"WAC",o:65},
  {n:"Utah Tech",c:"WAC",o:60}
];

// ── Commentary Banks ─────────────────────────────────────
export const COM = {
  make3: [
    function(a,d){return a+" hits the three over "+d+".";},
    function(a,d){return a+" from downtown for three.";},
    function(a,d){return "Step-back three by "+a+". Nothing but net.";},
    function(a,d){return a+" fires and makes it from the arc.";},
    function(a,d){return "Cold-blooded. "+a+" scores from 25 feet.";},
    function(a,d){return a+" catches, rises, and makes the three.";},
    function(a,d){return "Hand in his face? Doesn't matter. "+a+" is locked in.";},
    function(a,d){return a+" creates space and hits the step-back three.";},
    function(a,d){return "He's heating up. "+a+" knocks down another three.";},
    function(a,d){return "Ice in his veins. "+a+" hits a cold-blooded three.";},
    function(a,d){return a+" stop and pop. The mid-range game is alive and well.";},
  ],
  make2: [
    function(a,d){return a+" attacks the paint and finishes.";},
    function(a,d){return a+" with the pull-up mid-range — good.";},
    function(a,d){return "Beautiful move by "+a+", off the glass.";},
    function(a,d){return a+" powers through "+d+" for the bucket.";},
    function(a,d){return a+" floats it up — and it falls.";},
    function(a,d){return "Tough finish by "+a+" in traffic.";},
    function(a,d){return a+" rising up... Got it. Nothing but the bottom of the net.";},
    function(a,d){return a+" with the smooth jumper. Pure as silk.";},
    function(a,d){return "Textbook form from "+a+". Finding a rhythm now.";},
    function(a,d){return a+" finds a gap in the zone and punishes them. Count it.";},
    function(a,d){return "The defense gave him an inch, and "+a+" took a mile. Swish.";},
    function(a,d){return "The bank is open. "+a+" calls glass on that one.";},
    function(a,d){return a+" just silencing the road crowd with that bucket.";},
    function(a,d){return "He's a flamethrower. "+a+" adds another two to the tally.";},
    function(a,d){return a+" catches, squares up, and delivers. Clinical.";},
    function(a,d){return "That's a professional-grade bucket from "+a+".";},
    function(a,d){return "High off the glass and in. "+a+" showing off the soft touch.";},
  ],
  dunk: [
    function(a,d){return a+" with the dunk over "+d+".";},
    function(a,d){return "Slam by "+a+". Nobody was stopping that.";},
    function(a,d){return a+" jams it with authority.";},
    function(a,d){return a+" hammers it home over "+d+".";},
    function(a,d){return a+" throws it down and rocks the rim.";},
    function(a,d){return a+" posterizes "+d+" on the dunk.";},
    function(a,d){return "Look out below. "+a+" with the thunderous dunk.";},
    function(a,d){return "A rim-rattling finish for "+a+". The backboard is still shaking.";},
    function(a,d){return a+" goes up with bad intentions. Unbelievable finish.";},
    function(a,d){return "The lob... and the jam for "+a+".";},
    function(a,d){return a+" just took flight. That's a momentum shifter.";},
    function(a,d){return "One-handed hammer. "+a+" is putting on a show.";},
    function(a,d){return "Put him on a poster. "+a+" beats the interior defense.";},
    function(a,d){return "The bench is on its feet. "+a+" with the powerhouse dunk.";},
    function(a,d){return a+" rises above the trees and slams it home.";},
    function(a,d){return "The rim might need a mechanic after that "+a+" flush.";},
    function(a,d){return "He nearly tore the goal down. "+a+" with a monster slam.";},
  ],
  miss2: [
    function(a,d){return a+" misses the mid-range. Comes up short.";},
    function(a,d){return "Off the back rim for "+a+".";},
    function(a,d){return a+" drives, contact — rolls off.";},
    function(a,d){return "No good for "+a+" from inside.";},
    function(a,d){return "Strong move by "+a+", but the finishing touch isn't there.";},
    function(a,d){return "In and out. Heartbreak for "+a+" on that attempt.";},
    function(a,d){return "Clank. "+a+" leaves that one a little short.";},
    function(a,d){return "The defense rattled him. "+a+" misses the mark.";},
    function(a,d){return a+" with the turnaround... back iron. Rebound is loose.";},
    function(a,d){return "Heavy legs for "+a+"? That shot didn't have a chance.";},
    function(a,d){return "Ugly possession ends in a "+a+" brick.";},
  ],
  miss3: [
    function(a,d){return a+" fires from three — no good.";},
    function(a,d){return "Long ball by "+a+" rattles out.";},
    function(a,d){return a+" heaves it — off the backboard.";},
    function(a,d){return "Deep miss for "+a+" from downtown.";},
    function(a,d){return a+" forces it up against double coverage. No dice.";},
    function(a,d){return "Desperation heave from "+a+"... and it's way off target.";},
    function(a,d){return "Airball. "+a+" completely misjudged the distance on that one.";},
    function(a,d){return "Off the side of the rim. "+a+" is struggling to find the range.";},
    function(a,d){return "That shot had 'no' written all over it. Poor look from "+a+".";},
  ],
  block: [
    function(a,d){return "Blocked by "+d+". Sends "+a+"'s shot into the seats.";},
    function(a,d){return d+" rises and swats it. Huge rejection.";},
    function(a,d){return "Denied at the rim. "+d+" with the block.";},
    function(a,d){return d+" times it perfectly for the block.";},
    function(a,d){return "Not in his house. "+d+" sends it into the third row.";},
    function(a,d){return "Rejected by "+d+". A strong defensive stand.";},
    function(a,d){return d+" says no. What a phenomenal recovery on the play.";},
    function(a,d){return "Get that weak stuff out of here. "+d+" with the swat.";},
    function(a,d){return d+" timing that perfectly. Clean block.";},
    function(a,d){return "He read him like a book. "+d+" erases the shot.";},
    function(a,d){return "Blocked. "+d+" is a one-man wrecking crew on defense.";},
    function(a,d){return d+" puts that one in the seats. The energy just flipped.";},
    function(a,d){return "Big block. "+d+" swats it right back at "+a+".";},
    function(a,d){return "Swatted. "+d+" is making life miserable for the offense.";},
    function(a,d){return "The finger wag from "+d+". He's dominating the paint.";},
  ],
  steal: [
    function(a,d){return "Stolen by "+d+". "+a+" coughs it up.";},
    function(a,d){return d+" reads the passing lane — picks it off.";},
    function(a,d){return "Pickpocket by "+d+". Clean strip on "+a+".";},
    function(a,d){return d+" picks his pocket. Pure thievery on the perimeter.";},
    function(a,d){return "Ripped away by "+d+". He's got a head of steam now.";},
    function(a,d){return d+" read the pass perfectly. Going the other way.";},
    function(a,d){return d+" with the quick hands. Off on the break.";},
    function(a,d){return "Telepathic defense. "+d+" jumps the lane for the steal.";},
    function(a,d){return "Cookie jar. "+d+" catches "+a+" napping with the ball.";},
    function(a,d){return d+" takes it away. A nightmare sequence for the offense.";},
    function(a,d){return "Great anticipation by "+d+". He's a ball hawk tonight.";},
    function(a,d){return "Grand theft basketball. "+d+" is a menace.";},
    function(a,d){return d+" with the heist. He's reading their plays before they make them.";},
  ],
  turn: [
    function(a,d){return a+" turns it over. "+d+" takes possession.";},
    function(a,d){return "Bad pass by "+a+" — out of bounds.";},
    function(a,d){return a+" dribbles off his foot. Turnover.";},
    function(a,d){return "Telegraphed entry pass by "+a+". Stolen.";},
    function(a,d){return a+" tried to do too much there. That's a low-percentage play.";},
    function(a,d){return "Sloppy handle from "+a+". "+d+" will take possession.";},
    function(a,d){return a+" loses it in traffic. Costly mistake.";},
  ],
  putback: [
    function(a){return a+" with the offensive board — putback.";},
    function(a){return "Second chance. "+a+" tips it in.";},
    function(a){return a+" grabs the miss and converts.";},
    function(a){return "Second chance points. "+a+" refuses to let that possession die.";},
  ],
  clutch: [
    function(a){return "Clutch. "+a+" delivers when it matters.";},
    function(a){return a+" won't back down. Huge shot.";},
    function(a){return "Ice in his veins — "+a+" hits the big one.";},
    function(a){return "That's a clutch bucket from "+a+". He lives for these moments.";},
    function(a){return a+" is ice cold under pressure. Unbelievable composure.";},
    function(a){return "The moment is not too big for "+a+". Money.";},
  ]
};

// ═══════════════════════════════════════════════════════════
//  GEOGRAPHY — Team States, Regions, Recruit Talent Pools
// ═══════════════════════════════════════════════════════════

// ── 6 Recruiting Regions ─────────────────────────────────
export const REGIONS = {
  'Northeast':    ['CT','MA','ME','NH','NJ','NY','PA','RI','VT'],
  'Southeast':    ['AL','FL','GA','KY','MS','NC','SC','TN','VA','WV'],
  'Midwest':      ['IA','IL','IN','KS','MI','MN','MO','ND','NE','OH','SD','WI'],
  'South':        ['AR','LA','OK','TX'],
  'West':         ['AK','AZ','CA','CO','HI','ID','MT','NM','NV','OR','UT','WA','WY'],
  'Mid-Atlantic': ['DC','DE','MD']
};

// ── Reverse lookup: state → region ───────────────────────
export const STATE_TO_REGION = {};
(function() {
  Object.keys(REGIONS).forEach(function(reg) {
    REGIONS[reg].forEach(function(st) { STATE_TO_REGION[st] = reg; });
  });
})();

// ── Team → State mapping (by team name) ──────────────────
// ── 2026-27 realignment ─────────────────────────────────────
// ALL_TEAMS is the 2025-26 alignment and stays the index table (tid = index).
// A save remembers its alignment (G.align): saves from before this change
// keep 2025-26; new dynasties use 2026-27. teamsFor(align) gives the table
// for an alignment without reordering anything.
export var CURRENT_ALIGN = 2026;
var MOVES_2026 = {
  // Pac-12 rebuilt (9)
  'Boise State': 'Pac-12', 'Colorado State': 'Pac-12', 'Fresno State': 'Pac-12', 'San Diego State': 'Pac-12', 'Utah State': 'Pac-12',
  'Gonzaga': 'Pac-12', 'Texas State': 'Pac-12',
  // Mountain West (10)
  'Hawaii': 'MW', 'UC Davis': 'MW', 'UTEP': 'MW',
  // WCC (10)
  'Denver': 'WCC',
  // Big West (12)
  'Cal Baptist': 'Big West', 'Utah Valley': 'Big West', 'Sacramento State': 'Big West',
  // United Athletic Conference (the WAC renamed, 9)
  'Austin Peay': 'UAC', 'Central Arkansas': 'UAC', 'Eastern Kentucky': 'UAC', 'North Alabama': 'UAC', 'West Georgia': 'UAC',
  'Little Rock': 'UAC',
  // Big Sky (11)
  'Southern Utah': 'Big Sky', 'Utah Tech': 'Big Sky',
  // SoCon (11)
  'Tennessee Tech': 'SoCon',
  // Sun Belt (14)
  'Louisiana Tech': 'Sun Belt',
  // Horizon (12)
  'Northern Illinois': 'Horizon'
};
var RENAMES_2026 = { 'WAC': 'UAC', 'MAAC': 'Metro' };
// St Francis PA leaves D1; West Florida (new to D1, ASUN) takes over its slot
var SLOTS_2026 = { 'Saint Francis': { n: 'West Florida', c: 'ASUN', o: 52 } };
// Schools still reclassifying in 2026-27 can't take an NCAA bid (Le Moyne is
// eligible). The game uses 2026-27 status throughout: no reclassification yet.
export var INELIGIBLE_2026 = ['Mercyhurst', 'West Georgia', 'New Haven', 'West Florida'];

export function teamsFor(align) {
  return ALL_TEAMS.map(function(td) {
    var t = { n: td.n, c: td.c, o: td.o };
    if (align >= 2026) {
      if (SLOTS_2026[td.n]) { var r = SLOTS_2026[td.n]; t = { n: r.n, c: r.c, o: r.o }; }
      else {
        if (RENAMES_2026[t.c]) t.c = RENAMES_2026[t.c];
        if (MOVES_2026[t.n]) t.c = MOVES_2026[t.n];
      }
      if (INELIGIBLE_2026.indexOf(t.n) >= 0) t.x = 1;
    }
    return t;
  });
}

export const TEAM_STATES = {
  // ACC
  "Duke":"NC","North Carolina":"NC","Virginia":"VA","Syracuse":"NY","Miami":"FL","Florida State":"FL",
  "Louisville":"KY","NC State":"NC","Clemson":"SC","Wake Forest":"NC","Pitt":"PA",
  "Georgia Tech":"GA","Notre Dame":"IN","Boston College":"MA","Virginia Tech":"VA",
  "Stanford":"CA","California":"CA",
  // Big 12
  "Kansas":"KS","Houston":"TX","Baylor":"TX","Arizona":"AZ","Iowa State":"IA","BYU":"UT",
  "Texas Tech":"TX","TCU":"TX","Utah":"UT","Colorado":"CO","Kansas State":"KS","Cincinnati":"OH",
  "UCF":"FL","Oklahoma State":"OK","West Virginia":"WV","Arizona State":"AZ",
  // Big Ten
  "Purdue":"IN","Illinois":"IL","Wisconsin":"WI","Ohio State":"OH","Michigan State":"MI",
  "Michigan":"MI","Indiana":"IN","Maryland":"MD","Iowa":"IA","Northwestern":"IL",
  "Penn State":"PA","Rutgers":"NJ","Nebraska":"NE","Minnesota":"MN","UCLA":"CA","USC":"CA",
  "Oregon":"OR","Washington":"WA",
  // SEC
  "Kentucky":"KY","Tennessee":"TN","Alabama":"AL","Auburn":"AL","Florida":"FL",
  "Texas A&M":"TX","Arkansas":"AR","Texas":"TX","Oklahoma":"OK","LSU":"LA","Missouri":"MO",
  "Georgia":"GA","Ole Miss":"MS","Mississippi State":"MS","Vanderbilt":"TN","South Carolina":"SC",
  // American
  "Memphis":"TN","Tulsa":"OK","SMU":"TX","East Carolina":"NC","South Florida":"FL",
  "Temple":"PA","Wichita State":"KS","UAB":"AL","North Texas":"TX","UTSA":"TX","Rice":"TX",
  "Florida Atlantic":"FL",
  // MW
  "San Diego State":"CA","Nevada":"NV","New Mexico":"NM","UNLV":"NV","Utah State":"UT",
  "Boise State":"ID","Colorado State":"CO","Air Force":"CO","Wyoming":"WY","Fresno State":"CA",
  "San Jose State":"CA","Hawaii":"HI",
  // WCC
  "Gonzaga":"WA","Saint Mary's":"CA","San Francisco":"CA","Pacific":"CA","Pepperdine":"CA",
  "Santa Clara":"CA","Portland":"OR","LMU":"CA","San Diego":"CA",
  // A-10
  "Dayton":"OH","VCU":"VA","Davidson":"NC","Saint Louis":"MO","Rhode Island":"RI",
  "Richmond":"VA","George Mason":"VA","Fordham":"NY","La Salle":"PA","Duquesne":"PA",
  "Massachusetts":"MA","St. Bonaventure":"NY","George Washington":"DC",
  // MVC
  "Drake":"IA","Loyola Chicago":"IL","Bradley":"IL","Illinois State":"IL","Indiana State":"IN",
  "Missouri State":"MO","Southern Illinois":"IL","Evansville":"IN","UNI":"IA","Belmont":"TN",
  // CUSA
  "Liberty":"VA","Jacksonville State":"AL","New Mexico State":"NM","Sam Houston":"TX",
  "Western Kentucky":"KY","UTEP":"TX","Louisiana Tech":"LA","Middle Tennessee":"TN","FIU":"FL",
  "Charlotte":"NC","Old Dominion":"VA","Southern Miss":"MS",
  // Sun Belt
  "Troy":"AL","Georgia Southern":"GA","Louisiana":"LA","App State":"NC","South Alabama":"AL",
  "Arkansas State":"AR","Texas State":"TX","ULM":"LA","Georgia State":"GA","Marshall":"WV",
  "James Madison":"VA",
  // WAC
  "Utah Valley":"UT","Grand Canyon":"AZ","Cal Baptist":"CA","Abilene Christian":"TX",
  "Tarleton State":"TX","Southern Utah":"UT","Seattle U":"WA","Chicago State":"IL",
  "Lamar":"TX",
  // Big East
  "UConn":"CT","Marquette":"WI","Creighton":"NE","Providence":"RI","Villanova":"PA",
  "Xavier":"OH","Seton Hall":"NJ","Georgetown":"DC","DePaul":"IL","Butler":"IN",
  "St. John's":"NY",
  // MAC
  "Toledo":"OH","Akron":"OH","Ball State":"IN","Ohio":"OH","Miami (OH)":"OH","Buffalo":"NY",
  "Kent State":"OH","Western Michigan":"MI","Eastern Michigan":"MI","Bowling Green":"OH",
  "Northern Illinois":"IL","Central Michigan":"MI",
  // Horizon
  "Cleveland State":"OH","Wright State":"OH","Detroit Mercy":"MI","Oakland":"MI",
  "Youngstown State":"OH","Milwaukee":"WI","Green Bay":"WI","Northern Kentucky":"KY",
  "Purdue Fort Wayne":"IN",
  // MAAC
  "Iona":"NY","Rider":"NJ","Manhattan":"NY","Niagara":"NY","Quinnipiac":"CT",
  "Fairfield":"CT","Canisius":"NY","Marist":"NY","Siena":"NY","Saint Peter's":"NJ",
  // Southland
  "Stephen F. Austin":"TX","SE Louisiana":"LA","McNeese":"LA","Nicholls":"LA",
  "Incarnate Word":"TX","Northwestern State":"LA","New Orleans":"LA",
  // Big South
  "UNC Asheville":"NC","High Point":"NC","Longwood":"VA","Charleston Southern":"SC",
  "Presbyterian":"SC","Campbell":"NC","Winthrop":"SC","Gardner-Webb":"NC","USC Upstate":"SC",
  // CAA
  "Towson":"MD","Hofstra":"NY","Drexel":"PA","UNC Wilmington":"NC","Delaware":"DE","Elon":"NC",
  "William & Mary":"VA","Charleston":"SC","Stony Brook":"NY","Hampton":"VA",
  // OVC
  "Bellarmine":"KY","Tennessee Tech":"TN",
  "Morehead State":"KY","Austin Peay":"TN","SIUE":"IL","UT Martin":"TN",
  // Patriot
  "Colgate":"NY","Lehigh":"PA","American":"DC","Navy":"MD","Army":"NY","Holy Cross":"MA",
  "Bucknell":"PA","Lafayette":"PA","Boston University":"MA",
  // Summit
  "South Dakota State":"SD","South Dakota":"SD","North Dakota State":"ND","North Dakota":"ND",
  "Denver":"CO","Oral Roberts":"OK","Western Illinois":"IL","Kansas City":"MO",
  // SWAC
  "Grambling":"LA","Southern":"LA","Prairie View A&M":"TX","Texas Southern":"TX",
  "Jackson State":"MS","Alabama A&M":"AL","Alabama State":"AL","Bethune-Cookman":"FL",
  "Florida A&M":"FL","Alcorn State":"MS",
  // MEAC
  "Howard":"DC","Morgan State":"MD","Delaware State":"DE","Coppin State":"MD","NC A&T":"NC",
  "Norfolk State":"VA","SC State":"SC","Maryland Eastern Shore":"MD",
  // America East
  "Vermont":"VT","UMBC":"MD","UAlbany":"NY","Binghamton":"NY","Maine":"ME",
  "New Hampshire":"NH",
  // NEC
  "Merrimack":"MA","Sacred Heart":"CT","LIU":"NY","Wagner":"NY","FDU":"NJ",
  "Saint Francis":"PA","Bryant":"RI","CCSU":"CT","Mercer":"GA",
  // SoCon
  "Furman":"SC","Chattanooga":"TN","ETSU":"TN","Western Carolina":"NC","VMI":"VA",
  "The Citadel":"SC","UNC Greensboro":"NC","Samford":"AL","Wofford":"SC",
  // Ivy
  "Yale":"CT","Princeton":"NJ","Penn":"PA","Harvard":"MA","Columbia":"NY","Cornell":"NY",
  "Dartmouth":"NH","Brown":"RI",
  // Big West
  "UC Irvine":"CA","UCSB":"CA","Long Beach State":"CA","UC San Diego":"CA","Cal Poly":"CA",
  "UC Davis":"CA","UC Riverside":"CA","Cal State Fullerton":"CA","CSU Bakersfield":"CA",
  "Cal State Northridge":"CA",
  // ASUN
  "Kennesaw State":"GA","Jacksonville":"FL","Lipscomb":"TN","North Florida":"FL","Queens":"NC",
  "Eastern Kentucky":"KY","Florida Gulf Coast":"FL","Central Arkansas":"AR",
  // ── 2025-26 expansion ──
  "Montana":"MT",
  "Saint Joseph's":"PA",
  "Coastal Carolina":"SC",
  "Omaha":"NE",
  "New Haven":"CT",
  "Little Rock":"AR",
  "Tennessee State":"TN",
  "UMass Lowell":"MA",
  "Houston Christian":"TX",
  "IU Indianapolis":"IN",
  "NJIT":"NJ",
  "Tulane":"LA",
  "North Alabama":"AL",
  "Stetson":"FL",
  "West Georgia":"GA",
  "West Florida":"FL",
  "Eastern Washington":"WA",
  "Idaho":"ID",
  "Idaho State":"ID",
  "Montana State":"MT",
  "Northern Arizona":"AZ",
  "Northern Colorado":"CO",
  "Portland State":"OR",
  "Weber State":"UT",
  "Radford":"VA",
  "Sacramento State":"CA",
  "Monmouth":"NJ",
  "Northeastern":"MA",
  "Robert Morris":"PA",
  "Mount St. Mary's":"MD",
  "NC Central":"NC",
  "Murray State":"KY",
  "UIC":"IL",
  "Valparaiso":"IN",
  "Le Moyne":"NY",
  "Mercyhurst":"PA",
  "Stonehill":"MA",
  "Eastern Illinois":"IL",
  "Lindenwood":"MO",
  "Southeast Missouri":"MO",
  "Southern Indiana":"IN",
  "Oregon State":"OR",
  "Washington State":"WA",
  "Loyola Maryland":"MD",
  "East Texas A&M":"TX",
  "Texas A&M-CC":"TX",
  "UTRGV":"TX",
  "UAPB":"AR",
  "MVSU":"MS",
  "St. Thomas":"MN",
  "UT Arlington":"TX",
  "Utah Tech":"UT",
};

// ── Recruit Home State Weighted Pool ─────────────────────
// Each state appears N times based on basketball talent output.
// Total pool entries determine probability of a recruit being from that state.
export const RECRUIT_STATE_POOL = (function() {
  var weights = {
    // Tier 1 — Basketball factories (weight 10)
    CA:10,TX:10,FL:10,NY:10,IL:10,GA:10,NC:10,OH:10,
    // Tier 2 — Strong talent (weight 6)
    IN:6,MI:6,PA:6,VA:6,NJ:6,TN:6,MD:6,LA:6,AL:6,SC:6,
    // Tier 3 — Moderate (weight 3)
    KY:3,MO:3,CT:3,MA:3,WI:3,MN:3,MS:3,AR:3,AZ:3,CO:3,WA:3,OK:3,
    // Tier 4 — Light (weight 1)
    IA:1,KS:1,NE:1,NM:1,NV:1,OR:1,UT:1,WV:1,DC:1,DE:1,HI:1,ID:1,
    ME:1,MT:1,ND:1,NH:1,RI:1,SD:1,VT:1,WY:1,AK:1
  };
  var pool = [];
  Object.keys(weights).forEach(function(st) {
    for (var i = 0; i < weights[st]; i++) pool.push(st);
  });
  return pool;
})();

// ── State Abbreviation → Full Name (for display) ─────────
export const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"Washington DC",FL:"Florida",GA:"Georgia",HI:"Hawaii",
  ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",
  MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};

// ═══════════════════════════════════════════════════════════
//  COACHING SYSTEM
// ═══════════════════════════════════════════════════════════

// Coach first/last names for NPC generation
export const COACH_FN = ['Mike','John','Rick','Bill','Tom','Mark','Jim','Greg','Kevin','Steve',
  'Chris','Dan','Tony','Dave','Scott','Matt','Jeff','Brian','Bob','Pat','Jay','Ed','Frank',
  'Dennis','Nate','Will','Dusty','Sean','Kelvin','Buzz','Hubert','Jerome','Andy','Thad','Shaka',
  'Mick','Bruce','Brad','Craig','Eric','Kenny','Mick','Wes','Leonard','Dino','Lamont','Fran'];
export const COACH_LN = ['Williams','Smith','Johnson','Brown','Davis','Jones','Miller','Wilson',
  'Anderson','Thomas','Taylor','Jackson','Martin','Harris','Clark','Lewis','Robinson','Walker',
  'Young','Allen','King','Wright','Hill','Green','Adams','Baker','Nelson','Carter','Mitchell',
  'Pitino','Calipari','Self','Few','Izzo','Krzyzewski','Boeheim','Hamilton','Oats','Pearl',
  'Forbes','Gates','Dixon','Cooley','Willard','Sampson','Kelsey','Musselman','Pope','Grant'];

// Derive school prestige from baseOvr: (ovr - 50) * 2.2, clamped 10-95
export function calcSchoolPrestige(baseOvr) {
  return Math.min(95, Math.max(10, Math.round((baseOvr - 50) * 2.2)));
}

// Recruiting star gates by SCHOOL prestige (0-100 scale)
export const SCHOOL_RECRUIT_GATES = {
  5: 80,   // need 80+ school prestige to recruit 5-stars
  4: 60,   // need 60+ for 4-stars
  3: 35,   // need 35+ for 3-stars
  2: 10,   // basically anyone
  1: 0     // anyone
};

// Skill points earned per season
export const SKILL_POINT_TABLE = [
  { check: function(t) { return t.wins >= 16; }, pts: 1, label: 'Winning season' },
  { check: function(t) { return t.wins >= 20; }, pts: 1, label: '20+ wins' },
  { check: function(t) { return t.wins >= 25; }, pts: 1, label: '25+ wins' },
  { check: function(t, g) { return g.confTitleThisYear; }, pts: 1, label: 'Conf champion' },
  { check: function(t, g) { return g.madeNCAA; }, pts: 1, label: 'NCAA tournament' },
  { check: function(t, g) { return g.sweet16; }, pts: 1, label: 'Sweet 16+' },
  { check: function(t, g) { return g.finalFour; }, pts: 1, label: 'Final Four+' },
  { check: function(t, g) { return g.champGame; }, pts: 1, label: 'Championship game' },
  { check: function(t, g) { return g.natChamp; }, pts: 1, label: 'National Champion' }
];

// Season expectations based on roster OVR vs conference average
// Pre-v11 overall scale (copy of utils.oldOvr; utils.js imports this module)
function oldOvrC(v) { return v <= 60 ? v : v <= 82.5 ? 60 + (v - 60) / 0.75 : 90 + (v - 82.5) / 1.35; }

export function calcExpectations(teamOvr, confAvgOvr, rosterRank) {
  // Inputs are team overalls on the display scale; compare on the pre-v11 scale
  var diff = oldOvrC(teamOvr) - oldOvrC(confAvgOvr);
  // Base wins expectation
  var base = 15 + Math.round(diff * 0.5);
  var low = Math.max(5, base - 3);
  var high = Math.min(30, base + 3);
  var danger = Math.max(3, low - 5); // below this = hot seat
  // A top-20 roster is expected to make the NCAA tournament; missing it
  // counts as a disappointing season no matter the win total
  return { low: low, high: high, danger: danger, base: base, ncaa: !!rosterRank && rosterRank <= 20 };
}
