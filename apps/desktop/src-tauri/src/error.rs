use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Error de IO: {0}")]
    Io(#[from] std::io::Error),

    #[error("Error JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Error CSV: {0}")]
    Csv(#[from] csv::Error),

    #[error("{0}")]
    Other(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self { e.to_string() }
}
