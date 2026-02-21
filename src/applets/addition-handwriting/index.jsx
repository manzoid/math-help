import { useState, useRef, useCallback, useEffect } from 'react'
import * as tf from '@tensorflow/tfjs'

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

/* ---- image preprocessing helpers ---- */

/** Get the bounding box of drawn content (non-white pixels). */
function getBoundingBox(imageData) {
  const { data, width, height } = imageData
  let top = height, left = width, bottom = 0, right = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // check alpha channel — any drawn pixel has alpha > 0
      if (data[i + 3] > 20) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (top > bottom) return null // nothing drawn
  return { top, left, bottom: bottom + 1, right: right + 1 }
}

/**
 * Segment digits by finding vertical gaps in drawn content.
 * Returns an array of { left, right } column ranges.
 */
function segmentDigits(imageData, bbox) {
  const { data, width } = imageData
  const colHasInk = []
  for (let x = bbox.left; x < bbox.right; x++) {
    let hasInk = false
    for (let y = bbox.top; y < bbox.bottom; y++) {
      if (data[((y * width) + x) * 4 + 3] > 20) { hasInk = true; break }
    }
    colHasInk.push(hasInk)
  }

  // find contiguous regions of ink
  const regions = []
  let inRegion = false
  let start = 0
  for (let i = 0; i <= colHasInk.length; i++) {
    if (i < colHasInk.length && colHasInk[i]) {
      if (!inRegion) { start = i; inRegion = true }
    } else {
      if (inRegion) {
        regions.push({ left: bbox.left + start, right: bbox.left + i })
        inRegion = false
      }
    }
  }

  // merge regions that are very close (gap < 8px is probably same digit)
  const merged = [regions[0]]
  for (let i = 1; i < regions.length; i++) {
    const prev = merged[merged.length - 1]
    if (regions[i].left - prev.right < 8) {
      prev.right = regions[i].right
    } else {
      merged.push(regions[i])
    }
  }
  return merged
}

/**
 * Extract a single digit region from the canvas and return a 28×28 tensor.
 * MNIST expects white-on-black, centered, with padding.
 */
function extractDigitTensor(imageData, bbox, colRegion) {
  const { data, width } = imageData
  const dLeft = colRegion.left
  const dRight = colRegion.right
  const dTop = bbox.top
  const dBottom = bbox.bottom
  const dw = dRight - dLeft
  const dh = dBottom - dTop

  // create a square crop with padding
  const size = Math.max(dw, dh)
  const pad = Math.round(size * 0.3) // add ~30% padding like MNIST
  const totalSize = size + pad * 2

  // draw into a temporary canvas, centered
  const tmp = document.createElement('canvas')
  tmp.width = totalSize
  tmp.height = totalSize
  const tctx = tmp.getContext('2d')

  // fill black background (MNIST style)
  tctx.fillStyle = '#000'
  tctx.fillRect(0, 0, totalSize, totalSize)

  // draw the digit region, centered
  const offX = pad + Math.round((size - dw) / 2)
  const offY = pad + Math.round((size - dh) / 2)

  // copy pixel by pixel, inverting: drawn pixels become white
  const tmpData = tctx.getImageData(0, 0, totalSize, totalSize)
  for (let y = dTop; y < dBottom; y++) {
    for (let x = dLeft; x < dRight; x++) {
      const srcIdx = (y * width + x) * 4
      const alpha = data[srcIdx + 3]
      if (alpha > 20) {
        const dx = offX + (x - dLeft)
        const dy = offY + (y - dTop)
        const dstIdx = (dy * totalSize + dx) * 4
        tmpData.data[dstIdx] = 255     // R
        tmpData.data[dstIdx + 1] = 255 // G
        tmpData.data[dstIdx + 2] = 255 // B
        tmpData.data[dstIdx + 3] = 255 // A
      }
    }
  }
  tctx.putImageData(tmpData, 0, 0)

  // resize to 28×28
  const out = document.createElement('canvas')
  out.width = 28
  out.height = 28
  const octx = out.getContext('2d')
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(tmp, 0, 0, 28, 28)

  // convert to grayscale float tensor [1, 28, 28, 1], normalized 0-1
  const pixels = octx.getImageData(0, 0, 28, 28)
  const floats = new Float32Array(784)
  for (let i = 0; i < 784; i++) {
    // use red channel (all channels are same since we drew white on black)
    floats[i] = pixels.data[i * 4] / 255
  }
  return tf.tensor4d(floats, [1, 28, 28, 1])
}

