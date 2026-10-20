use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{PersonArchivedInput, PersonInput, PersonResponse},
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use validator::Validate;

pub async fn list_people(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<PersonResponse>>> {
    let people = db::people::list(&state.pool, user.id).await?;
    Ok(Json(people))
}

pub async fn get_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<Json<PersonResponse>> {
    let person = db::people::get(&state.pool, user.id, person_id).await?;
    Ok(Json(person))
}

pub async fn get_self(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<PersonResponse>> {
    let person = db::people::get_self(&state.pool, user.id).await?;
    Ok(Json(person))
}

pub async fn create_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(person_input): Json<PersonInput>,
) -> AppResult<Json<PersonResponse>> {
    let mut input = person_input;
    input.normalize();
    input.validate()?;
    let person = db::people::create(&state.pool, user.id, input).await?;
    Ok(Json(person))
}

pub async fn update_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(person_input): Json<PersonInput>,
) -> AppResult<Json<PersonResponse>> {
    let mut input = person_input;
    input.normalize();
    input.validate()?;
    if input.focus || input.deceased {
        let current = db::people::get(&state.pool, user.id, person_id).await?;
        if current.is_self && input.focus {
            return Err(AppError::Invalid(
                "focus: not allowed on yourself".to_string(),
            ));
        }
        if current.is_self && input.deceased {
            return Err(AppError::Invalid(
                "deceased: not allowed on yourself".to_string(),
            ));
        }
    }
    let person = db::people::update(&state.pool, user.id, person_id, input).await?;
    Ok(Json(person))
}

pub async fn set_archived(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(input): Json<PersonArchivedInput>,
) -> AppResult<Json<PersonResponse>> {
    let current = db::people::get(&state.pool, user.id, person_id).await?;
    if current.is_self {
        return Err(AppError::Invalid("cannot archive yourself".to_string()));
    }
    let person = db::people::set_archived(&state.pool, user.id, person_id, input.archived).await?;
    Ok(Json(person))
}

pub async fn delete_person(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
) -> AppResult<StatusCode> {
    let current = db::people::get(&state.pool, user.id, person_id).await?;
    if current.is_self {
        return Err(AppError::Invalid("cannot delete yourself".to_string()));
    }
    db::people::delete(&state.pool, user.id, person_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
