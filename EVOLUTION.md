# EVOLUTION.md 

## 1. 你如何实现提示功能？

提示功能通过 `Sudoku` 对象的两个方法实现：

- **`getCandidates(row, col)`**：计算指定格子的候选数集合。基于数独规则，排除行、列、3x3宫中已出现的数字，返回剩余可用数字数组。
- **`getNextHint()`**：遍历整个棋盘，找到第一个候选数集合只有一个元素的空格，返回其位置和推定值 `{row, col, value}`。若无此类格子，返回 `null`。

`Game` 对象通过 `getCurrentSudoku()` 获取当前棋盘（自动判断普通/探索模式），然后调用上述方法。`gameStore.js` 封装了 `getHint(pos)` 方法供 UI 调用。

## 2. 你认为提示功能更属于 `Sudoku` 还是 `Game`？为什么？

更属于 **`Sudoku`**。

原因：提示功能的核心是候选数计算（`getCandidates`）和推定值推断（`getNextHint`），这些都是基于数独棋盘状态（9x9网格）的纯领域逻辑，不依赖会话状态、历史记录等。

`Game` 负责历史记录、状态切换等，只需调用 `Sudoku` 的提示接口并暴露给外部即可。这种分工保持了职责清晰：`Sudoku` 负责"是什么"，`Game` 负责"怎么用"。

## 3. 你如何实现探索模式？

探索模式在 `Game` 中实现，本质是一种**状态切换 + 独立历史**：

### 状态管理
- `state.isExploring`：标记是否处于探索模式
- `state.exploreStartIndex`：记录进入探索时的主历史索引，用于提交/回滚
- `state.exploreHistory`：探索期间的独立线性历史（存储 `Sudoku` 对象）
- `state.exploreHistoryIndex`：探索历史的当前位置（支持探索内撤销/重做）
- `state.failedExploreStates`：存储失败棋盘签名的 `Set`，实现跨探索会话的失败路径记忆

### 核心流程
1. **进入探索**：`startExplore()` 基于当前棋盘创建探索历史，记录起点
2. **探索猜测**：`exploreGuess(move)` 在探索历史中填入数字，冲突则记录失败状态
3. **探索内撤销/重做**：`exploreUndo()/exploreRedo()` 在探索历史中移动
4. **提交探索**：`commitExplore()` 将探索结果推入主历史，清空探索状态
5. **放弃探索**：`cancelExplore()` 丢弃探索历史，回到主局面

### 失败路径记忆
- 冲突时记录**冲突前的棋盘签名**（`current.getGridSignature()`）
- 检查失败时，对比当前棋盘签名是否在失败集合中
- 失败记忆跨探索会话保留（`cancelExplore()` 不清除 `failedExploreStates`）

## 4. 主局面与探索局面的关系是什么？

### 对象关系：复制对象
主局面和探索局面是**复制对象**的关系，不是共享对象。

- **进入探索时**：`startExplore()` 调用 `getSudoku()` 获取当前棋盘的克隆（`clone()`），作为探索起点存入 `exploreHistory[0]`。不会产生深拷贝问题。
- **探索过程中**：每次 `exploreGuess()` 都基于上一个状态 `clone()` 新对象，避免引用污染
- **提交时**：`commitExplore()` 将探索结果的克隆推入主历史（`state.history.push({sudoku: exploreResult.clone()})`）
- **放弃时**：直接丢弃 `exploreHistory`，不修改主历史，实现快速回滚


## 5. 你的 history 结构在本次作业中是否发生了变化？

**发生了变化**，但保持向下兼容：

### 主 history：仍然是线性栈
- 结构：`state.history = [{sudoku}, ...]`，线性数组
- 索引：`state.historyIndex` 指向当前位置
- 操作：`guess()` 时截断并重推，`undo()/redo()` 移动索引

### 新增：探索独立 history
- 结构：`state.exploreHistory = [sudoku, ...]`，独立的线性数组
- 索引：`state.exploreHistoryIndex` 支持探索内撤销/重做
- 提交后：探索历史被清空，结果合并到主 history

### 未引入树状分支
未实现树状探索分支。探索过程是线性的，每次只能有一条探索路径。`failedExploreStates` 实现了某种形式的"路径记忆"，但不是树状结构。

## 6. Homework 1 中的哪些设计，在 Homework 2 中暴露出了局限？

### 局限1：History 结构过于简单
Homework 1 中 `history` 是单一的线性栈，无法支持分支探索。如果需要支持同时在多个分支上尝试，当前结构无法扩展。

### 局限2：Sudoku 缺少领域逻辑
Homework 1 中 `Sudoku` 只封装了最基本的 `guess()` 和 `getGrid()`，缺少候选数计算、冲突检测等核心领域逻辑。本次作业补充了 `getCandidates()`、`hasConflict()` 等方法，说明这些逻辑本应属于领域对象。

### 局限3：Game 的状态管理不够抽象
Homework 1 中 `Game` 的状态（`history`、`historyIndex`）是直接暴露的，没有抽象成更通用的"状态机"或"会话管理器"。导致新增探索状态时，需要手动管理多个独立状态（`isExploring`、`exploreHistory`、`exploreStartIndex` 等），容易出错。

## 7. 如果重做一次 Homework 1，你会如何修改原设计？

### 修改1：设计更灵活的历史结构
考虑使用**链表或树状结构**表示历史，每个节点包含 `sudoku` 和 `children` 数组，天然支持分支。或者使用**命令模式**，将每次操作封装成可逆的命令对象。

### 修改2：抽象状态管理
将 `Game` 的状态管理抽象成独立的 `HistoryManager` 类，支持：
- 主历史与分支历史的切换
- 自动的快照与回滚
- 可扩展的分支策略

### 修改3：分离 UI 状态与领域状态
将 `gameStore.js` 中的 UI 状态（如 `canUndo`、`invalidCells`）与领域状态（如 `grid`）更清晰地分离，避免领域对象直接依赖 UI 框架。