/* ================================================================ */

export default function AdditionHandwriting() {
  const canvasRef = useRef(null)
  const modelRef = useRef(null)

  const [problem, setProblem] = useState(() => randomProblem())
  const [modelReady, setModelReady] = useState(false)
  const [modelError, setModelError] = useState(null)
  const [recognized, setRecognized] = useState(null)
  const [result, setResult] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  /* ---- load TF.js model ---- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const model = await tf.loadLayersModel('/mnist-model/model.json')
        if (cancelled) return
        modelRef.current = model
        setModelReady(true)
      } catch (e) {
        if (!cancelled) setModelError(`Could not load digit model: ${e.message}`)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ---- recognize digits from canvas ---- */
  const recognizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const model = modelRef.current
    if (!canvas || !model) return

    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const bbox = getBoundingBox(imageData)
    if (!bbox) return

    const regions = segmentDigits(imageData, bbox)
    if (!regions || regions.length === 0) return

    // recognize each digit region
    const digits = []
    for (const region of regions) {
      const tensor = extractDigitTensor(imageData, bbox, region)
      const pred = model.predict(tensor)
      const digitIdx = pred.argMax(1).dataSync()[0]
      digits.push(digitIdx)
      tensor.dispose()
      pred.dispose()
    }

    // combine digits into a number
    const number = digits.reduce((acc, d) => acc * 10 + d, 0)
    setRecognized(String(number))
  }, [])

  /* ---- clear canvas ---- */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setRecognized(null)
    setResult(null)
    setHasStrokes(false)
  }, [])

  /* ---- next problem ---- */
  const nextProblem = useCallback(() => {
    setProblem(randomProblem())
    setRecognized(null)
    setResult(null)
    setHasStrokes(false)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

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

  /* ---- pointer handlers for drawing ---- */
  const onPointerDown = useCallback((e) => {
    if (!modelReady || result) return
    const canvas = canvasRef.current
    canvas.setPointerCapture(e.pointerId)
    setDrawing(true)

    const rect = canvas.getBoundingClientRect()
    const pr = window.devicePixelRatio || 1
    const x = (e.clientX - rect.left)
    const y = (e.clientY - rect.top)

    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 6
    ctx.strokeStyle = '#333'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x * pr, y * pr)
  }, [modelReady, result])

  const onPointerMove = useCallback((e) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const pr = window.devicePixelRatio || 1
    const x = (e.clientX - rect.left)
    const y = (e.clientY - rect.top)

    const ctx = canvas.getContext('2d')
    ctx.lineTo(x * pr, y * pr)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x * pr, y * pr)
  }, [drawing])

  const onPointerUp = useCallback(() => {
    if (!drawing) return
    setDrawing(false)
    setHasStrokes(true)
  }, [drawing])

  /* ---- auto-recognize after stroke ends (debounced) ---- */
  const recognizeTimerRef = useRef(null)
  useEffect(() => {
    if (!hasStrokes || drawing || result) return
    clearTimeout(recognizeTimerRef.current)
    recognizeTimerRef.current = setTimeout(() => {
      recognizeCanvas()
    }, 400)
    return () => clearTimeout(recognizeTimerRef.current)
  }, [hasStrokes, drawing, result, recognizeCanvas])

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

      {/* model loading state */}
      {!modelReady && !modelError && (
        <div style={s.loadingBox}>Loading digit recognizer...</div>
      )}

      {/* model error */}
      {modelError && (
        <div style={s.errorBox}>{modelError}</div>
      )}

      {/* drawing canvas */}
      {modelReady && (
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
          Write your answer with your finger or stylus. A small neural network
          running right in your browser recognizes the digits — no internet
          needed, and it works on any device!
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
  loadingBox: {
    textAlign: 'center',
    padding: '1rem',
    fontSize: '0.9rem',
    color: 'var(--color-muted)',
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
