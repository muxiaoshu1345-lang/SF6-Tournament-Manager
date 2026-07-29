from flask import Flask, render_template, jsonify, request, send_file
import json
import os
import copy
import random
import io

app = Flask(__name__)
DATA_FILE = os.path.join(os.path.dirname(__file__), 'tournament_data.json')

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

def push_history():
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
    return jsonify({k: v for k, v in state.items() if k not in ('history', 'historyIndex')})

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
    push_history()
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
    save_state()
    return jsonify({'ok': True})

@app.route('/api/players', methods=['POST'])
def manage_players():
    data = request.json
    action = data.get('action')
    push_history()
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
                pool_id = f'pool_{len(state["pools"])}'
                state['pools'].append({'id': pool_id, 'name': pool_name})
                pool_name_map[pool_name] = pool_id
            pool_id = pool_name_map.get(pool_name)
            pid = f'p_{len(state["players"])}'
            state['players'].append({'id': pid, 'name': name, 'poolId': pool_id})
    save_state()
    return jsonify({'ok': True})

@app.route('/api/player/rename', methods=['POST'])
def rename_player():
    data = request.json
    push_history()
    for p in state['players']:
        if p['id'] == data['id']:
            p['name'] = data['name']
    save_state()
    return jsonify({'ok': True})

load_state()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
