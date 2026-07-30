// svg_renderer.js — SVG对战图渲染
const SVG_NS = 'http://www.w3.org/2000/svg';
const CARD_W = 128, CARD_H = 28, GAP = 8;
const CONNECTOR_COLOR = '#4f5d75';
const CONNECTOR_WIDTH = 1;
const WINNER_COLOR = '#eb6c36';  // 彩色描边（赢家）
const WINNER_FILL = 'rgba(235,108,54,0.12)';

function getPlayerName(playerId) {
  if (!playerId) return '待定';
  const p = currentState.players.find(p => p.id === playerId);
  return p ? p.name : playerId;
}

function createSvgCard(svg, x, y, playerId, score, isWinner, isLoser, matchKey, stage, groupIdx, roundKey, matchIdx) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(${x},${y})`);

  // 背景 - 默认无彩色描边，赢家才有彩色描边
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', CARD_W);
  rect.setAttribute('height', CARD_H);
  rect.setAttribute('rx', 4);
  rect.setAttribute('fill', isWinner ? WINNER_FILL : isLoser ? 'rgba(255,255,255,0.03)' : '#ffffff');
  rect.setAttribute('stroke', isWinner ? WINNER_COLOR : isLoser ? 'rgba(255,255,255,0.15)' : 'rgba(45,49,66,0.20)');
  rect.setAttribute('stroke-width', isWinner ? 1.5 : 1);
  rect.style.cursor = playerId ? 'pointer' : 'default';
  g.appendChild(rect);

  // 名字
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', 8);
  text.setAttribute('y', 19);
  text.setAttribute('fill', isWinner ? WINNER_COLOR : isLoser ? 'rgba(255,255,255,0.35)' : '#2d3142');
  text.setAttribute('font-size', '11');
  text.setAttribute('font-weight', isWinner ? '600' : '400');
  text.setAttribute('font-family', "'Segoe UI', sans-serif");
  text.textContent = getPlayerName(playerId);
  g.appendChild(text);

  // 比分输入
  if (playerId) {
    const scoreInput = document.createElementNS(SVG_NS, 'foreignObject');
    scoreInput.setAttribute('x', CARD_W - 26);
    scoreInput.setAttribute('y', 4);
    scoreInput.setAttribute('width', 20);
    scoreInput.setAttribute('height', 20);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = score || 0;
    input.style.cssText = 'width:20px;height:20px;text-align:center;background:transparent;color:' + (isWinner ? WINNER_COLOR : '#2d3142') + ';border:1px solid rgba(45,49,66,0.15);border-radius:2px;font-size:10px;';
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
 * 模式（与设计图一致）:
 *   Card1 右侧中心 → 水平到合并X → 垂直到合并中心
 *   Card2 右侧中心 → 水平到合并X → 垂直到合并中心
 *   合并中心 → 水平到目标X → 垂直到目标中心
 */
function drawMatchConnector(svg, cardRightX, card1CenterY, card2CenterY, targetLeftX, targetCenterY) {
  const mergeX = cardRightX + 28;  // 合并点X（卡片右侧+28px）
  const mergeY = Math.round((card1CenterY + card2CenterY) / 2);  // 合并中心Y

  // Card1 右侧中心 → 合并X（水平）
  addLine(svg, cardRightX, card1CenterY, mergeX, card1CenterY, CONNECTOR_COLOR, CONNECTOR_WIDTH);
  // Card1 合并X → 合并中心（垂直）
  addLine(svg, mergeX, card1CenterY, mergeX, mergeY, CONNECTOR_COLOR, CONNECTOR_WIDTH);

  // Card2 右侧中心 → 合并X（水平）
  addLine(svg, cardRightX, card2CenterY, mergeX, card2CenterY, CONNECTOR_COLOR, CONNECTOR_WIDTH);
  // Card2 合并X → 合并中心（垂直）
  addLine(svg, mergeX, card2CenterY, mergeX, mergeY, CONNECTOR_COLOR, CONNECTOR_WIDTH);

  // 合并中心 → 目标X（水平）
  addLine(svg, mergeX, mergeY, targetLeftX, mergeY, CONNECTOR_COLOR, CONNECTOR_WIDTH);
  // 目标X → 目标中心（垂直）
  if (Math.abs(mergeY - targetCenterY) > 1) {
    addLine(svg, targetLeftX, mergeY, targetLeftX, targetCenterY, CONNECTOR_COLOR, CONNECTOR_WIDTH);
  }
}

function addLine(svg, x1, y1, x2, y2, color, width) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', width);
  svg.appendChild(line);
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

  // ========== 3. 胜者/败者冠军卡片 ==========
  // 第1名卡片（胜者组冠军）
  if (group.first) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${RESULT_X},${WR1_Y})`);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', CARD_W);
    rect.setAttribute('height', CARD_H);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', WINNER_FILL);
    rect.setAttribute('stroke', WINNER_COLOR);
    rect.setAttribute('stroke-width', 1.5);
    g.appendChild(rect);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', 8);
    t.setAttribute('y', 19);
    t.setAttribute('fill', WINNER_COLOR);
    t.setAttribute('font-size', '11');
    t.setAttribute('font-weight', '600');
    t.setAttribute('font-family', "'Segoe UI', sans-serif");
    t.textContent = '🏆 ' + getPlayerName(group.first);
    g.appendChild(t);
    const t2 = document.createElementNS(SVG_NS, 'text');
    t2.setAttribute('x', CARD_W - 8);
    t2.setAttribute('y', 19);
    t2.setAttribute('fill', WINNER_COLOR);
    t2.setAttribute('font-size', '9');
    t2.setAttribute('text-anchor', 'end');
    t2.setAttribute('font-family', "'Segoe UI', sans-serif");
    t2.textContent = '第1名';
    g.appendChild(t2);
    svg.appendChild(g);
  }

  // 第2名卡片（败者组冠军）
  if (group.second) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${RESULT_X},${LR2_Y})`);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', CARD_W);
    rect.setAttribute('height', CARD_H);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', 'rgba(235,108,54,0.08)');
    rect.setAttribute('stroke', WINNER_COLOR);
    rect.setAttribute('stroke-width', 1);
    g.appendChild(rect);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', 8);
    t.setAttribute('y', 19);
    t.setAttribute('fill', WINNER_COLOR);
    t.setAttribute('font-size', '11');
    t.setAttribute('font-weight', '600');
    t.setAttribute('font-family', "'Segoe UI', sans-serif");
    t.textContent = '🥈 ' + getPlayerName(group.second);
    g.appendChild(t);
    const t2 = document.createElementNS(SVG_NS, 'text');
    t2.setAttribute('x', CARD_W - 8);
    t2.setAttribute('y', 19);
    t2.setAttribute('fill', WINNER_COLOR);
    t2.setAttribute('font-size', '9');
    t2.setAttribute('text-anchor', 'end');
    t2.setAttribute('font-family', "'Segoe UI', sans-serif");
    t2.textContent = '第2名';
    g.appendChild(t2);
    svg.appendChild(g);
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

  // R16 → R8
  for (let i = 0; i < 8; i += 2) {
    const r8Idx = i / 2;
    drawMatchConnector(svg,
      C_R16 + CARD_W,
      r16_ys[i] + CARD_H / 2,
      r16_ys[i] + CARD_H + GAP + CARD_H / 2,
      C_R8, r8_ys[r8Idx] + CARD_H / 2);
    drawMatchConnector(svg,
      C_R16 + CARD_W,
      r16_ys[i + 1] + CARD_H / 2,
      r16_ys[i + 1] + CARD_H + GAP + CARD_H / 2,
      C_R8, r8_ys[r8Idx] + CARD_H + GAP + CARD_H / 2);
  }

  // R8 → R4
  for (let i = 0; i < 4; i += 2) {
    const r4Idx = i / 2;
    drawMatchConnector(svg,
      C_R8 + CARD_W,
      r8_ys[i] + CARD_H / 2,
      r8_ys[i] + CARD_H + GAP + CARD_H / 2,
      C_R4, r4_ys[r4Idx] + CARD_H / 2);
    drawMatchConnector(svg,
      C_R8 + CARD_W,
      r8_ys[i + 1] + CARD_H / 2,
      r8_ys[i + 1] + CARD_H + GAP + CARD_H / 2,
      C_R4, r4_ys[r4Idx] + CARD_H + GAP + CARD_H / 2);
  }

  // R4 → Final
  drawMatchConnector(svg,
    C_R4 + CARD_W,
    r4_ys[0] + CARD_H / 2,
    r4_ys[0] + CARD_H + GAP + CARD_H / 2,
    C_FINAL, final_y + CARD_H / 2);
  drawMatchConnector(svg,
    C_R4 + CARD_W,
    r4_ys[1] + CARD_H / 2,
    r4_ys[1] + CARD_H + GAP + CARD_H / 2,
    C_FINAL, final_y + CARD_H + GAP + CARD_H / 2);

  // Final → Champion（彩色连线）
  const CHAMP_X = 740;
  const champY = final_y + CARD_H / 2;
  if (final_.winner) {
    // 两卡片合并 → 冠军
    const mergeX = C_FINAL + CARD_W + 28;
    const mergeY = final_y + CARD_H + GAP / 2;
    addLine(svg, C_FINAL + CARD_W, final_y + CARD_H / 2, mergeX, final_y + CARD_H / 2, WINNER_COLOR, 1.5);
    addLine(svg, C_FINAL + CARD_W, final_y + CARD_H + GAP + CARD_H / 2, mergeX, final_y + CARD_H + GAP + CARD_H / 2, WINNER_COLOR, 1.5);
    addLine(svg, mergeX, final_y + CARD_H / 2, mergeX, final_y + CARD_H + GAP + CARD_H / 2, WINNER_COLOR, 1.5);
    addLine(svg, mergeX, mergeY, CHAMP_X, mergeY, WINNER_COLOR, 1.5);

    // 冠军卡片
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${CHAMP_X},${final_y + 4})`);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', 100);
    rect.setAttribute('height', 36);
    rect.setAttribute('rx', 6);
    rect.setAttribute('fill', WINNER_FILL);
    rect.setAttribute('stroke', WINNER_COLOR);
    rect.setAttribute('stroke-width', 1.5);
    g.appendChild(rect);
    const t1 = document.createElementNS(SVG_NS, 'text');
    t1.setAttribute('x', 50);
    t1.setAttribute('y', 16);
    t1.setAttribute('fill', WINNER_COLOR);
    t1.setAttribute('font-size', '11');
    t1.setAttribute('font-weight', '600');
    t1.setAttribute('text-anchor', 'middle');
    t1.setAttribute('font-family', "'Segoe UI', sans-serif");
    t1.textContent = '🏆 ' + getPlayerName(final_.winner);
    g.appendChild(t1);
    const t2 = document.createElementNS(SVG_NS, 'text');
    t2.setAttribute('x', 50);
    t2.setAttribute('y', 30);
    t2.setAttribute('fill', '#7a8399');
    t2.setAttribute('font-size', '8');
    t2.setAttribute('text-anchor', 'middle');
    t2.setAttribute('font-family', "'Segoe UI', sans-serif");
    t2.textContent = 'CHAMPION';
    g.appendChild(t2);
    svg.appendChild(g);
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
