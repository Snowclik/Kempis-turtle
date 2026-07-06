<div id="top">

<p align="center">
  <img src="https://img.shields.io/badge/Kempis_Turtle_Tracker-🐢-1A8A4A?style=for-the-badge" alt="Kempis Turtle Tracker" width="50%">
</p>

<p align="center">
  <em>Detección local de rastros de tortugas marinas en videos de drones · Windows 11 · YOLO + ONNX + Tauri</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-24C8DB?style=flat&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/ONNX_Runtime-005CED?style=flat&logo=onnx&logoColor=white" alt="ONNX">
  <img src="https://img.shields.io/badge/YOLO-FF4B4B?style=flat&logo=yolo&logoColor=white" alt="YOLO">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/License-MIT-8A2BE2?style=flat" alt="License">
</p>

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Índice

- [Introducción](#introducción)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación](#instalación)
- [Uso](#uso)
- [Entrenamiento del Modelo](#entrenamiento-del-modelo)
- [Roadmap](#roadmap)
- [Diseña el tuyo](#diseña-el-tuyo)
- [Licencia](#licencia)

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Introducción

**Kempis Turtle Tracker** es una aplicación de escritorio para **Windows 11** que detecta rastros de tortugas marinas en videos capturados por drones. Todo el procesamiento ocurre localmente, sin depender de servicios en la nube.

**¿Qué hace?**

- 🎥 Carga y reproduce videos de drones.
- 🤖 Ejecuta inferencia con un modelo YOLO exportado a **ONNX** directamente en la GPU/CPU local.
- 📦 Dibuja *bounding boxes* con etiquetas y nivel de confianza en tiempo real.
- 📊 Muestra estadísticas: total de detecciones, FPS, confianza promedio, tiempo de análisis.
- 💾 Exporta los resultados a **CSV** y **JSON**.

> [!IMPORTANT]
> La primera versión detecta únicamente **rastros de tortugas** (tracks). Futuras versiones incluirán geolocalización GPS, detección de nidos, visión nocturna e integración con mapas.

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Arquitectura

```
Video de dron
      │
      ▼
┌─────────────────────────────────────┐
│          App Desktop (Tauri)         │
│  ┌─────────────┐  ┌───────────────┐ │
│  │  Frontend   │  │   Backend     │ │
│  │ React + TS  │◄─►   Rust/Tauri  │ │
│  └─────────────┘  └───────┬───────┘ │
└──────────────────────────┼──────────┘
                            │
                     ┌──────▼──────┐
                     │ ONNX Runtime│
                     │ (modelo     │
                     │  YOLO)      │
                     └──────┬──────┘
                            │
                   Detecciones + Stats
                            │
                    ┌───────▼────────┐
                    │ Exportar CSV / │
                    │      JSON      │
                    └────────────────┘
```

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Estructura del Proyecto

```
Kempis-turtle/
├── apps/
│   └── desktop/                  # Aplicación Tauri + React
│       ├── src/
│       │   ├── components/       # VideoPlayer, ControlBar, StatsPanel, ExportPanel
│       │   ├── services/         # onnxService.ts, tracker.ts
│       │   ├── store/            # analysisStore.ts (estado global)
│       │   ├── hooks/            # useVideoAnalysis.ts
│       │   └── types/            # Definiciones TypeScript
│       └── src-tauri/            # Backend Rust
│           ├── src/
│           │   ├── commands/     # Comandos IPC expuestos al frontend
│           │   └── export/       # Lógica de exportación CSV/JSON
│           └── resources/        # model_meta.json
├── training/
│   └── colab_train.py            # Script de entrenamiento en Google Colab
├── models/                       # Modelos ONNX entrenados (no versionados)
├── SYSTEM_DESIGN.md              # Documento de arquitectura maestra
└── README.md
```

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Instalación

> [!IMPORTANT]
> Este proyecto usa **Tauri**, que combina un frontend web (React + TypeScript) con un backend nativo en **Rust**. Por eso se necesitan instalar **dos entornos separados**: Node.js (para el frontend) y Rust (para el backend). `npm install` solo instala las dependencias de JavaScript — Rust debe instalarse aparte.

### Paso 1 — Instalar Node.js

Descargar e instalar desde [nodejs.org](https://nodejs.org/) (versión LTS recomendada).

Verificar instalación:
```sh
❯ node --version   # ej: v20.x.x
❯ npm --version    # ej: 10.x.x
```

### Paso 2 — Instalar Rust

Descargar `rustup-init.exe` desde [rustup.rs](https://rustup.rs/) y ejecutarlo. La instalación por defecto está bien.

Verificar instalación:
```sh
❯ rustc --version   # ej: rustc 1.79.0
❯ cargo --version   # ej: cargo 1.79.0
```

### Paso 3 — Instalar C++ Build Tools (Windows)

Rust en Windows necesita el compilador de C++ de Microsoft. Descargar [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) e instalar con el componente:

> ✅ **"Desarrollo para escritorio con C++"**

> [!NOTE]
> Si ya tienes **Visual Studio** instalado (Community, Professional, etc.), con ese componente activado es suficiente. No necesitas instalarlo dos veces.

### Paso 4 — Clonar el repositorio

```sh
❯ git clone https://github.com/Snowclik/Kempis-turtle.git
❯ cd Kempis-turtle/apps/desktop
```

### Paso 5 — Instalar dependencias JavaScript

```sh
❯ npm install
```

### Paso 6 — Colocar el modelo ONNX

Coloca tu archivo `.onnx` entrenado en:
```
apps/desktop/public/models/        ← archivo .onnx aquí
apps/desktop/public/models/model_meta.json  ← metadatos del modelo
```

Ver la sección de [entrenamiento](#entrenamiento-del-modelo) para generar el modelo.

### Paso 7 — Ejecutar

```sh
# Modo desarrollo
❯ npm run tauri dev

# Compilar instalador para Windows
❯ npm run tauri build
```

> [!WARNING]
> La **primera vez** que corres `npm run tauri dev`, Cargo compilará todas las dependencias de Rust desde cero. Esto puede tardar **entre 5 y 15 minutos** dependiendo de tu PC. Las ejecuciones siguientes son mucho más rápidas.

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Uso

1. Abre la aplicación y **selecciona un video** de dron (`.mp4`, `.avi`).
2. Presiona **"Iniciar análisis"** para comenzar el procesamiento.
3. Observa las detecciones en tiempo real sobre el video.
4. Revisa las **estadísticas** en el panel lateral.
5. Exporta los resultados en **CSV** o **JSON** para análisis posterior.

<details><summary><strong>⚙ Opciones de optimización de video</strong></summary><br>

El sistema implementa las siguientes estrategias para maximizar velocidad sin perder precisión significativa:

| Estrategia | Descripción |
|---|---|
| Frame skipping adaptativo | Omite frames en base a la velocidad del objeto detectado |
| Batch inference | Procesa múltiples frames en paralelo |
| Multi-threading | Decodificación y procesamiento en hilos separados |
| Pipeline asincrónico | El frontend y backend operan sin bloqueos mutuos |

</details>

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Entrenamiento del Modelo

El script `training/colab_train.py` está diseñado para ejecutarse en **Google Colab** con GPU.

**Dataset:** [Turtle Track Detector](https://universe.roboflow.com/german-university-of-technology-f4tuz/turtle-track-detector-2) en Roboflow.

**Flujo:**

```sh
# En Google Colab:
# 1. Abrir training/colab_train.py
# 2. Configurar tu API key de Roboflow
# 3. Ejecutar todas las celdas
# → El script entrena YOLO, exporta a ONNX y descarga el archivo automáticamente
```

> [!TIP]
> El script incluye data augmentation optimizado para playas, early stopping, mixed precision training y selección automática de GPU.

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Roadmap

- [x] Detección de rastros de tortugas en video
- [x] Exportación CSV y JSON
- [x] Estadísticas en tiempo real
- [ ] Geolocalización GPS de rastros
- [ ] Detección de nidos
- [ ] Visión nocturna
- [ ] Integración con mapas interactivos
- [ ] Generación automática de reportes PDF

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Diseña el tuyo

¿Quieres construir tu propio sistema desde cero, a tu manera?

El archivo **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)** contiene el documento de arquitectura original completo del proyecto: requisitos técnicos, stack tecnológico, estrategias de optimización de video, estructura de carpetas, y todos los entregables esperados.

Puedes usarlo como **prompt para una IA** o como **guía de arquitectura** para recrear el sistema con tus propias herramientas, lenguajes o enfoques.

> [!NOTE]
> El documento está escrito en español y diseñado para dar contexto suficiente a cualquier desarrollador o modelo de lenguaje para implementar el sistema de forma independiente.

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">

## Licencia

Proyecto académico — Universidad. Consulta el archivo [LICENSE](LICENSE) para más detalles.

<div align="left">

[![Return to top](https://img.shields.io/badge/Volver_arriba-1A8A4A?style=flat&logo=ReadMe&logoColor=white)](#top)

</div>

<img src="https://raw.githubusercontent.com/eli64s/readme-ai/eb2a0b4778c633911303f3c00f87874f398b5180/docs/docs/assets/svg/line-gradient.svg" alt="line break" width="100%" height="3px">