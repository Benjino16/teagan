//! Tests against the whole API: the real router on a fresh SQLite file per
//! test (`#[sqlx::test]` runs the migrations), no port, no running server.

mod account;
mod activities;
mod auth;
mod cookies;
mod facts;
mod frontend;
mod groups;
mod ledger;
mod open_points;
mod people;
mod photos;
mod search;
mod sessions;
mod settings;

use std::{collections::BTreeMap, net::SocketAddr, sync::Mutex};

use axum::{
    Router,
    body::{Body, Bytes},
    extract::ConnectInfo,
    http::{HeaderMap, Method, Request, StatusCode, header},
};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;

use totp_rs::{Builder, Secret};

use super::{AppState, auth::unix_now, router};
use crate::{
    db,
    domain::{hash_token, new_token},
};

/// Login of the user `TestApp::new` creates.
const USERNAME: &str = "ben";
const PASSWORD: &str = "correct horse";

/// The router plus one browser's cookies: they are sent with every request
/// and updated from every `Set-Cookie`. Paths are ignored – every cookie
/// goes everywhere.
struct TestApp {
    router: Router,
    cookies: Mutex<BTreeMap<String, String>>,
}

impl TestApp {
    /// A fresh instance nobody has set up yet.
    fn logged_out(pool: SqlitePool) -> Self {
        Self {
            router: router(AppState::new(pool, false)),
            cookies: Mutex::default(),
        }
    }

    /// Runs the setup like the browser does, so the first user is logged in.
    async fn new(pool: SqlitePool) -> Self {
        let app = Self::logged_out(pool);
        let (status, _) = app
            .post(
                "/api/setup",
                json!({ "username": USERNAME, "password": PASSWORD, "name": "Ben" }),
            )
            .await;
        assert_eq!(status, StatusCode::NO_CONTENT);
        app
    }

    /// Another browser on the same server, without cookies.
    fn client(&self) -> Self {
        Self {
            router: self.router.clone(),
            cookies: Mutex::default(),
        }
    }

    /// A second user on the same database, e.g. to check that owners are kept apart.
    /// Straight into the db – going through login would cost an Argon2 hash.
    async fn other_user(&self, pool: &SqlitePool) -> Self {
        let user_id = db::users::create(pool, "mira", "unused", "Mira")
            .await
            .unwrap();
        let token = new_token().unwrap();
        db::sessions::create(pool, user_id, &hash_token(&token))
            .await
            .unwrap();
        let client = self.client();
        client
            .cookies
            .lock()
            .unwrap()
            .insert("session".to_string(), token);
        client
    }

    fn has_cookie(&self, name: &str) -> bool {
        self.cookies.lock().unwrap().contains_key(name)
    }

    async fn get(&self, uri: &str) -> (StatusCode, Value) {
        self.send(Method::GET, uri, None).await
    }

    async fn post(&self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.send(Method::POST, uri, Some(body)).await
    }

    async fn put(&self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.send(Method::PUT, uri, Some(body)).await
    }

    async fn patch(&self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.send(Method::PATCH, uri, Some(body)).await
    }

    async fn delete(&self, uri: &str) -> (StatusCode, Value) {
        self.send(Method::DELETE, uri, None).await
    }

    /// The JSON body, or `Null` for an empty one (204).
    async fn send(&self, method: Method, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
        let request = request(method, uri, body);
        let (status, _, bytes) = self.send_request(request).await;
        let json = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        };
        (status, json)
    }

    /// For routes that don't speak JSON, like photos.
    async fn send_bytes(
        &self,
        method: Method,
        uri: &str,
        body: Vec<u8>,
    ) -> (StatusCode, HeaderMap, Bytes) {
        let mut request = request(method, uri, None);
        *request.body_mut() = Body::from(body);
        self.send_request(request).await
    }

    async fn send_request(&self, mut request: Request<Body>) -> (StatusCode, HeaderMap, Bytes) {
        let cookies = self
            .cookies
            .lock()
            .unwrap()
            .iter()
            .map(|(name, value)| format!("{name}={value}"))
            .collect::<Vec<_>>();
        if !cookies.is_empty() {
            request
                .headers_mut()
                .insert(header::COOKIE, cookies.join("; ").parse().unwrap());
        }

        let response = self.router.clone().oneshot(request).await.unwrap();
        let (parts, body) = response.into_parts();
        for set_cookie in parts.headers.get_all(header::SET_COOKIE) {
            let set_cookie = set_cookie.to_str().unwrap();
            let (name, value) = set_cookie
                .split(';')
                .next()
                .unwrap()
                .split_once('=')
                .unwrap();
            let mut cookies = self.cookies.lock().unwrap();
            // A removal comes as an empty value that expires right away
            if value.is_empty() || set_cookie.contains("Max-Age=0") {
                cookies.remove(name);
            } else {
                cookies.insert(name.to_string(), value.to_string());
            }
        }
        let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
        (parts.status, parts.headers, bytes)
    }

    /// Turns TOTP on with a code from the previous step; the secret and the
    /// recovery codes.
    async fn enable_totp(&self) -> (String, Vec<String>) {
        let (status, setup) = self.send(Method::POST, "/api/account/totp", None).await;
        assert_eq!(status, StatusCode::OK);
        let secret = setup["secret"].as_str().unwrap().to_string();
        let (status, confirmed) = self
            .post(
                "/api/account/totp/confirm",
                json!({ "code": totp_code(&secret, -1) }),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        let codes = confirmed["recoveryCodes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c.as_str().unwrap().to_string());
        (secret, codes.collect())
    }

    async fn create_person(&self, name: &str) -> i64 {
        let (status, person) = self
            .post("/api/people", json!({ "name": name, "impact": 3 }))
            .await;
        assert_eq!(status, StatusCode::OK);
        person["id"].as_i64().unwrap()
    }

    async fn create_group(&self, name: &str, parent_id: Option<i64>) -> i64 {
        let (status, group) = self
            .post(
                "/api/groups",
                json!({ "name": name, "parentId": parent_id }),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        group["id"].as_i64().unwrap()
    }

    async fn create_activity(&self, name: &str, people: &[i64]) -> i64 {
        let participants: Vec<_> = people.iter().map(|id| json!({ "personId": id })).collect();
        let body = json!({ "name": name, "startDate": "2026-10-12", "impact": 3, "participants": participants });
        let (status, activity) = self.post("/api/activities", body).await;
        assert_eq!(status, StatusCode::OK);
        activity["id"].as_i64().unwrap()
    }
}

/// The code an authenticator app shows `steps` × 30 s from now. The server
/// accepts the neighbouring steps too, but each only once – so tests use
/// -1, 0, +1 in that order.
fn totp_code(secret: &str, steps: i64) -> String {
    let secret = Secret::try_from_base32(secret).unwrap();
    let totp = Builder::new()
        .with_secret(secret)
        .with_account_name("-")
        .build()
        .unwrap();
    totp.generate(unix_now().saturating_add_signed(steps * 30))
        .to_string()
}

fn request(method: Method, uri: &str, body: Option<Value>) -> Request<Body> {
    let mut builder = Request::builder().method(method).uri(uri);
    let body = match body {
        Some(json) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
        }
        None => Body::empty(),
    };
    let mut request = builder.body(body).unwrap();
    // Set by `into_make_service_with_connect_info` in the real server; login and setup need it
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 4000))));
    request
}

#[sqlx::test]
async fn api_needs_a_login(pool: SqlitePool) {
    let app = TestApp::logged_out(pool);
    assert_eq!(app.get("/api/people").await.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn unknown_api_path_is_json_404(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (status, body) = app.get("/api/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "not_found");
}
