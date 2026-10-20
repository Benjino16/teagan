use std::collections::HashSet;

use sqlx::SqlitePool;

use crate::domain::{GroupInput, GroupResponse};
use crate::error::{AppError, AppResult};

pub async fn exists(pool: &SqlitePool, owner_id: i64, group_id: i64) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!(
        "SELECT id FROM groups WHERE owner_id = ? AND id = ?",
        owner_id,
        group_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

pub async fn ensure_exists(pool: &SqlitePool, owner_id: i64, group_id: i64) -> AppResult<()> {
    if exists(pool, owner_id, group_id).await? {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

pub async fn all_exist(pool: &SqlitePool, owner_id: i64, group_ids: &[i64]) -> sqlx::Result<bool> {
    let unique: HashSet<i64> = group_ids.iter().copied().collect();
    let ids = super::json_ids(group_ids);
    let found = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) AS "count!: i64"
          FROM groups
         WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))
        "#,
        owner_id,
        ids
    )
    .fetch_one(pool)
    .await?;
    Ok(found as usize == unique.len())
}

/// Whether other groups have this one as their main group.
pub async fn has_subgroups(pool: &SqlitePool, owner_id: i64, group_id: i64) -> sqlx::Result<bool> {
    let row = sqlx::query_scalar!(
        "SELECT id FROM groups WHERE owner_id = ? AND parent_id = ? LIMIT 1",
        owner_id,
        group_id
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

/// Main groups and subgroups as one flat list; the client builds the tree
/// from `parent_id`.
pub async fn list(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<GroupResponse>> {
    sqlx::query_as!(
        GroupResponse,
        r#"
        SELECT id, name, parent_id AS "parent_id?",
               archived_at AS "archived_at?: _",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM groups
         WHERE owner_id = ?
         ORDER BY name COLLATE NOCASE, id
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await
}

pub async fn get(pool: &SqlitePool, owner_id: i64, group_id: i64) -> sqlx::Result<GroupResponse> {
    sqlx::query_as!(
        GroupResponse,
        r#"
        SELECT id, name, parent_id AS "parent_id?",
               archived_at AS "archived_at?: _",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM groups
         WHERE owner_id = ? AND id = ?
        "#,
        owner_id,
        group_id
    )
    .fetch_one(pool)
    .await
}

pub async fn create(
    pool: &SqlitePool,
    owner_id: i64,
    group: GroupInput,
) -> sqlx::Result<GroupResponse> {
    sqlx::query_as!(
        GroupResponse,
        r#"
        INSERT INTO
        groups (owner_id, name, parent_id)
        VALUES (?, ?, ?)
        RETURNING id AS "id!", name, parent_id AS "parent_id?",
                  archived_at AS "archived_at?: _",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        owner_id,
        group.name,
        group.parent_id
    )
    .fetch_one(pool)
    .await
}

/// Members of a subgroup are always members of its main group,
/// so moving a subgroup adds its members to the new main group. Memberships
/// elsewhere stay. Fails with `RowNotFound` if the group does not exist or
/// belongs to another user.
pub async fn update(
    pool: &SqlitePool,
    owner_id: i64,
    group_id: i64,
    group: GroupInput,
) -> sqlx::Result<GroupResponse> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query!(
        r#"
        UPDATE groups
           SET name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        "#,
        group.name,
        group.parent_id,
        owner_id,
        group_id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    if let Some(parent_id) = group.parent_id {
        sqlx::query!(
            r#"
            INSERT OR IGNORE INTO person_groups (owner_id, person_id, group_id)
            SELECT owner_id, person_id, ?
              FROM person_groups
             WHERE owner_id = ? AND group_id = ?
            "#,
            parent_id,
            owner_id,
            group_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    get(pool, owner_id, group_id).await
}

/// Idempotent: archiving a group that is already archived keeps the original
/// `archived_at`. Subgroups are left alone – they follow their main group in
/// the client. Fails with `RowNotFound` if the group does not exist or
/// belongs to another user.
pub async fn set_archived(
    pool: &SqlitePool,
    owner_id: i64,
    group_id: i64,
    archived: bool,
) -> sqlx::Result<GroupResponse> {
    sqlx::query_as!(
        GroupResponse,
        r#"
        UPDATE groups
           SET archived_at = CASE WHEN ? THEN COALESCE(archived_at, CURRENT_TIMESTAMP) END,
               updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", name, parent_id AS "parent_id?",
                  archived_at AS "archived_at?: _",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        archived,
        owner_id,
        group_id
    )
    .fetch_one(pool)
    .await
}

/// Subgroups, memberships and activity links go with it via
/// `ON DELETE CASCADE`; the people stay. Activities that only belonged to
/// this group or its subgroups – no people, no other group – go too.
/// Fails with `RowNotFound` if the group does not exist or belongs to
/// another user.
pub async fn delete(pool: &SqlitePool, owner_id: i64, group_id: i64) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!(
        r#"
        WITH doomed AS (
          SELECT id FROM groups WHERE owner_id = ? AND (id = ? OR parent_id = ?)
        )
        DELETE FROM activities
         WHERE owner_id = ?
           AND id IN (SELECT activity_id FROM activity_groups
                       WHERE owner_id = ? AND group_id IN (SELECT id FROM doomed))
           AND NOT EXISTS (SELECT 1 FROM activity_people ap WHERE ap.activity_id = activities.id)
           AND NOT EXISTS (SELECT 1 FROM activity_groups ac
                            WHERE ac.activity_id = activities.id
                              AND ac.group_id NOT IN (SELECT id FROM doomed))
        "#,
        owner_id,
        group_id,
        group_id,
        owner_id,
        owner_id
    )
    .execute(&mut *tx)
    .await?;

    let result = sqlx::query!(
        "DELETE FROM groups WHERE owner_id = ? AND id = ?",
        owner_id,
        group_id
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    tx.commit().await?;
    Ok(())
}
