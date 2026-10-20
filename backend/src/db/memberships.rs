use sqlx::SqlitePool;

use crate::domain::MembershipResponse;

/// Every membership of the user – the group overview counts members and
/// builds avatar stacks from it.
pub async fn list(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<MembershipResponse>> {
    sqlx::query_as!(
        MembershipResponse,
        r#"
        SELECT person_id, group_id,
               created_at AS "created_at: _"
          FROM person_groups
         WHERE owner_id = ?
         ORDER BY group_id, person_id
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await
}

pub async fn list_for_person(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
) -> sqlx::Result<Vec<MembershipResponse>> {
    sqlx::query_as!(
        MembershipResponse,
        r#"
        SELECT person_id, group_id,
               created_at AS "created_at: _"
          FROM person_groups
         WHERE owner_id = ? AND person_id = ?
         ORDER BY group_id
        "#,
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await
}

/// Idempotent. Adding to a subgroup also adds the main group;
/// existing links keep their `created_at`. Person and group must exist.
pub async fn add(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    group_id: i64,
) -> sqlx::Result<MembershipResponse> {
    sqlx::query!(
        r#"
        INSERT OR IGNORE INTO person_groups (owner_id, person_id, group_id)
        SELECT owner_id, ?, id
          FROM groups
         WHERE owner_id = ?
           AND id IN (?, (SELECT parent_id FROM groups WHERE owner_id = ? AND id = ?))
        "#,
        person_id,
        owner_id,
        group_id,
        owner_id,
        group_id
    )
    .execute(pool)
    .await?;

    sqlx::query_as!(
        MembershipResponse,
        r#"
        SELECT person_id, group_id,
               created_at AS "created_at: _"
          FROM person_groups
         WHERE owner_id = ? AND person_id = ? AND group_id = ?
        "#,
        owner_id,
        person_id,
        group_id
    )
    .fetch_one(pool)
    .await
}

/// Idempotent. Removing from a main group also removes the person from its
/// subgroups; removing from a subgroup keeps the main group.
pub async fn remove(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    group_id: i64,
) -> sqlx::Result<()> {
    sqlx::query!(
        r#"
        DELETE FROM person_groups
         WHERE owner_id = ? AND person_id = ?
           AND (group_id = ?
                OR group_id IN (SELECT id FROM groups WHERE owner_id = ? AND parent_id = ?))
        "#,
        owner_id,
        person_id,
        group_id,
        owner_id,
        group_id
    )
    .execute(pool)
    .await?;
    Ok(())
}
