"""Real program strength from ESPN results (sportsdataverse schedule files).

Usage: python3 -I rate.py <sched_dir> <game_teams.json> <out_dir>

For each season: every completed game between two teams on the game's list
of 365 schools, margin capped at 20, 3.5 home points removed, then the same
least-squares rating the game uses (rating = average margin + average
opponent rating, iterated). Program strength = weighted average over the
seasons (last five count double).
"""
import csv, json, os, sys

sched_dir, teams_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
game = json.load(open(teams_path))            # [{n, c, o}]
names = {t['n'] for t in game}
SEASONS = list(range(2017, 2027))
CAP, HCA = 20, 3.5
# ESPN location spellings (current and older names) -> the game's name
ALIAS = {
    'Pittsburgh': 'Pitt', 'San José State': 'San Jose State', 'Loyola Marymount': 'LMU',
    'UMass': 'Massachusetts', 'Northern Iowa': 'UNI', 'Florida International': 'FIU',
    'Appalachian State': 'App State', 'UL Monroe': 'ULM', 'California Baptist': 'Cal Baptist',
    'Tarleton': 'Tarleton State', 'IUPUI': 'IU Indianapolis', 'South Carolina Upstate': 'USC Upstate',
    'SIU Edwardsville': 'SIUE', 'American University': 'American', 'North Carolina A&T': 'NC A&T',
    'South Carolina State': 'SC State', 'Maryland-Eastern Shore': 'Maryland Eastern Shore',
    'Albany': 'UAlbany', 'Long Island University': 'LIU', 'Fairleigh Dickinson': 'FDU',
    'Central Connecticut': 'CCSU', 'East Tennessee State': 'ETSU', 'Pennsylvania': 'Penn',
    'UC Santa Barbara': 'UCSB', "Hawai'i": 'Hawaii', 'Cal State Bakersfield': 'CSU Bakersfield',
    'Queens University': 'Queens', 'North Carolina Central': 'NC Central',
    'Southeast Missouri State': 'Southeast Missouri', 'Texas A&M-Commerce': 'East Texas A&M',
    'Texas A&M-Corpus Christi': 'Texas A&M-CC', 'UT Rio Grande Valley': 'UTRGV',
    'Arkansas-Pine Bluff': 'UAPB', 'Mississippi Valley State': 'MVSU',
    'St. Thomas-Minnesota': 'St. Thomas', 'St. Thomas - Minnesota': 'St. Thomas',
}

def rate(games, teams):
    r = {t: 0.0 for t in teams}
    for _ in range(60):
        acc = {t: [0.0, 0] for t in teams}
        for a, b, m in games:
            acc[a][0] += m + r[b]; acc[a][1] += 1
            acc[b][0] += -m + r[a]; acc[b][1] += 1
        nxt = {t: (acc[t][0] / acc[t][1] if acc[t][1] else 0.0) for t in teams}
        mean = sum(nxt.values()) / len(nxt)
        r = {t: v - mean for t, v in nxt.items()}
    return r

unmatched = set()
per = {}
for yr in SEASONS:
    f = os.path.join(sched_dir, 'mbb_schedule_%d.csv' % yr)
    if not os.path.exists(f):
        print('missing season', yr); continue
    games, seen = [], set()
    for row in csv.DictReader(open(f, newline='', encoding='utf-8')):
        if row.get('status_type_completed') not in ('TRUE', 'True', 'true'): continue
        h, a = row['home_location'], row['away_location']
        h, a = ALIAS.get(h, h), ALIAS.get(a, a)
        if h not in names: unmatched.add(h); continue
        if a not in names: unmatched.add(a); continue
        try: hs, as_ = int(float(row['home_score'])), int(float(row['away_score']))
        except ValueError: continue
        gid = row['id']
        if gid in seen: continue
        seen.add(gid)
        neutral = row.get('neutral_site') in ('TRUE', 'True', 'true')
        m = max(-CAP, min(CAP, hs - as_)) - (0 if neutral else HCA)
        games.append((h, a, m))
    teams = {x for g in games for x in g[:2]}
    per[yr] = rate(games, teams)
    print(yr, len(games), 'games', len(teams), 'teams')

out = []
for t in game:
    vals = [(yr, per[yr][t['n']]) for yr in SEASONS if yr in per and t['n'] in per[yr]]
    w = [(2 if yr >= SEASONS[-5] else 1) for yr, _ in vals]
    strength = sum(v * k for (_, v), k in zip(vals, w)) / sum(w) if vals else None
    out.append({'n': t['n'], 'c': t['c'], 'o': t['o'], 'seasons': len(vals),
                'strength': None if strength is None else round(strength, 2),
                'by_season': {str(yr): round(v, 1) for yr, v in vals}})
os.makedirs(out_dir, exist_ok=True)
json.dump(out, open(os.path.join(out_dir, 'program-strength.json'), 'w'), indent=1)
print('unmatched ESPN names (not D1 in the game):', len(unmatched))
