"""Descriptive self-comparisons; never a rank estimate or causal diagnosis."""
import math
from statistics import mean

METRICS = [
    ('Economy', 'net_worth', 1, 7, 'End net worth / minute', 'Review three farming routes. Record travel time and the wave or objective you intended to reach.'),
    ('Survival', 'player_deaths', -1, 14, 'Deaths / 10 minutes', 'Review three deaths, starting 20 seconds earlier. Note visible threats, available cover, and an alternative exit.'),
    ('Kills', 'player_kills', 1, 16, 'Kills / 10 minutes', 'Review three fights for target choice and useful damage. Do not chase kills to raise this number.'),
    ('Assists', 'player_assists', 1, 13, 'Assists / 10 minutes', 'Review three team fights. Identify your intended role and whether arriving changed the fight.'),
    ('Denies', 'denies', 1, 1, 'Denies / 10 minutes', 'Practice contested soul confirms and denies, then review missed opportunities during lane.')
]

def number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and x >= 0

def cohorts(matches):
    return sorted({(str(m['summary'].get('hero_id')), str(m['summary'].get('game_mode')), str(m['summary'].get('match_mode'))) for m in matches})

def analyze(matches, cohort, window=10):
    rows=[m['summary'] for m in matches if tuple(str(m['summary'].get(k)) for k in ('hero_id','game_mode','match_mode')) == tuple(cohort) and m['summary'].get('player_match_outcome') in (1,2)]
    rows.sort(key=lambda s:s.get('start_time') or 0,reverse=True)
    recent,previous=rows[:window],rows[window:window*2]
    result={'recent':recent,'previous':previous,'total':len(rows),'metrics':[], 'priorities':[], 'strengths':[]}
    for label,key,direction,lesson,title,drill in METRICS:
        def values(group):
            return [s[key] / s['match_duration_s'] * (60 if key=='net_worth' else 600) for s in group if number(s.get(key)) and number(s.get('match_duration_s')) and s['match_duration_s']>0]
        a,b=values(recent),values(previous)
        av,bv=mean(a) if a else None,mean(b) if b else None
        ready=len(a)>=5 and len(b)>=5
        delta=av-bv if ready else None
        pct=(delta/bv*100) if ready and bv>0 else None
        # 10% is a coaching attention rule, not statistical significance.
        signal=pct*direction if pct is not None else None
        item=dict(label=label,title=title,recent=av,previous=bv,n=len(a),baseline_n=len(b),delta=delta,pct=pct,lesson=lesson,drill=drill,signal=signal)
        result['metrics'].append(item)
        if signal is not None and signal<=-10:result['priorities'].append(item)
        if signal is not None and signal>=10:result['strengths'].append(item)
    result['priorities'].sort(key=lambda x:x['signal'])
    result['strengths'].sort(key=lambda x:-x['signal'])
    return result
