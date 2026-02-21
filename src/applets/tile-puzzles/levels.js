/**
 * Shape library and level definitions for the Tile Puzzles applet.
 *
 * Each shape is an array of [row, col] offsets normalized so that
 * the minimum row and col are both 0.
 *
 * All canonical solutions have been hand-verified:
 *   - every piece fits within grid bounds after rotation
 *   - no two pieces overlap
 *   - all cells are covered
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
  '#2962ff', // vivid blue
  '#ff8800', // vivid orange
  '#00c853', // vivid green
  '#aa00ff', // vivid purple
  '#ff1744', // vivid red
  '#00bfa5', // vivid teal
  '#ff4081', // vivid pink
  '#ffd600', // vivid yellow
]

/* ---- level definitions ---- */

/*
  Rotation reference (what each shape looks like after N CW rotations):

  bar2 rot0: XX        rot1: X
                              X

  bar3 rot0: XXX       rot1: X
                              X
                              X

  L3   rot0: X.        rot1: XX   rot2: .X   rot3: X.
             XX              X.        XX        .XX

  bar4 rot0: XXXX      rot1: X
                              X
                              X
                              X

  L4   rot0: X.        rot1: XXX  rot2: XX   rot3: ..X
             X.              X..       .X        XXX
             XX                        .X

  J4   rot0: .X        rot1: X..  rot2: XX   rot3: XXX
             .X              XXX       X.        ..X
             XX                        X.

  sq4  all:  XX
             XX

  S4   rot0: .XX       rot1: X.
             XX.              XX
                              .X

  T4   rot0: XXX       rot1: .X   rot2: .X.  rot3: X.
             .X.              XX        XXX       XX
                              .X                  X.

  P5   rot0: XX        rot1: XXX  rot2: .X   rot3: XX.
             XX              .XX       XX        XXX
             X.                        XX

  L5   rot1: XXXX      rot3: ...X
             X...            XXXX
*/

