use sqlx::SqlitePool;

use crate::domain::{LedgerEntryInput, LedgerEntryResponse};

/// All entries with a person, newest first. Their sum is the balance.
pub async fn list_for_person(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
) -> sqlx::Result<Vec<LedgerEntryResponse>> {
    sqlx::query_as!(
        LedgerEntryResponse,
        r#"
        SELECT id, person_id, amount_cents, date, note AS "note?",
               activity_id AS "activity_id?",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM ledger_entries
         WHERE owner_id = ? AND person_id = ?
         ORDER BY date DESC, id DESC
        "#,
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await
}

/// All entries from an activity, for every person. Newest first.
pub async fn list_for_activity(
    pool: &SqlitePool,
    owner_id: i64,
    activity_id: i64,
) -> sqlx::Result<Vec<LedgerEntryResponse>> {
    sqlx::query_as!(
        LedgerEntryResponse,
        r#"
        SELECT id, person_id, amount_cents, date, note AS "note?",
               activity_id AS "activity_id?",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM ledger_entries
         WHERE owner_id = ? AND activity_id = ?
         ORDER BY date DESC, id DESC
        "#,
        owner_id,
        activity_id
    )
    .fetch_all(pool)
    .await
}

pub async fn get(
    pool: &SqlitePool,
    owner_id: i64,
    entry_id: i64,
) -> sqlx::Result<LedgerEntryResponse> {
    sqlx::query_as!(
        LedgerEntryResponse,
        r#"
        SELECT id, person_id, amount_cents, date, note AS "note?",
               activity_id AS "activity_id?",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM ledger_entries
         WHERE owner_id = ? AND id = ?
        "#,
        owner_id,
        entry_id
    )
    .fetch_one(pool)
    .await
}

pub async fn create(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    entry: LedgerEntryInput,
) -> sqlx::Result<LedgerEntryResponse> {
    sqlx::query_as!(
        LedgerEntryResponse,
        r#"
        INSERT INTO
        ledger_entries (owner_id, person_id, amount_cents, date, note, activity_id)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id AS "id!", person_id, amount_cents, date, note AS "note?",
                  activity_id AS "activity_id?",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        owner_id,
        person_id,
        entry.amount_cents,
        entry.date,
        entry.note,
        entry.activity_id
    )
    .fetch_one(pool)
    .await
}

/// Replaces everything but the person.
pub async fn update(
    pool: &SqlitePool,
    owner_id: i64,
    entry_id: i64,
    entry: LedgerEntryInput,
) -> sqlx::Result<LedgerEntryResponse> {
    sqlx::query_as!(
        LedgerEntryResponse,
        r#"
        UPDATE ledger_entries
           SET amount_cents = ?, date = ?, note = ?, activity_id = ?,
               updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", person_id, amount_cents, date, note AS "note?",
                  activity_id AS "activity_id?",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        entry.amount_cents,
        entry.date,
        entry.note,
        entry.activity_id,
        owner_id,
        entry_id
    )
    .fetch_one(pool)
    .await
}

/// Fails with `RowNotFound` if the entry does not exist or belongs to another user.
pub async fn delete(pool: &SqlitePool, owner_id: i64, entry_id: i64) -> sqlx::Result<()> {
    let result = sqlx::query!(
        "DELETE FROM ledger_entries WHERE owner_id = ? AND id = ?",
        owner_id,
        entry_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}
