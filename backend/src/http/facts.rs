use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{FactInput, FactLabelResponse, FactOrderInput, FactResponse, count_fact_labels},
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
) -> AppResult<Json<Vec<FactResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let facts = db::facts::list_for_person(&state.pool, user.id, person_id).await?;
    Ok(Json(facts))
}

pub async fn create_fact(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(fact_input): Json<FactInput>,
) -> AppResult<Json<FactResponse>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let mut input = fact_input;
    input.normalize();
    input.validate()?;
    let facts = db::facts::create_fact(&state.pool, user.id, person_id, input).await?;
    Ok(Json(facts))
}

pub async fn update_fact(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(fact_id): Path<i64>,
    Json(fact_input): Json<FactInput>,
) -> AppResult<Json<FactResponse>> {
    let mut input = fact_input;
    input.normalize();
    input.validate()?;
    let fact = db::facts::update_fact(&state.pool, user.id, fact_id, input).await?;
    Ok(Json(fact))
}

pub async fn delete_fact(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(fact_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::facts::delete_fact(&state.pool, user.id, fact_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_labels(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<FactLabelResponse>>> {
    let spellings = db::facts::label_counts(&state.pool, user.id).await?;
    Ok(Json(count_fact_labels(spellings)))
}

pub async fn reorder_facts(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(input): Json<FactOrderInput>,
) -> AppResult<Json<Vec<FactResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    if !db::facts::is_complete_order(&state.pool, user.id, person_id, &input.fact_ids).await? {
        return Err(AppError::Invalid(
            "fact_ids: must list each of the person's facts once".to_string(),
        ));
    }
    let facts = db::facts::reorder(&state.pool, user.id, person_id, &input.fact_ids).await?;
    Ok(Json(facts))
}
