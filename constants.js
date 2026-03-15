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
// Minimum prestige to have ANY shot at a recruit by star tier.
// Below this, your bid is multiplied by a harsh penalty.
export const RECRUIT_PRESTIGE_GATES = {
  5: { minPrestige: 4, penalty: 0.15 },   // 5-stars: need prestige 4+, else 85% bid penalty
  4: { minPrestige: 3, penalty: 0.35 },   // 4-stars: need prestige 3+, else 65% penalty
  3: { minPrestige: 1, penalty: 0.70 },   // 3-stars: anyone can compete, slight penalty if prestige 0
  2: { minPrestige: 1, penalty: 1.0 },    // 2-stars: open
  1: { minPrestige: 1, penalty: 1.0 }     // 1-stars: open
};

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

// ── D1 Teams (364 programs) ──────────────────────────────
export const ALL_TEAMS = [
  // ACC
  {n:"Duke",c:"ACC",o:94},{n:"UNC",c:"ACC",o:91},{n:"Virginia",c:"ACC",o:87},{n:"Syracuse",c:"ACC",o:82},
  {n:"Miami FL",c:"ACC",o:83},{n:"Florida St",c:"ACC",o:81},{n:"Louisville",c:"ACC",o:80},{n:"NC State",c:"ACC",o:82},
  {n:"Clemson",c:"ACC",o:79},{n:"Wake Forest",c:"ACC",o:78},{n:"Pitt",c:"ACC",o:78},{n:"Georgia Tech",c:"ACC",o:77},
  {n:"Notre Dame",c:"ACC",o:80},{n:"Boston Coll",c:"ACC",o:72},{n:"Virginia Tech",c:"ACC",o:79},{n:"SMU",c:"ACC",o:80},
  {n:"Stanford",c:"ACC",o:78},{n:"Cal",c:"ACC",o:73},
  // Big 12
  {n:"Kansas",c:"Big 12",o:93},{n:"Houston",c:"Big 12",o:90},{n:"Baylor",c:"Big 12",o:89},{n:"Arizona",c:"Big 12",o:91},
  {n:"Iowa State",c:"Big 12",o:88},{n:"BYU",c:"Big 12",o:83},{n:"Texas Tech",c:"Big 12",o:86},{n:"TCU",c:"Big 12",o:81},
  {n:"Utah",c:"Big 12",o:80},{n:"Colorado",c:"Big 12",o:76},{n:"K-State",c:"Big 12",o:83},{n:"Cincinnati",c:"Big 12",o:82},
  {n:"UCF",c:"Big 12",o:79},{n:"Oklahoma St",c:"Big 12",o:80},{n:"West Virginia",c:"Big 12",o:79},{n:"Arizona St",c:"Big 12",o:78},
  // Big Ten
  {n:"Purdue",c:"Big Ten",o:91},{n:"Illinois",c:"Big Ten",o:88},{n:"Wisconsin",c:"Big Ten",o:85},{n:"Ohio State",c:"Big Ten",o:87},
  {n:"Michigan St",c:"Big Ten",o:86},{n:"Michigan",c:"Big Ten",o:83},{n:"Indiana",c:"Big Ten",o:82},{n:"Maryland",c:"Big Ten",o:82},
  {n:"Iowa",c:"Big Ten",o:84},{n:"Northwestern",c:"Big Ten",o:79},{n:"Penn State",c:"Big Ten",o:80},{n:"Rutgers",c:"Big Ten",o:78},
  {n:"Nebraska",c:"Big Ten",o:77},{n:"Minnesota",c:"Big Ten",o:78},{n:"UCLA",c:"Big Ten",o:86},{n:"USC",c:"Big Ten",o:82},
  {n:"Oregon",c:"Big Ten",o:83},{n:"Washington",c:"Big Ten",o:79},
  // SEC
  {n:"Kentucky",c:"SEC",o:92},{n:"Tennessee",c:"SEC",o:91},{n:"Alabama",c:"SEC",o:89},{n:"Auburn",c:"SEC",o:87},
  {n:"Florida",c:"SEC",o:85},{n:"Texas A&M",c:"SEC",o:84},{n:"Arkansas",c:"SEC",o:83},{n:"Texas",c:"SEC",o:88},
  {n:"Oklahoma",c:"SEC",o:82},{n:"LSU",c:"SEC",o:83},{n:"Missouri",c:"SEC",o:80},{n:"Georgia",c:"SEC",o:81},
  {n:"Ole Miss",c:"SEC",o:80},{n:"Miss State",c:"SEC",o:78},{n:"Vanderbilt",c:"SEC",o:76},{n:"South Carolina",c:"SEC",o:79},
  // American
  {n:"Memphis",c:"American",o:84},{n:"Tulsa",c:"American",o:73},{n:"SMU",c:"American",o:79},{n:"East Carolina",c:"American",o:70},
  {n:"South Florida",c:"American",o:68},{n:"Temple",c:"American",o:72},{n:"Wichita St",c:"American",o:77},{n:"UAB",c:"American",o:74},
  {n:"North Texas",c:"American",o:73},{n:"UTSA",c:"American",o:69},{n:"Rice",c:"American",o:68},{n:"Florida Atl",c:"American",o:72},
  // Mountain West
  {n:"San Diego St",c:"MW",o:84},{n:"Nevada",c:"MW",o:75},{n:"New Mexico",c:"MW",o:73},{n:"UNLV",c:"MW",o:76},
  {n:"Utah St",c:"MW",o:79},{n:"Boise St",c:"MW",o:74},{n:"Colorado St",c:"MW",o:73},{n:"Air Force",c:"MW",o:68},
  {n:"Wyoming",c:"MW",o:67},{n:"Fresno St",c:"MW",o:72},{n:"San Jose St",c:"MW",o:64},{n:"Hawaii",c:"MW",o:66},
  // WCC
  {n:"Gonzaga",c:"WCC",o:90},{n:"Saint Mary's",c:"WCC",o:81},{n:"San Francisco",c:"WCC",o:74},{n:"Pacific",c:"WCC",o:65},
  {n:"Pepperdine",c:"WCC",o:67},{n:"Santa Clara",c:"WCC",o:66},{n:"Portland",c:"WCC",o:63},{n:"Loyola Mary",c:"WCC",o:64},
  {n:"LMU",c:"WCC",o:63},{n:"San Diego",c:"WCC",o:66},
  // A-10
  {n:"Dayton",c:"A-10",o:82},{n:"VCU",c:"A-10",o:80},{n:"Davidson",c:"A-10",o:78},{n:"Saint Louis",c:"A-10",o:76},
  {n:"Rhode Island",c:"A-10",o:73},{n:"Richmond",c:"A-10",o:74},{n:"George Mason",c:"A-10",o:71},{n:"Fordham",c:"A-10",o:67},
  {n:"La Salle",c:"A-10",o:65},{n:"Duquesne",c:"A-10",o:72},{n:"GWU",c:"A-10",o:68},{n:"Massachusetts",c:"A-10",o:69},
  {n:"St Bonaventure",c:"A-10",o:72},{n:"George Washington",c:"A-10",o:70},
  // MVC
  {n:"Drake",c:"MVC",o:75},{n:"Loyola Chi",c:"MVC",o:74},{n:"Bradley",c:"MVC",o:70},{n:"Illinois St",c:"MVC",o:70},
  {n:"Indiana St",c:"MVC",o:71},{n:"Missouri St",c:"MVC",o:69},{n:"S Illinois",c:"MVC",o:66},{n:"Evansville",c:"MVC",o:63},
  {n:"UNI",c:"MVC",o:71},{n:"Belmont",c:"MVC",o:72},
  // C-USA
  {n:"Liberty",c:"CUSA",o:74},{n:"Jacksonville St",c:"CUSA",o:70},{n:"New Mexico St",c:"CUSA",o:71},{n:"Sam Houston",c:"CUSA",o:68},
  {n:"Western Ky",c:"CUSA",o:72},{n:"UTEP",c:"CUSA",o:67},{n:"Louisiana Tech",c:"CUSA",o:69},{n:"Middle Tenn",c:"CUSA",o:70},
  {n:"FIU",c:"CUSA",o:63},{n:"Charlotte",c:"CUSA",o:66},{n:"Old Dominion",c:"CUSA",o:68},{n:"Southern Miss",c:"CUSA",o:62},
  // Sun Belt
  {n:"Troy",c:"Sun Belt",o:69},{n:"Georgia Southern",c:"Sun Belt",o:67},{n:"Louisiana",c:"Sun Belt",o:70},{n:"App State",c:"Sun Belt",o:65},
  {n:"South Alabama",c:"Sun Belt",o:66},{n:"Arkansas St",c:"Sun Belt",o:64},{n:"Texas St",c:"Sun Belt",o:65},{n:"ULM",c:"Sun Belt",o:61},
  {n:"Georgia St",c:"Sun Belt",o:68},{n:"Marshall",c:"Sun Belt",o:71},{n:"Southern Ala",c:"Sun Belt",o:62},{n:"James Madison",c:"Sun Belt",o:70},
  // WAC
  {n:"Utah Valley",c:"WAC",o:71},{n:"Grand Canyon",c:"WAC",o:74},{n:"Cal Baptist",c:"WAC",o:68},{n:"Abilene Chr",c:"WAC",o:65},
  {n:"Tarleton St",c:"WAC",o:63},{n:"Southern Utah",c:"WAC",o:62},{n:"Seattle U",c:"WAC",o:60},{n:"UMKC",c:"WAC",o:61},
  {n:"Chicago St",c:"WAC",o:56},{n:"Lamar",c:"WAC",o:60},
  // Big East
  {n:"UConn",c:"Big East",o:93},{n:"Marquette",c:"Big East",o:87},{n:"Creighton",c:"Big East",o:86},{n:"Providence",c:"Big East",o:82},
  {n:"Villanova",c:"Big East",o:86},{n:"Xavier",c:"Big East",o:81},{n:"Seton Hall",c:"Big East",o:80},{n:"Georgetown",c:"Big East",o:74},
  {n:"DePaul",c:"Big East",o:70},{n:"Butler",c:"Big East",o:76},{n:"St John's",c:"Big East",o:82},
  // MAC
  {n:"Toledo",c:"MAC",o:72},{n:"Akron",c:"MAC",o:70},{n:"Ball State",c:"MAC",o:66},{n:"Ohio",c:"MAC",o:68},
  {n:"Miami OH",c:"MAC",o:65},{n:"Buffalo",c:"MAC",o:69},{n:"Kent State",c:"MAC",o:67},{n:"W Michigan",c:"MAC",o:65},
  {n:"E Michigan",c:"MAC",o:63},{n:"Bowling Green",c:"MAC",o:61},{n:"N Illinois",c:"MAC",o:62},{n:"Cent Michigan",c:"MAC",o:60},
  // Horizon
  {n:"Cleveland St",c:"Horizon",o:68},{n:"Wright State",c:"Horizon",o:71},{n:"Detroit Mercy",c:"Horizon",o:66},{n:"Oakland",c:"Horizon",o:70},
  {n:"Youngstown St",c:"Horizon",o:62},{n:"Milwaukee",c:"Horizon",o:63},{n:"IUPUI",c:"Horizon",o:61},{n:"Green Bay",c:"Horizon",o:64},
  {n:"N Kentucky",c:"Horizon",o:66},{n:"Purdue Fort Wayne",c:"Horizon",o:63},
  // MAAC
  {n:"Iona",c:"MAAC",o:74},{n:"Rider",c:"MAAC",o:65},{n:"Manhattan",c:"MAAC",o:64},{n:"Niagara",c:"MAAC",o:62},
  {n:"Quinnipiac",c:"MAAC",o:66},{n:"Fairfield",c:"MAAC",o:63},{n:"Canisius",c:"MAAC",o:61},{n:"Marist",c:"MAAC",o:60},
  {n:"Siena",c:"MAAC",o:67},{n:"St Peter's",c:"MAAC",o:65},
  // Southland
  {n:"Stephen F Austin",c:"Southland",o:67},{n:"SE Louisiana",c:"Southland",o:60},{n:"McNeese",c:"Southland",o:62},
  {n:"Nicholls",c:"Southland",o:59},{n:"Houston Baptist",c:"Southland",o:58},{n:"Incarnate Word",c:"Southland",o:57},
  {n:"Northwestern St",c:"Southland",o:60},{n:"New Orleans",c:"Southland",o:56},
  // Big South
  {n:"UNC Asheville",c:"Big South",o:65},{n:"High Point",c:"Big South",o:62},{n:"Longwood",c:"Big South",o:63},
  {n:"Charleston So",c:"Big South",o:60},{n:"Presbyterian",c:"Big South",o:56},{n:"Campbell",c:"Big South",o:62},
  {n:"Winthrop",c:"Big South",o:67},{n:"Gardner-Webb",c:"Big South",o:59},{n:"USC Upstate",c:"Big South",o:57},
  // Colonial (CAA)
  {n:"Towson",c:"CAA",o:69},{n:"Hofstra",c:"CAA",o:68},{n:"Drexel",c:"CAA",o:64},{n:"UNCW",c:"CAA",o:65},
  {n:"Delaware",c:"CAA",o:66},{n:"Elon",c:"CAA",o:61},{n:"William & Mary",c:"CAA",o:63},{n:"James Madison",c:"CAA",o:69},
  {n:"Charleston",c:"CAA",o:71},{n:"Stony Brook",c:"CAA",o:62},{n:"Hampton",c:"CAA",o:60},
  // OVC
  {n:"Bellarmine",c:"OVC",o:63},{n:"Tennessee Tech",c:"OVC",o:62},{n:"E Kentucky",c:"OVC",o:60},{n:"E Tennessee",c:"OVC",o:65},
  {n:"Morehead St",c:"OVC",o:61},{n:"Austin Peay",c:"OVC",o:59},{n:"SIUE",c:"OVC",o:58},{n:"Tennessee Martin",c:"OVC",o:57},
  // Patriot
  {n:"Colgate",c:"Patriot",o:68},{n:"Lehigh",c:"Patriot",o:65},{n:"American",c:"Patriot",o:63},{n:"Navy",c:"Patriot",o:60},
  {n:"Army",c:"Patriot",o:62},{n:"Holy Cross",c:"Patriot",o:64},{n:"Bucknell",c:"Patriot",o:66},{n:"Lafayette",c:"Patriot",o:61},
  {n:"Boston U",c:"Patriot",o:65},
  // Summit
  {n:"South Dakota St",c:"Summit",o:73},{n:"South Dakota",c:"Summit",o:68},{n:"North Dakota St",c:"Summit",o:67},
  {n:"North Dakota",c:"Summit",o:62},{n:"Denver",c:"Summit",o:65},{n:"Oral Roberts",c:"Summit",o:70},{n:"UMKC",c:"Summit",o:60},
  {n:"W Illinois",c:"Summit",o:58},{n:"Kansas City",c:"Summit",o:59},
  // SWAC
  {n:"Grambling",c:"SWAC",o:61},{n:"Southern U",c:"SWAC",o:62},{n:"Prairie View",c:"SWAC",o:60},{n:"Texas Southern",c:"SWAC",o:63},
  {n:"Jackson St",c:"SWAC",o:61},{n:"Alabama A&M",c:"SWAC",o:58},{n:"Alabama St",c:"SWAC",o:59},{n:"Bethune-Cookman",c:"SWAC",o:57},
  {n:"Florida A&M",c:"SWAC",o:60},{n:"Alcorn St",c:"SWAC",o:56},
  // MEAC
  {n:"Howard",c:"MEAC",o:62},{n:"Morgan St",c:"MEAC",o:60},{n:"Delaware St",c:"MEAC",o:56},{n:"Coppin St",c:"MEAC",o:54},
  {n:"NC A&T",c:"MEAC",o:61},{n:"Norfolk St",c:"MEAC",o:65},{n:"SC State",c:"MEAC",o:55},{n:"Md Eastern Shore",c:"MEAC",o:52},
  // America East
  {n:"Vermont",c:"America East",o:71},{n:"UMBC",c:"America East",o:64},{n:"Albany",c:"America East",o:60},{n:"Hartford",c:"America East",o:58},
  {n:"Binghamton",c:"America East",o:56},{n:"Maine",c:"America East",o:55},{n:"New Hampshire",c:"America East",o:57},{n:"Stony Brook",c:"America East",o:61},
  // Northeast (NEC)
  {n:"Merrimack",c:"NEC",o:60},{n:"Sacred Heart",c:"NEC",o:61},{n:"LIU",c:"NEC",o:58},{n:"Wagner",c:"NEC",o:57},
  {n:"Fairleigh Dick",c:"NEC",o:59},{n:"St Francis PA",c:"NEC",o:56},{n:"Central Conn",c:"NEC",o:55},{n:"Bryant",c:"NEC",o:57},
  {n:"CCSU",c:"NEC",o:54},{n:"Mercer",c:"NEC",o:63},
  // SoCon
  {n:"Furman",c:"SoCon",o:68},{n:"Chattanooga",c:"SoCon",o:67},{n:"Mercer",c:"SoCon",o:65},{n:"ETSU",c:"SoCon",o:64},
  {n:"Western Carolina",c:"SoCon",o:60},{n:"VMI",c:"SoCon",o:57},{n:"The Citadel",c:"SoCon",o:55},{n:"UNC Greensboro",c:"SoCon",o:65},
  {n:"Samford",c:"SoCon",o:63},{n:"Wofford",c:"SoCon",o:61},
  // Ivy
  {n:"Yale",c:"Ivy",o:73},{n:"Princeton",c:"Ivy",o:75},{n:"Penn",c:"Ivy",o:66},{n:"Harvard",c:"Ivy",o:67},
  {n:"Columbia",c:"Ivy",o:63},{n:"Cornell",c:"Ivy",o:61},{n:"Dartmouth",c:"Ivy",o:60},{n:"Brown",c:"Ivy",o:62},
  // Big West
  {n:"UC Irvine",c:"Big West",o:71},{n:"UCSB",c:"Big West",o:70},{n:"Long Beach St",c:"Big West",o:68},{n:"UC San Diego",c:"Big West",o:66},
  {n:"Cal Poly",c:"Big West",o:64},{n:"Hawaii",c:"Big West",o:65},{n:"UC Davis",c:"Big West",o:62},{n:"UC Riverside",c:"Big West",o:60},
  {n:"CSU Fullerton",c:"Big West",o:59},{n:"CSU Bakersfield",c:"Big West",o:57},{n:"CSU Northridge",c:"Big West",o:56},
  // ASUN
  {n:"Kennesaw St",c:"ASUN",o:63},{n:"Jacksonville",c:"ASUN",o:61},{n:"Lipscomb",c:"ASUN",o:64},{n:"North Florida",c:"ASUN",o:60},
  {n:"Queens",c:"ASUN",o:59},{n:"Eastern Ky",c:"ASUN",o:63},{n:"Florida Gulf Coast",c:"ASUN",o:66},{n:"Bellarmine",c:"ASUN",o:60},
  {n:"Austin Peay",c:"ASUN",o:61},{n:"Central Arkansas",c:"ASUN",o:62}
];

