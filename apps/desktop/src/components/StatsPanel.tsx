import { useAnalysisStore } from '../store/analysisStore';

export function StatsPanel() {
  const { status, progress, result, detections, hardware, error } = useAnalysisStore();

  const formatMs  = (ms: number) => ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(1)} s`;
  const formatTime = (s: number) => {
    if (s < 60) return `${s.toFixed(0)} s`;
    return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  };
  const pct = (p: any) => {
    if (!p) return 0;
    return Math.min(100, (p.currentFrame / p.totalFrames) * 100);
  };

  const isActive = status === 'analyzing' || status === 'loading_model' || status === 'cancelling';

  return (
    <div className="flex flex-col gap-4">

      {/* Hardware info */}
      {hardware && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Hardware</p>
          <p className="text-sm font-medium text-cyan-400">{hardware.executionProvider}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {hardware.numClasses} clase{hardware.numClasses !== 1 ? 's' : ''}:{' '}
            {hardware.classNames.join(', ')}
          </p>
        </div>
      )}

      {/* Cargando modelo */}
      {status === 'loading_model' && (
        <div className="bg-slate-800 border border-amber-700/50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm text-amber-300 font-medium">Cargando modelo ONNX…</p>
            <p className="text-xs text-slate-500 mt-0.5">Puede tardar unos segundos la primera vez</p>
          </div>
        </div>
      )}

      {/* Progreso */}
      {(status === 'analyzing' || status === 'cancelling') && progress && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-200">
              {status === 'cancelling' ? 'Cancelando…' : 'Progreso'}
            </span>
            <span className="text-sm font-mono text-cyan-400">{pct(progress).toFixed(0)}%</span>
          </div>

          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${status === 'cancelling' ? 'bg-red-500' : 'bg-cyan-500'}`}
              style={{ width: `${pct(progress)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Frames"      value={`${progress.currentFrame} / ${progress.totalFrames}`} />
            <Stat label="FPS real"    value={`${progress.fps}`} accent />
            <Stat label="ETA"         value={formatTime(progress.etaSeconds)} />
            <Stat label="Detectados"  value={String(progress.detectionsFound)} accent />
            <Stat label="Inferencia"  value={`${progress.lastInferenceMs.toFixed(0)} ms`} />
            <Stat label="Timestamp"   value={`${progress.currentTimestamp.toFixed(1)} s`} />
          </div>
        </div>
      )}

      {/* Resultados finales */}
      {result && (
        <div className="bg-slate-800 border border-green-800/50 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm font-semibold text-green-400">Análisis completado</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BigStat label="Detecciones" value={String(result.detections.length)} />
            <BigStat label="FPS real"    value={result.realFps.toFixed(1)} />
            <Stat label="Frames analizados" value={String(result.totalFramesAnalyzed)} />
            <Stat label="Tiempo total"      value={formatMs(result.processingTimeMs)} />
            <Stat label="Duración video"    value={formatTime(result.videoDuration)} />
            <Stat
              label="Confianza media"
              value={`${(result.averageConfidence * 100).toFixed(1)}%`}
              accent
            />
          </div>

          {/* Distribución por clase */}
          {result.detections.length > 0 && (
            <ClassBreakdown detections={result.detections} />
          )}
        </div>
      )}

      {/* Estado idle */}
      {status === 'idle' && !result && (
        <div className="text-center text-slate-600 text-sm py-8">
          <p>Selecciona un video y pulsa</p>
          <p className="font-medium text-slate-500 mt-1">«Iniciar análisis»</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300 break-words">
          <p className="font-semibold mb-1">Error durante el análisis</p>
          {error && <p className="font-mono text-xs opacity-90">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-mono font-medium ${accent ? 'text-cyan-400' : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold font-mono text-cyan-400">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function ClassBreakdown({ detections }: { detections: { className: string }[] }) {
  const counts = detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.className] = (acc[d.className] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Por clase</p>
      <div className="flex flex-col gap-1">
        {Object.entries(counts).map(([cls, count]) => (
          <div key={cls} className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{cls}</span>
            <span className="font-mono text-cyan-400">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
