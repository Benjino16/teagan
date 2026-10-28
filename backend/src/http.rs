mod about;
mod account;
mod activities;
mod auth;
mod current_user;
mod error;
mod facts;
mod frontend;
mod groups;
mod health;
mod ledger;
mod login_limit;
mod memberships;
mod open_points;
mod people;
mod photos;
mod search;
mod setup;
#[cfg(test)]
mod tests;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post, put},
};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Semaphore;

pub use current_user::CurrentUser;
use login_limit::LoginLimiter;

use crate::{
    domain::{MAX_PARALLEL_PHOTOS, MAX_UPLOAD_BYTES},
    error::AppError,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    /// One permit per photo being decoded, see `MAX_PARALLEL_PHOTOS`.
    /// `Arc`, because every clone of the state must share the same counter.
    pub photo_slots: Arc<Semaphore>,
    /// Session cookies only over HTTPS – off by default, many home servers
    /// are reached via plain HTTP in the local network.
    pub secure_cookies: bool,
    pub login_limiter: Arc<LoginLimiter>,
}

impl AppState {
    pub fn new(pool: SqlitePool, secure_cookies: bool) -> Self {
        Self {
            pool,
            photo_slots: Arc::new(Semaphore::new(MAX_PARALLEL_PHOTOS)),
            secure_cookies,
            login_limiter: Arc::default(),
        }
    }
}

/// The JSON API lives under `/api`; every other path serves the frontend.
pub fn router(state: AppState) -> Router {
    Router::new()
        .nest("/api", api(state))
        .fallback(frontend::serve)
}

fn api(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route("/about", get(about::about))
        .route("/auth/status", get(auth::status))
        .route("/auth/login", post(auth::login))
        .route("/auth/login/totp", post(auth::login_totp))
        .route("/auth/logout", post(auth::logout))
        .route("/setup", post(setup::setup))
        .route("/account", get(account::get_account))
        .route("/account/password", put(account::change_password))
        .route(
            "/account/totp",
            post(account::start_totp).delete(account::disable_totp),
        )
        .route("/account/totp/confirm", post(account::confirm_totp))
        .route(
            "/account/recovery-codes",
            post(account::renew_recovery_codes),
        )
        .route(
            "/people",
            get(people::list_people).post(people::create_person),
        )
        .route("/people/self", get(people::get_self))
        .route(
            "/people/{person_id}",
            get(people::get_person)
                .put(people::update_person)
                .delete(people::delete_person),
        )
        .route("/people/{person_id}/archived", put(people::set_archived))
        .route(
            "/people/{person_id}/photo",
            put(photos::put_photo)
                .delete(photos::delete_photo)
                .layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES)),
        )
        .route("/people/{person_id}/photo/{size}", get(photos::get_photo))
        .route(
            "/people/{person_id}/groups",
            get(memberships::list_for_person),
        )
        .route(
            "/people/{person_id}/groups/{group_id}",
            put(memberships::add_membership).delete(memberships::remove_membership),
        )
        .route(
            "/people/{person_id}/activities",
            get(activities::list_for_person),
        )
        .route(
            "/people/{person_id}/open-points",
            get(open_points::list_for_person).post(open_points::create_open_point),
        )
        .route(
            "/people/{person_id}/ledger-entries",
            get(ledger::list_for_person).post(ledger::create_entry),
        )
        .route(
            "/people/{person_id}/facts",
            get(facts::list_for_person).post(facts::create_fact),
        )
        .route("/people/{person_id}/facts/order", put(facts::reorder_facts))
        .route("/facts/labels", get(facts::list_labels))
        .route(
            "/facts/{fact_id}",
            put(facts::update_fact).delete(facts::delete_fact),
        )
        .route(
            "/activities",
            get(activities::list_activities).post(activities::create_activity),
        )
        .route(
            "/activities/{activity_id}",
            get(activities::get_activity)
                .put(activities::update_activity)
                .delete(activities::delete_activity),
        )
        .route(
            "/activities/{activity_id}/open-points",
            get(open_points::list_for_activity),
        )
        .route(
            "/activities/{activity_id}/ledger-entries",
            get(ledger::list_for_activity),
        )
        .route(
            "/open-points/{point_id}",
            get(open_points::get_open_point)
                .put(open_points::update_open_point)
                .delete(open_points::delete_open_point),
        )
        .route("/open-points/{point_id}/done", put(open_points::set_done))
        .route("/balances", get(ledger::list_balances))
        .route(
            "/ledger-entries/{entry_id}",
            get(ledger::get_entry)
                .put(ledger::update_entry)
                .delete(ledger::delete_entry),
        )
        .route("/memberships", get(memberships::list_memberships))
        .route(
            "/groups",
            get(groups::list_groups).post(groups::create_group),
        )
        .route(
            "/groups/{group_id}",
            get(groups::get_group)
                .put(groups::update_group)
                .delete(groups::delete_group),
        )
        .route("/groups/{group_id}/archived", put(groups::set_archived))
        .route(
            "/groups/{group_id}/activities",
            get(activities::list_for_group),
        )
        .route("/search", get(search::search))
        // Unknown API paths get a JSON 404 instead of the frontend
        .fallback(|| async { AppError::NotFound })
        .with_state(state)
}
