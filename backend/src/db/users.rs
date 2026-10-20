use chrono::{DateTime, Utc};
use sqlx::{SqliteConnection, SqlitePool};

pub struct UserSummary {
    pub username: String,
    pub totp_enabled: bool,
    pub created_at: DateTime<Utc>,
}

/// Creates the user together with their own person (`is_self = 1`) – a user
/// without one would be broken, so both go in one transaction.
/// Fails with a unique violation if the username is taken.
pub async fn create(
    pool: &SqlitePool,
    username: &str,
    password_hash: &str,
    name: &str,
) -> sqlx::Result<i64> {
    let mut tx = pool.begin().await?;

    let user_id = sqlx::query_scalar!(
        "INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id",
        username,
        password_hash
    )
    .fetch_one(&mut *tx)
    .await?;
    insert_self_person(&mut tx, user_id, name).await?;

    tx.commit().await?;
    Ok(user_id)
}

/// Like `create`, but only while there is no user at all – the first account
///. `None` if one exists. Check and insert are one statement, so
/// of two setups at the same time only one can win.
pub async fn create_first(
    pool: &SqlitePool,
    username: &str,
    password_hash: &str,
    name: &str,
) -> sqlx::Result<Option<i64>> {
    let mut tx = pool.begin().await?;

    let user_id = sqlx::query_scalar!(
        r#"
        INSERT INTO users (username, password_hash)
        SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)
        RETURNING id AS "id!"
        "#,
        username,
        password_hash
    )
    .fetch_optional(&mut *tx)
    .await?;
    let Some(user_id) = user_id else {
        return Ok(None);
    };
    insert_self_person(&mut tx, user_id, name).await?;

    tx.commit().await?;
    Ok(Some(user_id))
}

async fn insert_self_person(
    tx: &mut SqliteConnection,
    user_id: i64,
    name: &str,
) -> sqlx::Result<()> {
    sqlx::query!(
        "INSERT INTO people (owner_id, name, is_self) VALUES (?, ?, 1)",
        user_id,
        name
    )
    .execute(tx)
    .await?;
    Ok(())
}

/// False only before the very first account (setup).
pub async fn any_exist(pool: &SqlitePool) -> sqlx::Result<bool> {
    sqlx::query_scalar!(r#"SELECT EXISTS (SELECT 1 FROM users) AS "exists!: bool""#)
        .fetch_one(pool)
        .await
}

pub struct AccountRow {
    pub username: String,
    pub password_hash: String,
}

pub async fn get(pool: &SqlitePool, user_id: i64) -> sqlx::Result<AccountRow> {
    sqlx::query_as!(
        AccountRow,
        "SELECT username, password_hash FROM users WHERE id = ?",
        user_id
    )
    .fetch_one(pool)
    .await
}

/// A new password from inside the app: ends all *other* sessions and
/// half-finished logins, the one making the change stays logged in.
pub async fn change_password(
    pool: &SqlitePool,
    user_id: i64,
    password_hash: &str,
    keep_session: &str,
) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        password_hash,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?",
        user_id,
        keep_session
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!("DELETE FROM login_challenges WHERE user_id = ?", user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

pub struct LoginRow {
    pub id: i64,
    pub password_hash: String,
}

pub async fn find_for_login(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<LoginRow>> {
    sqlx::query_as!(
        LoginRow,
        "SELECT id, password_hash FROM users WHERE username = ?",
        username
    )
    .fetch_optional(pool)
    .await
}

pub async fn exists(pool: &SqlitePool, username: &str) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!("SELECT id FROM users WHERE username = ?", username)
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}

pub async fn list(pool: &SqlitePool) -> sqlx::Result<Vec<UserSummary>> {
    sqlx::query_as!(
        UserSummary,
        r#"
        SELECT u.username,
               t.confirmed_at IS NOT NULL AS "totp_enabled!: bool",
               u.created_at AS "created_at: _"
          FROM users u
          LEFT JOIN user_totp t ON t.user_id = u.id
         ORDER BY u.username
        "#
    )
    .fetch_all(pool)
    .await
}

/// Sets a new password and ends all sessions and half-finished logins of the
/// user – whoever knew the old password is logged out everywhere.
/// Fails with `RowNotFound` if the user does not exist.
pub async fn set_password(
    pool: &SqlitePool,
    username: &str,
    password_hash: &str,
) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    let user_id = sqlx::query_scalar!(
        r#"
        UPDATE users
           SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE username = ?
        RETURNING id
        "#,
        password_hash,
        username
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!("DELETE FROM sessions WHERE user_id = ?", user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query!("DELETE FROM login_challenges WHERE user_id = ?", user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

/// Turns off TOTP (see `totp::disable`) by username, for the CLI.
/// Fails with `RowNotFound` if the user does not exist.
pub async fn disable_totp(pool: &SqlitePool, username: &str) -> sqlx::Result<bool> {
    let mut tx = pool.begin().await?;

    let user_id = sqlx::query_scalar!("SELECT id FROM users WHERE username = ?", username)
        .fetch_one(&mut *tx)
        .await?;
    let removed = super::totp::disable(&mut tx, user_id).await?;

    tx.commit().await?;
    Ok(removed)
}