// ── Commentary Banks ─────────────────────────────────────
export const COM = {
  make3: [
    function(a,d){return a+" buries the three over "+d+"!";},
    function(a,d){return a+" from downtown — GOOD!";},
    function(a,d){return "Step-back three by "+a+". Nothing but net.";},
    function(a,d){return a+" fires and drills it from the arc!";},
    function(a,d){return "Cold blooded. "+a+" from 25 feet — in!";},
    function(a,d){return a+" catches, rises, nails the three!";},
    function(a,d){return "Hand in his face? Doesn't matter. "+a+" is locked in.";},
    function(a,d){return a+" creates some space... step-back... CASH!";},
    function(a,d){return "He's heating up! "+a+" knocks it down from the elbow.";},
    function(a,d){return "Ice in his veins! "+a+" hits a cold-blooded bucket.";},
    function(a,d){return a+" stop and pop! The mid-range game is alive and well.";},
  ],
  make2: [
    function(a,d){return a+" attacks the paint and finishes!";},
    function(a,d){return a+" with the pull-up mid-range — good!";},
    function(a,d){return "Beautiful move by "+a+", off the glass.";},
    function(a,d){return a+" powers through "+d+" for the bucket!";},
    function(a,d){return a+" floats it up — and it falls!";},
    function(a,d){return "Tough finish by "+a+" in traffic.";},
    function(a,d){return a+" rising up... Got it! Nothing but the bottom of the net.";},
    function(a,d){return a+" with the smooth jumper. Pure as silk.";},
    function(a,d){return "Textbook form from "+a+". Finding a rhythm now.";},
    function(a,d){return a+" finds a gap in the zone and punishes them. Count it!";},
    function(a,d){return "The defense gave him an inch, and "+a+" took a mile. Swish.";},
    function(a,d){return "The bank is open! "+a+" calls glass on that one.";},
    function(a,d){return a+" just silencing the road crowd with that bucket.";},
    function(a,d){return "He's a flamethrower! "+a+" adds another two to the tally.";},
    function(a,d){return a+" catches, squares up, and delivers. Clinical.";},
    function(a,d){return "That's a professional-grade bucket from "+a+".";},
    function(a,d){return "High off the glass and in! "+a+" showing off the soft touch.";},
  ],
  dunk: [
    function(a,d){return a+" THROWS IT DOWN on "+d+"! The crowd erupts!";},
    function(a,d){return "SLAM by "+a+"! Nobody was stopping that!";},
    function(a,d){return a+" JAMS IT with authority!";},
    function(a,d){return "OH WOW — "+a+" hammers it home over "+d+"!";},
    function(a,d){return "THROWN DOWN! "+a+" just rocked the rim!";},
    function(a,d){return "GET OUT OF THE WAY! "+a+" posterizes "+d+"!";},
    function(a,d){return "Look out below! "+a+" with the absolute thunder!";},
    function(a,d){return "A rim-rattling finish for "+a+"! The backboard is still shaking.";},
    function(a,d){return a+" goes up with bad intentions! UNBELIEVABLE!";},
    function(a,d){return "The lob... and the JAM! "+a+" provides the fireworks!";},
    function(a,d){return a+" just took flight! That's a momentum shifter right there.";},
    function(a,d){return "ONE-HANDED HAMMER! "+a+" is putting on a show!";},
    function(a,d){return "Put him on a poster! "+a+" destroys the interior defense.";},
    function(a,d){return "The bench is on its feet! "+a+" with the powerhouse dunk.";},
    function(a,d){return a+" rises above the trees and slams it home!";},
    function(a,d){return "The rim might need a mechanic after that "+a+" flush.";},
    function(a,d){return "He nearly tore the goal down! "+a+" with a monster slam.";},
  ],
  miss2: [
    function(a,d){return a+" misses the mid-range. Comes up short.";},
    function(a,d){return "Off the back rim for "+a+".";},
    function(a,d){return a+" drives, contact — rolls off.";},
    function(a,d){return "No good for "+a+" from inside.";},
    function(a,d){return "Strong move by "+a+", but the finishing touch isn't there.";},
    function(a,d){return "In and out! Heartbreak for "+a+" on that attempt.";},
    function(a,d){return "Clank. "+a+" leaves that one a little short.";},
    function(a,d){return "The defense rattled him. "+a+" misses the mark.";},
    function(a,d){return a+" with the turnaround... back iron. Rebound is loose!";},
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
    function(a,d){return "Airball! "+a+" completely misjudged the distance on that one.";},
    function(a,d){return "Off the side of the rim. "+a+" is struggling to find the range.";},
    function(a,d){return "That shot had 'no' written all over it. Poor look from "+a+".";},
  ],
  block: [
    function(a,d){return "BLOCKED by "+d+"! Sends "+a+"'s shot into the seats!";},
    function(a,d){return d+" rises and SWATS it! Huge rejection!";},
    function(a,d){return "Denied at the rim! "+d+" with the massive block!";},
    function(a,d){return d+" times it perfectly — BLOCK!";},
    function(a,d){return "NOT IN HIS HOUSE! "+d+" sends it into the third row!";},
    function(a,d){return "Rejected by "+d+"! A massive defensive stand!";},
    function(a,d){return d+" says NO! What a phenomenal recovery on the play.";},
    function(a,d){return "Get that weak stuff out of here! "+d+" with the swat.";},
    function(a,d){return d+" timing that perfectly. Clean block!";},
    function(a,d){return "He read him like a book! "+d+" erases the shot.";},
    function(a,d){return "BLOCKED! "+d+" is a one-man wrecking crew on defense.";},
    function(a,d){return d+" puts that one in the seats! The energy just flipped.";},
    function(a,d){return "Total annihilation! "+d+" swats it right back at "+a+".";},
    function(a,d){return "Swatted! "+d+" is making life miserable for the offense.";},
    function(a,d){return "The finger wag from "+d+"! He's dominating the paint.";},
  ],
  steal: [
    function(a,d){return "STOLEN by "+d+"! "+a+" coughs it up!";},
    function(a,d){return d+" reads the passing lane — picks it off!";},
    function(a,d){return "Pickpocket by "+d+"! Clean strip on "+a+".";},
    function(a,d){return d+" picks his pocket! Pure thievery on the perimeter.";},
    function(a,d){return "Ripped away by "+d+"! He's got a head of steam now.";},
    function(a,d){return d+" read the pass perfectly. Going the other way!";},
    function(a,d){return d+" with the quick hands! Off on the break.";},
    function(a,d){return "Telepathic defense! "+d+" jumps the lane for the steal.";},
    function(a,d){return "Cookie jar! "+d+" catches "+a+" napping with the ball.";},
    function(a,d){return d+" takes it away! A nightmare sequence for the offense.";},
    function(a,d){return "Great anticipation by "+d+". He's a ball hawk tonight!";},
    function(a,d){return "Grand theft basketball! "+d+" is a menace.";},
    function(a,d){return d+" with the heist! He's reading their plays before they make them.";},
  ],
  turn: [
    function(a,d){return a+" turns it over. "+d+" takes possession.";},
    function(a,d){return "Bad pass by "+a+" — out of bounds.";},
    function(a,d){return a+" dribbles off his foot. Turnover.";},
    function(a,d){return "Telegraphed entry pass by "+a+". Stolen!";},
    function(a,d){return a+" tried to do too much there. That's a low-percentage play.";},
    function(a,d){return "Sloppy handle from "+a+". "+d+" will take possession.";},
    function(a,d){return a+" loses it in traffic. Costly mistake.";},
  ],
  putback: [
    function(a){return a+" with the offensive board — putback!";},
    function(a){return "Second chance! "+a+" tips it in!";},
    function(a){return a+" grabs the miss and converts!";},
    function(a){return "Second chance points! "+a+" refuses to let that possession die.";},
  ],
  clutch: [
    function(a){return "CLUTCH! "+a+" delivers when it matters!";},
    function(a){return a+" WON'T BACK DOWN. Huge shot!";},
    function(a){return "Ice in his veins — "+a+" hits the big one!";},
    function(a){return "That's a CLUTCH bucket from "+a+"! He lives for these moments!";},
    function(a){return a+" is ice cold under pressure. Unbelievable composure.";},
    function(a){return "The moment is NOT too big for "+a+". Money!";},
  ],
  run: [
    function(t,n){return t+" on a "+n+"-0 run! This place is going crazy!";},
    function(t,n){return ""+n+" straight for "+t+"! Momentum shift!";},
    function(t,n){return t+" can't miss right now — "+n+"-0 run!";},
    function(t,n){return "How do you stop "+t+"? "+n+" unanswered! Timeout coming!";},
    function(t,n){return t+" on an absolute tear. "+n+"-0 run changes everything.";},
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
export const TEAM_STATES = {
  // ACC
  "Duke":"NC","UNC":"NC","Virginia":"VA","Syracuse":"NY","Miami FL":"FL","Florida St":"FL",
  "Louisville":"KY","NC State":"NC","Clemson":"SC","Wake Forest":"NC","Pitt":"PA",
  "Georgia Tech":"GA","Notre Dame":"IN","Boston Coll":"MA","Virginia Tech":"VA",
  "Stanford":"CA","Cal":"CA",
  // Big 12
  "Kansas":"KS","Houston":"TX","Baylor":"TX","Arizona":"AZ","Iowa State":"IA","BYU":"UT",
  "Texas Tech":"TX","TCU":"TX","Utah":"UT","Colorado":"CO","K-State":"KS","Cincinnati":"OH",
  "UCF":"FL","Oklahoma St":"OK","West Virginia":"WV","Arizona St":"AZ",
  // Big Ten
  "Purdue":"IN","Illinois":"IL","Wisconsin":"WI","Ohio State":"OH","Michigan St":"MI",
  "Michigan":"MI","Indiana":"IN","Maryland":"MD","Iowa":"IA","Northwestern":"IL",
  "Penn State":"PA","Rutgers":"NJ","Nebraska":"NE","Minnesota":"MN","UCLA":"CA","USC":"CA",
  "Oregon":"OR","Washington":"WA",
  // SEC
  "Kentucky":"KY","Tennessee":"TN","Alabama":"AL","Auburn":"AL","Florida":"FL",
  "Texas A&M":"TX","Arkansas":"AR","Texas":"TX","Oklahoma":"OK","LSU":"LA","Missouri":"MO",
  "Georgia":"GA","Ole Miss":"MS","Miss State":"MS","Vanderbilt":"TN","South Carolina":"SC",
  // American
  "Memphis":"TN","Tulsa":"OK","SMU":"TX","East Carolina":"NC","South Florida":"FL",
  "Temple":"PA","Wichita St":"KS","UAB":"AL","North Texas":"TX","UTSA":"TX","Rice":"TX",
  "Florida Atl":"FL",
  // MW
  "San Diego St":"CA","Nevada":"NV","New Mexico":"NM","UNLV":"NV","Utah St":"UT",
  "Boise St":"ID","Colorado St":"CO","Air Force":"CO","Wyoming":"WY","Fresno St":"CA",
  "San Jose St":"CA","Hawaii":"HI",
  // WCC
  "Gonzaga":"WA","Saint Mary's":"CA","San Francisco":"CA","Pacific":"CA","Pepperdine":"CA",
  "Santa Clara":"CA","Portland":"OR","Loyola Mary":"CA","LMU":"CA","San Diego":"CA",
  // A-10
  "Dayton":"OH","VCU":"VA","Davidson":"NC","Saint Louis":"MO","Rhode Island":"RI",
  "Richmond":"VA","George Mason":"VA","Fordham":"NY","La Salle":"PA","Duquesne":"PA",
  "GWU":"DC","Massachusetts":"MA","St Bonaventure":"NY","George Washington":"DC",
  // MVC
  "Drake":"IA","Loyola Chi":"IL","Bradley":"IL","Illinois St":"IL","Indiana St":"IN",
  "Missouri St":"MO","S Illinois":"IL","Evansville":"IN","UNI":"IA","Belmont":"TN",
  // CUSA
  "Liberty":"VA","Jacksonville St":"AL","New Mexico St":"NM","Sam Houston":"TX",
  "Western Ky":"KY","UTEP":"TX","Louisiana Tech":"LA","Middle Tenn":"TN","FIU":"FL",
  "Charlotte":"NC","Old Dominion":"VA","Southern Miss":"MS",
  // Sun Belt
  "Troy":"AL","Georgia Southern":"GA","Louisiana":"LA","App State":"NC","South Alabama":"AL",
  "Arkansas St":"AR","Texas St":"TX","ULM":"LA","Georgia St":"GA","Marshall":"WV",
  "Southern Ala":"AL","James Madison":"VA",
  // WAC
  "Utah Valley":"UT","Grand Canyon":"AZ","Cal Baptist":"CA","Abilene Chr":"TX",
  "Tarleton St":"TX","Southern Utah":"UT","Seattle U":"WA","UMKC":"MO","Chicago St":"IL",
  "Lamar":"TX",
  // Big East
  "UConn":"CT","Marquette":"WI","Creighton":"NE","Providence":"RI","Villanova":"PA",
  "Xavier":"OH","Seton Hall":"NJ","Georgetown":"DC","DePaul":"IL","Butler":"IN",
  "St John's":"NY",
  // MAC
  "Toledo":"OH","Akron":"OH","Ball State":"IN","Ohio":"OH","Miami OH":"OH","Buffalo":"NY",
  "Kent State":"OH","W Michigan":"MI","E Michigan":"MI","Bowling Green":"OH",
  "N Illinois":"IL","Cent Michigan":"MI",
  // Horizon
  "Cleveland St":"OH","Wright State":"OH","Detroit Mercy":"MI","Oakland":"MI",
  "Youngstown St":"OH","Milwaukee":"WI","IUPUI":"IN","Green Bay":"WI","N Kentucky":"KY",
  "Purdue Fort Wayne":"IN",
  // MAAC
  "Iona":"NY","Rider":"NJ","Manhattan":"NY","Niagara":"NY","Quinnipiac":"CT",
  "Fairfield":"CT","Canisius":"NY","Marist":"NY","Siena":"NY","St Peter's":"NJ",
  // Southland
  "Stephen F Austin":"TX","SE Louisiana":"LA","McNeese":"LA","Nicholls":"LA",
  "Houston Baptist":"TX","Incarnate Word":"TX","Northwestern St":"LA","New Orleans":"LA",
  // Big South
  "UNC Asheville":"NC","High Point":"NC","Longwood":"VA","Charleston So":"SC",
  "Presbyterian":"SC","Campbell":"NC","Winthrop":"SC","Gardner-Webb":"NC","USC Upstate":"SC",
  // CAA
  "Towson":"MD","Hofstra":"NY","Drexel":"PA","UNCW":"NC","Delaware":"DE","Elon":"NC",
  "William & Mary":"VA","Charleston":"SC","Stony Brook":"NY","Hampton":"VA",
  // OVC
  "Bellarmine":"KY","Tennessee Tech":"TN","E Kentucky":"KY","E Tennessee":"TN",
  "Morehead St":"KY","Austin Peay":"TN","SIUE":"IL","Tennessee Martin":"TN",
  // Patriot
  "Colgate":"NY","Lehigh":"PA","American":"DC","Navy":"MD","Army":"NY","Holy Cross":"MA",
  "Bucknell":"PA","Lafayette":"PA","Boston U":"MA",
  // Summit
  "South Dakota St":"SD","South Dakota":"SD","North Dakota St":"ND","North Dakota":"ND",
  "Denver":"CO","Oral Roberts":"OK","W Illinois":"IL","Kansas City":"MO",
  // SWAC
  "Grambling":"LA","Southern U":"LA","Prairie View":"TX","Texas Southern":"TX",
  "Jackson St":"MS","Alabama A&M":"AL","Alabama St":"AL","Bethune-Cookman":"FL",
  "Florida A&M":"FL","Alcorn St":"MS",
  // MEAC
  "Howard":"DC","Morgan St":"MD","Delaware St":"DE","Coppin St":"MD","NC A&T":"NC",
  "Norfolk St":"VA","SC State":"SC","Md Eastern Shore":"MD",
  // America East
  "Vermont":"VT","UMBC":"MD","Albany":"NY","Hartford":"CT","Binghamton":"NY","Maine":"ME",
  "New Hampshire":"NH",
  // NEC
  "Merrimack":"MA","Sacred Heart":"CT","LIU":"NY","Wagner":"NY","Fairleigh Dick":"NJ",
  "St Francis PA":"PA","Central Conn":"CT","Bryant":"RI","CCSU":"CT","Mercer":"GA",
  // SoCon
  "Furman":"SC","Chattanooga":"TN","ETSU":"TN","Western Carolina":"NC","VMI":"VA",
  "The Citadel":"SC","UNC Greensboro":"NC","Samford":"AL","Wofford":"SC",
  // Ivy
  "Yale":"CT","Princeton":"NJ","Penn":"PA","Harvard":"MA","Columbia":"NY","Cornell":"NY",
  "Dartmouth":"NH","Brown":"RI",
  // Big West
  "UC Irvine":"CA","UCSB":"CA","Long Beach St":"CA","UC San Diego":"CA","Cal Poly":"CA",
  "UC Davis":"CA","UC Riverside":"CA","CSU Fullerton":"CA","CSU Bakersfield":"CA",
  "CSU Northridge":"CA",
  // ASUN
  "Kennesaw St":"GA","Jacksonville":"FL","Lipscomb":"TN","North Florida":"FL","Queens":"NC",
  "Eastern Ky":"KY","Florida Gulf Coast":"FL","Central Arkansas":"AR"
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
