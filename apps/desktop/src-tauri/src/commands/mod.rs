use std::sync::atomic::Ordering;
use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn cancel_analysis(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn reset_cancel(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_flag.store(false, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn export_results(
    detections: Vec<serde_json::Value>,
    format:     String,
    file_path:  String,
) -> Result<String, String> {
    crate::export::save_results(&detections, &format, &file_path)
        .map_err(|e| e.to_string())
}
