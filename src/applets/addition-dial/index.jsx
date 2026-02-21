import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20

const WHEEL_W = 28
const WHEEL_H = 56
const RIDGE_GAP = 6 // px between ridges

function clamp(n) {
  return Math.max(0, Math.min(MAX, n))
}

/**
 * Thumbwheel — like the ridged barrel on a car vent.
 * Horizontal ridges scroll visually as you drag up/down.
 */
function Thumbwheel({ value, onChange, color }) {
  const ref = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  // Offset ridges so they appear to scroll with the value
  const ridgeOffset = (value * RIDGE_GAP) % (RIDGE_GAP * 2)

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragging.current = true
      startY.current = e.clientY
      startVal.current = value
      ref.current?.setPointerCapture(e.pointerId)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return
      const dy = startY.current - e.clientY
      const steps = Math.round(dy / 16)
      const next = clamp(startVal.current + steps)
      if (next !== value) onChange(next)
    },
    [value, onChange],
  )

  const onPointerUp = useCallback((e) => {
    dragging.current = false
    ref.current?.releasePointerCapture(e.pointerId)
  }, [])

  /* scroll wheel */
  const scrollAccum = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      scrollAccum.current += e.deltaY
      if (Math.abs(scrollAccum.current) >= 80) {
        const dir = scrollAccum.current < 0 ? 1 : -1
        onChange(clamp(value + dir))
        scrollAccum.current = 0
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [value, onChange])

  // Build ridge lines
  const ridgeCount = Math.ceil(WHEEL_H / RIDGE_GAP) + 2
  const ridges = []
  for (let i = 0; i < ridgeCount; i++) {
    const y = i * RIDGE_GAP - ridgeOffset
    if (y >= -RIDGE_GAP && y <= WHEEL_H + RIDGE_GAP) {
      // Ridges near the center are more visible (barrel curvature effect)
      const distFromCenter = Math.abs(y - WHEEL_H / 2) / (WHEEL_H / 2)
      const opacity = 0.5 - distFromCenter * 0.3
      // Ridges near edges are slightly shorter (curvature)
      const inset = distFromCenter * 3
      ridges.push(
        <line
          key={i}
          x1={2 + inset}
          y1={y}
          x2={WHEEL_W - 2 - inset}
          y2={y}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={Math.max(0.1, opacity)}
        />,
      )
    }
  }

  return (
    <svg
      ref={ref}
      width={WHEEL_W}
      height={WHEEL_H}
      viewBox={`0 0 ${WHEEL_W} ${WHEEL_H}`}
      style={s.wheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* body */}
      <rect
        x={0.5}
        y={0.5}
        width={WHEEL_W - 1}
        height={WHEEL_H - 1}
        rx={4}
        ry={4}
        fill="#f0f0ee"
        stroke="#ccc"
        strokeWidth={1}
      />
      {/* clip ridges to the body */}
      <clipPath id="wheelClip">
        <rect x={1} y={1} width={WHEEL_W - 2} height={WHEEL_H - 2} rx={3} ry={3} />
      </clipPath>
      <g clipPath="url(#wheelClip)">{ridges}</g>
      {/* top/bottom edge shadow for barrel depth */}
      <rect
        x={1}
        y={1}
        width={WHEEL_W - 2}
        height={8}
        rx={3}
        fill="url(#topFade)"
      />
      <rect
        x={1}
        y={WHEEL_H - 9}
        width={WHEEL_W - 2}
        height={8}
        rx={3}
        fill="url(#bottomFade)"
      />
      <defs>
        <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e0de" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#e0e0de" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e0de" stopOpacity={0} />
          <stop offset="100%" stopColor="#e0e0de" stopOpacity={0.8} />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Dots arranged 2-across */
function DotGrid({ count, color }) {
  return (
    <div style={s.dotGrid}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            ...s.dot,
            background: color,
            animation: 'popIn 0.2s ease both',
          }}
        />
      ))}
    </div>
  )
}

export default function AdditionDial() {
  const [a, setA] = useState(5)
  const [b, setB] = useState(6)
  const sum = a + b

  return (
    <div style={s.root}>
      <div style={s.hint}>
        Roll a wheel up or down &mdash; watch the sum follow!
      </div>

      <div style={s.equation}>
        {/* first addend */}
        <div style={s.column}>
          <div style={s.numRow}>
            <Thumbwheel value={a} onChange={setA} color={A_COLOR} />
            <div style={{ ...s.number, color: A_COLOR }}>{a}</div>
          </div>
          <DotGrid count={a} color={A_COLOR} />
        </div>

        <span style={s.op}>+</span>

        {/* second addend */}
        <div style={s.column}>
          <div style={s.numRow}>
            <Thumbwheel value={b} onChange={setB} color={B_COLOR} />
            <div style={{ ...s.number, color: B_COLOR }}>{b}</div>
          </div>
          <DotGrid count={b} color={B_COLOR} />
        </div>

        <span style={s.op}>=</span>

        {/* sum */}
        <div style={s.column}>
          <div style={s.numRow}>
            <div style={{ ...s.number, color: SUM_COLOR }}>{sum}</div>
          </div>
          <DotGrid count={sum} color={SUM_COLOR} />
        </div>
      </div>

      <div style={s.insight}>
        <div style={s.insightTitle}>The pattern</div>
        <p style={s.insightText}>
          Roll either wheel <strong>up by 1</strong> &mdash;
          the sum goes <strong>up by 1</strong>.{' '}
          Roll it <strong>down by 1</strong> &mdash;
          the sum goes <strong>down by 1</strong>.{' '}
          They always move together!
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
    marginBottom: '1.5rem',
    fontWeight: 500,
  },

  /* equation layout */
  equation: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.6rem',
  },
  numRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  number: {
    fontSize: '2.6rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: 1,
    minWidth: 40,
    textAlign: 'center',
  },
  op: {
    fontSize: '2.2rem',
    fontWeight: 400,
    color: 'var(--color-muted)',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginTop: 12,
  },

  /* thumbwheel */
  wheel: {
    cursor: 'ns-resize',
    touchAction: 'none',
    flexShrink: 0,
  },

  /* dot grid (2 across) */
  dotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 18px)',
    gap: '5px',
    justifyContent: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: '50%',
  },

  /* insight */
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
