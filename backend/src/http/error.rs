use axum::{
    Json,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;

use crate::error::AppError;

/// JSON-Body jeder Fehlerantwort, z. B. `{"code":"not_found","message":"Not found"}`.
/// The codes match `RepositoryError` in the frontend.
#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not_found", "Not found".to_string()),
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "Not logged in".to_string(),
            ),
            AppError::Invalid(message) => (StatusCode::BAD_REQUEST, "invalid", message),
            AppError::TooManyAttempts(wait) => {
                let seconds = wait.as_secs().max(1);
                let minutes = seconds.div_ceil(60);
                let unit = if minutes == 1 { "minute" } else { "minutes" };
                let message = format!("Too many failed logins – try again in {minutes} {unit}.");
                let body = ErrorBody {
                    code: "too_many_attempts",
                    message,
                };
                return (
                    StatusCode::TOO_MANY_REQUESTS,
                    [(header::RETRY_AFTER, seconds.to_string())],
                    Json(body),
                )
                    .into_response();
            }
            AppError::Internal(err) => {
                // Details only go to the log – they may contain SQL or table names
                eprintln!("internal error: {err:?}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "Internal error".to_string(),
                )
            }
        };

        (status, Json(ErrorBody { code, message })).into_response()
    }
}
