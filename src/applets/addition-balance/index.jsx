import { useState, useEffect, useRef, useCallback } from 'react'
import Matter from 'matter-js'

const {
  Engine, Render, Runner, Bodies, Body, Composite, Constraint,
  Mouse, MouseConstraint, Events, Vector,
} = Matter

const A_COLOR = '#4a6cf7'
const B_COLOR = '#ff9500'
const SUM_COLOR = '#34c759'
const MAX_WEIGHTS = 12

const CANVAS_W = 620
const CANVAS_H = 500

/* ---- category bit masks for collision filtering ---- */
const CAT_WEIGHT = 0x0002
const CAT_TRAY   = 0x0004
const CAT_WALL   = 0x0008
const CAT_BEAM   = 0x0010

const WEIGHT_R = 10
const TRAY_WALL_THICK = 4
const TRAY_INNER_W = 90
const TRAY_FLOOR_THICK = 6

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

/* Which tray does a point fall into (based on tray floor body positions)? */
function trayAtPoint(engine, x, y, trayFloors) {
  for (const [label, floor] of Object.entries(trayFloors)) {
    const fx = floor.position.x
    const fy = floor.position.y
    if (
      x > fx - TRAY_INNER_W / 2 - 15 &&
      x < fx + TRAY_INNER_W / 2 + 15 &&
      y > fy - 120 &&
      y < fy + 20
    ) {
      return label
    }
  }
  return null
}

/* ---- Build a single tray (floor + 2 walls) as a compound-ish group ---- */
function createTray(x, y, color) {
  const hw = TRAY_INNER_W / 2

  const floor = Bodies.rectangle(x, y, TRAY_INNER_W + TRAY_WALL_THICK * 2, TRAY_FLOOR_THICK, {
    isStatic: false,
    render: { fillStyle: color, opacity: 0.3, strokeStyle: color, lineWidth: 1 },
    collisionFilter: { category: CAT_TRAY, mask: CAT_WEIGHT },
    label: 'trayFloor',
  })

  const wallL = Bodies.rectangle(x - hw - TRAY_WALL_THICK / 2, y - 30, TRAY_WALL_THICK, 60, {
    isStatic: false,
    render: { fillStyle: color, opacity: 0.25 },
    collisionFilter: { category: CAT_WALL, mask: CAT_WEIGHT },
    label: 'trayWall',
  })

  const wallR = Bodies.rectangle(x + hw + TRAY_WALL_THICK / 2, y - 30, TRAY_WALL_THICK, 60, {
    isStatic: false,
    render: { fillStyle: color, opacity: 0.25 },
    collisionFilter: { category: CAT_WALL, mask: CAT_WEIGHT },
    label: 'trayWall',
  })

  // Constrain walls to floor so they move together
  const cL = Constraint.create({
    bodyA: floor,
    pointA: { x: -hw - TRAY_WALL_THICK / 2, y: -30 },
    bodyB: wallL,
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
    render: { visible: false },
  })
  const cR = Constraint.create({
    bodyA: floor,
    pointA: { x: hw + TRAY_WALL_THICK / 2, y: -30 },
    bodyB: wallR,
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
    render: { visible: false },
  })

  // Keep walls upright relative to floor
  const cL2 = Constraint.create({
    bodyA: floor,
    pointA: { x: -hw - TRAY_WALL_THICK / 2, y: -60 },
    bodyB: wallL,
    pointB: { x: 0, y: -30 },
    stiffness: 1,
    length: 0,
    render: { visible: false },
  })
  const cR2 = Constraint.create({
    bodyA: floor,
    pointA: { x: hw + TRAY_WALL_THICK / 2, y: -60 },
    bodyB: wallR,
    pointB: { x: 0, y: -30 },
    stiffness: 1,
    length: 0,
    render: { visible: false },
  })

  return { floor, wallL, wallR, constraints: [cL, cR, cL2, cR2] }
}

/* ---- Create a weight body ---- */
function createWeight(x, y, trayGroup) {
  return Bodies.circle(x, y, WEIGHT_R, {
    restitution: 0.25,
    friction: 0.6,
    frictionAir: 0.02,
    density: 0.004,
    render: {
      fillStyle: weightColor(trayGroup),
      strokeStyle: '#fff',
      lineWidth: 1.5,
    },
    collisionFilter: { category: CAT_WEIGHT, mask: CAT_WEIGHT | CAT_TRAY | CAT_WALL },
    label: 'weight',
    trayGroup,
  })
}

/* ===================== main component ===================== */

