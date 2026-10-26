use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::{SqliteConnection, SqlitePool};

use crate::domain::{
    ActivityGroupInput, ActivityGroupResponse, ActivityInput, ActivityResponse, ParticipantInput,
    ParticipantResponse,
};
use crate::error::{AppError, AppResult};

/// An `activities` row; participants and groups are loaded separately.
struct ActivityRow {
    id: i64,
    name: String,
    icon: String,
    start_date: String,
    end_date: Option<String>,
    description: Option<String>,
    location: Option<String>,
    impact: i64,
    mood: Option<i64>,
    reminder: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

struct ParticipantRow {
    activity_id: i64,
    person_id: i64,
    impact: Option<i64>,
    mood: Option<i64>,
    note: Option<String>,
}

struct GroupRow {
    activity_id: i64,
    group_id: i64,
    impact: Option<i64>,
    mood: Option<i64>,
    note: Option<String>,
}

pub async fn exists(pool: &SqlitePool, owner_id: i64, activity_id: i64) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!(
        "SELECT id FROM activities WHERE owner_id = ? AND id = ?",
        owner_id,
        activity_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

pub async fn ensure_exists(pool: &SqlitePool, owner_id: i64, activity_id: i64) -> AppResult<()> {
    if exists(pool, owner_id, activity_id).await? {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// Whether the person is linked to the activity. `false` as well if the
/// activity does not exist or belongs to another user.
pub async fn has_participant(
    pool: &SqlitePool,
    owner_id: i64,
    activity_id: i64,
    person_id: i64,
) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!(
        r#"
        SELECT person_id
          FROM activity_people
         WHERE owner_id = ? AND activity_id = ? AND person_id = ?
        "#,
        owner_id,
        activity_id,
        person_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

/// Newest first.
pub async fn list(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<ActivityResponse>> {
    let rows = sqlx::query_as!(
        ActivityRow,
        r#"
        SELECT id, name, icon, start_date,
               end_date AS "end_date?", description AS "description?",
               location AS "location?", impact, mood AS "mood?",
               reminder AS "reminder: bool",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM activities
         WHERE owner_id = ?
         ORDER BY start_date DESC, id DESC
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await?;

    with_links(pool, owner_id, rows).await
}

/// All activities the person is linked to, newest first.
pub async fn list_for_person(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
) -> sqlx::Result<Vec<ActivityResponse>> {
    let rows = sqlx::query_as!(
        ActivityRow,
        r#"
        SELECT id, name, icon, start_date,
               end_date AS "end_date?", description AS "description?",
               location AS "location?", impact, mood AS "mood?",
               reminder AS "reminder: bool",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM activities
         WHERE owner_id = ?
           AND id IN (SELECT activity_id FROM activity_people WHERE owner_id = ? AND person_id = ?)
         ORDER BY start_date DESC, id DESC
        "#,
        owner_id,
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await?;

    with_links(pool, owner_id, rows).await
}

/// All activities of the group and its subgroups, newest first.
pub async fn list_for_group(
    pool: &SqlitePool,
    owner_id: i64,
    group_id: i64,
) -> sqlx::Result<Vec<ActivityResponse>> {
    let rows = sqlx::query_as!(
        ActivityRow,
        r#"
        SELECT id, name, icon, start_date,
               end_date AS "end_date?", description AS "description?",
               location AS "location?", impact, mood AS "mood?",
               reminder AS "reminder: bool",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM activities
         WHERE owner_id = ?
           AND id IN (SELECT activity_id
                        FROM activity_groups
                       WHERE owner_id = ?
                         AND group_id IN (SELECT id FROM groups
                                             WHERE owner_id = ? AND (id = ? OR parent_id = ?)))
         ORDER BY start_date DESC, id DESC
        "#,
        owner_id,
        owner_id,
        owner_id,
        group_id,
        group_id
    )
    .fetch_all(pool)
    .await?;

    with_links(pool, owner_id, rows).await
}

pub async fn get(
    pool: &SqlitePool,
    owner_id: i64,
    activity_id: i64,
) -> sqlx::Result<ActivityResponse> {
    let row = sqlx::query_as!(
        ActivityRow,
        r#"
        SELECT id, name, icon, start_date,
               end_date AS "end_date?", description AS "description?",
               location AS "location?", impact, mood AS "mood?",
               reminder AS "reminder: bool",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM activities
         WHERE owner_id = ? AND id = ?
        "#,
        owner_id,
        activity_id
    )
    .fetch_one(pool)
    .await?;

    Ok(with_links(pool, owner_id, vec![row]).await?.remove(0))
}

/// Participants and groups must belong to this user – check that beforehand,
/// otherwise the composite foreign key fails.
pub async fn create(
    pool: &SqlitePool,
    owner_id: i64,
    activity: ActivityInput,
) -> sqlx::Result<ActivityResponse> {
    let mut tx = pool.begin().await?;

    let activity_id = sqlx::query_scalar!(
        r#"
        INSERT INTO
        activities (owner_id, name, icon, start_date, end_date, description, location, impact, mood,
                    reminder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id AS "id!"
        "#,
        owner_id,
        activity.name,
        activity.icon,
        activity.start_date,
        activity.end_date,
        activity.description,
        activity.location,
        activity.impact,
        activity.mood,
        activity.reminder
    )
    .fetch_one(&mut *tx)
    .await?;

    upsert_participants(&mut tx, owner_id, activity_id, &activity.participants).await?;
    upsert_groups(&mut tx, owner_id, activity_id, &activity.groups).await?;
    tx.commit().await?;

    get(pool, owner_id, activity_id).await
}

/// Replaces all fields, participants and groups. Links that stay keep their
/// `created_at`. Fails with `RowNotFound` if the activity does not exist or
/// belongs to another user.
pub async fn update(
    pool: &SqlitePool,
    owner_id: i64,
    activity_id: i64,
    activity: ActivityInput,
) -> sqlx::Result<ActivityResponse> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE activities
           SET name = ?, icon = ?, start_date = ?, end_date = ?, description = ?,
               location = ?, impact = ?, mood = ?, reminder = ?, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        "#,
        activity.name,
        activity.icon,
        activity.start_date,
        activity.end_date,
        activity.description,
        activity.location,
        activity.impact,
        activity.mood,
        activity.reminder,
        owner_id,
        activity_id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    let person_ids = super::json_ids(&activity.person_ids());
    sqlx::query!(
        r#"
        DELETE FROM activity_people
         WHERE owner_id = ? AND activity_id = ?
           AND person_id NOT IN (SELECT value FROM json_each(?))
        "#,
        owner_id,
        activity_id,
        person_ids
    )
    .execute(&mut *tx)
    .await?;

    upsert_participants(&mut tx, owner_id, activity_id, &activity.participants).await?;

    let group_ids = super::json_ids(&activity.group_ids());
    sqlx::query!(
        r#"
        DELETE FROM activity_groups
         WHERE owner_id = ? AND activity_id = ?
           AND group_id NOT IN (SELECT value FROM json_each(?))
        "#,
        owner_id,
        activity_id,
        group_ids
    )
    .execute(&mut *tx)
    .await?;

    upsert_groups(&mut tx, owner_id, activity_id, &activity.groups).await?;
    tx.commit().await?;

    get(pool, owner_id, activity_id).await
}

/// Inserts new links and updates existing ones; `updated_at` only changes
/// when impact, mood or note actually differ.
async fn upsert_participants(
    conn: &mut SqliteConnection,
    owner_id: i64,
    activity_id: i64,
    participants: &[ParticipantInput],
) -> sqlx::Result<()> {
    for participant in participants {
        sqlx::query!(
            r#"
            INSERT INTO activity_people (owner_id, activity_id, person_id, impact, mood, note)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (activity_id, person_id) DO UPDATE
               SET impact = excluded.impact, mood = excluded.mood, note = excluded.note,
                   updated_at = CURRENT_TIMESTAMP
             WHERE impact IS NOT excluded.impact OR mood IS NOT excluded.mood
                OR note IS NOT excluded.note
            "#,
            owner_id,
            activity_id,
            participant.person_id,
            participant.impact,
            participant.mood,
            participant.note
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

/// Like `upsert_participants`: `updated_at` only changes when impact, mood or
/// note actually differ.
async fn upsert_groups(
    conn: &mut SqliteConnection,
    owner_id: i64,
    activity_id: i64,
    groups: &[ActivityGroupInput],
) -> sqlx::Result<()> {
    for group in groups {
        sqlx::query!(
            r#"
            INSERT INTO activity_groups (owner_id, activity_id, group_id, impact, mood, note)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (activity_id, group_id) DO UPDATE
               SET impact = excluded.impact, mood = excluded.mood, note = excluded.note,
                   updated_at = CURRENT_TIMESTAMP
             WHERE impact IS NOT excluded.impact OR mood IS NOT excluded.mood
                OR note IS NOT excluded.note
            "#,
            owner_id,
            activity_id,
            group.group_id,
            group.impact,
            group.mood,
            group.note
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

/// Links are removed via `ON DELETE CASCADE`; open points keep existing
/// without a source (trigger `trg_activities_unlink_points`).
/// Fails with `RowNotFound` if the activity does not exist or belongs to another user.
pub async fn delete(pool: &SqlitePool, owner_id: i64, activity_id: i64) -> sqlx::Result<()> {
    let result = sqlx::query!(
        "DELETE FROM activities WHERE owner_id = ? AND id = ?",
        owner_id,
        activity_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}

/// Loads all participants and groups of these activities – not just the
/// person or group they were listed for.
async fn with_links(
    pool: &SqlitePool,
    owner_id: i64,
    rows: Vec<ActivityRow>,
) -> sqlx::Result<Vec<ActivityResponse>> {
    let ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let ids = super::json_ids(&ids);

    let participants = sqlx::query_as!(
        ParticipantRow,
        r#"
        SELECT activity_id, person_id, impact AS "impact?", mood AS "mood?", note AS "note?"
          FROM activity_people
         WHERE owner_id = ? AND activity_id IN (SELECT value FROM json_each(?))
         ORDER BY activity_id, person_id
        "#,
        owner_id,
        ids
    )
    .fetch_all(pool)
    .await?;

    let groups = sqlx::query_as!(
        GroupRow,
        r#"
        SELECT activity_id, group_id, impact AS "impact?", mood AS "mood?", note AS "note?"
          FROM activity_groups
         WHERE owner_id = ? AND activity_id IN (SELECT value FROM json_each(?))
         ORDER BY activity_id, group_id
        "#,
        owner_id,
        ids
    )
    .fetch_all(pool)
    .await?;

    Ok(assemble(rows, participants, groups))
}

/// Puts each participant and group under its activity, keeping the order of
/// all lists.
fn assemble(
    rows: Vec<ActivityRow>,
    participants: Vec<ParticipantRow>,
    groups: Vec<GroupRow>,
) -> Vec<ActivityResponse> {
    let mut people_of: HashMap<i64, Vec<ParticipantResponse>> = HashMap::new();
    for p in participants {
        people_of
            .entry(p.activity_id)
            .or_default()
            .push(ParticipantResponse {
                person_id: p.person_id,
                impact: p.impact,
                mood: p.mood,
                note: p.note,
            });
    }
    let mut groups_of: HashMap<i64, Vec<ActivityGroupResponse>> = HashMap::new();
    for c in groups {
        groups_of
            .entry(c.activity_id)
            .or_default()
            .push(ActivityGroupResponse {
                group_id: c.group_id,
                impact: c.impact,
                mood: c.mood,
                note: c.note,
            });
    }

    rows.into_iter()
        .map(|row| ActivityResponse {
            participants: people_of.remove(&row.id).unwrap_or_default(),
            groups: groups_of.remove(&row.id).unwrap_or_default(),
            id: row.id,
            name: row.name,
            icon: row.icon,
            start_date: row.start_date,
            end_date: row.end_date,
            description: row.description,
            location: row.location,
            impact: row.impact,
            mood: row.mood,
            reminder: row.reminder,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect()
}
