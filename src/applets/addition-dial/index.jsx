import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20

/**
 * A single number that acts like a dial / drum roller.
 * - drag up/down to change value
 * - scroll wheel to change value
 * - tap chevrons to nudge ±1
 * Shows ghost numbers above/below like a slot machine wheel.
 */
function Dial({ value, onChange, color }) {
  const ref = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  const clamp = (n) => Math.max(0, Math.min(MAX, n))

  /* ---- pointer drag ---- */
  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
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
      const dy = startY.current - e.clientY // up = positive
      const steps = Math.round(dy / 18)
      const next = clamp(startVal.current + steps)
      if (next !== value) onChange(next)
    },
    [value, onChange],
  )

  const onPointerUp = useCallback((e) => {
    dragging.current = false
    ref.current?.releasePointerCapture(e.pointerId)
  }, [])

  /* ---- scroll wheel ---- */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      onChange(clamp(value + dir))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [value, onChange])

  const prev = value > 0 ? value - 1 : null
  const next = value < MAX ? value + 1 : null

  return (
    <div style={s.dialWrapper}>
      {/* up chevron */}
      <button
        style={s.chevron}
        onClick={() => onChange(clamp(value + 1))}
        aria-label="increase"
      >
        &#x25B2;
      </button>

      <div
        ref={ref}
        style={{ ...s.dialWindow, borderColor: color }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* ghost above */}
        <div style={s.ghost}>{prev != null ? prev : ''}</div>
        {/* current value */}
        <div style={{ ...s.dialValue, color }}>{value}</div>
        {/* ghost below */}
        <div style={s.ghost}>{next != null ? next : ''}</div>
      </div>

      {/* down chevron */}
      <button
        style={s.chevron}
        onClick={() => onChange(clamp(value - 1))}
        aria-label="decrease"
      >
        &#x25BC;
      </button>
    </div>
  )
}

function DotRow({ count, color, maxCount }) {
  return (
    <div style={s.dotRow}>
      {Array.from({ length: maxCount }, (_, i) => (
        <div
          key={i}
          style={{
            ...s.dot,
            background: i < count ? color : '#e8e8e6',
            transform: i < count ? 'scale(1)' : 'scale(0.55)',
            opacity: i < count ? 1 : 0.3,
            transition: 'all 0.15s ease',
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
    <div>
      <div style={s.hint}>
        Drag a number up or down &mdash; watch the sum follow!
      </div>

      {/* The equation with dials */}
      <div style={s.equation}>
        <Dial value={a} onChange={setA} color={A_COLOR} />
        <span style={s.op}>+</span>
        <Dial value={b} onChange={setB} color={B_COLOR} />
        <span style={s.op}>=</span>
        <div style={{ ...s.sumDisplay, color: SUM_COLOR }}>{sum}</div>
      </div>

      {/* Dot visualization */}
      <div style={s.dotsCard}>
        <div style={s.dotsSection}>
          <div style={{ ...s.dotsLabel, color: A_COLOR }}>
            {a}
          </div>
          <DotRow count={a} color={A_COLOR} maxCount={MAX} />
        </div>
        <div style={s.dotsPlusRow}>+</div>
        <div style={s.dotsSection}>
          <div style={{ ...s.dotsLabel, color: B_COLOR }}>
            {b}
          </div>
          <DotRow count={b} color={B_COLOR} maxCount={MAX} />
        </div>
        <div style={s.dotsPlusRow}>=</div>
        <div style={s.dotsSection}>
          <div style={{ ...s.dotsLabel, color: SUM_COLOR }}>
            {sum}
          </div>
          <DotRow count={sum} color={SUM_COLOR} maxCount={MAX * 2} />
        </div>
      </div>

      {/* Insight */}
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
  hint: {
    textAlign: 'center',
    color: 'var(--color-muted)',
    fontSize: '0.95rem',
    marginBottom: '1.5rem',
    fontWeight: 500,
  },

  /* equation row */
  equation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  op: {
    fontSize: '2.2rem',
    fontWeight: 400,
    color: 'var(--color-muted)',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    userSelect: 'none',
  },
  sumDisplay: {
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    minWidth: 56,
    textAlign: 'center',
    transition: 'color 0.15s',
  },

  /* dial */
  dialWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    userSelect: 'none',
  },
  chevron: {
    background: 'none',
    border: 'none',
    fontSize: '0.75rem',
    color: 'var(--color-muted)',
    padding: '0.2rem 0.5rem',
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  dialWindow: {
    width: 72,
    height: 120,
    borderRadius: 14,
    border: '3px solid',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'ns-resize',
    touchAction: 'none',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
    position: 'relative',
  },
  ghost: {
    fontSize: '1.3rem',
    fontWeight: 600,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: '#ccc',
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  dialValue: {
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: 1,
    userSelect: 'none',
  },

  /* dots */
  dotsCard: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.25rem 1.5rem',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '1.25rem',
  },
  dotsSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  dotsLabel: {
    fontWeight: 700,
    fontSize: '1rem',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    minWidth: 28,
    textAlign: 'right',
  },
  dotRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
  },
  dotsPlusRow: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    textAlign: 'center',
    padding: '0.2rem 0',
    marginLeft: 28,
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
