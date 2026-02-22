/**
 * Stage definitions for Puff Merge mastery progression.
 *
 * count: how many problems before advancing.
 *   - ordered stages: exactly one clean ascending pass (= nRange length, no wrap)
 *   - randomized stages: 12 problems using shuffle-bag sampling (every fact
 *     appears once before any repeats; see generator.js shuffleBagN)
 *   - mixed stage: 15 problems across all operations
 */

export const STAGES = [
  { id: 'A', label: '+1 ordered',         type: 'ordered',    operation: 'plus1',   nRange: [1, 9], count: 9  },
  { id: 'B', label: '+1 randomized',      type: 'randomized', operation: 'plus1',   nRange: [1, 9], count: 12 },
  { id: 'C', label: '+2 ordered',         type: 'ordered',    operation: 'plus2',   nRange: [1, 8], count: 8  },
  { id: 'D', label: '+2 randomized',      type: 'randomized', operation: 'plus2',   nRange: [1, 8], count: 12 },
  { id: 'E', label: 'doubles ordered',    type: 'ordered',    operation: 'doubles', nRange: [1, 7], count: 7  },
  { id: 'F', label: 'doubles randomized', type: 'randomized', operation: 'doubles', nRange: [1, 7], count: 12 },
  { id: 'G', label: 'mixed randomized',   type: 'randomized', operation: 'mixed',   nRange: null,   count: 15 },
]
