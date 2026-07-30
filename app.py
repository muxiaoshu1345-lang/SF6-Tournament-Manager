from flask import Flask, render_template, jsonify, request, send_file
import json
import os
import copy
import random
import io
from randomizer import randomize_group_stage1, randomize_group_stage2, randomize_elimination
from promotion import advance_group1_winner, update_elimination_match, check_stage1_complete, check_stage2_complete

app = Flask(__name__)
DATA_FILE = os.path.join(os.path.dirname(__file__), 'tournament_data.json')

def next_id(items, prefix):
    """Find the next available ID with the given prefix."""
    existing = set()
    for item in items:
        try:
            existing.add(int(item['id'].split('_', 1)[1]))
        except (ValueError, IndexError):
            pass
    n = max(existing, default=-1) + 1
    return f'{prefix}_{n}'

# --- State Management ---
def default_state():
    return {
        'players': [],
        'pools': [],
        'groupStage1': {'locked': False, 'groups': []},
        'groupStage2': {'locked': False, 'groups': []},
        'elimination': {'locked': False, 'bracket': {'r16': [], 'r8': [], 'r4': [], 'final': {}}},
        'history': [],
        'historyIndex': -1
    }

state = default_state()

def save_state():
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state():
    global state
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
    # Initialize history with current state so undo has a baseline
    if not state.get('history'):
        state['history'] = []
        state['historyIndex'] = -1
        push_history()

def push_history():
    """Save current state to history. Call AFTER making changes."""
    state['history'] = state['history'][:state['historyIndex'] + 1]
    state['history'].append(copy.deepcopy({k: v for k, v in state.items() if k not in ('history', 'historyIndex')}))
    if len(state['history']) > 50:
        state['history'].pop(0)
    state['historyIndex'] = len(state['history']) - 1
    save_state()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    data = {k: v for k, v in state.items() if k not in ('history', 'historyIndex')}
    data['historyIndex'] = state.get('historyIndex', -1)
    data['historyLen'] = len(state.get('history', []))
    return jsonify(data)

@app.route('/api/undo', methods=['POST'])
def undo():
    if state['historyIndex'] > 0:
        state['historyIndex'] -= 1
        snapshot = state['history'][state['historyIndex']]
        for k, v in snapshot.items():
            state[k] = copy.deepcopy(v)
        save_state()
    return jsonify({'ok': True, 'historyIndex': state['historyIndex'], 'historyLen': len(state['history'])})

@app.route('/api/redo', methods=['POST'])
def redo():
    if state['historyIndex'] < len(state['history']) - 1:
        state['historyIndex'] += 1
        snapshot = state['history'][state['historyIndex']]
        for k, v in snapshot.items():
            state[k] = copy.deepcopy(v)
        save_state()
    return jsonify({'ok': True, 'historyIndex': state['historyIndex'], 'historyLen': len(state['history'])})

@app.route('/api/export')
def export_data():
    data = json.dumps({k: v for k, v in state.items() if k not in ('history', 'historyIndex')}, ensure_ascii=False, indent=2)
    return send_file(io.BytesIO(data.encode('utf-8')), mimetype='application/json', as_attachment=True, download_name='tournament_data.json')

@app.route('/api/import', methods=['POST'])
def import_data():
    global state
    file = request.files.get('file')
    if file:
        imported = json.load(file)
        state = default_state()
        for k, v in imported.items():
            if k in state:
                state[k] = v
        ensure_default_pool()
        push_history()
    return jsonify({'ok': True})

@app.route('/api/pools', methods=['POST'])
def manage_pools():
    data = request.json
    action = data.get('action')
    if action == 'create':
        state['pools'].append({'id': data['id'], 'name': data['name']})
    elif action == 'delete':
        pool_id = data['id']
        if pool_id == 'pool_default':
            return jsonify({'ok': False, 'error': '默认池不能删除'}), 400
        state['pools'] = [p for p in state['pools'] if p['id'] != pool_id]
        for p in state['players']:
            if p['poolId'] == pool_id:
                p['poolId'] = None
    elif action == 'rename':
        for p in state['pools']:
            if p['id'] == data['id']:
                p['name'] = data['name']
    push_history()
    return jsonify({'ok': True})

@app.route('/api/players', methods=['POST'])
def manage_players():
    data = request.json
    action = data.get('action')
    if action == 'add':
        if any(p['name'] == data['name'] for p in state['players']):
            return jsonify({'ok': False, 'error': f'选手 "{data["name"]}" 已存在'}), 400
        state['players'].append({'id': data['id'], 'name': data['name'], 'poolId': data.get('poolId')})
    elif action == 'delete':
        state['players'] = [p for p in state['players'] if p['id'] != data['id']]
    elif action == 'assign_pool':
        for p in state['players']:
            if p['id'] == data['id']:
                p['poolId'] = data['poolId']
    elif action == 'import_csv':
        # data['lines'] = [[name], ...] — one player name per line
        ensure_default_pool()
        default_pool_id = next((p['id'] for p in state['pools'] if p['name'] == '默认池'), 'pool_default')
        existing_names = {p['name'] for p in state['players']}
        skipped = 0
        for line in data['lines']:
            name = line[0].strip() if isinstance(line, list) else line.strip()
            if not name or name in existing_names:
                if name in existing_names:
                    skipped += 1
                continue
            existing_names.add(name)
            pid = next_id(state['players'], 'p')
            state['players'].append({'id': pid, 'name': name, 'poolId': default_pool_id})
        if skipped > 0:
            push_history()
            return jsonify({'ok': True, 'skipped': skipped, 'message': f'跳过 {skipped} 个重名选手'})
    push_history()
    return jsonify({'ok': True})

