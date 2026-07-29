# SF6 48人锦标赛可视化赛程工具 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为街霸6赛事主办方构建一个Flask Web工具，管理48人锦标赛的分组、对战图可视化和数据录入。

**Architecture:** Flask后端管理所有状态和业务逻辑（随机分组、晋级、撤销/重做），前端通过fetch调用API获取状态并渲染SVG对战图和HTML记录表。数据持久化为JSON文件。

**Tech Stack:** Python 3 + Flask, HTML + CSS + 原生JS + SVG, JSON文件存储

## Global Constraints

- Python 3.8+, Flask 2.x
- 零前端框架依赖，纯原生JS
- SVG对战图全量重绘
- 所有状态由后端管理，前端仅负责渲染和用户交互
- 每次API操作后自动存盘到 `tournament_data.json`
- 撤销栈上限50步

---

## 文件结构

```
SFMatch/
├── app.py                      # Flask主入口 + 路由
├── state.py                    # 状态管理类（加载/保存/撤销/重做）
├── randomizer.py               # 随机分组算法
├── promotion.py                # 晋级逻辑
├── tournament_data.json        # 自动生成的赛事数据
├── requirements.txt            # flask
├── templates/
│   └── index.html              # 主页面模板
└── static/
    ├── style.css               # 样式
    ├── app.js                  # 前端主逻辑（API调用、Tab切换、状态同步）
    ├── svg_renderer.js         # SVG对战图渲染（双败、单败）
    ├── player_manager.js       # 选手管理UI（池、导入、拖拽）
    └── drag_ranking.js         # 拖拽排名组件
```

---

### Task 1: 项目骨架与Flask基础

**Files:**
- Create: `requirements.txt`
- Create: `app.py`
- Create: `templates/index.html`（骨架）
- Create: `static/style.css`（空）
- Create: `static/app.js`（空）

- [ ] **Step 1: 创建 requirements.txt**

```
flask>=2.0
```

- [ ] **Step 2: 安装依赖**

Run: `pip install -r requirements.txt`

- [ ] **Step 3: 创建 Flask 主入口 app.py**

```python
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

load_state()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

- [ ] **Step 4: 创建 index.html 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SF6 48人锦标赛</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <header>
    <h1>SF6 48人锦标赛</h1>
    <nav id="tabs">
      <button class="tab active" data-tab="players">选手管理</button>
      <button class="tab" data-tab="group1" disabled>小组赛第一轮</button>
      <button class="tab" data-tab="group2" disabled>小组赛第二轮</button>
      <button class="tab" data-tab="elimination" disabled>16人淘汰赛</button>
    </nav>
  </header>
  <main>
    <section id="tab-players" class="tab-content active">选手管理（待实现）</section>
    <section id="tab-group1" class="tab-content">小组赛第一轮（待实现）</section>
    <section id="tab-group2" class="tab-content">小组赛第二轮（待实现）</section>
    <section id="tab-elimination" class="tab-content">16人淘汰赛（待实现）</section>
  </main>
  <div id="undo-redo">
    <button id="btn-undo" disabled>撤销</button>
    <button id="btn-redo" disabled>重做</button>
  </div>
  <div id="io-buttons">
    <button id="btn-export">导出JSON</button>
    <label>导入JSON <input type="file" id="import-file" accept=".json" hidden></label>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: 创建空的 style.css 和 app.js**

`static/style.css` 和 `static/app.js` 先创建空文件。

- [ ] **Step 6: 测试启动**

Run: `cd d:/code/MyProject/SFMatch && python app.py`
Expected: Flask启动在 http://127.0.0.1:5000 ，浏览器打开能看到标题和Tab栏

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat: Flask project scaffold with basic routing and state management"
```

---

### Task 2: 选手管理API（池 + 选手CRUD）

**Files:**
- Modify: `app.py`

**Interfaces:**
- Consumes: `state`, `push_history()`, `save_state()`
- Produces: 以下API端点供前端调用

- [ ] **Step 1: 添加池管理API**

在 `app.py` 中添加：

```python
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
```

- [ ] **Step 2: 添加选手管理API**

```python
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
```

- [ ] **Step 3: 测试API**

Run: `python app.py`，然后用curl或浏览器测试

```bash
# 创建池
curl -X POST http://localhost:5000/api/pools -H "Content-Type: application/json" -d '{"action":"create","id":"pool_0","name":"日本池"}'

# 添加选手
curl -X POST http://localhost:5000/api/players -H "Content-Type: application/json" -d '{"action":"add","id":"p_0","name":"Tokido","poolId":"pool_0"}'

# 获取状态
curl http://localhost:5000/api/state
```

Expected: 状态中包含创建的池和选手

- [ ] **Step 4: 提交**

```bash
git add app.py && git commit -m "feat: player and pool management API"
```

---

### Task 3: 随机分组API

**Files:**
- Create: `randomizer.py`
- Modify: `app.py`

**Interfaces:**
- Consumes: `state['players']`, `state['pools']`
- Produces: `randomize_groups1()`, `randomize_groups2()`, `randomize_elimination()`

- [ ] **Step 1: 创建 randomizer.py**

```python
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
```

- [ ] **Step 2: 在 app.py 中导入并添加随机API**

```python
from randomizer import randomize_group_stage1, randomize_group_stage2, randomize_elimination

@app.route('/api/randomize', methods=['POST'])
def randomize():
    data = request.json
    stage = data.get('stage')
    push_history()
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
            state['elimination']['bracket']['r16'] = r16_matches
            state['elimination']['locked'] = True
        save_state()
        return jsonify({'ok': True})
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
```

- [ ] **Step 3: 测试**

