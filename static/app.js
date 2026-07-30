// app.js — 前端主逻辑
let currentState = {};
let currentG1GroupIdx = null;
let currentG2GroupIdx = null;

// 主题切换
let currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  btn.textContent = currentTheme === 'dark' ? '☀️ 亮色' : '🌙 暗色';
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  updateThemeButton();
  // 重新渲染当前视图以应用新主题
  render();
});

updateThemeButton();

// Format switch
const formatSelect = document.getElementById('format-select');
formatSelect.addEventListener('change', async () => {
  const newFormat = formatSelect.value;
  await apiFetch('/api/switch_format', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ format: newFormat })
  });
  fetchState();
});

// Sync format select dropdown with current state
function syncFormatSelect() {
  const formatSelect = document.getElementById('format-select');
  formatSelect.value = currentState.current_format || 'cpt';
}

// Toast通知
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 模态输入框
function showModal(title) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h4>${title}</h4>
        <input type="text" placeholder="请输入..." autofocus>
        <div class="modal-buttons">
          <button class="btn-cancel">取消</button>
          <button class="btn-ok">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    input.focus();
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('.btn-ok').addEventListener('click', () => close(input.value.trim()));
    overlay.querySelector('.btn-cancel').addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close(null);
    });
  });
}

// API请求封装
async function apiFetch(url, options) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      showToast(data.error || '操作失败', 'error');
      return null;
    }
    return data;
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
    return null;
  }
}

// 获取状态
async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) { showToast('无法加载数据', 'error'); return; }
    currentState = await res.json();
    render();
  } catch (err) {
    showToast('无法连接服务器', 'error');
  }
}

// 主渲染函数
function render() {
  syncFormatSelect();
  renderTabs();
  renderPlayerManager();

  const format = currentState.current_format || 'cpt';
  if (format === 'cpt') {
    renderGroup1();
    renderGroup2();
    renderElimination();
  } else {
    renderDoubleElim32();
  }

  renderUndoRedo();
  updateReRandomButton();
}

// Tab状态
function renderTabs() {
  const format = currentState.current_format || 'cpt';
  const tabNav = document.getElementById('tabs');

  // Reset all tab-content active state, default to players tab
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-players').classList.add('active');

  if (format === 'cpt') {
    tabNav.innerHTML = `
      <button class="tab active" data-tab="players">选手管理</button>
      <button class="tab" data-tab="group1" disabled>小组赛第一轮</button>
      <button class="tab" data-tab="group2" disabled>小组赛第二轮</button>
      <button class="tab" data-tab="elimination" disabled>16人淘汰赛</button>
    `;
    // CPT tab enable/disable logic
    const g1 = currentState.groupStage1;
    const g2 = currentState.groupStage2;
    document.querySelector('[data-tab="group1"]').disabled = !(g1.groups && g1.groups.length > 0);
    const g1Complete = g1.locked && g1.groups.every(g => g.first && g.second);
    document.querySelector('[data-tab="group2"]').disabled = !(g2.locked || g1Complete);
    document.querySelector('[data-tab="elimination"]').disabled = !(currentState.elimination.locked || (g2.locked && g2.groups.every(g => g.first)));
  } else {
    tabNav.innerHTML = `
      <button class="tab active" data-tab="players">选手管理</button>
      <button class="tab" data-tab="round1" disabled>初始配对</button>
      <button class="tab" data-tab="winners" disabled>胜者组</button>
      <button class="tab" data-tab="losers" disabled>败者组</button>
      <button class="tab" data-tab="final8" disabled>8强/总决赛</button>
    `;
    // 32-player format tab enable/disable logic
    const round1Matches = (currentState.round1 && currentState.round1.matches) || [];
    const round1Done = round1Matches.length > 0;
    document.querySelector('[data-tab="round1"]').disabled = !round1Done;
    document.querySelector('[data-tab="winners"]').disabled = !round1Done;
    document.querySelector('[data-tab="losers"]').disabled = !round1Done;
    const final8 = currentState.final_8 || {};
    const grandFinal = currentState.grand_final || {};
    const hasFinal8 = (final8.qf && final8.qf.length > 0);
    const hasGrandFinal = grandFinal.match && grandFinal.match.p1;
    const shuffleTop8 = currentState.shuffle_top8;
    const winnersChamp = (currentState.winners || {}).champion;
    const losersChamp = (currentState.losers || {}).champion;
    const hasBothChampions = winnersChamp && losersChamp;
    document.querySelector('[data-tab="final8"]').disabled = !(hasFinal8 || hasGrandFinal || hasBothChampions);
  }

  // Re-attach tab click handlers
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      updateReRandomButton();
    });
  });
}

