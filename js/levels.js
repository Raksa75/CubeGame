// Cell type constants
const C = {
    F: 'floor',     // passable floor
    W: 'wall',      // impassable wall
    S: 'star',      // star to collect
    R: 'red',       // red color tile
    B: 'blue',      // blue color tile
    T: 'teleport',  // teleporter (pair defined in teleporterPairs)
    D: 'door',      // timed door (data in doors[])
    X: 'rotate',    // rotation tile (CCW 90°)
};

/**
 * Level format:
 *   cells[][]     — 2-D grid of cell type strings
 *   start         — {row, col} start position (hollow face DOWN at start)
 *   maxMoves      — null = unlimited
 *   teleporterPairs — [{a:{row,col}, b:{row,col}}]
 *   doors         — [{row, col, period, startOpen}]
 *                    period = toggles every N moves
 *   mechanics     — array of mechanic names shown in legend
 */
const LEVELS = [
    // ─────────────────────────────────────────
    // Level 1 — "Premiers Pas"
    // Simple 5×5, no obstacles, 3 stars.
    // Verified paths:
    //   Star (0,1)  : Up Up Up Left Up
    //   Star (2,4)  : Right Right Up Up
    //   Star (4,0)  : Up Left Left Down
    // ─────────────────────────────────────────
    {
        id: 1,
        name: 'Premiers Pas',
        width: 5, height: 5,
        start: { row: 4, col: 2 },
        maxMoves: null,
        mechanics: [],
        cells: [
            [C.F, C.S, C.F, C.F, C.F],
            [C.F, C.F, C.F, C.F, C.F],
            [C.F, C.F, C.F, C.F, C.S],
            [C.F, C.F, C.F, C.F, C.F],
            [C.S, C.F, C.F, C.F, C.F],
        ],
        teleporterPairs: [],
        doors: [],
    },

    // ─────────────────────────────────────────
    // Level 2 — "Chaud et Froid"
    // 5×5, red/blue alternating tiles.
    // Blue tiles are traversable at even move counts,
    // red tiles at odd move counts.
    // ─────────────────────────────────────────
    {
        id: 2,
        name: 'Chaud et Froid',
        width: 5, height: 5,
        start: { row: 4, col: 2 },
        maxMoves: null,
        mechanics: ['color'],
        cells: [
            [C.F, C.R, C.S, C.B, C.F],
            [C.R, C.F, C.F, C.F, C.B],
            [C.S, C.B, C.F, C.R, C.F],
            [C.F, C.F, C.R, C.F, C.B],
            [C.B, C.F, C.F, C.F, C.S],
        ],
        teleporterPairs: [],
        doors: [],
    },

    // ─────────────────────────────────────────
    // Level 3 — "Sauts Quantiques"
    // 6×6, walls + one teleporter pair + 3 stars.
    // ─────────────────────────────────────────
    {
        id: 3,
        name: 'Sauts Quantiques',
        width: 6, height: 6,
        start: { row: 5, col: 0 },
        maxMoves: null,
        mechanics: ['teleport'],
        cells: [
            [C.S, C.F, C.W, C.W, C.F, C.F],
            [C.F, C.W, C.F, C.F, C.W, C.F],
            [C.F, C.F, C.F, C.F, C.F, C.S],
            [C.F, C.W, C.T, C.W, C.F, C.F],
            [C.F, C.F, C.F, C.F, C.W, C.F],
            [C.F, C.F, C.F, C.F, C.T, C.S],
        ],
        teleporterPairs: [
            { a: { row: 3, col: 2 }, b: { row: 5, col: 4 } },
        ],
        doors: [],
    },

// ─────────────────────────────────────────
// Level 4 — "Contre la Montre"
    // 6×6, timed doors + move limit.
    // ─────────────────────────────────────────
    {
        id: 4,
        name: 'Contre la Montre',
        width: 6, height: 6,
        start: { row: 5, col: 0 },
        maxMoves: 22,
        mechanics: ['door'],
        cells: [
            [C.S, C.F, C.F, C.F, C.F, C.S],
            [C.F, C.W, C.W, C.F, C.W, C.F],
            [C.F, C.F, C.D, C.F, C.D, C.F],
            [C.F, C.W, C.F, C.F, C.F, C.F],
            [C.F, C.F, C.F, C.W, C.F, C.F],
            [C.F, C.F, C.F, C.F, C.F, C.S],
        ],
        teleporterPairs: [],
        doors: [
            { row: 2, col: 2, period: 3, startOpen: true },
            { row: 2, col: 4, period: 2, startOpen: false },
        ],
    },

    // ─────────────────────────────────────────
    // Level 5 — "Le Grand Mélange"
    // 7×7, toutes les mécaniques combinées.
    // ─────────────────────────────────────────
    {
        id: 5,
        name: 'Le Grand Mélange',
        width: 7, height: 7,
        start: { row: 6, col: 3 },
        maxMoves: null,
        mechanics: ['color', 'teleport', 'door', 'rotate'],
        cells: [
            [C.S, C.F, C.R, C.F, C.B, C.F, C.S],
            [C.F, C.W, C.F, C.T, C.F, C.W, C.F],
            [C.F, C.R, C.F, C.F, C.F, C.B, C.F],
            [C.F, C.F, C.D, C.X, C.D, C.F, C.F],
            [C.F, C.B, C.F, C.F, C.F, C.R, C.F],
            [C.F, C.W, C.F, C.T, C.F, C.W, C.F],
            [C.S, C.F, C.B, C.F, C.R, C.F, C.S],
        ],
        teleporterPairs: [
            { a: { row: 1, col: 3 }, b: { row: 5, col: 3 } },
        ],
        doors: [
            { row: 3, col: 2, period: 2, startOpen: true },
            { row: 3, col: 4, period: 3, startOpen: false },
        ],
    },
];