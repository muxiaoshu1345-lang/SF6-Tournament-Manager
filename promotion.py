def advance_group1_winner(group, match_key, winner_id):
    """小组赛第一轮：选胜者后自动推进到下一场"""
    bracket = group['bracket']

    if match_key == 'r1_0':
        bracket['r1'][0]['winner'] = winner_id
        loser = bracket['r1'][0]['p2'] if winner_id == bracket['r1'][0]['p1'] else bracket['r1'][0]['p1']
        bracket['wr1']['p1'] = winner_id
        bracket['lr1']['p1'] = loser
    elif match_key == 'r1_1':
        bracket['r1'][1]['winner'] = winner_id
        loser = bracket['r1'][1]['p2'] if winner_id == bracket['r1'][1]['p1'] else bracket['r1'][1]['p1']
        bracket['wr1']['p2'] = winner_id
        bracket['lr1']['p2'] = loser
    elif match_key == 'wr1':
        bracket['wr1']['winner'] = winner_id
        loser = bracket['wr1']['p2'] if winner_id == bracket['wr1']['p1'] else bracket['wr1']['p1']
        group['first'] = winner_id
        bracket['lr2']['p2'] = loser
    elif match_key == 'lr1':
        bracket['lr1']['winner'] = winner_id
        bracket['lr2']['p1'] = winner_id
    elif match_key == 'lr2':
        bracket['lr2']['winner'] = winner_id
        group['second'] = winner_id


def update_elimination_match(bracket, round_key, match_idx, winner_id):
    """淘汰赛：选胜者后推进到下一轮"""
    if round_key == 'r16':
        match = bracket['r16'][match_idx]
        match['winner'] = winner_id
        next_idx = match_idx // 2
        if match_idx % 2 == 0:
            bracket['r8'][next_idx]['p1'] = winner_id
        else:
            bracket['r8'][next_idx]['p2'] = winner_id
    elif round_key == 'r8':
        match = bracket['r8'][match_idx]
        match['winner'] = winner_id
        next_idx = match_idx // 2
        if match_idx % 2 == 0:
            bracket['r4'][next_idx]['p1'] = winner_id
        else:
            bracket['r4'][next_idx]['p2'] = winner_id
    elif round_key == 'r4':
        match = bracket['r4'][match_idx]
        match['winner'] = winner_id
        if match_idx == 0:
            bracket['final']['p1'] = winner_id
        else:
            bracket['final']['p2'] = winner_id
    elif round_key == 'final':
        bracket['final']['winner'] = winner_id


def check_stage1_complete(groups):
    """检查小组赛第一轮是否全部完成"""
    return all(g['first'] and g['second'] for g in groups)


def check_stage2_complete(groups):
    """检查小组赛第二轮是否全部完成"""
    return all(g['first'] for g in groups)
