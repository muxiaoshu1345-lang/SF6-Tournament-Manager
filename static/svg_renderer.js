// svg_renderer.js — SVG对战图渲染（基于diagrams设计规范）
const SVG_NS = 'http://www.w3.org/2000/svg';

// 设计规范常量
const CARD_W = 128, CARD_H = 24, GAP = 8;
const CONNECTOR_COLOR = '#4f5d75';
const CONNECTOR_WIDTH = 1;
const ACCENT_COLOR = '#eb6c36';
const ACCENT_FILL = 'rgba(235,108,54,0.12)';
const INK_COLOR = '#2d3142';
const MUTED_COLOR = '#4f5d75';
const SOFT_COLOR = '#7a8399';

function getPlayerName(playerId) {
  if (!playerId) return '待定';
  const p = currentState.players.find(p => p.id === playerId);
  return p ? p.name : playerId;
}

/**
 * 创建选手卡片（diagrams风格）
 * - 默认：白色背景，无彩色描边
 * - 赢家：accent彩色描边
 * - 败者：半透明灰色
 */
function createSvgCard(svg, x, y, playerId, score, isWinner, isLoser, stage, groupIdx, roundKey, matchIdx) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);

  // 背景矩形
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', CARD_W);
  rect.setAttribute('height', CARD_H);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isWinner ? ACCENT_FILL : '#ffffff');
  rect.setAttribute('stroke', isWinner ? ACCENT_COLOR : isLoser ? 'rgba(45,49,66,0.10)' : 'rgba(45,49,66,0.20)');
  rect.setAttribute('stroke-width', isWinner ? 1.5 : 1);
  rect.style.cursor = playerId ? 'pointer' : 'default';
  g.appendChild(rect);

  // 选手名
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', 8);
  text.setAttribute('y', 16);
  text.setAttribute('fill', isWinner ? ACCENT_COLOR : isLoser ? SOFT_COLOR : INK_COLOR);
  text.setAttribute('font-size', '11');
  text.setAttribute('font-weight', isWinner ? '600' : '400');
  text.setAttribute('font-family', "'Geist', sans-serif");
  text.textContent = getPlayerName(playerId);
  g.appendChild(text);

  // 比分输入框
  if (playerId) {
    const scoreInput = document.createElementNS(SVG_NS, 'foreignObject');
    scoreInput.setAttribute('x', CARD_W - 24);
    scoreInput.setAttribute('y', 2);
    scoreInput.setAttribute('width', 20);
    scoreInput.setAttribute('height', 20);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = score || 0;
    input.style.cssText = `width:20px;height:20px;text-align:center;background:transparent;color:${isWinner ? ACCENT_COLOR : INK_COLOR};border:1px solid rgba(45,49,66,0.12);border-radius:2px;font-size:10px;font-family:'Geist Mono',monospace;`;
    input.addEventListener('change', () => {
      updateScore(stage, groupIdx, roundKey, matchIdx, input.value, playerId);
    });
    input.addEventListener('click', (e) => { e.stopPropagation(); });
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

/**
 * 添加SVG线段
 */
function addLine(svg, x1, y1, x2, y2, color, width) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', color || CONNECTOR_COLOR);
  line.setAttribute('stroke-width', width || CONNECTOR_WIDTH);
  svg.appendChild(line);
}

/**
 * 画一场比赛到下一轮的连线（diagrams风格）
 *
 * 模式：
 *   Card1 右侧中心 → 水平到合并X → 垂直到合并中心
 *   Card2 右侧中心 → 水平到合并X → 垂直到合并中心
 *   合并中心 → 水平到目标X → 垂直到目标中心
 */
