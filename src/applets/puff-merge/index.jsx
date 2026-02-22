import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { GameScene } from './GameScene.js'

const btnStyle = {
  background: '#55CC77',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '10px 28px',
  fontSize: 18,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
}

export default function PuffMerge() {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const [ui, setUi] = useState({ level: 1, total: 10, goal: '?', showNext: false, isLast: false })

  useEffect(() => {
    // Pass React state setter into Phaser via registry
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 480,
      height: 520,
      parent: containerRef.current,
      backgroundColor: '#FFF8F5',
      resolution: window.devicePixelRatio || 1,
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: [GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    })
    game.registry.set('onUiUpdate', setUi)
    gameRef.current = game

    return () => game.destroy(true)
  }, [])

  const handleNext = () => {
    const scene = gameRef.current?.scene.getScene('GameScene')
    scene?.advanceLevel()
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto' }}>
      {/* DOM text overlay — always crisp, never scaled with canvas */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '12px 16px',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <span style={{ fontSize: 13, color: '#BBAA99', fontFamily: 'system-ui, sans-serif' }}>
          Level {ui.level} / {ui.total}
        </span>
        <span style={{
          fontSize: 22, fontWeight: 700, color: '#7A6655',
          fontFamily: 'system-ui, sans-serif',
        }}>
          Make {ui.goal}
        </span>
        <span style={{ width: 70 }} /> {/* balance the flex row */}
      </div>

      {/* Canvas container */}
      <div ref={containerRef} style={{ width: '100%' }} />

      {/* Next / replay button — shown after win */}
      {ui.showNext && (
        <div style={{
          position: 'absolute', bottom: 18, left: 0, right: 55,
          display: 'flex', justifyContent: 'center',
          zIndex: 10,
        }}>
          <button style={btnStyle} onClick={handleNext}>
            {ui.isLast ? 'All done! 🎉' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}
