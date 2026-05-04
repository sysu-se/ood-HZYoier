const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;

/**
 输入grid应为9x9的二维数组，值为0-9，0表示空单元格
 */

//深拷贝
function deepCloneGrid(grid) {
    return grid.map(row => [...row]);
}

export function createSudoku(input) {
    const grid = deepCloneGrid(input);

    function getGrid() {
        return deepCloneGrid(grid);
    }

    function guess(move) {
        const { row, col, value } = move;
        if (row >= 0 && row < SUDOKU_SIZE && col >= 0 && col < SUDOKU_SIZE) {
            // 0 表示清空单元格，1-9 为有效输入
            if ((Number.isInteger(value) && value >= 0 && value <= 9) || value === null) {
                grid[row][col] = value === null ? 0 : value;
            }
        }
    }

    function clone() {
        return createSudoku(grid);
    }

    function toJSON() {
        return { grid: deepCloneGrid(grid) }; //返回对象
    } 

    function toString() {
        let result = '';
        for (let i = 0; i < SUDOKU_SIZE; i++) {
            //分隔出每个3x3的方块
            if (i > 0 && i % BOX_SIZE === 0) result += '\n';

            for (let j = 0; j < SUDOKU_SIZE; j++) {
                if (j > 0 && j % BOX_SIZE === 0) result += ' ';
                // 0 表示空单元格
                result += grid[i][j] + ' ';
            }
            result += '\n';
        }
        return result;
    }

    // 获取指定格子的候选数集合（行、列、宫去重后的可用数字）
    function getCandidates(row, col) {
        if (grid[row][col] !== 0) return [];
        const candidates = new Set([1,2,3,4,5,6,7,8,9]);
        
        for (let c = 0; c < SUDOKU_SIZE; c++) {
            if (grid[row][c] !== 0) candidates.delete(grid[row][c]);
        }
        for (let r = 0; r < SUDOKU_SIZE; r++) {
            if (grid[r][col] !== 0) candidates.delete(grid[r][col]);
        }
        const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
            for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
                if (grid[r][c] !== 0) candidates.delete(grid[r][c]);
            }
        }
        return Array.from(candidates);
    }

    // 获取下一步提示，找到第一个只有一个候选数的空格
    function getNextHint() {
        for (let r = 0; r < SUDOKU_SIZE; r++) {
            for (let c = 0; c < SUDOKU_SIZE; c++) {
                if (grid[r][c] === 0) {
                    const candidates = getCandidates(r, c);
                    if (candidates.length === 1) {
                        return { row: r, col: c, value: candidates[0] };
                    }
                }
            }
        }
        return null;
    }

    // 检查在指定位置填入value是否产生冲突（行、列、宫重复）
    function isConflicted(row, col, value) {
        for (let c = 0; c < SUDOKU_SIZE; c++) {
            if (c !== col && grid[row][c] === value) return true;
        }
        for (let r = 0; r < SUDOKU_SIZE; r++) {
            if (r !== row && grid[r][col] === value) return true;
        }
        const br = Math.floor(row / BOX_SIZE) * BOX_SIZE;
        const bc = Math.floor(col / BOX_SIZE) * BOX_SIZE;
        for (let r = br; r < br + BOX_SIZE; r++) {
            for (let c = bc; c < bc + BOX_SIZE; c++) {
                if (r !== row && c !== col && grid[r][c] === value) return true;
            }
        }
        return false;
    }

    // 检查整个棋盘是否存在冲突
    function hasConflict() {
        for (let r = 0; r < SUDOKU_SIZE; r++) {
            for (let c = 0; c < SUDOKU_SIZE; c++) {
                const val = grid[r][c];
                if (val === 0) continue;
                grid[r][c] = 0;
                const conflict = isConflicted(r, c, val);
                grid[r][c] = val;
                if (conflict) return true;
            }
        }
        return false;
    }

    // 生成棋盘唯一签名，用于失败路径记忆
    function getGridSignature() {
        return JSON.stringify(grid);
    }

    return {
        getGrid,
        guess,
        clone,
        toJSON,
        toString,
        getCandidates,
        getNextHint,
        isConflicted,
        hasConflict,
        getGridSignature
    };
}

