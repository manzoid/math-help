import { useState, useRef, useMemo, useEffect } from 'react'

/* ---- colours ---- */
const A_COLOR   = '#4a6cf7'
const B_COLOR   = '#ff9500'
const SUM_COLOR = '#34c759'
const COLORS    = { a: A_COLOR, b: B_COLOR, sum: SUM_COLOR }

/* ---- SVG viewBox ---- */
const W = 480
const H = 290

/* ---- layout constants (in viewBox units) ---- */
const PIVOT     = { x: W / 2, y: 38 }
const POST_H    = 105
const BEAM_HALF = 140
const BEAM_H    = 6
const CHAIN_LEN = 60
const TRAY_W    = 70
const TRAY_WALL_H = 38
const TRAY_WALL_T = 4
const TRAY_FLOOR_H = 5
const WEIGHT_R  = 8
const MAX_ANGLE = 0.28

/* beam attachment x-offsets from pivot */
const ATTACH = { a: -BEAM_HALF * 0.85, b: -BEAM_HALF * 0.32, sum: BEAM_HALF * 0.82 }

/* ---- id generator ---- */
let _nid = 100

function makeDefaults() {
  const out = []
  for (let i = 0; i < 3; i++) out.push({ id: _nid++, tray: 'a' })
  for (let i = 0; i < 2; i++) out.push({ id: _nid++, tray: 'b' })
  for (let i = 0; i < 5; i++) out.push({ id: _nid++, tray: 'sum' })
  return out
}

/* ================================================================ */

