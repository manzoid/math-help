import { useState, useEffect, useRef, useCallback } from 'react'
import Matter from 'matter-js'

const {
  Engine, Render, Runner, Bodies, Body, Composite, Constraint,
  Mouse, MouseConstraint, Events,
} = Matter

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX_WEIGHTS = 12

const CANVAS_W = 560
const CANVAS_H = 460

const WEIGHT_R = 9
const TRAY_INNER_W = 80
const TRAY_WALL_H = 50
const TRAY_WALL_THICK = 5
const TRAY_FLOOR_THICK = 6

/* ---- collision categories ---- */
const CAT_WEIGHT = 0x0002
const CAT_TRAY   = 0x0004
const CAT_STATIC = 0x0008

/* ---- helpers ---- */

function weightColor(label) {
  if (label === 'a') return A_COLOR
  if (label === 'b') return B_COLOR
  if (label === 'sum') return SUM_COLOR
  return '#999'
}

function countWeightsInTray(engine, trayLabel) {
  return Composite.allBodies(engine.world).filter(
    (b) => b.label === 'weight' && b.trayGroup === trayLabel
  ).length
}

/**
 * Build a tray as a single compound body (floor + 2 walls).
 * Compound bodies in matter-js keep their parts rigidly together.
 */
function createTray(x, y, color) {
  const hw = TRAY_INNER_W / 2

  // Parts are positioned absolutely, then combined
  const floor = Bodies.rectangle(x, y, TRAY_INNER_W + TRAY_WALL_THICK * 2, TRAY_FLOOR_THICK, {
    render: { fillStyle: color, opacity: 0.35, strokeStyle: color, lineWidth: 1.5 },
  })
  const wallL = Bodies.rectangle(
    x - hw - TRAY_WALL_THICK / 2, y - TRAY_WALL_H / 2,
    TRAY_WALL_THICK, TRAY_WALL_H,
    { render: { fillStyle: color, opacity: 0.2 } },
  )
  const wallR = Bodies.rectangle(
    x + hw + TRAY_WALL_THICK / 2, y - TRAY_WALL_H / 2,
    TRAY_WALL_THICK, TRAY_WALL_H,
    { render: { fillStyle: color, opacity: 0.2 } },
  )

  const compound = Body.create({
    parts: [floor, wallL, wallR],
    friction: 0.8,
    restitution: 0.1,
    density: 0.001,
    collisionFilter: { category: CAT_TRAY, mask: CAT_WEIGHT | CAT_STATIC },
    label: 'tray',
  })

  return compound
}

/* ---- Create a weight body ---- */
function createWeight(x, y, trayGroup) {
  return Bodies.circle(x, y, WEIGHT_R, {
    restitution: 0.15,
    friction: 0.5,
    frictionAir: 0.01,
    density: 0.003,
    render: {
      fillStyle: weightColor(trayGroup),
      strokeStyle: '#fff',
      lineWidth: 1.5,
    },
    collisionFilter: { category: CAT_WEIGHT, mask: CAT_WEIGHT | CAT_TRAY | CAT_STATIC },
    label: 'weight',
    trayGroup,
  })
}

/* Which tray region does a point fall into? */
function trayAtPoint(x, y, trayBodies) {
  for (const [label, tray] of Object.entries(trayBodies)) {
    const tx = tray.position.x
    const ty = tray.position.y
    if (
      x > tx - TRAY_INNER_W / 2 - 20 &&
      x < tx + TRAY_INNER_W / 2 + 20 &&
      y > ty - 100 &&
      y < ty + 30
    ) {
      return label
    }
  }
  return null
}

/* ===================== main component ===================== */

