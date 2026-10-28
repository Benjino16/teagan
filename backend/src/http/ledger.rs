use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{BalanceResponse, LedgerEntryInput, LedgerEntryResponse},
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
) -> AppResult<Json<Vec<LedgerEntryResponse>>> {
    db::people::ensure_exists(&state.pool, user.id, person_id).await?;
    let entries = db::ledger::list_for_person(&state.pool, user.id, person_id).await?;
    Ok(Json(entries))
}

pub async fn list_balances(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Vec<BalanceResponse>>> {
    let balances = db::ledger::balances(&state.pool, user.id).await?;
    Ok(Json(balances))
}

pub async fn list_for_activity(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(activity_id): Path<i64>,
) -> AppResult<Json<Vec<LedgerEntryResponse>>> {
    db::activities::ensure_exists(&state.pool, user.id, activity_id).await?;
    let entries = db::ledger::list_for_activity(&state.pool, user.id, activity_id).await?;
    Ok(Json(entries))
}

pub async fn get_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(entry_id): Path<i64>,
) -> AppResult<Json<LedgerEntryResponse>> {
    let entry = db::ledger::get(&state.pool, user.id, entry_id).await?;
    Ok(Json(entry))
}

pub async fn create_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(person_id): Path<i64>,
    Json(entry_input): Json<LedgerEntryInput>,
) -> AppResult<Json<LedgerEntryResponse>> {
    let person = db::people::get(&state.pool, user.id, person_id).await?;
    // You can't owe yourself
    if person.is_self {
        return Err(AppError::Invalid(
            "cannot record money with yourself".to_string(),
        ));
    }
    let input = checked_input(&state, user.id, entry_input).await?;
    let entry = db::ledger::create(&state.pool, user.id, person_id, input).await?;
    Ok(Json(entry))
}

pub async fn update_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(entry_id): Path<i64>,
    Json(entry_input): Json<LedgerEntryInput>,
) -> AppResult<Json<LedgerEntryResponse>> {
    let input = checked_input(&state, user.id, entry_input).await?;
    let entry = db::ledger::update(&state.pool, user.id, entry_id, input).await?;
    Ok(Json(entry))
}

pub async fn delete_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(entry_id): Path<i64>,
) -> AppResult<StatusCode> {
    db::ledger::delete(&state.pool, user.id, entry_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Normalized and validated. The activity only has to be the user's – the
/// person need not be a participant: people leave an event, the money stays.
async fn checked_input(
    state: &AppState,
    owner_id: i64,
    entry_input: LedgerEntryInput,
) -> AppResult<LedgerEntryInput> {
    let mut input = entry_input;
    input.normalize();
    input.validate()?;
    if let Some(activity_id) = input.activity_id
        && !db::activities::exists(&state.pool, owner_id, activity_id).await?
    {
        return Err(AppError::Invalid("activity_id: not found".to_string()));
    }
    Ok(input)
}