export default function AdditionBalance() {
  const svgRef = useRef(null)
  const [weights, setWeights] = useState(makeDefaults)
  const [drag, setDrag]       = useState(null)   // { id, x, y }
  const [angle, setAngle]     = useState(0)
  const angleRef = useRef(0)
  const velRef   = useRef(0)
  const rafRef   = useRef(null)

  /* ---- weight counts per tray ---- */
  const counts = useMemo(() => {
    const c = { a: 0, b: 0, sum: 0 }
    for (const w of weights) if (c[w.tray] !== undefined) c[w.tray]++
    return c
  }, [weights])

  /* ---- spring-animated beam angle ---- */
  useEffect(() => {
    const diff   = (counts.a + counts.b) - counts.sum
    const target = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, diff * 0.055))
    let active   = true

    function tick() {
      if (!active) return
      velRef.current   = velRef.current * 0.75 + (target - angleRef.current) * 0.03
      angleRef.current += velRef.current

      if (Math.abs(angleRef.current - target) < 0.0005 &&
          Math.abs(velRef.current) < 0.0005) {
        angleRef.current = target
        velRef.current   = 0
        setAngle(target)
        return
      }
      setAngle(angleRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { active = false; cancelAnimationFrame(rafRef.current) }
  }, [counts.a, counts.b, counts.sum])

  /* ---- tray positions (derived from beam angle each frame) ---- */
  const trayPos = useMemo(() => {
    const pos = {}
    for (const [label, dx] of Object.entries(ATTACH)) {
      const ax = PIVOT.x + dx * Math.cos(angle)
      const ay = PIVOT.y + dx * Math.sin(angle) + BEAM_H / 2
      pos[label] = { ax, ay, x: ax, y: ay + CHAIN_LEN }
    }
    return pos
  }, [angle])

  /* ---- per-tray weight id lists (stable ordering for grid layout) ---- */
  const trayIds = useMemo(() => {
    const m = { a: [], b: [], sum: [] }
    for (const w of weights) if (m[w.tray]) m[w.tray].push(w.id)
    return m
  }, [weights])

  /* grid position of the i-th weight in a tray */
  function gridXY(tray, i) {
    const t = trayPos[tray]
    return {
      x: t.x + ((i % 3) - 1) * (WEIGHT_R * 2.5),
      y: t.y - TRAY_FLOOR_H / 2 - WEIGHT_R - 1 - Math.floor(i / 3) * (WEIGHT_R * 2.3),
    }
  }

  /* ---- SVG coordinate helpers ---- */
  function toSVG(cx, cy) {
    const svg = svgRef.current
    const pt  = svg.createSVGPoint()
    pt.x = cx; pt.y = cy
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  function hitTray(sx, sy) {
    for (const [label, tp] of Object.entries(trayPos)) {
      const hw = TRAY_W / 2 + 15
      if (sx > tp.x - hw && sx < tp.x + hw &&
          sy > tp.y - TRAY_WALL_H - 25 && sy < tp.y + 15)
        return label
    }
    return null
  }

  /* ---- pointer handlers ---- */
  function onWeightDown(e, id) {
    e.stopPropagation()
    svgRef.current.setPointerCapture(e.pointerId)
    const p = toSVG(e.clientX, e.clientY)
    setDrag({ id, x: p.x, y: p.y })
  }

  function onSupplyDown(e) {
    if (weights.length >= 36) return
    e.stopPropagation()
    svgRef.current.setPointerCapture(e.pointerId)
    const p  = toSVG(e.clientX, e.clientY)
    const id = _nid++
    setWeights(prev => [...prev, { id, tray: '_new' }])
    setDrag({ id, x: p.x, y: p.y })
  }

  function onMove(e) {
    if (!drag) return
    const p = toSVG(e.clientX, e.clientY)
    setDrag(d => d ? { ...d, x: p.x, y: p.y } : null)
  }

  function onUp() {
    if (!drag) return
    const tray = hitTray(drag.x, drag.y)
    if (tray) {
      setWeights(prev => prev.map(w => w.id === drag.id ? { ...w, tray } : w))
    } else {
      setWeights(prev => prev.filter(w => w.id !== drag.id))
    }
    setDrag(null)
  }

  function onReset() {
    setWeights(makeDefaults())
    setDrag(null)
  }

  /* ---- derived ---- */
  const leftTotal = counts.a + counts.b
  const balanced  = leftTotal === counts.sum

  /* ============================================================== */
  /*  SVG rendering helpers                                         */
  /* ============================================================== */

  function renderBeam() {
    return (
      <rect
        x={PIVOT.x - BEAM_HALF} y={PIVOT.y - BEAM_H / 2}
        width={BEAM_HALF * 2} height={BEAM_H}
        fill="#666" rx={2}
        transform={`rotate(${angle * 180 / Math.PI} ${PIVOT.x} ${PIVOT.y})`}
      />
    )
  }

  function renderTray(label) {
    const tp = trayPos[label]
    const color = COLORS[label]
    const { x, y, ax, ay } = tp
    const hw = TRAY_W / 2
    const spread = hw * 0.7          // chain attachment spread on tray top

    return (
      <g key={label}>
        {/* chains */}
        <line x1={ax - 10} y1={ay} x2={x - spread} y2={y - TRAY_WALL_H}
          stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={ax + 10} y1={ay} x2={x + spread} y2={y - TRAY_WALL_H}
          stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* walls */}
        <rect x={x - hw - TRAY_WALL_T} y={y - TRAY_WALL_H}
          width={TRAY_WALL_T} height={TRAY_WALL_H}
          fill={color} opacity={0.3} rx={1} />
        <rect x={x + hw} y={y - TRAY_WALL_H}
          width={TRAY_WALL_T} height={TRAY_WALL_H}
          fill={color} opacity={0.3} rx={1} />

        {/* floor */}
        <rect x={x - hw - TRAY_WALL_T} y={y - TRAY_FLOOR_H / 2}
          width={TRAY_W + TRAY_WALL_T * 2} height={TRAY_FLOOR_H}
          fill={color} opacity={0.45} rx={1} />

        {/* label below tray */}
        <text x={x} y={y + 16} textAnchor="middle" fill={color}
          fontSize={11} fontWeight="bold" fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}>
          {label === 'sum' ? 'Sum' : label.toUpperCase()}
        </text>
      </g>
    )
  }

  function renderWeights() {
    /* render the dragged weight last so it's always on top */
    const sorted = drag
      ? [...weights.filter(w => w.id !== drag.id),
         ...weights.filter(w => w.id === drag.id)]
      : weights

    return sorted.map(w => {
      const isDragging = drag?.id === w.id
      let cx, cy

      if (isDragging) {
        cx = drag.x; cy = drag.y
      } else if (trayPos[w.tray]) {
        const idx = trayIds[w.tray]?.indexOf(w.id) ?? 0
        const p = gridXY(w.tray, idx)
        cx = p.x; cy = p.y
      } else {
        return null          // _new weight not yet being dragged
      }

      return (
        <circle key={w.id} cx={cx} cy={cy} r={WEIGHT_R}
          fill={isDragging ? '#aaa' : (COLORS[w.tray] || '#999')}
          stroke="#fff" strokeWidth={1.5}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={e => onWeightDown(e, w.id)}
        />
      )
    })
  }

  function renderSupply() {
    const sy = H - 42
    const sh = 36
    const dots = 7
    const gap = WEIGHT_R * 2.4
    const startX = W / 2 - ((dots - 1) / 2) * gap

    return (
      <g>
        <rect x={20} y={sy} width={W - 40} height={sh}
          fill="#f5f5f3" stroke="#ddd" strokeWidth={1} rx={6}
          style={{ cursor: 'pointer' }} onPointerDown={onSupplyDown} />
        <text x={W / 2} y={sy + 11} textAnchor="middle" fill="#bbb"
          fontSize={9} fontWeight={500} fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}>
          SUPPLY — tap to grab, drag onto a tray
        </text>
        {Array.from({ length: dots }, (_, i) => (
          <circle key={i} cx={startX + i * gap} cy={H - 18}
            r={WEIGHT_R - 1} fill="#999" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'pointer' }} onPointerDown={onSupplyDown} />
        ))}
      </g>
    )
  }

  /* ============================================================== */
  /*  JSX                                                           */
  /* ============================================================== */

  const IMBALANCE_BG     = 'rgba(255,59,48,0.08)'
  const IMBALANCE_BORDER = 'rgba(255,59,48,0.25)'

  return (
    <div style={styles.root}>
      {/* equation bar */}
      <div style={{
        ...styles.equation,
        background: balanced ? 'transparent' : IMBALANCE_BG,
        border: balanced ? '2px solid transparent' : `2px solid ${IMBALANCE_BORDER}`,
      }}>
        <span style={{ color: A_COLOR }}>{counts.a}</span>
        <span style={styles.eqOp}> + </span>
        <span style={{ color: B_COLOR }}>{counts.b}</span>
        <span style={styles.eqOp}> {balanced ? '=' : '\u2260'} </span>
        <span style={{ color: balanced ? SUM_COLOR : '#e04040' }}>{counts.sum}</span>
        {!balanced && (
          <span style={styles.eqHint}>
            {leftTotal > counts.sum ? ' (left heavier)' : ' (right heavier)'}
          </span>
        )}
        {balanced && (
          <span style={{ ...styles.eqHint, color: SUM_COLOR }}> Balanced!</span>
        )}
      </div>

      {/* the scale */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={styles.svg}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {/* base + post */}
        <rect x={PIVOT.x - 40} y={PIVOT.y + POST_H} width={80} height={10}
          fill="#888" rx={2} />
        <rect x={PIVOT.x - 3} y={PIVOT.y} width={6} height={POST_H}
          fill="#999" />

        {/* pivot triangle */}
        <polygon
          points={`${PIVOT.x},${PIVOT.y - 12} ${PIVOT.x - 9},${PIVOT.y + 5} ${PIVOT.x + 9},${PIVOT.y + 5}`}
          fill="#777"
        />

        {/* beam */}
        {renderBeam()}

        {/* trays + chains */}
        {renderTray('a')}
        {renderTray('b')}
        {renderTray('sum')}

        {/* weights */}
        {renderWeights()}

        {/* supply zone */}
        {renderSupply()}
      </svg>

      {/* reset */}
      <div style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
        <button onClick={onReset} style={styles.resetBtn}>Reset weights</button>
      </div>

      {/* insight */}
      <div style={styles.insight}>
        <div style={styles.insightTitle}>The pattern</div>
        <p style={styles.insightText}>
          The left side holds{' '}
          <strong style={{ color: A_COLOR }}>{counts.a}</strong>
          {' + '}
          <strong style={{ color: B_COLOR }}>{counts.b}</strong>
          {' = '}
          <strong>{leftTotal}</strong> total weights.
          {balanced ? (
            <>
              {' '}The right side also holds{' '}
              <strong style={{ color: SUM_COLOR }}>{counts.sum}</strong>,
              so the scale balances perfectly!
            </>
          ) : (
            <>
              {' '}Try getting the right side to{' '}
              <strong>{leftTotal}</strong> to make it balance.
            </>
          )}
        </p>
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
    maxWidth: 700,
    display: 'block',
    margin: '0 auto 0.5rem',
    touchAction: 'none',
    cursor: 'default',
  },
  equation: {
    textAlign: 'center',
    fontSize: '1.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginBottom: '0.15rem',
    letterSpacing: '-0.02em',
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius)',
    transition: 'background 0.3s, border-color 0.3s',
  },
  eqOp: { color: 'var(--color-muted)', fontWeight: 400 },
  eqHint: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--color-muted)',
    fontFamily: 'inherit',
  },
  resetBtn: {
    background: 'var(--color-accent-light, #e8edff)',
    color: 'var(--color-accent, #4a6cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.4rem 1.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  insight: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    border: '2px dashed var(--color-success)',
  },
  insightTitle: {
    fontWeight: 700,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-success)',
    marginBottom: '0.3rem',
  },
  insightText: {
    fontSize: '0.9rem',
    lineHeight: 1.45,
    margin: 0,
  },
}