Run: `python app.py`，用curl测试随机分组（先用Task 2的方式添加48个选手和池）

- [ ] **Step 4: 提交**

```bash
git add randomizer.py app.py && git commit -m "feat: randomization API for all three stages"
```

---

### Task 4: 比赛结果录入与晋级API

**Files:**
- Create: `promotion.py`
- Modify: `app.py`

**Interfaces:**
- Consumes: `state['groupStage1']`, `state['groupStage2']`, `state['elimination']`
- Produces: `POST /api/match/result`, `POST /api/ranking`, 自动晋级逻辑

- [ ] **Step 1: 创建 promotion.py**

```python
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
```

- [ ] **Step 2: 在 app.py 中导入并添加比赛结果API**

```python
from promotion import advance_group1_winner, update_elimination_match, check_stage1_complete, check_stage2_complete

@app.route('/api/match/result', methods=['POST'])
def match_result():
    data = request.json
    push_history()
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
        bracket[round_key][match_idx]['score1'] = data.get('score1', 0)
        bracket[round_key][match_idx]['score2'] = data.get('score2', 0)
        update_elimination_match(bracket, round_key, match_idx, data['winner'])

    save_state()
    return jsonify({'ok': True})

@app.route('/api/ranking', methods=['POST'])
def update_ranking():
    data = request.json
    push_history()
    group_idx = data['groupIdx']
    group = state['groupStage2']['groups'][group_idx]
    group['players'] = data['players']
    group['first'] = group['players'][0]['playerId']
    save_state()
    return jsonify({'ok': True})
```

- [ ] **Step 3: 测试**

用curl模拟比赛结果录入，检查晋级逻辑是否正确

- [ ] **Step 4: 提交**

```bash
git add promotion.py app.py && git commit -m "feat: match result recording and promotion logic"
```

---

### Task 5: 选手管理前端（HTML/CSS + 池管理 + 导入）

**Files:**
- Modify: `templates/index.html`
- Modify: `static/style.css`
- Modify: `static/app.js`
- Create: `static/player_manager.js`

- [ ] **Step 1: 实现 index.html 中的选手管理Tab**

将 `<section id="tab-players">` 替换为完整结构：

```html
<section id="tab-players" class="tab-content active">
  <div class="import-section">
    <h3>导入选手</h3>
    <div class="import-csv">
      <label>CSV文件上传（格式：选手名,池名）<input type="file" id="csv-upload" accept=".csv"></label>
    </div>
    <div class="import-manual">
      <input type="text" id="player-name-input" placeholder="选手名">
      <select id="pool-select"><option value="">未分配</option></select>
      <button id="btn-add-player">添加</button>
    </div>
  </div>
  <div class="pool-section">
    <h3>池管理 <button id="btn-create-pool">+ 新建池</button></h3>
    <div id="pool-list"></div>
  </div>
  <div class="unassigned-section">
    <h3>未分配池的选手</h3>
    <div id="unassigned-list"></div>
  </div>
  <div class="action-section">
    <button id="btn-randomize-g1" class="primary-btn">随机分组（小组赛第一轮）</button>
    <div id="randomize-error" class="error-msg"></div>
  </div>
</section>
```

