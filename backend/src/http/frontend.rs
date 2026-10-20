//! Serves the built frontend (`frontend/dist`) from the binary.
//!
//! Release builds embed the files at compile time, so the binary is all you
//! deploy – run `npm run build` in `frontend/` before `cargo build --release`.
//! Debug builds read them from disk instead; in development the frontend
//! usually runs on Vite's dev server anyway, which proxies `/api` here.

use axum::{
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../frontend/dist/"]
#[allow_missing = true]
struct Assets;

/// Vite puts a content hash into every file name under `assets/`, so those
/// never change and may be cached forever. Everything else (index.html,
/// manifest, icons) is revalidated.
const IMMUTABLE: &str = "public, max-age=31536000, immutable";
const REVALIDATE: &str = "no-cache";

/// Fallback for every path outside `/api`: a file if one exists, otherwise
/// `index.html` so client-side routes like `/people/3` work on reload.
pub async fn serve(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    if !path.is_empty() {
        if let Some(file) = Assets::get(path) {
            let cache = if path.starts_with("assets/") {
                IMMUTABLE
            } else {
                REVALIDATE
            };
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            return (
                [
                    (header::CONTENT_TYPE, mime.as_ref()),
                    (header::CACHE_CONTROL, cache),
                ],
                file.data,
            )
                .into_response();
        }
        // A missing file (e.g. an old hashed asset) is a 404, not the app
        let last_segment = path.rsplit('/').next().unwrap_or_default();
        if last_segment.contains('.') {
            return StatusCode::NOT_FOUND.into_response();
        }
    }

    match Assets::get("index.html") {
        Some(index) => (
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (header::CACHE_CONTROL, REVALIDATE),
            ],
            index.data,
        )
            .into_response(),
        None => (
            StatusCode::NOT_FOUND,
            "Frontend not built – run `npm run build` in frontend/, or use the Vite dev server.",
        )
            .into_response(),
    }
}
