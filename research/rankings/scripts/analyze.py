# Phase 2 measurements from research/rankings/data (games_*.csv, polls_*.csv).
#   python analyze.py <data_dir> [out.json]
# Prints every stat with its spread and writes them as JSON (used for the
# game-vs-real table in test-harness/rankings-calibration.mjs).
import csv, sys, json, os, statistics as stt, collections, math

BLUE = ['Duke Blue Devils', 'Kansas Jayhawks', 'Kentucky Wildcats', 'North Carolina Tar Heels', 'UCLA Bruins', 'Indiana Hoosiers']

def load(d, season):
    games = list(csv.DictReader(open(f'{d}/games_{season}.csv')))
    polls = collections.defaultdict(dict)  # week -> tid -> rank
    info = {}
    for r in csv.DictReader(open(f'{d}/polls_{season}.csv')):
        polls[int(r['week'])][r['team_id']] = int(r['rank'])
        info[r['team_id']] = (r['team'], r['conf'], r['tier'])
    for g in games:
        for s in ('home', 'away'):
            info.setdefault(g[s + '_id'], (g[s], g[s + '_conf'], g[s + '_tier']))
    return games, polls, info

def q(xs, p):
    xs = sorted(xs); k = (len(xs) - 1) * p; f = math.floor(k); c = math.ceil(k)
    return xs[f] if f == c else xs[f] + (xs[c] - xs[f]) * (k - f)

def summ(xs):
    if not xs: return {'n': 0}
    return {'n': len(xs), 'mean': round(stt.mean(xs), 2), 'sd': round(stt.pstdev(xs), 2), 'p25': round(q(xs, .25), 1), 'median': round(q(xs, .5), 1), 'p75': round(q(xs, .75), 1)}

