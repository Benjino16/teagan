use axum::{
    Json,
    body::Bytes,
    extract::{Path, State},
    http::{
        StatusCode,
        header::{CACHE_CONTROL, CONTENT_TYPE},
    },
    response::IntoResponse,
};

use std::sync::Arc;

use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{PersonResponse, PhotoSize, process_photo},
    error::{AppError, AppResult},
};

/// The body is the raw image (JPEG, PNG or WebP). Its size is capped by the
/// route's `DefaultBodyLimit` – larger uploads never reach this handler.
pub async fn put_photo(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    body: Bytes,
) -> AppResult<Json<PersonResponse>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;

    // Waits (without blocking a thread) while MAX_PARALLEL_PHOTOS are being decoded
    let permit = Arc::clone(&state.photo_slots)
        .acquire_owned()
        .await
        .map_err(|err| AppError::Internal(err.into()))?;

    // Decoding and scaling would block the async runtime. `move` hands the
    // `Bytes` and the permit over to the thread, which may outlive this handler
    // (client hangs up) – the permit is only returned once the memory is freed.
    let photo = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        process_photo(&body)
    })
    .await
    .map_err(|err| AppError::Internal(err.into()))??;

    db::photos::upsert(&state.pool, user.id, person_id, &photo).await?;
    let person = db::people::get(&state.pool, user.id, person_id).await?;
    Ok(Json(person))
}

pub async fn delete_photo(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    db::photos::delete(&state.pool, user.id, person_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// `?v=<hash>` is ignored here: it only gives every photo its own URL,
/// so the browser may cache it forever.
pub async fn get_photo(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((person_id, size)): Path<(i64, PhotoSize)>,
) -> AppResult<impl IntoResponse> {
    let jpeg = db::photos::get(&state.pool, user.id, person_id, size).await?;
    Ok((
        [
            (CONTENT_TYPE, "image/jpeg"),
            (CACHE_CONTROL, "private, max-age=31536000, immutable"),
        ],
        jpeg,
    ))
}
