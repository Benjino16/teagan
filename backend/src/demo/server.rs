//! What a running demo build adds to the server – on top of the router,
//! without touching a handler:
//!
//! - `GET /api/demo` hands out the demo login, so the login screen can offer
//!   a button for it. `NotFound` until `demo load` has run.
//! - Unless `DEMO_ACCOUNT_CHANGES` is on, the `demo` account can't change
//!   its own account (password, two-factor login), so no visitor can lock
//!   the others out of a public demo.

use axum::{
    Json, Router,
    extract::{Request, State},
    http::Method,
    middleware::{self, Next},
    response::Response,
    routing::get,
};
use serde::Serialize;

use super::{PASSWORD, USERNAME};
use crate::{
    db,
    error::{AppError, AppResult},
    http::{AppState, CurrentUser},
};

#[derive(clap::Args)]
pub struct DemoConfig {
    /// Lets the `demo` account change its password and two-factor login,
    /// e.g. to show the setup in a presentation. Off for a public demo:
    /// one visitor could lock out everyone else until the next reset.
    #[arg(long, env = "DEMO_ACCOUNT_CHANGES")]
    demo_account_changes: bool,
}

/// Every `/api/account…` route that writes – a prefix, so routes added
/// there later are covered too.
const ACCOUNT_PREFIX: &str = "/api/account";

pub fn extend(router: Router, state: AppState, config: &DemoConfig) -> Router {
    println!("demo build – the account \"{USERNAME}\" has a public password");
    let router = router.merge(
        Router::new()
            .route("/api/demo", get(demo_login))
            .with_state(state.clone()),
    );
    if config.demo_account_changes {
        return router;
    }
    // Outermost, before routing: it sees the path the router decides on
    router.layer(middleware::from_fn_with_state(state, guard_account))
}

#[derive(Serialize)]
struct DemoLogin {
    username: &'static str,
    password: &'static str,
}

async fn demo_login(State(state): State<AppState>) -> AppResult<Json<DemoLogin>> {
    if !db::users::exists(&state.pool, USERNAME).await? {
        return Err(AppError::NotFound);
    }
    Ok(Json(DemoLogin {
        username: USERNAME,
        password: PASSWORD,
    }))
}

async fn guard_account(
    State(state): State<AppState>,
    user: Option<CurrentUser>,
    request: Request,
    next: Next,
) -> AppResult<Response> {
    let writes = request.method() != Method::GET && request.method() != Method::HEAD;
    if writes && request.uri().path().starts_with(ACCOUNT_PREFIX) {
        // Looked up per request: `demo load --reset` gives the account a new id
        if let Some(user) = user
            && db::users::get(&state.pool, user.id).await?.username == USERNAME
        {
            return Err(AppError::Invalid("Not available in the demo.".to_string()));
        }
    }
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use std::net::SocketAddr;

    use axum::{
        body::{Body, to_bytes},
        extract::ConnectInfo,
        http::{StatusCode, header},
    };
    use serde_json::{Value, json};
    use sqlx::SqlitePool;
    use tower::ServiceExt;

    use super::*;
    use crate::{
        demo::create_user,
        domain::{hash_token, new_token},
        http::router,
    };

    fn app(pool: &SqlitePool, demo_account_changes: bool) -> Router {
        let state = AppState::new(pool.clone(), false);
        extend(
            router(state.clone()),
            state,
            &DemoConfig {
                demo_account_changes,
            },
        )
    }

    /// A session cookie for the user, straight into the db.
    async fn session(pool: &SqlitePool, user_id: i64) -> String {
        let token = new_token().unwrap();
        db::sessions::create(pool, user_id, &hash_token(&token))
            .await
            .unwrap();
        format!("session={token}")
    }

    async fn send(
        app: &Router,
        method: Method,
        uri: &str,
        cookie: Option<&str>,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let mut request = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .extension(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 1234))));
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        let body = body.map_or(Body::empty(), |body| Body::from(body.to_string()));
        let response = app
            .clone()
            .oneshot(request.body(body).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    fn new_password() -> Value {
        json!({ "currentPassword": PASSWORD, "newPassword": "a whole new password" })
    }

    #[sqlx::test]
    async fn hands_out_the_login_once_loaded(pool: SqlitePool) {
        let app = app(&pool, false);
        let (status, _) = send(&app, Method::GET, "/api/demo", None, None).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "before `demo load`");

        create_user(&pool, "Demo").await.unwrap();
        let (status, body) = send(&app, Method::GET, "/api/demo", None, None).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "username": USERNAME, "password": PASSWORD }));
    }

    #[sqlx::test]
    async fn demo_account_cannot_change_itself(pool: SqlitePool) {
        let app = app(&pool, false);
        let demo = session(&pool, create_user(&pool, "Demo").await.unwrap()).await;
        let demo = Some(demo.as_str());

        let (status, body) = send(
            &app,
            Method::PUT,
            "/api/account/password",
            demo,
            Some(new_password()),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["message"], "Not available in the demo.");
        let (status, _) = send(&app, Method::POST, "/api/account/totp", demo, None).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        // Reading stays allowed, so the settings page works
        let (status, _) = send(&app, Method::GET, "/api/account", demo, None).await;
        assert_eq!(status, StatusCode::OK);

        // Spellings that don't match the prefix don't reach the handler either
        // (some end in the frontend fallback, which answers 200 with the app)
        for uri in [
            "/api//account/password",
            "/api/%61ccount/password",
            "/API/account/password",
            "//api/account/password",
        ] {
            let (status, _) = send(&app, Method::PUT, uri, demo, Some(new_password())).await;
            assert_ne!(status, StatusCode::NO_CONTENT, "{uri} changed the password");
        }
        let login = json!({ "username": USERNAME, "password": PASSWORD });
        let (status, _) = send(&app, Method::POST, "/api/auth/login", None, Some(login)).await;
        assert_eq!(status, StatusCode::OK, "the password is still the old one");
    }

    #[sqlx::test]
    async fn other_accounts_keep_their_settings(pool: SqlitePool) {
        let app = app(&pool, false);
        create_user(&pool, "Demo").await.unwrap();
        let other = db::users::create(&pool, "ben", "unused", "Ben")
            .await
            .unwrap();
        let other = session(&pool, other).await;

        let (status, _) = send(&app, Method::POST, "/api/account/totp", Some(&other), None).await;
        assert_eq!(status, StatusCode::OK);
    }

    #[sqlx::test]
    async fn account_changes_can_be_allowed(pool: SqlitePool) {
        let app = app(&pool, true);
        let demo = session(&pool, create_user(&pool, "Demo").await.unwrap()).await;

        let (status, _) = send(&app, Method::POST, "/api/account/totp", Some(&demo), None).await;
        assert_eq!(status, StatusCode::OK);
    }
}