export default function AdditionBalance() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const trayBodiesRef = useRef({})
  const beamRef = useRef(null)

  const [counts, setCounts] = useState({ a: 3, b: 2, sum: 5 })
  const countsInterval = useRef(null)

  const syncCounts = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const a = countWeightsInTray(engine, 'a')
    const b = countWeightsInTray(engine, 'b')
    const sum = countWeightsInTray(engine, 'sum')
    setCounts((prev) => {
      if (prev.a === a && prev.b === b && prev.sum === sum) return prev
      return { a, b, sum }
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* ---- engine ---- */
    const engine = Engine.create({ gravity: { x: 0, y: 1.0 } })
    engineRef.current = engine
    const world = engine.world

    /* ---- renderer ---- */
    const pr = window.devicePixelRatio || 1
    const render = Render.create({
      canvas,
      engine,
      options: {
        width: CANVAS_W,
        height: CANVAS_H,
        wireframes: false,
        background: 'transparent',
        pixelRatio: pr,
      },
    })
    renderRef.current = render

    /* ---- layout ---- */
    const pivotX = CANVAS_W / 2
    const pivotY = 90
    const postH = 180
    const baseW = 100
    const baseH = 12

    /* static base & post (decorative, no collision) */
    const base = Bodies.rectangle(pivotX, pivotY + postH + baseH / 2, baseW, baseH, {
      isStatic: true,
      render: { fillStyle: '#888' },
      collisionFilter: { category: 0, mask: 0 },
    })
    const post = Bodies.rectangle(pivotX, pivotY + postH / 2, 6, postH, {
      isStatic: true,
      render: { fillStyle: '#999' },
      collisionFilter: { category: 0, mask: 0 },
    })

    /* ---- beam ---- */
    const beamHalf = 170   // half-length
    const beamThick = 7
    const beam = Bodies.rectangle(pivotX, pivotY, beamHalf * 2, beamThick, {
      density: 0.002,
      friction: 0.5,
      render: { fillStyle: '#666' },
      collisionFilter: { category: 0, mask: 0 }, // beam doesn't collide with anything
    })
    beamRef.current = beam

    const pivotConstraint = Constraint.create({
      pointA: { x: pivotX, y: pivotY },
      bodyB: beam,
      pointB: { x: 0, y: 0 },
      stiffness: 1,
      length: 0,
      render: { visible: false },
    })

    /* ---- tray positions (relative to beam center) ---- */
    // Left side: tray A (outer) and tray B (inner)
    // Right side: tray Sum
    const attachA = -beamHalf * 0.85   // -144.5
    const attachB = -beamHalf * 0.35   // -59.5
    const attachS = beamHalf * 0.85    // +144.5

    const chainLen = 90

    // Create trays at their initial dangling positions
    const trayABody = createTray(pivotX + attachA, pivotY + chainLen, A_COLOR)
    const trayBBody = createTray(pivotX + attachB, pivotY + chainLen, B_COLOR)
    const traySBody = createTray(pivotX + attachS, pivotY + chainLen, SUM_COLOR)

    trayBodiesRef.current = { a: trayABody, b: trayBBody, sum: traySBody }

    /* ---- chain constraints (beam → tray) ---- */
    function makeChain(beamOffsetX, trayBody) {
      // Two-point attachment for stability (left and right of tray top)
      const spread = TRAY_INNER_W / 3
      const c1 = Constraint.create({
        bodyA: beam,
        pointA: { x: beamOffsetX - spread / 2, y: beamThick / 2 },
        bodyB: trayBody,
        pointB: { x: -spread / 2, y: -TRAY_WALL_H / 2 },
        stiffness: 0.8,
        damping: 0.1,
        length: chainLen - TRAY_WALL_H / 2,
        render: { strokeStyle: '#bbb', lineWidth: 1.5 },
      })
      const c2 = Constraint.create({
        bodyA: beam,
        pointA: { x: beamOffsetX + spread / 2, y: beamThick / 2 },
        bodyB: trayBody,
        pointB: { x: spread / 2, y: -TRAY_WALL_H / 2 },
        stiffness: 0.8,
        damping: 0.1,
        length: chainLen - TRAY_WALL_H / 2,
        render: { strokeStyle: '#bbb', lineWidth: 1.5 },
      })
      return [c1, c2]
    }

    const chainsA = makeChain(attachA, trayABody)
    const chainsB = makeChain(attachB, trayBBody)
    const chainsS = makeChain(attachS, traySBody)

    /* ---- boundaries ---- */
    const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H + 25, CANVAS_W + 100, 50, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })
    const wallL = Bodies.rectangle(-15, CANVAS_H / 2, 30, CANVAS_H * 2, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })
    const wallR = Bodies.rectangle(CANVAS_W + 15, CANVAS_H / 2, 30, CANVAS_H * 2, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })

    /* ---- add to world ---- */
    Composite.add(world, [
      base, post, beam, pivotConstraint,
      trayABody, trayBBody, traySBody,
      ...chainsA, ...chainsB, ...chainsS,
      floor, wallL, wallR,
    ])

    /* ---- initial weights (staggered drop to settle nicely) ---- */
    const initialWeights = [
      { group: 'a', count: 3, tray: trayABody },
      { group: 'b', count: 2, tray: trayBBody },
      { group: 'sum', count: 5, tray: traySBody },
    ]
    for (const { group, count, tray } of initialWeights) {
      for (let i = 0; i < count; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = tray.position.x + (col - 0.5) * (WEIGHT_R * 2.4)
        const y = tray.position.y - TRAY_FLOOR_THICK / 2 - WEIGHT_R - 2 - row * (WEIGHT_R * 2.2)
        Composite.add(world, createWeight(x, y, group))
      }
    }

    /* ---- mouse ---- */
    const mouse = Mouse.create(canvas)
    mouse.pixelRatio = pr

    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.4,
        damping: 0.15,
        render: { visible: false },
      },
      collisionFilter: { mask: CAT_WEIGHT },
    })
    Composite.add(world, mouseConstraint)
    render.mouse = mouse

    /* ---- supply zone click: spawn a new weight ---- */
    Events.on(mouseConstraint, 'mousedown', (e) => {
      const { x, y } = e.mouse.position
      if (y > CANVAS_H - 60 && !mouseConstraint.body) {
        const allWeights = Composite.allBodies(world).filter((b) => b.label === 'weight')
        if (allWeights.length < MAX_WEIGHTS * 3) {
          const w = createWeight(x, y, 'supply')
          Composite.add(world, w)
        }
      }
    })

    /* ---- on drop: assign to tray or remove ---- */
    Events.on(mouseConstraint, 'enddrag', (ev) => {
      const body = ev.body
      if (!body || body.label !== 'weight') return
      const { x, y } = body.position
      const tray = trayAtPoint(x, y, trayBodiesRef.current)

      if (tray) {
        body.trayGroup = tray
        body.render.fillStyle = weightColor(tray)
      } else {
        // dropped outside any tray — remove
        Composite.remove(world, body)
      }
    })

    /* ---- per-frame: clamp beam angle + damping ---- */
    Events.on(engine, 'beforeUpdate', () => {
      const maxAngle = 0.35
      if (beam.angle > maxAngle) {
        Body.setAngle(beam, maxAngle)
        Body.setAngularVelocity(beam, Math.min(beam.angularVelocity, 0))
      }
      if (beam.angle < -maxAngle) {
        Body.setAngle(beam, -maxAngle)
        Body.setAngularVelocity(beam, Math.max(beam.angularVelocity, 0))
      }

      // Angular damping for gentle settling
      Body.setAngularVelocity(beam, beam.angularVelocity * 0.97)

      // Clean up weights that somehow escape
      for (const b of Composite.allBodies(world)) {
        if (b.label === 'weight' && (b.position.y > CANVAS_H + 80 || b.position.x < -50 || b.position.x > CANVAS_W + 50)) {
          Composite.remove(world, b)
        }
      }
    })

    /* ---- custom drawing overlays ---- */
    Events.on(render, 'afterRender', () => {
      const ctx = render.context
      ctx.save()
      ctx.scale(pr, pr)

      // Pivot triangle
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY - 12)
      ctx.lineTo(pivotX - 9, pivotY + 5)
      ctx.lineTo(pivotX + 9, pivotY + 5)
      ctx.closePath()
      ctx.fillStyle = '#777'
      ctx.fill()

      // Tray labels
      const trays = [
        { body: trayABody, label: 'A', color: A_COLOR },
        { body: trayBBody, label: 'B', color: B_COLOR },
        { body: traySBody, label: 'Sum', color: SUM_COLOR },
      ]
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      for (const t of trays) {
        ctx.fillStyle = t.color
        ctx.fillText(t.label, t.body.position.x, t.body.position.y + TRAY_FLOOR_THICK + 16)
      }

      // Supply area
      const supplyTop = CANVAS_H - 52
      ctx.fillStyle = '#f5f5f3'
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(24, supplyTop, CANVAS_W - 48, 46, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#bbb'
      ctx.font = '500 10px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('SUPPLY — click to grab a weight, drag onto a tray', CANVAS_W / 2, supplyTop + 14)

      // Supply circles
      const supplyCircleY = CANVAS_H - 22
      const supplyCount = 7
      const startX = CANVAS_W / 2 - (supplyCount - 1) * (WEIGHT_R * 2.4) / 2
      for (let i = 0; i < supplyCount; i++) {
        const cx = startX + i * (WEIGHT_R * 2.4)
        ctx.beginPath()
        ctx.arc(cx, supplyCircleY, WEIGHT_R, 0, Math.PI * 2)
        ctx.fillStyle = '#999'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      ctx.restore()
    })

    /* ---- run ---- */
    const runner = Runner.create()
    runnerRef.current = runner
    Runner.run(runner, engine)
    Render.run(render)

    countsInterval.current = setInterval(syncCounts, 100)

    return () => {
      clearInterval(countsInterval.current)
      Render.stop(render)
      Runner.stop(runner)
      Engine.clear(engine)
      render.canvas = null
      render.context = null
      render.textures = {}
    }
  }, [syncCounts])

  const leftTotal = counts.a + counts.b
  const balanced = leftTotal === counts.sum
  const IMBALANCE_BG = 'rgba(255, 59, 48, 0.08)'
  const IMBALANCE_BORDER = 'rgba(255, 59, 48, 0.25)'

  const handleReset = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const world = engine.world

    const weights = Composite.allBodies(world).filter((b) => b.label === 'weight')
    for (const w of weights) Composite.remove(world, w)

    const trays = trayBodiesRef.current
    const defaults = { a: 3, b: 2, sum: 5 }
    for (const [group, count] of Object.entries(defaults)) {
      const tray = trays[group]
      for (let i = 0; i < count; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = tray.position.x + (col - 0.5) * (WEIGHT_R * 2.4)
        const y = tray.position.y - TRAY_FLOOR_THICK / 2 - WEIGHT_R - 2 - row * (WEIGHT_R * 2.2)
        Composite.add(world, createWeight(x, y, group))
      }
    }
  }, [])

  return (
    <div style={s.root}>
      <div style={s.hint}>
        Click the supply area to grab a weight, then drag it onto any tray.
        Drag weights between trays or off-tray to remove them.
      </div>

      {/* Equation */}
      <div
        style={{
          ...s.equation,
          background: balanced ? 'transparent' : IMBALANCE_BG,
          border: balanced ? '2px solid transparent' : `2px solid ${IMBALANCE_BORDER}`,
        }}
      >
        <span style={{ color: A_COLOR }}>{counts.a}</span>
        <span style={s.eqOp}> + </span>
        <span style={{ color: B_COLOR }}>{counts.b}</span>
        <span style={s.eqOp}> {balanced ? '=' : '\u2260'} </span>
        <span style={{ color: balanced ? SUM_COLOR : '#e04040' }}>{counts.sum}</span>
        {!balanced && (
          <span style={s.eqHint}>
            {leftTotal > counts.sum ? ' (left heavier)' : ' (right heavier)'}
          </span>
        )}
        {balanced && (
          <span style={{ ...s.eqHint, color: SUM_COLOR }}> Balanced!</span>
        )}
      </div>

      {/* Physics canvas */}
      <div style={s.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W * (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)}
          height={CANVAS_H * (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)}
          style={s.canvas}
        />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button onClick={handleReset} style={s.resetBtn}>Reset weights</button>
      </div>

      {/* Insight */}
      <div style={s.insight}>
        <div style={s.insightTitle}>The pattern</div>
        <p style={s.insightText}>
          The left side holds <strong style={{ color: A_COLOR }}>{counts.a}</strong>
          {' + '}
          <strong style={{ color: B_COLOR }}>{counts.b}</strong>
          {' = '}
          <strong>{leftTotal}</strong> total weights.
          {balanced ? (
            <>
              {' '}The right side also holds <strong style={{ color: SUM_COLOR }}>{counts.sum}</strong>,
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
  canvasWrap: {
    width: '100%',
    maxWidth: CANVAS_W,
    margin: '0 auto 0.75rem',
    position: 'relative',
    aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
    touchAction: 'none',
    cursor: 'default',
  },
  resetBtn: {
    background: 'var(--color-accent-light, #e8edff)',
    color: 'var(--color-accent, #4a6cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.5rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
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
