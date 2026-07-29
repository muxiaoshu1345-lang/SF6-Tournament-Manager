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
