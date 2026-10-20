use axum::Json;
use serde::Serialize;

/// Which version runs and where its source code is – the AGPL asks to offer
/// the source to everyone who uses the app over the network.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AboutResponse {
    version: &'static str,
    source_url: &'static str,
}

pub async fn about() -> Json<AboutResponse> {
    Json(AboutResponse {
        version: env!("CARGO_PKG_VERSION"),
        source_url: env!("CARGO_PKG_REPOSITORY"),
    })
}
