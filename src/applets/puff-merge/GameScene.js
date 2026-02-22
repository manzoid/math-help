import Phaser from 'phaser'
import { canReachTarget } from './generator.js'

const COLOR_LIST = [
  0xFFB3BA,  // pink
  0xFFD9B3,  // peach
  0xFFFAB3,  // yellow
  0xB3FFB8,  // mint
  0xB3E5FF,  // sky
  0xCEB3FF,  // lavender
  0xFFB3F0,  // pink-purple
  0xB3FFF6,  // teal
  0xFFCCB3,  // salmon
]
const GATE_W = 55  // width of gate wall on right edge

function radiusFor(v) { return Math.min(Math.max(36, 14 + v * 6), 110) }
function colorFor(v) { return COLOR_LIST[(v - 1) % COLOR_LIST.length] }

// Stable per-value pseudo-random (0–1)
function seeded(n) {
  const x = Math.sin(n + 1) * 10000
  return x - Math.floor(x)
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    this.puffs = []
    this.won = false
    this._currentTarget = null
    this._gateX = 0
    this._gateY = 0
    this._onCorrect = null
    this._onReset = null
    this._hintTimer = null
    this._hintOverlay = null
    this._hintTargetPuff = null
    this._hintTween = null
    this._autoResetTimer = null
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create() {
    this.won = false
    this._onCorrect = this.game.registry.get('onCorrect') ?? (() => {})
    this._onReset   = this.game.registry.get('onReset')   ?? (() => {})

    const W = this.scale.width
    const H = this.scale.height
    this.physics.world.setBounds(0, 0, W - GATE_W, H)

    this._drawBackground()

    const problem = this.game.registry.get('currentProblem')
    if (problem) {
      this.loadProblem(problem)
    }
  }

  update(time, delta) {
    if (this.won) return

    // Decrement merge cooldowns
    for (const p of this.puffs) {
      if (p._mergeCooldown > 0) p._mergeCooldown = Math.max(0, p._mergeCooldown - delta)
    }

    // Hint overlay tracks its target puff
    if (this._hintOverlay && this._hintTargetPuff?.active) {
      this._hintOverlay.setPosition(
        this._hintTargetPuff.x,
        this._hintTargetPuff.y - this._hintTargetPuff._r - 14,
      )
    }

    this._checkMerges()
    this._updateFaces()
    this._checkGateSquish()
  }

  // ── Problem loading ────────────────────────────────────────────────────────

  loadProblem({ target, puffs }) {
    this.won = false
    this._clearHint()

    for (const p of this.puffs) p.destroy()
    this.puffs = []

    this._currentTarget = target

    const W = this.scale.width
    const H = this.scale.height
    const playW = W - GATE_W

    this._drawGate(target)

    const spreadOut = puffs.length >= 5
    puffs.forEach((value, i) => {
      const pos = spreadOut
        ? this._edgeSpawnPos(i, puffs.length, playW, H)
        : this._centerSpawnPos(i, puffs.length, playW, H)
      this._spawnPuff(value, pos.x, pos.y)
    })

    // Give newly-spawned puffs time to drift apart before merges are checked
    this.puffs.forEach(p => { p._mergeCooldown = 1400 })

    this.time.delayedCall(100, () => this._checkWin())
  }

  // ── Spawn positions ───────────────────────────────────────────────────────

  _centerSpawnPos(i, total, playW, H) {
    const angle = (i / total) * Math.PI * 2
    const dist = 55 + Math.random() * 35
    return {
      x: playW / 2 + Math.cos(angle) * dist,
      y: H / 2 + Math.sin(angle) * dist,
    }
  }

  _edgeSpawnPos(i, total, playW, H) {
    const m = 80
    const corners = [
      { x: m,         y: m },
      { x: playW - m, y: m },
      { x: playW - m, y: H - m },
      { x: m,         y: H - m },
      { x: playW / 2, y: m + 20 },
      { x: playW / 2, y: H - m - 20 },
    ]
    const base = corners[i % corners.length]
    return {
      x: base.x + (Math.random() - 0.5) * 40,
      y: base.y + (Math.random() - 0.5) * 40,
    }
  }

  // ── Blob shape ────────────────────────────────────────────────────────────

  _buildBlobPoints(r, value) {
    const N = 10
    let pts = []
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2
      const jitter = seeded(value * 31 + i) * 0.24 - 0.12
      pts.push({ x: Math.cos(angle) * r * (1 + jitter), y: Math.sin(angle) * r * (1 + jitter) })
    }
    // Chaikin corner-cutting: 3 passes → 10→20→40→80 smooth points
    for (let pass = 0; pass < 3; pass++) {
      const next = []
      const len = pts.length
      for (let i = 0; i < len; i++) {
        const p0 = pts[i]
        const p1 = pts[(i + 1) % len]
        next.push(
          { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
          { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y },
        )
      }
      pts = next
    }
    return pts.map(p => new Phaser.Math.Vector2(p.x, p.y))
  }

  // ── Puff creation ─────────────────────────────────────────────────────────

  _spawnPuff(value, x, y, fromScale = 1.0, parentData = null) {
    const r = radiusFor(value)
    const color = colorFor(value)
    const blobPts = this._buildBlobPoints(r, value)

    const container = this.add.container(x, y).setDepth(4)
    container._value = value
    container._r = r
    container._merging = false
    container._dragging = false
    container._squishing = false
    container._lookAngle = 0
    container._parents = parentData
    container._mergeCooldown = 0

    // ── Body graphics (drawn once) ──
    const bodyGfx = this.add.graphics()

    // 1. Main blob fill
    bodyGfx.fillStyle(color, 1)
    bodyGfx.fillPoints(blobPts, true)

    // 2. Lighter highlight glob top-left (fakes radial gradient)
    bodyGfx.fillStyle(0xFFFFFF, 0.30)
    bodyGfx.fillCircle(-r * 0.20, -r * 0.28, r * 0.42)
    bodyGfx.fillStyle(0xFFFFFF, 0.14)
    bodyGfx.fillCircle(-r * 0.15, -r * 0.22, r * 0.62)

    // 3. Darker shadow bottom-right
    bodyGfx.fillStyle(0x000000, 0.07)
    bodyGfx.fillCircle(r * 0.18, r * 0.28, r * 0.55)

    // 4. Thick off-white/cream outline — gives the pillowy LocoRoco feel
    bodyGfx.lineStyle(Math.max(2.5, r * 0.09), 0xFFF5E0, 0.88)
    bodyGfx.strokePoints(blobPts, true)

    container.add(bodyGfx)

    // ── Number label ──
    const label = this.add.text(0, r * 0.24, String(value), {
      fontSize: `${Math.max(16, Math.round(r * 0.82))}px`,
      fontStyle: 'bold',
      color: '#3D2014',
      fontFamily: 'system-ui, sans-serif',
      stroke: '#FFFFFF',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5)
    container.add(label)

    // ── Face graphics (redrawn each frame for look-at) ──
    const faceGfx = this.add.graphics()
    container.add(faceGfx)
    container.faceGfx = faceGfx
    this._drawFace(faceGfx, r, 0, 0)

    // ── Physics ──
    this.physics.world.enable(container)
    const body = container.body
    body.setCircle(r, -r, -r)
    body.setBounce(0.6)
    body.setCollideWorldBounds(true)
    body.setDrag(25)
    body.setVelocity(
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80
    )

    // ── Interaction ──
    container.setSize(r * 2, r * 2)
    container.setInteractive()
    this.input.setDraggable(container)
    this._setupDrag(container)
    this._setupShake(container)

    // ── Wobble / Pop-in ──
    if (fromScale !== 1.0) {
      container.setScale(fromScale)
      this.tweens.add({
        targets: container,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 380,
        ease: 'Back.easeOut',
        onComplete: () => {
          container._wobbleTween = this._startWobble(container)
        },
      })
    } else {
      container._wobbleTween = this._startWobble(container)
    }

    this.puffs.push(container)
    return container
  }

  // ── Face drawing with look-at ─────────────────────────────────────────────

  _drawFace(gfx, r, lookDx, lookDy) {
    gfx.clear()

    const eyeOffX = r * 0.22
    const eyeY = -r * 0.14
    const maxShift = r * 0.08

    // Eye whites
    gfx.fillStyle(0xFFFFFF, 0.95)
    gfx.fillEllipse(-eyeOffX, eyeY, r * 0.24, r * 0.30)
    gfx.fillEllipse(eyeOffX, eyeY, r * 0.24, r * 0.30)

    // Pupils (shifted by look direction)
    const px = lookDx * maxShift
    const py = lookDy * maxShift
    const pupilR = r * 0.10
    gfx.fillStyle(0x221100, 0.88)
    gfx.fillCircle(-eyeOffX + px, eyeY + py, pupilR)
    gfx.fillCircle(eyeOffX + px, eyeY + py, pupilR)

    // Glints (fixed — they're the light source, not the gaze)
    gfx.fillStyle(0xFFFFFF, 0.92)
    gfx.fillCircle(-eyeOffX - r * 0.04, eyeY - r * 0.06, r * 0.035)
    gfx.fillCircle(eyeOffX - r * 0.04, eyeY - r * 0.06, r * 0.035)

    // Smile (skip for tiny puffs)
    if (r >= 26) {
      gfx.lineStyle(Math.max(1.5, r * 0.07), 0x332211, 0.50)
      gfx.beginPath()
      gfx.arc(0, r * 0.08, r * 0.20, 0.18 * Math.PI, 0.82 * Math.PI, false)
      gfx.strokePath()
    }
  }

  // ── Update: look-at ───────────────────────────────────────────────────────

  _updateFaces() {
    const pointer = this.input.activePointer

    for (const puff of this.puffs) {
      if (!puff.faceGfx || puff._merging) continue

      let targetX = pointer.worldX
      let targetY = pointer.worldY

      if (!pointer.isDown) {
        let minDist = Infinity
        for (const other of this.puffs) {
          if (other === puff) continue
          const d = Phaser.Math.Distance.Between(puff.x, puff.y, other.x, other.y)
          if (d < minDist) {
            minDist = d
            targetX = other.x
            targetY = other.y
          }
        }
      }

      const targetAngle = Math.atan2(targetY - puff.y, targetX - puff.x)
      const tdx = Math.cos(targetAngle)
      const tdy = Math.sin(targetAngle)
      if (puff._lookDx === undefined) { puff._lookDx = tdx; puff._lookDy = tdy }
      puff._lookDx = puff._lookDx * 0.93 + tdx * 0.07
      puff._lookDy = puff._lookDy * 0.93 + tdy * 0.07

      this._drawFace(puff.faceGfx, puff._r, puff._lookDx, puff._lookDy)
    }
  }

  // ── Gate squish (comedic wall bounce) ─────────────────────────────────────

  _checkGateSquish() {
    for (const p of this.puffs) {
      if (p._squishing || p._merging || p._dragging) continue
      if (!p.body?.blocked?.right) continue
      if (p._value === this._currentTarget) continue  // target puff handled by win

      this._squishAgainstGate(p)
    }
  }

  _squishAgainstGate(puff) {
    puff._squishing = true
    if (puff._wobbleTween) puff._wobbleTween.stop()

    this.tweens.add({
      targets: puff,
      scaleX: 0.72,
      scaleY: 1.28,
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        puff._squishing = false
        puff.setScale(1.0)
        puff._wobbleTween = this._startWobble(puff)
      },
    })
  }

  // ── Wobble & drag ─────────────────────────────────────────────────────────

  _startWobble(container) {
    const dur = 700 + Math.random() * 300
    return this.tweens.add({
      targets: container,
      scaleX: 1.06,
      scaleY: 0.94,
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  _setupDrag(container) {
    let lastX = 0, lastY = 0

    container.on('dragstart', (_ptr, dragX, dragY) => {
      container._dragging = true
      container.body.setVelocity(0, 0)
      if (container._wobbleTween) { container._wobbleTween.stop() }
      this.tweens.add({ targets: container, scaleX: 1.10, scaleY: 0.90, duration: 100, ease: 'Quad.easeOut' })
      lastX = dragX; lastY = dragY
    })

    container.on('drag', (_ptr, dragX, dragY) => {
      container.body.reset(dragX, dragY)
      container._dragVx = (dragX - lastX) * 8
      container._dragVy = (dragY - lastY) * 8
      lastX = dragX; lastY = dragY
    })

    container.on('dragend', () => {
      container._dragging = false
      const vx = Phaser.Math.Clamp(container._dragVx || 0, -260, 260)
      const vy = Phaser.Math.Clamp(container._dragVy || 0, -260, 260)
      container.body.setVelocity(vx, vy)
      this.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 220, ease: 'Back.easeOut' })
      container._wobbleTween = this._startWobble(container)
    })
  }

  // ── Tap to undo ───────────────────────────────────────────────────────────

  _setupShake(container) {
    let downX = 0, downY = 0
    container.on('pointerdown', (ptr) => { downX = ptr.x; downY = ptr.y })
    container.on('pointerup', (ptr) => {
      const dx = ptr.x - downX
      const dy = ptr.y - downY
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        this._triggerShake(container)
      }
    })
  }

  _triggerShake(puff) {
    if (puff._parents === null) {
      // Original puff — exaggerated wobble only, no split
      if (puff._wobbleTween) puff._wobbleTween.stop()
      this.tweens.add({
        targets: puff,
        scaleX: 1.25, scaleY: 0.78,
        duration: 80,
        yoyo: true, repeat: 2,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          puff._wobbleTween = this._startWobble(puff)
        },
      })
    } else {
      this._splitPuff(puff)
    }
  }

  _splitPuff(puff) {
    if (puff._merging) return
    puff._merging = true
    if (puff._wobbleTween) puff._wobbleTween.stop()

    const { a, b } = puff._parents
    const rA = radiusFor(a.value)
    const rB = radiusFor(b.value)
    const sep = (rA + rB) * 0.7
    const angle = Math.random() * Math.PI * 2
    const cx = puff.x
    const cy = puff.y

    this.tweens.add({
      targets: puff,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.puffs = this.puffs.filter(p => p !== puff)
        puff.destroy()

        const childA = this._spawnPuff(
          a.value,
          cx + Math.cos(angle) * sep / 2,
          cy + Math.sin(angle) * sep / 2,
          0.1,
          a.parents,
        )
        const childB = this._spawnPuff(
          b.value,
          cx - Math.cos(angle) * sep / 2,
          cy - Math.sin(angle) * sep / 2,
          0.1,
          b.parents,
        )
        childA._mergeCooldown = 400
        childB._mergeCooldown = 400

        this.time.delayedCall(450, () => this._checkSolvable())
      },
    })
  }

  // ── Merge detection ───────────────────────────────────────────────────────

  _checkMerges() {
    const ps = this.puffs
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j]
        if (a._merging || b._merging || a._dragging || b._dragging) continue
        if (a._mergeCooldown > 0 || b._mergeCooldown > 0) continue
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
        if (dist < (a._r + b._r) * 0.78) {
          this._mergePuffs(a, b)
          return
        }
      }
    }
  }

  _mergePuffs(a, b) {
    a._merging = true
    b._merging = true
    if (a._wobbleTween) a._wobbleTween.stop()
    if (b._wobbleTween) b._wobbleTween.stop()

    const newVal = a._value + b._value
    const larger = a._r >= b._r ? a : b
    const smaller = a._r >= b._r ? b : a
    const mergeX = larger.x
    const mergeY = larger.y

    // Record merge history so the result can be split back
    const parentData = {
      a: { value: a._value, parents: a._parents },
      b: { value: b._value, parents: b._parents },
    }

    this.tweens.add({
      targets: smaller,
      x: mergeX, y: mergeY,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.puffs = this.puffs.filter(p => p !== a && p !== b)
        smaller.destroy()
        larger.destroy()

        // Oversized puffs are not punished — they bounce off the gate naturally
        this._spawnPuff(newVal, mergeX, mergeY, 0.1, parentData)
        this._emitParticles(mergeX, mergeY, colorFor(newVal))

        this.time.delayedCall(400, () => {
          this._checkWin()
          if (!this.won) this._checkSolvable()
        })
      },
    })
  }

  // ── Solvability & hint ────────────────────────────────────────────────────

  _checkSolvable() {
    const values = this.puffs.filter(p => !p._merging).map(p => p._value)
    if (canReachTarget(values, this._currentTarget)) {
      this._clearHint()
    } else {
      const oversized = this.puffs.find(p => !p._merging && p._value > this._currentTarget)
      this._showHint(oversized ?? this.puffs.find(p => !p._merging))
      this._scheduleAutoReset()
    }
  }

  _showHint(puff) {
    this._clearHint()
    if (!puff) return

    this._hintTargetPuff = puff
    this._hintOverlay = this.add.text(
      puff.x,
      puff.y - puff._r - 14,
      '↔',
      {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#FF7722',
        fontFamily: 'system-ui, sans-serif',
        stroke: '#FFFFFF',
        strokeThickness: 4,
      },
    ).setOrigin(0.5, 1).setDepth(10)

    this._hintTween = this.tweens.add({
      targets: this._hintOverlay,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  _clearHint() {
    if (this._hintTween) { this._hintTween.stop(); this._hintTween = null }
    if (this._hintOverlay) { this._hintOverlay.destroy(); this._hintOverlay = null }
    this._hintTargetPuff = null
    if (this._autoResetTimer) { this._autoResetTimer.remove(); this._autoResetTimer = null }
  }

  _scheduleAutoReset() {
    if (this._autoResetTimer) this._autoResetTimer.remove()
    this._autoResetTimer = this.time.delayedCall(8000, () => this._onReset())
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  _emitParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const speed = 55 + Math.random() * 65
      const pr = 4 + Math.random() * 5
      const gfx = this.add.graphics().setDepth(4)
      gfx.fillStyle(color, 0.9)
      gfx.fillCircle(0, 0, pr)
      gfx.setPosition(x, y)
      this.tweens.add({
        targets: gfx,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 480 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => gfx.destroy(),
      })
    }
  }

  // ── Win check ─────────────────────────────────────────────────────────────

  _checkWin() {
    const winner = this.puffs.find(p => p._value === this._currentTarget)
    if (!winner) return

    this.won = true
    this._clearHint()
    if (winner._wobbleTween) winner._wobbleTween.stop()
    winner.body.setVelocity(0, 0)
    winner.body.setCollideWorldBounds(false)
    winner._merging = true

    // 1. Celebration pulse
    this.tweens.add({
      targets: winner,
      scaleX: 1.35, scaleY: 1.35,
      duration: 160, yoyo: true, repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // 2. Travel to gate entrance
        this.tweens.add({
          targets: winner,
          x: this._gateX - winner._r - 4,
          y: this._gateY,
          duration: 520,
          ease: 'Quad.easeInOut',
          onComplete: () => {
            // 3. Squeeze into gate
            this.tweens.add({
              targets: winner,
              scaleX: 0.25,
              scaleY: 1.15,
              alpha: 0,
              duration: 340,
              ease: 'Quad.easeIn',
              onComplete: () => {
                winner.destroy()
                this.puffs = this.puffs.filter(p => p !== winner)
                this._emitParticles(this._gateX, this._gateY, colorFor(this._currentTarget))
                // Win fires immediately — no 3s wait, no Next button
                this._onCorrect()
              },
            })
          },
        })
      },
    })
  }

  // ── Background ────────────────────────────────────────────────────────────

  _drawBackground() {
    if (this._bgGfx) this._bgGfx.destroy()
    const W = this.scale.width
    const H = this.scale.height
    const playW = W - GATE_W

    const bg = this.add.graphics().setDepth(0)
    this._bgGfx = bg

    // Rolling hills
    const hillPts = [
      { x: 0, y: H },
      { x: 0,          y: H * 0.82 },
      { x: playW * 0.10, y: H * 0.76 },
      { x: playW * 0.26, y: H * 0.80 },
      { x: playW * 0.44, y: H * 0.73 },
      { x: playW * 0.62, y: H * 0.78 },
      { x: playW * 0.80, y: H * 0.71 },
      { x: playW * 0.92, y: H * 0.74 },
      { x: playW,        y: H * 0.72 },
      { x: playW,        y: H },
    ]
    bg.fillStyle(0xA8D880, 1)
    bg.fillPoints(hillPts, true)

    // Ground band
    bg.fillStyle(0x88BB66, 1)
    bg.fillRect(0, H * 0.86, playW, H * 0.14)

    // Decorative background flowers
    const flowers = [
      { x: playW * 0.08, y: H * 0.82 },
      { x: playW * 0.23, y: H * 0.79 },
      { x: playW * 0.51, y: H * 0.76 },
      { x: playW * 0.70, y: H * 0.80 },
      { x: playW * 0.86, y: H * 0.74 },
    ]
    for (const { x, y } of flowers) {
      bg.fillStyle(0xFFE060, 0.85)
      bg.fillCircle(x, y, 4)
      bg.fillStyle(0xFFFFFF, 0.7)
      bg.fillCircle(x, y, 2)
      bg.fillStyle(0x55AA33, 0.9)
      bg.fillRect(x - 0.5, y + 2, 1, 6)
    }
  }

  // ── Gate ──────────────────────────────────────────────────────────────────

  _drawGate(targetValue) {
    if (this._gateGfx) this._gateGfx.destroy()
    if (this._gateGlowGfx) this._gateGlowGfx.destroy()

    const W = this.scale.width
    const H = this.scale.height
    const wallX = W - GATE_W
    const r = radiusFor(targetValue)
    const gateGap = r * 2 + 10
    const gateMidY = H * 0.42
    const gateTop = gateMidY - gateGap / 2
    const gateBot = gateMidY + gateGap / 2

    // Golden glow visible through opening (behind puffs)
    this._gateGlowGfx = this.add.graphics().setDepth(1)
    this._gateGlowGfx.fillStyle(0xFFF0AA, 0.6)
    this._gateGlowGfx.fillRect(wallX, gateTop, GATE_W, gateGap)

    // Gate wall (in front of background, behind puffs)
    this._gateGfx = this.add.graphics().setDepth(2)

    const wallColor = 0xA09070
    const wallLight = 0xC8B488
    const wallDark  = 0x78664E
    const grassColor = 0x88CC55

    // Top wall section
    this._gateGfx.fillStyle(wallColor, 1)
    this._gateGfx.fillRect(wallX, 0, GATE_W, gateTop)

    // Bottom wall section
    this._gateGfx.fillRect(wallX, gateBot, GATE_W, H - gateBot)

    // Left edge highlight (light strip)
    this._gateGfx.fillStyle(wallLight, 0.65)
    this._gateGfx.fillRect(wallX, 0, 4, gateTop)
    this._gateGfx.fillRect(wallX, gateBot, 4, H - gateBot)

    // Right edge shadow
    this._gateGfx.fillStyle(wallDark, 0.4)
    this._gateGfx.fillRect(wallX + GATE_W - 3, 0, 3, gateTop)
    this._gateGfx.fillRect(wallX + GATE_W - 3, gateBot, 3, H - gateBot)

    // Grass on top
    this._gateGfx.fillStyle(grassColor, 1)
    this._gateGfx.fillRect(wallX, 0, GATE_W, 7)

    // Arch outline at top of opening (decorative semicircle)
    const archR = GATE_W / 2
    const archCX = wallX + GATE_W / 2
    const archCY = gateTop
    this._gateGfx.lineStyle(3, wallDark, 0.7)
    this._gateGfx.beginPath()
    this._gateGfx.arc(archCX, archCY, archR, Math.PI, 0, true)
    this._gateGfx.strokePath()

    // Cap edges of opening
    this._gateGfx.fillStyle(wallColor, 1)
    this._gateGfx.fillRect(wallX, gateTop - 2, GATE_W, 2)
    this._gateGfx.fillRect(wallX, gateBot, GATE_W, 2)

    // Target circle silhouette inside opening
    this._gateGfx.lineStyle(2, colorFor(targetValue), 0.55)
    this._gateGfx.strokeCircle(wallX + GATE_W / 2, gateMidY, r)

    // N dots along the inner arc — visual count of the target
    const dotColor = colorFor(targetValue)
    this._gateGfx.fillStyle(dotColor, 0.75)
    for (let i = 0; i < targetValue; i++) {
      const angle = Math.PI - (i / Math.max(targetValue - 1, 1)) * Math.PI
      this._gateGfx.fillCircle(
        archCX + Math.cos(angle) * archR,
        archCY + Math.sin(angle) * archR,
        3.5,
      )
    }

    this._gateX = wallX + GATE_W / 2
    this._gateY = gateMidY
  }
}
