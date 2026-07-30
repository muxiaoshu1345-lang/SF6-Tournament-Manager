// svg_renderer.js — SVG对战图渲染
const SVG_NS = 'http://www.w3.org/2000/svg';
const CARD_W = 140, CARD_H = 36, GAP = 12;
const CONNECTOR_COLOR = '#3b82f6';
const CONNECTOR_WIDTH = 1.2;

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
  rect.setAttribute('rx', 6);
  rect.setAttribute('fill', isWinner ? '#2d5a27' : isLoser ? '#3a2020' : '#1e3a5f');
  rect.setAttribute('stroke', isWinner ? '#4ade80' : isLoser ? '#666' : '#3b82f6');
  rect.setAttribute('stroke-width', isWinner ? 2 : 1);
  rect.style.cursor = playerId ? 'pointer' : 'default';
  g.appendChild(rect);

  // 名字
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', 8);
  text.setAttribute('y', 23);
  text.setAttribute('fill', isLoser ? '#888' : '#fff');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-family', "'Segoe UI', sans-serif");
  text.textContent = getPlayerName(playerId);
  g.appendChild(text);

  // 比分输入
  if (playerId) {
    const scoreInput = document.createElementNS(SVG_NS, 'foreignObject');
    scoreInput.setAttribute('x', CARD_W - 28);
    scoreInput.setAttribute('y', 6);
    scoreInput.setAttribute('width', 22);
    scoreInput.setAttribute('height', 24);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = score || 0;
    input.style.cssText = 'width:22px;height:24px;text-align:center;background:#0f3460;color:#fff;border:1px solid #3b82f6;border-radius:3px;font-size:11px;';
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
 * 画一场比赛到下一轮槽位的连线
 *
 * 模式（圆角直角连线）:
 *   Card1 右侧中心 ──→ 汇合点 ──→ 目标左侧中心
 *   Card2 右侧中心 ──↗
 *
 * 连线路径:
 *   Card1: M x1,y1 H mid  (水平到中线)
 *   Card2: M x2,y2 H mid  (水平到中线)
 *   合并:  M mid,mergeY V targetCY H targetX  (垂直对齐目标，水平到目标)
 */
function drawMatchConnector(svg, cardRightX, card1CenterY, card2CenterY, targetLeftX, targetCenterY) {
  const midX = Math.round((cardRightX + targetLeftX) / 2);
  const mergeY = targetCenterY; // 汇合点的Y坐标 = 目标的Y坐标

  // Card1 右侧中心 → 中线（水平）
  const line1 = document.createElementNS(SVG_NS, 'line');
  line1.setAttribute('x1', cardRightX);
  line1.setAttribute('y1', card1CenterY);
  line1.setAttribute('x2', midX);
  line1.setAttribute('y2', card1CenterY);
  line1.setAttribute('stroke', CONNECTOR_COLOR);
  line1.setAttribute('stroke-width', CONNECTOR_WIDTH);
  svg.appendChild(line1);

  // Card1 中线 → 汇合点（垂直）
  const vline1 = document.createElementNS(SVG_NS, 'line');
  vline1.setAttribute('x1', midX);
  vline1.setAttribute('y1', card1CenterY);
  vline1.setAttribute('x2', midX);
  vline1.setAttribute('y2', mergeY);
  vline1.setAttribute('stroke', CONNECTOR_COLOR);
  vline1.setAttribute('stroke-width', CONNECTOR_WIDTH);
  svg.appendChild(vline1);

  // Card2 右侧中心 → 中线（水平）
  const line2 = document.createElementNS(SVG_NS, 'line');
  line2.setAttribute('x1', cardRightX);
  line2.setAttribute('y1', card2CenterY);
  line2.setAttribute('x2', midX);
  line2.setAttribute('y2', card2CenterY);
  line2.setAttribute('stroke', CONNECTOR_COLOR);
  line2.setAttribute('stroke-width', CONNECTOR_WIDTH);
  svg.appendChild(line2);

  // Card2 中线 → 汇合点（垂直，如果card2CenterY != mergeY）
  if (Math.abs(card2CenterY - mergeY) > 1) {
    const vline2 = document.createElementNS(SVG_NS, 'line');
    vline2.setAttribute('x1', midX);
    vline2.setAttribute('y1', card2CenterY);
    vline2.setAttribute('x2', midX);
    vline2.setAttribute('y2', mergeY);
    vline2.setAttribute('stroke', CONNECTOR_COLOR);
    vline2.setAttribute('stroke-width', CONNECTOR_WIDTH);
    svg.appendChild(vline2);
  }

  // 汇合点 → 目标左侧中心（水平）
  const line3 = document.createElementNS(SVG_NS, 'line');
  line3.setAttribute('x1', midX);
  line3.setAttribute('y1', mergeY);
  line3.setAttribute('x2', targetLeftX);
  line3.setAttribute('y2', mergeY);
  line3.setAttribute('stroke', CONNECTOR_COLOR);
  line3.setAttribute('stroke-width', CONNECTOR_WIDTH);
  svg.appendChild(line3);
}

function renderDoubleEliminationBracket(container, group, groupIdx) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', 600);
  svg.setAttribute('height', 380);
  svg.style.background = '#111827';
  svg.style.borderRadius = '8px';

  const bracket = group.bracket;
  const r1 = bracket.r1;
  const wr1 = bracket.wr1;
  const lr1 = bracket.lr1;
  const lr2 = bracket.lr2;

  // ========== 固定布局常量 ==========
  // 胜者组
  const R1_X = 20, R1_Y0 = 20, R1_Y1 = 100;
  const WR1_X = 240, WR1_Y = 50;
  // 败者组
  const LR1_X = 20, LR1_Y = 200;
  const LR2_X = 240, LR2_Y = 260;
  // 结果
  const RESULT_X = 440;

  // ========== 1. 先画固定连线（连线永远不变）==========

  // R1[0] 胜者 → WR1 上槽
  drawMatchConnector(svg,
    R1_X + CARD_W,                                    // 卡片右侧x
    R1_Y0 + CARD_H / 2,                              // Card1 右侧中心y
    R1_Y0 + CARD_H + GAP + CARD_H / 2,               // Card2 右侧中心y
    WR1_X,                                            // 目标左侧x
    WR1_Y + CARD_H / 2);                             // 目标左侧中心y

  // R1[1] 胜者 → WR1 下槽
  drawMatchConnector(svg,
    R1_X + CARD_W,
    R1_Y1 + CARD_H / 2,
    R1_Y1 + CARD_H + GAP + CARD_H / 2,
    WR1_X,
    WR1_Y + CARD_H + GAP + CARD_H / 2);

  // R1[0] 败者 → LR1 上槽
  drawMatchConnector(svg,
    R1_X + CARD_W,
    R1_Y0 + CARD_H / 2,
    R1_Y0 + CARD_H + GAP + CARD_H / 2,
    LR1_X,
    LR1_Y + CARD_H / 2);

  // R1[1] 败者 → LR1 下槽
  drawMatchConnector(svg,
    R1_X + CARD_W,
    R1_Y1 + CARD_H / 2,
    R1_Y1 + CARD_H + GAP + CARD_H / 2,
    LR1_X,
    LR1_Y + CARD_H + GAP + CARD_H / 2);

  // LR1 胜者 → LR2 上槽
  drawMatchConnector(svg,
    LR1_X + CARD_W,
    LR1_Y + CARD_H / 2,
    LR1_Y + CARD_H + GAP + CARD_H / 2,
    LR2_X,
    LR2_Y + CARD_H / 2);

  // WR1 败者 → LR2 下槽
  drawMatchConnector(svg,
    WR1_X + CARD_W,
    WR1_Y + CARD_H / 2,
    WR1_Y + CARD_H + GAP + CARD_H / 2,
    LR2_X,
    LR2_Y + CARD_H + GAP + CARD_H / 2);

  // ========== 2. 画固定槽位 ==========

  // --- R1[0]: A vs B ---
  createSvgCard(svg, R1_X, R1_Y0, r1[0].p1, r1[0].score1, r1[0].winner === r1[0].p1, r1[0].winner && r1[0].winner !== r1[0].p1, 'r1_0', 'group1', groupIdx, 'r1', 0);
  createSvgCard(svg, R1_X, R1_Y0 + CARD_H + GAP, r1[0].p2, r1[0].score2, r1[0].winner === r1[0].p2, r1[0].winner && r1[0].winner !== r1[0].p2, 'r1_0', 'group1', groupIdx, 'r1', 0);

  // --- R1[1]: C vs D ---
  createSvgCard(svg, R1_X, R1_Y1, r1[1].p1, r1[1].score1, r1[1].winner === r1[1].p1, r1[1].winner && r1[1].winner !== r1[1].p1, 'r1_1', 'group1', groupIdx, 'r1', 1);
  createSvgCard(svg, R1_X, R1_Y1 + CARD_H + GAP, r1[1].p2, r1[1].score2, r1[1].winner === r1[1].p2, r1[1].winner && r1[1].winner !== r1[1].p2, 'r1_1', 'group1', groupIdx, 'r1', 1);

  // --- WR1: 胜者组决赛 ---
  createSvgCard(svg, WR1_X, WR1_Y, wr1.p1, wr1.score1, wr1.winner === wr1.p1, wr1.winner && wr1.winner !== wr1.p1, 'wr1', 'group1', groupIdx, 'wr1', null);
  createSvgCard(svg, WR1_X, WR1_Y + CARD_H + GAP, wr1.p2, wr1.score2, wr1.winner === wr1.p2, wr1.winner && wr1.winner !== wr1.p2, 'wr1', 'group1', groupIdx, 'wr1', null);

  // --- LR1: 败者组第一轮 ---
  createSvgCard(svg, LR1_X, LR1_Y, lr1.p1, lr1.score1, lr1.winner === lr1.p1, lr1.winner && lr1.winner !== lr1.p1, 'lr1', 'group1', groupIdx, 'lr1', null);
  createSvgCard(svg, LR1_X, LR1_Y + CARD_H + GAP, lr1.p2, lr1.score2, lr1.winner === lr1.p2, lr1.winner && lr1.winner !== lr1.p2, 'lr1', 'group1', groupIdx, 'lr1', null);

  // --- LR2: 败者组决赛 ---
  createSvgCard(svg, LR2_X, LR2_Y, lr2.p1, lr2.score1, lr2.winner === lr2.p1, lr2.winner && lr2.winner !== lr2.p1, 'lr2', 'group1', groupIdx, 'lr2', null);
  createSvgCard(svg, LR2_X, LR2_Y + CARD_H + GAP, lr2.p2, lr2.score2, lr2.winner === lr2.p2, lr2.winner && lr2.winner !== lr2.p2, 'lr2', 'group1', groupIdx, 'lr2', null);

  // ========== 3. 标注文字 ==========
  if (group.first) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', WR1_X);
    label.setAttribute('y', WR1_Y - 8);
    label.setAttribute('fill', '#4ade80');
    label.setAttribute('font-size', '11');
    label.textContent = '🏆 胜者组冠军';
    svg.appendChild(label);
  }
  if (group.second) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', LR2_X);
    label.setAttribute('y', LR2_Y - 8);
    label.setAttribute('fill', '#fbbf24');
    label.setAttribute('font-size', '11');
    label.textContent = '🥈 败者组冠军';
    svg.appendChild(label);
  }
  if (group.first && group.second) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', RESULT_X);
    label.setAttribute('y', 80);
    label.setAttribute('fill', '#4ade80');
    label.setAttribute('font-size', '13');
    label.textContent = `第1名: ${getPlayerName(group.first)}`;
    svg.appendChild(label);
    const label2 = document.createElementNS(SVG_NS, 'text');
    label2.setAttribute('x', RESULT_X);
    label2.setAttribute('y', 104);
    label2.setAttribute('fill', '#fbbf24');
    label2.setAttribute('font-size', '13');
    label2.textContent = `第2名: ${getPlayerName(group.second)}`;
    svg.appendChild(label2);
  }

  container.appendChild(svg);
}

