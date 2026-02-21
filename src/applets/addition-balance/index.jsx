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

/* Reference width — all physics dimensions are designed at this size
   and then scaled proportionally to the actual container width. */
const BASE_W = 480
const ASPECT = BASE_W / 290
const MAX_CANVAS_W = 700

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

function createTray(x, y, color, d) {
  const hw = d.trayInnerW / 2
  const floor = Bodies.rectangle(x, y, d.trayInnerW + d.trayWallThick * 2, d.trayFloorThick, {
    render: { fillStyle: color, opacity: 0.35, strokeStyle: color, lineWidth: 1.5 },
  })
  const wallL = Bodies.rectangle(
    x - hw - d.trayWallThick / 2, y - d.trayWallH / 2,
    d.trayWallThick, d.trayWallH,
    { render: { fillStyle: color, opacity: 0.2 } },
  )
  const wallR = Bodies.rectangle(
    x + hw + d.trayWallThick / 2, y - d.trayWallH / 2,
    d.trayWallThick, d.trayWallH,
    { render: { fillStyle: color, opacity: 0.2 } },
  )
  return Body.create({
    parts: [floor, wallL, wallR],
    friction: 0.8,
    restitution: 0.1,
    density: 0.001,
    collisionFilter: { category: CAT_TRAY, mask: CAT_WEIGHT | CAT_STATIC },
    label: 'tray',
  })
}

