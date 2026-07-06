import { create } from 'zustand';
import type {
  AnalysisConfig,
  AnalysisResult,
  AnalysisStatus,
  Detection,
  HardwareInfo,
  ProgressUpdate,
  Track,
} from '../types';

interface AnalysisStore {
  videoPath:     string | null;
  videoName:     string | null;
  videoDuration: number;

  config:   AnalysisConfig;
  status:   AnalysisStatus;
  progress: ProgressUpdate | null;
  error:    string | null;
  hardware: HardwareInfo | null;

  detections: Detection[];   // historial completo para export
  tracks:     Track[];       // tracks activos en el frame actual (overlay)
  result:     AnalysisResult | null;

  autoPaused: boolean;       // pausado automáticamente por detección de alta confianza

  setVideoPath:     (path: string, name: string) => void;
  setVideoDuration: (duration: number) => void;
  setConfig:        (patch: Partial<AnalysisConfig>) => void;
  setStatus:        (status: AnalysisStatus) => void;
  setProgress:      (progress: ProgressUpdate) => void;
  addDetection:     (detection: Detection) => void;
  setTracks:        (tracks: Track[]) => void;
  setResult:        (result: AnalysisResult) => void;
  setError:         (error: string | null) => void;
  setHardware:      (info: HardwareInfo) => void;
  setAutoPaused:    (v: boolean) => void;
  resetAnalysis:    () => void;
  clearVideo:       () => void;
}

const DEFAULT_CONFIG: AnalysisConfig = {
  analysisFps:         5,
  confidenceThreshold: 0.25,
};

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  videoPath:     null,
  videoName:     null,
  videoDuration: 0,

  config:    DEFAULT_CONFIG,
  status:    'idle',
  progress:  null,
  error:     null,
  hardware:  null,

  detections: [],
  tracks:     [],
  result:     null,
  autoPaused: false,

  setVideoPath:     (path, name) => set({ videoPath: path, videoName: name }),
  setVideoDuration: (duration)   => set({ videoDuration: duration }),
  setConfig:        (patch)      => set((s) => ({ config: { ...s.config, ...patch } })),
  setStatus:        (status)     => set({ status }),
  setProgress:      (progress)   => set({ progress }),
  addDetection:     (d)          => set((s) => ({ detections: [...s.detections, d] })),
  setTracks:        (tracks)     => set({ tracks }),
  setResult:        (result)     => set({ result }),
  setError:         (error)      => set({ error }),
  setHardware:      (hardware)   => set({ hardware }),
  setAutoPaused:    (autoPaused) => set({ autoPaused }),

  resetAnalysis: () => set({
    status:     'idle',
    progress:   null,
    error:      null,
    detections: [],
    tracks:     [],
    result:     null,
    autoPaused: false,
  }),

  clearVideo: () => set({
    videoPath:     null,
    videoName:     null,
    videoDuration: 0,
    status:        'idle',
    progress:      null,
    error:         null,
    detections:    [],
    tracks:        [],
    result:        null,
    autoPaused:    false,
  }),
}));
