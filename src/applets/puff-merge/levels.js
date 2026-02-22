/**
 * Level data for Puff Merge.
 * target: the value any single puff must reach to win.
 * puffs: starting values for each puff in the level.
 *
 * Spawn strategy:
 *   Levels 1–4: puffs start clustered near center (easy spatial setup)
 *   Levels 5–10: puffs start spread to corners/edges (player must guide them)
 */

export const LEVELS = [
  { target: 5,  puffs: [2, 3] },               // L1: trivial, one merge
  { target: 3,  puffs: [1, 2, 4] },            // L2: pick the right pair (4 is decoy)
  { target: 6,  puffs: [2, 4, 1] },            // L3: 2+4=6, decoy 1
  { target: 5,  puffs: [1, 1, 3] },            // L4: sequential — 1+1=2, 2+3=5
  { target: 5,  puffs: [3, 2, 4] },            // L5: spatial — guide 3 and 2 together
  { target: 5,  puffs: [2, 3, 4] },            // L6: overshoot risk — 3+4=7, 2+4=6 both miss
  { target: 7,  puffs: [1, 3, 4, 2] },         // L7: find 3+4=7 among distractors
  { target: 8,  puffs: [1, 2, 3, 2] },         // L8: 3 merges (2+3=5, 5+2=7, 7+1=8)
  { target: 5,  puffs: [2, 2, 1, 3] },         // L9: 2+2=4 then 4+1=5, or 2+3=5 directly
  { target: 9,  puffs: [1, 2, 3, 2, 1] },      // L10: 4 merges, total sum = 9
]
