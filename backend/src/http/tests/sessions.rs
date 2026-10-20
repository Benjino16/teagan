//! Expiry and renewal. The tests move `expires_at` in the database instead
//! of waiting.

use axum::http::StatusCode;
use serde_json::json;
use sqlx::SqlitePool;

use super::{PASSWORD, TestApp, USERNAME, totp_code};

/// Days left on each of the sessions, rounded.
async fn session_days_left(pool: &SqlitePool) -> Vec<i64> {
    sqlx::query_scalar(
        "SELECT CAST(round(julianday(expires_at) - julianday('now')) AS INTEGER) FROM sessions",
    )
    .fetch_all(pool)
    .await
    .unwrap()
}

async fn set_session_expiry(pool: &SqlitePool, modifier: &str) {
    sqlx::query("UPDATE sessions SET expires_at = datetime('now', ?)")
        .bind(modifier)
        .execute(pool)
        .await
        .unwrap();
}

#[sqlx::test]
async fn a_session_lasts_30_days(pool: SqlitePool) {
    TestApp::new(pool.clone()).await;
    assert_eq!(session_days_left(&pool).await, [30]);
}

#[sqlx::test]
async fn an_expired_session_is_logged_out(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    set_session_expiry(&pool, "-1 minute").await;

    assert_eq!(app.get("/api/people").await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(app.get("/api/auth/status").await.1["loggedIn"], false);
}

#[sqlx::test]
async fn a_session_in_use_is_renewed_once_half_is_gone(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;

    // More than half left: only read, not extended
    set_session_expiry(&pool, "+20 days").await;
    assert_eq!(app.get("/api/people").await.0, StatusCode::OK);
    assert_eq!(session_days_left(&pool).await, [20]);

    set_session_expiry(&pool, "+10 days").await;
    assert_eq!(app.get("/api/people").await.0, StatusCode::OK);
    assert_eq!(session_days_left(&pool).await, [30]);
}

#[sqlx::test]
async fn a_new_session_clears_out_expired_ones(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    set_session_expiry(&pool, "-1 minute").await;

    let (status, _) = app
        .client()
        .post(
            "/api/auth/login",
            json!({ "username": USERNAME, "password": PASSWORD }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        session_days_left(&pool).await,
        [30],
        "only the new one is left"
    );
}

#[sqlx::test]
async fn a_login_challenge_lasts_5_minutes(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let (secret, _) = app.enable_totp().await;
    let browser = app.client();
    browser
        .post(
            "/api/auth/login",
            json!({ "username": USERNAME, "password": PASSWORD }),
        )
        .await;

    let minutes_left: i64 = sqlx::query_scalar(
        "SELECT CAST(round((julianday(expires_at) - julianday('now')) * 24 * 60) AS INTEGER) FROM login_challenges",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(minutes_left, 5);

    sqlx::query("UPDATE login_challenges SET expires_at = datetime('now', '-1 second')")
        .execute(&pool)
        .await
        .unwrap();
    // Back to the password, even with the right code
    let (status, _) = browser
        .post(
            "/api/auth/login/totp",
            json!({ "code": totp_code(&secret, 0) }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(!browser.has_cookie("session"));
}
