import { useEffect, useRef } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { ControlBar }  from './components/ControlBar';
import { StatsPanel }  from './components/StatsPanel';
import { ExportPanel } from './components/ExportPanel';
import { useAnalysisStore } from './store/analysisStore';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    useAnalysisStore.getState().setHardware({
      executionProvider: 'WASM (onnxruntime-web)',
      modelLoaded: false,
      classNames: ['Fox', 'Track', 'Turtle'],
      numClasses: 3,
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐢</span>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-tight">Sistema Inteligente Basado en UAV y YOLO26</h1>
            <p className="text-xs text-slate-400 leading-tight">Detección de Rastros de Anidación de Tortugas Marinas</p>
          </div>
        </div>
        <span className="text-xs text-slate-500 font-mono">v1.0.0 · YOLO26n</span>
      </header>

      {/* Main layout */}
      <main className="flex flex-col lg:flex-row flex-1 gap-4 p-4 overflow-y-auto lg:overflow-hidden">

        {/* Columna principal: video + controles */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <VideoPlayer videoRef={videoRef} />
          <ControlBar  videoRef={videoRef} />
        </div>

        {/* Columna secundaria: estadísticas + exportar */}
        <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-visible lg:overflow-y-auto shrink-0 lg:pr-2">
          <StatsPanel />
          <ExportPanel />
        </div>
      </main>
    </div>
  );
}
