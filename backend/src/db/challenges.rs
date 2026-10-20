//! Logins that passed the password but still need the second factor.
//! Kept apart from `sessions` – a half-finished login is never a session.

use sqlx::SqlitePool;

/// Wrong codes after which the challenge is gone and the password is needed again.
pub const MAX_ATTEMPTS: i64 = 5;

/// Valid for 5 minutes. Also clears out expired challenges.
pub async fn create(pool: &SqlitePool, user_id: i64, token_hash: &str) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM login_challenges WHERE expires_at <= CURRENT_TIMESTAMP")
        .execute(&mut *tx)
        .await?;
    sqlx::query!(
        r#"
        INSERT INTO login_challenges (token_hash, user_id, expires_at)
        VALUES (?, ?, datetime('now', '+5 minutes'))
        "#,
        token_hash,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// The user of a challenge that has not expired.
pub async fn find_user(pool: &SqlitePool, token_hash: &str) -> sqlx::Result<Option<i64>> {
    sqlx::query_scalar!(
        "SELECT user_id FROM login_challenges WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
        token_hash
    )
    .fetch_optional(pool)
    .await
}

/// Counts a wrong code; after `MAX_ATTEMPTS` the challenge is deleted.
pub async fn count_failure(pool: &SqlitePool, token_hash: &str) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        "UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?",
        token_hash
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "DELETE FROM login_challenges WHERE token_hash = ? AND attempts >= ?",
        token_hash,
        MAX_ATTEMPTS
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, token_hash: &str) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM login_challenges WHERE token_hash = ?",
        token_hash
    )
    .execute(pool)
    .await?;
    Ok(())
}
