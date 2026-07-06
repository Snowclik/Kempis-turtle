# ================================================================
# Tortugas AI — Script de Entrenamiento
# Modelo  : YOLO26n (Ultralytics)
# Dataset : Turtle Track Detector 2 — Roboflow
# Salida  : model.onnx + model_meta.json
#
# Funciona en:
#   • Google Colab  (Runtime > Change runtime type > GPU T4/A100)
#   • PC Gamer local con GPU NVIDIA  (RTX 3000/4000/...)
#   • CPU como fallback (lento, solo para pruebas)
#
# En PC local: ejecutar con VS Code + extensión Jupyter, o con:
#   python training/colab_train.py
# ================================================================

import subprocess, sys, os

# ─────────────────────────────────────────────────────────────
# Instalar dependencias (funciona en Colab y en local)
# ─────────────────────────────────────────────────────────────
def pip(*pkgs):
    subprocess.check_call([sys.executable, "-m", "pip", "install", *pkgs, "--quiet"])

pip("ultralytics", "roboflow", "onnx", "onnxsim", "psutil")


# %% ── CELDA 1: Detectar entorno ──────────────────────────────
import time, json, shutil, yaml, psutil
from pathlib import Path

import torch
import numpy as np

def is_colab() -> bool:
    try:
        import google.colab  # type: ignore[import]  # noqa: F401
        return True
    except ImportError:
        return False

IN_COLAB = is_colab()

print("=" * 65)
print("  Tortugas AI — Entrenamiento YOLO26n")
print("=" * 65)
print(f"Entorno  : {'Google Colab' if IN_COLAB else 'Local / PC Gamer'}")
print(f"Python   : {sys.version.split()[0]}")
print(f"PyTorch  : {torch.__version__}")


# %% ── CELDA 2: Detección y configuración de GPU ─────────────

def detect_gpu():
    """
    Detecta la GPU disponible y devuelve:
      device   : str  — "cuda:0" | "cpu"
      vram_gb  : float — VRAM total en GB (0 si es CPU)
      gpu_name : str  — nombre de la GPU
      arch     : str  — arquitectura CUDA ("ampere", "ada", "turing", "other", "cpu")
    """
    if not torch.cuda.is_available():
        return "cpu", 0.0, "Sin GPU", "cpu"

    props    = torch.cuda.get_device_properties(0)
    vram_gb  = props.total_memory / 1024**3
    gpu_name = torch.cuda.get_device_name(0)
    major    = props.major

    # Clasificar arquitectura por compute capability major version
    arch_map = {8: "ampere_ada", 7: "turing_volta", 6: "pascal"}
    # Ada Lovelace (RTX 4000) tiene compute 8.9, Ampere (RTX 3000) tiene 8.6
    arch = arch_map.get(major, "other")

    return "cuda:0", vram_gb, gpu_name, arch


def optimal_batch(vram_gb: float) -> int:
    """
    Batch size óptimo según VRAM disponible.
    Se deja un 30% libre para activaciones y gradientes.
    """
    if vram_gb >= 20: return 64   # RTX 4090, A100
    if vram_gb >= 16: return 48   # RTX 4080, RTX 3090
    if vram_gb >= 12: return 32   # RTX 4070 Ti, RTX 3080 Ti, RTX 4070
    if vram_gb >= 8:  return 16   # RTX 4060 Ti, RTX 3070, RTX 3060 12GB
    if vram_gb >= 6:  return 12   # RTX 3060
    if vram_gb >= 4:  return 8    # GTX 1660, RTX 3050
    return -1                     # auto (conservador, para < 4 GB)


