# SF6 48人锦标赛可视化赛程工具 — 设计文档

## 概述

为街霸6赛事主办方设计的单页Web工具，用于管理48人锦标赛的赛程可视化与数据录入。单HTML文件部署，无后端依赖，双击即可使用。

**核心定位：赛程记录表 + 可视化对战图，不实现比赛逻辑引擎。**

---

## 赛制结构

### 第一阶段：小组赛第一轮
- 48人 → 12组 × 4人
- 分组规则：同一随机池内的选手随机分配到小组，池子人数必须是4的倍数
- 组内双败赛制（共5场）：
  - R1: A vs B, C vs D（2场）
  - WR1: R1两场胜者对决 → 胜者 = 小组第1
  - LR1: R1两场败者对决 → 胜者晋级LR2
  - LR2: LR1胜者 vs WR1败者 → 胜者 = 小组第2
- 产出：12个小组第1（进16人淘汰赛）+ 12个小组第2（进小组赛第二轮）

### 第二阶段：小组赛第二轮
- 12个第二名随机 → 4组 × 3人（操作者触发随机，确认前可重新随机）
- 纯记录表：操作者手动填入每个选手的胜负场次，拖拽调整排名
- 无对局配对逻辑，不做SVG渲染
- 产出：4个小组第1（进16人淘汰赛）

### 第三阶段：16人淘汰赛
- 16人 = 12(第一轮第1) + 4(第二轮第1)
- 随机分配签位（操作者触发随机，确认前可重新随机）
- 单败淘汰：8强(8场) → 4强(4场) → 半决赛(2场) → 决赛(1场)

---

## 项目结构

```
SFMatch/
├── app.py                  # Flask主入口
├── tournament_data.json    # 赛事数据（自动生成）
├── requirements.txt        # Python依赖（flask）
├── templates/
│   └── index.html          # 主页面
└── static/
    ├── style.css            # 样式
    └── app.js               # 前端逻辑（SVG渲染、交互、API调用）
```

---

## 技术方案

**Python Flask后端 + HTML/CSS/JS前端**

### 后端（Python Flask）
- **框架**：Flask，轻量级Web服务器
- **职责**：
  - 状态管理：中央state对象，所有业务逻辑
  - 随机分组算法（池内随机、淘汰赛签位随机）
  - 晋级逻辑（自动推进选手到下一阶段）
  - 数据持久化：JSON文件存盘（`tournament_data.json`）
  - 撤销/重做：操作历史栈（服务端维护，上限50步）
  - 选手ID编辑：更新所有引用
- **API设计**：RESTful JSON API
  - `GET /api/state` — 获取完整状态
  - `POST /api/players` — 添加/导入选手
  - `POST /api/pools` — 管理池
  - `POST /api/randomize` — 触发随机分组（小组赛第一轮/第二轮/淘汰赛）
  - `POST /api/match/result` — 录入比赛结果（选胜者+比分）
  - `POST /api/ranking` — 更新排名（拖拽排序）
  - `POST /api/player/rename` — 修改选手名
  - `POST /api/undo` / `POST /api/redo` — 撤销/重做
  - `GET /api/export` — 导出JSON
  - `POST /api/import` — 导入JSON

### 前端（HTML + CSS + JS）
- **职责**：
  - 渲染：SVG对战图 + HTML列表/卡片
  - 用户交互：点击选胜者、输入比分、拖拽排序
  - 通过fetch调用后端API
  - 无需维护业务逻辑状态，所有数据从后端获取
- **SVG渲染**：全量重绘，每次操作后从后端获取最新状态重新渲染
- **拖拽**：HTML5 Drag & Drop API
- **依赖**：纯原生JS + SVG，无前端框架

---

## UI结构

### Tab导航
```
[选手管理] [小组赛第一轮] [小组赛第二轮] [16人淘汰赛]
```
- 选手管理：始终可访问
- 小组赛第一轮：需选手管理完成（分组已锁定）
- 小组赛第二轮：需小组赛第一轮全部完成
- 16人淘汰赛：需小组赛第二轮全部完成
- 未解锁Tab灰色不可点击

### 选手管理Tab

**导入区：**
- CSV文件上传（无表头，格式：`选手名,池名`）
- 手动输入：输入选手名 + 下拉选池 + "添加"按钮

**池管理区：**
- 创建/删除池（池名自定义）
- 每个池可折叠，显示选手列表和人数
- 选手卡片双击可编辑名字（修改即时生效，不影响已有赛程，支持替补场景）
- 选手卡片可拖拽到其他池
- 池人数必须是4的倍数，否则显示警告

**未分配区：**
- 未分配池的选手单独列出，提示"请分配到池"

**随机分组按钮：**
- 校验：所有池人数都是4的倍数 + 无未分配选手
- 每个池内部随机分配到小组
- 总组数 = 各池人数/4之和
- 显示分组预览，确认后锁定

### 小组赛第一轮Tab

**列表视图：**
- 12个小组卡片，显示4个选手名
- 点击进入小组详情

**详情视图（SVG对战图）：**

胜者组：
```
R1: [A: _] vs [B: _] → 胜者 → WR1
    [C: _] vs [D: _] → 胜者 → WR1
WR1: 胜者对决 → 胜者组冠军 (第1名)
```

败者组：
```
LR1: R1败者对决 → 胜者
LR2: 胜者 vs WR1败者 → 败者组冠军 (第2名)
```

