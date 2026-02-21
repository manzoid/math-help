import { useState, useRef, useMemo, useCallback } from 'react'
import LEVELS, { SHAPES, rotateCW, PIECE_COLORS } from './levels.js'

/* ---- layout constants (SVG viewBox units) ---- */
const CELL = 40
const PAD = 20
const TRAY_H = 120
const TRAY_GAP = 20
const TRAY_SCALE = 0.55
const TAP_THRESHOLD = 5
const DRAG_LIFT = 120 // lift drag piece well above finger (like Block Blast)

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

/* ---- find legal placements for a piece ---- */
function findAllLegalPlacements(grid, cells, w, h) {
  const placements = []
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (canPlace(grid, cells, r, c, w, h, null)) {
        placements.push({ row: r, col: c })
      }
    }
  }
  return placements
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
  const [hintLevel, setHintLevel] = useState(0)
  const [completed, setCompleted] = useState(false)
  const dragStart = useRef(null)

  /* ---- derived layout ---- */
  const gridW = level.gridWidth
  const gridH = level.gridHeight
  const svgW = Math.max(gridW * CELL + PAD * 2, 320)
  const trayY = PAD + gridH * CELL + TRAY_GAP
  const svgH = trayY + TRAY_H + PAD

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
    setHintLevel(0)
    setCompleted(false)
  }

  function resetLevel() {
    setPieces(initPieces(level))
    setGrid(makeGrid(gridW, gridH))
    setSelectedId(null)
    setDrag(null)
    setHintLevel(0)
    setCompleted(false)
  }

  /* ---- hint system ---- */
  function onHint() {
    if (hintLevel >= 3) return
    const next = hintLevel + 1
    setHintLevel(next)

    if (next === 3) {
      // Auto-place one correct piece
      const canon = level.canonicalSolutions
      for (const sol of canon) {
        const piece = pieces[sol.pieceIndex]
        if (piece && !piece.placed) {
          // Apply the canonical rotation
          const rotated = applyRotation(piece.baseShape, sol.rotation)
          const newPieces = pieces.map(p =>
            p.id === sol.pieceIndex
              ? { ...p, rotation: sol.rotation, placed: true, gridRow: sol.row, gridCol: sol.col }
              : p
          )
          const newGrid = grid.map(r => [...r])
          for (const [r, c] of rotated) {
            const gr = sol.row + r
            const gc = sol.col + c
            if (gr >= 0 && gr < gridH && gc >= 0 && gc < gridW) {
              newGrid[gr][gc] = sol.pieceIndex
            }
          }
          setPieces(newPieces)
          setGrid(newGrid)

          if (checkCompletion(newGrid, newPieces)) {
            setCompleted(true)
            setCompletedLevels(prev => new Set([...prev, levelIndex]))
          }
          break
        }
      }
    }
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

  /* ---- compute tray positions ---- */
  function getTrayPositions() {
    const positions = []
    let x = PAD
    for (const piece of trayPieces) {
      const cells = getCells(piece)
      const maxC = Math.max(...cells.map(([, c]) => c)) + 1
      const maxR = Math.max(...cells.map(([r]) => r)) + 1
      const pw = maxC * CELL * TRAY_SCALE
      const ph = maxR * CELL * TRAY_SCALE
      positions.push({
        piece,
        x,
        y: trayY + (TRAY_H - ph) / 2,
        w: pw,
        h: ph,
      })
      x += pw + 12
    }
    return positions
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
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={PAD + c * CELL + 1}
            y={PAD + r * CELL + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={4}
            fill={piece ? piece.color : '#f0f0ee'}
            stroke={piece ? '#fff' : '#ddd'}
            strokeWidth={piece ? 2 : 1}
            opacity={piece ? 0.9 : 1}
            style={{ cursor: piece ? 'pointer' : 'default' }}
            onPointerDown={piece ? (e) => onGridPieceDown(e, pid) : undefined}
          />
        )
      }
    }
    return rects
  }

  function renderTrayPieces() {
    const positions = getTrayPositions()
    return positions.map(({ piece, x, y }) => {
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
          {cells.map(([r, c], i) => (
            <rect
              key={i}
              x={x + c * CELL * TRAY_SCALE + 1}
              y={y + r * CELL * TRAY_SCALE + 1}
              width={CELL * TRAY_SCALE - 2}
              height={CELL * TRAY_SCALE - 2}
              rx={3}
              fill={piece.color}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ))}
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
      <g style={{ pointerEvents: 'none' }}>
        {cells.map(([r, c], i) => (
          <rect
            key={`drag-${i}`}
            x={drag.svgX + (c - minC) * CELL - cx + 1}
            y={drag.svgY + (r - minR) * CELL - cy + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={4}
            fill={piece.color}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.8}
          />
        ))}
      </g>
    )
  }

  function renderHints() {
    if (hintLevel === 0 || selectedId === null) return null
    const piece = pieces.find(p => p.id === selectedId)
    if (!piece || piece.placed) return null
    const cells = getCells(piece)

    if (hintLevel >= 1) {
      // Show all legal placements
      const placements = findAllLegalPlacements(grid, cells, gridW, gridH)
      return placements.map((pl, pi) => (
        cells.map(([r, c], ci) => (
          <rect
            key={`hint-${pi}-${ci}`}
            x={PAD + (pl.col + c) * CELL + 3}
            y={PAD + (pl.row + r) * CELL + 3}
            width={CELL - 6}
            height={CELL - 6}
            rx={4}
            fill={piece.color}
            opacity={0.15}
            style={{ pointerEvents: 'none' }}
          />
        ))
      ))
    }
    return null
  }

  function renderCanonicalHint() {
    if (hintLevel < 2 || selectedId === null) return null
    const piece = pieces.find(p => p.id === selectedId)
    if (!piece || piece.placed) return null

    const sol = level.canonicalSolutions.find(s => s.pieceIndex === selectedId)
    if (!sol) return null

    const cells = applyRotation(piece.baseShape, sol.rotation)
    return cells.map(([r, c], i) => (
      <rect
        key={`canon-${i}`}
        x={PAD + (sol.col + c) * CELL + 2}
        y={PAD + (sol.row + r) * CELL + 2}
        width={CELL - 4}
        height={CELL - 4}
        rx={4}
        fill={piece.color}
        opacity={0.4}
        stroke={piece.color}
        strokeWidth={2}
        strokeDasharray="4 3"
        style={{ pointerEvents: 'none' }}
      />
    ))
  }

  function renderCompletion() {
    if (!completed) return null
    const cx = PAD + (gridW * CELL) / 2
    const cy = PAD + (gridH * CELL) / 2
    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={PAD} y={PAD}
          width={gridW * CELL} height={gridH * CELL}
          rx={8}
          fill="rgba(52,199,89,0.12)"
        />
        <text
          x={cx} y={cy - 6}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={28} fontWeight={700}
          fill="#34c759"
          fontFamily="system-ui, sans-serif"
        >
          Complete!
        </text>
        <text
          x={cx} y={cy + 22}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={22}
          fill="#34c759"
        >
          ✓
        </text>
      </g>
    )
  }

  /* ============================================================== */
  /*  JSX                                                            */
  /* ============================================================== */

  const pieceCount = level.pieces.length
  const pieceSz = level.pieceSize

  return (
    <div style={styles.root}>
      {/* info bar */}
      <div style={styles.infoBar}>
        {pieceCount} piece{pieceCount !== 1 ? 's' : ''} — each piece has {pieceSz} square{pieceSz !== 1 ? 's' : ''}
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

        {/* hints */}
        {renderHints()}
        {renderCanonicalHint()}

        {/* tray background */}
        <rect
          x={PAD - 2} y={trayY - 4}
          width={svgW - PAD * 2 + 4} height={TRAY_H + 8}
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

        {/* completion overlay */}
        {renderCompletion()}
      </svg>

      {/* controls */}
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
        <button onClick={onHint} style={styles.btnSecondary} disabled={hintLevel >= 3}>
          Hint{hintLevel > 0 ? ` (${hintLevel}/3)` : ''}
        </button>
      </div>
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
  infoBar: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: 'var(--color-muted)',
    marginBottom: '0.5rem',
    fontWeight: 500,
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
