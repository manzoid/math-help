import Phaser from 'phaser'
import { LEVELS } from './levels.js'

// Pastel color palette, keyed by puff value 1–9
const COLORS = {
  1: 0xFFB3BA,  // pink
  2: 0xFFD9B3,  // peach
  3: 0xFFFAB3,  // yellow
  4: 0xB3FFB8,  // mint
  5: 0xB3E5FF,  // sky
  6: 0xCEB3FF,  // lavender
  7: 0xFFB3F0,  // pink-purple
  8: 0xB3FFF6,  // teal
  9: 0xFFCCB3,  // salmon
}

const COLOR_FALLBACK = 0xE0E0E0  // grey for values > 9

function radiusFor(v) {
  return 14 + v * 6  // v=1→20, v=9→68
}

function colorFor(v) {
  return COLORS[v] ?? COLOR_FALLBACK
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    this.puffs = []
    this.currentLevel = 0
    this.won = false
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    this.won = false

    // UI elements (persistent across level loads)
    this.levelText = this.add.text(12, 12, '', {
      fontSize: '14px',
      color: '#BBAA99',
      fontFamily: 'system-ui, sans-serif',
    }).setDepth(10)

    this.goalText = this.add.text(
      this.scale.width / 2, 16, '',
      {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#7A6655',
        fontFamily: 'system-ui, sans-serif',
      }
    ).setOrigin(0.5, 0).setDepth(10)

    this.nextBtn = this._makeNextBtn()
    this.nextBtn.setVisible(false)

    this.loadLevel(this.currentLevel)
  }

  update() {
    if (this.won) return
    this._checkMerges()
  }

  // ── Level Loading ─────────────────────────────────────────────────────────

  loadLevel(index) {
    this.won = false

    // Clean up previous puffs
    for (const p of this.puffs) p.destroy()
    this.puffs = []

    // Hide win UI
    this.nextBtn.setVisible(false)
    if (this._niceText) { this._niceText.destroy(); this._niceText = null }

    const level = LEVELS[index]
    const W = this.scale.width
    const H = this.scale.height

    this.levelText.setText(`Level ${index + 1} / ${LEVELS.length}`)
    this.goalText.setText(`Make ${level.target}`)

    const spreadOut = index >= 4  // levels 5–10 use corner/edge spawning

    level.puffs.forEach((value, i) => {
      const pos = spreadOut
        ? this._edgeSpawnPos(i, level.puffs.length, W, H)
        : this._centerSpawnPos(i, level.puffs.length, W, H)
      this._spawnPuff(value, pos.x, pos.y)
    })
  }

  _centerSpawnPos(i, total, W, H) {
    // Evenly spread around center with small offsets
    const angle = (i / total) * Math.PI * 2
    const dist = 60 + Math.random() * 30
    return {
      x: W / 2 + Math.cos(angle) * dist,
      y: H / 2 + Math.sin(angle) * dist,
    }
  }

  _edgeSpawnPos(i, total, W, H) {
    const margin = 80
    const corners = [
      { x: margin, y: margin },
      { x: W - margin, y: margin },
      { x: W - margin, y: H - margin },
      { x: margin, y: H - margin },
      { x: W / 2, y: margin + 20 },
      { x: W / 2, y: H - margin - 20 },
    ]
    const base = corners[i % corners.length]
    return {
      x: base.x + (Math.random() - 0.5) * 40,
      y: base.y + (Math.random() - 0.5) * 40,
    }
  }

  // ── Puff Creation ─────────────────────────────────────────────────────────

  _spawnPuff(value, x, y, fromScale = 1.0) {
    const r = radiusFor(value)
    const color = colorFor(value)

    const container = this.add.container(x, y)
    container._value = value
    container._r = r
    container._merging = false
    container._dragging = false

    // Draw circle
    const gfx = this.add.graphics()
    gfx.fillStyle(color, 1)
    gfx.fillCircle(0, 0, r)
    // Inner highlight
    gfx.fillStyle(0xFFFFFF, 0.15)
    gfx.fillCircle(-r * 0.2, -r * 0.25, r * 0.45)
    container.add(gfx)

    // Number label
    const label = this.add.text(0, 0, String(value), {
      fontSize: `${Math.round(r * 0.85)}px`,
      fontStyle: 'bold',
      color: '#FFFFFF',
      fontFamily: 'system-ui, sans-serif',
      stroke: '#00000033',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5)
    container.add(label)

    // Physics body
    this.physics.world.enable(container)
    const body = container.body
    body.setCircle(r, -r, -r)
    body.setBounce(0.65)
    body.setCollideWorldBounds(true)
    body.setDrag(20)
    // Give a gentle random initial nudge
    body.setVelocity(
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80
    )

    // Wobble tween
    container._wobbleTween = this._startWobble(container)

    // Drag input
    container.setSize(r * 2, r * 2)
    container.setInteractive()
    this.input.setDraggable(container)

    this._setupDrag(container)

    // Pop-in scale if spawned from merge
    if (fromScale !== 1.0) {
      container.setScale(fromScale)
      this.tweens.add({
        targets: container,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 350,
        ease: 'Back.easeOut',
      })
    }

    this.puffs.push(container)
    return container
  }

  _startWobble(container) {
    const dur = 700 + Math.random() * 300
    return this.tweens.add({
      targets: container,
      scaleX: 1.05,
      scaleY: 0.95,
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
      if (container._wobbleTween) {
        container._wobbleTween.stop()
        container.setScale(1.0)
      }
      lastX = dragX
      lastY = dragY
    })

    container.on('drag', (_ptr, dragX, dragY) => {
      const dx = dragX - lastX
      const dy = dragY - lastY
      container.body.reset(dragX, dragY)
      lastX = dragX
      lastY = dragY
      // Store velocity direction for release
      container._dragVx = dx * 8
      container._dragVy = dy * 8
    })

    container.on('dragend', () => {
      container._dragging = false
      // Impart gentle release velocity
      const vx = Phaser.Math.Clamp(container._dragVx || 0, -250, 250)
      const vy = Phaser.Math.Clamp(container._dragVy || 0, -250, 250)
      container.body.setVelocity(vx, vy)
      // Restart wobble
      container._wobbleTween = this._startWobble(container)
    })
  }

  // ── Merge Detection ───────────────────────────────────────────────────────

  _checkMerges() {
    const ps = this.puffs
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]
        const b = ps[j]
        if (a._merging || b._merging || a._dragging || b._dragging) continue

        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
        const threshold = (a._r + b._r) * 0.8

        if (dist < threshold) {
          this._mergePuffs(a, b)
          return  // only one merge per frame
        }
      }
    }
  }

  _mergePuffs(a, b) {
    const level = LEVELS[this.currentLevel]
    a._merging = true
    b._merging = true

    // Stop wobble on both
    if (a._wobbleTween) a._wobbleTween.stop()
    if (b._wobbleTween) b._wobbleTween.stop()

    const newVal = a._value + b._value
    const larger = a._r >= b._r ? a : b
    const smaller = a._r >= b._r ? b : a
    const mergeX = larger.x
    const mergeY = larger.y

    // Tween smaller toward larger, then destroy both
    this.tweens.add({
      targets: smaller,
      x: mergeX,
      y: mergeY,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Remove both from puffs array
        this.puffs = this.puffs.filter(p => p !== a && p !== b)
        smaller.destroy()
        larger.destroy()

        if (newVal > level.target) {
          // Overshoot: flash red briefly then reload
          this._showOvershoot(mergeX, mergeY, newVal, () => {
            this.time.delayedCall(900, () => this.loadLevel(this.currentLevel))
          })
        } else {
          // Spawn new merged puff with pop animation
          const newPuff = this._spawnPuff(newVal, mergeX, mergeY, 0.1)
          this._emitParticles(mergeX, mergeY, colorFor(newVal))

          // Check win after pop animation finishes
          this.time.delayedCall(400, () => this._checkWin())
        }
      },
    })
  }

  // ── Overshoot Feedback ────────────────────────────────────────────────────

  _showOvershoot(x, y, val, onDone) {
    // Flash a red "too big" puff then fade out
    const r = radiusFor(val)
    const gfx = this.add.graphics()
    gfx.fillStyle(0xFF4444, 0.85)
    gfx.fillCircle(x, y, r)
    const label = this.add.text(x, y, String(val), {
      fontSize: `${Math.round(r * 0.85)}px`,
      fontStyle: 'bold',
      color: '#FFFFFF',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5, 0.5)

    this.tweens.add({
      targets: [gfx, label],
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        gfx.destroy()
        label.destroy()
        onDone()
      },
    })
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  _emitParticles(x, y, color) {
    const count = 7
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const speed = 60 + Math.random() * 60
      const r = 5 + Math.random() * 4
      const gfx = this.add.graphics()
      gfx.fillStyle(color, 0.9)
      gfx.fillCircle(0, 0, r)
      gfx.setPosition(x, y)

      this.tweens.add({
        targets: gfx,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 500 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => gfx.destroy(),
      })
    }
  }

  // ── Win Check ─────────────────────────────────────────────────────────────

  _checkWin() {
    const level = LEVELS[this.currentLevel]
    const winner = this.puffs.find(p => p._value === level.target)
    if (!winner) return

    this.won = true

    // Pulse the winning puff
    this.tweens.add({
      targets: winner,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })

    // "✓ Nice!" text
    const niceY = Math.min(winner.y + winner._r + 32, this.scale.height - 60)
    this._niceText = this.add.text(
      this.scale.width / 2,
      niceY,
      '✓ Nice!',
      {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#55AA66',
        fontFamily: 'system-ui, sans-serif',
      }
    ).setOrigin(0.5, 0).setDepth(10).setAlpha(0)

    this.tweens.add({
      targets: this._niceText,
      alpha: 1,
      y: niceY - 8,
      duration: 300,
      ease: 'Back.easeOut',
    })

    // Show next/done button
    const isLast = this.currentLevel >= LEVELS.length - 1
    this.nextBtn.setVisible(true)
    this.nextBtn.getByName('label', true).setText(isLast ? 'All done! 🎉' : 'Next →')
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────

  _makeNextBtn() {
    const W = this.scale.width
    const H = this.scale.height
    const btnW = 160
    const btnH = 44
    const bx = W / 2
    const by = H - 30

    const container = this.add.container(bx, by).setDepth(20)

    const bg = this.add.graphics()
    bg.fillStyle(0x55CC77, 1)
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22)
    container.add(bg)

    const label = this.add.text(0, 0, 'Next →', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0.5, 0.5).setName('label')
    container.add(label)

    // Hit area
    container.setSize(btnW, btnH)
    container.setInteractive({ cursor: 'pointer' })

    container.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(0x44BB66, 1)
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22)
    })
    container.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0x55CC77, 1)
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22)
    })
    container.on('pointerdown', () => {
      const isLast = this.currentLevel >= LEVELS.length - 1
      if (!isLast) {
        this.currentLevel++
        this.loadLevel(this.currentLevel)
      }
      // On last level, button just stays as trophy
    })

    return container
  }
}