def main(d, out=None):
    seasons = sorted(int(f[6:10]) for f in os.listdir(d) if f.startswith('games_'))
    R = {'seasons': seasons}
    pre_final, pre_hit, pre_top5, pre_top10_final = [], [], [], []
    blue_start = collections.Counter(); blue_seasons = 0
    loss_drop = collections.defaultdict(list); dropout = collections.defaultdict(lambda: [0, 0])
    unb_climb = collections.defaultdict(list); unb_tier = collections.defaultdict(list)
    win_climb = collections.defaultdict(list)
    churn = []; no1_changes = 0; no1_weeks = 0; no1_per_season = []
    tier_spots = collections.Counter(); best_mid = []
    seed_top4 = [0, 0]; seed_gap = []; one_seeds_ranked = []
    pre_corr = []
    for season in seasons:
        games, polls, info = load(d, season)
        weeks = sorted(polls)
        last = weeks[-1]
        # final observed poll: the last week with a near-full poll
        while len(polls[last]) < 23: last -= 1
        pre = polls[weeks[0]]; fin = polls[last]
        for tid, r in pre.items():
            fr = fin.get(tid)
            pre_hit.append(1 if fr else 0)
            pre_final.append((r, fr or 30))
            if r <= 5: pre_top5.append(1 if fr and fr <= 10 else 0)
        pre_corr.append(spearman([(r, fin.get(t, 30)) for t, r in pre.items()]))
        # bluebloods starting ranked
        names = {v[0]: k for k, v in info.items()}
        blue_seasons += 1
        for b in BLUE:
            if names.get(b) in pre: blue_start[b] += 1
        # weekly results per team: games in poll week w
        wk_index = {}
        mondays = sorted({g['week_monday'] for g in games if g['kind'] == 'reg'})
        for i, m in enumerate(mondays): wk_index[m] = i
        res = collections.defaultdict(list)  # (w, tid) -> [(won, opp_rank, site, opp_tier)]
        losses_so_far = collections.defaultdict(int); unbeaten_at = {}
        for g in games:
            if g['kind'] != 'reg': continue
            w = wk_index[g['week_monday']]
            hw = int(g['home_score']) > int(g['away_score'])
            for s, o, won in (('home', 'away', hw), ('away', 'home', not hw)):
                site = 'N' if g['neutral'] == '1' else ('H' if s == 'home' else 'A')
                tid = g[s + '_id']
                if (w, tid) not in unbeaten_at: unbeaten_at[(w, tid)] = losses_so_far[tid] == 0
                res[(w, tid)].append((won, int(g[o + '_rank']), site, g[o + '_tier']))
                if not won: losses_so_far[tid] += 1
        no1_prev = None; n1c = 0
        for w in weeks[:-1]:
            nxt = w + 1
            if nxt not in polls: continue
            cur = polls[w]; nx = polls[nxt]
            full = len(cur) >= 24 and len(nx) >= 24
            if full:
                churn.append(len(set(nx) - set(cur)))
            # #1 changes (both weeks know their #1)
            c1 = [t for t, r in cur.items() if r == 1]; n1 = [t for t, r in nx.items() if r == 1]
            if c1 and n1:
                no1_weeks += 1
                if c1[0] != n1[0]: no1_changes += 1; n1c += 1
            for tid, r in cur.items():
                rs = res.get((w, tid))
                if not rs: continue
                # next week's rank must be observed: the team played next week
                if (nxt, tid) not in res: continue
                nr = nx.get(tid)
                newr = nr if nr else 26
                band = '1-5' if r <= 5 else '6-15' if r <= 15 else '16-25'
                L = [x for x in rs if not x[0]]; W = [x for x in rs if x[0]]
                if len(L) == 1:
                    won, orank, site, otier = L[0]
                    ob = 'top10' if 1 <= orank <= 10 else '11-25' if orank else 'unranked'
                    key_w = '1-0' if not W else '1L+%dW' % len(W)
                    drop = newr - r
                    loss_drop[('all',)].append(drop)
                    loss_drop[('opp', ob)].append(drop)
                    loss_drop[('site', site)].append(drop)
                    loss_drop[('band', band)].append(drop)
                    loss_drop[('wins', 'no other game' if not W else 'plus a win')].append(drop)
                    if len(W) == 1:   # one loss and one win: what every 2-game poll window in the game looks like
                        loss_drop[('1L1W', 'all')].append(drop)
                        loss_drop[('1L1W_opp', ob)].append(drop)
                        loss_drop[('1L1W_site', site)].append(drop)
                        loss_drop[('1L1W_band', band)].append(drop)
                        dropout['1L1W ' + band][0] += 1; dropout['1L1W ' + band][1] += 1 if not nr else 0
                    if not W:
                        loss_drop[('only', ob)].append(drop)
                        loss_drop[('only_site', site)].append(drop)
                        loss_drop[('only_band', band)].append(drop)
                    dropout[band][0] += 1; dropout[band][1] += 1 if not nr else 0
                    dropout['all'][0] += 1; dropout['all'][1] += 1 if not nr else 0
                elif len(L) == 2 and not W:
                    loss_drop[('2L', 'all')].append(newr - r)
                elif len(L) == 0 and W:
                    climb = r - newr
                    win_climb[band].append(climb)
                    if unbeaten_at.get((w, tid)):
                        unb_climb[band].append(climb)
                        t = info.get(tid, ('', '', ''))[2]
                        unb_tier[(t, band)].append(climb)
        no1_per_season.append(n1c)
        for w in weeks:
            if len(polls[w]) < 24: continue
            for tid in polls[w]: tier_spots[info.get(tid, ('', '', 'mid'))[2] or 'mid'] += 1
        mids = [r for w in weeks for tid, r in polls[w].items() if (info.get(tid, ('', '', ''))[2] == 'mid')]
        best_mid.append(min(mids) if mids else None)
        # NCAA seeds
        seeds = {}
        for g in games:
            if g['kind'] != 'ncaa': continue
            for s in ('home', 'away'):
                if int(g[s + '_rank']): seeds[g[s + '_id']] = min(seeds.get(g[s + '_id'], 99), int(g[s + '_rank']))
        if seeds:
            top4 = [t for t, r in fin.items() if r <= 4]
            seed_top4[0] += sum(1 for t in top4 if seeds.get(t) == 1); seed_top4[1] += len(top4)
            for t, r in fin.items():
                if t in seeds: seed_gap.append(seeds[t] - math.ceil(r / 4))
            one_seeds_ranked += [fin.get(t, 26) for t, s in seeds.items() if s == 1]
    R['preseason'] = {
        'preseason_top25_finish_ranked_pct': round(100 * sum(pre_hit) / len(pre_hit), 1),
        'preseason_top5_finish_top10_pct': round(100 * sum(pre_top5) / len(pre_top5), 1),
        'spearman_pre_vs_final_by_season': [round(x, 2) for x in pre_corr],
        'abs_rank_change_pre_to_final': summ([abs(a - b) for a, b in pre_final]),
        'blueblood_starts_ranked': {b: '%d of %d' % (blue_start[b], blue_seasons) for b in BLUE},
    }
    R['losses'] = {' '.join(k): summ(v) for k, v in sorted(loss_drop.items())}
    R['dropout_after_one_loss_pct'] = {k: '%.1f (%d of %d)' % (100 * v[1] / max(1, v[0]), v[1], v[0]) for k, v in dropout.items()}
    R['unbeaten_climb_per_winning_week'] = {k: summ(v) for k, v in sorted(unb_climb.items())}
    R['unbeaten_climb_by_tier'] = {'%s %s' % k: summ(v) for k, v in sorted(unb_tier.items())}
    R['all_winning_week_climb'] = {k: summ(v) for k, v in sorted(win_climb.items())}
    R['churn_new_teams_per_week'] = summ(churn)
    R['no1_changes'] = {'weeks_compared': no1_weeks, 'changes': no1_changes, 'pct_of_weeks': round(100 * no1_changes / max(1, no1_weeks), 1), 'per_season': no1_per_season}
    tot = sum(tier_spots.values())
    R['top25_share_by_tier_pct'] = {k: round(100 * v / tot, 1) for k, v in tier_spots.items()}
    R['best_midmajor_rank_by_season'] = dict(zip([str(s) for s in seasons], best_mid))
    R['final_poll_vs_seeds'] = {'final_top4_that_are_1_seeds': '%d of %d' % tuple(seed_top4),
        'seed_minus_expected_line': summ(seed_gap), 'final_rank_of_1_seeds': summ(one_seeds_ranked)}
    print(json.dumps(R, indent=1))
    if out: json.dump(R, open(out, 'w'), indent=1)

def spearman(pairs):
    a = [p[0] for p in pairs]; b = [p[1] for p in pairs]
    def rk(x):
        s = sorted(range(len(x)), key=lambda i: x[i]); r = [0] * len(x)
        i = 0
        while i < len(s):
            j = i
            while j + 1 < len(s) and x[s[j + 1]] == x[s[i]]: j += 1
            for k in range(i, j + 1): r[s[k]] = (i + j) / 2
            i = j + 1
        return r
    ra, rb = rk(a), rk(b)
    ma, mb = stt.mean(ra), stt.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den if den else 0

if __name__ == '__main__':
    main(*sys.argv[1:3])
