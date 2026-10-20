//! The logged-in user of a request.
//!
//! Every handler that touches user data takes `CurrentUser` as a parameter and
//! passes `user.id` as `owner_id` to the db layer. There is no other way to get
//! an `owner_id`, so a route without auth cannot happen by accident.
//!
//! Auth design – all login methods end in the same kind of session:
//!
//! ```text
//! password ──┐
//!            ├─(TOTP enabled?)─► login_challenges ──TOTP code──┐
//!            └──────────────────────────────────────────────── ├─► sessions ─► CurrentUser
//! passkey ─────────────────────────────────────────────────────┘
//! ```
//!
//! - `sessions` only ever holds *fully* authenticated sessions. A login that
//!   still needs a second factor lives in a separate, short-lived
//!   `login_challenges` table. That way the lookup below can never let a
//!   half-finished login through by forgetting a status check.
//! - A passkey already proves possession, so it creates a session directly.
//! - TOTP lives in `user_totp` and `recovery_codes`; later `passkeys`
//!   (several per user, one per device/sync provider).
//! - The extractor below reads the `session` cookie, hashes it and looks it
//!   up in `sessions` (not expired) – else `AppError::Unauthorized`.

use axum::{
    extract::{FromRequestParts, OptionalFromRequestParts},
    http::request::Parts,
};
use axum_extra::extract::CookieJar;

use super::{AppState, auth::SESSION_COOKIE};
use crate::{db, domain::hash_token, error::AppError};

#[derive(Debug, Clone, Copy)]
pub struct CurrentUser {
    pub id: i64,
}

/// `Option<CurrentUser>` for routes that work with and without a login.
impl OptionalFromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<Self>, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        let Some(cookie) = jar.get(SESSION_COOKIE) else {
            return Ok(None);
        };
        let user_id = db::sessions::find_user(&state.pool, &hash_token(cookie.value())).await?;
        Ok(user_id.map(|id| CurrentUser { id }))
    }
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        <Self as OptionalFromRequestParts<AppState>>::from_request_parts(parts, state)
            .await?
            .ok_or(AppError::Unauthorized)
    }
}