- [ ] **Step 2: 实现 style.css 基础样式**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
header { background: #16213e; padding: 16px 24px; border-bottom: 2px solid #0f3460; }
header h1 { font-size: 20px; margin-bottom: 12px; }
#tabs { display: flex; gap: 8px; }
.tab { padding: 8px 16px; border: none; background: #0f3460; color: #aaa; cursor: pointer; border-radius: 4px 4px 0 0; }
.tab.active { background: #e94560; color: #fff; }
.tab:disabled { opacity: 0.4; cursor: not-allowed; }
.tab-content { display: none; padding: 24px; }
.tab-content.active { display: block; }
.primary-btn { background: #e94560; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
.primary-btn:hover { background: #c73e54; }
.error-msg { color: #ff6b6b; margin-top: 8px; }

/* 选手管理 */
.import-section, .pool-section, .unassigned-section, .action-section { margin-bottom: 24px; }
.import-manual { display: flex; gap: 8px; margin-top: 8px; }
.import-manual input, .import-manual select { padding: 6px 10px; border: 1px solid #333; background: #222; color: #eee; border-radius: 4px; }
.pool-card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; margin-bottom: 8px; padding: 12px; }
.pool-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.pool-header .count { color: #888; font-size: 13px; }
.pool-players { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.player-card { background: #0f3460; padding: 6px 12px; border-radius: 4px; cursor: grab; font-size: 13px; position: relative; }
.player-card.editing { cursor: text; }
.player-card .rename-input { background: transparent; border: none; color: #fff; font-size: 13px; width: 80px; outline: none; border-bottom: 1px solid #e94560; }
.unassigned-list { display: flex; flex-wrap: wrap; gap: 6px; }
#undo-redo { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 8px; }
#undo-redo button { padding: 8px 16px; background: #333; color: #eee; border: 1px solid #555; border-radius: 4px; cursor: pointer; }
#undo-redo button:disabled { opacity: 0.3; cursor: not-allowed; }
#io-buttons { position: fixed; bottom: 20px; left: 20px; display: flex; gap: 8px; }
#io-buttons button, #io-buttons label { padding: 8px 16px; background: #333; color: #eee; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 13px; }
```

- [ ] **Step 3: 实现 app.js 核心逻辑**

```javascript
// app.js — 前端主逻辑
let currentState = {};

async function fetchState() {
  const res = await fetch('/api/state');
  currentState = await res.json();
  render();
}

function render() {
  renderTabs();
  renderPlayerManager();
  // 后续Task添加: renderGroup1(), renderGroup2(), renderElimination()
  renderUndoRedo();
}

function renderTabs() {
  const g1 = currentState.groupStage1;
  const g2 = currentState.groupStage2;
  const el = currentState.elimination;
  document.querySelector('[data-tab="group1"]').disabled = !g1.locked;
  document.querySelector('[data-tab="group2"]').disabled = !g2.locked;
  document.querySelector('[data-tab="elimination"]').disabled = !el.locked;
}

function renderUndoRedo() {
  document.getElementById('btn-undo').disabled = currentState.historyIndex <= 0;
  document.getElementById('btn-redo').disabled = currentState.historyIndex >= currentState.historyLen - 1;
}

// Tab切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.disabled) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// 撤销/重做
document.getElementById('btn-undo').addEventListener('click', async () => {
  await fetch('/api/undo', { method: 'POST' });
  fetchState();
});
document.getElementById('btn-redo').addEventListener('click', async () => {
  await fetch('/api/redo', { method: 'POST' });
  fetchState();
});

// 导出/导入
document.getElementById('btn-export').addEventListener('click', () => {
  window.location.href = '/api/export';
});
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  await fetch('/api/import', { method: 'POST', body: formData });
  fetchState();
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('btn-redo').click(); }
});

// 初始化
fetchState();
```

- [ ] **Step 4: 实现 player_manager.js**

```javascript
// player_manager.js — 选手管理UI
function renderPlayerManager() {
  renderPoolSelect();
  renderPoolList();
  renderUnassigned();
}

function renderPoolSelect() {
  const sel = document.getElementById('pool-select');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">未分配</option>';
  currentState.pools.forEach(p => {
    sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  });
  sel.value = currentVal;
}

function renderPoolList() {
  const container = document.getElementById('pool-list');
  container.innerHTML = '';
  currentState.pools.forEach(pool => {
    const players = currentState.players.filter(p => p.poolId === pool.id);
    const card = document.createElement('div');
    card.className = 'pool-card';
    card.innerHTML = `
      <div class="pool-header">
        <span>${pool.name} <span class="count">(${players.length}人)</span></span>
        <div>
          <button class="btn-delete-pool" data-id="${pool.id}">删除</button>
        </div>
      </div>
      <div class="pool-players" data-pool-id="${pool.id}">
        ${players.map(p => `
          <div class="player-card" draggable="true" data-player-id="${p.id}">
            <span class="player-name">${p.name}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });

  // 删除池
  container.querySelectorAll('.btn-delete-pool').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch('/api/pools', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete', id: btn.dataset.id })
      });
      fetchState();
    });
  });

  // 双击编辑选手名
  container.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('dblclick', () => {
      const span = card.querySelector('.player-name');
      const oldName = span.textContent;
      const input = document.createElement('input');
      input.className = 'rename-input';
      input.value = oldName;
      span.replaceWith(input);
      input.focus();
      input.addEventListener('blur', async () => {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
          await fetch('/api/player/rename', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: card.dataset.playerId, name: newName })
          });
          fetchState();
        } else {
          fetchState();
        }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    });

    // 拖拽
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.playerId);
    });
  });

  // 放置区
  container.querySelectorAll('.pool-players').forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.background = '#1a3a5c'; });
    zone.addEventListener('dragleave', () => { zone.style.background = ''; });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.style.background = '';
      const playerId = e.dataTransfer.getData('text/plain');
      const poolId = zone.dataset.poolId;
      await fetch('/api/players', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'assign_pool', id: playerId, poolId: poolId })
      });
      fetchState();
    });
  });
}

function renderUnassigned() {
  const container = document.getElementById('unassigned-list');
  const unassigned = currentState.players.filter(p => !p.poolId);
  container.innerHTML = unassigned.map(p => `
    <div class="player-card" draggable="true" data-player-id="${p.id}">
      <span class="player-name">${p.name}</span>
    </div>
  `).join('');

  container.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.playerId);
    });
    card.addEventListener('dblclick', () => {
      const span = card.querySelector('.player-name');
      const oldName = span.textContent;
      const input = document.createElement('input');
      input.className = 'rename-input';
      input.value = oldName;
      span.replaceWith(input);
      input.focus();
      input.addEventListener('blur', async () => {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
          await fetch('/api/player/rename', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: card.dataset.playerId, name: newName })
          });
          fetchState();
        } else {
          fetchState();
        }
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    });
  });
}

// CSV上传
document.getElementById('csv-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim()).map(l => l.split(','));
  await fetch('/api/players', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'import_csv', lines })
  });
  fetchState();
});

// 手动添加
document.getElementById('btn-add-player').addEventListener('click', async () => {
  const name = document.getElementById('player-name-input').value.trim();
  const poolId = document.getElementById('pool-select').value || null;
  if (!name) return;
  await fetch('/api/players', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'add', id: `p_${Date.now()}`, name, poolId })
  });
  document.getElementById('player-name-input').value = '';
  fetchState();
});

// 新建池
document.getElementById('btn-create-pool').addEventListener('click', async () => {
  const name = prompt('请输入池名：');
  if (!name) return;
  await fetch('/api/pools', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'create', id: `pool_${Date.now()}`, name })
  });
  fetchState();
});

