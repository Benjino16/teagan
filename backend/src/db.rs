pub mod activities;
pub mod challenges;
pub mod facts;
pub mod groups;
pub mod memberships;
pub mod open_points;
pub mod people;
pub mod photos;
pub mod sessions;
pub mod totp;
pub mod users;

use std::str::FromStr;

use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};

pub async fn connect(url: &str) -> anyhow::Result<SqlitePool> {
    // sqlx already sets foreign_keys = ON and busy_timeout = 5 s by default
    let options = SqliteConnectOptions::from_str(url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new().connect_with(options).await?;
    Ok(pool)
}

/// `[1,2,3]` – SQLite cannot bind a list, so ids go in as JSON and are
/// unpacked with `json_each(?)`.
fn json_ids(ids: &[i64]) -> String {
    let ids: Vec<String> = ids.iter().map(i64::to_string).collect();
    format!("[{}]", ids.join(","))
}
