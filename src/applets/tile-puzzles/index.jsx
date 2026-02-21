import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import LEVELS, { SHAPES, rotateCW, PIECE_COLORS } from './levels.js'

/* ---- layout constants (SVG viewBox units) ---- */
const CELL = 40
const PAD = 20
const TRAY_GAP = 20
const TRAY_SCALE = 0.55
const TAP_THRESHOLD = 5
const DRAG_LIFT_MOUSE = 30
const DRAG_LIFT_TOUCH = 80 // bigger offset so finger doesn't occlude piece
const TRAY_ROW_H = 55 // height of one tray row

/* stable SVG width across all levels so layout never shifts */
const MAX_GRID_W = Math.max(...LEVELS.map(l => l.gridWidth))
const SUM_GUTTER = 70 // space to the right of the grid for the big sum
const STABLE_SVG_W = MAX_GRID_W * CELL + SUM_GUTTER * 2

/* ---- confetti config ---- */
const CONFETTI_COLORS = ['#ff1744','#2962ff','#00c853','#aa00ff','#ff8800','#ffd600','#00bfa5','#ff4081']
const CONFETTI_COUNT = 50

function makeConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = (Math.random() * 360) * Math.PI / 180
    const dist = 80 + Math.random() * 220
    const size = 6 + Math.random() * 8
    return {
      id: i,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 40, // bias upward
      size,
      rot: Math.random() * 720 - 360,
      dur: 0.7 + Math.random() * 0.8,
      delay: Math.random() * 0.15,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }
  })
}

/* ---- Fisher-Yates shuffle ---- */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---- apply N rotations to cells ---- */
function applyRotation(baseCells, rotation) {
  let cells = baseCells
  for (let i = 0; i < (rotation % 4); i++) cells = rotateCW(cells)
  return cells
}

/* ---- placement checks ---- */
function canPlace(grid, cells, row, col, w, h, selfId) {
  for (const [r, c] of cells) {
    const gr = row + r
    const gc = col + c
    if (gr < 0 || gr >= h || gc < 0 || gc >= w) return false
    if (grid[gr][gc] !== null && grid[gr][gc] !== selfId) return false
  }
  return true
}

function checkCompletion(grid, pieces) {
  if (pieces.some(p => !p.placed)) return false
  for (const row of grid) {
    for (const cell of row) {
      if (cell === null) return false
    }
  }
  return true
}


/* ---- initialize pieces for a level ---- */
function initPieces(level) {
  const order = shuffle(level.pieces.map((_, i) => i))
  return level.pieces.map((p, i) => ({
    id: i,
    baseShape: SHAPES[p.shape],
    rotation: 0,
    color: PIECE_COLORS[i % PIECE_COLORS.length],
    placed: false,
    gridRow: 0,
    gridCol: 0,
    trayOrder: order.indexOf(i),
  }))
}

function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null))
}

/* ================================================================ */

