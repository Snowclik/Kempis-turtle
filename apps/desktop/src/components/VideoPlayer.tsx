import { useRef, useEffect, useCallback, useState, RefObject } from 'react';
import { useAnalysisStore } from '../store/analysisStore';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';

// Paleta de colores por track ID
const PALETTE = [
  '#22c55e', '#06b6d4', '#f59e0b', '#ef4444',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];
const trackColor = (id: number) => PALETTE[id % PALETTE.length];

interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement>;
}

export function VideoPlayer({ videoRef }: VideoPlayerProps) {
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError,   setVideoError]   = useState<string | null>(null);

  const { videoPath, tracks, status, progress, autoPaused } = useAnalysisStore();
  const { resumeAnalysis } = useVideoAnalysis(videoRef);

  // ── Sincronizar tamaño del canvas overlay ──────────────────
  const syncSize = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    
    const video = videoRef.current;
    if (!video) return;
    if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
      canvas.width  = video.clientWidth;
      canvas.height = video.clientHeight;
    }
  }, [videoRef]);

  // ── Loop de dibujo (rAF propio del overlay) ─────────────────
  useEffect(() => {
    let rafId: number;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const canvas = overlayRef.current;
      if (!canvas) return;
      
      if (!videoRef.current) return;

      syncSize();
      const W = canvas.width, H = canvas.height;
      let natW = W, natH = H;
      
      if (videoRef.current) {
        natW = videoRef.current.videoWidth;
        natH = videoRef.current.videoHeight;
      }
      
      if (natW === 0 || natH === 0) {
        natW = W; natH = H;
      }

      const scale = Math.min(W / natW, H / natH);
      const vidW = natW * scale;
      const vidH = natH * scale;
      const offsetX = (W - vidW) / 2;
      const offsetY = (H - vidH) / 2;

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      if (tracks.length === 0) return;

      for (const track of tracks) {
        const color = trackColor(track.id);
        const { x1, y1, x2, y2 } = track.bbox;

        const px = offsetX + x1 * vidW, py = offsetY + y1 * vidH;
        const pw = (x2 - x1) * vidW, ph = (y2 - y1) * vidH;

        // ── Trail (estela de movimiento) ─────────────────────
        if (track.trail.length >= 2) {
          ctx.beginPath();
          ctx.strokeStyle = color + '99';
          ctx.lineWidth   = 2;
          ctx.lineCap     = 'round';
          ctx.lineJoin    = 'round';

          const first = track.trail[0];
          ctx.moveTo(offsetX + first[0] * vidW, offsetY + first[1] * vidH);
          for (let i = 1; i < track.trail.length; i++) {
            const alpha = Math.round((i / track.trail.length) * 255).toString(16).padStart(2, '0');
            ctx.strokeStyle = color + alpha;
            ctx.lineTo(offsetX + track.trail[i][0] * vidW, offsetY + track.trail[i][1] * vidH);
          }
          ctx.stroke();

          // Punto en la posición actual
          const last = track.trail[track.trail.length - 1];
          ctx.beginPath();
          ctx.arc(offsetX + last[0] * vidW, offsetY + last[1] * vidH, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }

        // ── Bounding box ─────────────────────────────────────
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.strokeRect(px, py, pw, ph);

        // Esquinas decorativas (estilo militar/drone)
        const cs = Math.min(pw, ph) * 0.18;
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(px, py + cs); ctx.lineTo(px, py); ctx.lineTo(px + cs, py);
        // Top-right
        ctx.moveTo(px + pw - cs, py); ctx.lineTo(px + pw, py); ctx.lineTo(px + pw, py + cs);
        // Bottom-right
        ctx.moveTo(px + pw, py + ph - cs); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px + pw - cs, py + ph);
        // Bottom-left
        ctx.moveTo(px + cs, py + ph); ctx.lineTo(px, py + ph); ctx.lineTo(px, py + ph - cs);
        ctx.stroke();

        // ── Etiqueta ─────────────────────────────────────────
        const confPct = (track.confidence * 100).toFixed(0);
        const label   = `#${track.id} ${track.className} ${confPct}%`;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        const textW = ctx.measureText(label).width + 10;
        const labelY = py > 22 ? py - 4 : py + ph + 18;

        ctx.fillStyle = color + 'dd';
        ctx.beginPath();
        ctx.roundRect(px, labelY - 16, textW, 18, 3);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.fillText(label, px + 5, labelY - 2);

        // ── Hits badge (confianza sostenida) ──────────────────
        if (track.hits >= 5) {
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = color + 'cc';
          ctx.beginPath();
          ctx.arc(px + pw - 8, py + 8, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(String(track.hits), px + pw - 8, py + 12);
          ctx.textAlign = 'left';
        }
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [tracks, syncSize, videoRef]);

  // ── Reasignar src si el elemento fue remontado ──
  useEffect(() => {
    if (!videoPath) return;
    if (videoRef.current && videoRef.current.src !== videoPath) {
      videoRef.current.src = videoPath;
      videoRef.current.load();
    }
  }, [videoPath, videoRef]);

  useEffect(() => {
    setVideoError(null);
    setVideoLoading(!!videoPath);
  }, [videoPath]);

  const analysisPct = progress
    ? Math.min(100, (progress.currentTimestamp / Math.max(progress.videoDuration, 1)) * 100)
    : 0;

  const isAnalyzing  = status === 'analyzing';
  const isCancelling = status === 'cancelling';

  return (
    <div ref={containerRef} className="relative w-full flex-1 min-h-[300px] lg:min-h-0 bg-black rounded-lg overflow-hidden select-none flex flex-col justify-center">

      {/* Video */}
      <video
        ref={videoRef}
        src={videoPath ?? undefined}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        preload="metadata"
        onLoadStart={() => { setVideoLoading(true); setVideoError(null); }}
        onLoadedMetadata={() => {
          setVideoLoading(false);
          syncSize();
          const dur = videoRef.current?.duration ?? 0;
          useAnalysisStore.getState().setVideoDuration(dur);
        }}
        onCanPlay={() => setVideoLoading(false)}
        onError={(e) => {
          const code = e.currentTarget.error?.code ?? -1;
          const msgs: Record<number, string> = {
            1: 'Carga abortada', 2: 'Error de red',
            3: 'Formato no soportado', 4: 'Fuente inaccesible',
          };
          setVideoLoading(false);
          setVideoError(msgs[code] ?? `Error (código ${code})`);
        }}
      />

      {/* Canvas overlay — tracks en tiempo real */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ── Estado vacío ── */}
      {!videoPath && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
          <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.277A1 1 0 0121 8.677v6.646a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p className="text-sm font-medium">Selecciona un video de drone para comenzar</p>
        </div>
      )}

      {/* ── Cargando video ── */}
      {videoPath && videoLoading && !videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-300">Cargando video…</p>
        </div>
      )}

      {/* ── Error ── */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3 px-6 text-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-red-300 font-medium">{videoError}</p>
          <p className="text-xs text-slate-500">MP4 / H.264 · WebM</p>
        </div>
      )}

      {/* ── Cargando modelo ── */}
      {status === 'loading_model' && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-amber-500/20 border border-amber-500/50 rounded-full px-3 py-1">
          <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-amber-300 font-medium">Cargando modelo…</span>
        </div>
      )}

      {/* ── Badge análisis ── */}
      {(isAnalyzing || isCancelling) && !autoPaused && (
        <div className={`absolute top-3 left-3 flex items-center gap-2 rounded-full px-3 py-1
                         ${isCancelling
                           ? 'bg-red-500/20 border border-red-500/50'
                           : 'bg-cyan-500/20 border border-cyan-500/50'}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse
                            ${isCancelling ? 'bg-red-400' : 'bg-cyan-400'}`} />
          <span className={`text-xs font-medium ${isCancelling ? 'text-red-300' : 'text-cyan-300'}`}>
            {isCancelling ? 'Cancelando…' : `Analizando · ${analysisPct.toFixed(0)}%`}
          </span>
        </div>
      )}

      {/* ── Detecciones activas ── */}
      {isAnalyzing && tracks.length > 0 && !autoPaused && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/20 border border-green-500/50 rounded-full px-3 py-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-300 font-medium">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} activo{tracks.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── AUTO-PAUSA — detección de alta confianza ── */}
      {autoPaused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-4">
          <div className="bg-slate-900/95 border border-cyan-500/60 rounded-xl px-6 py-5 flex flex-col items-center gap-3 max-w-xs text-center shadow-2xl">
            <div className="flex items-center gap-2 text-cyan-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-bold uppercase tracking-wider">Detección confirmada</span>
            </div>
            <p className="text-xs text-slate-300">
              Se detectó un rastro con alta confianza sostenida. Revisa el hitbox en pantalla.
            </p>
            {tracks.map(t => t.confidence >= 0.80 && (
              <div key={t.id} className="text-xs font-mono text-cyan-300">
                #{t.id} {t.className} — {(t.confidence * 100).toFixed(1)}% · {t.hits} frames
              </div>
            ))}
            <button
              onClick={resumeAnalysis}
              className="mt-1 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continuar análisis
            </button>
          </div>
        </div>
      )}

      {/* ── Barra de progreso ── */}
      {(isAnalyzing || isCancelling) && analysisPct > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700/80">
          <div
            className={`h-full transition-all duration-500 ${isCancelling ? 'bg-red-500' : 'bg-cyan-500'}`}
            style={{ width: `${analysisPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
