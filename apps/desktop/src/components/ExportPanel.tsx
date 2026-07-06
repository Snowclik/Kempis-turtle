import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useAnalysisStore } from '../store/analysisStore';

export function ExportPanel() {
  const { result, videoName, status } = useAnalysisStore();
  const canExport = !!result && result.detections.length > 0;

  const baseName = videoName
    ? videoName.replace(/\.[^.]+$/, '')
    : 'detecciones';

  const exportFile = useCallback(async (format: 'csv' | 'json') => {
    if (!result) return;

    const ext      = format === 'csv' ? 'csv' : 'json';
    const filePath = await save({
      defaultPath: `${baseName}_tortugas.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }],
    });

    if (!filePath) return;

    // Serializar detecciones con timestamp y frameIndex incluidos
    const payload = result.detections.map((d) => ({
      frameIndex:  d.frameIndex,
      timestamp:   d.timestamp,
      classId:     d.classId,
      className:   d.className,
      confidence:  d.confidence,
      bbox:        d.bbox,
    }));

    try {
      await invoke('export_results', {
        detections: payload,
        format,
        filePath,
      });
      alert(`Exportado en: ${filePath}`);
    } catch (err) {
      alert(`Error al exportar: ${err}`);
    }
  }, [result, baseName]);

  if (status !== 'complete' && status !== 'cancelled') return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Exportar resultados</h3>

      {canExport ? (
        <div className="flex gap-2">
          <button
            onClick={() => exportFile('csv')}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm
                       bg-emerald-800 hover:bg-emerald-700 rounded-lg text-white
                       font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>

          <button
            onClick={() => exportFile('json')}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm
                       bg-blue-800 hover:bg-blue-700 rounded-lg text-white
                       font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Exportar JSON
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Sin detecciones para exportar en este análisis.
        </p>
      )}

      {canExport && (
        <p className="text-xs text-slate-500 mt-2">
          {result!.detections.length} detección{result!.detections.length !== 1 ? 'es' : ''} —
          incluye: frame, timestamp, clase, confianza, coordenadas
        </p>
      )}
    </div>
  );
}
