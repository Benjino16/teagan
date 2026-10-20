use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{ActivityInput, ActivityResponse},
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use validator::Validate;

pub async fn list_activities(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<ActivityResponse>>> {
    let activities = db::activities::list(&state.pool, user.id).await?;
    Ok(Json(activities))
}

pub async fn list_for_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<Json<Vec<ActivityResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let activities = db::activities::list_for_person(&state.pool, user.id, person_id).await?;
    Ok(Json(activities))
}

pub async fn list_for_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(group_id): Path<i64>,
) -> AppResult<Json<Vec<ActivityResponse>>> {
    db::groups::ensure_exists(&state.pool, user.id, group_id).await?;
    let activities = db::activities::list_for_group(&state.pool, user.id, group_id).await?;
    Ok(Json(activities))
}

pub async fn get_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(activity_id): Path<i64>,
) -> AppResult<Json<ActivityResponse>> {
    let activity = db::activities::get(&state.pool, user.id, activity_id).await?;
    Ok(Json(activity))
}

pub async fn create_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(activity_input): Json<ActivityInput>,
) -> AppResult<Json<ActivityResponse>> {
    let mut input = activity_input;
    input.normalize();
    input.validate()?;
    ensure_links_exist(&state, user, &input).await?;
    let activity = db::activities::create(&state.pool, user.id, input).await?;
    Ok(Json(activity))
}

pub async fn update_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(activity_id): Path<i64>,
    Json(activity_input): Json<ActivityInput>,
) -> AppResult<Json<ActivityResponse>> {
    let mut input = activity_input;
    input.normalize();
    input.validate()?;
    ensure_links_exist(&state, user, &input).await?;
    let activity = db::activities::update(&state.pool, user.id, activity_id, input).await?;
    Ok(Json(activity))
}

pub async fn delete_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(activity_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::activities::delete(&state.pool, user.id, activity_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Unknown or foreign people and groups are a client error, not a 404 of the
/// activity.
async fn ensure_links_exist(
    state: &AppState,
    user: CurrentUser,
    input: &ActivityInput,
) -> AppResult<()> {
    if !db::people::all_exist(&state.pool, user.id, &input.person_ids()).await? {
        return Err(AppError::Invalid(
            "participants: unknown person".to_string(),
        ));
    }
    if !db::groups::all_exist(&state.pool, user.id, &input.group_ids()).await? {
        return Err(AppError::Invalid("groups: unknown group".to_string()));
    }
    Ok(())
}
