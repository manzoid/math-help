import { useEffect, useRef } from 'react'

/* ---- utils ---- */
function rnd(a, b) { return a + Math.random() * (b - a) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

const PASTEL = ['#ffb3c6','#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff']
const RAINBOW_COLS = ['#ff2222','#ff8800','#ffee00','#00cc44','#2255ff','#9900ff']

/* ---- strip white background from image, returns a canvas ---- */
function removeWhiteBG(img) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, c.width, c.height)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    if (r > 240 && g > 240 && b > 240) {
      d[i + 3] = 0
    } else if (r > 215 && g > 215 && b > 215) {
      // soft edge for anti-aliased pixels
      d[i + 3] = Math.round(d[i + 3] * (255 - Math.max(r, g, b)) / 40)
    }
  }
  ctx.putImageData(id, 0, 0)
  return c
}

/* ---- star particle ---- */
class Star {
  constructor(x, y, vx, vy, color, size) {
    this.x = x; this.y = y
    this.vx = vx; this.vy = vy
    this.color = color; this.size = size
    this.life = 1
    this.decay = rnd(0.010, 0.022)
    this.angle = rnd(0, Math.PI * 2)
    this.spin = rnd(-0.15, 0.15)
  }
  tick() {
    this.x += this.vx; this.y += this.vy
    this.vy += 0.18
    this.vx *= 0.97
    this.life -= this.decay
    this.angle += this.spin
  }
  draw(ctx) {
    const a = clamp(this.life, 0, 1)
    if (a <= 0) return
    const s = this.size * a
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = this.color
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const ao = (i * 4 * Math.PI / 5) - Math.PI / 2
      const ai = ao + Math.PI / 5
      ctx.lineTo(Math.cos(ao) * s, Math.sin(ao) * s)
      ctx.lineTo(Math.cos(ai) * s * 0.38, Math.sin(ai) * s * 0.38)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  get alive() { return this.life > 0 }
}

/* ---- fart cloud sprite ---- */
class Cloud {
  constructor(x, y, src, vx, vy) {
    this.x = x; this.y = y
    this.src = src
    this.vx = vx; this.vy = vy
    this.size = rnd(50, 80)
    this.life = 1
    this.decay = rnd(0.007, 0.013)
  }
  tick() {
    this.x += this.vx; this.y += this.vy
    this.vy *= 0.96; this.vx *= 0.97
    this.size *= 1.012
    this.life -= this.decay
  }
  draw(ctx) {
    const a = clamp(this.life * 0.85, 0, 1)
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha = a
    ctx.drawImage(this.src, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
    ctx.restore()
  }
  get alive() { return this.life > 0 }
}

/* ---- rainbow trail ---- */
class RainbowTrail {
  constructor() { this.pts = [] }
  push(x, y) {
    this.pts.push({ x, y })
    if (this.pts.length > 70) this.pts.shift()
  }
  draw(ctx) {
    if (this.pts.length < 3) return
    const sw = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let s = 0; s < RAINBOW_COLS.length; s++) {
      const offset = (s - (RAINBOW_COLS.length - 1) / 2) * sw
      ctx.beginPath()
      ctx.strokeStyle = RAINBOW_COLS[s]
      ctx.lineWidth = sw
      ctx.globalAlpha = 0.75
      for (let i = 0; i < this.pts.length; i++) {
        const { x, y } = this.pts[i]
        const fade = i / this.pts.length
        ctx.globalAlpha = fade * 0.75
        if (i === 0) ctx.moveTo(x, y + offset)
        else ctx.lineTo(x, y + offset)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

/* ================================================================
   VARIANT BUILDERS — each returns { update(t, ctx, uSrc, fSrc) → bool done }
   ================================================================ */

/* Unicorn gallops left→right, rainbow arc trailing behind */
function rainbowGallop(W, H) {
  const UH = Math.min(170, H * 0.32)
  const UW = UH
  const speed = (W + UW + 40) / 2.4
  const trail = new RainbowTrail()
  const stars = []
  let nextStar = 0

  return {
    update(t, ctx, uSrc) {
      const px = -UW - 20 + speed * t
      const py = H * 0.42 + Math.sin(t * 11) * 14
      trail.push(px + UW * 0.05, py + UH * 0.6)
      trail.draw(ctx)

      if (t > nextStar) {
        nextStar += 0.07
        for (let i = 0; i < 3; i++) {
          stars.push(new Star(
            px + rnd(0, UW * 0.2), py + rnd(UH * 0.1, UH * 0.9),
            rnd(-4, -0.5), rnd(-5, -1),
            PASTEL[Math.floor(Math.random() * PASTEL.length)], rnd(7, 15),
          ))
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        stars[i].tick(); stars[i].draw(ctx)
        if (!stars[i].alive) stars.splice(i, 1)
      }

      ctx.drawImage(uSrc, px, py, UW, UH)
      return px > W + 20
    },
  }
}

/* Unicorn trots right→left, farting pastel fireworks from its rear */
function fartFireworks(W, H) {
  const UH = Math.min(170, H * 0.32)
  const UW = UH
  const speed = (W + UW + 40) / 2.6
  const clouds = []
  const stars = []
  let nextFart = 0.35

  return {
    update(t, ctx, uSrc, fSrc) {
      const px = W + 20 - speed * t
      const py = H * 0.45 + Math.sin(t * 10) * 12

      if (t > nextFart && px > -UW) {
        nextFart += rnd(0.45, 0.75)
        // after mirroring, unicorn tail is at left edge of its bounding box
        const rx = px + UW * 0.12
        const ry = py + UH * 0.70
        clouds.push(new Cloud(rx, ry, fSrc, rnd(1, 3), rnd(-2.5, -0.8)))
        for (let i = 0; i < 30; i++) {
          const ang = rnd(-Math.PI * 0.5, Math.PI * 1.5) // upward cone
          const spd = rnd(2.5, 9)
          stars.push(new Star(rx, ry, Math.cos(ang) * spd, Math.sin(ang) * spd,
            PASTEL[Math.floor(Math.random() * PASTEL.length)], rnd(8, 17)))
        }
      }

      for (let i = clouds.length - 1; i >= 0; i--) {
        clouds[i].tick(); clouds[i].draw(ctx)
        if (!clouds[i].alive) clouds.splice(i, 1)
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        stars[i].tick(); stars[i].draw(ctx)
        if (!stars[i].alive) stars.splice(i, 1)
      }

      // mirrored unicorn faces left
      ctx.save()
      ctx.translate(px + UW, py)
      ctx.scale(-1, 1)
      ctx.drawImage(uSrc, 0, 0, UW, UH)
      ctx.restore()

      return px < -UW - 20
    },
  }
}

/* Unicorn swoops across screen in a sine arc, shedding rainbow glitter */
function glitterFly(W, H) {
  const UH = Math.min(155, H * 0.29)
  const UW = UH
  const speed = (W + UW + 40) / 3.0
  const stars = []
  let nextStar = 0

  return {
    update(t, ctx, uSrc) {
      const px = -UW - 20 + speed * t
      const prog = clamp(px / W, 0, 1)
      const py = H * 0.12 + Math.sin(prog * Math.PI * 2.5) * H * 0.3

      if (t > nextStar) {
        nextStar += 0.04
        for (let i = 0; i < 5; i++) {
          stars.push(new Star(
            px + rnd(UW * 0.05, UW * 0.3), py + rnd(UH * 0.1, UH * 0.9),
            rnd(-2, 2), rnd(-2, 2),
            RAINBOW_COLS[Math.floor(Math.random() * RAINBOW_COLS.length)], rnd(5, 13),
          ))
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        stars[i].tick(); stars[i].draw(ctx)
        if (!stars[i].alive) stars.splice(i, 1)
      }

      ctx.drawImage(uSrc, px, py, UW, UH)
      return px > W + 20
    },
  }
}

/* Two unicorns charge from opposite sides, collide in an explosion of stars */
function doubleTrouble(W, H) {
  const UH = Math.min(150, H * 0.28)
  const UW = UH
  const speed = (W / 2 + UW + 20) / 1.1
  let exploded = false
  const stars = []

  return {
    update(t, ctx, uSrc) {
      const px1 = -UW + speed * t
      const px2 = W - speed * t
      const py = H * 0.38 + Math.sin(t * 13) * 9

      if (!exploded && px1 + UW * 0.7 >= px2 + UW * 0.3) {
        exploded = true
        const mx = W / 2, my = py + UH / 2
        const allCols = [...PASTEL, ...RAINBOW_COLS]
        for (let i = 0; i < 70; i++) {
          const ang = rnd(0, Math.PI * 2)
          const spd = rnd(3, 14)
          stars.push(new Star(mx, my, Math.cos(ang) * spd, Math.sin(ang) * spd - 2,
            allCols[Math.floor(Math.random() * allCols.length)], rnd(9, 19)))
        }
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        stars[i].tick(); stars[i].draw(ctx)
        if (!stars[i].alive) stars.splice(i, 1)
      }

      if (px1 < W + UW) ctx.drawImage(uSrc, px1, py, UW, UH)
      if (px2 > -UW * 2) {
        ctx.save()
        ctx.translate(px2 + UW, py)
        ctx.scale(-1, 1)
        ctx.drawImage(uSrc, 0, 0, UW, UH)
        ctx.restore()
      }

      return exploded && stars.length === 0 && px1 > W + UW && px2 < -UW * 2
    },
  }
}

const MAKERS = [rainbowGallop, fartFireworks, glitterFly, doubleTrouble]

/* ================================================================
   COMPONENT
   ================================================================ */

export default function CelebrationOverlay({ onDone }) {
  const canvasRef = useRef(null)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    const maker = MAKERS[Math.floor(Math.random() * MAKERS.length)]
    let variant = null
    let rafId = null
    let startTime = null
    const killTimer = setTimeout(() => onDoneRef.current(), 6000)

    function loadImage(src) {
      return new Promise(resolve => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(img)
        img.src = src
        if (img.complete && img.naturalWidth) resolve(img)
      })
    }

    Promise.all([
      loadImage('/celebration/unicorn.png'),
      loadImage('/celebration/fart-cloud.png'),
    ]).then(([uImg, fImg]) => {
      const uSrc = removeWhiteBG(uImg)
      const fSrc = removeWhiteBG(fImg)
      variant = maker(W, H)
      startTime = performance.now()

      function frame(now) {
        const t = (now - startTime) / 1000
        ctx.clearRect(0, 0, W, H)
        const done = variant.update(t, ctx, uSrc, fSrc)
        if (done) { clearTimeout(killTimer); onDoneRef.current(); return }
        rafId = requestAnimationFrame(frame)
      }
      rafId = requestAnimationFrame(frame)
    })

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(killTimer)
    }
  }, [])

  return (
    <div
      onClick={() => onDoneRef.current()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'pointer' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
