import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { GameScene } from './GameScene.js'

export default function PuffMerge() {
  const containerRef = useRef(null)

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 480,
      height: 520,
      parent: containerRef.current,
      backgroundColor: '#FFF8F5',
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
    return () => game.destroy(true)
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div ref={containerRef} style={{ width: '100%', maxWidth: 480 }} />
    </div>
  )
}