function createWeight(x, y, trayGroup, weightR) {
  return Bodies.circle(x, y, weightR, {
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

/* ===================== main component ===================== */

export default function AdditionBalance() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const renderRef = useRef(null)
  const runnerRef = useRef(null)
  const trayBodiesRef = useRef({})
  const beamRef = useRef(null)
  const physDimsRef = useRef(null)  // current scaled dims (for reset)

  const [canvasW, setCanvasW] = useState(null)
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

  /* ---- measure container width ---- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = Math.round(Math.min(el.clientWidth, MAX_CANVAS_W))
      setCanvasW((prev) => (prev && Math.abs(prev - w) < 8) ? prev : w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---- physics world (rebuilds when container size changes) ---- */
  useEffect(() => {
    if (!canvasW) return
    const canvas = canvasRef.current
    if (!canvas) return

    const W = canvasW
    const H = Math.round(W / ASPECT)
    const sc = W / BASE_W

    // Scaled physics dimensions
    const d = {
      weightR: 8 * sc,
      trayInnerW: 70 * sc,
      trayWallH: 38 * sc,
      trayWallThick: 4 * sc,
      trayFloorThick: 5 * sc,
    }
    physDimsRef.current = d

    const pivotX = W / 2
    const pivotY = 38 * sc
    const postH = 105 * sc
    const beamHalf = 140 * sc
    const beamThick = 6 * sc
    const chainLen = 60 * sc

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
        width: W,
        height: H,
        wireframes: false,
        background: 'transparent',
        pixelRatio: pr,
      },
    })
    renderRef.current = render
    // Force canvas CSS to match container (matter-js may override)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    /* ---- static base & post ---- */
    const base = Bodies.rectangle(pivotX, pivotY + postH + 5 * sc, 80 * sc, 10 * sc, {
      isStatic: true,
      render: { fillStyle: '#888' },
      collisionFilter: { category: 0, mask: 0 },
    })
    const post = Bodies.rectangle(pivotX, pivotY + postH / 2, 6 * sc, postH, {
      isStatic: true,
      render: { fillStyle: '#999' },
      collisionFilter: { category: 0, mask: 0 },
    })

    /* ---- beam (static — angle driven by weight counts) ---- */
    const beam = Bodies.rectangle(pivotX, pivotY, beamHalf * 2, beamThick, {
      isStatic: true,
      render: { fillStyle: '#666' },
      collisionFilter: { category: 0, mask: 0 },
    })
    beamRef.current = beam

    /* ---- tray attachment points ---- */
    const attachA = -beamHalf * 0.85
    const attachB = -beamHalf * 0.32
    const attachS = beamHalf * 0.82

    const trayABody = createTray(pivotX + attachA, pivotY + chainLen, A_COLOR, d)
    const trayBBody = createTray(pivotX + attachB, pivotY + chainLen, B_COLOR, d)
    const traySBody = createTray(pivotX + attachS, pivotY + chainLen, SUM_COLOR, d)

    trayBodiesRef.current = { a: trayABody, b: trayBBody, sum: traySBody }

    /* ---- chain constraints (rendered manually, invisible to matter-js) ---- */
    const allChains = []
    function makeChain(beamOffsetX, trayBody) {
      const spread = d.trayInnerW / 3
      const c1 = Constraint.create({
        bodyA: beam,
        pointA: { x: beamOffsetX - spread / 2, y: beamThick / 2 },
        bodyB: trayBody,
        pointB: { x: -spread / 2, y: -d.trayWallH / 2 },
        stiffness: 1,
        length: chainLen - d.trayWallH / 2,
        render: { visible: false },
      })
      const c2 = Constraint.create({
        bodyA: beam,
        pointA: { x: beamOffsetX + spread / 2, y: beamThick / 2 },
        bodyB: trayBody,
        pointB: { x: spread / 2, y: -d.trayWallH / 2 },
        stiffness: 1,
        length: chainLen - d.trayWallH / 2,
        render: { visible: false },
      })
      allChains.push(c1, c2)
      return [c1, c2]
    }

    const chainsA = makeChain(attachA, trayABody)
    const chainsB = makeChain(attachB, trayBBody)
    const chainsS = makeChain(attachS, traySBody)

    /* ---- boundaries ---- */
    const floor = Bodies.rectangle(W / 2, H + 25, W + 100, 50, {
      isStatic: true, render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })
    const wallL = Bodies.rectangle(-15, H / 2, 30, H * 2, {
      isStatic: true, render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })
    const wallR = Bodies.rectangle(W + 15, H / 2, 30, H * 2, {
      isStatic: true, render: { visible: false },
      collisionFilter: { category: CAT_STATIC, mask: CAT_WEIGHT | CAT_TRAY },
    })

    /* ---- add to world ---- */
    Composite.add(world, [
      base, post, beam,
      trayABody, trayBBody, traySBody,
      ...chainsA, ...chainsB, ...chainsS,
      floor, wallL, wallR,
    ])

    /* ---- initial weights ---- */
    const initialWeights = [
      { group: 'a', count: 3, tray: trayABody },
      { group: 'b', count: 2, tray: trayBBody },
      { group: 'sum', count: 5, tray: traySBody },
    ]
    for (const { group, count, tray } of initialWeights) {
      for (let i = 0; i < count; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = tray.position.x + (col - 0.5) * (d.weightR * 2.4)
        const y = tray.position.y - d.trayFloorThick / 2 - d.weightR - 2 * sc - row * (d.weightR * 2.2)
        Composite.add(world, createWeight(x, y, group, d.weightR))
      }
    }

    /* ---- mouse / touch ---- */
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

    /* ---- supply zone click: spawn weight ---- */
    Events.on(mouseConstraint, 'mousedown', (e) => {
      const { x, y } = e.mouse.position
      if (y > H - 50 * sc && !mouseConstraint.body) {
        const allWeights = Composite.allBodies(world).filter((b) => b.label === 'weight')
        if (allWeights.length < MAX_WEIGHTS * 3) {
          Composite.add(world, createWeight(x, y, 'supply', d.weightR))
        }
      }
    })

    /* ---- on drop: assign to tray or remove ---- */
    Events.on(mouseConstraint, 'enddrag', (ev) => {
      const body = ev.body
      if (!body || body.label !== 'weight') return
      const { x, y } = body.position
      for (const [label, tray] of Object.entries(trayBodiesRef.current)) {
        const tx = tray.position.x
        const ty = tray.position.y
        if (
          x > tx - d.trayInnerW / 2 - 20 * sc &&
          x < tx + d.trayInnerW / 2 + 20 * sc &&
          y > ty - 100 * sc &&
          y < ty + 30 * sc
        ) {
          body.trayGroup = label
          body.render.fillStyle = weightColor(label)
          return
        }
      }
      Composite.remove(world, body)
    })

    /* ---- per-frame: drive beam angle from weight counts ---- */
    let beamAngleVel = 0
    Events.on(engine, 'beforeUpdate', () => {
      const aC = countWeightsInTray(engine, 'a')
      const bC = countWeightsInTray(engine, 'b')
      const sC = countWeightsInTray(engine, 'sum')
      const diff = (aC + bC) - sC
      const maxAngle = 0.28
      const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, diff * 0.055))

      const stiffness = 0.03
      const damping = 0.75
      beamAngleVel = beamAngleVel * damping + (targetAngle - beam.angle) * stiffness
      Body.setAngle(beam, beam.angle + beamAngleVel)

      for (const b of Composite.allBodies(world)) {
        if (b.label === 'weight' && (b.position.y > H + 80 || b.position.x < -50 || b.position.x > W + 50)) {
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
      ctx.moveTo(pivotX, pivotY - 12 * sc)
      ctx.lineTo(pivotX - 9 * sc, pivotY + 5 * sc)
      ctx.lineTo(pivotX + 9 * sc, pivotY + 5 * sc)
      ctx.closePath()
      ctx.fillStyle = '#777'
      ctx.fill()

      // Chain lines
      ctx.strokeStyle = '#bbb'
      ctx.lineWidth = Math.max(1, 1.5 * sc)
      ctx.setLineDash([4 * sc, 3 * sc])
      for (const c of allChains) {
        const pA = Constraint.pointAWorld(c)
        const pB = Constraint.pointBWorld(c)
        ctx.beginPath()
        ctx.moveTo(pA.x, pA.y)
        ctx.lineTo(pB.x, pB.y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Tray labels
      const trays = [
        { body: trayABody, label: 'A', color: A_COLOR },
        { body: trayBBody, label: 'B', color: B_COLOR },
        { body: traySBody, label: 'Sum', color: SUM_COLOR },
      ]
      ctx.font = `bold ${Math.round(11 * sc)}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      for (const t of trays) {
        ctx.fillStyle = t.color
        ctx.fillText(t.label, t.body.position.x, t.body.position.y + d.trayFloorThick + 16 * sc)
      }

      // Supply area
      const supplyTop = H - 42 * sc
      ctx.fillStyle = '#f5f5f3'
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(20 * sc, supplyTop, W - 40 * sc, 36 * sc, 6 * sc)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#bbb'
      ctx.font = `500 ${Math.round(9 * sc)}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('SUPPLY \u2014 tap to grab, drag onto a tray', W / 2, supplyTop + 10 * sc)

      const supplyCircleY = H - 18 * sc
      const supplyCount = 7
      const startX = W / 2 - (supplyCount - 1) * (d.weightR * 2.4) / 2
      for (let i = 0; i < supplyCount; i++) {
        const cx = startX + i * (d.weightR * 2.4)
        ctx.beginPath()
        ctx.arc(cx, supplyCircleY, d.weightR - sc, 0, Math.PI * 2)
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
  }, [canvasW, syncCounts])

  const canvasH = canvasW ? Math.round(canvasW / ASPECT) : 0
  const leftTotal = counts.a + counts.b
  const balanced = leftTotal === counts.sum
  const IMBALANCE_BG = 'rgba(255, 59, 48, 0.08)'
  const IMBALANCE_BORDER = 'rgba(255, 59, 48, 0.25)'

  const handleReset = useCallback(() => {
    const engine = engineRef.current
    const d = physDimsRef.current
    if (!engine || !d) return
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
        const x = tray.position.x + (col - 0.5) * (d.weightR * 2.4)
        const y = tray.position.y - d.trayFloorThick / 2 - d.weightR - 2 - row * (d.weightR * 2.2)
        Composite.add(world, createWeight(x, y, group, d.weightR))
      }
    }
  }, [])

  return (
    <div style={styles.root}>
      {/* Equation */}
      <div
        style={{
          ...styles.equation,
          background: balanced ? 'transparent' : IMBALANCE_BG,
          border: balanced ? '2px solid transparent' : `2px solid ${IMBALANCE_BORDER}`,
        }}
      >
        <span style={{ color: A_COLOR }}>{counts.a}</span>
        <span style={styles.eqOp}> + </span>
        <span style={{ color: B_COLOR }}>{counts.b}</span>
        <span style={styles.eqOp}> {balanced ? '=' : '\u2260'} </span>
        <span style={{ color: balanced ? SUM_COLOR : '#e04040' }}>{counts.sum}</span>
        {!balanced && (
          <span style={styles.eqHint}>
            {leftTotal > counts.sum ? ' (left heavier)' : ' (right heavier)'}
          </span>
        )}
        {balanced && (
          <span style={{ ...styles.eqHint, color: SUM_COLOR }}> Balanced!</span>
        )}
      </div>

      {/* Canvas wrapper — measured for responsive sizing */}
      <div ref={wrapRef} style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            touchAction: 'none',
            cursor: 'default',
            width: canvasW || '100%',
            height: canvasH || 'auto',
          }}
        />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
        <button onClick={handleReset} style={styles.resetBtn}>Reset weights</button>
      </div>

      {/* Insight */}
      <div style={styles.insight}>
        <div style={styles.insightTitle}>The pattern</div>
        <p style={styles.insightText}>
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

const styles = {
  root: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  equation: {
    textAlign: 'center',
    fontSize: '1.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginBottom: '0.15rem',
    letterSpacing: '-0.02em',
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius)',
    transition: 'background 0.3s, border-color 0.3s',
  },
  eqOp: { color: 'var(--color-muted)', fontWeight: 400 },
  eqHint: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--color-muted)',
    fontFamily: 'inherit',
  },
  canvasWrap: {
    width: '100%',
    maxWidth: MAX_CANVAS_W,
    margin: '0 auto 0.5rem',
  },
  resetBtn: {
    background: 'var(--color-accent-light, #e8edff)',
    color: 'var(--color-accent, #4a6cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.4rem 1.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  insight: {
    background: '#fff',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    border: '2px dashed var(--color-success)',
  },
  insightTitle: {
    fontWeight: 700,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-success)',
    marginBottom: '0.3rem',
  },
  insightText: {
    fontSize: '0.9rem',
    lineHeight: 1.45,
    margin: 0,
  },
}
