/**
 * Problem generator for Puff Merge.
 * Pure logic — no side effects, no Phaser dependencies.
 */

const MIXED_OP_RANGES = {
  plus1:   [1, 9],
  plus2:   [1, 8],
  doubles: [1, 7],
}

/**
 * Shuffle-bag sampling: maps seqIndex → n using a seeded Fisher-Yates shuffle
 * per cycle. Within each cycle of rangeLen problems every n appears exactly
 * once; adjacent cycles use different seeds so the boundary rarely repeats.
 */
function shuffleBagN(lo, hi, seqIndex, stageId) {
  const rangeLen = hi - lo + 1
  const cycleIdx = Math.floor(seqIndex / rangeLen)
  const pos      = seqIndex % rangeLen

  const arr = Array.from({ length: rangeLen }, (_, i) => i)
  let seed = (cycleIdx * 997 + stageId.charCodeAt(0) * 31) | 0
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const j = (seed >>> 0) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return lo + arr[pos]
}

function pickComponents(stage, seqIndex) {
  let { operation, nRange, type } = stage
  const isMixed = operation === 'mixed'

  if (isMixed) {
    const ops = ['plus1', 'plus2', 'doubles']
    operation = ops[Math.floor(Math.random() * ops.length)]
    nRange = MIXED_OP_RANGES[operation]
  }

  const [lo, hi] = nRange
  const rangeLen  = hi - lo + 1

  let n
  if (type === 'ordered') {
    // Strict ascending, no wrap — stage.count === rangeLen so seqIndex stays in [0, rangeLen)
    n = lo + seqIndex
  } else if (isMixed) {
    // Operation already randomized; pick n uniformly too
    n = lo + Math.floor(Math.random() * rangeLen)
  } else {
    // Shuffle-bag: every n once per cycle before any repeats
    n = shuffleBagN(lo, hi, seqIndex, stage.id)
  }

  let a, b, target
  if (operation === 'plus1') {
    a = n; b = 1; target = n + 1
  } else if (operation === 'plus2') {
    a = n; b = 2; target = n + 2
  } else {
    // doubles
    a = n; b = n; target = n + n
  }

  return { a, b, target }
}

function pickDistractor(a, b, target) {
  const candidates = []
  for (let d = 1; d <= 14; d++) {
    if (d === a || d === b) continue
    if (d === target) continue
    if (d + a === target || d + b === target) continue
    candidates.push(d)
  }

  // Prefer overshoots — they create a meaningful wrong-choice trap
  const overshoots = candidates.filter(d => d + a > target || d + b > target)
  if (overshoots.length > 0) {
    return overshoots[Math.floor(Math.random() * overshoots.length)]
  }

  return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : 1
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Generate a problem for the given stage and sequence index.
 * Returns { target, puffs: [a, b, distractor] (shuffled), components: [a, b] }.
 */
export function generateProblem(stage, seqIndex) {
  const { a, b, target } = pickComponents(stage, seqIndex)
  const d = pickDistractor(a, b, target)
  return {
    target,
    puffs: shuffle([a, b, d]),
    components: [a, b],
  }
}

/**
 * Recursive BFS: can we reach `target` by merging pairs from `values`?
 * State space is tiny (≤5 puffs, values ≤14) — no memoization needed.
 */
export function canReachTarget(values, target, maxDepth = 3) {
  if (values.includes(target)) return true
  if (values.length <= 1 || maxDepth === 0) return false

  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const merged = values[i] + values[j]
      if (merged === target) return true
      if (merged < target) {
        const rest = values.filter((_, k) => k !== i && k !== j)
        rest.push(merged)
        if (canReachTarget(rest, target, maxDepth - 1)) return true
      }
    }
  }

  return false
}