export function createGame(params) {
    //使用state管理，在反序列化时可以用undo回到初始状态
    const state = {
        initialSudoku: params.sudoku.clone(),
        history: [],
        historyIndex: 0,
        isExploring: false,
        exploreStartIndex: -1,
        exploreHistory: [],
        exploreHistoryIndex: 0,
        failedExploreStates: new Set()
    };

    function getSudoku() {
        const current = state.historyIndex > 0
            ? state.history[state.historyIndex - 1].sudoku
            : state.initialSudoku;
        return current.clone();
    }

    function guess(move) {
        const current = state.historyIndex > 0
            ? state.history[state.historyIndex - 1].sudoku
            : state.initialSudoku;
        
        state.history.splice(state.historyIndex);
        //保存当前状态的副本，防止外部绕过历史直接修改Sudoku对象导致undo/redo失真
        state.history.push({ sudoku: current.clone() }); 
        state.historyIndex = state.history.length;
        
        state.history[state.historyIndex - 1].sudoku.guess(move);
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length) {
            state.historyIndex++;
        }
    }

    function canUndo() {
        return state.historyIndex > 0;
    }

    function canRedo() {
        return state.historyIndex < state.history.length;
    }

    //序列化游戏状态，包含初始数独和历史记录
    function toJSON() {
        return {
            initialSudoku: state.initialSudoku.toJSON(),
            history: state.history.map(h => h.sudoku.toJSON()),
            historyIndex: state.historyIndex
        };
    }

    //反序列化游戏状态，重建数独对象和历史记录
    function loadFromJSON(json) {
        state.initialSudoku = createSudoku(json.initialSudoku.grid);
        state.history.length = 0;
        json.history.forEach(h => {
            state.history.push({
                sudoku: createSudoku(h.grid)
            });
        });
        state.historyIndex = json.historyIndex;
    }

    function getInitialSudoku() {
        return state.initialSudoku;
    }

    // 进入探索模式：基于当前棋盘创建独立的探索历史
    function startExplore() {
        state.isExploring = true;
        state.exploreStartIndex = state.historyIndex;
        const currentSudoku = getSudoku();
        state.exploreHistory = [currentSudoku];
        state.exploreHistoryIndex = 1;
        // 保留failedExploreStates，实现跨探索会话的失败路径记忆
    }

    // 在探索模式下填入数字，返回是否成功（冲突则失败并记录）
    function exploreGuess(move) {
        if (!state.isExploring) return false;
        
        const current = state.exploreHistory[state.exploreHistoryIndex - 1].clone();
        current.guess(move);
        
        if (current.hasConflict()) {
            state.failedExploreStates.add(current.getGridSignature());
            return false;
        }
        
        state.exploreHistory.splice(state.exploreHistoryIndex);
        state.exploreHistory.push(current);
        state.exploreHistoryIndex = state.exploreHistory.length;
        return true;
    }

    // 探索模式内撤销：回到上一步探索状态
    function exploreUndo() {
        if (!state.isExploring || state.exploreHistoryIndex <= 1) return;
        state.exploreHistoryIndex--;
    }

    // 探索模式内重做：前进到下一步探索状态
    function exploreRedo() {
        if (!state.isExploring || state.exploreHistoryIndex >= state.exploreHistory.length) return;
        state.exploreHistoryIndex++;
    }

    // 检查探索模式是否可以撤销
    function canExploreUndo() {
        return state.isExploring && state.exploreHistoryIndex > 1;
    }

    // 检查探索模式是否可以重做
    function canExploreRedo() {
        return state.isExploring && state.exploreHistoryIndex < state.exploreHistory.length;
    }

    // 获取当前探索棋盘的副本
    function getExploreSudoku() {
        if (!state.isExploring) return null;
        return state.exploreHistory[state.exploreHistoryIndex - 1].clone();
    }

    // 检查当前探索状态是否已在失败路径集合中
    function isExploreFailed() {
        if (!state.isExploring) return false;
        const currentSig = state.exploreHistory[state.exploreHistoryIndex - 1].getGridSignature();
        return state.failedExploreStates.has(currentSig);
    }

    // 提交探索结果：将探索棋盘合并到主历史中
    function commitExplore() {
        if (!state.isExploring) return;
        
        const exploreResult = state.exploreHistory[state.exploreHistoryIndex - 1];
        state.history.splice(state.exploreStartIndex);
        state.history.push({ sudoku: exploreResult.clone() });
        state.historyIndex = state.history.length;
        state.isExploring = false;
        state.exploreHistory = [];
        state.exploreHistoryIndex = 0;
    }

    // 取消探索：放弃探索结果，清空探索状态，保留失败路径记忆
    function cancelExplore() {
        if (!state.isExploring) return;
        state.isExploring = false;
        state.exploreHistory = [];
        state.exploreHistoryIndex = 0;
        // 不清除failedExploreStates，保留跨探索会话的失败路径记忆
    }

    // 检查当前是否处于探索模式
    function isExploring() {
        return state.isExploring;
    }

    // 获取当前应显示的棋盘
    function getCurrentSudoku() {
        return state.isExploring ? getExploreSudoku() : getSudoku();
    }

    // 统一的猜测方法
    function currentGuess(move) {
        if (state.isExploring) {
            return exploreGuess(move);
        } else {
            guess(move);
            return true;
        }
    }

    // 获取当前游戏状态快照，方便UI同步
    function getGameState() {
        const isExplore = state.isExploring;
        return {
            isExploring: isExplore,
            sudoku: getCurrentSudoku(),
            canUndo: isExplore ? canExploreUndo() : canUndo(),
            canRedo: isExplore ? canExploreRedo() : canRedo(),
            isExploreFailed: isExplore ? isExploreFailed() : false,
            exploreHistoryLength: isExplore ? state.exploreHistory.length : 0,
            exploreHistoryIndex: isExplore ? state.exploreHistoryIndex : 0
        };
    }

    return {
        getSudoku,
        getInitialSudoku,
        guess,
        undo,
        redo,
        canUndo,
        canRedo,
        startExplore,
        exploreGuess,
        exploreUndo,
        exploreRedo,
        canExploreUndo,
        canExploreRedo,
        getExploreSudoku,
        isExploreFailed,
        commitExplore,
        cancelExplore,
        isExploring,
        getCurrentSudoku,
        currentGuess,
        getGameState,
        toJSON,
        loadFromJSON
    };
}

export function createSudokuFromJSON(json) {
    return createSudoku(json.grid);
}


export function createGameFromJSON(json) {
    const game = createGame({ sudoku: createSudoku(json.initialSudoku.grid) });
    game.loadFromJSON(json);
    return game;
}
