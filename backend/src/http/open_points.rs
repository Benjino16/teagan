use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{NewOpenPointInput, OpenPointDoneInput, OpenPointInput, OpenPointResponse},
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use validator::Validate;

pub async fn list_for_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<Json<Vec<OpenPointResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let points = db::open_points::list_for_person(&state.pool, user.id, person_id).await?;
    Ok(Json(points))
}

pub async fn list_for_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(activity_id): Path<i64>,
) -> AppResult<Json<Vec<OpenPointResponse>>> {
    db::activities::ensure_exists(&state.pool, user.id, activity_id).await?;
    let points = db::open_points::list_for_activity(&state.pool, user.id, activity_id).await?;
    Ok(Json(points))
}

pub async fn get_open_point(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(point_id): Path<i64>,
) -> AppResult<Json<OpenPointResponse>> {
    let point = db::open_points::get(&state.pool, user.id, point_id).await?;
    Ok(Json(point))
}

pub async fn create_open_point(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(point_input): Json<NewOpenPointInput>,
) -> AppResult<Json<OpenPointResponse>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let mut input = point_input;
    input.normalize();
    input.validate()?;
    // A point from an event is for one of its participants
    if let Some(activity_id) = input.activity_id
        && !db::activities::has_participant(&state.pool, user.id, activity_id, person_id).await?
    {
        return Err(AppError::Invalid(
            "activity_id: person is not a participant of this activity".to_string(),
        ));
    }
    let point = db::open_points::create(&state.pool, user.id, person_id, input).await?;
    Ok(Json(point))
}

pub async fn update_open_point(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(point_id): Path<i64>,
    Json(point_input): Json<OpenPointInput>,
) -> AppResult<Json<OpenPointResponse>> {
    let mut input = point_input;
    input.normalize();
    input.validate()?;
    let point = db::open_points::update(&state.pool, user.id, point_id, input).await?;
    Ok(Json(point))
}

pub async fn set_done(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(point_id): Path<i64>,
    Json(input): Json<OpenPointDoneInput>,
) -> AppResult<Json<OpenPointResponse>> {
    let point = db::open_points::set_done(&state.pool, user.id, point_id, input.done).await?;
    Ok(Json(point))
}

pub async fn delete_open_point(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(point_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::open_points::delete(&state.pool, user.id, point_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
