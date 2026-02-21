import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20
const KNOB_SIZE = 48
const KNOB_RADIUS = KNOB_SIZE / 2

function clamp(n) {
  return Math.max(0, Math.min(MAX, n))
}

/** SVG circular knob with a notch that rotates as value changes. */
function Knob({ value, onChange, color }) {
  const knobRef = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  // Map value 0–MAX to rotation 0–360
  const angle = (value / MAX) * 300 - 150 // -150 to +150 range
  const notchAngleRad = ((angle - 90) * Math.PI) / 180
  const notchX = KNOB_RADIUS + (KNOB_RADIUS - 8) * Math.cos(notchAngleRad)
  const notchY = KNOB_RADIUS + (KNOB_RADIUS - 8) * Math.sin(notchAngleRad)

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragging.current = true
      startY.current = e.clientY
      startVal.current = value
      knobRef.current?.setPointerCapture(e.pointerId)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return
      const dy = startY.current - e.clientY
      const steps = Math.round(dy / 14)
      const next = clamp(startVal.current + steps)
      if (next !== value) onChange(next)
    },
    [value, onChange],
  )

  const onPointerUp = useCallback((e) => {
    dragging.current = false
    knobRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  /* scroll wheel */
  const scrollAccum = useRef(0)
  useEffect(() => {
    const el = knobRef.current
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

  return (
    <svg
      ref={knobRef}
      width={KNOB_SIZE}
      height={KNOB_SIZE}
      viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`}
      style={s.knob}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* outer ring */}
      <circle
        cx={KNOB_RADIUS}
        cy={KNOB_RADIUS}
        r={KNOB_RADIUS - 2}
        fill="#f5f5f3"
        stroke={color}
        strokeWidth={3}
      />
      {/* grip lines */}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = ((a + angle) * Math.PI) / 180
        const x1 = KNOB_RADIUS + (KNOB_RADIUS - 6) * Math.cos(rad)
        const y1 = KNOB_RADIUS + (KNOB_RADIUS - 6) * Math.sin(rad)
        const x2 = KNOB_RADIUS + (KNOB_RADIUS - 10) * Math.cos(rad)
        const y2 = KNOB_RADIUS + (KNOB_RADIUS - 10) * Math.sin(rad)
        return (
          <line
            key={a}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#ccc"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )
      })}
      {/* notch indicator */}
      <circle
        cx={notchX}
        cy={notchY}
        r={4}
        fill={color}
      />
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
        Drag a dial up or down &mdash; watch the sum follow!
      </div>

      <div style={s.equation}>
        {/* first addend */}
        <div style={s.column}>
          <div style={s.numRow}>
            <Knob value={a} onChange={setA} color={A_COLOR} />
            <div style={{ ...s.number, color: A_COLOR }}>{a}</div>
          </div>
          <DotGrid count={a} color={A_COLOR} />
        </div>

        <span style={s.op}>+</span>

        {/* second addend */}
        <div style={s.column}>
          <div style={s.numRow}>
            <Knob value={b} onChange={setB} color={B_COLOR} />
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
          Dial either number <strong>up by 1</strong> &mdash;
          the sum goes <strong>up by 1</strong>.{' '}
          Dial it <strong>down by 1</strong> &mdash;
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
    gap: '0.4rem',
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
    marginTop: 8,
  },

  /* knob */
  knob: {
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
