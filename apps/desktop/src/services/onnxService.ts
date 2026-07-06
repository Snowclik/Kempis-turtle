import * as ort from 'onnxruntime-web/wasm'
import type { Detection } from '../types'

// WASM files servidos desde la raíz del frontend
ort.env.wasm.wasmPaths = '/'
ort.env.wasm.numThreads = 1

const MODEL_PATH    = '/models/model.onnx'
const MODEL_META    = '/models/model_meta.json'
const INPUT_SIZE    = 640

let session:    ort.InferenceSession | null = null
let classNames: string[] = ['object']

// ─────────────────────────────────────────────────────────────
// Carga del modelo
// ─────────────────────────────────────────────────────────────

export async function loadModel(): Promise<{ classNames: string[]; numClasses: number }> {
  // Metadatos
  try {
    const res  = await fetch(MODEL_META)
    const meta = await res.json()
    if (Array.isArray(meta.class_names)) classNames = meta.class_names
  } catch {
    console.warn('[OnnxService] model_meta.json no encontrado, usando clase por defecto')
  }

  session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })

  return { classNames, numClasses: classNames.length }
}

export function isModelLoaded(): boolean {
  return session !== null
}

// ─────────────────────────────────────────────────────────────
// Inferencia sobre un frame de video (canvas 640×640)
// ─────────────────────────────────────────────────────────────

export async function runInference(
  canvas: HTMLCanvasElement,
  confThreshold: number,
): Promise<{ detections: Detection[]; inferenceMs: number }> {
  if (!session) throw new Error('Modelo no cargado')

  const tensor = canvasToTensor(canvas)
  const input  = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE])

  const t0      = performance.now()
  const outputs = await session.run({ images: input })
  const inferenceMs = performance.now() - t0

  // YOLO26n: output0 shape = [1, 300, 6]
  // Cada detección: [x1, y1, x2, y2, confianza, class_id]  — coordenadas en píxeles (0–640)
  const out  = outputs['output0']
  const data = out.data as Float32Array
  const maxDets = out.dims[1] as number   // 300
  const inv  = 1.0 / INPUT_SIZE

  const detections: Detection[] = []

  for (let i = 0; i < maxDets; i++) {
    const base = i * 6
    const conf = data[base + 4]
    if (conf < confThreshold) continue

    const x1 = data[base + 0]
    const y1 = data[base + 1]
    const x2 = data[base + 2]
    const y2 = data[base + 3]
    if (x2 <= x1 || y2 <= y1) continue

    const classId   = Math.round(data[base + 5])
    const className = classNames[classId] ?? `clase_${classId}`

    detections.push({
      bbox: {
        x1: Math.max(0, Math.min(1, x1 * inv)),
        y1: Math.max(0, Math.min(1, y1 * inv)),
        x2: Math.max(0, Math.min(1, x2 * inv)),
        y2: Math.max(0, Math.min(1, y2 * inv)),
      },
      classId,
      className,
      confidence: conf,
      // timestamp y frameIndex los añade el caller
      timestamp:  0,
      frameIndex: 0,
    })
  }

  return { detections, inferenceMs }
}

// ─────────────────────────────────────────────────────────────
// Preprocesamiento: canvas 640×640 → tensor Float32 [1,3,640,640]
// ─────────────────────────────────────────────────────────────

function canvasToTensor(canvas: HTMLCanvasElement): Float32Array {
  const ctx    = canvas.getContext('2d', { willReadFrequently: true })!
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const pixels = INPUT_SIZE * INPUT_SIZE
  const tensor = new Float32Array(3 * pixels)

  for (let i = 0; i < pixels; i++) {
    tensor[i]              = data[i * 4]     / 255  // R
    tensor[pixels + i]     = data[i * 4 + 1] / 255  // G
    tensor[2 * pixels + i] = data[i * 4 + 2] / 255  // B
  }

  return tensor
}
