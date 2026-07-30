import random


def randomize_round1(players):
    """Randomly pair 32 players into 16 matches."""
    if len(players) != 32:
        raise ValueError(f"需要恰好32人，当前 {len(players)} 人")
    shuffled = players[:]
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
    """Advance winner to next round, track loser."""
    match['winner'] = winner_id
    match['loser'] = match['p2'] if winner_id == match['p1'] else match['p1']
    return match['loser']


def create_bracket(player_ids):
    """Create a single-elimination bracket for given players."""
    n = len(player_ids)
    matches = []
    for i in range(0, n, 2):
        matches.append({
            'p1': player_ids[i],
            'p2': player_ids[i + 1] if i + 1 < n else None,
            'score1': 0,
            'score2': 0,
            'winner': None
        })
    return matches


def shuffle_top8(winners_top4, losers_top4):
    """Randomly pair winners bracket top 4 with losers bracket top 4."""
    w = winners_top4[:]
    l = losers_top4[:]
    random.shuffle(w)
    random.shuffle(l)
    matches = []
    for i in range(4):
        matches.append({
            'p1': w[i],
            'p2': l[i],
            'score1': 0,
            'score2': 0,
            'winner': None
        })
    return matches


def create_grand_final_match(winner_champ, loser_champ):
    """Create grand final match between bracket champions."""
    return {
        'p1': winner_champ,
        'p2': loser_champ,
        'score1': 0,
        'score2': 0,
        'winner': None
    }
