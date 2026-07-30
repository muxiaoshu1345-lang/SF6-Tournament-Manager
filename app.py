from flask import Flask, render_template, jsonify, request, send_file
import json
import os
import sys
import copy
import random
import io
from randomizer import randomize_group_stage1, randomize_group_stage2, randomize_elimination
from promotion import advance_group1_winner, update_elimination_match, check_stage1_complete, check_stage2_complete

app = Flask(__name__)
# 数据文件位置：优先使用当前工作目录，否则使用脚本所在目录
if getattr(sys, 'frozen', False):
    # PyInstaller打包后，使用exe所在目录
    DATA_FILE = os.path.join(os.path.dirname(sys.executable), 'tournament_data.json')
else:
    DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tournament_data.json')

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
        'current_format': 'cpt',
        'cpt': {
            'players': [],
            'pools': [],
            'groupStage1': {'locked': False, 'groups': []},
            'groupStage2': {'locked': False, 'groups': []},
            'elimination': {'locked': False, 'bracket': {'r16': [], 'r8': [], 'r4': [], 'final': {}}},
            'history': [],
            'historyIndex': -1
        },
        'double_elim_32': {
            'players': [],
            'shuffle_top8': False,
            'locked': False,
            'stage': 'setup',
            'round1': {'matches': []},
            'winners': {'players': [], 'r16': [], 'r8': [], 'r4': [], 'champion': None},
            'losers': {'players': [], 'r16': [], 'r8': [], 'r4': [], 'champion': None},
            'final_8': {'players': [], 'qf': [], 'sf': [], 'final': {}, 'champion': None},
            'grand_final': {'winner_champ': None, 'loser_champ': None, 'match': {}, 'champion': None},
            'history': [],
            'historyIndex': -1
        }
    }

state = default_state()

def current_state():
    """Return the state dict for the currently active format."""
    format_key = state.get('current_format', 'cpt')
    return state[format_key]

def save_state():
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def load_state():
    global state
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            loaded = json.load(f)
            # Migration: if old format, wrap in new structure
            if 'current_format' not in loaded:
                state = default_state()
                state['cpt'] = loaded
            else:
                state = loaded
    # Initialize history with current state so undo has a baseline
    fs = current_state()
    if not fs.get('history'):
        fs['history'] = []
        fs['historyIndex'] = -1
        push_history()

def push_history():
    """Save current format state to history. Call AFTER making changes."""
    fs = current_state()
    fs['history'] = fs['history'][:fs['historyIndex'] + 1]
    fs['history'].append(copy.deepcopy({k: v for k, v in fs.items() if k not in ('history', 'historyIndex')}))
    if len(fs['history']) > 50:
        fs['history'].pop(0)
    fs['historyIndex'] = len(fs['history']) - 1
    save_state()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    format_key = state.get('current_format', 'cpt')
    format_state = state.get(format_key, {})
    data = {k: v for k, v in format_state.items() if k not in ('history', 'historyIndex')}
    data['current_format'] = format_key
    data['historyIndex'] = format_state.get('historyIndex', -1)
    data['historyLen'] = len(format_state.get('history', []))
    return jsonify(data)

@app.route('/api/switch_format', methods=['POST'])
def switch_format():
    data = request.json
    new_format = data.get('format')
    if new_format not in ('cpt', 'double_elim_32'):
        return jsonify({'ok': False, 'error': 'Invalid format'}), 400
    state['current_format'] = new_format
    save_state()
    return jsonify({'ok': True, 'current_format': new_format})

@app.route('/api/undo', methods=['POST'])
def undo():
    fs = current_state()
    if fs['historyIndex'] > 0:
        fs['historyIndex'] -= 1
        snapshot = fs['history'][fs['historyIndex']]
        for k, v in snapshot.items():
            fs[k] = copy.deepcopy(v)
        save_state()
    return jsonify({'ok': True, 'historyIndex': fs['historyIndex'], 'historyLen': len(fs['history'])})

@app.route('/api/redo', methods=['POST'])
def redo():
    fs = current_state()
    if fs['historyIndex'] < len(fs['history']) - 1:
        fs['historyIndex'] += 1
        snapshot = fs['history'][fs['historyIndex']]
        for k, v in snapshot.items():
            fs[k] = copy.deepcopy(v)
        save_state()
    return jsonify({'ok': True, 'historyIndex': fs['historyIndex'], 'historyLen': len(fs['history'])})

@app.route('/api/export')
def export_data():
    fs = current_state()
    data = json.dumps({k: v for k, v in fs.items() if k not in ('history', 'historyIndex')}, ensure_ascii=False, indent=2)
    return send_file(io.BytesIO(data.encode('utf-8')), mimetype='application/json', as_attachment=True, download_name='tournament_data.json')