// 随机分组
document.getElementById('btn-randomize-g1').addEventListener('click', async () => {
  const errEl = document.getElementById('randomize-error');
  errEl.textContent = '';
  const res = await fetch('/api/randomize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage: 'group1' })
  });
  const data = await res.json();
  if (!data.ok) {
    errEl.textContent = data.error;
  } else {
    fetchState();
  }
});
```

- [ ] **Step 5: 在 index.html 中引入JS文件**

在 `<script src="/static/app.js">` 前添加：
```html
<script src="/static/player_manager.js"></script>
```

- [ ] **Step 6: 测试**

Run: `python app.py`，在浏览器中测试：
- 手动添加选手、创建池、分配池
- CSV导入
- 双击改名
- 拖拽到其他池
- 随机分组

- [ ] **Step 7: 提交**

```bash
git add templates/ static/ && git commit -m "feat: player management frontend with pools, CSV import, drag-and-drop"
```

---

### Task 6: 小组赛第一轮SVG对战图

**Files:**
- Create: `static/svg_renderer.js`
- Modify: `templates/index.html`
- Modify: `static/style.css`
- Modify: `static/app.js`

- [ ] **Step 1: 实现 index.html 中小组赛第一轮Tab**

```html
<section id="tab-group1" class="tab-content">
  <div id="g1-list-view" class="group-list"></div>
  <div id="g1-detail-view" style="display:none">
    <button class="back-btn" id="g1-back">← 返回列表</button>
    <h3 id="g1-detail-title"></h3>
    <div id="g1-bracket-svg"></div>
  </div>
</section>
```

- [ ] **Step 2: 实现 svg_renderer.js — 双败对战图渲染**

```javascript
// svg_renderer.js — SVG对战图渲染
const SVG_NS = 'http://www.w3.org/2000/svg';
const CARD_W = 140, CARD_H = 40, GAP = 16, LINE_GAP = 20;

function getPlayerName(playerId) {
  if (!playerId) return '待定';
  const p = currentState.players.find(p => p.id === playerId);
  return p ? p.name : playerId;
}

function createSvgCard(svg, x, y, playerId, score, isWinner, isLoser, matchKey, stage, groupIdx, roundKey, matchIdx) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);

  // 背景
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', CARD_W);
  rect.setAttribute('height', CARD_H);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isWinner ? '#2d5a27' : isLoser ? '#3a2020' : '#1e3a5f');
  rect.setAttribute('stroke', isWinner ? '#4ade80' : isLoser ? '#666' : '#3b82f6');
  rect.setAttribute('stroke-width', isWinner ? 2 : 1);
  rect.style.cursor = playerId ? 'pointer' : 'default';
  g.appendChild(rect);

  // 名字
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', 8);
  text.setAttribute('y', 25);
  text.setAttribute('fill', isLoser ? '#888' : '#fff');
  text.setAttribute('font-size', '13');
  text.textContent = getPlayerName(playerId);
  g.appendChild(text);

  // 比分输入
  if (playerId) {
    const scoreInput = document.createElementNS(SVG_NS, 'foreignObject');
    scoreInput.setAttribute('x', CARD_W - 30);
    scoreInput.setAttribute('y', 8);
    scoreInput.setAttribute('width', 24);
    scoreInput.setAttribute('height', 24);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = score || 0;
    input.style.cssText = 'width:24px;height:24px;text-align:center;background:#0f3460;color:#fff;border:1px solid #3b82f6;border-radius:2px;font-size:12px;';
    input.addEventListener('change', () => {
      updateScore(stage, groupIdx, roundKey, matchIdx, input.value, playerId);
    });
    scoreInput.appendChild(input);
    g.appendChild(scoreInput);
  }

  // 点击选胜者
  if (playerId && !isWinner) {
    g.addEventListener('click', () => {
      selectWinner(stage, groupIdx, roundKey, matchIdx, playerId);
    });
  }

  svg.appendChild(g);
  return g;
}

function drawLine(svg, x1, y1, x2, y2) {
  const line = document.createElementNS(SVG_NS, 'path');
  const mx = (x1 + x2) / 2;
  line.setAttribute('d', `M${x1},${y1} H${mx} V${y2} H${x2}`);
  line.setAttribute('stroke', '#3b82f6');
  line.setAttribute('stroke-width', 1);
  line.setAttribute('fill', 'none');
  svg.appendChild(line);
}

