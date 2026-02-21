import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import LEVELS, { SHAPES, rotateCW, PIECE_COLORS } from './levels.js'

/* ---- layout constants (SVG viewBox units) ---- */
const CELL = 40
const PAD = 20
const TRAY_GAP = 20
const TRAY_SCALE = 0.55
const TAP_THRESHOLD = 5
const DRAG_LIFT = 45 // lift drag piece above finger
const TRAY_ROW_H = 55 // height of one tray row

/* stable SVG width across all levels so layout never shifts */
const MAX_GRID_W = Math.max(...LEVELS.map(l => l.gridWidth))
const SUM_GUTTER = 70 // space to the right of the grid for the big sum
const STABLE_SVG_W = MAX_GRID_W * CELL + PAD * 2 + SUM_GUTTER

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
  const [selectedId, setSelectedId] = useState(null)
  const [drag, _setDrag] = useState(null)
  const dragRef = useRef(null)
  const setDrag = (v) => { dragRef.current = v; _setDrag(v) }
  const [completed, setCompleted] = useState(false)
  const [confetti, setConfetti] = useState(null)
  const dragStart = useRef(null)

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
  // center the grid + sum gutter horizontally
  const gridX = (svgW - (gridW * CELL + SUM_GUTTER)) / 2
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
    setSelectedId(null)
    setDrag(null)
    setConfetti(null)
  }

  function resetLevel() {
    delete levelCache.current[levelIndex]
    setPieces(initPieces(level))
    setGrid(makeGrid(gridW, gridH))
    setSelectedId(null)
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
    setSelectedId(null)
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
    dragStart.current = { x: p.x, y: p.y, pieceId, moved: false }

    setDrag({ pieceId, svgX: p.x, svgY: p.y, snapRow: null, snapCol: null })
  }

  function onGridPieceDown(e, pieceId) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    dragStart.current = { x: 0, y: 0, pieceId, moved: false, isGrid: true }
  }

  function onPointerMove(e) {
    if (!dragStart.current) return
    const p = toSVG(e.clientX, e.clientY)

    if (dragStart.current.isGrid) return // grid taps only

    const dx = p.x - dragStart.current.x
    const dy = p.y - dragStart.current.y
    if (Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD) {
      dragStart.current.moved = true
    }

    if (!dragStart.current.moved) return

    const piece = piecesRef.current.find(pp => pp.id === dragStart.current.pieceId)
    if (!piece) return
    const cells = getCells(piece)
    const liftedY = p.y - DRAG_LIFT
    const snap = snapToGrid(p.x, liftedY, cells)
    const valid = canPlace(gridRef.current, cells, snap.row, snap.col, gridW, gridH, null)

    setDrag({
      pieceId: dragStart.current.pieceId,
      svgX: p.x,
      svgY: liftedY,
      snapRow: valid ? snap.row : null,
      snapCol: valid ? snap.col : null,
    })
  }

  function onPointerUp() {
    if (!dragStart.current) return

    const ds = dragStart.current
    dragStart.current = null

    if (ds.isGrid) {
      // Tap on placed piece => remove it
      removePiece(ds.pieceId)
      setDrag(null)
      return
    }

    if (!ds.moved) {
      // Tap on tray piece
      if (selectedId === ds.pieceId) {
        // Rotate
        setPieces(pieces.map(p =>
          p.id === ds.pieceId ? { ...p, rotation: (p.rotation + 1) % 4 } : p
        ))
      } else {
        setSelectedId(ds.pieceId)
      }
      setDrag(null)
      return
    }

    // Drop after drag
    const d = dragRef.current
    if (d && d.snapRow !== null && d.snapCol !== null) {
      placePiece(ds.pieceId, d.snapRow, d.snapCol)
    }
    setDrag(null)
  }

  /* ---- tray layout for unplaced pieces ---- */
  const trayPieces = useMemo(() => {
    return pieces
      .filter(p => !p.placed)
      .sort((a, b) => a.trayOrder - b.trayOrder)
  }, [pieces])

  /* ---- compute tray positions with wrapping ---- */
  const trayLayout = useMemo(() => {
    const gridCenterX = gridX + (gridW * CELL) / 2
    // max row width that fits when centered under the grid
    const maxW = 2 * Math.min(gridCenterX, svgW - gridCenterX) - PAD
    const GAP = 10
    const TRAY_PAD_Y = 8

    // first pass: assign rows
    const rowItems = [[]]
    let x = 0
    for (const piece of trayPieces) {
      const cells = getCells(piece)
      const maxC = Math.max(...cells.map(([, c]) => c)) + 1
      const maxR = Math.max(...cells.map(([r]) => r)) + 1
      const pw = maxC * CELL * TRAY_SCALE
      const ph = maxR * CELL * TRAY_SCALE
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
      const cells = getCells(piece)
      const isSelected = selectedId === piece.id
      const isDragging = drag?.pieceId === piece.id && dragStart.current?.moved
      return (
        <g key={piece.id}
          onPointerDown={(e) => !isDragging && onTrayPieceDown(e, piece.id)}
          style={{ cursor: 'grab' }}
          opacity={isDragging ? 0.2 : 1}
        >
          {isSelected && (
            <rect
              x={x - 4}
              y={y - 4}
              width={(Math.max(...cells.map(([,c]) => c)) + 1) * CELL * TRAY_SCALE + 8}
              height={(Math.max(...cells.map(([r]) => r)) + 1) * CELL * TRAY_SCALE + 8}
              rx={6}
              fill="none"
              stroke={piece.color}
              strokeWidth={2.5}
              strokeDasharray="6 3"
            />
          )}
          {cells.map(([r, c], i) => {
            const S = CELL * TRAY_SCALE
            return (
              <g key={i}>
                {bevelCell(x + c * S, y + r * S, piece.color, S)}
              </g>
            )
          })}
          {(() => {
            const [lr, lc] = labelCell(cells)
            return (
              <text
                x={x + lc * CELL * TRAY_SCALE + CELL * TRAY_SCALE / 2}
                y={y + lr * CELL * TRAY_SCALE + CELL * TRAY_SCALE / 2}
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
    if (!drag || !dragStart.current?.moved) return null
    const piece = pieces.find(p => p.id === drag.pieceId)
    if (!piece) return null
    const cells = getCells(piece)
    const minR = Math.min(...cells.map(([r]) => r))
    const minC = Math.min(...cells.map(([, c]) => c))
    const maxR = Math.max(...cells.map(([r]) => r))
    const maxC = Math.max(...cells.map(([, c]) => c))
    const cx = ((maxC - minC + 1) * CELL) / 2
    const cy = ((maxR - minR + 1) * CELL) / 2

    return (
      <g style={{ pointerEvents: 'none' }} opacity={0.85}>
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
        style={styles.svg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* grid background */}
        <rect
          x={gridX - 2} y={PAD - 2}
          width={gridW * CELL + 4} height={gridH * CELL + 4}
          rx={8} fill="none" stroke="#ddd" strokeWidth={2}
        />

        {/* grid cells */}
        {renderGrid()}
        {renderPieceOutlines()}
        {renderGridNumbers()}

        {/* big running sum to the right of the grid */}
        {(() => {
          const sumX = gridX + gridW * CELL + SUM_GUTTER / 2
          const sumY = PAD + (gridH * CELL) / 2
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
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    maxWidth: 600,
    margin: '0 auto 0.5rem',
    paddingRight: `${(SUM_GUTTER / STABLE_SVG_W) * 100}%`,
    boxSizing: 'border-box',
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