@app.route('/api/player/rename', methods=['POST'])
def rename_player():
    data = request.json
    new_name = data['name']
    player_id = data['id']
    if any(p['name'] == new_name and p['id'] != player_id for p in state['players']):
        return jsonify({'ok': False, 'error': f'选手 "{new_name}" 已存在'}), 400
    for p in state['players']:
        if p['id'] == player_id:
            p['name'] = new_name
    push_history()
    return jsonify({'ok': True})

@app.route('/api/randomize', methods=['POST'])
def randomize():
    """随机分组（预览状态，不锁定）"""
    data = request.json
    stage = data.get('stage')
    try:
        if stage == 'group1':
            groups = randomize_group_stage1(state['players'], state['pools'])
            state['groupStage1']['groups'] = groups
            state['groupStage1']['locked'] = False
        elif stage == 'group2':
            seconds = [g['second'] for g in state['groupStage1']['groups'] if g['second']]
            groups = randomize_group_stage2(seconds)
            state['groupStage2']['groups'] = groups
            state['groupStage2']['locked'] = False
        elif stage == 'elimination':
            firsts1 = [g['first'] for g in state['groupStage1']['groups'] if g['first']]
            firsts2 = [g['first'] for g in state['groupStage2']['groups'] if g['first']]
            all_players = firsts1 + firsts2
            r16_matches = randomize_elimination(all_players)
            empty_match = lambda: {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None}
            state['elimination']['bracket'] = {
                'r16': r16_matches,
                'r8': [empty_match() for _ in range(4)],
                'r4': [empty_match() for _ in range(2)],
                'final': empty_match()
            }
            state['elimination']['locked'] = False
        push_history()
        return jsonify({'ok': True})
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

@app.route('/api/confirm_groups', methods=['POST'])
def confirm_groups():
    """确认分组，锁定状态"""
    data = request.json
    stage = data.get('stage')
    push_history()
    if stage == 'group1':
        state['groupStage1']['locked'] = True
    elif stage == 'group2':
        state['groupStage2']['locked'] = True
    elif stage == 'elimination':
        state['elimination']['locked'] = True
    save_state()
    return jsonify({'ok': True})

@app.route('/api/move_player', methods=['POST'])
def move_player():
    """在预览状态下移动选手到其他组"""
    data = request.json
    stage = data.get('stage')
    player_id = data.get('playerId')
    from_group_idx = data.get('fromGroup')
    to_group_idx = data.get('toGroup')
    push_history()

    if stage == 'group1':
        groups = state['groupStage1']['groups']
        groups[from_group_idx]['playerIds'].remove(player_id)
        groups[to_group_idx]['playerIds'].append(player_id)
        # 重置对阵数据
        for g in [groups[from_group_idx], groups[to_group_idx]]:
            pids = g['playerIds']
            g['bracket'] = {
                'r1': [
                    {'p1': pids[0], 'p2': pids[1], 'score1': 0, 'score2': 0, 'winner': None},
                    {'p1': pids[2], 'p2': pids[3], 'score1': 0, 'score2': 0, 'winner': None}
                ],
                'wr1': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None},
                'lr1': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None},
                'lr2': {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None}
            }
            g['first'] = None
            g['second'] = None
    elif stage == 'group2':
        groups = state['groupStage2']['groups']
        player = None
        for p in groups[from_group_idx]['players']:
            if p['playerId'] == player_id:
                player = p
                break
        groups[from_group_idx]['players'] = [p for p in groups[from_group_idx]['players'] if p['playerId'] != player_id]
        groups[to_group_idx]['players'].append(player)
        groups[to_group_idx]['first'] = None

    save_state()
    return jsonify({'ok': True})

@app.route('/api/match/result', methods=['POST'])
def match_result():
    data = request.json
    stage = data['stage']

    if stage == 'group1':
        group = state['groupStage1']['groups'][data['groupIdx']]
        match_key = data['matchKey']
        winner = data['winner']
        # 更新比分
        if match_key.startswith('r1_'):
            idx = int(match_key.split('_')[1])
            group['bracket']['r1'][idx]['score1'] = data.get('score1', 0)
            group['bracket']['r1'][idx]['score2'] = data.get('score2', 0)
        else:
            group['bracket'][match_key]['score1'] = data.get('score1', 0)
            group['bracket'][match_key]['score2'] = data.get('score2', 0)
        advance_group1_winner(group, match_key, winner)

    elif stage == 'elimination':
        bracket = state['elimination']['bracket']
        round_key = data['roundKey']
        match_idx = data['matchIdx']
        if round_key == 'final':
            bracket['final']['score1'] = data.get('score1', 0)
            bracket['final']['score2'] = data.get('score2', 0)
        else:
            bracket[round_key][match_idx]['score1'] = data.get('score1', 0)
            bracket[round_key][match_idx]['score2'] = data.get('score2', 0)
        update_elimination_match(bracket, round_key, match_idx, data['winner'])

    push_history()
    return jsonify({'ok': True})

@app.route('/api/ranking', methods=['POST'])
def update_ranking():
    data = request.json
    group_idx = data['groupIdx']
    group = state['groupStage2']['groups'][group_idx]
    group['players'] = data['players']
    group['first'] = group['players'][0]['playerId']
    push_history()
    return jsonify({'ok': True})

@app.route('/api/reset_elimination', methods=['POST'])
def reset_elimination():
    state['elimination'] = {'locked': False, 'bracket': {'r16': [], 'r8': [], 'r4': [], 'final': {}}}
    push_history()
    return jsonify({'ok': True})

def ensure_default_pool():
    """Ensure the default pool exists."""
    if not any(p['name'] == '默认池' for p in state['pools']):
        state['pools'].append({'id': 'pool_default', 'name': '默认池'})

load_state()
ensure_default_pool()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
