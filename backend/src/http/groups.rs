use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{GroupArchivedInput, GroupInput, GroupResponse},
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use validator::Validate;

pub async fn list_groups(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<GroupResponse>>> {
    let groups = db::groups::list(&state.pool, user.id).await?;
    Ok(Json(groups))
}

pub async fn get_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(group_id): Path<i64>,
) -> AppResult<Json<GroupResponse>> {
    let group = db::groups::get(&state.pool, user.id, group_id).await?;
    Ok(Json(group))
}

pub async fn create_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(group_input): Json<GroupInput>,
) -> AppResult<Json<GroupResponse>> {
    let mut input = group_input;
    input.normalize();
    input.validate()?;
    if let Some(parent_id) = input.parent_id {
        ensure_main_group(&state, user, parent_id).await?;
    }
    let group = db::groups::create(&state.pool, user.id, input).await?;
    Ok(Json(group))
}

pub async fn update_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(group_id): Path<i64>,
    Json(group_input): Json<GroupInput>,
) -> AppResult<Json<GroupResponse>> {
    let mut input = group_input;
    input.normalize();
    input.validate()?;
    db::groups::get(&state.pool, user.id, group_id).await?;
    if let Some(parent_id) = input.parent_id {
        if parent_id == group_id {
            return Err(AppError::Invalid(
                "parent_id: cannot be the group itself".to_string(),
            ));
        }
        // A group with subgroups stays a main group
        if db::groups::has_subgroups(&state.pool, user.id, group_id).await? {
            return Err(AppError::Invalid(
                "parent_id: group has subgroups".to_string(),
            ));
        }
        ensure_main_group(&state, user, parent_id).await?;
    }
    let group = db::groups::update(&state.pool, user.id, group_id, input).await?;
    Ok(Json(group))
}

pub async fn set_archived(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(group_id): Path<i64>,
    Json(input): Json<GroupArchivedInput>,
) -> AppResult<Json<GroupResponse>> {
    let group = db::groups::set_archived(&state.pool, user.id, group_id, input.archived).await?;
    Ok(Json(group))
}

pub async fn delete_group(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(group_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::groups::delete(&state.pool, user.id, group_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Only one level of subgroups: the parent must exist and be a
/// main group itself. The triggers enforce this too, but would only end in a
/// 500.
async fn ensure_main_group(state: &AppState, user: CurrentUser, parent_id: i64) -> AppResult<()> {
    let parent = match db::groups::get(&state.pool, user.id, parent_id).await {
        Ok(parent) => parent,
        Err(sqlx::Error::RowNotFound) => {
            return Err(AppError::Invalid("parent_id: unknown group".to_string()));
        }
        Err(err) => return Err(err.into()),
    };
    if parent.parent_id.is_some() {
        return Err(AppError::Invalid(
            "parent_id: subgroups cannot have subgroups".to_string(),
        ));
    }
    Ok(())
}
