import { useState } from 'react'

const ADDEND_COLOR = '#ff9500'
const SUM_COLOR = 'var(--color-accent)'

function NumberTrack({ value, max, color, label }) {
  const pct = ((value - 1) / (max - 1)) * 100
  return (
    <div style={s.track}>
      <div style={s.trackLabel}>{label}</div>
      <div style={s.trackBar}>
        {/* tick marks */}
        {Array.from({ length: max }, (_, i) => {
          const tickPct = (i / (max - 1)) * 100
          return (
            <div
              key={i}
              style={{
                ...s.tick,
                left: `${tickPct}%`,
              }}
            >
              <div style={s.tickLine} />
              <div style={s.tickNum}>{i + 1}</div>
            </div>
          )
        })}
        {/* filled portion */}
        <div
          style={{
            ...s.trackFill,
            width: `${pct}%`,
            background: color,
          }}
        />
        {/* marker */}
        <div
          style={{
            ...s.marker,
            left: `${pct}%`,
            background: color,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function DotBar({ count, color, maxCount }) {
  return (
    <div style={s.dotBar}>
      {Array.from({ length: maxCount }, (_, i) => (
        <div
          key={i}
          style={{
            ...s.dot,
            background: i < count ? color : '#e8e8e6',
            transform: i < count ? 'scale(1)' : 'scale(0.6)',
            opacity: i < count ? 1 : 0.35,
            transition: 'all 0.2s ease',
          }}
        />
      ))}
    </div>
  )
}

export default function AdditionLockstep() {
  const [base, setBase] = useState(5)
  const [addend, setAddend] = useState(3)

  const sum = base + addend
  const maxAddend = 12
  const maxSum = base + maxAddend

  return (
    <div>
      {/* Base control */}
      <div style={s.controls}>
        <label style={s.label}>
          First number:
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

      {/* Big equation */}
      <div style={s.equation}>
        <span style={s.eqBase}>{base}</span>
        <span style={s.eqOp}> + </span>
        <span style={{ ...s.eqAddend, color: ADDEND_COLOR }}>{addend}</span>
        <span style={s.eqOp}> = </span>
        <span style={{ ...s.eqSum, color: SUM_COLOR }}>{sum}</span>
      </div>

      {/* Main slider for addend */}
      <div style={s.sliderSection}>
        <div style={s.sliderLabel}>
          Slide the second number up and down:
        </div>
        <div style={s.bigSliderRow}>
          <span style={{ ...s.bigSliderEnd, color: ADDEND_COLOR }}>1</span>
          <input
            type="range"
            min={1}
            max={maxAddend}
            value={addend}
            onChange={(e) => setAddend(Number(e.target.value))}
            style={{
              ...s.bigSlider,
              '--thumb-color': ADDEND_COLOR,
            }}
          />
          <span style={{ ...s.bigSliderEnd, color: ADDEND_COLOR }}>{maxAddend}</span>
        </div>
      </div>

      {/* Parallel tracks showing lockstep */}
      <div style={s.tracksCard}>
        <NumberTrack
          value={addend}
          max={maxAddend}
          color={ADDEND_COLOR}
          label="Second number"
        />
        <div style={s.tracksDivider}>
          <div style={s.arrowDown}>&#x2195;</div>
          <span style={s.tracksHint}>moves together</span>
          <div style={s.arrowDown}>&#x2195;</div>
        </div>
        <NumberTrack
          value={sum}
          max={maxSum}
          color={SUM_COLOR}
          label="Sum"
        />
      </div>

      {/* Dot visualization */}
      <div style={s.dotsCard}>
        <div style={s.dotsSection}>
          <div style={s.dotsHeader}>Second number: {addend}</div>
          <DotBar count={addend} color={ADDEND_COLOR} maxCount={maxAddend} />
        </div>
        <div style={s.dotsSection}>
          <div style={s.dotsHeader}>Sum: {sum}</div>
          <DotBar count={sum} color={SUM_COLOR} maxCount={maxSum} />
        </div>
      </div>

      {/* Insight */}
      <div style={s.insight}>
        <div style={s.insightTitle}>The pattern</div>
        <p style={s.insightText}>
          Drag the slider and watch both tracks.
          When the second number goes <strong>up by 1</strong>,
          the sum goes <strong>up by 1</strong>.
          When it goes <strong>down by 1</strong>,
          the sum goes <strong>down by 1</strong>.
          They always move together!
        </p>
      </div>
    </div>
  )
}

/* ——— styles ——— */

const s = {
  controls: {
    marginBottom: '1.25rem',
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

  /* equation */
  equation: {
    textAlign: 'center',
    fontSize: '2.4rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginBottom: '1.5rem',
    letterSpacing: '-0.02em',
  },
  eqBase: {},
  eqOp: { color: 'var(--color-muted)', fontWeight: 400 },
  eqAddend: { fontWeight: 700 },
  eqSum: { fontWeight: 700 },

  /* big slider */
  sliderSection: {
    marginBottom: '1.75rem',
  },
  sliderLabel: {
    fontSize: '0.95rem',
    fontWeight: 500,
    marginBottom: '0.5rem',
    color: 'var(--color-muted)',
  },
  bigSliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  bigSlider: {
    flex: 1,
    height: 8,
  },
  bigSliderEnd: {
    fontWeight: 700,
    fontSize: '1rem',
    minWidth: 24,
    textAlign: 'center',
  },

  /* parallel tracks */
  tracksCard: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.5rem 1.5rem 1rem',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '1.25rem',
  },
  track: {
    marginBottom: '0.25rem',
  },
  trackLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-muted)',
    marginBottom: '0.5rem',
  },
  trackBar: {
    position: 'relative',
    height: 40,
    background: '#f0f0ee',
    borderRadius: 6,
    overflow: 'visible',
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 6,
    opacity: 0.2,
    transition: 'width 0.2s ease',
  },
  tick: {
    position: 'absolute',
    top: 0,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
  },
  tickLine: {
    width: 1,
    height: '60%',
    background: '#ddd',
  },
  tickNum: {
    fontSize: '0.6rem',
    color: '#aaa',
    marginTop: 2,
  },
  marker: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    transition: 'left 0.2s ease',
    zIndex: 2,
  },
  tracksDivider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    color: 'var(--color-muted)',
    fontSize: '0.8rem',
  },
  arrowDown: {
    fontSize: '1rem',
  },
  tracksHint: {
    fontWeight: 500,
    fontStyle: 'italic',
  },

  /* dot bars */
  dotsCard: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1.25rem 1.5rem',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  dotsSection: {},
  dotsHeader: {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-muted)',
    marginBottom: '0.4rem',
  },
  dotBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
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