function drawMatchConnector(svg, cardRightX, card1CenterY, card2CenterY, targetLeftX, targetCenterY, color) {
  const mergeX = cardRightX + 28;
  const mergeY = Math.round((card1CenterY + card2CenterY) / 2);
  const c = color || CONNECTOR_COLOR;
  const w = color ? 1.5 : CONNECTOR_WIDTH;

  // Card1 → 合并点
  addLine(svg, cardRightX, card1CenterY, mergeX, card1CenterY, c, w);
  addLine(svg, mergeX, card1CenterY, mergeX, mergeY, c, w);

  // Card2 → 合并点
  addLine(svg, cardRightX, card2CenterY, mergeX, card2CenterY, c, w);
  addLine(svg, mergeX, card2CenterY, mergeX, mergeY, c, w);

  // 合并点 → 目标
  addLine(svg, mergeX, mergeY, targetLeftX, mergeY, c, w);
  if (Math.abs(mergeY - targetCenterY) > 1) {
    addLine(svg, targetLeftX, mergeY, targetLeftX, targetCenterY, c, w);
  }
}

/**
 * 创建结果卡片（带accent描边）
 */
function createResultCard(svg, x, y, playerName, label, isPrimary) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', CARD_W);
  rect.setAttribute('height', CARD_H);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isPrimary ? ACCENT_FILL : 'rgba(235,108,54,0.06)');
  rect.setAttribute('stroke', ACCENT_COLOR);
  rect.setAttribute('stroke-width', isPrimary ? 1.5 : 1);
  g.appendChild(rect);

  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', 8);
  t.setAttribute('y', 16);
  t.setAttribute('fill', ACCENT_COLOR);
  t.setAttribute('font-size', '11');
  t.setAttribute('font-weight', '600');
  t.setAttribute('font-family', "'Geist', sans-serif");
  t.textContent = playerName;
  g.appendChild(t);

  const t2 = document.createElementNS(SVG_NS, 'text');
  t2.setAttribute('x', CARD_W - 8);
  t2.setAttribute('y', 16);
  t2.setAttribute('fill', ACCENT_COLOR);
  t2.setAttribute('font-size', '9');
  t2.setAttribute('text-anchor', 'end');
  t2.setAttribute('font-family', "'Geist Mono', monospace");
  t2.textContent = label;
  g.appendChild(t2);

  svg.appendChild(g);
}

