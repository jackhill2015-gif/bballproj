# Fetch each regular-season game's AP ranks (as ESPN shows them at game time)
# from the sportsdataverse hoopR-mbb-raw per-game JSON. Only the head of each
# file is downloaded (byte range): the "header" block with both teams' ranks
# sits before the play-by-play in the raw/ variant.
#   python fetch_espn_ranks.py <schedule.csv> <out.csv>
import csv, os, re, ssl, sys, urllib.request, concurrent.futures as cf

URL = 'https://raw.githubusercontent.com/sportsdataverse/hoopR-mbb-raw/main/mbb/json/raw/{}.json'
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
COMP = re.compile(r'"id": "(\d+)",\s*"uid": "s:40~l:41~t:\d+",\s*"order": \d+,\s*"homeAway": "(home|away)"')
RANK = re.compile(r'"rank": (\d+)')

def get(gid, lo, hi):
    req = urllib.request.Request(URL.format(gid), headers={'Range': 'bytes=%d-%d' % (lo, hi)})
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')

def parse(s):
    h = s.find('"header": {')
    if h < 0: return None
    body = s[h:]
    end = body.find('"status": {')  # competitors end before the game status block
    if end < 0: return None
    body = body[:end]
    comps = list(COMP.finditer(body))
    if len(comps) < 2: return None
    out = {}
    for i, m in enumerate(comps):
        seg = body[m.end(): comps[i + 1].start() if i + 1 < len(comps) else len(body)]
        rk = RANK.search(seg)
        out[m.group(2)] = (m.group(1), int(rk.group(1)) if rk else 0)
    return out

def one(gid):
    for lo, hi in ((0, 140000), (0, 420000), (0, 2000000)):
        try:
            res = parse(get(gid, lo, hi))
        except Exception as e:
            res = None
        if res and 'home' in res and 'away' in res:
            return gid, res
    return gid, None

def main(sched, out):
    rows = [r for r in csv.DictReader(open(sched)) if r['status_type_completed'] in ('TRUE', 'True', 'true')]
    if os.environ.get('NCAA'):  # NCAA tournament games only: ESPN's rank there is the seed
        rows = [r for r in rows if r['season_type'] == '3' and "men's basketball championship" in (r.get('notes_headline') or '').lower()]
    else:
        rows = [r for r in rows if r['season_type'] == '2']
    gids = [r['game_id'] for r in rows]
    with open(out, 'w', newline='') as f, cf.ThreadPoolExecutor(24) as ex:
        w = csv.writer(f); w.writerow(['game_id', 'home_id', 'home_rank', 'away_id', 'away_rank'])
        miss = 0
        for i, (gid, res) in enumerate(ex.map(one, gids)):
            if not res: miss += 1; w.writerow([gid, '', '', '', '']); continue
            w.writerow([gid, res['home'][0], res['home'][1], res['away'][0], res['away'][1]])
            if i % 500 == 0: print(sched.split('/')[-1], i, 'of', len(gids), 'missing', miss, flush=True)
    print('done', out, 'games', len(gids), 'missing', miss, flush=True)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
