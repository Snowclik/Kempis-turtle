Actúa como un Arquitecto Senior de IA, Computer Vision, MLOps y Desarrollo Desktop. Tu objetivo es diseñar e implementar una solución profesional para Windows 11 que detecte rastros de tortugas marinas en videos capturados por drones.

# CONTEXTO DEL PROYECTO

Estoy desarrollando un sistema para detectar rastros (tracks) de tortugas marinas en playas utilizando videos tomados desde drones.

Dataset de entrenamiento:
https://universe.roboflow.com/german-university-of-technology-f4tuz/turtle-track-detector-2

El sistema final debe funcionar completamente en Windows 11 y ejecutarse localmente sin depender de servicios en la nube.

La primera versión debe detectar únicamente los rastros de tortugas.

En versiones futuras se añadirá:

- Geolocalización de rastros
- Detección de nidos
- Detección nocturna
- Integración con mapas
- Generación automática de reportes

Por lo tanto, la arquitectura debe ser escalable.

# OBJETIVO PRINCIPAL

Construir una aplicación de escritorio moderna que permita:

1. Entrenar con YOLO26n usando el dataset de Roboflow.
2. Exportarlo a ONNX.
3. Ejecutar inferencias locales en Windows 11.
4. Procesar videos de drones.
5. Detectar rastros de tortugas.
6. Mostrar detecciones visuales.
7. Generar estadísticas.
8. Mantener excelente rendimiento incluso con videos largos.

# REQUISITOS DE ENTRENAMIENTO

Quiero que generes:

## Script completo para Google Colab

Debe:

- Descargar dataset desde Roboflow.
- Entrenar usando Ultralytics YOLO.
- Aplicar mejores prácticas.
- Guardar checkpoints.
- Mostrar métricas.
- Exportar automáticamente a ONNX.
- Validar el modelo.
- Descargar automáticamente el ONNX final.

Debe incluir:

- Data augmentation apropiado para playas.
- Early stopping.
- Selección automática de GPU.
- Mixed Precision Training.
- Configuración recomendada para maximizar mAP.

Explica cada parámetro utilizado.

# REQUISITOS DEL MODELO

El modelo final debe:

- Exportarse a ONNX.
- Ser compatible con ONNX Runtime.
- Ejecutarse localmente.
- Mantener precisión alta.
- Tener inferencia rápida.

# APLICACIÓN DESKTOP

Diseñar una aplicación para Windows 11 utilizando:

Opción preferida:

- Tauri
- React
- TypeScript
- Vite

Si existe una alternativa más rápida y eficiente, justifícala antes de implementarla.

# FUNCIONALIDADES DE LA APP

## Pantalla principal

Permitir:

- Seleccionar video
- Reproducir video
- Pausar
- Avanzar
- Retroceder

## Procesamiento

Botón:

"Iniciar análisis"

Al ejecutarlo:

- Cargar modelo ONNX
- Procesar video
- Mostrar progreso
- Mostrar tiempo estimado restante

## Detección

Dibujar:

- Bounding boxes
- Etiquetas
- Nivel de confianza

## Estadísticas

Mostrar:

- Total de detecciones
- Confianza promedio
- Duración procesada
- FPS reales
- Tiempo total de análisis

## Exportación

Permitir exportar:

- CSV
- JSON

Con:

- Timestamp
- Clase
- Confianza
- Frame

# OPTIMIZACIÓN DE VIDEO

Este punto es crítico.

No quiero procesar todos los frames si no es necesario.

Analiza y propone:

- Frame skipping inteligente
- Procesamiento adaptativo
- Batch inference
- Multi-threading
- Pipelines asincrónicos
- Decodificación optimizada

El objetivo es:

Maximizar velocidad sin perder precisión significativa.

Quiero un análisis técnico profundo sobre:

- Cada estrategia
- Ventajas
- Desventajas
- Impacto en precisión

# RENDIMIENTO

Objetivo:

Procesar videos:

- 1080p
- 2K
- 4K

Manteniendo buena velocidad.

Explica:

- Cuellos de botella
- Consumo de RAM
- Consumo de VRAM
- Uso de CPU
- Uso de GPU

# FUTURA GEOLOCALIZACIÓN

Aunque NO debe implementarse todavía, quiero que diseñes una arquitectura preparada para integrar posteriormente:

Metadatos del dron:

- GPS
- Altitud
- Pitch
- Roll
- Yaw

Objetivo futuro:

Transformar una detección de píxeles en coordenadas geográficas reales.

Diseña desde ahora una estructura de software que permita añadir esta función sin rehacer el sistema.

# ESTRUCTURA DEL PROYECTO

Genera una estructura profesional de carpetas para:

- Frontend
- Backend
- IA
- Modelos
- Exportaciones
- Configuración

# ENTREGABLES ESPERADOS

Necesito:

1. Arquitectura completa del sistema.
2. Justificación tecnológica.
3. Estructura de carpetas.
4. Código completo para entrenamiento en Google Colab.
5. Código completo para exportación ONNX.
6. Backend de inferencia ONNX Runtime.
7. Frontend Tauri + React.
8. Sistema de procesamiento de video.
9. Exportación CSV y JSON.
10. Estrategias avanzadas de optimización.
11. Recomendaciones para producción.
12. Posibles mejoras futuras.

# IMPORTANTE

No me des explicaciones superficiales.

Quiero una respuesta de nivel profesional, como si estuviera diseñando un producto real para una organización de conservación marina.

Prioriza:

- Rendimiento
- Escalabilidad
- Mantenibilidad
- Precisión

Genera código completo y funcional, no pseudocódigo.

Cuando haya varias opciones, compara técnicamente y elige la mejor.