// ============================================================
// 小组赛第一轮 - 4人双败淘汰赛
// ============================================================
function renderDoubleEliminationBracket(container, group, groupIdx) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 700 400');
  svg.style.background = '#ffffff';
  svg.style.borderRadius = '6px';
  svg.style.border = '1px solid rgba(45,49,66,0.12)';

  const bracket = group.bracket;
  const r1 = bracket.r1;
  const wr1 = bracket.wr1;
  const lr1 = bracket.lr1;
  const lr2 = bracket.lr2;

  // 布局常量
  const R1_X = 20, R1_Y0 = 30, R1_Y1 = 110;
  const WR1_X = 240, WR1_Y = 50;
  const LR1_X = 20, LR1_Y = 210;
  const LR2_X = 240, LR2_Y = 270;
  const RESULT_X = 460;

  // ========== 连线 ==========
  // R1[0] → WR1上
  drawMatchConnector(svg, R1_X + CARD_W, R1_Y0 + CARD_H / 2, R1_Y0 + CARD_H + GAP + CARD_H / 2, WR1_X, WR1_Y + CARD_H / 2);
  // R1[1] → WR1下
  drawMatchConnector(svg, R1_X + CARD_W, R1_Y1 + CARD_H / 2, R1_Y1 + CARD_H + GAP + CARD_H / 2, WR1_X, WR1_Y + CARD_H + GAP + CARD_H / 2);
  // R1[0] → LR1上
  drawMatchConnector(svg, R1_X + CARD_W, R1_Y0 + CARD_H / 2, R1_Y0 + CARD_H + GAP + CARD_H / 2, LR1_X, LR1_Y + CARD_H / 2);
  // R1[1] → LR1下
  drawMatchConnector(svg, R1_X + CARD_W, R1_Y1 + CARD_H / 2, R1_Y1 + CARD_H + GAP + CARD_H / 2, LR1_X, LR1_Y + CARD_H + GAP + CARD_H / 2);
  // LR1 → LR2上
  drawMatchConnector(svg, LR1_X + CARD_W, LR1_Y + CARD_H / 2, LR1_Y + CARD_H + GAP + CARD_H / 2, LR2_X, LR2_Y + CARD_H / 2);
  // WR1 → LR2下
  drawMatchConnector(svg, WR1_X + CARD_W, WR1_Y + CARD_H / 2, WR1_Y + CARD_H + GAP + CARD_H / 2, LR2_X, LR2_Y + CARD_H + GAP + CARD_H / 2);

  // ========== 卡片 ==========
  // R1[0]
  createSvgCard(svg, R1_X, R1_Y0, r1[0].p1, r1[0].score1, r1[0].winner === r1[0].p1, r1[0].winner && r1[0].winner !== r1[0].p1, 'group1', groupIdx, 'r1', 0);
  createSvgCard(svg, R1_X, R1_Y0 + CARD_H + GAP, r1[0].p2, r1[0].score2, r1[0].winner === r1[0].p2, r1[0].winner && r1[0].winner !== r1[0].p2, 'group1', groupIdx, 'r1', 0);
  // R1[1]
  createSvgCard(svg, R1_X, R1_Y1, r1[1].p1, r1[1].score1, r1[1].winner === r1[1].p1, r1[1].winner && r1[1].winner !== r1[1].p1, 'group1', groupIdx, 'r1', 1);
  createSvgCard(svg, R1_X, R1_Y1 + CARD_H + GAP, r1[1].p2, r1[1].score2, r1[1].winner === r1[1].p2, r1[1].winner && r1[1].winner !== r1[1].p2, 'group1', groupIdx, 'r1', 1);
  // WR1
  createSvgCard(svg, WR1_X, WR1_Y, wr1.p1, wr1.score1, wr1.winner === wr1.p1, wr1.winner && wr1.winner !== wr1.p1, 'group1', groupIdx, 'wr1', null);
  createSvgCard(svg, WR1_X, WR1_Y + CARD_H + GAP, wr1.p2, wr1.score2, wr1.winner === wr1.p2, wr1.winner && wr1.winner !== wr1.p2, 'group1', groupIdx, 'wr1', null);
  // LR1
  createSvgCard(svg, LR1_X, LR1_Y, lr1.p1, lr1.score1, lr1.winner === lr1.p1, lr1.winner && lr1.winner !== lr1.p1, 'group1', groupIdx, 'lr1', null);
  createSvgCard(svg, LR1_X, LR1_Y + CARD_H + GAP, lr1.p2, lr1.score2, lr1.winner === lr1.p2, lr1.winner && lr1.winner !== lr1.p2, 'group1', groupIdx, 'lr1', null);
  // LR2
  createSvgCard(svg, LR2_X, LR2_Y, lr2.p1, lr2.score1, lr2.winner === lr2.p1, lr2.winner && lr2.winner !== lr2.p1, 'group1', groupIdx, 'lr2', null);
  createSvgCard(svg, LR2_X, LR2_Y + CARD_H + GAP, lr2.p2, lr2.score2, lr2.winner === lr2.p2, lr2.winner && lr2.winner !== lr2.p2, 'group1', groupIdx, 'lr2', null);

  // ========== 结果卡片 ==========
  if (group.first) {
    createResultCard(svg, RESULT_X, WR1_Y, '🏆 ' + getPlayerName(group.first), '第1名', true);
  }
  if (group.second) {
    createResultCard(svg, RESULT_X, LR2_Y, '🥈 ' + getPlayerName(group.second), '第2名', false);
  }

  // 列标签
  const labelY = 16;
  addText(svg, R1_X + CARD_W / 2, labelY, 'R1', SOFT_COLOR, 8, 'middle');
  addText(svg, WR1_X + CARD_W / 2, labelY, 'WR1', SOFT_COLOR, 8, 'middle');
  addText(svg, LR1_X + CARD_W / 2, LR1_Y - 8, 'LR1', SOFT_COLOR, 8, 'middle');
  addText(svg, LR2_X + CARD_W / 2, LR2_Y - 8, 'LR2', SOFT_COLOR, 8, 'middle');

  container.appendChild(svg);
}

