# Build research/rankings/data/games_<season>.csv and polls_<season>.csv
# from sportsdataverse ESPN schedules (+ the per-game ranks fetched by
# fetch_espn_ranks.py for seasons whose schedule file has no rank columns).
#   python build_data.py <sched_dir> <ranks_dir> <out_dir>
# Season = the year the season ends (2017 = 2016-17).
# Ranks are what ESPN showed at game time: the AP poll in effect that week
# during the regular season and conference tournaments (season_type 2). In
# NCAA tournament games (season_type 3) ESPN's rank is the tournament seed.
import csv, sys, os, collections, datetime

POWER = {'ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12'}
HIGH = {'Big East', 'Mountain West', 'A-10', 'WCC', 'American'}

def tier(conf, season):
    if conf == 'Pac-12' and season >= 2025: return 'high'   # 2-team Pac-12 after the 2024 breakup
    return 'power' if conf in POWER else 'high' if conf in HIGH else 'mid'

def et_date(iso):
    # ESPN dates are UTC ("2018-04-03T01:20Z"); Eastern time decides the poll week
    d = datetime.datetime.strptime(iso[:16], '%Y-%m-%dT%H:%M') - datetime.timedelta(hours=5)
    return d.date()

def truthy(v): return str(v).lower() in ('true', '1')

def rank_of(v):
    try: r = int(float(v))
    except Exception: return 0
    return r if 1 <= r <= 25 else 0

def main(sched_dir, ranks_dir, out):
    os.makedirs(out, exist_ok=True)
    for season in [int(s) for s in os.environ.get('SEASONS', ' '.join(map(str, range(2017, 2027)))).split()]:
        rows = list(csv.DictReader(open(f'{sched_dir}/mbb_schedule_{season}.csv')))
        fetched = {}
        for rf in (f'{ranks_dir}/ranks_{season}.csv', f'{ranks_dir}/ncaa_{season}.csv'):
            if os.path.exists(rf):
                for r in csv.DictReader(open(rf)):
                    if r['home_id']: fetched[r['game_id']] = r
        # conference per team from conference games
        conf = {}
        for r in rows:
            if truthy(r['conference_competition']) and r.get('groups_short_name'):
                conf[r['home_id']] = r['groups_short_name']; conf[r['away_id']] = r['groups_short_name']
        norm = {'Atlantic Sun': 'ASUN', 'Southern': 'SoCon', 'A 10': 'A-10', 'C-USA': 'CUSA'}
        games = []
        for r in rows:
            if not truthy(r['status_type_completed']): continue
            try: hs, as_ = int(float(r['home_score'])), int(float(r['away_score']))
            except Exception: continue
            st = r['season_type']
            if 'home_current_rank' in r:
                hr, ar = rank_of(r['home_current_rank']), rank_of(r['away_current_rank'])
            elif r['game_id'] in fetched:
                f = fetched[r['game_id']]
                hr, ar = rank_of(f['home_rank']), rank_of(f['away_rank'])
                if f['home_id'] != r['home_id']: hr, ar = ar, hr
            elif st == '2':
                continue  # rank unknown: leave the game out rather than guess
            else:
                hr = ar = 0
            hc = norm.get(conf.get(r['home_id'], ''), conf.get(r['home_id'], ''))
            ac = norm.get(conf.get(r['away_id'], ''), conf.get(r['away_id'], ''))
            d = et_date(r['date'])
            notes = r.get('notes_headline', '') or ''
            kind = 'reg' if st == '2' else ('ncaa' if "men's basketball championship" in notes.lower() else 'post')
            games.append(dict(season=season, date=d.isoformat(), week_monday=(d - datetime.timedelta(days=d.weekday())).isoformat(),
                game_id=r['game_id'], kind=kind, neutral=1 if truthy(r['neutral_site']) else 0, conf_game=1 if truthy(r['conference_competition']) else 0,
                home_id=r['home_id'], home=r['home_display_name'], home_conf=hc, home_tier=tier(hc, season) if hc else '', home_rank=hr, home_score=hs,
                away_id=r['away_id'], away=r['away_display_name'], away_conf=ac, away_tier=tier(ac, season) if ac else '', away_rank=ar, away_score=as_,
                notes=notes))
        games.sort(key=lambda g: (g['date'], g['game_id']))
        # Saved: every game with a ranked team, plus the NCAA tournament (seeds)
        keep = [g for g in games if g['home_rank'] or g['away_rank'] or g['kind'] == 'ncaa']
        with open(f'{out}/games_{season}.csv', 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(games[0].keys())); w.writeheader(); w.writerows(keep)
        # weekly polls: a team's rank in a week = the rank shown in its games that week
        weeks = sorted({g['week_monday'] for g in games if g['kind'] == 'reg'})
        wk_index = {m: i for i, m in enumerate(weeks)}
        rec = collections.defaultdict(lambda: [0, 0])
        seen = {}  # (week, team) -> rank
        conflict = 0
        poll = collections.defaultdict(dict)
        names = {}
        for g in games:
            if g['kind'] != 'reg': continue
            wi = wk_index[g['week_monday']]
            for side, opp in (('home', 'away'), ('away', 'home')):
                tid, rk = g[side + '_id'], g[side + '_rank']
                names[tid] = (g[side], g[side + '_conf'], g[side + '_tier'])
                key = (wi, tid)
                if key not in seen:
                    seen[key] = (rk, tuple(rec[tid]))
                elif seen[key][0] != rk: conflict += 1
                if rk: poll[wi][tid] = (rk, seen[key][1])
            won_home = g['home_score'] > g['away_score']
            rec[g['home_id']][0 if won_home else 1] += 1
            rec[g['away_id']][1 if won_home else 0] += 1
        with open(f'{out}/polls_{season}.csv', 'w', newline='') as f:
            w = csv.writer(f); w.writerow(['season', 'week', 'week_monday', 'rank', 'team_id', 'team', 'conf', 'tier', 'wins_before', 'losses_before'])
            for wi in sorted(poll):
                for tid, (rk, (wn, ls)) in sorted(poll[wi].items(), key=lambda x: x[1][0]):
                    n = names[tid]
                    w.writerow([season, wi, weeks[wi], rk, tid, n[0], n[1], n[2], wn, ls])
        per_week = [len(poll[wi]) for wi in sorted(poll)]
        print(season, 'games', len(games), 'weeks', len(weeks), 'ranked teams seen per week', per_week, 'rank conflicts within a week', conflict)

if __name__ == '__main__':
    main(*sys.argv[1:4])
