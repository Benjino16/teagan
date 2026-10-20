use axum::http::{Method, StatusCode};
use serde_json::json;
use sqlx::SqlitePool;

use super::{PASSWORD, TestApp, USERNAME, totp_code};

async fn login(app: &TestApp, password: &str) -> StatusCode {
    app.post(
        "/api/auth/login",
        json!({ "username": USERNAME, "password": password }),
    )
    .await
    .0
}

#[sqlx::test]
async fn account_overview(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (status, account) = app.get("/api/account").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        account,
        json!({ "username": "ben", "totpEnabled": false, "recoveryCodesLeft": 0 })
    );

    assert_eq!(
        app.client().get("/api/account").await.0,
        StatusCode::UNAUTHORIZED
    );
}

#[sqlx::test]
async fn change_password(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let laptop = app.client();
    assert_eq!(login(&laptop, PASSWORD).await, StatusCode::OK);

    let change =
        |current: &str, new: &str| json!({ "currentPassword": current, "newPassword": new });
    let (status, error) = app
        .put(
            "/api/account/password",
            change("wrong password", "new password"),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["message"], "Current password is wrong.");
    assert_eq!(
        app.put("/api/account/password", change(PASSWORD, "short"))
            .await
            .0,
        StatusCode::BAD_REQUEST
    );

    let (status, _) = app
        .put("/api/account/password", change(PASSWORD, "new password"))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // This session stays, all others end
    assert_eq!(app.get("/api/people").await.0, StatusCode::OK);
    assert_eq!(laptop.get("/api/people").await.0, StatusCode::UNAUTHORIZED);

    let browser = app.client();
    assert_eq!(login(&browser, PASSWORD).await, StatusCode::BAD_REQUEST);
    assert_eq!(login(&browser, "new password").await, StatusCode::OK);
}

/// Guessing the password here counts against the same limit as the login.
#[sqlx::test]
async fn wrong_current_passwords_count_for_the_login_limit(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let body = json!({ "currentPassword": "wrong password", "newPassword": "new password" });
    for _ in 0..10 {
        assert_eq!(
            app.put("/api/account/password", body.clone()).await.0,
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        login(&app.client(), PASSWORD).await,
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[sqlx::test]
async fn set_up_totp(pool: SqlitePool) {
    let app = TestApp::new(pool).await;

    // Confirming needs a setup first
    assert_eq!(
        app.post("/api/account/totp/confirm", json!({ "code": "123456" }))
            .await
            .0,
        StatusCode::NOT_FOUND
    );

    let (status, setup) = app.send(Method::POST, "/api/account/totp", None).await;
    assert_eq!(status, StatusCode::OK);
    let secret = setup["secret"].as_str().unwrap();
    let url = setup["otpauthUrl"].as_str().unwrap();
    assert!(url.starts_with("otpauth://totp/Teagan:ben?"), "{url}");
    assert!(url.contains(&format!("secret={secret}")), "{url}");
    assert!(setup["qrSvg"].as_str().unwrap().contains("<svg"));

    // Not on before the first right code
    assert_eq!(app.get("/api/account").await.1["totpEnabled"], false);
    let (status, error) = app
        .post("/api/account/totp/confirm", json!({ "code": "000000" }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(error["message"].as_str().unwrap().starts_with("Wrong code"));

    let (status, confirmed) = app
        .post(
            "/api/account/totp/confirm",
            json!({ "code": totp_code(secret, 0) }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let codes = confirmed["recoveryCodes"].as_array().unwrap();
    assert_eq!(codes.len(), 10);
    assert!(
        codes.iter().all(|code| code.as_str().unwrap().len() == 11),
        "{codes:?}"
    );
    assert_eq!(
        app.get("/api/account").await.1,
        json!({ "username": "ben", "totpEnabled": true, "recoveryCodesLeft": 10 })
    );

    // Once on, neither a new setup nor a second confirm
    assert_eq!(
        app.send(Method::POST, "/api/account/totp", None).await.0,
        StatusCode::BAD_REQUEST
    );
    let (status, _) = app
        .post(
            "/api/account/totp/confirm",
            json!({ "code": totp_code(secret, 1) }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

/// Starting again replaces an unconfirmed secret, so only the newest counts.
#[sqlx::test]
async fn restarting_the_setup_replaces_the_secret(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, first) = app.send(Method::POST, "/api/account/totp", None).await;
    let (_, second) = app.send(Method::POST, "/api/account/totp", None).await;
    let (first, second) = (
        first["secret"].as_str().unwrap(),
        second["secret"].as_str().unwrap(),
    );
    assert_ne!(first, second);

    let (status, _) = app
        .post(
            "/api/account/totp/confirm",
            json!({ "code": totp_code(first, 0) }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = app
        .post(
            "/api/account/totp/confirm",
            json!({ "code": totp_code(second, 0) }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
}

#[sqlx::test]
async fn disable_totp(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    app.enable_totp().await;

    let (status, _) = app
        .send(
            Method::DELETE,
            "/api/account/totp",
            Some(json!({ "password": "wrong password" })),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(app.get("/api/account").await.1["totpEnabled"], true);

    let (status, _) = app
        .send(
            Method::DELETE,
            "/api/account/totp",
            Some(json!({ "password": PASSWORD })),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(
        app.get("/api/account").await.1,
        json!({ "username": "ben", "totpEnabled": false, "recoveryCodesLeft": 0 })
    );

    // The password alone is enough again
    let (status, body) = app
        .client()
        .post(
            "/api/auth/login",
            json!({ "username": USERNAME, "password": PASSWORD }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["totpRequired"], false);
}

#[sqlx::test]
async fn renew_recovery_codes(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let renew = |password: &str| json!({ "password": password });

    let (status, error) = app
        .post("/api/account/recovery-codes", renew(PASSWORD))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(error["message"], "Two-factor login is off.");

    let (_, old) = app.enable_totp().await;
    assert_eq!(
        app.post("/api/account/recovery-codes", renew("wrong password"))
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    let (status, renewed) = app
        .post("/api/account/recovery-codes", renew(PASSWORD))
        .await;
    assert_eq!(status, StatusCode::OK);
    let new = renewed["recoveryCodes"].as_array().unwrap();
    assert_eq!(new.len(), 10);

    // Only the new ones log in
    let browser = app.client();
    login(&browser, PASSWORD).await;
    assert_eq!(
        browser
            .post("/api/auth/login/totp", json!({ "code": old[0] }))
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        browser
            .post("/api/auth/login/totp", json!({ "code": new[0] }))
            .await
            .0,
        StatusCode::NO_CONTENT
    );
}
