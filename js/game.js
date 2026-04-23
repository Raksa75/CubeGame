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
            document.getElementById('game-canvas'),
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
        cube[rollFn]();

        // Move cube
        cubePos.row = nr;
        cubePos.col = nc;
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