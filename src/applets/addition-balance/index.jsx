import { useState, useEffect, useRef, useCallback } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX_WEIGHTS = 12

/* ---- SVG layout constants ---- */
const SVG_W = 520
const SVG_H = 370
const PIVOT_X = SVG_W / 2
const PIVOT_Y = 90
const BEAM_LEN = 210
const BEAM_THICK = 6
const POST_H = 170
const BASE_W = 110
const BASE_H = 12
const CHAIN_LEN = 75
const TRAY_W = 80
const TRAY_DEPTH = 8
const WEIGHT_R = 8
const MAX_TILT_DEG = 22
const IMBALANCE_BG = 'rgba(255, 59, 48, 0.08)'
const IMBALANCE_BORDER = 'rgba(255, 59, 48, 0.25)'

/* ---- helpers ---- */

function rotatePoint(px, py, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

function tiltAngle(leftTotal, rightTotal) {
  const diff = leftTotal - rightTotal
  const raw = diff * 6
  return Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, raw))
}

/* positions of weights stacked in a tray (2 columns) */
function weightPositions(count, trayX, trayY) {
  const cols = 2
  const spacing = WEIGHT_R * 2.2
  const out = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    out.push({
      x: trayX + (col - (cols - 1) / 2) * spacing,
      y: trayY - WEIGHT_R - 3 - row * (WEIGHT_R * 2 + 2),
    })
  }
  return out
}

/* ---- spring-animated angle hook ---- */
function useSpringAngle(target) {
  const [angle, setAngle] = useState(0)
  const cur = useRef(0)
  const vel = useRef(0)
  const raf = useRef(null)

  useEffect(() => {
    const stiffness = 0.04
    const damping = 0.72

    const tick = () => {
      const diff = target - cur.current
      vel.current = vel.current * damping + diff * stiffness
      cur.current += vel.current

      if (Math.abs(vel.current) < 0.01 && Math.abs(diff) < 0.05) {
        cur.current = target
        vel.current = 0
        setAngle(target)
        raf.current = null
        return
      }
      setAngle(cur.current)
      raf.current = requestAnimationFrame(tick)
    }

    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])

  return angle
}

/* ---- hit-test: is point inside a tray region? ---- */
function hitTray(px, py, trayX, trayY) {
  const hw = TRAY_W / 2 + 10
  const top = trayY - 80
  const bot = trayY + TRAY_DEPTH + 10
  return px >= trayX - hw && px <= trayX + hw && py >= top && py <= bot
}

/* ---- hit-test: is point inside the supply area? ---- */
function hitSupply(py) {
  return py >= SVG_H - 50
}

/* ===================== main component ===================== */

