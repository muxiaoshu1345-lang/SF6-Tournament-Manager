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

function drawLine(svg, x1, y1, x2, y2, color) {
  const line = document.createElementNS(SVG_NS, 'path');
  const mx = (x1 + x2) / 2;
  line.setAttribute('d', `M${x1},${y1} H${mx} V${y2} H${x2}`);
  line.setAttribute('stroke', color || '#3b82f6');
  line.setAttribute('stroke-width', 1.5);
  line.setAttribute('fill', 'none');
  svg.appendChild(line);
}

/** Draw bracket connector from a match to the next round slot.
 *  matchCenterY = vertical center of the source match (between p1 and p2 cards)
 *  targetCenterY = vertical center of the target slot in the next round
 */
function drawBracketConnector(svg, srcX, matchCenterY, dstX, targetCenterY) {
  drawLine(svg, srcX, matchCenterY, dstX, targetCenterY);
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
    label.textContent = '\u{1F3C6} 胜者组冠军';
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
    label.textContent = '\u{1F948} 败者组冠军';
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
  // Each match pair feeds into the next round. One connector per match,
  // from the vertical center of the source match to the target slot.
  //
  // R16[i] → R8[i/2].p1 (if i even) or .p2 (if i odd)
  // R8[i]  → R4[i/2].p1 (if i even) or .p2 (if i odd)
  // R4[i]  → Final.p1 (if i==0) or Final.p2 (if i==1)

  // Match vertical center = midpoint between the two cards
  const matchCenterY = (matchY) => matchY + CARD_H + GAP / 2;

  // R16 → R8
  for (let i = 0; i < 8; i++) {
    const r8Idx = Math.floor(i / 2);
    const isBottom = i % 2 === 1;
    const srcY = matchCenterY(r16_ys[i]);
    const dstY = r8_ys[r8Idx] + (isBottom ? CARD_H + GAP + CARD_H / 2 : CARD_H / 2);
    drawBracketConnector(svg, C_R16 + CARD_W, srcY, C_R8, dstY);
  }

  // R8 → R4
  for (let i = 0; i < 4; i++) {
    const r4Idx = Math.floor(i / 2);
    const isBottom = i % 2 === 1;
    const srcY = matchCenterY(r8_ys[i]);
    const dstY = r4_ys[r4Idx] + (isBottom ? CARD_H + GAP + CARD_H / 2 : CARD_H / 2);
    drawBracketConnector(svg, C_R8 + CARD_W, srcY, C_R4, dstY);
  }

  // R4 → Final
  for (let i = 0; i < 2; i++) {
    const isBottom = i === 1;
    const srcY = matchCenterY(r4_ys[i]);
    const dstY = final_y + (isBottom ? CARD_H + GAP + CARD_H / 2 : CARD_H / 2);
    drawBracketConnector(svg, C_R4 + CARD_W, srcY, C_FINAL, dstY);
  }

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
