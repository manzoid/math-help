import { useState, useRef, useCallback, useEffect } from 'react'

const A_COLOR   = '#4a6cf7'
const B_COLOR   = '#ff9500'
const SUM_COLOR = '#34c759'
const WRONG_COLOR = '#ff3b30'

/* ---- generate a random addition problem ---- */
function randomProblem(maxSum = 20) {
  const a = Math.floor(Math.random() * maxSum) + 1
  const b = Math.floor(Math.random() * (maxSum - a)) + 1
  return { a, b, answer: a + b }
}

/* ---- check Chrome Handwriting Recognition API ---- */
function hasHandwritingAPI() {
  return 'createHandwritingRecognizer' in navigator
}

/* ================================================================ */

export default function AdditionHandwriting() {
  const canvasRef = useRef(null)
  const recognizerRef = useRef(null)
  const drawingRef = useRef(null)
  const strokeRef = useRef(null)
  const strokeStartRef = useRef(0)

  const [problem, setProblem] = useState(() => randomProblem())
  const [apiReady, setApiReady] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [recognized, setRecognized] = useState(null)   // string or null
  const [result, setResult] = useState(null)            // 'correct' | 'wrong' | null
  const [drawing, setDrawing] = useState(false)         // is the user currently drawing?
  const [hasStrokes, setHasStrokes] = useState(false)

  /* ---- init recognizer ---- */
  useEffect(() => {
    if (!hasHandwritingAPI()) {
      setApiError('Handwriting Recognition API not available. Use Chrome 99+ on a Chromebook, Android, or desktop.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const rec = await navigator.createHandwritingRecognizer({ languages: ['en'] })
        if (cancelled) { rec.finish(); return }
        recognizerRef.current = rec
        setApiReady(true)
      } catch (e) {
        setApiError(`Could not create recognizer: ${e.message}`)
      }
    })()

    return () => {
      cancelled = true
      recognizerRef.current?.finish()
      recognizerRef.current = null
    }
  }, [])

  /* ---- start a fresh drawing session ---- */
  const startSession = useCallback(() => {
    drawingRef.current?.clear()
    const rec = recognizerRef.current
    if (!rec) return
    drawingRef.current = rec.startDrawing({
      recognitionType: 'number',
      inputType: 'touch',
      alternatives: 3,
    })
  }, [])

  /* ---- clear canvas + session ---- */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    startSession()
    setRecognized(null)
    setResult(null)
    setHasStrokes(false)
  }, [startSession])

  /* ---- next problem ---- */
  const nextProblem = useCallback(() => {
    setProblem(randomProblem())
    setRecognized(null)
    setResult(null)
    setHasStrokes(false)
    // clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    startSession()
  }, [startSession])

  /* ---- set up canvas size ---- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pr = window.devicePixelRatio || 1
    canvas.width = rect.width * pr
    canvas.height = rect.height * pr
    const ctx = canvas.getContext('2d')
    ctx.scale(pr, pr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 6
    ctx.strokeStyle = '#333'
  }, [])

  /* ---- start drawing session once API is ready ---- */
  useEffect(() => {
    if (apiReady) startSession()
  }, [apiReady, startSession])

  /* ---- pointer handlers for drawing ---- */
  const onPointerDown = useCallback((e) => {
    if (!apiReady || result) return
    const canvas = canvasRef.current
    canvas.setPointerCapture(e.pointerId)
    setDrawing(true)

    const stroke = new HandwritingStroke()
    strokeRef.current = stroke
    strokeStartRef.current = Date.now()

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    stroke.addPoint({ x, y, t: 0 })

    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [apiReady, result])

  const onPointerMove = useCallback((e) => {
    if (!drawing || !strokeRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    strokeRef.current.addPoint({ x, y, t: Date.now() - strokeStartRef.current })

    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [drawing])

  const onPointerUp = useCallback(async () => {
    if (!drawing || !strokeRef.current) return
    setDrawing(false)
    setHasStrokes(true)

    const dw = drawingRef.current
    if (dw && strokeRef.current) {
      dw.addStroke(strokeRef.current)
      strokeRef.current = null

      // get prediction after each stroke
      try {
        const predictions = await dw.getPrediction()
        if (predictions && predictions.length > 0) {
          setRecognized(predictions[0].text)
        }
      } catch {
        // recognition can fail transiently, ignore
      }
    }
  }, [drawing])

  /* ---- check answer ---- */
  const checkAnswer = useCallback(() => {
    if (recognized == null) return
    const num = parseInt(recognized, 10)
    if (num === problem.answer) {
      setResult('correct')
    } else {
      setResult('wrong')
    }
  }, [recognized, problem.answer])

  /* ---- render ---- */
  const isCorrect = result === 'correct'
  const isWrong = result === 'wrong'

  return (
    <div style={s.root}>
      {/* problem */}
      <div style={s.problem}>
        <span style={{ color: A_COLOR }}>{problem.a}</span>
        <span style={s.op}> + </span>
        <span style={{ color: B_COLOR }}>{problem.b}</span>
        <span style={s.op}> = </span>
        <span style={s.qmark}>?</span>
      </div>

      {/* instructions */}
      <p style={s.instructions}>
        Write your answer on the pad below
      </p>

      {/* API error fallback */}
      {apiError && (
        <div style={s.errorBox}>
          {apiError}
        </div>
      )}

      {/* drawing canvas */}
      {!apiError && (
        <>
          <div style={{
            ...s.canvasWrap,
            borderColor: isCorrect ? SUM_COLOR : isWrong ? WRONG_COLOR : '#ddd',
          }}>
            <canvas
              ref={canvasRef}
              style={s.canvas}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />

            {/* live recognition preview */}
            {recognized != null && !result && (
              <div style={s.preview}>
                Looks like: <strong>{recognized}</strong>
              </div>
            )}

            {/* result overlay */}
            {result && (
              <div style={{
                ...s.resultOverlay,
                background: isCorrect
                  ? 'rgba(52,199,89,0.12)'
                  : 'rgba(255,59,48,0.10)',
              }}>
                {isCorrect ? (
                  <div style={{ color: SUM_COLOR }}>
                    <div style={s.resultEmoji}>&#10003;</div>
                    <div style={s.resultText}>
                      {problem.a} + {problem.b} = {problem.answer}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: WRONG_COLOR }}>
                    <div style={s.resultEmoji}>&#10007;</div>
                    <div style={s.resultText}>
                      You wrote {recognized} — try again!
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* buttons */}
          <div style={s.buttons}>
            {!result && (
              <>
                <button onClick={clearCanvas} style={s.btnSecondary} disabled={!hasStrokes}>
                  Clear
                </button>
                <button onClick={checkAnswer} style={s.btnPrimary} disabled={recognized == null}>
                  Check
                </button>
              </>
            )}
            {isCorrect && (
              <button onClick={nextProblem} style={{ ...s.btnPrimary, background: SUM_COLOR }}>
                Next problem
              </button>
            )}
            {isWrong && (
              <>
                <button onClick={clearCanvas} style={s.btnSecondary}>
                  Try again
                </button>
                <button onClick={nextProblem} style={s.btnPrimary}>
                  Skip
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* insight */}
      <div style={s.insight}>
        <div style={s.insightTitle}>How it works</div>
        <p style={s.insightText}>
          Write your answer with your finger or stylus. The browser recognizes
          your handwriting right on your device — no internet needed!
          This uses the Chrome Handwriting Recognition API.
        </p>
      </div>
    </div>
  )
}

/* ---- styles ---- */

const s = {
  root: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  problem: {
    textAlign: 'center',
    fontSize: '2.8rem',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    marginBottom: '0.25rem',
    letterSpacing: '-0.02em',
  },
  op: { color: 'var(--color-muted)', fontWeight: 400 },
  qmark: {
    display: 'inline-block',
    width: '2.5ch',
    textAlign: 'center',
    color: '#ccc',
    borderBottom: '3px dashed #ddd',
  },
  instructions: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: 'var(--color-muted)',
    margin: '0 0 0.75rem',
  },
  errorBox: {
    background: 'rgba(255,59,48,0.08)',
    border: '1px solid rgba(255,59,48,0.25)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    fontSize: '0.85rem',
    color: '#c00',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  canvasWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    margin: '0 auto 0.75rem',
    border: '3px solid #ddd',
    borderRadius: 'var(--radius, 12px)',
    overflow: 'hidden',
    background: '#fafaf8',
    transition: 'border-color 0.3s',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: 180,
    touchAction: 'none',
    cursor: 'crosshair',
  },
  preview: {
    position: 'absolute',
    top: 8,
    right: 10,
    fontSize: '0.8rem',
    color: '#999',
    pointerEvents: 'none',
  },
  resultOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  resultEmoji: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  resultText: {
    fontSize: '1rem',
    fontWeight: 600,
    marginTop: '0.25rem',
  },
  buttons: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  btnPrimary: {
    background: 'var(--color-accent, #4a6cf7)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'var(--color-accent-light, #e8edff)',
    color: 'var(--color-accent, #4a6cf7)',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.95rem',
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
