class Game {
    constructor() {
        this.levelIndex = 0;
        this.cube = null;
        this.state = null;
        this.renderer = null;
        this.animId = null;
        this._init();
    }

    // ── Bootstrap ───────────────────────────────────────────────────────────────

    _init() {
        this.renderer = new Renderer(
            document.getElementById('game-area'),
            document.getElementById('cube-canvas'),
        );

        document.getElementById('btn-restart').addEventListener('click', () => this._restart());
        document.getElementById('btn-next').addEventListener('click', () => this._nextLevel());
        document.addEventListener('keydown', e => this._onKey(e));

        this._loadLevel(0);
    }

    // ── Level loading ────────────────────────────────────────────────────────────

    _loadLevel(idx) {
        this.levelIndex = idx;
        const level = LEVELS[idx];

        this.cube = new Cube(); // hollow face starts at bottom

        // Build mutable grid state
        const grid = level.cells.map((row, r) =>
            row.map((type, c) => {
                const cell = { type, collected: false, destroyed: false, open: true };
                // Init door state from level definition
                const doorDef = level.doors.find(d => d.row === r && d.col === c);
                if (doorDef) cell.open = doorDef.startOpen;
                return cell;
            })
        );

        this.state = {
            level,
            grid,
            cubePos: { ...level.start },
            cube: this.cube,
            starsCollected: 0,
            starsTotal: level.cells.flat().filter(t => t === 'star').length,
            moveCount: 0,
            colorPhase: 0,   // 0 = blue traversable, red impassable
            failed: false,
            won: false,
        };

        this._updateHUD();
        this._updateLegend();
        this.renderer.resetCubeOrientation();
        this.renderer.resize(level);

        document.getElementById('btn-next').classList.add('hidden');
        this._hideOverlay();
        this._loop();
    }

    // ── Render loop (needed for animated teleporter pulse) ───────────────────────

    _loop() {
        cancelAnimationFrame(this.animId);
        const tick = () => {
            if (this.state) this.renderer.render(this.state);
            this.animId = requestAnimationFrame(tick);
        };
        tick();
    }

    // ── Input ────────────────────────────────────────────────────────────────────

    _onKey(e) {
        if (this.state.won || this.state.failed) return;
        if (this.renderer.isAnimating()) return;

        const map = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            w: 'up', s: 'down', a: 'left', d: 'right',
            W: 'up', S: 'down', A: 'left', D: 'right',
        };
        if (e.key === 'r' || e.key === 'R') { this._restart(); return; }

