//! Login and logout. The session token travels only in an
//! HttpOnly cookie, so scripts in the page can never read it.
//!
//! With TOTP on, the password alone only starts a login challenge (its own
//! short-lived cookie); the code then turns it into a session.

use std::{net::SocketAddr, time::Instant};

use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::StatusCode,
};
use axum_extra::extract::{
    CookieJar,
    cookie::{Cookie, SameSite},
};
use serde::{Deserialize, Serialize};

use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{
        LoginInput, hash_recovery_code, hash_token, is_totp_code, new_token, normalize_code,
        totp_step, verify_password,
    },
    error::{AppError, AppResult},
};

pub const SESSION_COOKIE: &str = "session";
const CHALLENGE_COOKIE: &str = "login_challenge";
/// The challenge cookie is only needed for the code step.
const CHALLENGE_PATH: &str = "/api/auth";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    logged_in: bool,
    /// No account exists yet – the frontend shows the setup wizard.
    setup_required: bool,
}

/// Never fails for a missing login – the frontend asks this to decide
/// between setup, the login screen and the app.
pub async fn status(
    State(state): State<AppState>,
    user: Option<CurrentUser>,
) -> AppResult<Json<AuthStatus>> {
    let setup_required = !db::users::any_exist(&state.pool).await?;
    Ok(Json(AuthStatus {
        logged_in: user.is_some(),
        setup_required,
    }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    /// The password was right, now the code (`POST /auth/login/totp`).
    totp_required: bool,
}

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    jar: CookieJar,
    Json(login_input): Json<LoginInput>,
) -> AppResult<(CookieJar, Json<LoginResult>)> {
    let mut input = login_input;
    input.normalize();
    let username = input.username.clone();
    // Checked before the password, so a blocked login can't even try
    state
        .login_limiter
        .begin(&username, client.ip(), Instant::now())
        .map_err(AppError::TooManyAttempts)?;

    let user = db::users::find_for_login(&state.pool, &input.username).await?;
    let hash = user.as_ref().map(|user| user.password_hash.clone());
    // Argon2 takes ~50 ms of CPU – off the async threads
    let valid =
        tokio::task::spawn_blocking(move || verify_password(&input.password, hash.as_deref()))
            .await
            .map_err(|err| AppError::Internal(err.into()))?;
    // Same answer for an unknown user and a wrong password
    let Some(user) = user.filter(|_| valid) else {
        return Err(AppError::Invalid("Wrong username or password.".into()));
    };

    let totp_on = db::totp::get(&state.pool, user.id)
        .await?
        .is_some_and(|totp| totp.confirmed);
    if totp_on {
        // The attempt stays counted until the code is right – otherwise
        // whoever knows the password could guess codes without limit
        let token = new_token().map_err(AppError::Internal)?;
        db::challenges::create(&state.pool, user.id, &hash_token(&token)).await?;
        let jar = jar.add(challenge_cookie(token, state.secure_cookies));
        return Ok((
            jar,
            Json(LoginResult {
                totp_required: true,
            }),
        ));
    }

    state.login_limiter.succeeded(&username, client.ip());
    let jar = start_session(&state, jar, user.id).await?;
    Ok((
        jar,
        Json(LoginResult {
            totp_required: false,
        }),
    ))
}

/// A TOTP code (or, at login, a recovery code).
#[derive(Deserialize)]
pub struct CodeInput {
    pub code: String,
}

/// Second step: a TOTP code or a recovery code. Each wrong code counts for
/// the login limit and for the challenge, which ends after a few. A missing
/// or expired challenge is `NotFound` – the password is needed again.
pub async fn login_totp(
    State(state): State<AppState>,
    ConnectInfo(client): ConnectInfo<SocketAddr>,
    jar: CookieJar,
    Json(input): Json<CodeInput>,
) -> AppResult<(CookieJar, StatusCode)> {
    let Some(challenge) = jar
        .get(CHALLENGE_COOKIE)
        .map(|cookie| hash_token(cookie.value()))
    else {
        return Err(AppError::NotFound);
    };
    let Some(user_id) = db::challenges::find_user(&state.pool, &challenge).await? else {
        return Err(AppError::NotFound);
    };
    let username = db::users::get(&state.pool, user_id).await?.username;
    state
        .login_limiter
        .begin(&username, client.ip(), Instant::now())
        .map_err(AppError::TooManyAttempts)?;

    if !second_factor_ok(&state, user_id, &input.code).await? {
        db::challenges::count_failure(&state.pool, &challenge).await?;
        return Err(AppError::Invalid("Wrong code.".into()));
    }

    state.login_limiter.succeeded(&username, client.ip());
    db::challenges::delete(&state.pool, &challenge).await?;
    let jar = jar.remove(Cookie::build(CHALLENGE_COOKIE).path(CHALLENGE_PATH));
    Ok((
        start_session(&state, jar, user_id).await?,
        StatusCode::NO_CONTENT,
    ))
}

/// A current TOTP code not used before, or an unused recovery code.
async fn second_factor_ok(state: &AppState, user_id: i64, code: &str) -> AppResult<bool> {
    let code = normalize_code(code);
    if !is_totp_code(&code) {
        return Ok(
            db::totp::use_recovery_code(&state.pool, user_id, &hash_recovery_code(&code)).await?,
        );
    }

    let Some(totp) = db::totp::get(&state.pool, user_id)
        .await?
        .filter(|totp| totp.confirmed)
    else {
        return Ok(false);
    };
    let step = totp_step(&totp.secret, &code, unix_now()).map_err(AppError::Internal)?;
    match step {
        Some(step) => Ok(db::totp::use_step(&state.pool, user_id, step).await?),
        None => Ok(false),
    }
}

pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

/// Logs the user in: a new session plus its cookie.
pub async fn start_session(state: &AppState, jar: CookieJar, user_id: i64) -> AppResult<CookieJar> {
    let token = new_token().map_err(AppError::Internal)?;
    db::sessions::create(&state.pool, user_id, &hash_token(&token)).await?;
    Ok(jar.add(session_cookie(token, state.secure_cookies)))
}

/// Also fine without a session, so a stale tab can always log out.
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> AppResult<(CookieJar, StatusCode)> {
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        db::sessions::delete(&state.pool, &hash_token(cookie.value())).await?;
    }
    Ok((
        jar.remove(Cookie::build(SESSION_COOKIE).path("/api")),
        StatusCode::NO_CONTENT,
    ))
}

/// Ends with the browser; the database lets it count for 5 minutes only.
fn challenge_cookie(token: String, secure: bool) -> Cookie<'static> {
    Cookie::build((CHALLENGE_COOKIE, token))
        .path(CHALLENGE_PATH)
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure)
        .build()
}

/// Only sent to `/api`. Lax: other sites can link to the app, but their
/// forms cannot post with the cookie. The cookie itself never expires (the
/// browser caps it at 400 days) – the session in the database decides,
/// which lets it renew without sending a new cookie.
fn session_cookie(token: String, secure: bool) -> Cookie<'static> {
    Cookie::build((SESSION_COOKIE, token))
        .path("/api")
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(secure)
        .permanent()
        .build()
}
