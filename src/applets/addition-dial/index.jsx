import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20

function clamp(n) {
  return Math.max(0, Math.min(MAX, n))
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

/**
 * A draggable column: dial number on top, dots below.
 * The entire column is the drag/scroll target so your finger
 * can rest on the dots while the number stays visible above.
 */
function DialColumn({ value, onChange, color }) {
  const colRef = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  /* ---- pointer drag (whole column) ---- */
  const onPointerDown = useCallback(
    (e) => {
      // let chevron buttons handle their own clicks
      if (e.target.closest('button')) return
      e.preventDefault()
      dragging.current = true
      startY.current = e.clientY
      startVal.current = value
      colRef.current?.setPointerCapture(e.pointerId)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return
      const dy = startY.current - e.clientY
      const steps = Math.round(dy / 18)
      const next = clamp(startVal.current + steps)
      if (next !== value) onChange(next)
    },
    [value, onChange],
  )

  const onPointerUp = useCallback((e) => {
    dragging.current = false
    colRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  /* ---- scroll wheel (throttled, whole column) ---- */
  const scrollAccum = useRef(0)
  useEffect(() => {
    const el = colRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      scrollAccum.current += e.deltaY
      const threshold = 80
      if (Math.abs(scrollAccum.current) >= threshold) {
        const dir = scrollAccum.current < 0 ? 1 : -1
        onChange(clamp(value + dir))
        scrollAccum.current = 0
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [value, onChange])

  return (
    <div
      ref={colRef}
      style={s.column}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* chevron up */}
      <button
        style={s.chevron}
        onClick={() => onChange(clamp(value + 1))}
        aria-label="increase"
      >
        &#x25B2;
      </button>

      {/* number display */}
      <div style={{ ...s.dialWindow, borderColor: color }}>
        <div style={{ ...s.dialValue, color }}>{value}</div>
      </div>

      {/* chevron down */}
      <button
        style={s.chevron}
        onClick={() => onChange(clamp(value - 1))}
        aria-label="decrease"
      >
        &#x25BC;
      </button>

      {/* dots */}
      <DotGrid count={value} color={color} />
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
        Drag up or down on the dots &mdash; watch the sum follow!
      </div>

      <div style={s.equation}>
        <DialColumn value={a} onChange={setA} color={A_COLOR} />
        <span style={s.op}>+</span>
        <DialColumn value={b} onChange={setB} color={B_COLOR} />
        <span style={s.op}>=</span>

        {/* sum column (not draggable) */}
        <div style={s.column}>
          <div style={{ ...s.sumDisplay, color: SUM_COLOR }}>{sum}</div>
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
    gap: '1rem',
    marginBottom: '2rem',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'ns-resize',
    touchAction: 'none',
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

  /* dial display */
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
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  dialValue: {
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: 1,
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
