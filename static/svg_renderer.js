// svg_renderer.js — 直接使用diagrams的SVG模板，添加动态功能
const SVG_NS = 'http://www.w3.org/2000/svg';

function getPlayerName(playerId) {
  if (!playerId) return '待定';
  const p = currentState.players.find(p => p.id === playerId);
  return p ? p.name : playerId;
}

// 主题颜色
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    bg: isDark ? '#1a1a2e' : '#f5f5f5',
    cardBg: isDark ? '#22223a' : '#ffffff',
    cardStroke: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(45,49,66,0.20)',
    text: isDark ? '#e0e0e0' : '#2d3142',
    muted: isDark ? '#6a6a7a' : '#7a8399',
    connector: isDark ? '#4f5d75' : '#4f5d75',
    accent: '#eb6c36',
    accentFill: isDark ? 'rgba(235,108,54,0.15)' : 'rgba(235,108,54,0.12)',
    label: isDark ? '#8a8a9a' : '#7a8399'
  };
}

// ============================================================
// 小组赛第一轮 - 4人双败淘汰赛（使用diagrams模板）
// ============================================================
function renderDoubleEliminationBracket(container, group, groupIdx) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 860 520');
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.width = '100%';
  svg.style.minWidth = '860px';
  svg.style.display = 'block';
  const tc = getThemeColors();
  svg.style.background = tc.bg;
  svg.style.borderRadius = '6px';

  const bracket = group.bracket;
  const r1 = bracket.r1;
  const wr1 = bracket.wr1;
  const lr1 = bracket.lr1;
  const lr2 = bracket.lr2;

  // ========== 连线（基于实际卡片位置动态计算）==========
  const CARD_W = 148, CARD_H = 24, GAP = 8;
  const R1_X = 32, WR1_X = 280, LR1_X = 280, LR2_X = 520, RESULT_X = 700;
  const R1_Y0 = 36, R1_Y1 = 176;
  const WR1_Y = 128, LR1_Y = 288, LR2_Y = 384;

  // R1[0] 胜者 → WR1 上槽
  drawDiagramConnector(svg, R1_X + CARD_W, R1_Y0 + CARD_H / 2, R1_Y0 + CARD_H + GAP + CARD_H / 2, WR1_X, WR1_Y + CARD_H / 2);
  // R1[0] 败者 → LR1 上槽
  drawDiagramConnector(svg, R1_X + CARD_W, R1_Y0 + CARD_H / 2, R1_Y0 + CARD_H + GAP + CARD_H / 2, LR1_X, LR1_Y + CARD_H / 2, '#4f5d75', '4,3');
  // R1[1] 胜者 → WR1 下槽
  drawDiagramConnector(svg, R1_X + CARD_W, R1_Y1 + CARD_H / 2, R1_Y1 + CARD_H + GAP + CARD_H / 2, WR1_X, WR1_Y + CARD_H + GAP + CARD_H / 2);
  // R1[1] 败者 → LR1 下槽
  drawDiagramConnector(svg, R1_X + CARD_W, R1_Y1 + CARD_H / 2, R1_Y1 + CARD_H + GAP + CARD_H / 2, LR1_X, LR1_Y + CARD_H + GAP + CARD_H / 2, '#4f5d75', '4,3');
  // LR1 胜者 → LR2 上槽
  drawDiagramConnector(svg, LR1_X + CARD_W, LR1_Y + CARD_H / 2, LR1_Y + CARD_H + GAP + CARD_H / 2, LR2_X, LR2_Y + CARD_H / 2);
  // WR1 败者 → LR2 下槽
  drawDiagramConnector(svg, WR1_X + CARD_W, WR1_Y + CARD_H / 2, WR1_Y + CARD_H + GAP + CARD_H / 2, LR2_X, LR2_Y + CARD_H + GAP + CARD_H / 2, '#4f5d75', '4,3');
  // 第1名连线
  addLine(svg, WR1_X + CARD_W, WR1_Y + CARD_H / 2, RESULT_X, WR1_Y + CARD_H / 2, '#eb6c36', 1);
  // 第2名连线
  addLine(svg, LR2_X + CARD_W, LR2_Y + CARD_H / 2 + GAP / 2, RESULT_X, LR2_Y + CARD_H / 2 + GAP / 2, '#eb6c36', 1);

  // ========== 节点（动态数据）==========
  // 胜者组标签
  addText(svg, 32, 24, 'WINNERS BRACKET', '#4f5d75', 9, 'start', '0.14em');

  // R1[0]: A vs B
  createDiagramCard(svg, 32, 36, r1[0].p1, r1[0].score1, r1[0].winner === r1[0].p1, r1[0].winner && r1[0].winner !== r1[0].p1, 'group1', groupIdx, 'r1', 0);
  createDiagramCard(svg, 32, 64, r1[0].p2, r1[0].score2, r1[0].winner === r1[0].p2, r1[0].winner && r1[0].winner !== r1[0].p2, 'group1', groupIdx, 'r1', 0);
  addText(svg, 106, 30, 'R1 · Match 1', '#7a8399', 8, 'middle');

  // R1[1]: C vs D
  createDiagramCard(svg, 32, 176, r1[1].p1, r1[1].score1, r1[1].winner === r1[1].p1, r1[1].winner && r1[1].winner !== r1[1].p1, 'group1', groupIdx, 'r1', 1);
  createDiagramCard(svg, 32, 204, r1[1].p2, r1[1].score2, r1[1].winner === r1[1].p2, r1[1].winner && r1[1].winner !== r1[1].p2, 'group1', groupIdx, 'r1', 1);
  addText(svg, 106, 170, 'R1 · Match 2', '#7a8399', 8, 'middle');

  // WR1: 胜者组决赛
  createDiagramCard(svg, 280, 128, wr1.p1, wr1.score1, wr1.winner === wr1.p1, wr1.winner && wr1.winner !== wr1.p1, 'group1', groupIdx, 'wr1', null, true);
  createDiagramCard(svg, 280, 156, wr1.p2, wr1.score2, wr1.winner === wr1.p2, wr1.winner && wr1.winner !== wr1.p2, 'group1', groupIdx, 'wr1', null);
  addText(svg, 354, 122, 'WR1 · 胜者组决赛', '#7a8399', 8, 'middle');

  // 败者组标签
  addText(svg, 32, 272, 'LOSERS BRACKET', '#4f5d75', 9, 'start', '0.14em');

  // LR1: 败者组第一轮
  createDiagramCard(svg, 280, 288, lr1.p1, lr1.score1, lr1.winner === lr1.p1, lr1.winner && lr1.winner !== lr1.p1, 'group1', groupIdx, 'lr1', null);
  createDiagramCard(svg, 280, 316, lr1.p2, lr1.score2, lr1.winner === lr1.p2, lr1.winner && lr1.winner !== lr1.p2, 'group1', groupIdx, 'lr1', null);
  addText(svg, 354, 282, 'LR1 · 败者组第一轮', '#7a8399', 8, 'middle');

  // LR2: 败者组决赛
  createDiagramCard(svg, 520, 384, lr2.p1, lr2.score1, lr2.winner === lr2.p1, lr2.winner && lr2.winner !== lr2.p1, 'group1', groupIdx, 'lr2', null);
  createDiagramCard(svg, 520, 412, lr2.p2, lr2.score2, lr2.winner === lr2.p2, lr2.winner && lr2.winner !== lr2.p2, 'group1', groupIdx, 'lr2', null);
  addText(svg, 594, 378, 'LR2 · 败者组决赛', '#7a8399', 8, 'middle');

  // 第1名卡片槽位
  createResultSlot(svg, 520, 128, group.first, '🏆', '第1名', true);
  addText(svg, 584, 122, 'WINNER', '#7a8399', 8, 'middle');

  // 第2名卡片槽位
  createResultSlot(svg, 700, 396, group.second, '🥈', '第2名', false);
  addText(svg, 764, 390, 'RUNNER-UP', '#7a8399', 8, 'middle');

  // 图例
  addLine(svg, 32, 500, 828, 500, 'rgba(45,49,66,0.10)', 0.8);
  addText(svg, 32, 508, 'LEGEND', '#4f5d75', 7, 'start', '0.14em');
  addLine(svg, 116, 504, 148, 504, '#4f5d75', 1);
  addText(svg, 156, 508, '胜者路径', '#4f5d75', 7, 'start');
  addLine(svg, 244, 504, 276, 504, '#4f5d75', 1, '4,3');
  addText(svg, 284, 508, '败者路径', '#4f5d75', 7, 'start');

  container.appendChild(svg);
}

