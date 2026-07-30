import random


def randomize_round1(players):
    """Randomly pair 32 players into 16 matches. players can be list of dicts or list of IDs."""
    if len(players) != 32:
        raise ValueError(f"需要恰好32人，当前 {len(players)} 人")
    # Extract IDs if players are dicts
    ids = [(p['id'] if isinstance(p, dict) else p) for p in players]
    shuffled = ids[:]
    random.shuffle(shuffled)
    matches = []
    for i in range(16):
        matches.append({
            'p1': shuffled[i * 2],
            'p2': shuffled[i * 2 + 1],
            'score1': 0,
            'score2': 0,
            'winner': None,
            'loser': None
        })
    return matches


def advance_winner(match, winner_id, bracket_type, round_key):
    """Advance winner to next round, track loser. Returns (updated_match, loser_id)."""
    updated = match.copy()
    updated['winner'] = winner_id
    updated['loser'] = match['p2'] if winner_id == match['p1'] else match['p1']
    return updated, updated['loser']


def _empty_match():
    return {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None}


def create_bracket(player_ids):
    """Create a full single-elimination bracket for given players (8 players → R16/R8/R4/Final)."""
    n = len(player_ids)
    r16 = []
    for i in range(0, n, 2):
        r16.append({
            'p1': player_ids[i],
            'p2': player_ids[i + 1] if i + 1 < n else None,
            'score1': 0,
            'score2': 0,
            'winner': None
        })
    return {
        'r16': r16,
        'r8': [_empty_match() for _ in range(4)],
        'r4': [_empty_match() for _ in range(2)],
        'final': _empty_match()
    }


def advance_bracket_winner(bracket, round_key, match_idx, winner_id):
    """Advance winner to next round in a bracket (winners/losers). Modifies bracket in-place."""
    if round_key == 'final':
        match = bracket['final']
    else:
        match = bracket[round_key][match_idx]
    match['winner'] = winner_id
    match['loser'] = match['p2'] if winner_id == match['p1'] else match['p1']

    if round_key == 'r16':
        next_idx = match_idx // 2
        if match_idx % 2 == 0:
            bracket['r8'][next_idx]['p1'] = winner_id
        else:
            bracket['r8'][next_idx]['p2'] = winner_id
    elif round_key == 'r8':
        next_idx = match_idx // 2
        if match_idx % 2 == 0:
            bracket['r4'][next_idx]['p1'] = winner_id
        else:
            bracket['r4'][next_idx]['p2'] = winner_id
    elif round_key == 'r4':
        if match_idx == 0:
            bracket['final']['p1'] = winner_id
        else:
            bracket['final']['p2'] = winner_id
    elif round_key == 'final':
        bracket['champion'] = winner_id


def advance_final8_winner(final8, round_key, match_idx, winner_id):
    """Advance winner to next round in the final 8 bracket. Modifies final8 in-place."""
    if round_key == 'final':
        match = final8['final']
    else:
        match = final8[round_key][match_idx]
    match['winner'] = winner_id

    if round_key == 'qf':
        next_idx = match_idx // 2
        if match_idx % 2 == 0:
            final8['sf'][next_idx]['p1'] = winner_id
        else:
            final8['sf'][next_idx]['p2'] = winner_id
    elif round_key == 'sf':
        if match_idx == 0:
            final8['final']['p1'] = winner_id
        else:
            final8['final']['p2'] = winner_id
    elif round_key == 'final':
        final8['champion'] = winner_id


def shuffle_top8(winners_top4, losers_top4):
    """Randomly pair winners bracket top 4 with losers bracket top 4. Returns full bracket dict."""
    w = winners_top4[:]
    l = losers_top4[:]
    random.shuffle(w)
    random.shuffle(l)
    qf = []
    for i in range(4):
        qf.append({
            'p1': w[i],
            'p2': l[i],
            'score1': 0,
            'score2': 0,
            'winner': None
        })
    return {
        'qf': qf,
        'sf': [_empty_match() for _ in range(2)],
        'final': _empty_match()
    }


def create_grand_final_match(winner_champ, loser_champ):
    """Create grand final match between bracket champions."""
    return {
        'p1': winner_champ,
        'p2': loser_champ,
        'score1': 0,
        'score2': 0,
        'winner': None
    }