        const dir = map[e.key];
        if (!dir) return;
        e.preventDefault();
        this._move(dir);
    }

    // ── Movement ─────────────────────────────────────────────────────────────────

    _move(dir) {
        const { state, cube } = this;
        const { cubePos, level, grid } = state;

        // Target cell
        const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
        const nr = cubePos.row + delta[0];
        const nc = cubePos.col + delta[1];

        // Bounds check
        if (nr < 0 || nr >= level.height || nc < 0 || nc >= level.width) return;

        // Passability check
        if (!this._isPassable(nr, nc)) return;

        // Apply roll
        const rollFn = { up: 'rollBackward', down: 'rollForward', left: 'rollLeft', right: 'rollRight' }[dir];
        const prevPos = { row: cubePos.row, col: cubePos.col };
        cube[rollFn]();

        // Move cube
        cubePos.row = nr;
        cubePos.col = nc;
        this.renderer.animateRoll(dir, prevPos, cubePos);
        state.moveCount++;

        // Toggle color phase after each move
        state.colorPhase = state.colorPhase === 0 ? 1 : 0;

        // Update door states
        this._updateDoors();

        // Handle landing on special cell
        this._onLand(nr, nc);

        this._updateHUD();
    }

    _isPassable(r, c) {
        const { level, grid, colorPhase } = this.state;
        const type = level.cells[r][c];
        if (type === 'wall') return false;
        if (type === 'red' && colorPhase === 0) return false; // red inactive when phase=0
        if (type === 'blue' && colorPhase === 1) return false; // blue inactive when phase=1
        if (type === 'door' && !grid[r][c].open) return false;
        return true;
    }

    _updateDoors() {
        const { level, grid, moveCount } = this.state;
        level.doors.forEach(doorDef => {
            const cell = grid[doorDef.row][doorDef.col];
            const phase = Math.floor(moveCount / doorDef.period) % 2;
            cell.open = doorDef.startOpen ? phase === 0 : phase === 1;
        });
    }

    _onLand(r, c) {
        const { state, cube } = this;
        const { level, grid } = state;
        const cellDef = level.cells[r][c];
        const cellState = grid[r][c];

        if (cellDef === 'star' && !cellState.collected) {
            cellState.collected = true;
            state.starsCollected++;
        }

        if (cellDef === 'teleport') {
            const pair = level.teleporterPairs.find(
                p => (p.a.row === r && p.a.col === c) || (p.b.row === r && p.b.col === c)
            );
            if (pair) {
                const dest = (pair.a.row === r && pair.a.col === c) ? pair.b : pair.a;
                state.cubePos.row = dest.row;
                state.cubePos.col = dest.col;
            }
        }

        if (cellDef === 'rotate') {
            cube.rotateCCW();
            this.renderer.applyCCWRotation();
        }

        if (state.starsCollected >= state.starsTotal) {
            state.won = true;
            this._showWin();
            return;
        }

        if (level.maxMoves !== null && state.moveCount >= level.maxMoves) {
            state.failed = true;
            this._showFail();
        }
    }

    _showWin() {
        const { state } = this;
        const moves = state.moveCount;
        document.getElementById('overlay-icon').textContent = '🏆';
        document.getElementById('overlay-title').textContent = 'Niveau complété !';
        document.getElementById('overlay-msg').textContent =
            `${state.starsCollected} étoile${state.starsCollected > 1 ? 's' : ''} collectée${state.starsCollected > 1 ? 's' : ''} en ${moves} mouvement${moves > 1 ? 's' : ''}.`;
        const btn1 = document.getElementById('overlay-btn1');
        const btn2 = document.getElementById('overlay-btn2');
        btn1.textContent = '↺ Rejouer';
        btn1.onclick = () => this._restart();
        if (this.levelIndex + 1 < LEVELS.length) {
            btn2.textContent = 'Niveau suivant →';
            btn2.classList.remove('hidden');
            btn2.onclick = () => this._nextLevel();
            document.getElementById('btn-next').classList.remove('hidden');
        } else {
            btn2.classList.add('hidden');
        }
        document.getElementById('overlay').classList.remove('hidden');
    }

    _showFail() {
        document.getElementById('overlay-icon').textContent = '💀';
        document.getElementById('overlay-title').textContent = 'Plus de mouvements !';
        document.getElementById('overlay-msg').textContent =
            `Vous avez épuisé vos ${this.state.level.maxMoves} mouvements. Réessayez !`;
        const btn1 = document.getElementById('overlay-btn1');
        const btn2 = document.getElementById('overlay-btn2');
        btn1.textContent = '↺ Recommencer';
        btn1.onclick = () => this._restart();
        btn2.classList.add('hidden');
        document.getElementById('overlay').classList.remove('hidden');
    }

    _restart() {
        this._loadLevel(this.levelIndex);
    }

    _nextLevel() {
        if (this.levelIndex + 1 < LEVELS.length) {
            this._loadLevel(this.levelIndex + 1);
        }
    }

    _updateHUD() {
        const { state } = this;
        document.getElementById('hud-level-num').textContent = state.level.id;
        document.getElementById('hud-stars-got').textContent = state.starsCollected;
        document.getElementById('hud-stars-total').textContent = state.starsTotal;
        const movesEl = document.getElementById('hud-moves');
        const movesLeftEl = document.getElementById('hud-moves-left');
        if (state.level.maxMoves !== null) {
            movesEl.classList.remove('hidden');
            movesLeftEl.textContent = state.level.maxMoves - state.moveCount;
        } else {
            movesEl.classList.add('hidden');
        }
    }

    _updateLegend() {
        const { level } = this.state;
        const mechSet = new Set(level.mechanics);
        document.getElementById('leg-red').classList.toggle('hidden', !mechSet.has('color'));
        document.getElementById('leg-blue').classList.toggle('hidden', !mechSet.has('color'));
        document.getElementById('leg-teleport').classList.toggle('hidden', !mechSet.has('teleport'));
        document.getElementById('leg-door').classList.toggle('hidden', !mechSet.has('door'));
        document.getElementById('leg-rotate').classList.toggle('hidden', !mechSet.has('rotate'));
        const hasWalls = level.cells.flat().includes('wall');
        document.getElementById('leg-wall').classList.toggle('hidden', !hasWalls);
    }

    _hideOverlay() {
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('overlay-btn2').classList.add('hidden');
    }
}

new Game();