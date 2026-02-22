/**
 * Level data for Puff Merge.
 * target: the value any single puff must reach to win.
 * puffs: starting values for each puff in the level.
 *
 * Progression designed for age 5+:
 *   Tier 1 (L1–3):  Tiny doubles / +1 facts, just 2 puffs, no decoys
 *   Tier 2 (L4–6):  Single-digit targets, first decoy puffs
 *   Tier 3 (L7–8):  Make 10 — key early-math milestone
 *   Tier 4 (L9–10): Bigger numbers: 12, then the triumphant 10+10=20
 *
 * Spawn strategy:
 *   Levels 1–4: puffs start clustered near center
 *   Levels 5–10: puffs start spread to corners/edges
 */

export const LEVELS = [
  { target: 2,  puffs: [1, 1] },            // L1:  1+1=2   — simplest possible
  { target: 3,  puffs: [1, 2] },            // L2:  1+2=3
  { target: 4,  puffs: [2, 2] },            // L3:  2+2=4   — first doubles fact

  { target: 5,  puffs: [3, 2, 1] },         // L4:  3+2=5,  decoy 1
  { target: 7,  puffs: [4, 3, 2] },         // L5:  4+3=7,  decoy 2
  { target: 9,  puffs: [5, 4, 2] },         // L6:  5+4=9,  decoy 2

  { target: 10, puffs: [5, 5, 3] },         // L7:  5+5=10  — doubles milestone, decoy 3
  { target: 10, puffs: [7, 3, 4] },         // L8:  7+3=10, decoy 4 (overshoot bait: 7+4=11)

  { target: 12, puffs: [6, 6, 4] },         // L9:  6+6=12  — doubles, decoy 4
  { target: 20, puffs: [10, 10] },          // L10: 10+10=20 — triumphant finale!
]
