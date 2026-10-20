//! Everything outside `/api`. Debug builds read `frontend/dist` from disk, so
//! what is served depends on whether `npm run build` ran – the tests check
//! whichever case applies.

use std::path::{Path, PathBuf};

use axum::http::{HeaderMap, Method, StatusCode, header};
use sqlx::SqlitePool;

use super::TestApp;

fn dist() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../frontend/dist")
}

async fn get(app: &TestApp, uri: &str) -> (StatusCode, HeaderMap, String) {
    let (status, headers, body) = app.send_bytes(Method::GET, uri, vec![]).await;
    (status, headers, String::from_utf8_lossy(&body).into_owned())
}

#[sqlx::test]
async fn health(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    let (status, _, body) = get(&app, "/api/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, "ok");
}

/// Both values come from Cargo.toml; an empty `repository` would hide the
/// source link the AGPL asks for.
#[sqlx::test]
async fn about(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    let (status, about) = app.get("/api/about").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        about,
        serde_json::json!({
            "version": env!("CARGO_PKG_VERSION"),
            "sourceUrl": env!("CARGO_PKG_REPOSITORY"),
        })
    );
    assert!(!env!("CARGO_PKG_REPOSITORY").is_empty());
}

/// Client-side routes get `index.html`, so a reload on `/people/3` works.
/// No login needed – the app shows the login screen itself.
#[sqlx::test]
async fn app_routes_get_index_html(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    let index = std::fs::read_to_string(dist().join("index.html")).ok();

    for uri in [
        "/",
        "/people/3",
        "/groups/archived",
        "/settings?tab=account",
    ] {
        let (status, headers, body) = get(&app, uri).await;
        match &index {
            Some(index) => {
                assert_eq!(status, StatusCode::OK, "{uri}");
                assert_eq!(
                    headers[header::CONTENT_TYPE],
                    "text/html; charset=utf-8",
                    "{uri}"
                );
                assert_eq!(headers[header::CACHE_CONTROL], "no-cache", "{uri}");
                assert_eq!(&body, index, "{uri}");
            }
            None => {
                assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
                assert!(body.starts_with("Frontend not built"), "{uri}: {body}");
            }
        }
    }
}

#[sqlx::test]
async fn files_from_dist(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    let Ok(assets) = std::fs::read_dir(dist().join("assets")) else {
        eprintln!("frontend/dist not built – skipping the file checks");
        return;
    };

    // Hashed names never change, so they may be cached forever
    let asset = assets
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .find(|name| name.ends_with(".js"));
    let asset = asset.expect("a built frontend has a JS bundle");
    let (status, headers, _) = get(&app, &format!("/assets/{asset}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers[header::CONTENT_TYPE], "text/javascript");
    assert_eq!(
        headers[header::CACHE_CONTROL],
        "public, max-age=31536000, immutable"
    );

    // Everything else is revalidated
    let (status, headers, body) = get(&app, "/favicon.svg").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers[header::CONTENT_TYPE], "image/svg+xml");
    assert_eq!(headers[header::CACHE_CONTROL], "no-cache");
    assert_eq!(
        body,
        std::fs::read_to_string(dist().join("favicon.svg")).unwrap()
    );
}

/// A missing file is a 404, not the app – e.g. an old hashed asset after a
/// deploy, which would otherwise get HTML as JavaScript.
#[sqlx::test]
async fn missing_files_are_404(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    for uri in [
        "/assets/index-0ld0ld.js",
        "/nope.png",
        "/people/3/photo.jpg",
    ] {
        let (status, _, body) = get(&app, uri).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
        assert!(!body.contains("<html"), "{uri}");
    }
}

/// Unknown API paths stay JSON and never fall through to the app.
#[sqlx::test]
async fn api_paths_never_get_the_app(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    for uri in ["/api", "/api/nope", "/api/people/3/nope"] {
        let (status, headers, _) = get(&app, uri).await;
        assert_ne!(status, StatusCode::OK, "{uri}");
        assert_ne!(
            headers
                .get(header::CONTENT_TYPE)
                .map(|v| v.to_str().unwrap()),
            Some("text/html; charset=utf-8"),
            "{uri}"
        );
    }
}
