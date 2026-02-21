import { useState, useRef, useMemo, useCallback } from 'react'
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
const STABLE_SVG_W = Math.max(MAX_GRID_W * CELL + PAD * 2, 280)

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
  const [completedLevels, setCompletedLevels] = useState(new Set())

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
  const dragStart = useRef(null)

  /* ---- derived layout ---- */
  const gridW = level.gridWidth
  const gridH = level.gridHeight
  const svgW = STABLE_SVG_W
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
    const col = Math.round((svgX - PAD) / CELL - (maxC + 1) / 2)
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
          setCompletedLevels(prev => new Set([...prev, levelIndex]))
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
      return prevPieces.map(p =>
        p.id === pieceId ? { ...p, placed: false } : p
      )
    })
  }

  /* ---- level navigation ---- */
  function goToLevel(idx) {
    const lv = LEVELS[idx]
    setLevelIndex(idx)
    setPieces(initPieces(lv))
    setGrid(makeGrid(lv.gridWidth, lv.gridHeight))
    setSelectedId(null)
    setDrag(null)
    setCompleted(false)
  }

  function resetLevel() {
    setPieces(initPieces(level))
    setGrid(makeGrid(gridW, gridH))
    setSelectedId(null)
    setDrag(null)
    setCompleted(false)
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
    setCompletedLevels(prev => new Set([...prev, levelIndex]))
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
      .filter(p => !p.placed && !(drag?.pieceId === p.id && dragStart.current?.moved))
      .sort((a, b) => a.trayOrder - b.trayOrder)
  }, [pieces, drag])

  /* ---- compute tray positions with wrapping ---- */
  const trayLayout = useMemo(() => {
    const maxW = svgW - PAD * 2
    const positions = []
    let x = 0
    let row = 0
    for (const piece of trayPieces) {
      const cells = getCells(piece)
      const maxC = Math.max(...cells.map(([, c]) => c)) + 1
      const pw = maxC * CELL * TRAY_SCALE
      if (x > 0 && x + pw > maxW) {
        x = 0
        row++
      }
      positions.push({
        piece,
        x: PAD + x,
        y: trayY + 16 + row * TRAY_ROW_H,
        w: pw,
      })
      x += pw + 10
    }
    const trayRows = row + 1
    const trayH = 16 + trayRows * TRAY_ROW_H + 8
    return { positions, trayH }
  }, [trayPieces, svgW, trayY])
  const svgH = trayY + trayLayout.trayH + PAD

  /* ---- running sum of placed squares ---- */
  const placedSum = useMemo(() => {
    return pieces.filter(p => p.placed).length * level.pieceSize
  }, [pieces, level.pieceSize])
  const totalArea = gridW * gridH

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

  function renderGrid() {
    const rects = []
    for (let r = 0; r < gridH; r++) {
      for (let c = 0; c < gridW; c++) {
        const pid = grid[r][c]
        const piece = pid !== null ? pieces.find(p => p.id === pid) : null
        const cx = PAD + c * CELL
        const cy = PAD + r * CELL
        if (piece) {
          const m = 1   // margin between cells
          const b = 3   // bevel thickness
          rects.push(
            <g key={`${r}-${c}`}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => onGridPieceDown(e, pid)}
            >
              {/* dark shadow base (bottom-right bevel) */}
              <rect
                x={cx + m} y={cy + m}
                width={CELL - m * 2} height={CELL - m * 2}
                rx={4}
                fill="rgba(0,0,0,0.3)"
              />
              {/* main face, shifted up-left to expose shadow on bottom-right */}
              <rect
                x={cx + m} y={cy + m}
                width={CELL - m * 2 - b} height={CELL - m * 2 - b}
                rx={4}
                fill={piece.color}
              />
              {/* bright top-left highlight edge */}
              <rect
                x={cx + m} y={cy + m}
                width={CELL - m * 2 - b} height={CELL - m * 2 - b}
                rx={4}
                fill="url(#cellBevel)"
              />
            </g>
          )
        } else {
          rects.push(
            <rect
              key={`${r}-${c}`}
              x={cx + 1} y={cy + 1}
              width={CELL - 2} height={CELL - 2}
              rx={4}
              fill="#f0f0ee"
              stroke="#ddd"
              strokeWidth={1}
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
        const x0 = PAD + (piece.gridCol + c) * CELL
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
      const gx = PAD + (piece.gridCol + lc) * CELL + CELL / 2
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
      return (
        <g key={piece.id}
          onPointerDown={(e) => onTrayPieceDown(e, piece.id)}
          style={{ cursor: 'grab' }}
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
            const tm = 0.5
            const tb = 2
            const bx = x + c * S + tm
            const by = y + r * S + tm
            return (
              <g key={i}>
                <rect x={bx} y={by} width={S - tm * 2} height={S - tm * 2}
                  rx={3} fill="rgba(0,0,0,0.3)" />
                <rect x={bx} y={by} width={S - tm * 2 - tb} height={S - tm * 2 - tb}
                  rx={3} fill={piece.color} />
                <rect x={bx} y={by} width={S - tm * 2 - tb} height={S - tm * 2 - tb}
                  rx={3} fill="url(#cellBevel)" />
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
        x={PAD + (drag.snapCol + c) * CELL + 2}
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
          const dx = drag.svgX + (c - minC) * CELL - cx + 1
          const dy = drag.svgY + (r - minR) * CELL - cy + 1
          const db = 3
          return (
            <g key={`drag-${i}`}>
              <rect x={dx} y={dy} width={CELL - 2} height={CELL - 2}
                rx={4} fill="rgba(0,0,0,0.3)" />
              <rect x={dx} y={dy} width={CELL - 2 - db} height={CELL - 2 - db}
                rx={4} fill={piece.color} />
              <rect x={dx} y={dy} width={CELL - 2 - db} height={CELL - 2 - db}
                rx={4} fill="url(#cellBevel)" />
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
          {completedLevels.has(levelIndex) ? ' ✓' : ''}
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

      {/* running sum */}
      <div style={styles.sumBar}>
        <span style={{
          ...styles.sumText,
          color: completed ? '#34c759' : '#bbb',
        }}>
          {placedSum} / {totalArea}
        </span>
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
          x={PAD - 2} y={PAD - 2}
          width={gridW * CELL + 4} height={gridH * CELL + 4}
          rx={8} fill="none" stroke="#ddd" strokeWidth={2}
        />

        {/* grid cells */}
        {renderGrid()}
        {renderPieceOutlines()}
        {renderGridNumbers()}

        {/* tray background */}
        <rect
          x={PAD - 2} y={trayY - 4}
          width={svgW - PAD * 2 + 4} height={trayLayout.trayH + 8}
          rx={8} fill="#fafaf8" stroke="#e8e8e6" strokeWidth={1}
        />
        <text
          x={PAD + 4} y={trayY + 12}
          fontSize={10} fill="#bbb"
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          Pieces — tap to select, tap again to rotate, drag to place
        </text>

        {/* tray pieces */}
        {renderTrayPieces()}

        {/* drag snap preview */}
        {renderDragGhost()}

        {/* dragging piece */}
        {renderDragPiece()}

        {/* CSS animations for celebration */}
        <defs>
          {/* bevel gradient for gem-like cells */}
          <linearGradient id="cellBevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.0" />
            <stop offset="55%" stopColor="#000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/* ---- styles ---- */

const styles = {
  root: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  svg: {
    width: '100%',
    maxWidth: 600,
    display: 'block',
    margin: '0 auto 0.5rem',
    touchAction: 'none',
    cursor: 'default',
  },
  sumBar: {
    textAlign: 'center',
    marginBottom: '0.25rem',
  },
  sumText: {
    fontSize: '1.1rem',
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
    transition: 'color 0.3s',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
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