function renderDoubleEliminationBracket(container, group, groupIdx) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', 700);
  svg.setAttribute('height', 400);
  svg.style.background = '#111827';
  svg.style.borderRadius = '8px';

  const bracket = group.bracket;
  const r1 = bracket.r1;
  const wr1 = bracket.wr1;
  const lr1 = bracket.lr1;
  const lr2 = bracket.lr2;

  // R1 — 左侧上方
  const r1_y0 = 40, r1_y1 = 100;
  createSvgCard(svg, 20, r1_y0, r1[0].p1, r1[0].score1, r1[0].winner === r1[0].p1, r1[0].winner && r1[0].winner !== r1[0].p1, 'r1_0', 'group1', groupIdx, 'r1', 0);
  createSvgCard(svg, 20, r1_y0 + CARD_H + GAP, r1[0].p2, r1[0].score2, r1[0].winner === r1[0].p2, r1[0].winner && r1[0].winner !== r1[0].p2, 'r1_0', 'group1', groupIdx, 'r1', 0);
  createSvgCard(svg, 20, r1_y1, r1[1].p1, r1[1].score1, r1[1].winner === r1[1].p1, r1[1].winner && r1[1].winner !== r1[1].p1, 'r1_1', 'group1', groupIdx, 'r1', 1);
  createSvgCard(svg, 20, r1_y1 + CARD_H + GAP, r1[1].p2, r1[1].score2, r1[1].winner === r1[1].p2, r1[1].winner && r1[1].winner !== r1[1].p2, 'r1_1', 'group1', groupIdx, 'r1', 1);

  // WR1 — 中央
  const wr1_y = 70;
  drawLine(svg, 20 + CARD_W, r1_y0 + CARD_H / 2, 200, wr1_y + CARD_H / 2);
  drawLine(svg, 20 + CARD_W, r1_y0 + CARD_H + GAP + CARD_H / 2, 200, wr1_y + CARD_H / 2);
  createSvgCard(svg, 200, wr1_y, wr1.p1, wr1.score1, wr1.winner === wr1.p1, wr1.winner && wr1.winner !== wr1.p1, 'wr1', 'group1', groupIdx, 'wr1', null);
  createSvgCard(svg, 200, wr1_y + CARD_H + GAP, wr1.p2, wr1.score2, wr1.winner === wr1.p2, wr1.winner && wr1.winner !== wr1.p2, 'wr1', 'group1', groupIdx, 'wr1', null);

  // 胜者组冠军标注
  if (group.first) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 200);
    label.setAttribute('y', wr1_y - 10);
    label.setAttribute('fill', '#4ade80');
    label.setAttribute('font-size', '12');
    label.textContent = '🏆 胜者组冠军';
    svg.appendChild(label);
  }

  // LR1 — 下方
  const lr1_y = 220;
  drawLine(svg, 20 + CARD_W, r1_y0 + CARD_H + GAP + CARD_H / 2, 100, lr1_y + CARD_H / 2);
  drawLine(svg, 20 + CARD_W, r1_y1 + CARD_H + GAP + CARD_H / 2, 100, lr1_y + CARD_H + GAP + CARD_H / 2);
  createSvgCard(svg, 100, lr1_y, lr1.p1, lr1.score1, lr1.winner === lr1.p1, lr1.winner && lr1.winner !== lr1.p1, 'lr1', 'group1', groupIdx, 'lr1', null);
  createSvgCard(svg, 100, lr1_y + CARD_H + GAP, lr1.p2, lr1.score2, lr1.winner === lr1.p2, lr1.winner && lr1.winner !== lr1.p2, 'lr1', 'group1', groupIdx, 'lr1', null);

  // LR2 — 右下
  const lr2_y = 280;
  drawLine(svg, 100 + CARD_W, lr1_y + CARD_H / 2 + GAP / 2, 350, lr2_y + CARD_H / 2);
  drawLine(svg, 200 + CARD_W, wr1_y + CARD_H + GAP + CARD_H / 2, 350, lr2_y + CARD_H + GAP + CARD_H / 2);
  createSvgCard(svg, 350, lr2_y, lr2.p1, lr2.score1, lr2.winner === lr2.p1, lr2.winner && lr2.winner !== lr2.p1, 'lr2', 'group1', groupIdx, 'lr2', null);
  createSvgCard(svg, 350, lr2_y + CARD_H + GAP, lr2.p2, lr2.score2, lr2.winner === lr2.p2, lr2.winner && lr2.winner !== lr2.p2, 'lr2', 'group1', groupIdx, 'lr2', null);

  // 败者组冠军标注
  if (group.second) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 350);
    label.setAttribute('y', lr2_y - 10);
    label.setAttribute('fill', '#fbbf24');
    label.setAttribute('font-size', '12');
    label.textContent = '🥈 败者组冠军';
    svg.appendChild(label);
  }

  // 第一/第二名标注
  if (group.first && group.second) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 550);
    label.setAttribute('y', 100);
    label.setAttribute('fill', '#4ade80');
    label.setAttribute('font-size', '14');
    label.textContent = `第1名: ${getPlayerName(group.first)}`;
    svg.appendChild(label);
    const label2 = document.createElementNS(SVG_NS, 'text');
    label2.setAttribute('x', 550);
    label2.setAttribute('y', 130);
    label2.setAttribute('fill', '#fbbf24');
    label2.setAttribute('font-size', '14');
    label2.textContent = `第2名: ${getPlayerName(group.second)}`;
    svg.appendChild(label2);
  }

  container.appendChild(svg);
}

async function selectWinner(stage, groupIdx, roundKey, matchIdx, winnerId) {
  const body = { stage, groupIdx, winner: winnerId };
  if (roundKey === 'r1') {
    body.matchKey = `r1_${matchIdx}`;
    const group = currentState.groupStage1.groups[groupIdx];
    const match = group.bracket.r1[matchIdx];
    body.score1 = match.score1;
    body.score2 = match.score2;
  } else {
    body.matchKey = roundKey;
    const group = currentState.groupStage1.groups[groupIdx];
    const match = group.bracket[roundKey];
    body.score1 = match.score1;
    body.score2 = match.score2;
  }
  await fetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}

async function updateScore(stage, groupIdx, roundKey, matchIdx, score, playerId) {
  // 比分更新时，如果已有胜者，保持胜者不变
  const group = currentState.groupStage1.groups[groupIdx];
  let match;
  if (roundKey === 'r1') {
    match = group.bracket.r1[matchIdx];
  } else {
    match = group.bracket[roundKey];
  }
  const isP1 = match.p1 === playerId;
  const body = {
    stage,
    groupIdx,
    matchKey: roundKey === 'r1' ? `r1_${matchIdx}` : roundKey,
    winner: match.winner,
    score1: isP1 ? parseInt(score) : match.score1,
    score2: isP1 ? match.score2 : parseInt(score)
  };
  await fetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}