// ============================================================
// 16人单败淘汰赛
// ============================================================
function renderEliminationBracket(container, bracket) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 900 640');
  svg.style.background = '#ffffff';
  svg.style.borderRadius = '6px';
  svg.style.border = '1px solid rgba(45,49,66,0.12)';

  const r16 = bracket.r16 || [];
  const r8 = bracket.r8 || [];
  const r4 = bracket.r4 || [];
  const final_ = bracket.final || {};

  // 布局常量
  const C_R16 = 16, C_R8 = 200, C_R4 = 400, C_FINAL = 580, C_CHAMP = 748;
  const r16_ys = [36, 100, 164, 228, 356, 420, 484, 548];
  const r8_ys = [68, 196, 388, 516];
  const r4_ys = [132, 452];
  const final_y = 304;

  // 列标签
  const labelY = 20;
  addText(svg, C_R16 + CARD_W / 2, labelY, '8强 · R16', SOFT_COLOR, 9, 'middle');
  addText(svg, C_R8 + CARD_W / 2, labelY, '4强 · R8', SOFT_COLOR, 9, 'middle');
  addText(svg, C_R4 + CARD_W / 2, labelY, '半决赛 · R4', SOFT_COLOR, 9, 'middle');
  addText(svg, C_FINAL + CARD_W / 2, labelY, '决赛 · Final', SOFT_COLOR, 9, 'middle');

  // ========== 连线 ==========
  // R16 → R8
  for (let i = 0; i < 8; i += 2) {
    const r8Idx = i / 2;
    drawMatchConnector(svg, C_R16 + CARD_W, r16_ys[i] + CARD_H / 2, r16_ys[i] + CARD_H + GAP + CARD_H / 2, C_R8, r8_ys[r8Idx] + CARD_H / 2);
    drawMatchConnector(svg, C_R16 + CARD_W, r16_ys[i + 1] + CARD_H / 2, r16_ys[i + 1] + CARD_H + GAP + CARD_H / 2, C_R8, r8_ys[r8Idx] + CARD_H + GAP + CARD_H / 2);
  }
  // R8 → R4
  for (let i = 0; i < 4; i += 2) {
    const r4Idx = i / 2;
    drawMatchConnector(svg, C_R8 + CARD_W, r8_ys[i] + CARD_H / 2, r8_ys[i] + CARD_H + GAP + CARD_H / 2, C_R4, r4_ys[r4Idx] + CARD_H / 2);
    drawMatchConnector(svg, C_R8 + CARD_W, r8_ys[i + 1] + CARD_H / 2, r8_ys[i + 1] + CARD_H + GAP + CARD_H / 2, C_R4, r4_ys[r4Idx] + CARD_H + GAP + CARD_H / 2);
  }
  // R4 → Final
  drawMatchConnector(svg, C_R4 + CARD_W, r4_ys[0] + CARD_H / 2, r4_ys[0] + CARD_H + GAP + CARD_H / 2, C_FINAL, final_y + CARD_H / 2);
  drawMatchConnector(svg, C_R4 + CARD_W, r4_ys[1] + CARD_H / 2, r4_ys[1] + CARD_H + GAP + CARD_H / 2, C_FINAL, final_y + CARD_H + GAP + CARD_H / 2);

  // Final → Champion（彩色连线）
  if (final_.winner) {
    const mergeX = C_FINAL + CARD_W + 28;
    const mergeY = final_y + CARD_H + GAP / 2;
    addLine(svg, C_FINAL + CARD_W, final_y + CARD_H / 2, mergeX, final_y + CARD_H / 2, ACCENT_COLOR, 1.5);
    addLine(svg, C_FINAL + CARD_W, final_y + CARD_H + GAP + CARD_H / 2, mergeX, final_y + CARD_H + GAP + CARD_H / 2, ACCENT_COLOR, 1.5);
    addLine(svg, mergeX, final_y + CARD_H / 2, mergeX, final_y + CARD_H + GAP + CARD_H / 2, ACCENT_COLOR, 1.5);
    addLine(svg, mergeX, mergeY, C_CHAMP, mergeY, ACCENT_COLOR, 1.5);
  }

  // ========== 卡片 ==========
  // R16
  for (let i = 0; i < 8; i++) {
    const match = r16[i] || {};
    createSvgCard(svg, C_R16, r16_ys[i], match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r16', i);
    createSvgCard(svg, C_R16, r16_ys[i] + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r16', i);
  }
  // R8
  for (let i = 0; i < 4; i++) {
    const match = r8[i] || {};
    createSvgCard(svg, C_R8, r8_ys[i], match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r8', i);
    createSvgCard(svg, C_R8, r8_ys[i] + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r8', i);
  }
  // R4
  for (let i = 0; i < 2; i++) {
    const match = r4[i] || {};
    createSvgCard(svg, C_R4, r4_ys[i], match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r4', i);
    createSvgCard(svg, C_R4, r4_ys[i] + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r4', i);
  }
  // Final
  createSvgCard(svg, C_FINAL, final_y, final_.p1, final_.score1, final_.winner === final_.p1, final_.winner && final_.winner !== final_.p1, 'elimination', 0, 'final', 0);
  createSvgCard(svg, C_FINAL, final_y + CARD_H + GAP, final_.p2, final_.score2, final_.winner === final_.p2, final_.winner && final_.winner !== final_.p2, 'elimination', 0, 'final', 0);

  // 冠军卡片
  if (final_.winner) {
    createResultCard(svg, C_CHAMP, final_y + 4, '🏆 ' + getPlayerName(final_.winner), 'CHAMPION', true);
  }

  container.appendChild(svg);
}

// 辅助函数：添加文本
function addText(svg, x, y, text, color, size, anchor) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('fill', color || INK_COLOR);
  t.setAttribute('font-size', size || 11);
  t.setAttribute('text-anchor', anchor || 'middle');
  t.setAttribute('font-family', "'Geist Mono', monospace");
  t.textContent = text;
  svg.appendChild(t);
}

// ============================================================
// 选择胜者和更新比分
// ============================================================
async function selectWinner(stage, groupIdx, roundKey, matchIdx, winnerId) {
  if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = roundKey === 'final' ? bracket.final : bracket[roundKey][matchIdx];
    await apiFetch('/api/match/result', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ stage: 'elimination', roundKey, matchIdx, winner: winnerId, score1: match.score1, score2: match.score2 })
    });
    fetchState();
    return;
  }
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
  await apiFetch('/api/match/result', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
  fetchState();
}

async function updateScore(stage, groupIdx, roundKey, matchIdx, score, playerId) {
  if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = roundKey === 'final' ? bracket.final : bracket[roundKey][matchIdx];
    const isP1 = match.p1 === playerId;
    await apiFetch('/api/match/result', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ stage: 'elimination', roundKey, matchIdx, winner: match.winner, score1: isP1 ? parseInt(score) : match.score1, score2: isP1 ? match.score2 : parseInt(score) })
    });
    fetchState();
    return;
  }
  const group = currentState.groupStage1.groups[groupIdx];
  const match = roundKey === 'r1' ? group.bracket.r1[matchIdx] : group.bracket[roundKey];
  const isP1 = match.p1 === playerId;
  await apiFetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ stage, groupIdx, matchKey: roundKey === 'r1' ? `r1_${matchIdx}` : roundKey, winner: match.winner, score1: isP1 ? parseInt(score) : match.score1, score2: isP1 ? match.score2 : parseInt(score) })
  });
  fetchState();
}
