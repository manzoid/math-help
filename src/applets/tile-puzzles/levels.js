/**
 * Shape library and level definitions for the Tile Puzzles applet.
 *
 * Each shape is an array of [row, col] offsets normalized so that
 * the minimum row and col are both 0.
 */

/* ---- rotation utility ---- */

export function rotateCW(cells) {
  const maxR = Math.max(...cells.map(([r]) => r))
  const rotated = cells.map(([r, c]) => [c, maxR - r])
  const minR = Math.min(...rotated.map(([r]) => r))
  const minC = Math.min(...rotated.map(([, c]) => c))
  return rotated.map(([r, c]) => [r - minR, c - minC])
}

/* ---- shape library ---- */

export const SHAPES = {
  // Dominoes (size 2)
  bar2:    [[0,0],[0,1]],

  // Triominoes (size 3)
  bar3:    [[0,0],[0,1],[0,2]],
  L3:      [[0,0],[1,0],[1,1]],

  // Tetrominoes (size 4)
  bar4:    [[0,0],[0,1],[0,2],[0,3]],
  L4:      [[0,0],[1,0],[2,0],[2,1]],
  J4:      [[0,1],[1,1],[2,1],[2,0]],
  S4:      [[0,1],[0,2],[1,0],[1,1]],
  Z4:      [[0,0],[0,1],[1,1],[1,2]],
  T4:      [[0,0],[0,1],[0,2],[1,1]],
  sq4:     [[0,0],[0,1],[1,0],[1,1]],

  // Pentominoes (size 5)
  bar5:    [[0,0],[0,1],[0,2],[0,3],[0,4]],
  L5:      [[0,0],[1,0],[2,0],[3,0],[3,1]],
  J5:      [[0,1],[1,1],[2,1],[3,1],[3,0]],
  T5:      [[0,0],[0,1],[0,2],[1,1],[2,1]],
  U5:      [[0,0],[0,2],[1,0],[1,1],[1,2]],
  P5:      [[0,0],[0,1],[1,0],[1,1],[2,0]],
  F5:      [[0,1],[0,2],[1,0],[1,1],[2,1]],
  Y5:      [[0,0],[1,0],[1,1],[2,0],[3,0]],
  N5:      [[0,0],[1,0],[1,1],[2,1],[3,1]],
}

/* ---- piece colors (cycle through these) ---- */

export const PIECE_COLORS = [
  '#4a6cf7', // blue
  '#ff9500', // orange
  '#34c759', // green
  '#af52de', // purple
  '#ff3b30', // red
  '#00c7be', // teal
  '#ff6482', // pink
  '#8e8e93', // grey
]

/* ---- level definitions ---- */