```

- [ ] **Step 3: 在 app.js 中添加小组赛第一轮渲染**

```javascript
function renderGroup1() {
  const g1 = currentState.groupStage1;
  const listView = document.getElementById('g1-list-view');
  const detailView = document.getElementById('g1-detail-view');

  if (!g1.locked) {
    listView.innerHTML = '<p style="color:#888">请先在"选手管理"中完成随机分组</p>';
    return;
  }

  // 列表视图
  listView.innerHTML = '<div class="group-grid">' + g1.groups.map((g, i) => `
    <div class="group-card" data-idx="${i}">
      <h4>第${i + 1}组</h4>
      ${g.playerIds.map(pid => `<div class="group-player">${getPlayerName(pid)}</div>`).join('')}
      ${g.first ? `<div class="result">第1: ${getPlayerName(g.first)}</div>` : ''}
      ${g.second ? `<div class="result second">第2: ${getPlayerName(g.second)}</div>` : ''}
    </div>
  `).join('') + '</div>';

  listView.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      listView.style.display = 'none';
      detailView.style.display = 'block';
      document.getElementById('g1-detail-title').textContent = `第${idx + 1}组`;
      renderDoubleEliminationBracket(document.getElementById('g1-bracket-svg'), g1.groups[idx], idx);
    });
  });
}

document.getElementById('g1-back').addEventListener('click', () => {
  document.getElementById('g1-list-view').style.display = 'block';
  document.getElementById('g1-detail-view').style.display = 'none';
});
```

- [ ] **Step 4: 在 render() 中添加 renderGroup1() 调用**

在 `app.js` 的 `render()` 函数中添加 `renderGroup1();`

- [ ] **Step 5: 添加CSS样式**

```css
.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.group-card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 12px; cursor: pointer; transition: border-color 0.2s; }
.group-card:hover { border-color: #e94560; }
.group-card h4 { margin-bottom: 8px; color: #3b82f6; }
.group-player { font-size: 13px; padding: 2px 0; }
.result { margin-top: 8px; font-size: 12px; color: #4ade80; }
.result.second { color: #fbbf24; }
.back-btn { background: none; border: 1px solid #555; color: #aaa; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-bottom: 12px; }
.back-btn:hover { border-color: #aaa; color: #fff; }
```

- [ ] **Step 6: 在 index.html 中引入 svg_renderer.js**

```html
<script src="/static/svg_renderer.js"></script>
<script src="/static/player_manager.js"></script>
```

- [ ] **Step 7: 测试**

Run: `python app.py`，测试完整流程：添加48人 → 随机分组 → 点击小组 → 看到SVG对战图 → 点击选胜者

- [ ] **Step 8: 提交**

```bash
git add static/ templates/ && git commit -m "feat: Group Stage 1 double-elimination SVG bracket"
```

---

### Task 7: 小组赛第二轮记录表 + 晋级触发

**Files:**
- Modify: `templates/index.html`
- Modify: `static/app.js`
- Modify: `static/style.css`

- [ ] **Step 1: 实现 index.html 中小组赛第二轮Tab**

```html
<section id="tab-group2" class="tab-content">
  <div id="g2-list-view" class="group-list"></div>
  <div id="g2-detail-view" style="display:none">
    <button class="back-btn" id="g2-back">← 返回列表</button>
    <h3 id="g2-detail-title"></h3>
    <div id="g2-ranking"></div>
  </div>
</section>
```

- [ ] **Step 2: 在 app.js 中添加小组赛第二轮渲染**

```javascript
function renderGroup2() {
  const g2 = currentState.groupStage2;
  const listView = document.getElementById('g2-list-view');
  const detailView = document.getElementById('g2-detail-view');

  if (!g2.locked) {
    // 检查第一轮是否完成，显示晋级按钮
    const g1 = currentState.groupStage1;
    if (g1.locked && g1.groups.every(g => g.first && g.second)) {
      listView.innerHTML = '<button class="primary-btn" id="btn-promote-g2">晋级第二轮</button>';
      document.getElementById('btn-promote-g2').addEventListener('click', async () => {
        await fetch('/api/randomize', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ stage: 'group2' })
        });
        fetchState();
      });
    } else {
      listView.innerHTML = '<p style="color:#888">等待小组赛第一轮全部完成</p>';
    }
    return;
  }

  // 列表视图
  listView.innerHTML = '<div class="group-grid">' + g2.groups.map((g, i) => `
    <div class="group-card" data-idx="${i}">
      <h4>第二轮 第${i + 1}组</h4>
      ${g.players.map(p => `<div class="group-player">${getPlayerName(p.playerId)} (${p.wins}胜${p.losses}负)</div>`).join('')}
      ${g.first ? `<div class="result">第1: ${getPlayerName(g.first)}</div>` : ''}
    </div>
  `).join('') + '</div>';

  listView.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      listView.style.display = 'none';
      detailView.style.display = 'block';
      document.getElementById('g2-detail-title').textContent = `第二轮 第${idx + 1}组`;
      renderRanking(g2.groups[idx], idx);
    });
  });
}

function renderRanking(group, groupIdx) {
  const container = document.getElementById('g2-ranking');
  container.innerHTML = '<div class="ranking-list">' + group.players.map((p, i) => `
    <div class="ranking-card" draggable="true" data-idx="${i}">
      <span class="rank-num">${i + 1}.</span>
      <span class="rank-name">${getPlayerName(p.playerId)}</span>
      <input type="number" class="rank-input" data-field="wins" value="${p.wins}" min="0"> 胜
      <input type="number" class="rank-input" data-field="losses" value="${p.losses}" min="0"> 负
    </div>
  `).join('') + '</div>';

  // 比分输入
  container.querySelectorAll('.rank-input').forEach(input => {
    input.addEventListener('change', async () => {
      const idx = parseInt(input.closest('.ranking-card').dataset.idx);
      const field = input.dataset.field;
      group.players[idx][field] = parseInt(input.value) || 0;
      group.first = group.players[0].playerId;
      await fetch('/api/ranking', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ groupIdx, players: group.players })
      });
      fetchState();
    });
  });

  // 拖拽排序
  const cards = container.querySelectorAll('.ranking-card');
  let dragIdx = null;
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      dragIdx = parseInt(card.dataset.idx);
      e.dataTransfer.effectAllowed = 'move';
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    card.addEventListener('dragover', (e) => { e.preventDefault(); });
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dropIdx = parseInt(card.dataset.idx);
      if (dragIdx === dropIdx) return;
      const [moved] = group.players.splice(dragIdx, 1);
      group.players.splice(dropIdx, 0, moved);
      group.first = group.players[0].playerId;
      await fetch('/api/ranking', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ groupIdx, players: group.players })
      });
      fetchState();
    });
  });
}