def optimal_workers() -> int:
    """
    Workers de DataLoader: equilibrio entre velocidad de carga y presión de CPU.
    Regla: min(8, núcleos_físicos // 2)
    """
    cpu_count = os.cpu_count() or 4
    return min(8, max(2, cpu_count // 2))


def optimal_cache(vram_gb: float) -> str | bool:
    """
    Cache del dataset para eliminar I/O entre epochs.
      'ram'  : carga todo en RAM → 2-3x más rápido por epoch (requiere RAM libre)
      'disk' : preprocess una vez, guarda en disco → más rápido que sin cache
      False  : sin cache (solo si RAM es muy escasa)

    Con GPU potente (vram_gb >= 8) la inferencia es tan rápida que la carga
    de datos se convierte en el cuello de botella → priorizar cache en RAM.
    """
    ram_available_gb = psutil.virtual_memory().available / 1024**3
    # Dataset ~2000 imágenes preprocesado ≈ 200-500 MB
    # GPU rápida consume datos más rápido → umbral menor para activar RAM cache
    ram_threshold = 6.0 if vram_gb >= 8 else 8.0
    if ram_available_gb >= ram_threshold: return "ram"
    if ram_available_gb >= 3.0:          return "disk"
    return False


def optimal_imgsz(vram_gb: float) -> int:
    """
    Imágenes más grandes → más detalle en objetos pequeños (rastros delgados).
    Solo aumentamos si hay VRAM suficiente.
    """
    if vram_gb >= 16: return 800   # mayor resolución para rastros delgados
    return 640                     # estándar YOLO, suficiente para la mayoría


# ── Detectar GPU ──────────────────────────────────────────────
DEVICE, VRAM_GB, GPU_NAME, GPU_ARCH = detect_gpu()
BATCH       = optimal_batch(VRAM_GB)
WORKERS     = optimal_workers()
CACHE       = optimal_cache(VRAM_GB)
IMGSZ       = optimal_imgsz(VRAM_GB)
RAM_TOTAL   = psutil.virtual_memory().total / 1024**3
CPU_CORES   = os.cpu_count() or 4

print(f"\n{'─'*65}")
print(f"  Hardware detectado")
print(f"{'─'*65}")
print(f"  GPU        : {GPU_NAME}")
print(f"  VRAM       : {VRAM_GB:.1f} GB")
print(f"  Arquitectura: {GPU_ARCH}")
print(f"  RAM total  : {RAM_TOTAL:.1f} GB")
print(f"  CPU cores  : {CPU_CORES}")
print(f"{'─'*65}")
print(f"  Config optimizada:")
print(f"    device   = {DEVICE}")
print(f"    batch    = {BATCH}  {'(auto)' if BATCH == -1 else ''}")
print(f"    workers  = {WORKERS}")
print(f"    cache    = {CACHE!r}")
print(f"    imgsz    = {IMGSZ}")
print(f"{'─'*65}")

# ── Optimizaciones CUDA específicas por arquitectura ──────────
if torch.cuda.is_available():

    # cudnn.benchmark: prueba distintos algoritmos de convolución al inicio
    # y elige el más rápido para el tamaño de entrada fijo.
    # Ganancia: 10–30% en velocidad de forward pass.
    torch.backends.cudnn.benchmark = True

    # TF32: aritmética de 19 bits para matmul y convoluciones.
    # Solo disponible en Ampere (RTX 3000, cc 8.x) y más moderno.
    # PyTorch lo activa por defecto en Ampere, pero lo forzamos explícito.
    # Ganancia: 2-3x en operaciones de matriz, con pérdida de precisión
    # prácticamente imperceptible en entrenamiento de detección.
    if GPU_ARCH in ("ampere_ada",):
        torch.backends.cuda.matmul.allow_tf32  = True
        torch.backends.cudnn.allow_tf32         = True
        print("TF32 habilitado (Ampere/Ada — RTX 3000/4000)")

    # Información de CUDA/cuDNN
    print(f"\nCUDA       : {torch.version.cuda}")
    print(f"cuDNN      : {torch.backends.cudnn.version()}")
    print(f"Compute    : {torch.cuda.get_device_properties(0).major}."
          f"{torch.cuda.get_device_properties(0).minor}")

    # Limpiar cache de GPU antes de empezar
    torch.cuda.empty_cache()
    free_vram = (torch.cuda.get_device_properties(0).total_memory -
                 torch.cuda.memory_reserved(0)) / 1024**3
    print(f"VRAM libre : {free_vram:.1f} GB")


# %% ── CELDA 3: Descargar dataset desde Roboflow ──────────────
from roboflow import Roboflow

API_KEY   = "7Omu3VdrXRZCnyZJs8CP"
WORKSPACE = "german-university-of-technology-f4tuz"
PROJECT   = "turtle-track-detector-2"

rf      = Roboflow(api_key=API_KEY)
project = rf.workspace(WORKSPACE).project(PROJECT)

versions = project.versions()
print(f"\nVersiones disponibles: {sorted([v.version for v in versions])}")

latest  = max(versions, key=lambda v: v.version)
print(f"Usando versión {latest.version} ...")
dataset = latest.download("yolov8")   # formato compatible con YOLO26

DATA_YAML = Path(dataset.location) / "data.yaml"
with open(DATA_YAML) as f:
    data_cfg = yaml.safe_load(f)

raw_names   = data_cfg["names"]
CLASS_NAMES = list(raw_names.values()) if isinstance(raw_names, dict) else list(raw_names)
NUM_CLASSES = len(CLASS_NAMES)

print(f"Dataset : {dataset.location}")
print(f"Clases  : {CLASS_NAMES}  ({NUM_CLASSES} clases)")


# %% ── CELDA 4: Entrenamiento ─────────────────────────────────
from ultralytics import YOLO

model = YOLO("yolo26n.pt")

# ── Ajuste de hiperparámetros según hardware ──────────────────
# lr0 se escala con el batch size efectivo (linear scaling rule):
#   batch=16 → lr0=0.001 (base)
#   batch=32 → lr0=0.002
#   batch=64 → lr0=0.004
base_lr = 0.001
effective_batch = BATCH if BATCH > 0 else 16
LR0 = base_lr * max(1.0, effective_batch / 16)
LR0 = round(min(LR0, 0.01), 4)   # cap en 0.01 para estabilidad

print(f"\nLR0 ajustado: {LR0}  (batch={BATCH}, base={base_lr})")

results = model.train(
    data=str(DATA_YAML),

    # ── Duración ─────────────────────────────────────────────
    # epochs=150        : suficiente para ~2000 imágenes
    # patience=30       : early stopping si no mejora en 30 epochs
    epochs=150,
    patience=30,

    # ── Resolución y batch ───────────────────────────────────
    # imgsz: 640 estándar / 800 si hay VRAM suficiente (más detalle en rastros finos)
    # batch: calculado por VRAM disponible arriba
    imgsz=IMGSZ,
    batch=BATCH,

    # ── Dispositivo ──────────────────────────────────────────
    device=DEVICE,

    # ── Precisión mixta (AMP) ────────────────────────────────
    # amp=True: usa float16 en forward/backward, float32 en parámetros.
    # Ganancia: 30-50% velocidad, 50% menos VRAM → batch más grande.
    amp=True,

    # ── Optimizador ──────────────────────────────────────────
    # AdamW: mejor convergencia que SGD en datasets pequeños (<5k imágenes)
    # lr0: escalado lineal con batch size (ver cálculo arriba)
    # weight_decay: regularización para evitar overfitting
    optimizer="AdamW",
    lr0=LR0,
    lrf=0.01,
    momentum=0.937,
    weight_decay=0.0005,
    warmup_epochs=5,
    warmup_momentum=0.8,
    warmup_bias_lr=0.1,

    # ── Cache de dataset ─────────────────────────────────────
    # Elimina I/O de disco entre epochs → 2-3x más rápido por epoch
    # 'ram': carga todo en RAM  |  'disk': preprocess una vez en disco
    cache=CACHE,

    # ── Workers de DataLoader ────────────────────────────────
    # Threads para cargar y preprocesar imágenes en paralelo
    # Con cache=ram este valor importa menos, pero sigue acelerando el warmup
    workers=WORKERS,

    # ── Augmentación (específica para playas y drones) ───────
    # degrees=180  : rotación completa — drones apuntan en cualquier dirección
    # scale=0.5    : variación de escala — altitud del dron varía
    # hsv_v=0.4    : variación de brillo — sol directo vs nublado
    # flipud/lr    : volteos — rastros no tienen orientación canónica
    # mosaic=1.0   : combina 4 imágenes → excelente para objetos pequeños/delgados
    # copy_paste   : pega rastros en otras imágenes → más variedad espacial
    hsv_h=0.015,
    hsv_s=0.4,
    hsv_v=0.4,
    degrees=180.0,
    translate=0.1,
    scale=0.5,
    shear=0.0,
    perspective=0.0,
    flipud=0.5,
    fliplr=0.5,
    mosaic=1.0,
    mixup=0.05,
    copy_paste=0.3,

    # ── Checkpoints y logs ───────────────────────────────────
    close_mosaic=15,       # apaga mosaic en últimos 15 epochs → convergencia estable
    label_smoothing=0.0,
    project="turtle_detection",
    name="yolo26n_v1",
    save=True,
    save_period=10,
    plots=True,
    val=True,
    verbose=True,
)

# ── Resumen post-entrenamiento ────────────────────────────────
print("\n" + "=" * 65)
print("  ENTRENAMIENTO COMPLETADO")
print("=" * 65)
print(f"  mAP50    : {results.results_dict.get('metrics/mAP50(B)', 0):.4f}")
print(f"  mAP50-95 : {results.results_dict.get('metrics/mAP50-95(B)', 0):.4f}")

if torch.cuda.is_available():
    peak_vram = torch.cuda.max_memory_allocated(0) / 1024**3
    print(f"  VRAM peak: {peak_vram:.2f} GB / {VRAM_GB:.1f} GB  "
          f"({peak_vram/VRAM_GB*100:.0f}% utilizado)")

BEST_PT = Path("turtle_detection/yolo26n_v1/weights/best.pt")
assert BEST_PT.exists(), f"No se encontró el mejor modelo: {BEST_PT}"
print(f"\n  Mejor modelo: {BEST_PT}")


# %% ── CELDA 5: Validación ────────────────────────────────────
model_best = YOLO(str(BEST_PT))

val_batch = min(32, BATCH if BATCH > 0 else 32)
val = model_best.val(
    data=str(DATA_YAML),
    imgsz=IMGSZ,
    batch=val_batch,
    conf=0.25,
    iou=0.45,
    device=DEVICE,
    plots=True,
    save_json=True,
)

print(f"\n{'─'*45}")
print(f"  Resultados de Validación")
print(f"{'─'*45}")
print(f"  mAP50     : {val.box.map50:.4f}")
print(f"  mAP50-95  : {val.box.map:.4f}")
print(f"  Precisión : {val.box.p.mean():.4f}")
print(f"  Recall    : {val.box.r.mean():.4f}")
print(f"{'─'*45}")
for i, cls in enumerate(CLASS_NAMES):
    try:
        print(f"  [{cls}]  AP50={val.box.ap50[i]:.3f}  AP={val.box.ap[i]:.3f}")
    except Exception:
        pass


# %% ── CELDA 6: Exportar a ONNX ───────────────────────────────
# YOLO26 usa cabeza one-to-one (end-to-end):
#   Salida: [1, 300, 6]  →  [x1, y1, x2, y2, confianza, class_id]
#   Formato: xyxy píxeles (0–640)
#   Sin NMS requerido — el modelo produce detecciones finales directamente
print("\nExportando a ONNX...")

onnx_path = model_best.export(
    format="onnx",
    imgsz=640,           # siempre 640 para el ONNX de inferencia (portabilidad)
    opset=12,            # opset 12: máxima compatibilidad ONNX Runtime / DirectML
    simplify=True,
    dynamic=False,       # batch fijo = 1 → más rápido en ONNX Runtime
    half=False,          # float32: compatible con DirectML, CPU y cualquier EP
    int8=False,
    batch=1,
    device="cpu",        # exportar en CPU para máxima compatibilidad del .onnx
)
print(f"ONNX exportado: {onnx_path}")

import onnx
onnx_model = onnx.load(onnx_path)
onnx.checker.check_model(onnx_model)
print("Modelo ONNX válido ✓")

print("\nEntradas:")
for inp in onnx_model.graph.input:
    dims = [d.dim_value for d in inp.type.tensor_type.shape.dim]
    print(f"  {inp.name}: {dims}")

print("Salidas:")
for out in onnx_model.graph.output:
    dims = [d.dim_value for d in out.type.tensor_type.shape.dim]
    print(f"  {out.name}: {dims}   ← esperado [1, 300, 6]")


# %% ── CELDA 7: Simplificar y validar ONNX ───────────────────
import onnxsim

print("\nSimplificando ONNX...")
simplified, ok = onnxsim.simplify(onnx_model)

if ok:
    simplified_path = onnx_path.replace(".onnx", "_simplified.onnx")
    onnx.save(simplified, simplified_path)
    orig_kb = os.path.getsize(onnx_path) / 1024
    simp_kb = os.path.getsize(simplified_path) / 1024
    print(f"  Original    : {orig_kb:.0f} KB")
    print(f"  Simplificado: {simp_kb:.0f} KB  (-{(1-simp_kb/orig_kb)*100:.1f}%)")
    FINAL_ONNX = simplified_path
else:
    print("  Simplificación no disponible, usando original.")
    FINAL_ONNX = onnx_path


# %% ── CELDA 8: Benchmark ONNX Runtime ───────────────────────
import onnxruntime as ort_rt

providers = (
    ["CUDAExecutionProvider", "CPUExecutionProvider"]
    if torch.cuda.is_available() else ["CPUExecutionProvider"]
)

session    = ort_rt.InferenceSession(FINAL_ONNX, providers=providers)
input_name = session.get_inputs()[0].name
dummy      = np.random.rand(1, 3, 640, 640).astype(np.float32)

for _ in range(5):
    session.run(None, {input_name: dummy})

N = 50
t0 = time.perf_counter()
for _ in range(N):
    out = session.run(None, {input_name: dummy})
elapsed = time.perf_counter() - t0

print(f"\nBenchmark ONNX Runtime ({N} inferencias):")
print(f"  Proveedor      : {session.get_providers()[0]}")
print(f"  Forma de salida: {out[0].shape}   ← esperado [1, 300, 6]")
print(f"  Tiempo/frame   : {elapsed/N*1000:.2f} ms")
print(f"  FPS teórico    : {N/elapsed:.1f}")


# %% ── CELDA 9: Metadata de clases ────────────────────────────
meta = {
    "model_name"    : "yolo26n",
    "dataset"       : "turtle-track-detector-2",
    "version"       : "1.0.0",
    "input_size"    : 640,
    "num_classes"   : NUM_CLASSES,
    "class_names"   : CLASS_NAMES,
    "output_shape"  : [1, 300, 6],
    "output_format" : "xyxy_pixel",
    "value_order"   : ["x1", "y1", "x2", "y2", "confidence", "class_id"],
    "nms_required"  : False,
    "max_detections": 300,
    "trained_with"  : {
        "gpu"  : GPU_NAME,
        "vram" : f"{VRAM_GB:.1f} GB",
        "batch": BATCH,
        "imgsz": IMGSZ,
    },
}

meta_path = FINAL_ONNX.replace(".onnx", "_meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

print(f"\nMetadata guardada: {meta_path}")
print(json.dumps(meta, indent=2, ensure_ascii=False))


# %% ── CELDA 10: Guardar archivos ─────────────────────────────
# Comportamiento diferente según entorno:
#   Colab : descarga automática al navegador
#   Local : copia directo a src-tauri/resources/ del proyecto

if IN_COLAB:
    from google.colab import files  # type: ignore[import]
    print("\nDescargando desde Colab...")
    files.download(FINAL_ONNX)
    files.download(meta_path)
    files.download(str(BEST_PT))
    shutil.make_archive("training_results", "zip", "turtle_detection/yolo26n_v1")
    files.download("training_results.zip")

else:
    # Detectar directorio raíz del proyecto (sube hasta encontrar apps/)
    script_dir  = Path(__file__).resolve().parent
    project_root = script_dir.parent

    resources_dir = project_root / "apps" / "desktop" / "src-tauri" / "resources"
    resources_dir.mkdir(parents=True, exist_ok=True)

    dst_onnx = resources_dir / "model.onnx"
    dst_meta = resources_dir / "model_meta.json"

    shutil.copy2(FINAL_ONNX, dst_onnx)
    shutil.copy2(meta_path,  dst_meta)

    # Zip de resultados en models/
    models_dir = project_root / "models"
    models_dir.mkdir(exist_ok=True)
    shutil.make_archive(str(models_dir / "training_results"), "zip",
                        "turtle_detection/yolo26n_v1")

    print("\n" + "=" * 65)
    print("  ARCHIVOS COPIADOS AUTOMÁTICAMENTE")
    print("=" * 65)
    print(f"  model.onnx       → {dst_onnx}")
    print(f"  model_meta.json  → {dst_meta}")
    print(f"  training_results → {models_dir / 'training_results.zip'}")
    print("\n  Ya puedes compilar la app con:  npm run tauri build")

print("\nFin del entrenamiento.")
