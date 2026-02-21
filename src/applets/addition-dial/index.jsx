import { useState, useRef, useCallback, useEffect, useId } from 'react'

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX = 20

const W = 40
const H = 88
const RIDGE_SPACING = 7

function clamp(n) {
  return Math.max(0, Math.min(MAX, n))
}

/**
 * Realistic thumbwheel — a 3D cylindrical barrel with knurled ridges
 * that animate smoothly as you drag up/down.
 */
function Thumbwheel({ value, onChange, color }) {
  const id = useId()
  const ref = useRef(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  // Smooth pixel offset for ridge animation
  const ridgePixelOffset = (value * RIDGE_SPACING) % (RIDGE_SPACING * 2)

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

  // Build knurled ridges with 3D barrel curvature
  const ridgeCount = Math.ceil(H / RIDGE_SPACING) + 4
  const ridges = []
  for (let i = 0; i < ridgeCount; i++) {
    const y = i * RIDGE_SPACING - ridgePixelOffset - RIDGE_SPACING
    if (y < -RIDGE_SPACING || y > H + RIDGE_SPACING) continue

    // Barrel curvature: distance from vertical center
    const t = (y - H / 2) / (H / 2) // -1 to 1
    const curve = Math.sqrt(1 - t * t) // circular cross-section

    // Ridge width narrows toward edges
    const ridgeInset = (1 - curve) * (W * 0.4)
    const x1 = 4 + ridgeInset
    const x2 = W - 4 - ridgeInset

    if (x2 - x1 < 4) continue // too narrow at edges, skip

    // Opacity fades toward edges
    const opacity = curve * 0.9

    // Each ridge = groove shadow + highlight pair
    ridges.push(
      <g key={i} opacity={opacity}>
        {/* groove (dark) */}
        <line
          x1={x1} y1={y} x2={x2} y2={y}
          stroke="#555"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {/* highlight (light, offset up) */}
        <line
          x1={x1 + 0.5} y1={y - 1.5} x2={x2 - 0.5} y2={y - 1.5}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>,
    )
  }

  const clipId = `wc${id}`
  const bodyGradId = `bg${id}`
  const shineId = `sh${id}`
  const topShadowId = `ts${id}`
  const botShadowId = `bs${id}`
  const edgeShadowId = `es${id}`

  return (
    <svg
      ref={ref}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={s.wheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        {/* 3D cylinder body gradient (horizontal: dark edges, light center) */}
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#888" />
          <stop offset="15%" stopColor="#b0b0b0" />
          <stop offset="45%" stopColor="#d4d4d4" />
          <stop offset="55%" stopColor="#d8d8d8" />
          <stop offset="85%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#888" />
        </linearGradient>
        {/* specular highlight */}
        <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity={0} />
          <stop offset="35%" stopColor="white" stopOpacity={0} />
          <stop offset="48%" stopColor="white" stopOpacity={0.25} />
          <stop offset="52%" stopColor="white" stopOpacity={0.25} />
          <stop offset="65%" stopColor="white" stopOpacity={0} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
        {/* top/bottom barrel rolloff shadows */}
        <linearGradient id={topShadowId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#666" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#666" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={botShadowId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#666" stopOpacity={0} />
          <stop offset="100%" stopColor="#666" stopOpacity={0.7} />
        </linearGradient>
        {/* left/right edge darkening */}
        <linearGradient id={edgeShadowId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity={0.15} />
          <stop offset="12%" stopColor="#000" stopOpacity={0} />
          <stop offset="88%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.15} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={2} y={2} width={W - 4} height={H - 4} rx={5} ry={5} />
        </clipPath>
      </defs>

      {/* drop shadow */}
      <rect
        x={2} y={3} width={W - 4} height={H - 4}
        rx={6} ry={6}
        fill="rgba(0,0,0,0.12)"
      />

      {/* main barrel body */}
      <rect
        x={2} y={1} width={W - 4} height={H - 4}
        rx={6} ry={6}
        fill={`url(#${bodyGradId})`}
        stroke="#999"
        strokeWidth={0.5}
      />

      {/* knurled ridges */}
      <g clipPath={`url(#${clipId})`}>{ridges}</g>

      {/* specular highlight overlay */}
      <rect
        x={2} y={1} width={W - 4} height={H - 4}
        rx={6} ry={6}
        fill={`url(#${shineId})`}
      />

      {/* top barrel rolloff */}
      <rect
        x={2} y={1} width={W - 4} height={18}
        rx={6} ry={6}
        fill={`url(#${topShadowId})`}
      />
      {/* bottom barrel rolloff */}
      <rect
        x={2} y={H - 21} width={W - 4} height={18}
        rx={6} ry={6}
        fill={`url(#${botShadowId})`}
      />

      {/* edge darkening */}
      <rect
        x={2} y={1} width={W - 4} height={H - 4}
        rx={6} ry={6}
        fill={`url(#${edgeShadowId})`}
      />

      {/* subtle colored tint */}
      <rect
        x={2} y={1} width={W - 4} height={H - 4}
        rx={6} ry={6}
        fill={color}
        opacity={0.08}
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
    marginTop: 24,
  },

  /* thumbwheel */
  wheel: {
    cursor: 'ns-resize',
    touchAction: 'none',
    flexShrink: 0,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
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