function renderEliminationBracket(container, bracket) {
  container.innerHTML = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', 1000);
  svg.setAttribute('height', 650);
  svg.style.background = '#111827';
  svg.style.borderRadius = '8px';

  const r16 = bracket.r16 || [];
  const r8 = bracket.r8 || [];
  const r4 = bracket.r4 || [];
  const final_ = bracket.final || {};

  // Layout constants
  const C_R16 = 20, C_R8 = 200, C_R4 = 380, C_FINAL = 560;

  // R16 Y positions (8 matches)
  const r16_ys = [20, 88, 170, 238, 320, 388, 470, 538];

  // R8 Y positions (centered between each R16 pair)
  const r8_ys = [54, 204, 354, 504];

  // R4 Y positions (centered between each R8 pair)
  const r4_ys = [129, 429];

  // Final Y position (centered between R4 pair)
  const final_y = 279;

  // --- Draw R16 matches ---
  for (let i = 0; i < 8; i++) {
    const match = r16[i] || {};
    const x = C_R16;
    const y = r16_ys[i];
    createSvgCard(svg, x, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r16', i);
    createSvgCard(svg, x, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r16', i);
  }

  // --- Draw R8 matches ---
  for (let i = 0; i < 4; i++) {
    const match = r8[i] || {};
    const x = C_R8;
    const y = r8_ys[i];
    createSvgCard(svg, x, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r8', i);
    createSvgCard(svg, x, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r8', i);
  }

  // --- Draw R4 matches ---
  for (let i = 0; i < 2; i++) {
    const match = r4[i] || {};
    const x = C_R4;
    const y = r4_ys[i];
    createSvgCard(svg, x, y, match.p1, match.score1, match.winner === match.p1, match.winner && match.winner !== match.p1, null, 'elimination', 0, 'r4', i);
    createSvgCard(svg, x, y + CARD_H + GAP, match.p2, match.score2, match.winner === match.p2, match.winner && match.winner !== match.p2, null, 'elimination', 0, 'r4', i);
  }

  // --- Draw Final ---
  createSvgCard(svg, C_FINAL, final_y, final_.p1, final_.score1, final_.winner === final_.p1, final_.winner && final_.winner !== final_.p1, null, 'elimination', 0, 'final', 0);
  createSvgCard(svg, C_FINAL, final_y + CARD_H + GAP, final_.p2, final_.score2, final_.winner === final_.p2, final_.winner && final_.winner !== final_.p2, null, 'elimination', 0, 'final', 0);

  // --- Draw bracket connector lines ---

  // R16 → R8 (每两场R16比赛的胜者进入同一场R8)
  for (let i = 0; i < 8; i += 2) {
    const r8Idx = i / 2;
    // R16[i] 两卡片 → R8[r8Idx] 上槽
    drawMatchConnector(svg,
      C_R16 + CARD_W,
      r16_ys[i] + CARD_H / 2,
      r16_ys[i] + CARD_H + GAP + CARD_H / 2,
      C_R8, r8_ys[r8Idx] + CARD_H / 2);
    // R16[i+1] 两卡片 → R8[r8Idx] 下槽
    drawMatchConnector(svg,
      C_R16 + CARD_W,
      r16_ys[i + 1] + CARD_H / 2,
      r16_ys[i + 1] + CARD_H + GAP + CARD_H / 2,
      C_R8, r8_ys[r8Idx] + CARD_H + GAP + CARD_H / 2);
  }

  // R8 → R4 (每两场R8比赛的胜者进入同一场R4)
  for (let i = 0; i < 4; i += 2) {
    const r4Idx = i / 2;
    // R8[i] 两卡片 → R4[r4Idx] 上槽
    drawMatchConnector(svg,
      C_R8 + CARD_W,
      r8_ys[i] + CARD_H / 2,
      r8_ys[i] + CARD_H + GAP + CARD_H / 2,
      C_R4, r4_ys[r4Idx] + CARD_H / 2);
    // R8[i+1] 两卡片 → R4[r4Idx] 下槽
    drawMatchConnector(svg,
      C_R8 + CARD_W,
      r8_ys[i + 1] + CARD_H / 2,
      r8_ys[i + 1] + CARD_H + GAP + CARD_H / 2,
      C_R4, r4_ys[r4Idx] + CARD_H + GAP + CARD_H / 2);
  }

  // R4 → Final
  // R4[0] 两卡片 → Final 上槽
  drawMatchConnector(svg,
    C_R4 + CARD_W,
    r4_ys[0] + CARD_H / 2,
    r4_ys[0] + CARD_H + GAP + CARD_H / 2,
    C_FINAL, final_y + CARD_H / 2);
  // R4[1] 两卡片 → Final 下槽
  drawMatchConnector(svg,
    C_R4 + CARD_W,
    r4_ys[1] + CARD_H / 2,
    r4_ys[1] + CARD_H + GAP + CARD_H / 2,
    C_FINAL, final_y + CARD_H + GAP + CARD_H / 2);

  // --- Champion label ---
  if (final_.winner) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', C_FINAL);
    label.setAttribute('y', final_y - 12);
    label.setAttribute('fill', '#ffd700');
    label.setAttribute('font-size', '16');
    label.textContent = '🏆 冠军: ' + getPlayerName(final_.winner);
    svg.appendChild(label);
  }

  container.appendChild(svg);
}

async function selectWinner(stage, groupIdx, roundKey, matchIdx, winnerId) {
  if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = roundKey === 'final' ? bracket.final : bracket[roundKey][matchIdx];
    await apiFetch('/api/match/result', {
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
  await apiFetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}

async function updateScore(stage, groupIdx, roundKey, matchIdx, score, playerId) {
  if (stage === 'elimination') {
    const bracket = currentState.elimination.bracket;
    const match = roundKey === 'final' ? bracket.final : bracket[roundKey][matchIdx];
    const isP1 = match.p1 === playerId;
    const body = {
      stage: 'elimination',
      roundKey,
      matchIdx,
      winner: match.winner,
      score1: isP1 ? parseInt(score) : match.score1,
      score2: isP1 ? match.score2 : parseInt(score)
    };
    await apiFetch('/api/match/result', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    fetchState();
    return;
  }
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
  await apiFetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}