export default function AdditionBalance() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const trayFloorsRef = useRef({})
  const beamRef = useRef(null)

  // Track counts for equation display
  const [counts, setCounts] = useState({ a: 3, b: 2, sum: 5 })
  const countsInterval = useRef(null)

  /* Sync counts from physics world */
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
    const engine = Engine.create({
      gravity: { x: 0, y: 1.2 },
    })
    engineRef.current = engine
    const world = engine.world

    /* ---- renderer ---- */
    const render = Render.create({
      canvas,
      engine,
      options: {
        width: CANVAS_W,
        height: CANVAS_H,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1,
      },
    })
    renderRef.current = render

    /* ---- static structure: base & post ---- */
    const pivotX = CANVAS_W / 2
    const pivotY = 110
    const postH = 200
    const baseW = 120
    const baseH = 14

    const base = Bodies.rectangle(pivotX, pivotY + postH + baseH / 2, baseW, baseH, {
      isStatic: true,
      render: { fillStyle: '#888' },
      collisionFilter: { category: 0, mask: 0 },
      label: 'base',
    })

    const post = Bodies.rectangle(pivotX, pivotY + postH / 2, 6, postH, {
      isStatic: true,
      render: { fillStyle: '#999' },
      collisionFilter: { category: 0, mask: 0 },
      label: 'post',
    })

    /* ---- beam ---- */
    const beamLen = 440
    const beamThick = 8
    const beam = Bodies.rectangle(pivotX, pivotY, beamLen, beamThick, {
      density: 0.005,
      friction: 0.8,
      render: { fillStyle: '#666' },
      collisionFilter: { category: CAT_BEAM, mask: 0 },
      label: 'beam',
    })
    beamRef.current = beam

    // Pivot constraint - beam rotates around this point
    const pivot = Constraint.create({
      pointA: { x: pivotX, y: pivotY },
      bodyB: beam,
      pointB: { x: 0, y: 0 },
      stiffness: 1,
      length: 0,
      render: { visible: false },
    })

    /* ---- trays ---- */
    const chainLen = 100
    const trayAx = pivotX - beamLen * 0.40
    const trayBx = pivotX - beamLen * 0.15
    const traySx = pivotX + beamLen * 0.38
    const trayY = pivotY + chainLen

    const trayA = createTray(trayAx, trayY, A_COLOR)
    const trayB = createTray(trayBx, trayY, B_COLOR)
    const trayS = createTray(traySx, trayY, SUM_COLOR)

    trayFloorsRef.current = { a: trayA.floor, b: trayB.floor, sum: trayS.floor }

    // Chains: connect beam endpoints to tray floors
    function chainConstraint(beamOffsetX, trayFloor) {
      return Constraint.create({
        bodyA: beam,
        pointA: { x: beamOffsetX, y: beamThick / 2 },
        bodyB: trayFloor,
        pointB: { x: 0, y: -TRAY_FLOOR_THICK / 2 },
        stiffness: 0.95,
        damping: 0.05,
        length: chainLen - TRAY_FLOOR_THICK / 2,
        render: {
          strokeStyle: '#bbb',
          lineWidth: 1.5,
          type: 'line',
        },
        label: 'chain',
      })
    }

    const chainA = chainConstraint(-beamLen * 0.40, trayA.floor)
    const chainB = chainConstraint(-beamLen * 0.15, trayB.floor)
    const chainS = chainConstraint(beamLen * 0.38, trayS.floor)

    /* ---- supply zone (floor boundary) ---- */
    const supplyFloor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H + 20, CANVAS_W + 100, 50, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_TRAY, mask: CAT_WEIGHT },
      label: 'supplyFloor',
    })

    /* ---- invisible side walls ---- */
    const wallLeft = Bodies.rectangle(-15, CANVAS_H / 2, 30, CANVAS_H * 2, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_WALL, mask: CAT_WEIGHT | CAT_TRAY },
    })
    const wallRight = Bodies.rectangle(CANVAS_W + 15, CANVAS_H / 2, 30, CANVAS_H * 2, {
      isStatic: true,
      render: { visible: false },
      collisionFilter: { category: CAT_WALL, mask: CAT_WEIGHT | CAT_TRAY },
    })

    /* ---- add everything to world ---- */
    Composite.add(world, [
      base, post, beam, pivot,
      trayA.floor, trayA.wallL, trayA.wallR, ...trayA.constraints,
      trayB.floor, trayB.wallL, trayB.wallR, ...trayB.constraints,
      trayS.floor, trayS.wallL, trayS.wallR, ...trayS.constraints,
      chainA, chainB, chainS,
      supplyFloor, wallLeft, wallRight,
    ])

    /* ---- initial weights ---- */
    function addInitialWeights(trayGroup, count, trayFloor) {
      for (let i = 0; i < count; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = trayFloor.position.x + (col - 0.5) * (WEIGHT_R * 2.4)
        const y = trayFloor.position.y - TRAY_FLOOR_THICK - WEIGHT_R - 4 - row * (WEIGHT_R * 2 + 3)
        const w = createWeight(x, y, trayGroup)
        Composite.add(world, w)
      }
    }

    addInitialWeights('a', 3, trayA.floor)
    addInitialWeights('b', 2, trayB.floor)
    addInitialWeights('sum', 5, trayS.floor)

    /* ---- mouse interaction ---- */
    const mouse = Mouse.create(canvas)
    // Fix pixel ratio scaling
    mouse.pixelRatio = render.options.pixelRatio

    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.6,
        damping: 0.1,
        render: { visible: false },
      },
      collisionFilter: { mask: CAT_WEIGHT },
    })
    Composite.add(world, mouseConstraint)

    // Keep render's mouse in sync
    render.mouse = mouse

    /* ---- supply zone: create new weight on click in supply area ---- */
    const supplyY = CANVAS_H - 32
    const supplyStartX = CANVAS_W / 2 - 7 * (WEIGHT_R * 2.6) / 2

    Events.on(mouseConstraint, 'mousedown', (e) => {
      const { x, y } = e.mouse.position
      // Only create from supply area if not clicking an existing body
      if (y > CANVAS_H - 60 && !mouseConstraint.body) {
        const total = countWeightsInTray(engine, 'a') +
          countWeightsInTray(engine, 'b') +
          countWeightsInTray(engine, 'sum')
        if (total < MAX_WEIGHTS * 3) {
          const w = createWeight(x, y, 'supply')
          Composite.add(world, w)
        }
      }
    })

    /* ---- on drag end: assign weight to tray or remove it ---- */
    Events.on(mouseConstraint, 'enddrag', (ev) => {
      const body = ev.body
      if (!body || body.label !== 'weight') return

      const { x, y } = body.position
      const tray = trayAtPoint(engine, x, y, trayFloorsRef.current)

      if (tray) {
        body.trayGroup = tray
        body.render.fillStyle = weightColor(tray)
      } else if (y > CANVAS_H - 70) {
        // Dropped back in supply - remove it
        Composite.remove(world, body)
      } else {
        // Dropped in no-man's-land - remove
        Composite.remove(world, body)
      }
    })

    /* ---- angular damping on beam to prevent wild oscillation ---- */
    Events.on(engine, 'beforeUpdate', () => {
      // Limit beam angle to prevent flipping
      if (beam.angle > 0.45) Body.setAngle(beam, 0.45)
      if (beam.angle < -0.45) Body.setAngle(beam, -0.45)

      // Extra angular damping
      Body.setAngularVelocity(beam, beam.angularVelocity * 0.96)

      // Remove bodies that fall way off screen
      const allBodies = Composite.allBodies(world)
      for (const b of allBodies) {
        if (b.label === 'weight' && b.position.y > CANVAS_H + 100) {
          Composite.remove(world, b)
        }
      }
    })

    /* ---- custom afterRender for decorations ---- */
    Events.on(render, 'afterRender', () => {
      const ctx = render.context
      const pr = render.options.pixelRatio

      ctx.save()
      ctx.scale(pr, pr)

      // Draw pivot triangle
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY - 14)
      ctx.lineTo(pivotX - 10, pivotY + 5)
      ctx.lineTo(pivotX + 10, pivotY + 5)
      ctx.closePath()
      ctx.fillStyle = '#777'
      ctx.fill()

      // Draw tray labels
      const trays = [
        { floor: trayA.floor, label: 'A', color: A_COLOR },
        { floor: trayB.floor, label: 'B', color: B_COLOR },
        { floor: trayS.floor, label: 'Sum', color: SUM_COLOR },
      ]
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      for (const t of trays) {
        ctx.fillStyle = t.color
        ctx.fillText(t.label, t.floor.position.x, t.floor.position.y + 20)
      }

      // Draw supply area
      const sy = CANVAS_H - 56
      ctx.fillStyle = '#f5f5f3'
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(20, sy, CANVAS_W - 40, 50, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#bbb'
      ctx.font = '500 11px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('SUPPLY — click to grab a weight, drag onto a tray', CANVAS_W / 2, sy + 16)

      // Draw supply weight circles
      for (let i = 0; i < 7; i++) {
        const sx = supplyStartX + i * (WEIGHT_R * 2.6)
        const scy = supplyY
        ctx.beginPath()
        ctx.arc(sx, scy, WEIGHT_R, 0, Math.PI * 2)
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

    /* ---- periodically sync counts ---- */
    countsInterval.current = setInterval(syncCounts, 120)

    /* ---- cleanup ---- */
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

  /* ---- reset handler ---- */
  const handleReset = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const world = engine.world

    // Remove all weights
    const weights = Composite.allBodies(world).filter((b) => b.label === 'weight')
    for (const w of weights) Composite.remove(world, w)

    // Add back defaults
    const floors = trayFloorsRef.current
    const defaults = { a: 3, b: 2, sum: 5 }
    for (const [group, count] of Object.entries(defaults)) {
      const floor = floors[group]
      for (let i = 0; i < count; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = floor.position.x + (col - 0.5) * (WEIGHT_R * 2.4)
        const y = floor.position.y - TRAY_FLOOR_THICK - WEIGHT_R - 4 - row * (WEIGHT_R * 2 + 3)
        const w = createWeight(x, y, group)
        Composite.add(world, w)
      }
    }
  }, [])

  return (
    <div style={s.root}>
      <div style={s.hint}>
        Click the supply area to grab a weight, then drag it onto any tray.
        Drag weights between trays or off-tray to remove them.
      </div>

      {/* Big equation */}
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

      {/* Reset button */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button onClick={handleReset} style={s.resetBtn}>
          Reset weights
        </button>
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
