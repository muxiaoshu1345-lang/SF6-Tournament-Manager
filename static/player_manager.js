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
    const isDefault = pool.id === 'pool_default';
    card.innerHTML = `
      <div class="pool-header">
        <span>${pool.name} <span class="count">(${players.length}人)</span></span>
        <div>
          ${isDefault ? '' : '<button class="btn-delete-pool" data-id="' + pool.id + '">删除</button>'}
        </div>
      </div>
      <div class="pool-players" data-pool-id="${pool.id}">
        ${players.map(p => `
          <div class="player-card" draggable="true" data-player-id="${p.id}">
            <span class="player-name">${p.name}</span>
            <button class="btn-delete-player" data-id="${p.id}" title="删除选手">×</button>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });

  // 删除池
  container.querySelectorAll('.btn-delete-pool').forEach(btn => {
    btn.addEventListener('click', async () => {
      await apiFetch('/api/pools', {
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
          await apiFetch('/api/player/rename', {
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

  // 放置区（池）
  container.querySelectorAll('.pool-players').forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.background = 'rgba(235,108,54,0.15)'; });
    zone.addEventListener('dragleave', () => { zone.style.background = ''; });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.style.background = '';
      const playerId = e.dataTransfer.getData('text/plain');
      const poolId = zone.dataset.poolId;
      await apiFetch('/api/players', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'assign_pool', id: playerId, poolId: poolId })
      });
      fetchState();
    });
  });

  // 删除选手
  container.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const playerName = btn.closest('.player-card').querySelector('.player-name').textContent;
      if (!confirm(`确定删除选手 "${playerName}"？`)) return;
      await apiFetch('/api/players', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete', id: btn.dataset.id })
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
      <button class="btn-delete-player" data-id="${p.id}" title="删除选手">×</button>
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
          await apiFetch('/api/player/rename', {
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

  // 删除选手
  container.querySelectorAll('.btn-delete-player').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const playerName = btn.closest('.player-card').querySelector('.player-name').textContent;
      if (!confirm(`确定删除选手 "${playerName}"？`)) return;
      await apiFetch('/api/players', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete', id: btn.dataset.id })
      });
      fetchState();
    });
  });

  // 放置区（未分配区 - 移除选手的池分配）
  container.addEventListener('dragover', (e) => { e.preventDefault(); container.style.background = 'rgba(235,108,54,0.1)'; });
  container.addEventListener('dragleave', () => { container.style.background = ''; });
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.style.background = '';
    const playerId = e.dataTransfer.getData('text/plain');
    await apiFetch('/api/players', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'assign_pool', id: playerId, poolId: null })
    });
    fetchState();
  });
}

// CSV上传（每行一个选手名，自动分配到默认池）
document.getElementById('csv-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const data = await apiFetch('/api/players', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'import_csv', lines })
    });
    if (data) {
      const msg = data.skipped > 0
        ? `CSV导入成功，${lines.length - data.skipped} 名选手，跳过 ${data.skipped} 个重名`
        : `CSV导入成功 (${lines.length} 名选手)`;
      showToast(msg, data.skipped > 0 ? 'info' : 'success');
      fetchState();
    }
  } catch (err) {
    showToast('CSV文件读取失败: ' + err.message, 'error');
  }
  e.target.value = '';
});

// 手动添加
document.getElementById('btn-add-player').addEventListener('click', async () => {
  const name = document.getElementById('player-name-input').value.trim();
  const poolId = document.getElementById('pool-select').value || null;
  if (!name) return;
  await apiFetch('/api/players', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'add', id: `p_${Date.now()}`, name, poolId })
  });
  document.getElementById('player-name-input').value = '';
  fetchState();
});

// 新建池
document.getElementById('btn-create-pool').addEventListener('click', async () => {
  const name = await showModal('请输入池名：');
  if (!name) return;
  const poolId = 'pool_' + Date.now();
  const result = await apiFetch('/api/pools', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'create', id: poolId, name: name })
  });
  if (result) {
    showToast('池 "' + name + '" 创建成功', 'success');
  }
  fetchState();
});

// 随机分组
document.getElementById('btn-randomize-g1').addEventListener('click', async () => {
  const errEl = document.getElementById('randomize-error');
  errEl.textContent = '';
  try {
    const res = await fetch('/api/randomize', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ stage: 'group1' })
    });
    const data = await res.json();
    if (!data.ok) {
      errEl.textContent = data.error;
      showToast(data.error, 'error');
    } else {
      showToast('分组完成，请确认', 'success');
      fetchState();
      // 自动切换到小组赛第一轮Tab
      document.querySelector('[data-tab="group1"]').click();
    }
  } catch (err) {
    errEl.textContent = '网络错误: ' + err.message;
    showToast('网络错误: ' + err.message, 'error');
  }
});
