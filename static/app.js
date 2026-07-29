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
  renderGroup1();
  renderGroup2();
  renderElimination();
  renderUndoRedo();
}

function renderTabs() {
  const g1 = currentState.groupStage1;
  const g2 = currentState.groupStage2;
  const el = currentState.elimination;
  const g1Complete = g1.locked && g1.groups.every(g => g.first && g.second);
  const stage2Complete = g2.locked && g2.groups.every(g => g.first);
  document.querySelector('[data-tab="group1"]').disabled = !g1.locked;
  document.querySelector('[data-tab="group2"]').disabled = !(g2.locked || g1Complete);
  document.querySelector('[data-tab="elimination"]').disabled = !(el.locked || stage2Complete);
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

function renderGroup1() {
  const g1 = currentState.groupStage1;
  const listView = document.getElementById('g1-list-view');
  const detailView = document.getElementById('g1-detail-view');

  listView.style.display = 'block';
  detailView.style.display = 'none';

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

function renderGroup2() {
  const g2 = currentState.groupStage2;
  const listView = document.getElementById('g2-list-view');
  const detailView = document.getElementById('g2-detail-view');

  listView.style.display = 'block';
  detailView.style.display = 'none';

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

// 淘汰赛渲染
function renderElimination() {
  const el = currentState.elimination;
  const g2 = currentState.groupStage2;
  const container = document.getElementById('elim-bracket-svg');
  const btnRandom = document.getElementById('btn-randomize-elim');
  const btnReRandom = document.getElementById('btn-randomize-elim-again');

  if (!el.locked) {
    const stage2Complete = g2.locked && g2.groups.every(g => g.first);
    if (stage2Complete) {
      btnRandom.style.display = 'inline-block';
      btnReRandom.style.display = 'none';
      container.innerHTML = '<p style="color:#888">点击"随机签位"开始淘汰赛</p>';
    } else {
      btnRandom.style.display = 'none';
      btnReRandom.style.display = 'none';
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
  await fetch('/api/reset_elimination', { method: 'POST' });
  await fetch('/api/randomize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage: 'elimination' })
  });
  fetchState();
});

// 初始化
fetchState();
