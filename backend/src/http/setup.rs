//! The very first account, created in the browser.
//! No setup code: whoever completes it first owns the instance.

use std::net::SocketAddr;

use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::StatusCode,
};
use axum_extra::extract::CookieJar;
use validator::Validate;

use super::{AppState, auth::start_session};
use crate::{
    db,
    domain::{NewUserInput, hash_password},
    error::{AppError, AppResult},
};

/// Creates the first account and logs it in. Once any account exists, the
/// route is gone (`NotFound`) – also for the slower of two setups at once.
pub async fn setup(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    jar: CookieJar,
    Json(user_input): Json<NewUserInput>,
) -> AppResult<(CookieJar, StatusCode)> {
    // Before hashing, so a finished setup costs nothing to ask
    if db::users::any_exist(&state.pool).await? {
        return Err(AppError::NotFound);
    }
    let mut input = user_input;
    input.normalize();
    input.validate()?;

    let password = input.password.clone();
    // Argon2 takes ~50 ms of CPU – off the async threads
    let hash = tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|err| AppError::Internal(err.into()))?
        .map_err(AppError::Internal)?;
    let Some(user_id) =
        db::users::create_first(&state.pool, &input.username, &hash, &input.name).await?
    else {
        return Err(AppError::NotFound);
    };

    // So the owner can check in the log that it was them
    println!(
        "setup done: user \"{}\" from {}",
        input.username,
        client.ip()
    );
    Ok((
        start_session(&state, jar, user_id).await?,
        StatusCode::NO_CONTENT,
    ))
}