// ============================================================
// 16人单败淘汰赛（使用diagrams模板）
// ============================================================
function renderEliminationBracket(container, bracket) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 900 640');
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.width = '100%';
  svg.style.minWidth = '1100px';
  svg.style.display = 'block';
  const tc = getThemeColors();
  svg.style.background = tc.bg;
  svg.style.borderRadius = '6px';

  const r16 = bracket.r16 || [];
  const r8 = bracket.r8 || [];
  const r4 = bracket.r4 || [];
  const final_ = bracket.final || {};

  // 布局常量
  const CARD_W = 148, CARD_H = 24, GAP = 8;
  const C_R16 = 16, C_R8 = 200, C_R4 = 400, C_FINAL = 580, C_CHAMP = 748;
  const r16_ys = [36, 100, 164, 228, 356, 420, 484, 548];
  const r8_ys = [68, 196, 388, 516];
  const r4_ys = [132, 452];
  const final_y = 304;

  // 列标签
  addText(svg, 80, 20, '8强 · R16', '#4f5d75', 9, 'middle', '0.14em');
  addText(svg, 264, 20, '4强 · R8', '#4f5d75', 9, 'middle', '0.14em');
  addText(svg, 464, 20, '半决赛 · R4', '#4f5d75', 9, 'middle', '0.14em');
  addText(svg, 644, 20, '决赛 · Final', '#4f5d75', 9, 'middle', '0.14em');

  // ========== 连线（基于实际卡片位置动态计算）==========
  // R16 → R8
  for (let i = 0; i < 8; i += 2) {
    const r8Idx = i / 2;
    const c1y = r16_ys[i] + CARD_H / 2;
    const c2y = r16_ys[i] + CARD_H + GAP + CARD_H / 2;
    const targetY = r8_ys[r8Idx] + CARD_H / 2;
    drawDiagramConnector(svg, C_R16 + CARD_W, c1y, c2y, C_R8, targetY);
    const c1y2 = r16_ys[i + 1] + CARD_H / 2;
    const c2y2 = r16_ys[i + 1] + CARD_H + GAP + CARD_H / 2;
    const targetY2 = r8_ys[r8Idx] + CARD_H + GAP + CARD_H / 2;
    drawDiagramConnector(svg, C_R16 + CARD_W, c1y2, c2y2, C_R8, targetY2);
  }

  // R8 → R4
  for (let i = 0; i < 4; i += 2) {
    const r4Idx = i / 2;
    const c1y = r8_ys[i] + CARD_H / 2;
    const c2y = r8_ys[i] + CARD_H + GAP + CARD_H / 2;
    const targetY = r4_ys[r4Idx] + CARD_H / 2;
    drawDiagramConnector(svg, C_R8 + CARD_W, c1y, c2y, C_R4, targetY);
    const c1y2 = r8_ys[i + 1] + CARD_H / 2;
    const c2y2 = r8_ys[i + 1] + CARD_H + GAP + CARD_H / 2;
    const targetY2 = r4_ys[r4Idx] + CARD_H + GAP + CARD_H / 2;
    drawDiagramConnector(svg, C_R8 + CARD_W, c1y2, c2y2, C_R4, targetY2);
  }

  // R4 → Final
  for (let i = 0; i < 2; i++) {
    const c1y = r4_ys[i] + CARD_H / 2;
    const c2y = r4_ys[i] + CARD_H + GAP + CARD_H / 2;
    const targetY = i === 0 ? final_y + CARD_H / 2 : final_y + CARD_H + GAP + CARD_H / 2;
    drawDiagramConnector(svg, C_R4 + CARD_W, c1y, c2y, C_FINAL, targetY);
  }

  // ========== 节点（动态数据）==========
  // R16
  for (let i = 0; i < 8; i++) {
    const match = r16[i] || {};
    const y = r16_ys[i];
    createDiagramCard(svg, C_R16, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r16', i);
    createDiagramCard(svg, C_R16, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r16', i);
  }

  // R8
  for (let i = 0; i < 4; i++) {
    const match = r8[i] || {};
    const y = r8_ys[i];
    createDiagramCard(svg, C_R8, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r8', i);
    createDiagramCard(svg, C_R8, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r8', i);
  }

  // R4
  for (let i = 0; i < 2; i++) {
    const match = r4[i] || {};
    const y = r4_ys[i];
    createDiagramCard(svg, C_R4, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, 'elimination', 0, 'r4', i);
    createDiagramCard(svg, C_R4, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, 'elimination', 0, 'r4', i);
  }

  // Final
  createDiagramCard(svg, C_FINAL, final_y, final_.p1, final_.score1, final_.winner === final_.p1, final_.winner && final_.winner !== final_.p1, 'elimination', 0, 'final', 0, true);
  createDiagramCard(svg, C_FINAL, final_y + CARD_H + GAP, final_.p2, final_.score2, final_.winner === final_.p2, final_.winner && final_.winner !== final_.p2, 'elimination', 0, 'final', 0);
  addText(svg, 644, 298, 'FINAL', '#7a8399', 8, 'middle');

  // 冠军
  if (final_.winner) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${C_CHAMP},${final_y + 4})`);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', 112);
    rect.setAttribute('height', 36);
    rect.setAttribute('rx', 6);
    rect.setAttribute('fill', 'rgba(235,108,54,0.12)');
    rect.setAttribute('stroke', '#eb6c36');
    rect.setAttribute('stroke-width', 1.5);
    g.appendChild(rect);
    const t1 = document.createElementNS(SVG_NS, 'text');
    t1.setAttribute('x', 56);
    t1.setAttribute('y', 16);
    t1.setAttribute('fill', '#eb6c36');
    t1.setAttribute('font-size', 11);
    t1.setAttribute('font-weight', 600);
    t1.setAttribute('text-anchor', 'middle');
    t1.setAttribute('font-family', "'Geist', sans-serif");
    t1.textContent = '🏆 ' + getPlayerName(final_.winner);
    g.appendChild(t1);
    const t2 = document.createElementNS(SVG_NS, 'text');
    t2.setAttribute('x', 56);
    t2.setAttribute('y', 30);
    t2.setAttribute('fill', '#7a8399');
    t2.setAttribute('font-size', 8);
    t2.setAttribute('text-anchor', 'middle');
    t2.setAttribute('font-family', "'Geist Mono', monospace");
    t2.textContent = 'CHAMPION';
    g.appendChild(t2);
    svg.appendChild(g);
  }

  // 图例
  addLine(svg, 16, 620, 884, 620, 'rgba(45,49,66,0.10)', 0.8);
  addText(svg, 16, 632, 'LEGEND', '#4f5d75', 7, 'start', '0.14em');
  addLine(svg, 100, 628, 132, 628, '#4f5d75', 1);
  addText(svg, 140, 632, '比赛连线', '#4f5d75', 7, 'start');

  container.appendChild(svg);
}

// ============================================================
// 辅助函数
// ============================================================
function addLine(svg, x1, y1, x2, y2, color, width, dasharray) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', width || 1);
  if (dasharray) line.setAttribute('stroke-dasharray', dasharray);
  svg.appendChild(line);
}

function addText(svg, x, y, text, color, size, anchor, letterSpacing) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('fill', color || '#2d3142');
  t.setAttribute('font-size', size || 11);
  t.setAttribute('text-anchor', anchor || 'start');
  t.setAttribute('font-family', size <= 9 ? "'Geist Mono', monospace" : "'Geist', sans-serif");
  if (letterSpacing) t.setAttribute('letter-spacing', letterSpacing);
  t.textContent = text;
  svg.appendChild(t);
}

function createDiagramCard(svg, x, y, playerId, score, isWinner, isLoser, stage, groupIdx, roundKey, matchIdx, isAccent) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);
  const tc = getThemeColors();

  // 矩形
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', 148);
  rect.setAttribute('height', 24);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isWinner ? tc.accentFill : tc.cardBg);
  rect.setAttribute('stroke', isWinner ? tc.accent : isAccent ? tc.accent : tc.cardStroke);
  rect.setAttribute('stroke-width', isWinner ? 1.5 : 1);
  rect.style.cursor = playerId ? 'pointer' : 'default';
  g.appendChild(rect);

  // 选手名
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', 8);
  text.setAttribute('y', 16);
  text.setAttribute('fill', isWinner ? tc.accent : isLoser ? tc.muted : tc.text);
  text.setAttribute('font-size', 11);
  text.setAttribute('font-weight', 600);
  text.setAttribute('font-family', "'Geist', sans-serif");
  text.textContent = getPlayerName(playerId);
  g.appendChild(text);

  // 点击选胜者
  if (playerId && !isWinner) {
    g.addEventListener('click', () => {
      selectWinner(stage, groupIdx, roundKey, matchIdx, playerId);
    });
  }

  svg.appendChild(g);
}

function createResultSlot(svg, x, y, playerId, emoji, label, isPrimary) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);
  const tc = getThemeColors();

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', 128);
  rect.setAttribute('height', 24);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isPrimary ? tc.accentFill : 'rgba(235,108,54,0.08)');
  rect.setAttribute('stroke', tc.accent);
  rect.setAttribute('stroke-width', isPrimary ? 1.5 : 1);
  g.appendChild(rect);

  const t1 = document.createElementNS(SVG_NS, 'text');
  t1.setAttribute('x', 8);
  t1.setAttribute('y', 16);
  t1.setAttribute('fill', '#eb6c36');
  t1.setAttribute('font-size', 11);
  t1.setAttribute('font-weight', 600);
  t1.setAttribute('font-family', "'Geist', sans-serif");
  t1.textContent = playerId ? `${emoji} ${getPlayerName(playerId)}` : `${emoji} 待定`;
  g.appendChild(t1);

  const t2 = document.createElementNS(SVG_NS, 'text');
  t2.setAttribute('x', 120);
  t2.setAttribute('y', 16);
  t2.setAttribute('fill', '#eb6c36');
  t2.setAttribute('font-size', 9);
  t2.setAttribute('text-anchor', 'end');
  t2.setAttribute('font-family', "'Geist Mono', monospace");
  t2.textContent = label;
  g.appendChild(t2);

  svg.appendChild(g);
}

function drawDiagramConnector(svg, cardRightX, card1Y, card2Y, targetLeftX, targetCenterY, color, dasharray) {
  const mergeX = cardRightX + 28;
  const mergeY = Math.round((card1Y + card2Y) / 2);
  const c = color || '#4f5d75';

  addLine(svg, cardRightX, card1Y, mergeX, card1Y, c, 1, dasharray);
  addLine(svg, cardRightX, card2Y, mergeX, card2Y, c, 1, dasharray);
  addLine(svg, mergeX, card1Y, mergeX, card2Y, c, 1, dasharray);
  addLine(svg, mergeX, mergeY, targetLeftX, mergeY, c, 1, dasharray);
  if (Math.abs(mergeY - targetCenterY) > 1) {
    addLine(svg, targetLeftX, mergeY, targetLeftX, targetCenterY, c, 1, dasharray);
  }
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
