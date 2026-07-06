import type { BoundingBox } from '../types'

// ─────────────────────────────────────────────────────────────
// Constantes del tracker
// ─────────────────────────────────────────────────────────────

const MAX_AGE    = 3    // frames sin match antes de eliminar un track
const MIN_HITS   = 1    // frames con match antes de mostrar el track
const IOU_THRESH = 0.15 // mínimo overlap para asociar detección a track

let _nextId = 1

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface Track {
  id:         number
  bbox:       BoundingBox
  classId:    number
  className:  string
  confidence: number
  age:        number           // frames desde el último match
  hits:       number           // frames totales con match
  trail:      [number, number][] // últimas posiciones del centroide [cx, cy] normalizadas
}

interface RawDetection {
  bbox:       BoundingBox
  classId:    number
  className:  string
  confidence: number
}

// ─────────────────────────────────────────────────────────────
// Tracker SORT-lite (IoU matching)
// ─────────────────────────────────────────────────────────────

export class IoUTracker {
  private tracks: Track[] = []

  /**
   * Actualiza el tracker con las detecciones del frame actual.
   * Retorna solo los tracks confirmados (hits >= MIN_HITS).
   */
  update(dets: RawDetection[]): Track[] {
    const usedDets = new Set<number>()
    const usedTrks = new Set<number>()

    // Paso 1 — Asociar tracks existentes a detecciones por IoU o Distancia
    for (let ti = 0; ti < this.tracks.length; ti++) {
      const trk = this.tracks[ti]
      let bestScore = -1
      let bestDi    = -1

      for (let di = 0; di < dets.length; di++) {
        if (usedDets.has(di) || dets[di].classId !== trk.classId) continue
        
        const iouScore = iou(trk.bbox, dets[di].bbox)
        
        const cx1 = (trk.bbox.x1 + trk.bbox.x2) / 2
        const cy1 = (trk.bbox.y1 + trk.bbox.y2) / 2
        const cx2 = (dets[di].bbox.x1 + dets[di].bbox.x2) / 2
        const cy2 = (dets[di].bbox.y1 + dets[di].bbox.y2) / 2
        const dist = Math.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2)

        // Combinar IoU y Distancia:
        // Si hay overlap, priorizamos el IoU.
        // Si no hay overlap pero están muy cerca (< 10% de la pantalla), le damos un score basado en proximidad.
        let score = 0
        if (iouScore > 0) {
          score = 1.0 + iouScore // Fuerte preferencia a solapamiento
        } else if (dist < 0.10) {
          score = 1.0 - (dist / 0.10) // Score de 0 a 1 según qué tan cerca estén
        }

        if (score > bestScore && score > 0.2) { 
          bestScore = score; 
          bestDi = di 
        }
      }

      if (bestDi >= 0) {
        const d  = dets[bestDi]
        const cx = (d.bbox.x1 + d.bbox.x2) / 2
        const cy = (d.bbox.y1 + d.bbox.y2) / 2
        this.tracks[ti] = {
          ...trk,
          bbox:       d.bbox,
          confidence: d.confidence,
          age:        0,
          hits:       trk.hits + 1,
          trail:      [...trk.trail.slice(-20), [cx, cy]],
        }
        usedDets.add(bestDi)
        usedTrks.add(ti)
      }
    }

    // Paso 2 — Crear nuevos tracks para detecciones sin match
    for (let di = 0; di < dets.length; di++) {
      if (usedDets.has(di)) continue
      const d  = dets[di]
      const cx = (d.bbox.x1 + d.bbox.x2) / 2
      const cy = (d.bbox.y1 + d.bbox.y2) / 2
      this.tracks.push({
        id:         _nextId++,
        bbox:       d.bbox,
        classId:    d.classId,
        className:  d.className,
        confidence: d.confidence,
        age:        0,
        hits:       1,
        trail:      [[cx, cy]],
      })
    }

    // Paso 3 — Envejecer tracks sin match y eliminar los muertos
    for (let ti = 0; ti < this.tracks.length; ti++) {
      if (!usedTrks.has(ti)) this.tracks[ti].age++
    }
    this.tracks = this.tracks.filter(t => t.age <= MAX_AGE)

    return this.tracks.filter(t => t.hits >= MIN_HITS)
  }

  reset() {
    this.tracks = []
    _nextId = 1
  }
}

// ─────────────────────────────────────────────────────────────
// Utilidad IoU
// ─────────────────────────────────────────────────────────────

function iou(a: BoundingBox, b: BoundingBox): number {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1)
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2)
  if (ix2 <= ix1 || iy2 <= iy1) return 0
  const inter = (ix2 - ix1) * (iy2 - iy1)
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter)
}
