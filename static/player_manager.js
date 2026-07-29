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
