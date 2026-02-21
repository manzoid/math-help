import { useState } from 'react'

const COLORS = [
  '#4a6cf7', '#34c759', '#ff9500', '#ff3b30', '#af52de',
  '#5ac8fa', '#ffcc00', '#ff6482', '#30d158', '#007aff',
]

function Dots({ count, color, label }) {
  const dots = Array.from({ length: count }, (_, i) => i)
  return (
    <div style={s.dotsGroup}>
      <div style={s.dotsLabel}>{label}</div>
      <div style={s.dotsRow}>
        {dots.map((i) => (
          <div
            key={i}
            style={{
              ...s.dot,
              background: color,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function EquationRow({ base, addend, isHighlighted, onClick }) {
  const sum = base + addend
  return (
    <button
      onClick={onClick}
      style={{
        ...s.eqRow,
        ...(isHighlighted ? s.eqRowActive : {}),
      }}
    >
      <span style={s.eqNum}>{base}</span>
      <span style={s.eqOp}>+</span>
      <span style={{ ...s.eqNum, color: COLORS[addend % COLORS.length] }}>{addend}</span>
      <span style={s.eqOp}>=</span>
      <span style={s.eqSum}>{sum}</span>
    </button>
  )
}

export default function AdditionPatterns() {
  const [base, setBase] = useState(7)
  const [selected, setSelected] = useState(1)
  const addends = Array.from({ length: 10 }, (_, i) => i + 1)

  const sum = base + selected

  return (
    <div>
      {/* Controls */}
      <div style={s.controls}>
        <label style={s.label}>
          Starting number:
          <input
            type="range"
            min={1}
            max={12}
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            style={s.slider}
          />
          <span style={s.sliderVal}>{base}</span>
        </label>
      </div>

      <div style={s.layout}>
        {/* Left: equation list */}
        <div style={s.eqList}>
          {addends.map((a) => (
            <EquationRow
              key={a}
              base={base}
              addend={a}
              isHighlighted={a === selected}
              onClick={() => setSelected(a)}
            />
          ))}
        </div>

        {/* Right: visualization */}
        <div style={s.vizPanel}>
          <div style={s.vizCard}>
            <div style={s.vizTitle}>
              {base} + {selected} = {sum}
            </div>

            <Dots count={base} color="#888" label={`${base}`} />
            <div style={s.plusSign}>+</div>
            <Dots count={selected} color={COLORS[selected % COLORS.length]} label={`${selected}`} />
            <div style={s.equalsSign}>=</div>
            <Dots count={sum} color="var(--color-accent)" label={`${sum}`} />
          </div>

          {/* Pattern insight */}
          <div style={s.insight}>
            <div style={s.insightTitle}>The pattern</div>
            <p style={s.insightText}>
              When you add <strong>1 more</strong> to the second number,
              the answer also goes up by <strong>1</strong>.
            </p>
            {selected > 1 && (
              <p style={s.insightExample}>
                {base}+{selected - 1}={base + selected - 1} &rarr; {base}+{selected}={sum}{' '}
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>(+1)</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ——— styles ——— */

const s = {
  controls: {
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  slider: {
    width: 120,
    accentColor: 'var(--color-accent)',
  },
  sliderVal: {
    fontWeight: 700,
    fontSize: '1.1rem',
    minWidth: 24,
    textAlign: 'center',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '2rem',
    alignItems: 'start',
  },
  eqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  eqRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: '2px solid transparent',
    background: '#fff',
    fontSize: '1.15rem',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  eqRowActive: {
    borderColor: 'var(--color-accent)',
    background: 'var(--color-accent-light)',
    boxShadow: 'var(--shadow-sm)',
  },
  eqNum: {
    fontWeight: 700,
    minWidth: 22,
    textAlign: 'center',
  },
  eqOp: {
    color: 'var(--color-muted)',
    fontWeight: 400,
  },
  eqSum: {
    fontWeight: 700,
    color: 'var(--color-accent)',
    minWidth: 22,
    textAlign: 'center',
  },
  vizPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  vizCard: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-md)',
  },
  vizTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '1.25rem',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
  dotsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  dotsLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    minWidth: 24,
    textAlign: 'right',
  },
  dotsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    animation: 'popIn 0.3s ease both',
  },
  plusSign: {
    textAlign: 'center',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    margin: '0.25rem 0',
  },
  equalsSign: {
    textAlign: 'center',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    margin: '0.25rem 0',
  },
  insight: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    border: '2px solid var(--color-success)',
    borderStyle: 'dashed',
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
    marginBottom: '0.4rem',
  },
  insightExample: {
    fontSize: '1rem',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    background: '#f5f5f3',
    padding: '0.4rem 0.75rem',
    borderRadius: 8,
    display: 'inline-block',
  },
}
