import { useState, useCallback, useEffect, RefObject } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAnalysisStore } from '../store/analysisStore';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';

interface ControlBarProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function ControlBar({ videoRef }: ControlBarProps) {
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const { status, videoDuration, videoPath, videoName, config, setConfig, progress } =
    useAnalysisStore();

  const { startAnalysis, cancelAnalysis } = useVideoAnalysis(videoRef);
  const autoPaused = useAnalysisStore((s) => s.autoPaused);

  const isAnalyzing  = (status === 'analyzing' || status === 'loading_model' || status === 'cancelling') && !autoPaused;
  const isCancelling = status === 'cancelling';

  // ── Eventos del elemento video ──────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onEnded      = () => setIsPlaying(false);
    const onPause      = () => setIsPlaying(false);
    const onPlay       = () => setIsPlaying(true);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended',      onEnded);
    v.addEventListener('pause',      onPause);
    v.addEventListener('play',       onPlay);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended',      onEnded);
      v.removeEventListener('pause',      onPause);
      v.removeEventListener('play',       onPlay);
    };
  }, [videoRef, videoDuration]); // re-attach when video changes

  // ── Sincronizar scrubber con el frame analizado ─────────────
  useEffect(() => {
    if (status === 'analyzing' && progress) {
      setCurrentTime(progress.currentTimestamp);
    }
  }, [status, progress]);

  // ── Seleccionar video ───────────────────────────────────────
  const handleSelectVideo = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });

    console.log('[ControlBar] Dialog resultado:', selected, typeof selected);
    if (!selected || typeof selected !== 'string') {
      console.warn('[ControlBar] Selección inválida o cancelada');
      return;
    }

    const assetUrl = convertFileSrc(selected);
    console.log('[ControlBar] Path original:', selected);
    console.log('[ControlBar] Asset URL:', assetUrl);

    const store = useAnalysisStore.getState();
    store.resetAnalysis();
    store.setVideoPath(assetUrl, selected.split(/[\\/]/).pop() ?? selected);

    if (videoRef.current) {
      console.log('[ControlBar] Asignando src al elemento video…');
      videoRef.current.src = assetUrl;
      videoRef.current.load();
      console.log('[ControlBar] video.load() llamado');
    } else {
      console.error('[ControlBar] videoRef.current es null');
    }
    
    setCurrentTime(0);
    setIsPlaying(false);
  }, [videoRef]);

  // ── Controles de reproducción ───────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  }, [videoRef]);

  const seek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, [videoRef]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  }, [videoRef]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const analysisPct = progress
    ? Math.min(100, (progress.currentFrame / progress.totalFrames) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700">

      {/* Scrubber de tiempo */}
      {videoDuration > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono w-10 shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={videoDuration}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              disabled={isAnalyzing}
              className="w-full h-1 accent-cyan-500 cursor-pointer disabled:cursor-default"
            />
            {/* Barra de progreso del análisis */}
            {isAnalyzing && analysisPct > 0 && (
              <div
                className="absolute top-0 left-0 h-1 bg-cyan-500/40 rounded-full pointer-events-none"
                style={{ width: `${analysisPct}%` }}
              />
            )}
          </div>
          <span className="text-xs text-slate-400 font-mono w-10 shrink-0 text-right">
            {formatTime(videoDuration)}
          </span>
        </div>
      )}

      {/* Fila de controles */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Seleccionar video */}
        <button
          onClick={handleSelectVideo}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600
                     rounded-lg text-slate-200 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          Seleccionar video
        </button>

        {/* Nombre del video */}
        {videoName && (
          <span className="text-xs text-slate-400 truncate max-w-[160px]" title={videoName}>
            {videoName}
          </span>
        )}

        <div className="flex-1" />

        {/* Retroceder 10s */}
        <button
          onClick={() => seek(-10)}
          disabled={!videoDuration || isAnalyzing}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300
                     transition-colors disabled:opacity-40"
          title="Retroceder 10 s"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!videoDuration || isAnalyzing}
          className="p-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white
                     transition-colors disabled:opacity-40"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Avanzar 10s */}
        <button
          onClick={() => seek(10)}
          disabled={!videoDuration || isAnalyzing}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300
                     transition-colors disabled:opacity-40"
          title="Avanzar 10 s"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-slate-600" />

        {/* FPS de análisis */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">FPS análisis</label>
          <select
            value={config.analysisFps}
            onChange={(e) => setConfig({ analysisFps: parseInt(e.target.value) })}
            disabled={isAnalyzing}
            className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1
                       text-slate-200 disabled:opacity-40"
          >
            {[2, 3, 5, 8, 10].map((fps) => (
              <option key={fps} value={fps}>{fps} fps</option>
            ))}
          </select>
        </div>

        {/* Umbral de confianza */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Confianza</label>
          <select
            value={config.confidenceThreshold}
            onChange={(e) => setConfig({ confidenceThreshold: parseFloat(e.target.value) })}
            disabled={isAnalyzing}
            className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1
                       text-slate-200 disabled:opacity-40"
          >
            {[0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50].map((v) => (
              <option key={v} value={v}>{(v * 100).toFixed(0)}%</option>
            ))}
          </select>
        </div>

        {/* Analizar / Cancelar */}
        {isAnalyzing ? (
          <button
            onClick={cancelAnalysis}
            disabled={isCancelling}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors
                        ${isCancelling
                          ? 'bg-red-900 opacity-60 cursor-not-allowed'
                          : 'bg-red-700 hover:bg-red-600'}`}
          >
            <span className={`w-2 h-2 rounded-full ${isCancelling ? 'bg-red-400' : 'bg-red-300 animate-pulse'}`} />
            {isCancelling ? 'Cancelando…' : 'Cancelar'}
          </button>
        ) : (
          <button
            onClick={startAnalysis}
            disabled={!videoDuration}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-700 hover:bg-green-600
                       rounded-lg text-white font-semibold transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            Iniciar análisis
          </button>
        )}
      </div>
    </div>
  );
}
