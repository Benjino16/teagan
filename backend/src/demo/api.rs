//! The real API router, called in-process with the demo user's session –
//! no port, no running server. Like `http/tests.rs`, but for seeding.

use anyhow::{Context, bail};
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Method, Request, header},
};
use serde_json::Value;
use sqlx::SqlitePool;
use tower::ServiceExt;

use crate::http::{AppState, router};

pub struct Api {
    router: Router,
    cookie: String,
}

impl Api {
    pub fn new(pool: SqlitePool, session_token: &str) -> Self {
        Self {
            router: router(AppState::new(pool, false)),
            cookie: format!("session={session_token}"),
        }
    }

    pub async fn get(&self, path: &str) -> anyhow::Result<Value> {
        self.send(Method::GET, path, Body::empty(), None).await
    }

    pub async fn post(&self, path: &str, body: Value) -> anyhow::Result<Value> {
        self.send(
            Method::POST,
            path,
            Body::from(body.to_string()),
            Some("application/json"),
        )
        .await
    }

    pub async fn put(&self, path: &str, body: Value) -> anyhow::Result<Value> {
        self.send(
            Method::PUT,
            path,
            Body::from(body.to_string()),
            Some("application/json"),
        )
        .await
    }

    /// A raw body, e.g. a photo.
    pub async fn put_bytes(&self, path: &str, bytes: Vec<u8>) -> anyhow::Result<Value> {
        self.send(Method::PUT, path, Body::from(bytes), None).await
    }

    /// `path` without the `/api` prefix. Anything but a 2xx is an error that
    /// names the request and carries the API's message.
    async fn send(
        &self,
        method: Method,
        path: &str,
        body: Body,
        content_type: Option<&str>,
    ) -> anyhow::Result<Value> {
        let mut request = Request::builder()
            .method(method.clone())
            .uri(format!("/api{path}"))
            .header(header::COOKIE, &self.cookie);
        if let Some(content_type) = content_type {
            request = request.header(header::CONTENT_TYPE, content_type);
        }

        let response = self.router.clone().oneshot(request.body(body)?).await?;
        let status = response.status();
        let bytes = to_bytes(response.into_body(), usize::MAX).await?;

        if !status.is_success() {
            bail!(
                "{method} {path} → {status}: {}",
                String::from_utf8_lossy(&bytes)
            );
        }
        if bytes.is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_slice(&bytes)
            .with_context(|| format!("{method} {path}: no JSON in the response"))
    }
}

/// The `id` of a created or fetched object.
pub fn id_of(value: &Value) -> anyhow::Result<i64> {
    value["id"]
        .as_i64()
        .with_context(|| format!("no id in {value}"))
}
