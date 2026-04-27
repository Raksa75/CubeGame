// Material indices for Three.js BoxGeometry faces:
//   0=+X(right)  1=-X(left)  2=+Y(top)  3=-Y(bottom)  4=+Z(front)  5=-Z(back)
//
// The hollow face is ALWAYS material index 3 (local -Y).
// We track the cube's accumulated world quaternion so the mesh physically rotates —
// which naturally places the dark -Y face at whichever world direction is "hollow".
// This way the player can read the cube state just by looking at the 3D model.

class Renderer {
    constructor(container, cubeCanvas) {
        this.container = container;
        this.cc = cubeCanvas;
        this.cctx = cubeCanvas.getContext('2d');

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1117);
        this.scene.fog = new THREE.FogExp2(0x0d1117, 0.025);

        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

        this.webgl = new THREE.WebGLRenderer({ antialias: true });
        this.webgl.shadowMap.enabled = true;
        this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
        this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.webgl.domElement.style.borderRadius = '8px';
        container.appendChild(this.webgl.domElement);

        this._tiles      = new Map();
        this._extras     = new Map();
        this._cubeMesh   = null;
        this._cubeMats   = null;
        this._cubeQuat   = new THREE.Quaternion();  // accumulated world orientation
        this._cubeAnim   = null;                    // current roll animation state
        this._levelGroup = new THREE.Group();
        this.scene.add(this._levelGroup);

        this._setupLights();
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    // ── Lights ─────────────────────────────────────────────────────────────────

    _setupLights() {
        this.scene.add(new THREE.AmbientLight(0x8090b0, 0.55));

        this._sun = new THREE.DirectionalLight(0xffffff, 1.0);
        this._sun.position.set(6, 14, 4);
        this._sun.castShadow = true;
        this._sun.shadow.mapSize.set(2048, 2048);
        Object.assign(this._sun.shadow.camera, { near: 1, far: 80, left: -24, right: 24, top: 24, bottom: -24 });
        this._sun.shadow.bias = -0.001;
        this.scene.add(this._sun);
        this._sunTarget = new THREE.Object3D();
        this.scene.add(this._sunTarget);
        this._sun.target = this._sunTarget;

        const fill = new THREE.DirectionalLight(0x4466cc, 0.25);
        fill.position.set(-4, 4, -4);
        this.scene.add(fill);
    }

    _resize() {
        const w = this.container.clientWidth  || 600;
        const h = this.container.clientHeight || 500;
        this.webgl.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    // ── Level setup ────────────────────────────────────────────────────────────

    resize(level) {
        this._buildScene(level);
        const cx = (level.width  - 1) / 2;
        const cz = (level.height - 1) / 2;
        const d  = Math.max(level.width, level.height);
        this.camera.position.set(cx - d * 0.25, d * 0.9, cz + d * 0.85);
        this.camera.lookAt(cx, 0, cz);
        this._sunTarget.position.set(cx, 0, cz);
        this._resize();
    }

    resetCubeOrientation() {
        this._cubeQuat.identity();
        this._cubeAnim = null;
    }

    _buildScene(level) {
        while (this._levelGroup.children.length) {
            this._levelGroup.remove(this._levelGroup.children[0]);
        }
        this._tiles.clear();
        this._extras.clear();
        this._cubeMesh = null;
        this._cubeMats = null;

        // Base slab
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(level.width + 1, 0.08, level.height + 1),
            new THREE.MeshLambertMaterial({ color: 0x090c12 })
        );
        base.position.set((level.width - 1) / 2, -0.1, (level.height - 1) / 2);
        base.receiveShadow = true;
        this._levelGroup.add(base);

        for (let r = 0; r < level.height; r++) {
            for (let c = 0; c < level.width; c++) {
                this._spawnTile(r, c, level.cells[r][c]);
            }
        }

        this._buildCube();
    }

