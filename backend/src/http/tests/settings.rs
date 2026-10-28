use axum::http::StatusCode;
use serde_json::json;
use sqlx::SqlitePool;

use super::TestApp;

const URI: &str = "/api/account/settings";

#[sqlx::test]
async fn defaults_until_changed(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (status, settings) = app.get(URI).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(settings, json!({ "currency": "EUR" }));
}

#[sqlx::test]
async fn change_and_reset(pool: SqlitePool) {
    let app = TestApp::new(pool).await;

    let (status, settings) = app.patch(URI, json!({ "currency": "CHF" })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(settings, json!({ "currency": "CHF" }));
    assert_eq!(app.get(URI).await.1, settings);

    // Keys left out stay as they are
    let (status, settings) = app.patch(URI, json!({})).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(settings["currency"], "CHF");

    let (status, settings) = app.patch(URI, json!({ "currency": null })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(settings["currency"], "EUR");
}

#[sqlx::test]
async fn invalid_change_keeps_the_settings(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    app.patch(URI, json!({ "currency": "USD" })).await;

    for (patch, message) in [
        (json!({ "currency": "usd" }), "currency: format"),
        (json!({ "curency": "GBP" }), "curency: unknown"),
    ] {
        let (status, error) = app.patch(URI, patch).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(error["message"], message);
    }
    let (status, _) = app.patch(URI, json!({ "currency": 5 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    assert_eq!(app.get(URI).await.1["currency"], "USD");
}

#[sqlx::test]
async fn settings_are_per_user(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let mira = app.other_user(&pool).await;
    app.patch(URI, json!({ "currency": "CHF" })).await;

    assert_eq!(mira.get(URI).await.1["currency"], "EUR");
    assert_eq!(app.client().get(URI).await.0, StatusCode::UNAUTHORIZED);
}