@app.route('/api/reset', methods=['POST'])
def reset_tournament():
    """重置赛事，备份当前数据"""
    global state
    import shutil
    from datetime import datetime
    # 备份当前数据
    if os.path.exists(DATA_FILE):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(os.path.dirname(__file__), f'tournament_data_backup_{timestamp}.json')
        shutil.copy2(DATA_FILE, backup_file)
    # 重置状态
    state = default_state()
    ensure_default_pool()
    save_state()
    return jsonify({'ok': True, 'message': '已重置，数据已备份'})

@app.route('/api/test_players', methods=['POST'])
def add_test_players():
    """添加48个测试选手到默认池"""
    fs = current_state()
    ensure_default_pool()
    default_pool_id = next((p['id'] for p in fs['pools'] if p['name'] == '默认池'), 'pool_default')
    # 清空现有选手
    fs['players'] = []
    # 48个随机选手名
    names = [
        'Tokido', 'MenaRD', 'Punk', 'NuckleDu', 'Mago', 'Daigo', 'Infiltration', 'Xian',
        'Hibiki', 'Fuudo', 'Itabashi Zangief', 'Haitani', 'Bonchan', 'Sako', 'XiaoHai', 'Dogura',
        'Gachikun', 'Moke', 'Shuto', 'Higuchi', 'Kichipa-mu', 'Aiai', 'DCQ', 'GO1',
        'Problem X', 'Phenom', 'Luffy', 'Valmaster', 'Ryan Hart', 'Infexious', 'Brick', 'Mister Crimson',
        'Caba', 'MenaRD2', 'ElTigre', 'Mono', 'JDR', 'Takamura', 'VegaPatch', 'Shine',
        'ChrisCCH', 'Doomsnake', 'Mickey', 'Humanbomb', 'GamerBee', 'Oil King', 'RB', 'Verloren'
    ]
    for i, name in enumerate(names):
        fs['players'].append({'id': f'p_{i}', 'name': name, 'poolId': default_pool_id})
    push_history()
    return jsonify({'ok': True, 'message': f'已添加 {len(names)} 名测试选手'})

@app.route('/api/import', methods=['POST'])
def import_data():
    global state
    file = request.files.get('file')
    if file:
        imported = json.load(file)
        # If old format (no current_format key), import into current format
        if 'current_format' not in imported:
            fs = current_state()
            for k, v in imported.items():
                if k in fs:
                    fs[k] = v
            ensure_default_pool()
            push_history()
        else:
            # New format: replace entire state
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
    fs = current_state()
    if action == 'create':
        fs['pools'].append({'id': data['id'], 'name': data['name']})
    elif action == 'delete':
        pool_id = data['id']
        if pool_id == 'pool_default':
            return jsonify({'ok': False, 'error': '默认池不能删除'}), 400
        fs['pools'] = [p for p in fs['pools'] if p['id'] != pool_id]
        for p in fs['players']:
            if p['poolId'] == pool_id:
                p['poolId'] = None
    elif action == 'rename':
        for p in fs['pools']:
            if p['id'] == data['id']:
                p['name'] = data['name']
    push_history()
    return jsonify({'ok': True})

@app.route('/api/players', methods=['POST'])
def manage_players():
    data = request.json
    action = data.get('action')
    fs = current_state()
    if action == 'add':
        if any(p['name'] == data['name'] for p in fs['players']):
            return jsonify({'ok': False, 'error': f'选手 "{data["name"]}" 已存在'}), 400
        fs['players'].append({'id': data['id'], 'name': data['name'], 'poolId': data.get('poolId')})
    elif action == 'delete':
        fs['players'] = [p for p in fs['players'] if p['id'] != data['id']]
    elif action == 'assign_pool':
        for p in fs['players']:
            if p['id'] == data['id']:
                p['poolId'] = data['poolId']
    elif action == 'import_csv':
        # data['lines'] = [[name], ...] — one player name per line
        ensure_default_pool()
        default_pool_id = next((p['id'] for p in fs['pools'] if p['name'] == '默认池'), 'pool_default')
        existing_names = {p['name'] for p in fs['players']}
        skipped = 0
        for line in data['lines']:
            name = line[0].strip() if isinstance(line, list) else line.strip()
            if not name or name in existing_names:
                if name in existing_names:
                    skipped += 1
                continue
            existing_names.add(name)
            pid = next_id(fs['players'], 'p')
            fs['players'].append({'id': pid, 'name': name, 'poolId': default_pool_id})
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
    fs = current_state()
    if any(p['name'] == new_name and p['id'] != player_id for p in fs['players']):
        return jsonify({'ok': False, 'error': f'选手 "{new_name}" 已存在'}), 400
    for p in fs['players']:
        if p['id'] == player_id:
            p['name'] = new_name
    push_history()
    return jsonify({'ok': True})

