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
        state['players'].append({'id': data['id'], 'name': data['name'], 'poolId': data.get('poolId')})
    elif action == 'delete':
        state['players'] = [p for p in state['players'] if p['id'] != data['id']]
    elif action == 'assign_pool':
        for p in state['players']:
            if p['id'] == data['id']:
                p['poolId'] = data['poolId']
    elif action == 'import_csv':
        # data['lines'] = [[name, pool_name], ...]
        pool_name_map = {pn['name']: pn['id'] for pn in state['pools']}
        for line in data['lines']:
            name = line[0].strip()
            pool_name = line[1].strip() if len(line) > 1 else ''
            if pool_name and pool_name not in pool_name_map:
                pool_id = next_id(state['pools'], 'pool')
                state['pools'].append({'id': pool_id, 'name': pool_name})
                pool_name_map[pool_name] = pool_id
            pool_id = pool_name_map.get(pool_name)
            pid = next_id(state['players'], 'p')
            state['players'].append({'id': pid, 'name': name, 'poolId': pool_id})
    push_history()
    return jsonify({'ok': True})

@app.route('/api/player/rename', methods=['POST'])
def rename_player():
    data = request.json
    for p in state['players']:
        if p['id'] == data['id']:
            p['name'] = data['name']
    push_history()
    return jsonify({'ok': True})

@app.route('/api/randomize', methods=['POST'])
def randomize():
    data = request.json
    stage = data.get('stage')
    try:
        if stage == 'group1':
            groups = randomize_group_stage1(state['players'], state['pools'])
            state['groupStage1']['groups'] = groups
            state['groupStage1']['locked'] = True
        elif stage == 'group2':
            # 收集第一轮所有第二名
            seconds = [g['second'] for g in state['groupStage1']['groups'] if g['second']]
            groups = randomize_group_stage2(seconds)
            state['groupStage2']['groups'] = groups
            state['groupStage2']['locked'] = True
        elif stage == 'elimination':
            # 收集所有晋级者
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
            state['elimination']['locked'] = True
        push_history()
        return jsonify({'ok': True})
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

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

load_state()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
