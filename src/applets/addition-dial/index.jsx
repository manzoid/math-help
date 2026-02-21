import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20

/**
 * A single number that acts like a dial.
 * - drag up/down to change value
 * - scroll wheel to change value
 * - tap chevrons to nudge ±1
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

  return (
    <div style={s.dialWrapper}>
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
        <div style={{ ...s.dialValue, color }}>{value}</div>
      </div>

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

/** Dots arranged 2-across below a number */
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
    <div>
      <div style={s.hint}>
        Drag a number up or down &mdash; watch the sum follow!
      </div>

      {/* Equation with dials, dots directly below each */}
      <div style={s.equation}>
        {/* first addend column */}
        <div style={s.column}>
          <Dial value={a} onChange={setA} color={A_COLOR} />
          <DotGrid count={a} color={A_COLOR} />
        </div>

        <span style={s.op}>+</span>

        {/* second addend column */}
        <div style={s.column}>
          <Dial value={b} onChange={setB} color={B_COLOR} />
          <DotGrid count={b} color={B_COLOR} />
        </div>

        <span style={s.op}>=</span>

        {/* sum column */}
        <div style={s.column}>
          <div style={{ ...s.sumDisplay, color: SUM_COLOR }}>{sum}</div>
          <DotGrid count={sum} color={SUM_COLOR} />
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

  /* equation layout */
  equation: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  op: {
    fontSize: '2.2rem',
    fontWeight: 400,
    color: 'var(--color-muted)',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    userSelect: 'none',
    marginTop: 28,
  },
  sumDisplay: {
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    minWidth: 56,
    textAlign: 'center',
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 72,
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
  dialValue: {
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: 1,
    userSelect: 'none',
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
