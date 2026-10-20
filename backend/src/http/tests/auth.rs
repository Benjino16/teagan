use axum::http::{Method, StatusCode, header};
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::{PASSWORD, TestApp, USERNAME, request, totp_code};

async fn status(app: &TestApp) -> Value {
    let (status, body) = app.get("/api/auth/status").await;
    assert_eq!(status, StatusCode::OK);
    body
}

async fn login(app: &TestApp, username: &str, password: &str) -> (StatusCode, Value) {
    app.post(
        "/api/auth/login",
        json!({ "username": username, "password": password }),
    )
    .await
}

async fn login_code(app: &TestApp, code: &str) -> StatusCode {
    app.post("/api/auth/login/totp", json!({ "code": code }))
        .await
        .0
}

#[sqlx::test]
async fn setup_creates_the_first_account_once(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    assert_eq!(
        status(&app).await,
        json!({ "loggedIn": false, "setupRequired": true })
    );

    // Invalid input changes nothing
    for body in [
        json!({ "username": "ben", "password": "short", "name": "Ben" }),
        json!({ "username": "b e n", "password": PASSWORD, "name": "Ben" }),
        json!({ "username": "ben", "password": PASSWORD, "name": " " }),
    ] {
        let (status, _) = app.post("/api/setup", body.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    }
    assert_eq!(status(&app).await["setupRequired"], true);

    let (status_code, _) = app
        .post(
            "/api/setup",
            json!({ "username": " Ben ", "password": PASSWORD, "name": "Ben" }),
        )
        .await;
    assert_eq!(status_code, StatusCode::NO_CONTENT);
    assert_eq!(
        status(&app).await,
        json!({ "loggedIn": true, "setupRequired": false })
    );
    assert_eq!(
        app.get("/api/account").await.1["username"],
        "ben",
        "stored in lower case"
    );

    // After that the route is gone, also for someone else
    let (status_code, _) = app
        .client()
        .post(
            "/api/setup",
            json!({ "username": "eve", "password": PASSWORD, "name": "Eve" }),
        )
        .await;
    assert_eq!(status_code, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn login_and_logout(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let browser = app.client();
    assert_eq!(status(&browser).await["loggedIn"], false);

    // Usernames don't care about case or surrounding spaces
    let (status_code, body) = login(&browser, " BEN ", PASSWORD).await;
    assert_eq!(status_code, StatusCode::OK);
    assert_eq!(body, json!({ "totpRequired": false }));
    assert!(browser.has_cookie("session"));
    assert_eq!(browser.get("/api/people").await.0, StatusCode::OK);

    assert_eq!(
        browser.post("/api/auth/logout", json!(null)).await.0,
        StatusCode::NO_CONTENT
    );
    assert!(!browser.has_cookie("session"));
    assert_eq!(browser.get("/api/people").await.0, StatusCode::UNAUTHORIZED);
    // Without a session too, so a stale tab can always log out
    assert_eq!(
        browser.post("/api/auth/logout", json!(null)).await.0,
        StatusCode::NO_CONTENT
    );

    // The setup session is a different one and stays
    assert_eq!(app.get("/api/people").await.0, StatusCode::OK);
}

#[sqlx::test]
async fn logout_ends_the_session_on_the_server(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let session = app.cookies.lock().unwrap()["session"].clone();
    app.post("/api/auth/logout", json!(null)).await;

    // A copy of the old cookie no longer works
    let thief = app.client();
    thief
        .cookies
        .lock()
        .unwrap()
        .insert("session".to_string(), session);
    assert_eq!(thief.get("/api/people").await.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn wrong_login_says_nothing_about_the_user(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let browser = app.client();

    let (status_code, wrong_password) = login(&browser, USERNAME, "wrong password").await;
    assert_eq!(status_code, StatusCode::BAD_REQUEST);
    let (status_code, unknown_user) = login(&browser, "nobody", PASSWORD).await;
    assert_eq!(status_code, StatusCode::BAD_REQUEST);
    assert_eq!(wrong_password, unknown_user);
    assert!(!browser.has_cookie("session"));
}

#[sqlx::test]
async fn too_many_wrong_logins_lock_the_username(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let browser = app.client();
    for _ in 0..10 {
        assert_eq!(
            login(&browser, USERNAME, "wrong password").await.0,
            StatusCode::BAD_REQUEST
        );
    }

    // Now even the right password has to wait
    let (status_code, body) = login(&browser, USERNAME, PASSWORD).await;
    assert_eq!(status_code, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(body["code"], "too_many_attempts");
    let body = json!({ "username": USERNAME, "password": PASSWORD });
    let (status_code, headers, _) = browser
        .send_request(request(Method::POST, "/api/auth/login", Some(body)))
        .await;
    assert_eq!(status_code, StatusCode::TOO_MANY_REQUESTS);
    let retry_after: u64 = headers[header::RETRY_AFTER]
        .to_str()
        .unwrap()
        .parse()
        .unwrap();
    assert!((1..=15 * 60).contains(&retry_after), "{retry_after}");

    // Sessions that already exist keep working
    assert_eq!(app.get("/api/people").await.0, StatusCode::OK);
}

#[sqlx::test]
async fn login_with_totp(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (secret, _) = app.enable_totp().await;
    let browser = app.client();

    // The password alone only starts a challenge
    let (status_code, body) = login(&browser, USERNAME, PASSWORD).await;
    assert_eq!(status_code, StatusCode::OK);
    assert_eq!(body, json!({ "totpRequired": true }));
    assert!(browser.has_cookie("login_challenge"));
    assert!(!browser.has_cookie("session"));
    assert_eq!(browser.get("/api/people").await.0, StatusCode::UNAUTHORIZED);

    assert_eq!(
        login_code(&browser, "000000").await,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        login_code(&browser, &totp_code(&secret, 0)).await,
        StatusCode::NO_CONTENT
    );
    assert!(!browser.has_cookie("login_challenge"));
    assert_eq!(browser.get("/api/people").await.0, StatusCode::OK);
}

#[sqlx::test]
async fn a_totp_code_works_only_once(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (secret, _) = app.enable_totp().await;
    let code = totp_code(&secret, 0);

    let first = app.client();
    login(&first, USERNAME, PASSWORD).await;
    assert_eq!(login_code(&first, &code).await, StatusCode::NO_CONTENT);

    // Someone who saw the code can't use it again
    let second = app.client();
    login(&second, USERNAME, PASSWORD).await;
    assert_eq!(login_code(&second, &code).await, StatusCode::BAD_REQUEST);
    assert_eq!(
        login_code(&second, &totp_code(&secret, 1)).await,
        StatusCode::NO_CONTENT
    );
}

#[sqlx::test]
async fn login_with_a_recovery_code(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, codes) = app.enable_totp().await;
    assert_eq!(codes.len(), 10);

    // As typed from a printout: upper case, a space instead of the dash
    let browser = app.client();
    login(&browser, USERNAME, PASSWORD).await;
    assert_eq!(
        login_code(&browser, &codes[0].to_uppercase().replace('-', " ")).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(app.get("/api/account").await.1["recoveryCodesLeft"], 9);

    let again = app.client();
    login(&again, USERNAME, PASSWORD).await;
    assert_eq!(
        login_code(&again, &codes[0]).await,
        StatusCode::BAD_REQUEST,
        "used up"
    );
    assert_eq!(login_code(&again, &codes[1]).await, StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn a_challenge_ends_after_five_wrong_codes(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (secret, _) = app.enable_totp().await;
    let browser = app.client();
    login(&browser, USERNAME, PASSWORD).await;

    for _ in 0..5 {
        assert_eq!(
            login_code(&browser, "000000").await,
            StatusCode::BAD_REQUEST
        );
    }
    // Back to the password, even with the right code
    assert_eq!(
        login_code(&browser, &totp_code(&secret, 0)).await,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn a_code_without_a_challenge_is_404(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (secret, _) = app.enable_totp().await;
    assert_eq!(
        login_code(&app.client(), &totp_code(&secret, 0)).await,
        StatusCode::NOT_FOUND
    );
}