// 撤销/重做状态
function renderUndoRedo() {
  document.getElementById('btn-undo').disabled = (currentState.historyIndex || 0) <= 0;
  document.getElementById('btn-redo').disabled = (currentState.historyIndex || 0) >= (currentState.historyLen || 1) - 1;
}

// 撤销/重做
document.getElementById('btn-undo').addEventListener('click', async () => {
  await apiFetch('/api/undo', { method: 'POST' });
  fetchState();
});
document.getElementById('btn-redo').addEventListener('click', async () => {
  await apiFetch('/api/redo', { method: 'POST' });
  fetchState();
});

// 导出/导入
document.getElementById('btn-export').addEventListener('click', () => { window.location.href = '/api/export'; });
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const data = await apiFetch('/api/import', { method: 'POST', body: formData });
  if (data) { showToast('导入成功', 'success'); fetchState(); }
  e.target.value = '';
});

// 测试数据
document.getElementById('btn-test').addEventListener('click', async () => {
  if (!confirm('添加48名测试选手？现有数据将被覆盖。')) return;
  const data = await apiFetch('/api/test_players', { method: 'POST' });
  if (data) { showToast(data.message, 'success'); fetchState(); }
});

// 重置
document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('确定重置？当前数据将备份为JSON文件。')) return;
  const data = await apiFetch('/api/reset', { method: 'POST' });
  if (data) { showToast(data.message, 'success'); fetchState(); }
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('btn-redo').click(); }
});

// ============================================================
// 小组赛第一轮
// ============================================================
function renderGroup1() {
  const g1 = currentState.groupStage1;
  const listView = document.getElementById('g1-list-view');
  const detailView = document.getElementById('g1-detail-view');

  // 状态1：未分组
  if (!g1.groups || g1.groups.length === 0) {
    currentG1GroupIdx = null;
    listView.style.display = '';
    detailView.style.display = 'none';
    listView.innerHTML = '<p class="de32-status">请先在"选手管理"中完成随机分组</p>';
    return;
  }

  // 状态2：已分组但未锁定（预览确认界面）
  if (!g1.locked) {
    currentG1GroupIdx = null;
    listView.style.display = '';
    detailView.style.display = 'none';
    renderGroupPreview(listView, g1.groups, 'group1');
    return;
  }

  // 状态3：已锁定，显示详情
  if (currentG1GroupIdx !== null && currentG1GroupIdx < g1.groups.length) {
    listView.style.display = 'none';
    detailView.style.display = '';
    document.getElementById('g1-detail-title').textContent = `第${currentG1GroupIdx + 1}组`;
    renderDoubleEliminationBracket(document.getElementById('g1-bracket-svg'), g1.groups[currentG1GroupIdx], currentG1GroupIdx);
    return;
  }

  listView.style.display = '';
  detailView.style.display = 'none';
  listView.innerHTML = g1.groups.map((g, i) => `
    <div class="group-card" data-idx="${i}">
      <h4>第${i + 1}组</h4>
      ${g.playerIds.map(pid => `<div class="group-player">${getPlayerName(pid)}</div>`).join('')}
      ${g.first ? `<div class="result first">第1: ${getPlayerName(g.first)}</div>` : ''}
      ${g.second ? `<div class="result second">第2: ${getPlayerName(g.second)}</div>` : ''}
    </div>
  `).join('');

  listView.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => {
      currentG1GroupIdx = parseInt(card.dataset.idx);
      renderGroup1();
    });
  });
}

// 分组预览确认界面（换位模式）
let swapMode = false;
let swapFirst = null; // {playerId, groupIdx}

