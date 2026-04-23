class Renderer {
    constructor(gameCanvas, cubeCanvas) {
        this.gc = gameCanvas;
        this.gctx = gameCanvas.getContext('2d');
        this.cc = cubeCanvas;
        this.cctx = cubeCanvas.getContext('2d');

        this.CELL = 72;   // px per grid cell
        this.PAD = 14;   // canvas padding
        this.DEPTH = 9;   // 3-D extrusion depth for cube
    }

    // ── Coordinate helpers ──────────────────────────────────────────────────────

    cellXY(row, col) {
        return {
            x: this.PAD + col * this.CELL,
            y: this.PAD + row * this.CELL,
        };
    }

    resize(level) {
        this.gc.width = level.width * this.CELL + this.PAD * 2;
        this.gc.height = level.height * this.CELL + this.PAD * 2;
    }

    // ── Main render entry ───────────────────────────────────────────────────────

    render(state) {
        this.renderGrid(state);
        this.renderCubeState(state.cube);
    }

    // ── Grid ────────────────────────────────────────────────────────────────────

    renderGrid(state) {
        const ctx = this.gctx;
        const { level, grid, cubePos, cube, colorPhase, moveCount } = state;

        ctx.clearRect(0, 0, this.gc.width, this.gc.height);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, this.gc.width, this.gc.height);

        for (let r = 0; r < level.height; r++) {
            for (let c = 0; c < level.width; c++) {
                const { x, y } = this.cellXY(r, c);
                const cellDef = level.cells[r][c];
                const cellState = grid[r][c];
                this._drawCell(ctx, x, y, cellDef, cellState, state, r, c);
            }
        }

        // Start marker (subtle)
        const sp = this.cellXY(level.start.row, level.start.col);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sp.x + 4, sp.y + 4, this.CELL - 8, this.CELL - 8);

        // Draw the cube (3-D box effect)
        this._drawCube(ctx, cubePos, cube);
    }

    _drawCell(ctx, x, y, type, cellState, state, r, c) {
        const S = this.CELL;

        // Determine fill color by type
        switch (type) {
            case 'floor':
                ctx.fillStyle = '#161b22';
                ctx.fillRect(x, y, S, S);
                break;

            case 'wall':
                ctx.fillStyle = '#0a0a0e';
                ctx.fillRect(x, y, S, S);
                // Hatching
                ctx.strokeStyle = '#1e1e28';
                ctx.lineWidth = 1;
                for (let i = 0; i < S * 2; i += 12) {
                    ctx.beginPath();
                    ctx.moveTo(x + i, y);
                    ctx.lineTo(x, y + i);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x + S, y + i - S);
                    ctx.lineTo(x + i - S, y + S);
                    ctx.stroke();
                }
                return; // no border

            case 'star':
                ctx.fillStyle = '#161b22';
                ctx.fillRect(x, y, S, S);
                if (cellState.collected) {
                    ctx.fillStyle = 'rgba(255,215,0,0.08)';
                    ctx.fillRect(x, y, S, S);
                } else if (cellState.destroyed) {
                    ctx.fillStyle = 'rgba(248,81,73,0.12)';