export default function AdditionBalance() {
  const [a, setA] = useState(6)
  const [b, setB] = useState(3)
  const [sum, setSum] = useState(9)

  const leftTotal = a + b
  const balanced = leftTotal === sum
  const targetAngle = tiltAngle(leftTotal, sum)
  const angle = useSpringAngle(targetAngle)

  /* Compute tray positions from current angle */
  const leftOuter = rotatePoint(PIVOT_X - BEAM_LEN * 0.88, PIVOT_Y, PIVOT_X, PIVOT_Y, angle)
  const leftInner = rotatePoint(PIVOT_X - BEAM_LEN * 0.42, PIVOT_Y, PIVOT_X, PIVOT_Y, angle)
  const rightAttach = rotatePoint(PIVOT_X + BEAM_LEN * 0.88, PIVOT_Y, PIVOT_X, PIVOT_Y, angle)

  const trayA = { x: leftOuter.x, y: leftOuter.y + CHAIN_LEN }
  const trayB = { x: leftInner.x, y: leftInner.y + CHAIN_LEN }
  const traySum = { x: rightAttach.x, y: rightAttach.y + CHAIN_LEN }

  const weightsA = weightPositions(a, trayA.x, trayA.y)
  const weightsB = weightPositions(b, trayB.x, trayB.y)
  const weightsSum = weightPositions(sum, traySum.x, traySum.y)

  /* ---- drag state ---- */
  const svgRef = useRef(null)
  const [dragging, setDragging] = useState(null) // { source: 'a'|'b'|'sum'|'supply', x, y }

  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgP = pt.matrixTransform(ctm.inverse())
    return { x: svgP.x, y: svgP.y }
  }, [])

  /* Which tray did the pointer land on? */
  const trayAtPoint = useCallback(
    (px, py) => {
      if (hitTray(px, py, trayA.x, trayA.y)) return 'a'
      if (hitTray(px, py, trayB.x, trayB.y)) return 'b'
      if (hitTray(px, py, traySum.x, traySum.y)) return 'sum'
      return null
    },
    [trayA, trayB, traySum],
  )

  const removeFromTray = useCallback(
    (tray) => {
      if (tray === 'a' && a > 0) setA(a - 1)
      else if (tray === 'b' && b > 0) setB(b - 1)
      else if (tray === 'sum' && sum > 0) setSum(sum - 1)
    },
    [a, b, sum],
  )

  const addToTray = useCallback(
    (tray) => {
      if (tray === 'a' && a < MAX_WEIGHTS) setA(a + 1)
      else if (tray === 'b' && b < MAX_WEIGHTS) setB(b + 1)
      else if (tray === 'sum' && sum < MAX_WEIGHTS * 2) setSum(sum + 1)
    },
    [a, b, sum],
  )

  /* pointer handlers */
  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      svg.setPointerCapture(e.pointerId)

      const p = svgPoint(e.clientX, e.clientY)
      const tray = trayAtPoint(p.x, p.y)

      if (tray) {
        // Pick up a weight from that tray
        const count = tray === 'a' ? a : tray === 'b' ? b : sum
        if (count > 0) {
          removeFromTray(tray)
          setDragging({ source: tray, x: p.x, y: p.y })
        }
      } else if (hitSupply(p.y)) {
        // Pick up from supply
        setDragging({ source: 'supply', x: p.x, y: p.y })
      }
    },
    [svgPoint, trayAtPoint, a, b, sum, removeFromTray],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging) return
      const p = svgPoint(e.clientX, e.clientY)
      setDragging((d) => (d ? { ...d, x: p.x, y: p.y } : null))
    },
    [dragging, svgPoint],
  )

  const onPointerUp = useCallback(
    (e) => {
      if (!dragging) return
      const svg = svgRef.current
      if (svg) svg.releasePointerCapture(e.pointerId)

      const p = svgPoint(e.clientX, e.clientY)
      const tray = trayAtPoint(p.x, p.y)

      if (tray) {
        addToTray(tray)
      } else if (hitSupply(p.y)) {
        // Dropped on supply area — weight returns to supply (removed from tray)
      } else if (dragging.source !== 'supply') {
        // Dropped in empty space — snap back to source tray
        addToTray(dragging.source)
      }

      setDragging(null)
    },
    [dragging, svgPoint, trayAtPoint, addToTray],
  )

  /* beam endpoints */
  const leftBeam = rotatePoint(PIVOT_X - BEAM_LEN, PIVOT_Y, PIVOT_X, PIVOT_Y, angle)
  const rightBeam = rotatePoint(PIVOT_X + BEAM_LEN, PIVOT_Y, PIVOT_X, PIVOT_Y, angle)

  /* supply area weights */
  const supplyY = SVG_H - 22
  const supplyWeights = Array.from({ length: 8 }, (_, i) => ({
    x: SVG_W / 2 + (i - 3.5) * (WEIGHT_R * 2.6),
    y: supplyY,
  }))

  return (
    <div style={s.root}>
      <div style={s.hint}>
        Drag weights from the supply onto any tray, or between trays.
        Drag a weight back to the supply to remove it.
      </div>

      {/* Big equation */}
      <div
        style={{
          ...s.equation,
          background: balanced ? 'transparent' : IMBALANCE_BG,
          border: balanced ? '2px solid transparent' : `2px solid ${IMBALANCE_BORDER}`,
        }}
      >
        <span style={{ color: A_COLOR }}>{a}</span>
        <span style={s.eqOp}> + </span>
        <span style={{ color: B_COLOR }}>{b}</span>
        <span style={s.eqOp}> {balanced ? '=' : '\u2260'} </span>
        <span style={{ color: balanced ? SUM_COLOR : '#e04040' }}>{sum}</span>
        {!balanced && (
          <span style={s.eqHint}>
            {leftTotal > sum ? ' (left heavier)' : ' (right heavier)'}
          </span>
        )}
      </div>

      {/* Balance SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={s.svg}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* base */}
        <rect
          x={PIVOT_X - BASE_W / 2} y={PIVOT_Y + POST_H}
          width={BASE_W} height={BASE_H} rx={4} fill="#888"
        />
        {/* post */}
        <line
          x1={PIVOT_X} y1={PIVOT_Y}
          x2={PIVOT_X} y2={PIVOT_Y + POST_H}
          stroke="#999" strokeWidth={5} strokeLinecap="round"
        />
        {/* pivot */}
        <polygon
          points={`${PIVOT_X},${PIVOT_Y - 10} ${PIVOT_X - 8},${PIVOT_Y + 4} ${PIVOT_X + 8},${PIVOT_Y + 4}`}
          fill="#777"
        />

        {/* beam */}
        <line
          x1={leftBeam.x} y1={leftBeam.y}
          x2={rightBeam.x} y2={rightBeam.y}
          stroke="#666" strokeWidth={BEAM_THICK} strokeLinecap="round"
        />

        {/* chains */}
        {[[leftOuter, trayA], [leftInner, trayB], [rightAttach, traySum]].map(
          ([from, to], i) => (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#aaa" strokeWidth={1.5} strokeDasharray="3 2"
            />
          ),
        )}

        {/* trays */}
        {[
          { pos: trayA, color: A_COLOR, label: 'A' },
          { pos: trayB, color: B_COLOR, label: 'B' },
          { pos: traySum, color: SUM_COLOR, label: 'Sum' },
        ].map(({ pos, color, label }) => {
          const hw = TRAY_W / 2
          return (
            <g key={label}>
              <path
                d={`M ${pos.x - hw} ${pos.y}
                    L ${pos.x - hw + 5} ${pos.y + TRAY_DEPTH}
                    L ${pos.x + hw - 5} ${pos.y + TRAY_DEPTH}
                    L ${pos.x + hw} ${pos.y} Z`}
                fill={color} opacity={0.15}
                stroke={color} strokeWidth={1.5} strokeLinejoin="round"
              />
              <line
                x1={pos.x - hw} y1={pos.y}
                x2={pos.x + hw} y2={pos.y}
                stroke={color} strokeWidth={2.5} strokeLinecap="round"
              />
              <text
                x={pos.x} y={pos.y + TRAY_DEPTH + 16}
                textAnchor="middle" fontSize="11" fontWeight="600" fill={color}
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* weights on trays */}
        {weightsA.map((p, i) => (
          <circle key={`a${i}`} cx={p.x} cy={p.y} r={WEIGHT_R}
            fill={A_COLOR} stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
          />
        ))}
        {weightsB.map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={WEIGHT_R}
            fill={B_COLOR} stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
          />
        ))}
        {weightsSum.map((p, i) => (
          <circle key={`s${i}`} cx={p.x} cy={p.y} r={WEIGHT_R}
            fill={SUM_COLOR} stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
          />
        ))}

        {/* supply area */}
        <rect
          x={20} y={SVG_H - 46}
          width={SVG_W - 40} height={42}
          rx={8} fill="#f5f5f3" stroke="#ddd" strokeWidth={1}
        />
        <text
          x={SVG_W / 2} y={SVG_H - 34}
          textAnchor="middle" fontSize="10" fill="#aaa" fontWeight="500"
        >
          SUPPLY — drag weights up onto a tray
        </text>
        {supplyWeights.map((p, i) => (
          <circle key={`sup${i}`} cx={p.x} cy={p.y} r={WEIGHT_R}
            fill="#999" stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'grab', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
          />
        ))}

        {/* balanced indicator */}
        {balanced && (
          <text
            x={PIVOT_X} y={PIVOT_Y - 22}
            textAnchor="middle" fontSize="13" fontWeight="700" fill={SUM_COLOR}
            style={{ animation: 'popIn 0.3s ease both' }}
          >
            Balanced!
          </text>
        )}

        {/* dragged weight */}
        {dragging && (
          <circle
            cx={dragging.x} cy={dragging.y} r={WEIGHT_R + 2}
            fill={
              dragging.source === 'a'
                ? A_COLOR
                : dragging.source === 'b'
                  ? B_COLOR
                  : dragging.source === 'sum'
                    ? SUM_COLOR
                    : '#999'
            }
            stroke="#fff" strokeWidth={2}
            opacity={0.85}
            style={{ pointerEvents: 'none', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.3))' }}
          />
        )}
      </svg>

      {/* Insight */}
      <div style={s.insight}>
        <div style={s.insightTitle}>The pattern</div>
        <p style={s.insightText}>
          The left side holds <strong style={{ color: A_COLOR }}>{a}</strong>
          {' + '}
          <strong style={{ color: B_COLOR }}>{b}</strong>
          {' = '}
          <strong>{leftTotal}</strong> total weights.
          {balanced ? (
            <>
              {' '}The right side also holds <strong style={{ color: SUM_COLOR }}>{sum}</strong>,
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

/* ——— styles ——— */

const s = {
  root: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  hint: {
    textAlign: 'center',
    color: 'var(--color-muted)',
    fontSize: '0.95rem',
    marginBottom: '1.25rem',
    fontWeight: 500,
  },
  equation: {
    textAlign: 'center',
    fontSize: '2.2rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginBottom: '0.25rem',
    letterSpacing: '-0.02em',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    transition: 'background 0.3s, border-color 0.3s',
  },
  eqOp: { color: 'var(--color-muted)', fontWeight: 400 },
  eqHint: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--color-muted)',
    fontFamily: 'inherit',
  },
  svg: {
    width: '100%',
    maxWidth: 520,
    display: 'block',
    margin: '0 auto 1.5rem',
    touchAction: 'none',
    cursor: 'default',
  },
  insight: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    border: '2px dashed var(--color-success)',
  },
  insightTitle: {
    fontWeight: 700,
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-success)',
    marginBottom: '0.4rem',
  },
  insightText: {
    fontSize: '0.95rem',
    lineHeight: 1.5,
  },
}