const LEVELS = [
  // --- TIER 1: Dominoes (area 6-8) ---

  // Level 1: 2w×3h — three horizontal dominoes stacked (no rotation needed)
  // AA
  // BB
  // CC
  {
    id: 1,
    label: '2×3 Bars',
    gridWidth: 2,
    gridHeight: 3,
    pieceSize: 2,
    difficulty: 1,
    pieces: [
      { shape: 'bar2' },
      { shape: 'bar2' },
      { shape: 'bar2' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
    ],
  },

  // Level 2: 4w×2h — four horizontal dominoes (2 per row)
  // AABB
  // CCDD
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
      { pieceIndex: 1, row: 0, col: 2, rotation: 0 },
      { pieceIndex: 2, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 1, col: 2, rotation: 0 },
    ],
  },

  // Level 3: 2w×4h — four horizontal dominoes stacked
  // AA
  // BB
  // CC
  // DD
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

  // --- TIER 2: Triominoes (area 6-12) ---

  // Level 4: 3w×2h — two horizontal triominoes
  // AAA
  // BBB
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

  // Level 5: 3w×3h — two L3 + one bar3
  // ABB
  // AAB
  // CCC
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

  // Level 6: 6w×2h — four horizontal triominoes
  // AAABBB
  // CCCDDD
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
      { pieceIndex: 1, row: 0, col: 3, rotation: 0 },
      { pieceIndex: 2, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 1, col: 3, rotation: 0 },
    ],
  },

  // --- TIER 3: Tetrominoes (area 8-12) ---

  // Level 7: 4w×2h — two horizontal bars
  // AAAA
  // BBBB
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

  // Level 8: 4w×3h — two squares + one bar
  // AABB
  // AABB
  // CCCC
  {
    id: 8,
    label: '4×3 Squares & Bars',
    gridWidth: 4,
    gridHeight: 3,
    pieceSize: 4,
    difficulty: 3,
    pieces: [
      { shape: 'sq4' },
      { shape: 'sq4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
    ],
  },

  // Level 9: 4w×3h — L4 + J4 + sq4
  // ACCJ
  // ACCJ
  // AAJJ
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

  // --- TIER 4: Larger tetromino grids (area 16-20) ---

  // Level 10: 4w×4h — L4 + L4 + S4 + bar4
  // A=L4rot0 at(0,0): (0,0)(1,0)(2,0)(2,1)
  // B=L4rot2 at(0,2): (0,2)(0,3)(1,3)(2,3)
  // C=S4rot1 at(0,1): (0,1)(1,1)(1,2)(2,2)
  // D=bar4rot0 at(3,0): (3,0)(3,1)(3,2)(3,3)
  // ACBB
  // ACCB
  // AACB
  // DDDD
  {
    id: 10,
    label: '4×4 Mixed',
    gridWidth: 4,
    gridHeight: 4,
    pieceSize: 4,
    difficulty: 4,
    pieces: [
      { shape: 'L4' },
      { shape: 'L4' },
      { shape: 'S4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 2 },
      { pieceIndex: 2, row: 0, col: 1, rotation: 1 },
      { pieceIndex: 3, row: 3, col: 0, rotation: 0 },
    ],
  },

  // Level 11: 5w×4h — sq4 + sq4 + bar4×3 (vertical)
  // AACDE
  // AACDE
  // BBCDE
  // BBCDE
  {
    id: 11,
    label: '5×4 Tetrominoes',
    gridWidth: 5,
    gridHeight: 4,
    pieceSize: 4,
    difficulty: 4,
    pieces: [
      { shape: 'sq4' },
      { shape: 'sq4' },
      { shape: 'bar4' },
      { shape: 'bar4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 0, col: 2, rotation: 1 },
      { pieceIndex: 3, row: 0, col: 3, rotation: 1 },
      { pieceIndex: 4, row: 0, col: 4, rotation: 1 },
    ],
  },

  // Level 12: 4w×5h — sq4×4 + bar4
  // AABB
  // AABB
  // CCDD
  // CCDD
  // EEEE
  {
    id: 12,
    label: '4×5 Challenge',
    gridWidth: 4,
    gridHeight: 5,
    pieceSize: 4,
    difficulty: 5,
    pieces: [
      { shape: 'sq4' },
      { shape: 'sq4' },
      { shape: 'sq4' },
      { shape: 'sq4' },
      { shape: 'bar4' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 0, col: 2, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 2, col: 2, rotation: 0 },
      { pieceIndex: 4, row: 4, col: 0, rotation: 0 },
    ],
  },

  // --- TIER 5: Pentominoes (area 10-20) ---

  // Level 13: 5w×2h — two horizontal bar5
  // AAAAA
  // BBBBB
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

  // Level 14: 5w×3h — bar5 + P5rot3 + P5rot1
  // AAAAA
  // BBCCC
  // BBBCC
  // P5rot3 at(1,0)=[[0,0],[0,1],[1,0],[1,1],[1,2]]: (1,0)(1,1)(2,0)(2,1)(2,2)
  // P5rot1 at(1,2)=[[0,0],[0,1],[0,2],[1,1],[1,2]]: (1,2)(1,3)(1,4)(2,3)(2,4)
  {
    id: 14,
    label: '5×3 Shapes',
    gridWidth: 5,
    gridHeight: 3,
    pieceSize: 5,
    difficulty: 4,
    pieces: [
      { shape: 'bar5' },
      { shape: 'P5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 3 },
      { pieceIndex: 2, row: 1, col: 2, rotation: 1 },
    ],
  },

  // Level 15: 5w×4h — bar5 + bar5 + P5rot3 + P5rot1
  // AAAAA
  // BBBBB
  // CCDDD
  // CCCDD
  {
    id: 15,
    label: '5×4 Mixed',
    gridWidth: 5,
    gridHeight: 4,
    pieceSize: 5,
    difficulty: 5,
    pieces: [
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'P5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 3 },
      { pieceIndex: 3, row: 2, col: 2, rotation: 1 },
    ],
  },

  // --- TIER 6: Larger pentomino grids (area 25-30) ---

  // Level 16: 6w×5h — six vertical bar5
  // ABCDEF
  // ABCDEF
  // ABCDEF
  // ABCDEF
  // ABCDEF
  {
    id: 16,
    label: '6×5 Bars',
    gridWidth: 6,
    gridHeight: 5,
    pieceSize: 5,
    difficulty: 6,
    pieces: [
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'bar5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 1 },
      { pieceIndex: 1, row: 0, col: 1, rotation: 1 },
      { pieceIndex: 2, row: 0, col: 2, rotation: 1 },
      { pieceIndex: 3, row: 0, col: 3, rotation: 1 },
      { pieceIndex: 4, row: 0, col: 4, rotation: 1 },
      { pieceIndex: 5, row: 0, col: 5, rotation: 1 },
    ],
  },

  // Level 17: 5w×5h — bar5×3 + P5rot3 + P5rot1
  // AAAAA
  // BBBBB
  // CCCCC
  // DDEEE
  // DDDEE
  {
    id: 17,
    label: '5×5 Pentominoes',
    gridWidth: 5,
    gridHeight: 5,
    pieceSize: 5,
    difficulty: 7,
    pieces: [
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'bar5' },
      { shape: 'P5' },
      { shape: 'P5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 0 },
      { pieceIndex: 1, row: 1, col: 0, rotation: 0 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 0 },
      { pieceIndex: 3, row: 3, col: 0, rotation: 3 },
      { pieceIndex: 4, row: 3, col: 2, rotation: 1 },
    ],
  },

  // Level 18: 5w×6h — three pairs of L5 (rot1 + rot3)
  // AAAAB
  // ABBBB
  // CCCCD
  // CDDDD
  // EEEEF
  // EFFFF
  // L5rot1 at(0,0)=[[0,0],[0,1],[0,2],[0,3],[1,0]]: (0,0)(0,1)(0,2)(0,3)(1,0)
  // L5rot3 at(0,1)=[[0,3],[1,0],[1,1],[1,2],[1,3]]: (0,4)(1,1)(1,2)(1,3)(1,4)
  {
    id: 18,
    label: '5×6 Grand',
    gridWidth: 5,
    gridHeight: 6,
    pieceSize: 5,
    difficulty: 8,
    pieces: [
      { shape: 'L5' },
      { shape: 'L5' },
      { shape: 'L5' },
      { shape: 'L5' },
      { shape: 'L5' },
      { shape: 'L5' },
    ],
    canonicalSolutions: [
      { pieceIndex: 0, row: 0, col: 0, rotation: 1 },
      { pieceIndex: 1, row: 0, col: 1, rotation: 3 },
      { pieceIndex: 2, row: 2, col: 0, rotation: 1 },
      { pieceIndex: 3, row: 2, col: 1, rotation: 3 },
      { pieceIndex: 4, row: 4, col: 0, rotation: 1 },
      { pieceIndex: 5, row: 4, col: 1, rotation: 3 },
    ],
  },
]

export default LEVELS
