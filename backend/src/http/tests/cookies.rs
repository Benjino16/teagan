//! The attributes on `Set-Cookie`. Nothing else notices if they go wrong:
//! the browser would still send the cookie, just less safely.

use axum::http::{HeaderMap, Method, header};
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::{PASSWORD, TestApp, USERNAME, request, totp_code};
use crate::http::{AppState, router};

/// The `Set-Cookie` header for `name`, attributes split off and trimmed.
fn set_cookie(headers: &HeaderMap, name: &str) -> Vec<String> {
    let header = headers
        .get_all(header::SET_COOKIE)
        .iter()
        .map(|value| value.to_str().unwrap())
        .find(|value| value.starts_with(&format!("{name}=")))
        .unwrap_or_else(|| panic!("no Set-Cookie for {name} in {headers:?}"));
    header
        .split(';')
        .map(|part| part.trim().to_string())
        .collect()
}

fn has(attributes: &[String], attribute: &str) -> bool {
    attributes.iter().any(|a| a.eq_ignore_ascii_case(attribute))
}

fn has_prefix(attributes: &[String], prefix: &str) -> bool {
    attributes.iter().any(|a| {
        a.to_ascii_lowercase()
            .starts_with(&prefix.to_ascii_lowercase())
    })
}

async fn send(app: &TestApp, method: Method, uri: &str, body: Value) -> HeaderMap {
    app.send_request(request(method, uri, Some(body))).await.1
}

async fn login(app: &TestApp) -> HeaderMap {
    send(
        app,
        Method::POST,
        "/api/auth/login",
        json!({ "username": USERNAME, "password": PASSWORD }),
    )
    .await
}

#[sqlx::test]
async fn session_cookie(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let session = set_cookie(&login(&app.client()).await, "session");

    assert!(has(&session, "HttpOnly"), "{session:?}");
    assert!(has(&session, "SameSite=Lax"), "{session:?}");
    assert!(has(&session, "Path=/api"), "{session:?}");
    // Over plain HTTP by default, e.g. in the home network
    assert!(!has(&session, "Secure"), "{session:?}");
    // Kept across browser restarts; the database decides when it ends
    assert!(has_prefix(&session, "Max-Age="), "{session:?}");
}

#[sqlx::test]
async fn setup_sets_the_same_session_cookie(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    let body = json!({ "username": USERNAME, "password": PASSWORD, "name": "Ben" });
    let session = set_cookie(
        &send(&app, Method::POST, "/api/setup", body).await,
        "session",
    );

    for attribute in ["HttpOnly", "SameSite=Lax", "Path=/api"] {
        assert!(has(&session, attribute), "{attribute} in {session:?}");
    }
}

#[sqlx::test]
async fn secure_cookies_when_turned_on(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let (secret, _) = app.enable_totp().await;
    let secure = TestApp {
        router: router(AppState::new(pool, true)),
        cookies: Default::default(),
    };

    let headers = login(&secure).await;
    assert!(has(&set_cookie(&headers, "login_challenge"), "Secure"));
    let headers = send(
        &secure,
        Method::POST,
        "/api/auth/login/totp",
        json!({ "code": totp_code(&secret, 0) }),
    )
    .await;
    assert!(has(&set_cookie(&headers, "session"), "Secure"));
}

#[sqlx::test]
async fn login_challenge_cookie(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (secret, _) = app.enable_totp().await;
    let browser = app.client();

    let challenge = set_cookie(&login(&browser).await, "login_challenge");
    assert!(has(&challenge, "HttpOnly"), "{challenge:?}");
    assert!(has(&challenge, "SameSite=Lax"), "{challenge:?}");
    // Only needed for the code step
    assert!(has(&challenge, "Path=/api/auth"), "{challenge:?}");
    // Ends with the browser
    assert!(
        !has_prefix(&challenge, "Max-Age=") && !has_prefix(&challenge, "Expires="),
        "{challenge:?}"
    );

    // The code step removes it on the same path and starts the session
    let headers = send(
        &browser,
        Method::POST,
        "/api/auth/login/totp",
        json!({ "code": totp_code(&secret, 0) }),
    )
    .await;
    let removed = set_cookie(&headers, "login_challenge");
    assert!(
        has(&removed, "Path=/api/auth") && has(&removed, "Max-Age=0"),
        "{removed:?}"
    );
    assert!(has(&set_cookie(&headers, "session"), "HttpOnly"));
}

#[sqlx::test]
async fn logout_removes_the_session_cookie(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let removed = set_cookie(
        &send(&app, Method::POST, "/api/auth/logout", json!(null)).await,
        "session",
    );

    // Same path as when set, or the browser would keep the old one
    assert!(has(&removed, "Path=/api"), "{removed:?}");
    assert!(has(&removed, "Max-Age=0"), "{removed:?}");
    assert_eq!(removed[0], "session=");
}
