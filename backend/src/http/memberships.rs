use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::MembershipResponse,
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

pub async fn list_memberships(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<MembershipResponse>>> {
    let memberships = db::memberships::list(&state.pool, user.id).await?;
    Ok(Json(memberships))
}

pub async fn list_for_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<Json<Vec<MembershipResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let memberships = db::memberships::list_for_person(&state.pool, user.id, person_id).await?;
    Ok(Json(memberships))
}

pub async fn add_membership(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((person_id, group_id)): Path<(i64, i64)>,
) -> AppResult<Json<MembershipResponse>> {
    let person = db::people::get(&state.pool, user.id, person_id).await?;
    db::groups::ensure_exists(&state.pool, user.id, group_id).await?;
    // You never appear in groups
    if person.is_self {
        return Err(AppError::Invalid(
            "cannot add yourself to a group".to_string(),
        ));
    }
    let membership = db::memberships::add(&state.pool, user.id, person_id, group_id).await?;
    Ok(Json(membership))
}

pub async fn remove_membership(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((person_id, group_id)): Path<(i64, i64)>,
) -> AppResult<StatusCode> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    db::groups::ensure_exists(&state.pool, user.id, group_id).await?;
    db::memberships::remove(&state.pool, user.id, person_id, group_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