function renderGroupPreview(container, groups, stage) {
  swapMode = false;
  swapFirst = null;

  container.innerHTML = `
    <div class="preview-header">
      <p class="section-title">分组预览</p>
      <div class="preview-actions">
        <button class="secondary-btn" id="btn-swap-mode">换位</button>
        <button class="primary-btn" id="btn-confirm-groups">确认分组</button>
        <button class="secondary-btn" id="btn-reshuffle">重新随机</button>
      </div>
    </div>
    <div id="swap-hint" style="display:none;color:var(--color-accent);font-size:0.8rem;margin-bottom:0.75rem;"></div>
    <div class="group-preview-grid" id="group-preview-grid">
      ${groups.map((g, i) => `
        <div class="group-preview-card" data-group-idx="${i}">
          <h4>第${i + 1}组</h4>
          <div class="group-preview-players" data-group-idx="${i}">
            ${(g.playerIds || g.players?.map(p => p.playerId) || []).map(pid => `
              <div class="player-card" data-player-id="${pid}" data-group-idx="${i}">
                <span class="player-name">${getPlayerName(pid)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const swapBtn = container.querySelector('#btn-swap-mode');
  const hintEl = container.querySelector('#swap-hint');

  // 换位按钮
  swapBtn.addEventListener('click', () => {
    swapMode = !swapMode;
    swapFirst = null;
    if (swapMode) {
      swapBtn.textContent = '取消换位';
      swapBtn.style.background = 'var(--color-accent)';
      swapBtn.style.color = '#fff';
      hintEl.style.display = '';
      hintEl.textContent = '请点击第一个选手';
      container.querySelectorAll('.player-card').forEach(c => c.style.cursor = 'pointer');
    } else {
      swapBtn.textContent = '换位';
      swapBtn.style.background = '';
      swapBtn.style.color = '';
      hintEl.style.display = 'none';
      container.querySelectorAll('.player-card').forEach(c => {
        c.style.cursor = '';
        c.classList.remove('selected');
      });
    }
  });

  // 选手点击（换位模式）
  container.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', async () => {
      if (!swapMode) return;

      const pid = card.dataset.playerId;
      const gIdx = parseInt(card.dataset.groupIdx);

      if (!swapFirst) {
        // 选择第一个
        swapFirst = { playerId: pid, groupIdx: gIdx };
        card.classList.add('selected');
        hintEl.textContent = `已选 ${getPlayerName(pid)}，请点击第二个选手`;
      } else {
        // 选择第二个
        if (swapFirst.groupIdx === gIdx) {
          hintEl.textContent = '必须选择不同组的选手！';
          return;
        }

        hintEl.textContent = `交换中...`;
        await apiFetch('/api/swap_players', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            stage,
            player1Id: swapFirst.playerId,
            group1: swapFirst.groupIdx,
            player2Id: pid,
            group2: gIdx
          })
        });

        swapMode = false;
        swapFirst = null;
        fetchState();
      }
    });
  });

  // 确认分组
  container.querySelector('#btn-confirm-groups').addEventListener('click', async () => {
    await apiFetch('/api/confirm_groups', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ stage })
    });
    showToast('分组已确认', 'success');
    fetchState();
  });

  // 重新随机（带确认）
  container.querySelector('#btn-reshuffle').addEventListener('click', async () => {
    if (!confirm('确定重新随机？当前分组将被覆盖。')) return;
    await apiFetch('/api/randomize', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ stage })
    });
    fetchState();
  });
}

document.getElementById('g1-back').addEventListener('click', () => {
  currentG1GroupIdx = null;
  renderGroup1();
});

// ============================================================
// 小组赛第二轮
// ============================================================
function renderGroup2() {
  const g2 = currentState.groupStage2;
  const listView = document.getElementById('g2-list-view');
  const detailView = document.getElementById('g2-detail-view');

  if (!g2.locked) {
    currentG2GroupIdx = null;
    listView.style.display = '';
    detailView.style.display = 'none';
    // 已有分组数据 → 显示预览确认界面
    if (g2.groups && g2.groups.length > 0) {
      renderGroupPreview(listView, g2.groups, 'group2');
      return;
    }
    // 未分组 → 检查第一轮是否完成
    const g1 = currentState.groupStage1;
    if (g1.locked && g1.groups.every(g => g.first && g.second)) {
      listView.innerHTML = '<button class="primary-btn" id="btn-promote-g2">晋级第二轮</button>';
      document.getElementById('btn-promote-g2').addEventListener('click', async () => {
        const data = await apiFetch('/api/randomize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ stage: 'group2' }) });
        if (data) { showToast('第二轮分组完成，请确认', 'success'); fetchState(); }
      });
    } else {
      listView.innerHTML = '<p class="de32-status">等待小组赛第一轮全部完成</p>';
    }
    return;
  }

  if (currentG2GroupIdx !== null && currentG2GroupIdx < g2.groups.length) {
    listView.style.display = 'none';
    detailView.style.display = '';
    document.getElementById('g2-detail-title').textContent = `第二轮 第${currentG2GroupIdx + 1}组`;
    renderRanking(g2.groups[currentG2GroupIdx], currentG2GroupIdx);
    return;
  }

  listView.style.display = '';
  detailView.style.display = 'none';
  listView.innerHTML = g2.groups.map((g, i) => `
    <div class="group-card" data-idx="${i}">
      <h4>第二轮 第${i + 1}组</h4>
      ${g.players.map(p => `<div class="group-player">${getPlayerName(p.playerId)} (${p.wins}胜${p.losses}负)</div>`).join('')}
      ${g.first ? `<div class="result first">第1: ${getPlayerName(g.first)}</div>` : ''}
    </div>
  `).join('');

  listView.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => {
      currentG2GroupIdx = parseInt(card.dataset.idx);
      renderGroup2();
    });
  });
}

function renderRanking(group, groupIdx) {
  const container = document.getElementById('g2-ranking');
  container.innerHTML = `
    <div class="ranking-list">
      ${group.players.map((p, i) => `
        <div class="ranking-card" draggable="true" data-idx="${i}">
          <span class="rank-num">${i + 1}.</span>
          <span class="rank-name">${getPlayerName(p.playerId)}</span>
          <input type="number" class="rank-input" data-field="wins" value="${p.wins}" min="0"> 胜
          <input type="number" class="rank-input" data-field="losses" value="${p.losses}" min="0"> 负
        </div>
      `).join('')}
    </div>
    <p class="drag-hint">拖拽调整排名 · 第1名晋级淘汰赛</p>
  `;

  container.querySelectorAll('.rank-input').forEach(input => {
    input.addEventListener('change', async () => {
      const idx = parseInt(input.closest('.ranking-card').dataset.idx);
      group.players[idx][input.dataset.field] = parseInt(input.value) || 0;
      group.first = group.players[0].playerId;
      await apiFetch('/api/ranking', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIdx, players: group.players }) });
      fetchState();
    });
  });

  let dragIdx = null;
  container.querySelectorAll('.ranking-card').forEach(card => {
    card.addEventListener('dragstart', (e) => { dragIdx = parseInt(card.dataset.idx); card.style.opacity = '0.5'; });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
    card.addEventListener('dragover', (e) => { e.preventDefault(); });
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dropIdx = parseInt(card.dataset.idx);
      if (dragIdx === null || dragIdx === dropIdx) return;
      const [moved] = group.players.splice(dragIdx, 1);
      group.players.splice(dropIdx, 0, moved);
      group.first = group.players[0].playerId;
      await apiFetch('/api/ranking', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIdx, players: group.players }) });
      fetchState();
    });
  });
}

document.getElementById('g2-back').addEventListener('click', () => {
  currentG2GroupIdx = null;
  renderGroup2();
});

// ============================================================
// 16人淘汰赛
// ============================================================
function renderElimination() {
  const el = currentState.elimination;
  const g2 = currentState.groupStage2;
  const container = document.getElementById('elim-bracket-svg');
  const btnRandom = document.getElementById('btn-randomize-elim');

  if (!el.locked) {
    const stage2Complete = g2.locked && g2.groups.every(g => g.first);
    if (el.bracket.r16 && el.bracket.r16.length > 0) {
      btnRandom.style.display = 'none';
      renderEliminationBracket(container, el.bracket);
      return;
    }
    btnRandom.style.display = stage2Complete ? '' : 'none';
    container.innerHTML = stage2Complete ? '<p class="de32-status">点击"随机签位"开始淘汰赛</p>' : '<p class="de32-status">等待小组赛第二轮完成</p>';
    return;
  }

  btnRandom.style.display = 'none';
  renderEliminationBracket(container, el.bracket);
}

// ============================================================
// 32人淘汰赛 (double_elim_32)
// ============================================================
function renderDoubleElim32() {
  const format = currentState.current_format || 'cpt';
  if (format !== 'double_elim_32') return;

  const round1Container = document.getElementById('round1-content');
  const winnersContainer = document.getElementById('winners-content');
  const losersContainer = document.getElementById('losers-content');
  const final8Container = document.getElementById('final8-content');

  const round1Matches = (currentState.round1 && currentState.round1.matches) || [];

  // --- Round 1 (initial pairs) ---
  if (round1Matches.length === 0) {
    // Setup stage: show randomize button
    const players = currentState.players || [];
    if (players.length >= 32) {
      round1Container.innerHTML = `
        <div class="de32-action">
          <button class="primary-btn" id="btn-randomize-de32">随机配对 (32人)</button>
          <div id="de32-error" class="error-msg"></div>
        </div>`;
      document.getElementById('btn-randomize-de32')?.addEventListener('click', async () => {
        const data = await apiFetch('/api/double_elim/randomize', { method: 'POST' });
        if (data) { showToast('32人淘汰赛配对完成', 'success'); fetchState(); }
      });
    } else {
      round1Container.innerHTML = `<p class="de32-status">需要恰好32名选手，当前 ${players.length} 名</p>`;
    }
  } else {
    // Round 1 has matches: render SVG bracket
    renderRound1(round1Container, round1Matches);

    // Show confirm button when all matches have winners and tournament not yet confirmed
    const allHaveWinners = round1Matches.every(m => m.winner);
    const isConfirmed = currentState.locked || (currentState.stage && currentState.stage !== 'setup');
    if (allHaveWinners && !isConfirmed) {
      const confirmDiv = document.createElement('div');
      confirmDiv.className = 'confirm-section';
      confirmDiv.innerHTML = `
        <label class="checkbox-label">
          <input type="checkbox" id="shuffle-top8-check"> 随机打乱8强配对
        </label>
        <button class="primary-btn" id="btn-confirm-round1">确认配对并开始淘汰赛</button>
      `;
      round1Container.appendChild(confirmDiv);
      document.getElementById('btn-confirm-round1')?.addEventListener('click', async () => {
        const shuffleTop8 = document.getElementById('shuffle-top8-check').checked;
        const data = await apiFetch('/api/double_elim/confirm', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ shuffle_top8: shuffleTop8 })
        });
        if (data) { showToast('配对已确认，淘汰赛开始', 'success'); fetchState(); }
      });
    }
  }

  // --- Winners bracket ---
  const winners = currentState.winners || {};
  const winnersR16 = winners.r16 || [];
  if (winnersR16.length > 0) {
    renderWinnersBracket(winnersContainer, winners);
  } else {
    winnersContainer.innerHTML = '<p class="de32-status">等待初始配对确认</p>';
  }

  // --- Losers bracket ---
  const losers = currentState.losers || {};
  const losersR16 = losers.r16 || [];
  if (losersR16.length > 0) {
    renderLosersBracket(losersContainer, losers);
  } else {
    losersContainer.innerHTML = '<p class="de32-status">等待初始配对确认</p>';
  }

  // --- Final 8 / Grand Final ---
  const final8 = currentState.final_8 || {};
  const final8QF = final8.qf || [];
  const grandFinal = currentState.grand_final || {};
  const shuffleTop8 = currentState.shuffle_top8;

  if (grandFinal.match && grandFinal.match.p1) {
    // Grand Final exists: render it
    renderGrandFinal(final8Container, grandFinal);
  } else if (final8QF.length > 0) {
    // Final 8 bracket exists: render it
    renderFinal8(final8Container, final8);
  } else {
    // No final 8 or grand final yet
    const winnersChamp = winners.champion;
    const losersChamp = losers.champion;
    const hasBothChampions = winnersChamp && losersChamp;

    if (shuffleTop8) {
      // Shuffle mode: show "生成8强对阵" after R8 is done
      const winnersR8 = winners.r8 || [];
      const losersR8 = losers.r8 || [];
      const winnersR8Done = winnersR8.length > 0 && winnersR8.every(m => m.winner);
      const losersR8Done = losersR8.length > 0 && losersR8.every(m => m.winner);

      if (winnersR8Done && losersR8Done) {
        final8Container.innerHTML = `
          <div class="de32-action">
            <p class="de32-status" style="margin-bottom:0.5rem;">胜者组和败者组8强已产生</p>
            <button class="primary-btn" id="btn-create-final8">生成8强对阵</button>
          </div>`;
        document.getElementById('btn-create-final8')?.addEventListener('click', async () => {
          const data = await apiFetch('/api/double_elim/shuffle_top8', { method: 'POST' });
          if (data) { showToast('8强对阵已生成', 'success'); fetchState(); }
        });
      } else if (winnersR16.length > 0) {
        final8Container.innerHTML = '<p class="de32-status">等待胜者组/败者组8强完成</p>';
      } else {
        final8Container.innerHTML = '<p class="de32-status">等待初始配对确认</p>';
      }
    } else {
      // Complete mode: grand final is auto-created when both champions exist
      if (hasBothChampions) {
        // Grand final should have been auto-created by backend, refresh state
        fetchState();
      } else if (winnersR16.length > 0) {
        final8Container.innerHTML = '<p class="de32-status">等待胜者组和败者组冠军产生（请在胜者组/败者组Tab完成所有比赛）</p>';
      } else {
        final8Container.innerHTML = '<p class="de32-status">等待初始配对确认</p>';
      }
    }
  }
}

// 重新随机按钮（根据当前Tab决定重新随机哪个阶段，选手管理Tab不显示）
function updateReRandomButton() {
  const btnReRandom = document.getElementById('btn-randomize-elim-again');
  const activeTab = document.querySelector('.tab.active');
  const tabName = activeTab?.dataset.tab;
  const format = currentState.current_format || 'cpt';

  // 选手管理Tab不显示
  if (tabName === 'players') {
    btnReRandom.style.display = 'none';
    return;
  }

  if (format === 'cpt') {
    // CPT format
    const g1 = currentState.groupStage1;
    const g2 = currentState.groupStage2;
    const el = currentState.elimination;

    if (tabName === 'group1' && g1.groups && g1.groups.length > 0) {
      btnReRandom.style.display = '';
      btnReRandom.textContent = '重新随机';
      return;
    }
    if (tabName === 'group2' && g2.groups && g2.groups.length > 0) {
      btnReRandom.style.display = '';
      btnReRandom.textContent = '重新随机';
      return;
    }
    if (tabName === 'elimination' && el.bracket.r16 && el.bracket.r16.length > 0) {
      btnReRandom.style.display = '';
      btnReRandom.textContent = '重新随机';
      return;
    }
  } else {
    // 32-player format
    const round1Matches = (currentState.round1 && currentState.round1.matches) || [];
    if (tabName === 'round1' && round1Matches.length > 0) {
      btnReRandom.style.display = '';
      btnReRandom.textContent = '重新随机';
      return;
    }
  }

  btnReRandom.style.display = 'none';
}

document.getElementById('btn-randomize-elim').addEventListener('click', async () => {
  const data = await apiFetch('/api/randomize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ stage: 'elimination' }) });
  if (data) { showToast('淘汰赛签位已生成，请确认', 'success'); fetchState(); }
});

document.getElementById('btn-randomize-elim-again').addEventListener('click', async () => {
  const activeTab = document.querySelector('.tab.active');
  const tabName = activeTab?.dataset.tab;

  if (tabName === 'group1') {
    if (!confirm('确定重新随机小组赛第一轮？当前分组将被覆盖。')) return;
    const data = await apiFetch('/api/randomize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ stage: 'group1' }) });
    if (data) { showToast('第一轮分组已重新随机', 'success'); fetchState(); }
  } else if (tabName === 'group2') {
    if (!confirm('确定重新随机小组赛第二轮？当前分组将被覆盖。')) return;
    const data = await apiFetch('/api/randomize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ stage: 'group2' }) });
    if (data) { showToast('第二轮分组已重新随机', 'success'); fetchState(); }
  } else if (tabName === 'elimination') {
    if (!confirm('确定重新随机淘汰赛签位？当前进度将丢失。')) return;
    await apiFetch('/api/reset_elimination', { method: 'POST' });
    const data = await apiFetch('/api/randomize', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ stage: 'elimination' }) });
    if (data) { showToast('淘汰赛签位已重新生成', 'success'); fetchState(); }
  } else if (tabName === 'round1') {
    if (!confirm('确定重新随机32人淘汰赛配对？当前进度将丢失。')) return;
    const data = await apiFetch('/api/double_elim/randomize', { method: 'POST' });
    if (data) { showToast('32人淘汰赛配对已重新生成', 'success'); fetchState(); }
  }
});

// 初始化
fetchState();
