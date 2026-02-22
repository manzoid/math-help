import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { GameScene } from './GameScene.js'
import { STAGES } from './stages.js'
import { generateProblem } from './generator.js'

const FLOWER_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF']

function Flower({ index, colorIdx, blowAway }) {
  const [popped, setPopped] = useState(false)
  const x = 8 + index * 16
  const petalColor = FLOWER_COLORS[colorIdx % FLOWER_COLORS.length]

  useEffect(() => {
    const id = requestAnimationFrame(() => setPopped(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const blowStyle = {
    transition: blowAway ? 'transform 800ms ease-in, opacity 800ms ease-in' : 'none',
    transform: blowAway ? 'translateX(-420px)' : 'translateX(0px)',
    opacity: blowAway ? 0 : 1,
  }

  const popStyle = {
    transformOrigin: `${x}px 22px`,
    transform: popped ? 'scale(1)' : 'scale(0)',
    transition: popped ? 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
  }

  return (
    <g style={blowStyle}>
      <g style={popStyle}>
        {/* Stem */}
        <rect x={x - 1} y={24} width={2} height={10} fill="#55AA33" />
        {/* 4 petals */}
        {[0, 1, 2, 3].map(i => {
          const a = (i / 4) * Math.PI * 2
          return (
            <circle
              key={i}
              cx={x + Math.cos(a) * 6}
              cy={22 + Math.sin(a) * 6}
              r={5}
              fill={petalColor}
              opacity={0.92}
            />
          )
        })}
        {/* Center */}
        <circle cx={x} cy={22} r={4} fill="#FFD700" />
      </g>
    </g>
  )
}

export default function PuffMerge() {
  const containerRef  = useRef(null)
  const gameRef       = useRef(null)
  const blowTimerRef  = useRef(null)
  const onCorrectRef  = useRef(null)
  const onResetRef    = useRef(null)
  const stageIdxRef   = useRef(0)
  const correctRef    = useRef(0)

  const [stageIdx, setStageIdx] = useState(0)
  const [correct,  setCorrect]  = useState(0)
  const [problem,  setProblem]  = useState(null)
  const [flowers,  setFlowers]  = useState([])
  const [blowAway, setBlowAway] = useState(false)

  // Keep refs in sync with state so Phaser callbacks always see latest values
  stageIdxRef.current = stageIdx
  correctRef.current  = correct

  const getScene = () => gameRef.current?.scene.getScene('GameScene')

  const sendProblem = (p) => {
    setProblem(p)
    gameRef.current?.registry.set('currentProblem', p)
    getScene()?.loadProblem(p)
  }

  const onCorrect = () => {
    const newCorrect = correctRef.current + 1

    if (newCorrect >= STAGES[stageIdxRef.current].count) {
      // Advance to next stage (stay at last if already there)
      const currStage = stageIdxRef.current
      const nextStage = currStage + 1 < STAGES.length ? currStage + 1 : currStage

      setBlowAway(true)
      blowTimerRef.current = setTimeout(() => {
        setFlowers([])
        setBlowAway(false)
      }, 900)

      setStageIdx(nextStage)
      stageIdxRef.current = nextStage
      setCorrect(0)
      correctRef.current = 0
      sendProblem(generateProblem(STAGES[nextStage], 0))
    } else {
      setCorrect(newCorrect)
      correctRef.current = newCorrect
      setFlowers(f => [...f, { id: Date.now(), colorIdx: newCorrect - 1 }])
      sendProblem(generateProblem(STAGES[stageIdxRef.current], newCorrect))
    }
  }

  const onReset = () => {
    sendProblem(generateProblem(STAGES[stageIdxRef.current], correctRef.current))
  }

  // Always point refs at the freshest closures
  onCorrectRef.current = onCorrect
  onResetRef.current   = onReset

  useEffect(() => {
    const firstProblem = generateProblem(STAGES[0], 0)
    setProblem(firstProblem)

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

    // Stable wrappers → always call the latest closure via ref
    game.registry.set('currentProblem', firstProblem)
    game.registry.set('onCorrect', () => onCorrectRef.current?.())
    game.registry.set('onReset',   () => onResetRef.current?.())

    gameRef.current = game

    return () => {
      if (blowTimerRef.current) clearTimeout(blowTimerRef.current)
      game.destroy(true)
    }
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>

      {/* Goal display */}
      <div style={{
        textAlign: 'center',
        fontSize: 28,
        fontWeight: 700,
        color: '#7A6655',
        padding: '8px 0 4px',
      }}>
        Become{' '}
        <span style={{ fontSize: 40, color: '#55AA33' }}>
          {problem?.target ?? '?'}
        </span>
      </div>

      {/* Phaser canvas */}
      <div ref={containerRef} style={{ width: '100%' }} />

      {/* Progress meadow */}
      <svg
        width="100%"
        viewBox="0 0 400 60"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Ground layers */}
        <rect x={0} y={30} width={400} height={30} fill="#A8D880" />
        <rect x={0} y={44} width={400} height={16} fill="#88BB66" />

        {/* One flower per solved problem */}
        {flowers.map((f, i) => (
          <Flower
            key={f.id}
            index={i}
            colorIdx={f.colorIdx}
            blowAway={blowAway}
          />
        ))}
      </svg>
    </div>
  )
}
