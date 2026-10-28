//! The logged-in user's own account.

use std::{net::SocketAddr, time::Instant};

use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::StatusCode,
};
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use validator::Validate;

use super::{
    AppState, CurrentUser,
    auth::{CodeInput, SESSION_COOKIE, unix_now},
};
use crate::{
    db,
    domain::{
        ChangePasswordInput, Settings, SettingsPatch, hash_password, hash_recovery_code,
        hash_token, new_recovery_codes, new_totp_secret, totp_setup, totp_step, verify_password,
    },
    error::{AppError, AppResult},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountResponse {
    username: String,
    totp_enabled: bool,
    recovery_codes_left: i64,
}

pub async fn get_account(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<AccountResponse>> {
    let account = db::users::get(&state.pool, user.id).await?;
    let totp_enabled = db::totp::get(&state.pool, user.id)
        .await?
        .is_some_and(|totp| totp.confirmed);
    let recovery_codes_left = db::totp::recovery_codes_left(&state.pool, user.id).await?;
    Ok(Json(AccountResponse {
        username: account.username,
        totp_enabled,
        recovery_codes_left,
    }))
}

/// Every setting, defaults filled in.
pub async fn get_settings(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<Settings>> {
    let stored = db::users::settings(&state.pool, user.id).await?;
    let settings = Settings::from_stored(&stored).map_err(|err| AppError::Internal(err.into()))?;
    Ok(Json(settings))
}

/// Only the keys sent change, `null` resets one to its default; answers
/// with every setting, like `get_settings`.
pub async fn update_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(patch): Json<SettingsPatch>,
) -> AppResult<Json<Settings>> {
    let patch = patch.checked_json()?;
    let settings =
        db::users::patch_settings(&state.pool, user.id, &patch, Settings::from_patched).await?;
    Ok(Json(settings))
}

/// Ends all other sessions; this one stays.
pub async fn change_password(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    user: CurrentUser,
    jar: CookieJar,
    Json(input): Json<ChangePasswordInput>,
) -> AppResult<StatusCode> {
    input.validate()?;
    confirm_password(&state, client, user.id, input.current_password).await?;

    // Argon2 takes ~50 ms of CPU – off the async threads
    let hash = tokio::task::spawn_blocking(move || hash_password(&input.new_password))
        .await
        .map_err(|err| AppError::Internal(err.into()))?
        .map_err(AppError::Internal)?;
    // CurrentUser found the cookie, so it is there
    let session = jar
        .get(SESSION_COOKIE)
        .map(|cookie| hash_token(cookie.value()))
        .unwrap_or_default();
    db::users::change_password(&state.pool, user.id, &hash, &session).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpSetupResponse {
    /// Base32, for typing into the app instead of scanning.
    secret: String,
    otpauth_url: String,
    qr_svg: String,
}

/// Starts setting up TOTP with a new secret; it is only on after `confirm_totp`.
/// Starting again replaces an unconfirmed secret.
pub async fn start_totp(
    State(state): State<AppState>,
    user: CurrentUser,
) -> AppResult<Json<TotpSetupResponse>> {
    let username = db::users::get(&state.pool, user.id).await?.username;
    let secret = new_totp_secret();
    if !db::totp::start_setup(&state.pool, user.id, &secret).await? {
        return Err(AppError::Invalid("Two-factor login is already on.".into()));
    }
    let setup = totp_setup(&secret, &username).map_err(AppError::Internal)?;
    Ok(Json(TotpSetupResponse {
        secret,
        otpauth_url: setup.url,
        qr_svg: setup.qr_svg,
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCodesResponse {
    /// Shown once – only their hashes are stored.
    recovery_codes: Vec<String>,
}

/// The first correct code turns TOTP on and brings the recovery codes.
/// `NotFound` without a running setup.
pub async fn confirm_totp(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<CodeInput>,
) -> AppResult<Json<RecoveryCodesResponse>> {
    let Some(totp) = db::totp::get(&state.pool, user.id)
        .await?
        .filter(|totp| !totp.confirmed)
    else {
        return Err(AppError::NotFound);
    };
    let step =
        totp_step(&totp.secret, input.code.trim(), unix_now()).map_err(AppError::Internal)?;
    let Some(step) = step else {
        return Err(AppError::Invalid(
            "Wrong code – is the clock on your phone right?".into(),
        ));
    };

    let codes = new_recovery_codes().map_err(AppError::Internal)?;
    let hashes: Vec<String> = codes.iter().map(|code| hash_recovery_code(code)).collect();
    if !db::totp::confirm(&state.pool, user.id, step, &hashes).await? {
        return Err(AppError::NotFound);
    }
    Ok(Json(RecoveryCodesResponse {
        recovery_codes: codes,
    }))
}

#[derive(Deserialize)]
pub struct PasswordConfirmInput {
    password: String,
}

/// Needs the password, so an open, unattended session can't turn it off.
pub async fn disable_totp(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    user: CurrentUser,
    Json(input): Json<PasswordConfirmInput>,
) -> AppResult<StatusCode> {
    confirm_password(&state, client, user.id, input.password).await?;
    let mut conn = state.pool.acquire().await?;
    db::totp::disable(&mut conn, user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// New recovery codes; the old ones stop working. Needs the password.
pub async fn renew_recovery_codes(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    user: CurrentUser,
    Json(input): Json<PasswordConfirmInput>,
) -> AppResult<Json<RecoveryCodesResponse>> {
    confirm_password(&state, client, user.id, input.password).await?;
    if !db::totp::get(&state.pool, user.id)
        .await?
        .is_some_and(|totp| totp.confirmed)
    {
        return Err(AppError::Invalid("Two-factor login is off.".into()));
    }

    let codes = new_recovery_codes().map_err(AppError::Internal)?;
    let hashes: Vec<String> = codes.iter().map(|code| hash_recovery_code(code)).collect();
    db::totp::set_recovery_codes(&state.pool, user.id, &hashes).await?;
    Ok(Json(RecoveryCodesResponse {
        recovery_codes: codes,
    }))
}

/// For changes that could lock the owner out: the current password. A wrong
/// one counts like a failed login, or this would be a way around the limit.
async fn confirm_password(
    state: &AppState,
    client: SocketAddr,
    user_id: i64,
    password: String,
) -> AppResult<()> {
    let account = db::users::get(&state.pool, user_id).await?;
    state
        .login_limiter
        .begin(&account.username, client.ip(), Instant::now())
        .map_err(AppError::TooManyAttempts)?;

    // Argon2 takes ~50 ms of CPU – off the async threads
    let hash = account.password_hash;
    let valid = tokio::task::spawn_blocking(move || verify_password(&password, Some(&hash)))
        .await
        .map_err(|err| AppError::Internal(err.into()))?;
    if !valid {
        return Err(AppError::Invalid("Current password is wrong.".into()));
    }
    state
        .login_limiter
        .succeeded(&account.username, client.ip());
    Ok(())
}