- 选手卡片：圆角矩形 + 名字 + 胜局输入框
- 点击卡片 = 选为该场胜者，自动推进到下一轮
- 胜局输入框在卡片旁（如 `[A: 2] vs [B: 1]` 表示2-1）
- 已确定的比赛：胜者高亮，败者灰显
- 未到达的比赛：显示"待定"占位

**SVG连线样式：**
- 经典电竞对战树风格
- 比赛卡片之间用水平+垂直线连接
- 汇聚点表示下一场比赛位置

### 小组赛第二轮Tab

**列表视图：** 4个小组卡片，点击进入详情

**详情视图（纯记录表，无SVG）：**
- 3个选手卡片纵向排列
  - 每张卡片显示：选手名 + 胜场输入框 + 负场输入框
  - 可拖拽调整上下顺序（排名 = 当前排列顺序）
  - 第1名自动晋级淘汰赛

### 16人淘汰赛Tab

**SVG对战图：**
```
8强（左右两区，各4场）:
  [P1] vs [P2] → 4强
  [P3] vs [P4] → 4强
  [P5] vs [P6] → 4强
  [P7] vs [P8] → 4强

半决赛（2场）:
  8强胜者对决

决赛（1场）:
  半决赛胜者对决 → 冠军
```

- 交互方式与小组赛第一轮SVG相同
- 点击选胜者，自动推进
- 胜局输入框在卡片旁

---

## 数据模型（后端Python对象，序列化为JSON）

```python
state = {
  // 选手
  players: [{ id: string, name: string, poolId: string | null }],

  // 池
  pools: [{ id: string, name: string }],

  // 小组赛第一轮
  groupStage1: {
    locked: boolean,
    groups: [{
      id: string,
      playerIds: [string, string, string, string],
      bracket: {
        r1: [
          { p1: string, p2: string, score1: number, score2: number, winner: string|null },
          { p1: string, p2: string, score1: number, score2: number, winner: string|null }
        ],
        wr1: { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null },
        lr1: { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null },
        lr2: { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null }
      },
      first: string|null,   // 小组第1 (胜者组冠军)
      second: string|null   // 小组第2 (败者组冠军)
    }]
  },

  // 小组赛第二轮
  groupStage2: {
    locked: boolean,
    groups: [{
      id: string,
      playerIds: [string, string, string],
      players: [                          // 按排名顺序，含胜负场次
        { playerId: string, wins: number, losses: number },
        { playerId: string, wins: number, losses: number },
        { playerId: string, wins: number, losses: number }
      ],
      first: string|null
    }]
  },

  // 16人淘汰赛
  elimination: {
    locked: boolean,
    bracket: {
      r16: [  // 8强，8场比赛
        { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null },
        // ... 共8场
      ],
      r8: [   // 4强，4场比赛
        { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null },
        // ... 共4场
      ],
      r4: [   // 半决赛，2场比赛
        { p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null },
        // ... 共2场
      ],
      final: { // 决赛
        p1: string|null, p2: string|null, score1: number, score2: number, winner: string|null
      }
    }
  },

  // 历史
  history: [],       // 状态快照栈
  historyIndex: -1   // 当前位置
}
```

---

## 存盘与撤销

### 自动存盘
- 每次API操作后，后端自动将state写入 `tournament_data.json`
- 服务重启后自动从文件恢复

### 手动导出/导入
- "导出JSON"按钮：调用 `GET /api/export` 下载JSON文件
- "导入JSON"按钮：上传JSON文件，调用 `POST /api/import` 恢复赛事

### 撤销/重做
- 后端维护history栈，每次操作前深拷贝当前state
- 前端发送 `POST /api/undo` 或 `POST /api/redo`
- Ctrl+Z / Ctrl+Y 快捷键绑定
- 右下角显示撤销/重做按钮（带步数提示）
- 历史栈上限50步

---

## 选手ID编辑与替补

- 选手管理Tab中双击选手卡片可编辑名字
- 修改后所有已排好的赛程中该选手名字同步更新
- 不影响对阵结构、比分、晋级状态
- 支持替补场景：将选手名改为替补选手名即可

---

## 晋级流程

### 自动晋级
- 小组赛第一轮完成后：12个第1名自动填入淘汰赛r16，12个第2名自动填入小组赛第二轮
- 小组赛第二轮完成后：4个第1名自动填入淘汰赛r16剩余位置
- 操作者可在自动晋级后手动调整

### 淘汰赛签位随机
- 16人随机分配到8场比赛的16个位置
- 提供"重新随机"按钮

---

## 验收标准

1. Flask后端启动后监听本地端口，前端浏览器访问可用
2. CSV导入48人，分配池，随机分组到12组
3. 每组双败对战图正确渲染（SVG连线），点击选胜者自动推进
4. 第一轮结束后，12个第1名进淘汰赛，12个第2名进第二轮
5. 第二轮记录表（胜负场次输入+拖拽排名）正确工作
6. 第二轮结束后4个第1名进淘汰赛
7. 16人淘汰赛SVG对战图正确渲染
8. 比分输入在正确位置（SVG中卡片旁 / 排名卡片上）
9. 选手ID可编辑，不影响赛程
10. 存盘/读盘/撤销/重做正常工作
11. `tournament_data.json` 自动持久化，重启后数据不丢失