export default function TilePuzzles() {
  const svgRef = useRef(null)
  const [levelIndex, setLevelIndex] = useState(0)
  const levelCache = useRef({}) // levelIndex -> { pieces, grid, completed }

  const level = LEVELS[levelIndex]

  const [pieces, _setPieces] = useState(() => initPieces(level))
  const piecesRef = useRef(pieces)
  const setPieces = (v) => {
    const next = typeof v === 'function' ? v(piecesRef.current) : v
    piecesRef.current = next
    _setPieces(next)
  }
  const [grid, _setGrid] = useState(() => makeGrid(level.gridWidth, level.gridHeight))
  const gridRef = useRef(grid)
  const setGrid = (v) => {
    const next = typeof v === 'function' ? v(gridRef.current) : v
    gridRef.current = next
    _setGrid(next)
  }
  const [drag, _setDrag] = useState(null)
  const dragRef = useRef(null)
  const setDrag = (v) => { dragRef.current = v; _setDrag(v) }
  const [completed, setCompleted] = useState(false)
  const [confetti, setConfetti] = useState(null)
  const dragStart = useRef(null)

  /* ---- circular gesture recognition for rotation ---- */
  // Tracks the cumulative turning angle between consecutive displacement
  // vectors.  Linear drags produce ~0 turn; circular sweeps accumulate
  // quickly.  ~180° of accumulated turn triggers a rotation.
  const rotAnimRef = useRef({ key: 0, fromDeg: 0 }) // drives rotation tween
  const gestureRef = useRef({ points: [], totalTurn: 0, cooldownUntil: 0 })
  const TURN_THRESHOLD = Math.PI // 180° of turning triggers rotation
  const GESTURE_COOLDOWN = 400   // ms before another rotation can fire

  function resetGesture() {
    gestureRef.current = { points: [], totalTurn: 0, cooldownUntil: 0 }
  }

  /** Returns 1 (CW), -1 (CCW), or 0 (no rotation yet) */
  function updateGesture(x, y) {
    const g = gestureRef.current
    const now = performance.now()
    if (now < g.cooldownUntil) { g.points = []; return 0 }

    g.points.push({ x, y })
    if (g.points.length > 30) g.points.splice(0, g.points.length - 25)
    if (g.points.length < 3) return 0

    const n = g.points.length
    const p0 = g.points[n - 3]
    const p1 = g.points[n - 2]
    const p2 = g.points[n - 1]

    // consecutive displacement vectors
    const v1x = p1.x - p0.x, v1y = p1.y - p0.y
    const v2x = p2.x - p1.x, v2y = p2.y - p1.y

    const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
    if (len1 < 1 || len2 < 1) return 0 // skip jitter

    // signed turning angle (positive = CW in screen coords)
    const cross = v1x * v2y - v1y * v2x
    const dot = v1x * v2x + v1y * v2y
    g.totalTurn += Math.atan2(cross, dot)

    if (g.totalTurn > TURN_THRESHOLD) {
      g.points = []; g.totalTurn = 0; g.cooldownUntil = now + GESTURE_COOLDOWN
      return 1
    }
    if (g.totalTurn < -TURN_THRESHOLD) {
      g.points = []; g.totalTurn = 0; g.cooldownUntil = now + GESTURE_COOLDOWN
      return -1
    }
    return 0
  }

  // trigger confetti on completion
  useEffect(() => {
    if (completed && !confetti) {
      setConfetti(makeConfetti())
      const timer = setTimeout(() => setConfetti(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [completed])

  /* ---- derived layout ---- */
  const gridW = level.gridWidth
  const gridH = level.gridHeight
  const svgW = STABLE_SVG_W
  // center the grid itself horizontally (sum floats to its right)
  const gridX = (svgW - gridW * CELL) / 2
  const trayY = PAD + gridH * CELL + TRAY_GAP

  /* ---- SVG coord helper ---- */
  const toSVG = useCallback((cx, cy) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = cx; pt.y = cy
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }, [])

  /* ---- cells for a piece (with current rotation) ---- */
  function getCells(piece) {
    return applyRotation(piece.baseShape, piece.rotation)
  }

  /* ---- snap SVG position to grid cell ---- */
  /* svgX/svgY is the center of the piece bounding box (after lift),
     so we offset by half the piece dimensions to find where cell [0,0] lands */
  function snapToGrid(svgX, svgY, cells) {
    const maxR = Math.max(...cells.map(([r]) => r))
    const maxC = Math.max(...cells.map(([, c]) => c))
    const row = Math.round((svgY - PAD) / CELL - (maxR + 1) / 2)
    const col = Math.round((svgX - gridX) / CELL - (maxC + 1) / 2)
    return { row, col }
  }

  /* ---- place a piece on the grid ---- */
  function placePiece(pieceId, row, col) {
    setPieces(prevPieces => {
      const piece = prevPieces.find(p => p.id === pieceId)
      if (!piece) return prevPieces
      const cells = getCells(piece)

      setGrid(prevGrid => {
        if (!canPlace(prevGrid, cells, row, col, gridW, gridH, null)) return prevGrid
        const newGrid = prevGrid.map(r => [...r])
        for (const [r, c] of cells) {
          newGrid[row + r][col + c] = pieceId
        }
        const newPieces = prevPieces.map(p =>
          p.id === pieceId ? { ...p, placed: true, gridRow: row, gridCol: col } : p
        )
        if (checkCompletion(newGrid, newPieces)) {
          setCompleted(true)
        }
        return newGrid
      })

      return prevPieces.map(p =>
        p.id === pieceId ? { ...p, placed: true, gridRow: row, gridCol: col } : p
      )
    })
  }

  /* ---- remove a piece from the grid ---- */
  function removePiece(pieceId) {
    setPieces(prevPieces => {
      const piece = prevPieces.find(p => p.id === pieceId)
      if (!piece || !piece.placed) return prevPieces
      setGrid(prevGrid => prevGrid.map(r => r.map(c => c === pieceId ? null : c)))
      setCompleted(false)
      setConfetti(null)
      return prevPieces.map(p =>
        p.id === pieceId ? { ...p, placed: false } : p
      )
    })
  }

  /* ---- level navigation ---- */
  function goToLevel(idx) {
    // save current level state
    levelCache.current[levelIndex] = {
      pieces: piecesRef.current,
      grid: gridRef.current,
      completed,
    }

    const lv = LEVELS[idx]
    const cached = levelCache.current[idx]
    setLevelIndex(idx)
    if (cached) {
      setPieces(cached.pieces)
      setGrid(cached.grid)
      setCompleted(cached.completed)
    } else {
      setPieces(initPieces(lv))
      setGrid(makeGrid(lv.gridWidth, lv.gridHeight))
      setCompleted(false)
    }
    setDrag(null)
    setConfetti(null)
  }

  function resetLevel() {
    delete levelCache.current[levelIndex]
    setPieces(initPieces(level))
    setGrid(makeGrid(gridW, gridH))
    setDrag(null)
    setCompleted(false)
    setConfetti(null)
  }

  /* ---- show solution ---- */
  function showSolution() {
    const newGrid = makeGrid(gridW, gridH)
    const newPieces = pieces.map(p => ({ ...p }))
    for (const sol of level.canonicalSolutions) {
      const piece = newPieces[sol.pieceIndex]
      const cells = applyRotation(piece.baseShape, sol.rotation)
      piece.rotation = sol.rotation
      piece.placed = true
      piece.gridRow = sol.row
      piece.gridCol = sol.col
      for (const [r, c] of cells) {
        newGrid[sol.row + r][sol.col + c] = sol.pieceIndex
      }
    }
    setPieces(newPieces)
    setGrid(newGrid)
    setDrag(null)
    setCompleted(true)
  }

  /* ---- pointer handlers ---- */
  function onTrayPieceDown(e, pieceId) {
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)

    const p = toSVG(e.clientX, e.clientY)
    const piece = piecesRef.current.find(pp => pp.id === pieceId)
    const lift = e.pointerType === 'touch' ? DRAG_LIFT_TOUCH : DRAG_LIFT_MOUSE

    resetGesture()
    rotAnimRef.current = { key: 0, fromDeg: 0 }
    dragStart.current = { x: p.x, y: p.y, pieceId, moved: false, lift }

    setDrag({
      pieceId,
      svgX: p.x,
      svgY: p.y - lift,
      snapRow: null,
      snapCol: null,
      originalRotation: piece ? piece.rotation : 0,
    })
  }

  function onGridPieceDown(e, pieceId) {
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    svg.setPointerCapture(e.pointerId)

    const p = toSVG(e.clientX, e.clientY)
    const piece = piecesRef.current.find(pp => pp.id === pieceId)
    const lift = e.pointerType === 'touch' ? DRAG_LIFT_TOUCH : DRAG_LIFT_MOUSE

    // remove from grid, then hold it like a tray piece
    removePiece(pieceId)

    resetGesture()
    rotAnimRef.current = { key: 0, fromDeg: 0 }
    dragStart.current = { x: p.x, y: p.y, pieceId, moved: false, lift }

    setDrag({
      pieceId,
      svgX: p.x,
      svgY: p.y - lift,
      snapRow: null,
      snapCol: null,
      originalRotation: piece ? piece.rotation : 0,
    })
  }

  function onPointerMove(e) {
    if (!dragStart.current) return

    const p = toSVG(e.clientX, e.clientY)

    // circular gesture detection for rotation
    const rot = updateGesture(p.x, p.y)
    if (rot !== 0) {
      const d = dragRef.current
      if (d) {
        // animate: piece data jumps to new rotation, CSS tweens from old visually
        rotAnimRef.current = {
          key: rotAnimRef.current.key + 1,
          fromDeg: rot > 0 ? -90 : 90,
        }
        setPieces(prev => prev.map(pp =>
          pp.id === d.pieceId
            ? { ...pp, rotation: (pp.rotation + (rot > 0 ? 1 : 3)) % 4 }
            : pp
        ))
      }
    }

    const piece = piecesRef.current.find(pp => pp.id === dragStart.current.pieceId)
    if (!piece) return
    const cells = getCells(piece)
    const liftedY = p.y - dragStart.current.lift
    const snap = snapToGrid(p.x, liftedY, cells)
    const valid = canPlace(gridRef.current, cells, snap.row, snap.col, gridW, gridH, null)

    setDrag({
      pieceId: dragStart.current.pieceId,
      svgX: p.x,
      svgY: liftedY,
      snapRow: valid ? snap.row : null,
      snapCol: valid ? snap.col : null,
      originalRotation: dragRef.current?.originalRotation ?? 0,
    })
  }

  function onPointerUp() {
    if (!dragStart.current) return

    const ds = dragStart.current
    dragStart.current = null

    // Release: place if valid snap, else rubber-band back to tray
    const d = dragRef.current
    if (d && d.snapRow !== null && d.snapCol !== null) {
      placePiece(ds.pieceId, d.snapRow, d.snapCol)
    } else if (d) {
      // restore original rotation
      setPieces(prev => prev.map(pp =>
        pp.id === ds.pieceId ? { ...pp, rotation: d.originalRotation } : pp
      ))
    }
    setDrag(null)
    resetGesture()
  }

  /* ---- tray layout for unplaced pieces ---- */
  const trayPieces = useMemo(() => {
    return pieces
      .filter(p => !p.placed)
      .sort((a, b) => a.trayOrder - b.trayOrder)
  }, [pieces])

  /* ---- compute tray positions with wrapping (using base shape for stable sizing) ---- */
  const trayLayout = useMemo(() => {
    const gridCenterX = gridX + (gridW * CELL) / 2
    const maxW = 2 * Math.min(gridCenterX, svgW - gridCenterX) - PAD
    const GAP = 10
    const TRAY_PAD_Y = 8

    // first pass: assign rows using base shape (rotation 0) for stable sizing
    const rowItems = [[]]
    let x = 0
    for (const piece of trayPieces) {
      const base = piece.baseShape
      const pw = (Math.max(...base.map(([, c]) => c)) + 1) * CELL * TRAY_SCALE
      const ph = (Math.max(...base.map(([r]) => r)) + 1) * CELL * TRAY_SCALE
      if (x > 0 && x + pw > maxW) {
        rowItems.push([])
        x = 0
      }
      rowItems[rowItems.length - 1].push({ piece, pw, ph })
      x += pw + GAP
    }

    // second pass: center each row under the grid, clamp to SVG bounds
    const positions = []
    let curY = trayY + TRAY_PAD_Y
    for (const row of rowItems) {
      const totalW = row.reduce((s, it) => s + it.pw, 0) + (row.length - 1) * GAP
      const rowH = Math.max(...row.map(it => it.ph), TRAY_ROW_H)
      let curX = Math.max(PAD / 2, gridCenterX - totalW / 2)
      for (const { piece, pw, ph } of row) {
        positions.push({
          piece,
          x: curX,
          y: curY + (rowH - ph) / 2,
          w: pw,
        })
        curX += pw + GAP
      }
      curY += rowH + TRAY_PAD_Y
    }
    const trayH = curY - trayY + TRAY_PAD_Y
    return { positions, trayH }
  }, [trayPieces, svgW, trayY, gridX, gridW])
  const svgH = trayY + trayLayout.trayH + PAD

  /* ---- running sum of placed squares ---- */
  const placedSum = useMemo(() => {
    return pieces.filter(p => p.placed).length * level.pieceSize
  }, [pieces, level.pieceSize])

  /* ---- find the rightmost (then bottommost) cell for number label ---- */
  function labelCell(cells) {
    let best = cells[0]
    for (const cell of cells) {
      if (cell[1] > best[1] || (cell[1] === best[1] && cell[0] > best[0])) {
        best = cell
      }
    }
    return best
  }

  /* ============================================================== */
  /*  SVG rendering                                                  */
  /* ============================================================== */

  /* faceted gem-style cell (Block Blast look) */
  function bevelCell(cx, cy, color, S) {
    const B = Math.round(S * 0.13)
    return (
      <>
        <rect x={cx} y={cy} width={S} height={S} fill={color} />
        {/* top bevel */}
        <polygon
          points={`${cx},${cy} ${cx+S},${cy} ${cx+S-B},${cy+B} ${cx+B},${cy+B}`}
          fill="rgba(255,255,255,0.5)"
        />
        {/* left bevel */}
        <polygon
          points={`${cx},${cy} ${cx+B},${cy+B} ${cx+B},${cy+S-B} ${cx},${cy+S}`}
          fill="rgba(255,255,255,0.28)"
        />
        {/* right bevel */}
        <polygon
          points={`${cx+S},${cy} ${cx+S},${cy+S} ${cx+S-B},${cy+S-B} ${cx+S-B},${cy+B}`}
          fill="rgba(0,0,0,0.22)"
        />
        {/* bottom bevel */}
        <polygon
          points={`${cx},${cy+S} ${cx+B},${cy+S-B} ${cx+S-B},${cy+S-B} ${cx+S},${cy+S}`}
          fill="rgba(0,0,0,0.38)"
        />
        {/* center face */}
        <rect x={cx+B} y={cy+B} width={S-2*B} height={S-2*B} fill={color} />
        {/* face shine */}
        <rect x={cx+B} y={cy+B} width={S-2*B} height={S-2*B} fill="url(#faceShine)" />
      </>
    )
  }

  function renderGrid() {
    const rects = []
    for (let r = 0; r < gridH; r++) {
      for (let c = 0; c < gridW; c++) {
        const pid = grid[r][c]
        const piece = pid !== null ? pieces.find(p => p.id === pid) : null
        const cx = gridX + c * CELL
        const cy = PAD + r * CELL
        if (piece) {
          rects.push(
            <g key={`${r}-${c}`}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => onGridPieceDown(e, pid)}
            >
              {bevelCell(cx, cy, piece.color, CELL)}
            </g>
          )
        } else {
          rects.push(
            <rect
              key={`${r}-${c}`}
              x={cx + 1} y={cy + 1}
              width={CELL - 2} height={CELL - 2}
              rx={2}
              fill="#eae9e6"
              stroke="#ddd"
              strokeWidth={0.5}
            />
          )
        }
      }
    }
    return rects
  }

  function renderPieceOutlines() {
    const seen = new Set()
    const outlines = []
    for (const piece of pieces) {
      if (!piece.placed || seen.has(piece.id)) continue
      seen.add(piece.id)
      const cells = getCells(piece)
      const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`))
      // collect outer edges as line segments
      const segs = []
      for (const [r, c] of cells) {
        const x0 = gridX + (piece.gridCol + c) * CELL
        const y0 = PAD + (piece.gridRow + r) * CELL
        // top edge
        if (!cellSet.has(`${r - 1},${c}`)) segs.push([x0, y0, x0 + CELL, y0])
        // bottom edge
        if (!cellSet.has(`${r + 1},${c}`)) segs.push([x0, y0 + CELL, x0 + CELL, y0 + CELL])
        // left edge
        if (!cellSet.has(`${r},${c - 1}`)) segs.push([x0, y0, x0, y0 + CELL])
        // right edge
        if (!cellSet.has(`${r},${c + 1}`)) segs.push([x0 + CELL, y0, x0 + CELL, y0 + CELL])
      }
      // draw as a single path
      const d = segs.map(([x1, y1, x2, y2]) => `M${x1},${y1}L${x2},${y2}`).join('')
      outlines.push(
        <path
          key={`outline-${piece.id}`}
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={3}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )
    }
    return outlines
  }

  function renderGridNumbers() {
    const seen = new Set()
    const labels = []
    for (const piece of pieces) {
      if (!piece.placed || seen.has(piece.id)) continue
      seen.add(piece.id)
      const cells = getCells(piece)
      const [lr, lc] = labelCell(cells)
      const gx = gridX + (piece.gridCol + lc) * CELL + CELL / 2
      const gy = PAD + (piece.gridRow + lr) * CELL + CELL / 2
      labels.push(
        <text
          key={`num-${piece.id}`}
          x={gx} y={gy}
          textAnchor="middle" dominantBaseline="central"
          fontSize={18} fontWeight={700}
          fill="#fff"
          opacity={0.85}
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {level.pieceSize}
        </text>
      )
    }
    return labels
  }

  function renderTrayPieces() {
    return trayLayout.positions.map(({ piece, x, y }) => {
      const isHeld = drag?.pieceId === piece.id
      // tray always shows base shape (rotation 0)
      const baseCells = piece.baseShape
      const S = CELL * TRAY_SCALE

      if (isHeld) {
        // ghost outline in tray slot while piece is held
        return (
          <g key={piece.id}>
            <rect
              x={x - 2} y={y - 2}
              width={(Math.max(...baseCells.map(([,c]) => c)) + 1) * S + 4}
              height={(Math.max(...baseCells.map(([r]) => r)) + 1) * S + 4}
              rx={4}
              fill="rgba(0,0,0,0.04)"
              stroke={piece.color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.5}
            />
          </g>
        )
      }

      return (
        <g key={piece.id}
          onPointerDown={(e) => onTrayPieceDown(e, piece.id)}
          style={{ cursor: 'grab' }}
        >
          {baseCells.map(([r, c], i) => (
            <g key={i}>
              {bevelCell(x + c * S, y + r * S, piece.color, S)}
            </g>
          ))}
          {(() => {
            const [lr, lc] = labelCell(baseCells)
            return (
              <text
                x={x + lc * S + S / 2}
                y={y + lr * S + S / 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight={700}
                fill="#fff" opacity={0.85}
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {level.pieceSize}
              </text>
            )
          })()}
        </g>
      )
    })
  }

  function renderDragGhost() {
    if (!drag || drag.snapRow === null || drag.snapCol === null) return null
    const piece = pieces.find(p => p.id === drag.pieceId)
    if (!piece) return null
    const cells = getCells(piece)

    return cells.map(([r, c], i) => (
      <rect
        key={`ghost-${i}`}
        x={gridX + (drag.snapCol + c) * CELL + 2}
        y={PAD + (drag.snapRow + r) * CELL + 2}
        width={CELL - 4}
        height={CELL - 4}
        rx={4}
        fill={piece.color}
        opacity={0.35}
        stroke={piece.color}
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
    ))
  }

  function renderDragPiece() {
    if (!drag) return null
    const piece = pieces.find(p => p.id === drag.pieceId)
    if (!piece) return null
    const cells = getCells(piece)
    const minR = Math.min(...cells.map(([r]) => r))
    const minC = Math.min(...cells.map(([, c]) => c))
    const maxR = Math.max(...cells.map(([r]) => r))
    const maxC = Math.max(...cells.map(([, c]) => c))
    const cx = ((maxC - minC + 1) * CELL) / 2
    const cy = ((maxR - minR + 1) * CELL) / 2

    const anim = rotAnimRef.current
    return (
      <g style={{ pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} opacity={0.9}>
        <g key={anim.key} style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          animation: anim.key > 0 ? 'rotSnap 0.18s ease-out' : undefined,
          '--rot-from': `${anim.fromDeg}deg`,
        }}>
          {cells.map(([r, c], i) => {
            const dx = drag.svgX + (c - minC) * CELL - cx
            const dy = drag.svgY + (r - minR) * CELL - cy
            return (
              <g key={`drag-${i}`}>
                {bevelCell(dx, dy, piece.color, CELL)}
              </g>
            )
          })}
        </g>
      </g>
    )
  }


  /* ============================================================== */
  /*  JSX                                                            */
  /* ============================================================== */

  return (
    <div style={styles.root}>
      {/* level navigation + actions */}
      <div style={styles.controls}>
        <button
          onClick={() => goToLevel(Math.max(0, levelIndex - 1))}
          disabled={levelIndex === 0}
          style={{
            ...styles.btn,
            opacity: levelIndex === 0 ? 0.4 : 1,
          }}
        >
          ◀ Prev
        </button>

        <span style={styles.levelLabel}>
          Level {levelIndex + 1} of {LEVELS.length}
        </span>

        <button
          onClick={() => goToLevel(Math.min(LEVELS.length - 1, levelIndex + 1))}
          disabled={levelIndex === LEVELS.length - 1}
          style={{
            ...styles.btn,
            opacity: levelIndex === LEVELS.length - 1 ? 0.4 : 1,
          }}
        >
          Next ▶
        </button>
      </div>

      <div style={styles.controls}>
        <button onClick={resetLevel} style={styles.btnSecondary}>
          Reset
        </button>
        <button onClick={showSolution} style={styles.btnSecondary}>
          Show Solution
        </button>
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        onPointerDown={() => {}}
        style={styles.svg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* grid background */}
        <rect
          x={gridX - 2} y={PAD - 2}
          width={gridW * CELL + 4} height={gridH * CELL + 4}
          rx={8} fill="transparent" stroke="#ddd" strokeWidth={2}
          onPointerDown={() => {}}
        />

        {/* grid cells */}
        {renderGrid()}
        {renderPieceOutlines()}
        {renderGridNumbers()}

        {/* big running sum to the right of the grid */}
        {(() => {
          const sumX = gridX + gridW * CELL + SUM_GUTTER / 2
          const sumY = PAD + gridH * CELL - 23
          return (
            <g style={{ pointerEvents: 'none' }}>
              {/* main number with gradient fill */}
              <text
                x={sumX} y={sumY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={46} fontWeight={900}
                fill={completed ? 'url(#sumGrad)' : '#d4d4d4'}
                stroke={completed ? 'rgba(0,0,0,0.15)' : 'none'}
                strokeWidth={0.5}
                fontFamily="system-ui, sans-serif"
              >
                {placedSum}
              </text>
              {completed && (
                <circle
                  cx={sumX} cy={sumY}
                  r={8} fill="none"
                  stroke="#00c853" strokeWidth={2.5}
                  style={{ animation: 'sumPop 0.6s ease-out forwards' }}
                />
              )}
            </g>
          )
        })()}

        {/* tray pieces */}
        {renderTrayPieces()}

        {/* drag snap preview */}
        {renderDragGhost()}

        {/* dragging piece */}
        {renderDragPiece()}

        {/* CSS animations for celebration */}
        <defs>
          {/* subtle shine on center face of each cell */}
          <linearGradient id="faceShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          {/* gradient for completed sum number */}
          <linearGradient id="sumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#66ff99" />
            <stop offset="100%" stopColor="#00a844" />
          </linearGradient>
          <style>{`
            @keyframes sumPop {
              0% { r: 8; opacity: 0.8; stroke-width: 3; }
              100% { r: 36; opacity: 0; stroke-width: 1; }
            }
            @keyframes rotSnap {
              from { transform: rotate(var(--rot-from)); }
              to   { transform: rotate(0deg); }
            }
          `}</style>
        </defs>
      </svg>

      {/* confetti celebration overlay */}
      {confetti && (
        <div style={styles.confettiWrap}>
          <style>{`
            @keyframes confettiBurst {
              0% { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
              100% { transform: translate(var(--cx), var(--cy)) rotate(var(--cr)) scale(0.3); opacity: 0; }
            }
          `}</style>
          {confetti.map(p => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '35%',
                width: p.shape === 'rect' ? p.size : p.size * 0.8,
                height: p.shape === 'rect' ? p.size * 0.6 : p.size * 0.8,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
                background: p.color,
                '--cx': `${p.x}px`,
                '--cy': `${p.y}px`,
                '--cr': `${p.rot}deg`,
                animation: `confettiBurst ${p.dur}s ${p.delay}s ease-out forwards`,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---- styles ---- */

const styles = {
  root: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    position: 'relative',
  },
  confettiWrap: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 10,
  },
  svg: {
    width: '100%',
    maxWidth: 600,
    display: 'block',
    margin: '0 auto 0.5rem',
    touchAction: 'none',
    cursor: 'default',
    overflow: 'visible',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    maxWidth: 600,
    margin: '0 auto 0.5rem',
  },
  levelLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    minWidth: '120px',
    textAlign: 'center',
  },
  btn: {
    background: 'var(--color-accent-light, #e8edff)',
    color: 'var(--color-accent, #4a6cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#f0f0ee',
    color: '#555',
    border: 'none',
    borderRadius: '8px',
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
