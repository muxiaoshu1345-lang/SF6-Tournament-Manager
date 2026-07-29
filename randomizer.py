import random


def randomize_group_stage1(players, pools):
    """小组赛第一轮随机：池内随机分组，每组4人"""
    pool_players = {}
    for p in players:
        pid = p['poolId'] or 'unassigned'
        pool_players.setdefault(pid, []).append(p['id'])

    groups = []
    group_idx = 0
    for pool in pools:
        pid = pool['id']
        pl = pool_players.get(pid, [])
        if len(pl) % 4 != 0:
            raise ValueError(f"池 {pool['name']} 人数 {len(pl)} 不是4的倍数")
        random.shuffle(pl)
        for i in range(0, len(pl), 4):
            groups.append({
                'id': f'g1_{group_idx}',
                'playerIds': pl[i:i+4],
                'bracket': {
                    'r1': [
                        {'p1': pl[i], 'p2': pl[i+1], 'score1': 0, 'score2': 0, 'winner': None},
                        {'p1': pl[i+2], 'p2': pl[i+3], 'score1': 0, 'score2': 0, 'winner': None}
                    ],
                    'wr1': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None},
                    'lr1': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None},
                    'lr2': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None}
                },
                'first': None,
                'second': None
            })
            group_idx += 1
    unassigned = pool_players.get('unassigned', [])
    if unassigned:
        raise ValueError(f"有 {len(unassigned)} 名选手未分配池")
    return groups


def randomize_group_stage2(player_ids):
    """小组赛第二轮随机：12人分4组×3人"""
    if len(player_ids) != 12:
        raise ValueError(f"小组赛第二轮需要恰好12人，当前 {len(player_ids)} 人")
    shuffled = player_ids[:]
    random.shuffle(shuffled)
    groups = []
    for i in range(4):
        pids = shuffled[i*3:(i+1)*3]
        groups.append({
            'id': f'g2_{i}',
            'playerIds': pids,
            'players': [{'playerId': pid, 'wins': 0, 'losses': 0} for pid in pids],
            'first': None
        })
    return groups


def randomize_elimination(player_ids):
    """淘汰赛随机签位：16人分配到8场比赛"""
    if len(player_ids) != 16:
        raise ValueError(f"淘汰赛需要恰好16人，当前 {len(player_ids)} 人")
    shuffled = player_ids[:]
    random.shuffle(shuffled)
    matches = []
    for i in range(8):
        matches.append({
            'p1': shuffled[i*2],
            'p2': shuffled[i*2+1],
            'score1': 0,
            'score2': 0,
            'winner': None
        })
    return matches