const LEVELS = [
  // --- TIER 1: Dominoes on small grids (area 6-8) ---
  {
    id: 1,
    label: '2×3 Bars',
    gridWidth: 3,
    gridHeight: 2,
    pieceSize: 2,
    difficulty: 1,
    pieces: [
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 1, rotation: 1 },
      { pieceIndex: 2, row: 0, col: 2, rotation: 1 },
    ],
  },
  {
    id: 2,
    label: '2×4 Bars',
    gridWidth: 4,
    gridHeight: 2,
    pieceSize: 2,
    difficulty: 1,
    pieces: [
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 0, col: 2, rotation: 0 },
      { pieceIndex: 3, row: 1, col: 2, rotation: 0 },
    ],
  },
  {
    id: 3,
    label: '2×4 Tall',
    gridWidth: 2,
    gridHeight: 4,
    pieceSize: 2,
    difficulty: 1,
    pieces: [
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 3, col: 0, rotation: 0 },
    ],
  },

  // --- TIER 2: Triominoes on small grids (area 6-9) ---
  {
    id: 4,
    label: '3×2 Bars',
    gridWidth: 3,
    gridHeight: 2,
    pieceSize: 3,
    difficulty: 2,
    pieces: [
      { shape: 'bar3' },
      { shape: 'bar3' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
    ],
  },
  {
    id: 5,
    label: '3×3 L-shapes',
    gridWidth: 3,
    gridHeight: 3,
    pieceSize: 3,
    difficulty: 2,
    pieces: [
      { shape: 'L3' },
      { shape: 'L3' },
      { shape: 'bar3' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 1, rotation: 2 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
    ],
  },
  {
    id: 6,
    label: '6×2 Bars',
    gridWidth: 6,
    gridHeight: 2,
    pieceSize: 3,
    difficulty: 2,
    pieces: [
      { shape: 'bar3' },
      { shape: 'bar3' },
      { shape: 'bar3' },
      { shape: 'bar3' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 0, col: 3, rotation: 0 },
      { pieceIndex: 3, row: 1, col: 3, rotation: 0 },
    ],
  },

  // --- TIER 3: Tetrominoes on medium grids (area 8-12) ---
  {
    id: 7,
    label: '4×2 Bars',
    gridWidth: 4,
    gridHeight: 2,
    pieceSize: 4,
    difficulty: 3,
    pieces: [
      { shape: 'bar4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
    ],
  },
  {
    id: 8,
    label: '4×3 Squares & Bars',
    gridWidth: 4,
    gridHeight: 3,
    pieceSize: 4,
    difficulty: 3,
    pieces: [
      { shape: 'sq4' },
      { shape: 'bar4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 1 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
    ],
  },
  {
    id: 9,
    label: '4×3 L-shapes',
    gridWidth: 4,
    gridHeight: 3,
    pieceSize: 4,
    difficulty: 3,
    pieces: [
      { shape: 'L4' },
      { shape: 'J4' },
      { shape: 'sq4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 0 },
      { pieceIndex: 2, row: 0, col: 1, rotation: 0 },
    ],
  },
  {
    id: 10,
    label: '4×4 Mixed',
    gridWidth: 4,
    gridHeight: 4,
    pieceSize: 4,
    difficulty: 4,
    pieces: [
      { shape: 'T4' },
      { shape: 'L4' },
      { shape: 'sq4' },
      { shape: 'S4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 1 },
      { pieceIndex: 2, row: 2, col: 2, rotation: 0 },
      { pieceIndex: 3, row: 0, col: 2, rotation: 1 },
    ],
  },

  // --- TIER 4: Larger tetromino grids (area 16-20) ---
  {
    id: 11,
    label: '4×5 Tetrominoes',
    gridWidth: 5,
    gridHeight: 4,
    pieceSize: 4,
    difficulty: 4,
    pieces: [
      { shape: 'bar4' },
      { shape: 'L4' },
      { shape: 'T4' },
      { shape: 'sq4' },
      { shape: 'S4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 1 },
      { pieceIndex: 1, row: 0, col: 1, rotation: 1 },
      { pieceIndex: 2, row: 0, col: 2, rotation: 1 },
      { pieceIndex: 3, row: 0, col: 3, rotation: 0 },
      { pieceIndex: 4, row: 2, col: 1, rotation: 0 },
    ],
  },
  {
    id: 12,
    label: '5×4 Challenge',
    gridWidth: 4,
    gridHeight: 5,
    pieceSize: 4,
    difficulty: 5,
    pieces: [
      { shape: 'Z4' },
      { shape: 'T4' },
      { shape: 'L4' },
      { shape: 'J4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 1 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 1 },
      { pieceIndex: 3, row: 2, col: 2, rotation: 3 },
      { pieceIndex: 4, row: 4, col: 0, rotation: 0 },
    ],
  },

  // --- TIER 5: Pentominoes on medium grids (area 10-20) ---
  {
    id: 13,
    label: '5×2 Bars',
    gridWidth: 5,
    gridHeight: 2,
    pieceSize: 5,
    difficulty: 3,
    pieces: [
      { shape: 'bar5' },
      { shape: 'bar5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
    ],
  },
  {
    id: 14,
    label: '5×3 L-shapes',
    gridWidth: 5,
    gridHeight: 3,
    pieceSize: 5,
    difficulty: 4,
    pieces: [
      { shape: 'L5' },
      { shape: 'bar5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 1 },
      { pieceIndex: 1, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 0, col: 1, rotation: 1 },
    ],
  },
  {
    id: 15,
    label: '5×4 Mixed',
    gridWidth: 5,
    gridHeight: 4,
    pieceSize: 5,
    difficulty: 5,
    pieces: [
      { shape: 'U5' },
      { shape: 'T5' },
      { shape: 'L5' },
      { shape: 'bar5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 3, rotation: 1 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 1 },
      { pieceIndex: 3, row: 3, col: 0, rotation: 0 },
    ],
  },

  // --- TIER 6: Larger pentomino grids (area 25-30) ---
  {
    id: 16,
    label: '5×5 Pentominoes',
    gridWidth: 5,
    gridHeight: 5,
    pieceSize: 5,
    difficulty: 6,
    pieces: [
      { shape: 'F5' },
      { shape: 'Y5' },
      { shape: 'T5' },
      { shape: 'L5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 3, rotation: 1 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 1, col: 3, rotation: 3 },
      { pieceIndex: 4, row: 3, col: 1, rotation: 0 },
    ],
  },
  {
    id: 17,
    label: '6×5 Challenge',
    gridWidth: 6,
    gridHeight: 5,
    pieceSize: 5,
    difficulty: 7,
    pieces: [
      { shape: 'bar5' },
      { shape: 'L5' },
      { shape: 'T5' },
      { shape: 'N5' },
      { shape: 'U5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 1 },
      { pieceIndex: 2, row: 0, col: 5, rotation: 3 },
      { pieceIndex: 3, row: 1, col: 3, rotation: 0 },
      { pieceIndex: 4, row: 3, col: 0, rotation: 0 },
      { pieceIndex: 5, row: 3, col: 3, rotation: 0 },
    ],
  },
  {
    id: 18,
    label: '5×6 Grand',
    gridWidth: 5,
    gridHeight: 6,
    pieceSize: 5,
    difficulty: 8,
    pieces: [
      { shape: 'F5' },
      { shape: 'J5' },
      { shape: 'Y5' },
      { shape: 'T5' },
      { shape: 'N5' },
      { shape: 'bar5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 3, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 2, col: 1, rotation: 1 },
      { pieceIndex: 4, row: 2, col: 3, rotation: 3 },
      { pieceIndex: 5, row: 5, col: 0, rotation: 0 },
    ],
  },
]

export default LEVELS
