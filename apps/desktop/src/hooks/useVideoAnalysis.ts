import { useRef, useCallback, RefObject } from 'react';
import * as onnxService from '../services/onnxService';
import { IoUTracker } from '../services/tracker';
import type { Detection } from '../types';
import { useAnalysisStore } from '../store/analysisStore';

const CAPTURE_SIZE    = 640;
const AUTO_PAUSE_CONF = 0.45; // auto-pausa si confianza >= 45 %
const AUTO_PAUSE_HITS = 2;    // ... y el track fue confirmado >= 2 veces

export function useVideoAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>
) {
  const cancelledRef = useRef(false);
  const rafRef       = useRef<number>(0);
  const canvas       = useRef<HTMLCanvasElement | null>(null);
  const tracker      = useRef(new IoUTracker());
  const lastInfTs    = useRef(0);
  const inferring    = useRef(false);

  const {
    config, setStatus, setProgress,
    addDetection, setResult, setError, setHardware,
    resetAnalysis, setTracks, setAutoPaused,
  } = useAnalysisStore();

  // ── Carga del modelo (una sola vez) ──────────────────────────
  const ensureModel = useCallback(async () => {
    if (onnxService.isModelLoaded()) return;
    setStatus('loading_model');
    const { classNames, numClasses } = await onnxService.loadModel();
    setHardware({
      executionProvider: 'WASM (onnxruntime-web)',
      modelLoaded: true,
      classNames,
      numClasses,
    });
  }, [setStatus, setHardware]);

  // ── Análisis en tiempo real ──────────────────────────────────
  const startAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.src) {
      setError('Selecciona un video antes de analizar.');
      setStatus('error');
      return;
    }

    resetAnalysis();
    tracker.current.reset();
    cancelledRef.current = false;

    try {
      await ensureModel();
      if (cancelledRef.current) { setStatus('cancelled'); return; }

      // Canvas offscreen reutilizable
      if (!canvas.current) {
        canvas.current = document.createElement('canvas');
        canvas.current.width = canvas.current.height = CAPTURE_SIZE;
      }
      const cvs = canvas.current;
      const ctx = cvs.getContext('2d', { willReadFrequently: true })!;

      const allDetections: Detection[] = [];
      const tStart        = performance.now();
      const minIntervalMs = 1000 / config.analysisFps;

      // Rebobinar y reproducir
      video.currentTime = 0;
      await new Promise<void>((res) => {
        if (video.readyState >= 2) { res(); return; }
        video.addEventListener('canplay', () => res(), { once: true });
        setTimeout(res, 3000);
      });

      setStatus('analyzing');
      video.play();

      // ── Loop principal (rAF) ───────────────────────────────
      const loop = (now: DOMHighResTimeStamp) => {
        if (cancelledRef.current) return;
        if (video.ended) { finish(); return; }

        // Si está pausado (por auto-pausa o usuario), seguimos el rAF
        // pero no capturamos frames
        if (!video.paused && !inferring.current && now - lastInfTs.current >= minIntervalMs) {
          lastInfTs.current = now;
          inferring.current = true;

          // Captura del frame actual (Stretch / Squash)
          // Si el modelo fue entrenado en Roboflow sin "Fit (Padding)", aprendió a ver las imágenes estiradas
          try { 
            ctx.drawImage(video, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE); 
          }
          catch { inferring.current = false; rafRef.current = requestAnimationFrame(loop); return; }

          const ts = video.currentTime;

          onnxService.runInference(cvs, config.confidenceThreshold)
            .then(({ detections: raw, inferenceMs }) => {
              inferring.current = false;
              if (cancelledRef.current) return;

              // Como el modelo infiere sobre la imagen estirada, las coordenadas raw (0..1)
              // ya corresponden exactamente al espacio [0..1] de la imagen completa.
              // NO revertimos nada.
              const correctedRaw = raw;

              // Actualizar tracker
              const activeTracks = tracker.current.update(correctedRaw);
              setTracks([...activeTracks]);

              // Acumular detecciones confirmadas para export
              for (const t of activeTracks) {
                const det: Detection = {
                  bbox: t.bbox, classId: t.classId,
                  className: t.className, confidence: t.confidence,
                  timestamp: ts, frameIndex: 0,
                };
                allDetections.push(det);
                addDetection(det);
              }

              setProgress({
                currentFrame:     Math.round(ts * config.analysisFps),
                totalFrames:      Math.ceil(video.duration * config.analysisFps),
                currentTimestamp: ts,
                videoDuration:    video.duration,
                fps:              config.analysisFps,
                etaSeconds:       Math.round((video.duration - ts)),
                detectionsFound:  allDetections.length,
                lastInferenceMs:  inferenceMs,
              });

              // Auto-pausa: detección de alta confianza sostenida
              const anchor = activeTracks.find(
                t => t.confidence >= AUTO_PAUSE_CONF && t.hits >= AUTO_PAUSE_HITS,
              );
              if (anchor) {
                video.pause();
                setAutoPaused(true);
              }
            })
            .catch(() => { inferring.current = false; });
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      const finish = () => {
        cancelAnimationFrame(rafRef.current);
        if (cancelledRef.current) return;
        const totalMs = performance.now() - tStart;
        const avgConf = allDetections.length > 0
          ? allDetections.reduce((s, d) => s + d.confidence, 0) / allDetections.length
          : 0;
        setResult({
          detections:          allDetections,
          totalFramesAnalyzed: allDetections.length,
          videoDuration:       video.duration,
          processingTimeMs:    totalMs,
          averageConfidence:   avgConf,
          realFps:             config.analysisFps,
        });
        setTracks([]);
        setStatus('complete');
      };

      video.addEventListener('ended', finish, { once: true });
      rafRef.current = requestAnimationFrame(loop);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('error');
    }
  }, [videoRef, config, ensureModel, resetAnalysis, setStatus, setProgress,
      addDetection, setResult, setError, setTracks, setAutoPaused]);

  // ── Reanudar desde auto-pausa ────────────────────────────────
  const resumeAnalysis = useCallback(() => {
    setAutoPaused(false);
    videoRef.current?.play();
  }, [videoRef, setAutoPaused]);

  // ── Cancelar ─────────────────────────────────────────────────
  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.pause();
    tracker.current.reset();
    setTracks([]);
    setStatus('cancelled');
  }, [setStatus, setTracks]);

  return { startAnalysis, cancelAnalysis, resumeAnalysis };
}