@app.route('/api/randomize', methods=['POST'])
def randomize():
    """随机分组（预览状态，不锁定）"""
    data = request.json
    stage = data.get('stage')
    fs = current_state()
    try:
        if stage == 'group1':
            groups = randomize_group_stage1(fs['players'], fs['pools'])
            fs['groupStage1']['groups'] = groups
            fs['groupStage1']['locked'] = False
        elif stage == 'group2':
            seconds = [g['second'] for g in fs['groupStage1']['groups'] if g['second']]
            groups = randomize_group_stage2(seconds)
            fs['groupStage2']['groups'] = groups
            fs['groupStage2']['locked'] = False
        elif stage == 'elimination':
            firsts1 = [g['first'] for g in fs['groupStage1']['groups'] if g['first']]
            firsts2 = [g['first'] for g in fs['groupStage2']['groups'] if g['first']]
            all_players = firsts1 + firsts2
            r16_matches = randomize_elimination(all_players)
            empty_match = lambda: {'p1': None, 'p2': None, 'score1': 0, 'score2': 0, 'winner': None}
            fs['elimination']['bracket'] = {
                'r16': r16_matches,
                'r8': [empty_match() for _ in range(4)],
                'r4': [empty_match() for _ in range(2)],
                'final': empty_match()
            }
            fs['elimination']['locked'] = False
        push_history()
        return jsonify({'ok': True})
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400

@app.route('/api/confirm_groups', methods=['POST'])
def confirm_groups():
    """确认分组，锁定状态"""
    data = request.json
    stage = data.get('stage')
    fs = current_state()
    push_history()
    if stage == 'group1':
        fs['groupStage1']['locked'] = True
    elif stage == 'group2':
        fs['groupStage2']['locked'] = True
    elif stage == 'elimination':
        fs['elimination']['locked'] = True
    save_state()
    return jsonify({'ok': True})

@app.route('/api/swap_players', methods=['POST'])
def swap_players():
    """在预览状态下交换两个不同组的选手"""
    data = request.json
    stage = data.get('stage')
    player1_id = data.get('player1Id')
    group1_idx = data.get('group1')
    player2_id = data.get('player2Id')
    group2_idx = data.get('group2')
    fs = current_state()
    push_history()

    if stage == 'group1':
        groups = fs['groupStage1']['groups']
        # 交换选手
        g1_pids = groups[group1_idx]['playerIds']
        g2_pids = groups[group2_idx]['playerIds']
        idx1 = g1_pids.index(player1_id)
        idx2 = g2_pids.index(player2_id)
        g1_pids[idx1], g2_pids[idx2] = g2_pids[idx2], g1_pids[idx1]
        # 重置两个组的对阵数据
        for g in [groups[group1_idx], groups[group2_idx]]:
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
        groups = fs['groupStage2']['groups']
        g1_players = groups[group1_idx]['players']
        g2_players = groups[group2_idx]['players']
        p1 = next(p for p in g1_players if p['playerId'] == player1_id)
        p2 = next(p for p in g2_players if p['playerId'] == player2_id)
        g1_players.remove(p1)
        g2_players.remove(p2)
        g1_players.append(p2)
        g2_players.append(p1)
        groups[group1_idx]['first'] = None
        groups[group2_idx]['first'] = None

    save_state()
    return jsonify({'ok': True})

@app.route('/api/match/result', methods=['POST'])
def match_result():
    data = request.json
    stage = data['stage']
    fs = current_state()

    if stage == 'group1':
        group = fs['groupStage1']['groups'][data['groupIdx']]
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
        bracket = fs['elimination']['bracket']
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
    fs = current_state()
    group = fs['groupStage2']['groups'][group_idx]
    group['players'] = data['players']
    group['first'] = group['players'][0]['playerId']
    push_history()
    return jsonify({'ok': True})

@app.route('/api/reset_elimination', methods=['POST'])
def reset_elimination():
    fs = current_state()
    fs['elimination'] = {'locked': False, 'bracket': {'r16': [], 'r8': [], 'r4': [], 'final': {}}}
    push_history()
    return jsonify({'ok': True})

def ensure_default_pool():
    """Ensure the default pool exists in the current format."""
    fs = current_state()
    if not any(p['name'] == '默认池' for p in fs['pools']):
        fs['pools'].append({'id': 'pool_default', 'name': '默认池'})

load_state()
ensure_default_pool()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
