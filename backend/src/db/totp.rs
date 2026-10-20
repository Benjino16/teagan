//! TOTP secret and recovery codes of a user.

use sqlx::{SqliteConnection, SqlitePool};

pub struct TotpRow {
    pub secret: String,
    pub confirmed: bool,
}

pub async fn get(pool: &SqlitePool, user_id: i64) -> sqlx::Result<Option<TotpRow>> {
    sqlx::query_as!(
        TotpRow,
        r#"
        SELECT secret, confirmed_at IS NOT NULL AS "confirmed!: bool"
          FROM user_totp
         WHERE user_id = ?
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
}

/// Starts (or restarts) setting up TOTP with a new secret. `false` if TOTP is
/// already on – it has to be turned off first, so a stolen session can't
/// quietly swap the owner's authenticator.
pub async fn start_setup(pool: &SqlitePool, user_id: i64, secret: &str) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        r#"
        INSERT INTO user_totp (user_id, secret) VALUES (?, ?)
        ON CONFLICT (user_id) DO UPDATE
           SET secret = excluded.secret, created_at = CURRENT_TIMESTAMP
         WHERE confirmed_at IS NULL
        "#,
        user_id,
        secret
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Turns TOTP on after the first correct code, with fresh recovery codes.
/// `false` if there was no setup running.
pub async fn confirm(
    pool: &SqlitePool,
    user_id: i64,
    step: i64,
    code_hashes: &[String],
) -> sqlx::Result<bool> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE user_totp
           SET confirmed_at = CURRENT_TIMESTAMP, last_used_step = ?
         WHERE user_id = ? AND confirmed_at IS NULL
        "#,
        step,
        user_id
    )
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Ok(false);
    }
    replace_codes(&mut tx, user_id, code_hashes).await?;

    tx.commit().await?;
    Ok(true)
}

/// Uses up the step of a correct code. `false` if it – or a later one – was
/// already used: each code works only once (RFC 6238 §5.2). Check and update
/// are one statement, so two logins with the same code can't both pass.
pub async fn use_step(pool: &SqlitePool, user_id: i64, step: i64) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        r#"
        UPDATE user_totp
           SET last_used_step = ?
         WHERE user_id = ? AND confirmed_at IS NOT NULL
           AND (last_used_step IS NULL OR last_used_step < ?)
        "#,
        step,
        user_id,
        step
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Uses up a recovery code; `false` if it doesn't exist or was used before.
pub async fn use_recovery_code(
    pool: &SqlitePool,
    user_id: i64,
    code_hash: &str,
) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        r#"
        UPDATE recovery_codes
           SET used_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
        "#,
        user_id,
        code_hash
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn recovery_codes_left(pool: &SqlitePool, user_id: i64) -> sqlx::Result<i64> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"#,
        user_id
    )
    .fetch_one(pool)
    .await
}

/// New recovery codes; the old ones stop working.
pub async fn set_recovery_codes(
    pool: &SqlitePool,
    user_id: i64,
    code_hashes: &[String],
) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;
    replace_codes(&mut tx, user_id, code_hashes).await?;
    tx.commit().await?;
    Ok(())
}

/// Removes TOTP and the recovery codes, so the password alone logs in again.
/// A login waiting for a code would otherwise wait forever, so those go too.
/// Returns whether TOTP was set up at all.
pub async fn disable(conn: &mut SqliteConnection, user_id: i64) -> sqlx::Result<bool> {
    let removed = sqlx::query!("DELETE FROM user_totp WHERE user_id = ?", user_id)
        .execute(&mut *conn)
        .await?
        .rows_affected();
    sqlx::query!("DELETE FROM recovery_codes WHERE user_id = ?", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM login_challenges WHERE user_id = ?", user_id)
        .execute(&mut *conn)
        .await?;
    Ok(removed > 0)
}

async fn replace_codes(
    conn: &mut SqliteConnection,
    user_id: i64,
    code_hashes: &[String],
) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM recovery_codes WHERE user_id = ?", user_id)
        .execute(&mut *conn)
        .await?;
    for hash in code_hashes {
        sqlx::query!(
            "INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)",
            user_id,
            hash
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}
