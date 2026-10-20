use crate::domain::{PersonInput, PersonResponse, PhotoUrls};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::collections::HashSet;

/// A `people` row plus the photo hash; `query_as!` can only fill flat fields,
/// the photo URLs are built from the hash afterwards.
struct PersonRow {
    id: i64,
    name: String,
    nickname: Option<String>,
    birthday: Option<String>,
    birthday_note: Option<String>,
    reconnect_days: Option<i64>,
    impact: i64,
    is_self: bool,
    focus: bool,
    deceased: bool,
    died_on: Option<String>,
    archived_at: Option<DateTime<Utc>>,
    photo_hash: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<PersonRow> for PersonResponse {
    fn from(row: PersonRow) -> Self {
        Self {
            photo: row.photo_hash.map(|hash| PhotoUrls::new(row.id, &hash)),
            id: row.id,
            name: row.name,
            nickname: row.nickname,
            birthday: row.birthday,
            birthday_note: row.birthday_note,
            reconnect_days: row.reconnect_days,
            impact: row.impact,
            is_self: row.is_self,
            focus: row.focus,
            deceased: row.deceased,
            died_on: row.died_on,
            archived_at: row.archived_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

pub async fn exists(pool: &SqlitePool, owner_id: i64, person_id: i64) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!(
        "SELECT id FROM people WHERE owner_id = ? AND id = ?",
        owner_id,
        person_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

pub async fn ensure_exists(pool: &SqlitePool, owner_id: i64, person_id: i64) -> AppResult<()> {
    if exists(pool, owner_id, person_id).await? {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// Whether every id is a person of this user.
pub async fn all_exist(pool: &SqlitePool, owner_id: i64, person_ids: &[i64]) -> sqlx::Result<bool> {
    let unique: HashSet<i64> = person_ids.iter().copied().collect();
    let ids = super::json_ids(person_ids);
    let found = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!: i64"
          FROM people
         WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))
        "#,
        owner_id,
        ids
    )
    .fetch_one(pool)
    .await?;
    Ok(found as usize == unique.len())
}

pub async fn list(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<PersonResponse>> {
    sqlx::query_as!(
        PersonRow,
        r#"
        SELECT p.id, p.name,
               p.nickname AS "nickname?", p.birthday AS "birthday?",
               p.birthday_note AS "birthday_note?", p.reconnect_days AS "reconnect_days?",
               p.impact,
               p.is_self AS "is_self: bool",
               p.focus AS "focus: bool",
               p.deceased AS "deceased: bool", p.died_on AS "died_on?",
               p.archived_at AS "archived_at?: _",
               ph.hash AS "photo_hash?",
               p.created_at AS "created_at: _",
               p.updated_at AS "updated_at: _"
          FROM people p
          LEFT JOIN person_photos ph ON ph.person_id = p.id
         WHERE p.owner_id = ?
         ORDER BY p.name COLLATE NOCASE, p.id
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await
    .map(|rows| rows.into_iter().map(Into::into).collect())
}

pub async fn get(pool: &SqlitePool, owner_id: i64, person_id: i64) -> sqlx::Result<PersonResponse> {
    sqlx::query_as!(
        PersonRow,
        r#"
        SELECT p.id, p.name,
               p.nickname AS "nickname?", p.birthday AS "birthday?",
               p.birthday_note AS "birthday_note?", p.reconnect_days AS "reconnect_days?",
               p.impact,
               p.is_self AS "is_self: bool",
               p.focus AS "focus: bool",
               p.deceased AS "deceased: bool", p.died_on AS "died_on?",
               p.archived_at AS "archived_at?: _",
               ph.hash AS "photo_hash?",
               p.created_at AS "created_at: _",
               p.updated_at AS "updated_at: _"
          FROM people p
          LEFT JOIN person_photos ph ON ph.person_id = p.id
         WHERE p.owner_id = ? AND p.id = ?
        "#,
        owner_id,
        person_id
    )
    .fetch_one(pool)
    .await
    .map(Into::into)
}

/// The user's own person – exactly one exists (unique index in the schema).
pub async fn get_self(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<PersonResponse> {
    sqlx::query_as!(
        PersonRow,
        r#"
        SELECT p.id, p.name,
               p.nickname AS "nickname?", p.birthday AS "birthday?",
               p.birthday_note AS "birthday_note?", p.reconnect_days AS "reconnect_days?",
               p.impact,
               p.is_self AS "is_self: bool",
               p.focus AS "focus: bool",
               p.deceased AS "deceased: bool", p.died_on AS "died_on?",
               p.archived_at AS "archived_at?: _",
               ph.hash AS "photo_hash?",
               p.created_at AS "created_at: _",
               p.updated_at AS "updated_at: _"
          FROM people p
          LEFT JOIN person_photos ph ON ph.person_id = p.id
         WHERE p.owner_id = ? AND p.is_self = 1
        "#,
        owner_id
    )
    .fetch_one(pool)
    .await
    .map(Into::into)
}

pub async fn create(
    pool: &SqlitePool,
    owner_id: i64,
    person: PersonInput,
) -> sqlx::Result<PersonResponse> {
    sqlx::query_as!(
        PersonRow,
        r#"
        INSERT INTO
        people (owner_id, name, nickname, birthday, birthday_note, reconnect_days, impact, focus,
                deceased, died_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id AS "id!", name,
                  nickname AS "nickname?", birthday AS "birthday?",
                  birthday_note AS "birthday_note?", reconnect_days AS "reconnect_days?",
                  impact,
                  is_self AS "is_self: bool",
                  focus AS "focus: bool",
                  deceased AS "deceased: bool", died_on AS "died_on?",
                  archived_at AS "archived_at?: _",
                  NULL AS "photo_hash?: String",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        owner_id,
        person.name,
        person.nickname,
        person.birthday,
        person.birthday_note,
        person.reconnect_days,
        person.impact,
        person.focus,
        person.deceased,
        person.died_on
    )
    .fetch_one(pool)
    .await
    .map(Into::into)
}

pub async fn update(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    person: PersonInput,
) -> sqlx::Result<PersonResponse> {
    sqlx::query_as!(
        PersonRow,
        r#"
        UPDATE people
           SET name = ?, nickname = ?, birthday = ?, birthday_note = ?,
               reconnect_days = ?, impact = ?, focus = ?, deceased = ?, died_on = ?,
               updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", name,
                  nickname AS "nickname?", birthday AS "birthday?",
                  birthday_note AS "birthday_note?", reconnect_days AS "reconnect_days?",
                  impact,
                  is_self AS "is_self: bool",
                  focus AS "focus: bool",
                  deceased AS "deceased: bool", died_on AS "died_on?",
                  archived_at AS "archived_at?: _",
                  (SELECT hash FROM person_photos WHERE person_id = people.id) AS "photo_hash?: String",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        person.name,
        person.nickname,
        person.birthday,
        person.birthday_note,
        person.reconnect_days,
        person.impact,
        person.focus,
        person.deceased,
        person.died_on,
        owner_id,
        person_id
    )
    .fetch_one(pool)
    .await
    .map(Into::into)
}

/// Idempotent: archiving someone who is already archived keeps the original
/// `archived_at`. Your own person is never touched (CHECK in the schema), so
/// the caller must reject it first.
pub async fn set_archived(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    archived: bool,
) -> sqlx::Result<PersonResponse> {
    sqlx::query_as!(
        PersonRow,
        r#"
        UPDATE people
           SET archived_at = CASE WHEN ? THEN COALESCE(archived_at, CURRENT_TIMESTAMP) END,
               updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", name,
                  nickname AS "nickname?", birthday AS "birthday?",
                  birthday_note AS "birthday_note?", reconnect_days AS "reconnect_days?",
                  impact,
                  is_self AS "is_self: bool",
                  focus AS "focus: bool",
                  deceased AS "deceased: bool", died_on AS "died_on?",
                  archived_at AS "archived_at?: _",
                  (SELECT hash FROM person_photos WHERE person_id = people.id) AS "photo_hash?: String",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        archived,
        owner_id,
        person_id
    )
    .fetch_one(pool)
    .await
    .map(Into::into)
}

/// Facts, photos, memberships etc. go with it via `ON DELETE CASCADE`.
/// Events where nobody else took part (yourself included) and that belong to
/// no group go too – they only belonged to this person. Events with others
/// or a group stay, just without them.
/// Fails with `RowNotFound` if the person does not exist or belongs to another user.
pub async fn delete(pool: &SqlitePool, owner_id: i64, person_id: i64) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        r#"
        DELETE FROM activities
         WHERE owner_id = ?
           AND id IN (SELECT activity_id FROM activity_people
                       WHERE owner_id = ? AND person_id = ?)
           AND NOT EXISTS (SELECT 1 FROM activity_people ap
                            WHERE ap.activity_id = activities.id AND ap.person_id <> ?)
           AND NOT EXISTS (SELECT 1 FROM activity_groups ac WHERE ac.activity_id = activities.id)
        "#,
        owner_id,
        owner_id,
        person_id,
        person_id
    )
    .execute(&mut *tx)
    .await?;

    let result = sqlx::query!(
        "DELETE FROM people WHERE owner_id = ? AND id = ?",
        owner_id,
        person_id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    tx.commit().await?;
    Ok(())
}
