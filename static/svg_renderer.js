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

function drawLine(svg, x1, y1, x2, y2) {
  const line = document.createElementNS(SVG_NS, 'path');
  const mx = (x1 + x2) / 2;
  line.setAttribute('d', `M${x1},${y1} H${mx} V${y2} H${x2}`);
  line.setAttribute('stroke', '#3b82f6');
  line.setAttribute('stroke-width', 1);
  line.setAttribute('fill', 'none');
  svg.appendChild(line);
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

async function selectWinner(stage, groupIdx, roundKey, matchIdx, winnerId) {
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
  await fetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}

async function updateScore(stage, groupIdx, roundKey, matchIdx, score, playerId) {
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
  await fetch('/api/match/result', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
  fetchState();
}
