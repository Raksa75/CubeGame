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
                    ctx.fillRect(x, y, S, S);
                } else {
                    this._drawStar(ctx, x + S / 2, y + S / 2, 5, S * 0.28, S * 0.12, '#ffd700');
                }
                break;

            case 'red': {
                const active = state.colorPhase === 1;
                ctx.fillStyle = active ? '#3d0f0f' : '#1a0808';
                ctx.fillRect(x, y, S, S);
                ctx.strokeStyle = active ? '#f85149' : '#5a1a1a';
                ctx.lineWidth = active ? 2.5 : 1;
                ctx.strokeRect(x + 3, y + 3, S - 6, S - 6);
                if (active) {
                    ctx.fillStyle = 'rgba(248,81,73,0.18)';
                    ctx.fillRect(x + 6, y + 6, S - 12, S - 12);
                }
                break;
            }

            case 'blue': {
                const active = state.colorPhase === 0;
                ctx.fillStyle = active ? '#0f1a3d' : '#080a1a';
                ctx.fillRect(x, y, S, S);
                ctx.strokeStyle = active ? '#58a6ff' : '#1a2a5a';
                ctx.lineWidth = active ? 2.5 : 1;
                ctx.strokeRect(x + 3, y + 3, S - 6, S - 6);
                if (active) {
                    ctx.fillStyle = 'rgba(88,166,255,0.18)';
                    ctx.fillRect(x + 6, y + 6, S - 12, S - 12);
                }
                break;
            }

            case 'teleport': {
                ctx.fillStyle = '#1a0a2e';
                ctx.fillRect(x, y, S, S);
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
                ctx.strokeStyle = `rgba(188,140,255,${0.4 + 0.6 * pulse})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x + S / 2, y + S / 2, S * 0.3 + pulse * 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(188,140,255,${0.15 + 0.25 * pulse})`;
                ctx.beginPath();
                ctx.arc(x + S / 2, y + S / 2, S * 0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#bc8cff';
                ctx.font = `bold ${Math.floor(S * 0.22)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('TP', x + S / 2, y + S / 2);
                break;
            }

            case 'door': {
                const open = state.grid[r][c].open;
                ctx.fillStyle = open ? '#0d2a0d' : '#1a0d0d';
                ctx.fillRect(x, y, S, S);
                ctx.strokeStyle = open ? '#3fb950' : '#f85149';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 3, y + 3, S - 6, S - 6);
                if (!open) {
                    ctx.strokeStyle = '#f85149';
                    ctx.lineWidth = 3;
                    for (let i = 1; i <= 2; i++) {
                        ctx.beginPath();
                        ctx.moveTo(x + S * i / 3, y + 10);
                        ctx.lineTo(x + S * i / 3, y + S - 10);
                        ctx.stroke();
                    }
                }
                ctx.fillStyle = open ? '#3fb950' : '#f85149';
                ctx.font = `bold ${Math.floor(S * 0.17)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(open ? 'OPEN' : 'LOCK', x + S / 2, y + S - 14);
                break;
            }

            case 'rotate': {
                ctx.fillStyle = '#0a1a2a';
                ctx.fillRect(x, y, S, S);
                ctx.strokeStyle = '#39d353';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 3, y + 3, S - 6, S - 6);
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(x + S / 2, y + S / 2, S * 0.22, Math.PI * 0.2, Math.PI * 1.9);
                ctx.stroke();
                const ang = Math.PI * 1.9;
                const ax = x + S / 2 + Math.cos(ang) * S * 0.22;
                const ay = y + S / 2 + Math.sin(ang) * S * 0.22;
                ctx.fillStyle = '#39d353';
                ctx.beginPath();
                ctx.arc(ax, ay, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            default:
                ctx.fillStyle = '#161b22';
                ctx.fillRect(x, y, S, S);
        }

        if (type !== 'wall') {
            ctx.strokeStyle = 'rgba(48,54,61,0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, S, S);
        }
    }

    _drawStar(ctx, cx, cy, spikes, outerR, innerR, color) {
        ctx.save();
        ctx.beginPath();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2);
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / spikes;
            i === 0 ? ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle))
                    : ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
    }

    _drawCube(ctx, cubePos, cube) {
        const S = this.CELL;
        const D = this.DEPTH;
        const { x, y } = this.cellXY(cubePos.row, cubePos.col);

        const hollow = cube.hollowDown;
        const mainColor = hollow ? '#1f6feb' : '#d63031';
        const topColor  = hollow ? '#1158c7' : '#b52828';
        const sideColor = hollow ? '#0d3d8e' : '#8b1e1e';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + S / 2 + D / 2, y + S - 8 + D / 2, S * 0.36, S * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right face
        ctx.fillStyle = sideColor;
        ctx.beginPath();
        ctx.moveTo(x + S - 7, y + 7);
        ctx.lineTo(x + S - 7 + D, y + 7 - D);
        ctx.lineTo(x + S - 7 + D, y + S - 7 - D);
        ctx.lineTo(x + S - 7, y + S - 7);
        ctx.closePath();
        ctx.fill();

        // Top face
        ctx.fillStyle = topColor;
        ctx.beginPath();
        ctx.moveTo(x + 7, y + 7);
        ctx.lineTo(x + 7 + D, y + 7 - D);
        ctx.lineTo(x + S - 7 + D, y + 7 - D);
        ctx.lineTo(x + S - 7, y + 7);
        ctx.closePath();
        ctx.fill();

        // Front face
        ctx.fillStyle = mainColor;
        ctx.fillRect(x + 7, y + 7, S - 14, S - 14);

        if (hollow) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(x + 19, y + 19, S - 38, S - 38);
            ctx.strokeStyle = 'rgba(100,180,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 19, y + 19, S - 38, S - 38);
        }

        ctx.strokeStyle = hollow ? '#58a6ff' : '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 7, y + 7, S - 14, S - 14);
    }

    renderCubeState(cube) {
        const ctx = this.cctx;
        const W = this.cc.width;
        const H = this.cc.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        const cross = [
            { slot: 'top',    gx: 1, gy: 0 },
            { slot: 'left',   gx: 0, gy: 1 },
            { slot: 'front',  gx: 1, gy: 1 },
            { slot: 'right',  gx: 2, gy: 1 },
            { slot: 'back',   gx: 3, gy: 1 },
            { slot: 'bottom', gx: 1, gy: 2 },
        ];

        const fs = Math.floor((Math.min(W, H) - 4) / 3);
        const startX = (W - fs * 4) / 2;
        const startY = (H - fs * 3) / 2;
        const slotLabels = { top: 'HAUT', bottom: 'BAS', front: 'DEV', back: 'ARR', left: 'GAU', right: 'DRO' };

        cross.forEach(({ slot, gx, gy }) => {
            const isHollow = cube[slot] === 1;
            const cx = startX + gx * fs;
            const cy = startY + gy * fs;

            ctx.fillStyle = isHollow ? '#0d2a4a' : '#161b22';
            ctx.fillRect(cx + 2, cy + 2, fs - 4, fs - 4);
            ctx.strokeStyle = isHollow ? '#58a6ff' : '#30363d';
            ctx.lineWidth = isHollow ? 2 : 1;
            ctx.strokeRect(cx + 2, cy + 2, fs - 4, fs - 4);

            ctx.fillStyle = isHollow ? '#58a6ff' : '#8b949e';
            ctx.font = `${isHollow ? 'bold ' : ''}${Math.floor(fs * 0.24)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slotLabels[slot], cx + fs / 2, cy + fs / 2 - (isHollow ? fs * 0.1 : 0));
            if (isHollow) {
                ctx.fillStyle = '#ffd700';
                ctx.font = `bold ${Math.floor(fs * 0.2)}px monospace`;
                ctx.fillText('★', cx + fs / 2, cy + fs / 2 + fs * 0.2);
            }
        });

        const hollowPos = cube.hollowPosition();
        const posLabels = {
            top: 'HAUT', bottom: 'BAS', front: 'DEVANT',
            back: 'ARRIÈRE', left: 'GAUCHE', right: 'DROITE',
        };
        const faceNameEl = document.getElementById('face-name');
        if (faceNameEl) {
            faceNameEl.textContent = posLabels[hollowPos] || hollowPos.toUpperCase();
            faceNameEl.className = hollowPos === 'bottom' ? '' : 'solid';
        }
    }
}