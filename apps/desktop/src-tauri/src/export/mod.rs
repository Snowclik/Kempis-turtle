use std::path::Path;
use crate::error::AppError;

/// Guarda detecciones en CSV o JSON según el formato solicitado.
pub fn save_results(
    detections: &[serde_json::Value],
    format:     &str,
    file_path:  &str,
) -> Result<String, AppError> {
    let path = Path::new(file_path);

    match format.to_lowercase().as_str() {
        "csv"  => write_csv(detections, path),
        "json" => write_json(detections, path),
        other  => Err(AppError::Other(format!("Formato no soportado: {other}"))),
    }
}

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────

fn write_csv(
    detections: &[serde_json::Value],
    path: &Path,
) -> Result<String, AppError> {
    let mut wtr = csv::Writer::from_path(path)?;

    // Cabecera
    wtr.write_record([
        "frame_index",
        "timestamp_s",
        "class_id",
        "class_name",
        "confidence",
        "x1_norm",
        "y1_norm",
        "x2_norm",
        "y2_norm",
        "width_norm",
        "height_norm",
    ])?;

    // Filas
    for det in detections {
        let bbox = &det["bbox"];
        let x1   = bbox["x1"].as_f64().unwrap_or(0.0);
        let y1   = bbox["y1"].as_f64().unwrap_or(0.0);
        let x2   = bbox["x2"].as_f64().unwrap_or(0.0);
        let y2   = bbox["y2"].as_f64().unwrap_or(0.0);

        wtr.write_record([
            det["frameIndex"].as_u64().unwrap_or(0).to_string(),
            format!("{:.4}", det["timestamp"].as_f64().unwrap_or(0.0)),
            det["classId"].as_u64().unwrap_or(0).to_string(),
            det["className"].as_str().unwrap_or("").to_string(),
            format!("{:.4}", det["confidence"].as_f64().unwrap_or(0.0)),
            format!("{:.6}", x1),
            format!("{:.6}", y1),
            format!("{:.6}", x2),
            format!("{:.6}", y2),
            format!("{:.6}", x2 - x1),
            format!("{:.6}", y2 - y1),
        ])?;
    }

    wtr.flush()?;
    Ok(path.display().to_string())
}

// ─────────────────────────────────────────────────────────────
// JSON
// ─────────────────────────────────────────────────────────────

fn write_json(
    detections: &[serde_json::Value],
    path: &Path,
) -> Result<String, AppError> {
    let output = serde_json::json!({
        "metadata": {
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "total_detections": detections.len(),
            "format_version": "1.0",
            "coordinate_system": "normalized_0_1",
        },
        "detections": detections,
    });

    let content = serde_json::to_string_pretty(&output)?;
    std::fs::write(path, content)?;
    Ok(path.display().to_string())
}