    _spawnTile(r, c, type) {
        const key = `${r},${c}`;

        if (type === 'wall') {
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 0.65, 0.9),
                new THREE.MeshLambertMaterial({ color: 0x111118 })
            );
            m.position.set(c, 0.265, r);
            m.receiveShadow = true;
            m.castShadow   = true;
            this._levelGroup.add(m);
            this._tiles.set(key, m);
            return;
        }

        const tileColor = {
            floor: 0x161b22, star: 0x1a2030, red: 0x2a0d0d,
            blue: 0x0d1a2a, teleport: 0x150a28, door: 0x0a200a, rotate: 0x0a1520,
        }[type] || 0x161b22;

        const tileGeo = new THREE.BoxGeometry(0.92, 0.12, 0.92);
        const mat     = new THREE.MeshLambertMaterial({ color: tileColor, emissive: new THREE.Color(0, 0, 0) });
        const tile    = new THREE.Mesh(tileGeo, mat);
        tile.position.set(c, 0, r);
        tile.receiveShadow = true;
        tile.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(tileGeo),
            new THREE.LineBasicMaterial({ color: 0x30363d })
        ));
        this._levelGroup.add(tile);
        this._tiles.set(key, tile);

        if (type === 'star') {
            const star = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.2),
                new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 })
            );
            star.position.set(c, 0.38, r);
            star.castShadow = true;
            this._levelGroup.add(star);
            this._extras.set(key + '_star', star);
        }

        if (type === 'teleport') {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.28, 0.04, 8, 32),
                new THREE.MeshLambertMaterial({ color: 0xbc8cff, emissive: 0xbc8cff, emissiveIntensity: 0.6 })
            );
            ring.position.set(c, 0.1, r);
            ring.rotation.x = Math.PI / 2;
            this._levelGroup.add(ring);
            this._extras.set(key + '_ring', ring);
        }

        if (type === 'rotate') {
            const arrow = new THREE.Mesh(
                new THREE.ConeGeometry(0.14, 0.28, 6),
                new THREE.MeshLambertMaterial({ color: 0x39d353, emissive: 0x39d353, emissiveIntensity: 0.4 })
            );
            arrow.position.set(c, 0.24, r);
            this._levelGroup.add(arrow);
            this._extras.set(key + '_arrow', arrow);
        }
    }

    // ── Cube construction ──────────────────────────────────────────────────────

    _buildCube() {
        // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
        // Material index 3 (-Y bottom) is always the hollow face.
        // The accumulated quaternion physically rotates the mesh so the dark face
        // ends up at the correct world position after each roll.
        const solid  = c => new THREE.MeshLambertMaterial({ color: c });
        this._cubeMats = [
            solid(0x8a96a8),   // 0  +X right   — stone grey
            solid(0x7a8698),   // 1  -X left     — slightly darker
            solid(0xaab5c5),   // 2  +Y top      — lighter (catches light)
            solid(0x0e0205),   // 3  -Y bottom   ← HOLLOW (dark red-black)
            solid(0x8a96a8),   // 4  +Z front
            solid(0x7a8698),   // 5  -Z back
        ];

        const geo = new THREE.BoxGeometry(0.88, 0.88, 0.88);
        this._cubeMesh = new THREE.Mesh(geo, this._cubeMats);
        this._cubeMesh.castShadow = true;

        this._cubeMesh.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0xc8d0dc })
        ));

        this._levelGroup.add(this._cubeMesh);
    }

    // ── Animation API (called by Game) ─────────────────────────────────────────

    isAnimating() { return this._cubeAnim !== null; }

    // dir: 'up'|'down'|'left'|'right'  (game direction, not world direction)
    animateRoll(dir, fromPos, toPos) {
        // World-space rotation axes for each game direction
        // Verified: rollRight → -90° Z, rollLeft → +90° Z,
        //           rollForward(down) → +90° X, rollBackward(up) → -90° X
        const cfg = {
            right: { ax: 0, ay: 0, az: 1, angle: -Math.PI / 2 },
            left:  { ax: 0, ay: 0, az: 1, angle:  Math.PI / 2 },
            down:  { ax: 1, ay: 0, az: 0, angle:  Math.PI / 2 },
            up:    { ax: 1, ay: 0, az: 0, angle: -Math.PI / 2 },
        }[dir];

        const rollQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(cfg.ax, cfg.ay, cfg.az), cfg.angle
        );
        // World-space pre-multiplication: newQuat = roll * currentQuat
        const toQuat = rollQ.clone().multiply(this._cubeQuat);

        this._cubeAnim = {
            fromPos:  { col: fromPos.col, row: fromPos.row },
            toPos:    { col: toPos.col,   row: toPos.row   },
            fromQuat: this._cubeQuat.clone(),
            toQuat,
            startTime: Date.now(),
            duration:  160,  // ms
        };
    }

    // CCW rotation tile: -90° around world Y
    applyCCWRotation() {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        this._cubeQuat.premultiply(q);
        if (this._cubeMesh) this._cubeMesh.quaternion.copy(this._cubeQuat);
    }

    // ── Per-frame animation update ─────────────────────────────────────────────

    _tickAnim() {
        if (!this._cubeAnim) return;
        const { fromPos, toPos, fromQuat, toQuat, startTime, duration } = this._cubeAnim;

        const raw = (Date.now() - startTime) / duration;
        const t   = Math.min(raw, 1);
        // Ease in-out quad
        const e   = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        // Arc position: linear in X/Z, sine bump in Y
        this._cubeMesh.position.set(
            fromPos.col + (toPos.col - fromPos.col) * e,
            0.50 + 0.14 * Math.sin(e * Math.PI),
            fromPos.row + (toPos.row - fromPos.row) * e
        );

        // Smooth rotation slerp (compatible with all Three.js r128 builds)
        this._cubeMesh.quaternion.copy(fromQuat).slerp(toQuat, e);

        if (t >= 1) {
            this._cubeMesh.position.set(toPos.col, 0.50, toPos.row);
            this._cubeQuat.copy(toQuat);
            this._cubeMesh.quaternion.copy(toQuat);
            this._cubeAnim = null;
        }
    }

    // ── Main render ────────────────────────────────────────────────────────────

    render(state) {
        const { level, grid, cubePos, cube, colorPhase } = state;
        const t = Date.now();

        // Update tile materials and animated extras
        for (let r = 0; r < level.height; r++) {
            for (let c = 0; c < level.width; c++) {
                const key  = `${r},${c}`;
                const type = level.cells[r][c];
                const tile = this._tiles.get(key);

                if (type === 'red' && tile) {
                    const on = colorPhase === 1;
                    tile.material.color.setHex(on ? 0x5a1515 : 0x2a0808);
                    tile.material.emissive.setHex(on ? 0x3a0000 : 0x000000);
                    tile.material.emissiveIntensity = on ? 0.3 : 0;
                }
                if (type === 'blue' && tile) {
                    const on = colorPhase === 0;
                    tile.material.color.setHex(on ? 0x0f2a5a : 0x080a1a);
                    tile.material.emissive.setHex(on ? 0x001a3d : 0x000000);
                    tile.material.emissiveIntensity = on ? 0.3 : 0;
                }
                if (type === 'door' && tile) {
                    const open = grid[r][c].open;
                    tile.material.color.setHex(open ? 0x0d3a0d : 0x2a0808);
                    tile.material.emissive.setHex(open ? 0x003a00 : 0x3a0000);
                    tile.material.emissiveIntensity = 0.2;
                    tile.scale.y    = open ? 1 : 4.5;
                    tile.position.y = open ? 0 : 0.255;
                }
                if (type === 'teleport') {
                    const ring = this._extras.get(key + '_ring');
                    if (ring) {
                        ring.rotation.z += 0.02;
                        ring.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 0.004);
                    }
                }
                if (type === 'rotate') {
                    const arrow = this._extras.get(key + '_arrow');
                    if (arrow) arrow.rotation.y += 0.04;
                }

                // Floating star
                const star = this._extras.get(key + '_star');
                if (star) {
                    star.visible = !grid[r][c].collected;
                    if (star.visible) {
                        star.rotation.y  += 0.03;
                        star.position.y   = 0.38 + 0.07 * Math.sin(t * 0.0025 + r + c);
                    }
                }
            }
        }

        // Animate cube roll or hold position
        if (this._cubeAnim) {
            this._tickAnim();
        } else if (this._cubeMesh) {
            this._cubeMesh.position.set(cubePos.col, 0.50, cubePos.row);
            this._cubeMesh.quaternion.copy(this._cubeQuat);
        }

        this.webgl.render(this.scene, this.camera);
        this.renderCubeState(cube);
    }

    // ── Sidebar cube net (2-D canvas) ──────────────────────────────────────────

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
        const fs     = Math.floor((Math.min(W, H) - 4) / 3);
        const startX = (W - fs * 4) / 2;
        const startY = (H - fs * 3) / 2;
        const labels = { top: 'HAUT', bottom: 'BAS', front: 'DEV', back: 'ARR', left: 'GAU', right: 'DRO' };

        cross.forEach(({ slot, gx, gy }) => {
            const isHollow = cube[slot] === 1;
            const cx = startX + gx * fs;
            const cy = startY + gy * fs;
            ctx.fillStyle = isHollow ? '#1a0204' : '#161b22';
            ctx.fillRect(cx + 2, cy + 2, fs - 4, fs - 4);
            ctx.strokeStyle = isHollow ? '#ff4466' : '#30363d';
            ctx.lineWidth = isHollow ? 2 : 1;
            ctx.strokeRect(cx + 2, cy + 2, fs - 4, fs - 4);
            ctx.fillStyle = isHollow ? '#ff4466' : '#8b949e';
            ctx.font = `${isHollow ? 'bold ' : ''}${Math.floor(fs * 0.24)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[slot], cx + fs / 2, cy + fs / 2 - (isHollow ? fs * 0.1 : 0));
            if (isHollow) {
                ctx.fillStyle = '#ffd700';
                ctx.font = `bold ${Math.floor(fs * 0.2)}px monospace`;
                ctx.fillText('★', cx + fs / 2, cy + fs / 2 + fs * 0.2);
            }
        });

        const hollowPos  = cube.hollowPosition();
        const posLabels  = { top: 'HAUT', bottom: 'BAS', front: 'DEVANT', back: 'ARRIÈRE', left: 'GAUCHE', right: 'DROITE' };
        const el = document.getElementById('face-name');
        if (el) {
            el.textContent = posLabels[hollowPos] || hollowPos.toUpperCase();
            el.className   = hollowPos === 'bottom' ? '' : 'solid';
        }
    }
}