document.getElementById('g2-back').addEventListener('click', () => {
  document.getElementById('g2-list-view').style.display = 'block';
  document.getElementById('g2-detail-view').style.display = 'none';
});
```

- [ ] **Step 3: 添加CSS**

```css
.ranking-list { display: flex; flex-direction: column; gap: 8px; max-width: 400px; }
.ranking-card { background: #16213e; border: 1px solid #0f3460; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; cursor: grab; }
.ranking-card:active { cursor: grabbing; }
.rank-num { color: #3b82f6; font-weight: bold; min-width: 24px; }
.rank-name { flex: 1; }
.rank-input { width: 40px; text-align: center; background: #0f3460; color: #fff; border: 1px solid #3b82f6; border-radius: 3px; padding: 2px; }
```

- [ ] **Step 4: 在 render() 中添加 renderGroup2()**

- [ ] **Step 5: 测试**

- [ ] **Step 6: 提交**

```bash
git add templates/ static/ && git commit -m "feat: Group Stage 2 record table with drag ranking"
```

---

### Task 8: 16人淘汰赛SVG对战图

**Files:**
- Modify: `templates/index.html`
- Modify: `static/svg_renderer.js`
- Modify: `static/app.js`

- [ ] **Step 1: 实现 index.html 中淘汰赛Tab**

```html
<section id="tab-elimination" class="tab-content">
  <div id="elim-controls">
    <button class="primary-btn" id="btn-randomize-elim" style="display:none">随机签位</button>
    <button class="primary-btn" id="btn-randomize-elim-again" style="display:none">重新随机</button>
  </div>
  <div id="elim-bracket-svg"></div>
</section>
```

- [ ] **Step 2: 在 svg_renderer.js 中添加16人淘汰赛渲染**

```javascript
function renderEliminationBracket(container, bracket) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', 1000);
  svg.setAttribute('height', 600);
  svg.style.background = '#111827';
  svg.style.borderRadius = '8px';

  // R16 — 8场比赛，分左右两区
  const r16 = bracket.r16 || [];
  const r8 = bracket.r8 || [];
  const r4 = bracket.r4 || [];
  const final_ = bracket.final || {};

  // 左区 r16
  for (let i = 0; i < 4; i++) {
    const match = r16[i] || {};
    const y = 30 + i * 70;
    createSvgCard(svg, 20, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r16', i);
    createSvgCard(svg, 20, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r16', i);
    if (i < 2) drawLine(svg, 20 + CARD_W, y + CARD_H / 2, 200, 80 + (i % 2) * 35);
    else drawLine(svg, 20 + CARD_W, y + CARD_H / 2, 200, 220 + (i % 2) * 35);
  }

  // 右区 r16
  for (let i = 4; i < 8; i++) {
    const match = r16[i] || {};
    const y = 30 + (i - 4) * 70;
    createSvgCard(svg, 520, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r16', i);
    createSvgCard(svg, 520, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r16', i);
  }

  // R8 — 4场
  for (let i = 0; i < 4; i++) {
    const match = r8[i] || {};
    const y = 60 + i * 120;
    createSvgCard(svg, 200, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r8', i);
    createSvgCard(svg, 200, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r8', i);
  }

  // R4 — 2场
  for (let i = 0; i < 2; i++) {
    const match = r4[i] || {};
    const y = 100 + i * 200;
    createSvgCard(svg, 380, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r4', i);
    createSvgCard(svg, 380, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r4', i);
  }

  // 决赛
  createSvgCard(svg, 560, 160, final_.p1, final_.score1, final_.winner === final_.p1, final_.winner && final_.winner !== final_.p1, null, 'elimination', 0, 'final', 0);
  createSvgCard(svg, 560, 160 + CARD_H + GAP, final_.p2, final_.score2, final_.winner === final_.p2, final_.winner && final_.winner !== final_.p2, null, 'elimination', 0, 'final', 0);

  // 冠军标注
  if (final_.winner) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', 560);
    label.setAttribute('y', 140);
    label.setAttribute('fill', '#ffd700');
    label.setAttribute('font-size', '16');
    label.textContent = `🏆 冠军: ${getPlayerName(final_.winner)}`;
    svg.appendChild(label);
  }

  container.appendChild(svg);
}
```

- [ ] **Step 3: 在 app.js 中添加淘汰赛渲染和晋级逻辑**

```javascript
function renderElimination() {
  const el = currentState.elimination;
  const g1 = currentState.groupStage1;
  const g2 = currentState.groupStage2;
  const container = document.getElementById('elim-bracket-svg');
  const btnRandom = document.getElementById('btn-randomize-elim');
  const btnReRandom = document.getElementById('btn-randomize-elim-again');

  if (!el.locked) {
    // 检查是否可以晋级
    const stage2Complete = g2.locked && g2.groups.every(g => g.first);
    if (stage2Complete) {
      btnRandom.style.display = 'inline-block';
      btnReRandom.style.display = 'none';
      container.innerHTML = '<p style="color:#888">点击"随机签位"开始淘汰赛</p>';
    } else {
      container.innerHTML = '<p style="color:#888">等待小组赛第二轮完成</p>';
    }
    return;
  }

  btnRandom.style.display = 'none';
  btnReRandom.style.display = 'inline-block';
  renderEliminationBracket(container, el.bracket);
}

document.getElementById('btn-randomize-elim').addEventListener('click', async () => {
  await fetch('/api/randomize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage: 'elimination' })
  });
  fetchState();
});

document.getElementById('btn-randomize-elim-again').addEventListener('click', async () => {
  if (!confirm('确定重新随机签位？当前淘汰赛进度将丢失。')) return;
  // 重置淘汰赛
  state_reset_elimination();
  await fetch('/api/randomize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage: 'elimination' })
  });
  fetchState();
});
```

需要在 `app.py` 中添加重置淘汰赛的API：

```python
@app.route('/api/reset_elimination', methods=['POST'])
def reset_elimination():
    push_history()
    state['elimination'] = {'locked': False, 'bracket': {'r16': [], 'r8': [], 'r4': [], 'final': {}}}
    save_state()
    return jsonify({'ok': True})
```

前端修改重随机按钮：

```javascript
document.getElementById('btn-randomize-elim-again').addEventListener('click', async () => {
  if (!confirm('确定重新随机签位？当前淘汰赛进度将丢失。')) return;
  await fetch('/api/reset_elimination', { method: 'POST' });
  await fetch('/api/randomize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage: 'elimination' })
  });
  fetchState();
});
```

- [ ] **Step 4: 修改 svg_renderer.js 中的点击事件，支持淘汰赛**

更新 `createSvgCard` 函数，使点击事件能正确传递淘汰赛的 roundKey 和 matchIdx：

```javascript
// 在 createSvgCard 中，点击事件已经接收这些参数，但 selectWinner 需要适配
async function selectWinner(stage, groupIdx, roundKey, matchIdx, winnerId) {
  if (stage === 'group1') {
    // 已有逻辑
  } else if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = bracket[roundKey][matchIdx];
    await fetch('/api/match/result', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stage: 'elimination',
        roundKey,
        matchIdx,
        winner: winnerId,
        score1: match.score1,
        score2: match.score2
      })
    });
    fetchState();
  }
}
```

- [ ] **Step 5: 在 render() 中添加 renderElimination()**

- [ ] **Step 6: 测试**

完整流程：第一轮完成 → 晋级第二轮 → 第二轮完成 → 随机签位 → 淘汰赛对战图

- [ ] **Step 7: 提交**

```bash
git add static/ templates/ app.py && git commit -m "feat: 16-player single-elimination SVG bracket"
```

---

### Task 9: 淘汰赛晋级逻辑修复与完整流程测试

**Files:**
- Modify: `app.py`
- Modify: `static/svg_renderer.js`

- [ ] **Step 1: 确保淘汰赛比分输入正常工作**

在 `svg_renderer.js` 中，为淘汰赛的卡片添加比分更新逻辑。更新 `updateScore` 函数：

```javascript
async function updateScore(stage, groupIdx, roundKey, matchIdx, score, playerId) {
  if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = bracket[roundKey][matchIdx];
    const isP1 = match.p1 === playerId;
    await fetch('/api/match/result', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stage: 'elimination',
        roundKey,
        matchIdx,
        winner: match.winner,
        score1: isP1 ? parseInt(score) : match.score1,
        score2: isP1 ? match.score2 : parseInt(score)
      })
    });
    fetchState();
  } else if (stage === 'group1') {
    // 已有逻辑
  }
}
```

- [ ] **Step 2: 完整流程测试**

手动测试整个流程：
1. 添加48人，分配池
2. 随机分组
3. 录入所有小组赛第一轮结果
4. 晋级第二轮
5. 录入第二轮排名
6. 随机淘汰赛签位
7. 录入淘汰赛结果直到冠军

- [ ] **Step 3: 提交**

```bash
git add static/ && git commit -m "fix: elimination bracket score input and winner selection"
```

---

### Task 10: 收尾 — Tab状态管理、样式优化、错误处理

**Files:**
- Modify: `static/app.js`
- Modify: `static/style.css`
- Modify: `templates/index.html`

- [ ] **Step 1: 完善Tab状态管理**

确保Tab切换时正确渲染对应内容，禁用未解锁的Tab。

- [ ] **Step 2: 添加SVG连线（r8→r4、r4→final的连接线）**

在 `renderEliminationBracket` 中补全所有轮次之间的连线。

- [ ] **Step 3: 样式优化**

- 对战图卡片大小微调
- 响应式布局（如果需要）
- 胜者高亮/败者灰显效果优化

- [ ] **Step 4: 错误处理**

- API错误时前端显示提示
- 随机分组校验失败时显示具体错误

- [ ] **Step 5: 最终测试并提交**

```bash
git add -A && git commit -m "feat: polish UI, error handling, and bracket connections"
```

---

## 验收清单

- [ ] Flask启动后浏览器可访问
- [ ] CSV导入 + 手动添加选手
- [ ] 池管理（创建/删除/拖拽分配）
- [ ] 双击编辑选手名（不影响赛程）
- [ ] 随机分组（池内随机，4的倍数校验）
- [ ] 小组赛第一轮SVG对战图（双败5场）
- [ ] 点击选胜者 + 比分输入
- [ ] 自动晋级到第二轮和淘汰赛
- [ ] 小组赛第二轮记录表 + 拖拽排名
- [ ] 16人淘汰赛SVG对战图
- [ ] 撤销/重做（Ctrl+Z/Y）
- [ ] 导出/导入JSON
- [ ] 自动存盘（tournament_data.json）
