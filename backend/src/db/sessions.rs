//! Logged-in sessions. The client holds the token in a cookie,
//! the table only its hash (`domain::hash_token`).

use sqlx::SqlitePool;

/// Starts a session that lasts 30 days. Also clears out expired sessions,
/// so the table does not grow forever.
pub async fn create(pool: &SqlitePool, user_id: i64, token_hash: &str) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
        .execute(&mut *tx)
        .await?;
    sqlx::query!(
        r#"
        INSERT INTO sessions (token_hash, user_id, expires_at)
        VALUES (?, ?, datetime('now', '+30 days'))
        "#,
        token_hash,
        user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// The user of a valid session, `None` if it does not exist or has expired.
/// Once less than half of the 30 days is left, the session is extended to
/// 30 days again – checked first, so most requests only read.
pub async fn find_user(pool: &SqlitePool, token_hash: &str) -> sqlx::Result<Option<i64>> {
    let session = sqlx::query!(
        r#"
        SELECT user_id,
               expires_at < datetime('now', '+15 days') AS "renew!: bool"
          FROM sessions
         WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP
        "#,
        token_hash
    )
    .fetch_optional(pool)
    .await?;

    let Some(session) = session else {
        return Ok(None);
    };
    if session.renew {
        sqlx::query!(
            "UPDATE sessions SET expires_at = datetime('now', '+30 days') WHERE token_hash = ?",
            token_hash
        )
        .execute(pool)
        .await?;
    }
    Ok(Some(session.user_id))
}

pub async fn delete(pool: &SqlitePool, token_hash: &str) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM sessions WHERE token_hash = ?", token_hash)
        .execute(pool)
        .await?;
    Ok(())
}
