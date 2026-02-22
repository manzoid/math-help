/**
 * Stage definitions for Puff Merge Kumon-style mastery progression.
 * Seven stages ordered by difficulty: +1 → +2 → doubles → mixed.
 * Each stage has STAGES_PER_ADVANCE problems before advancing.
 */

export const STAGES_PER_ADVANCE = 25

export const STAGES = [
  {
    id: 'A',
    label: '+1 ordered',
    type: 'ordered',
    operation: 'plus1',
    nRange: [1, 9],
  },
  {
    id: 'B',
    label: '+1 randomized',
    type: 'randomized',
    operation: 'plus1',
    nRange: [1, 9],
  },
  {
    id: 'C',
    label: '+2 ordered',
    type: 'ordered',
    operation: 'plus2',
    nRange: [1, 8],
  },
  {
    id: 'D',
    label: '+2 randomized',
    type: 'randomized',
    operation: 'plus2',
    nRange: [1, 8],
  },
  {
    id: 'E',
    label: 'doubles ordered',
    type: 'ordered',
    operation: 'doubles',
    nRange: [1, 7],
  },
  {
    id: 'F',
    label: 'doubles randomized',
    type: 'randomized',
    operation: 'doubles',
    nRange: [1, 7],
  },
  {
    id: 'G',
    label: 'mixed randomized',
    type: 'randomized',
    operation: 'mixed',
    nRange: null,
  },
]
