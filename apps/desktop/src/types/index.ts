// ─────────────────────────────────────────────────────────────
// Tipos del dominio — Tortugas AI
// Preparados para extensión: GPS, nidos, operación nocturna
// ─────────────────────────────────────────────────────────────

export interface BoundingBox {
  x1: number; // normalizadas [0, 1]
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  bbox: BoundingBox;
  classId: number;
  className: string;
  confidence: number;
  // Añadidos por el frontend tras recibir la respuesta de Rust
  timestamp: number;   // segundos en el video
  frameIndex: number;
}

export interface FrameResult {
  detections: Detection[];
  timestamp: number;
  frameIndex: number;
  inferenceMs: number;
}

export interface AnalysisConfig {
  analysisFps: number;         // Frames por segundo del video que se analizan (3–10)
  confidenceThreshold: number; // Umbral mínimo de confianza (0–1)
}

export interface ProgressUpdate {
  currentFrame: number;
  totalFrames: number;
  currentTimestamp: number;
  videoDuration: number;
  fps: number;
  etaSeconds: number;
  detectionsFound: number;
  lastInferenceMs: number;
}

export interface AnalysisResult {
  detections: Detection[];
  totalFramesAnalyzed: number;
  videoDuration: number;
  processingTimeMs: number;
  averageConfidence: number;
  realFps: number;
}

export interface HardwareInfo {
  executionProvider: string; // "DirectML → CPU" | "CoreML → CPU" | "CPU"
  modelLoaded: boolean;
  classNames: string[];
  numClasses: number;
}

export interface Track {
  id:         number
  bbox:       BoundingBox
  classId:    number
  className:  string
  confidence: number
  age:        number
  hits:       number
  trail:      [number, number][]  // [cx, cy] normalizados, últimas N posiciones
}

export type AnalysisStatus =
  | 'idle'
  | 'loading_model'
  | 'analyzing'
  | 'cancelling'
  | 'complete'
  | 'error'
  | 'cancelled';

// ─────────────────────────────────────────────────────────────
// Preparado para geolocalización futura (v2+)
// ─────────────────────────────────────────────────────────────

export interface DroneMetadata {
  latitude?: number;
  longitude?: number;
  altitudeM?: number;
  pitchDeg?: number;
  rollDeg?: number;
  yawDeg?: number;
  fovHDeg?: number;
  fovVDeg?: number;
}

export interface GeolocatedDetection extends Detection {
  geoCoords?: {
    lat: number;
    lng: number;
  };
  droneMetadata?: DroneMetadata;
}
