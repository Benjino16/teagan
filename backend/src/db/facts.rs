use sqlx::SqlitePool;

use std::collections::HashSet;

use crate::domain::{FactInput, FactResponse};

pub async fn list_for_person(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
) -> sqlx::Result<Vec<FactResponse>> {
    sqlx::query_as!(
        FactResponse,
        r#"
        SELECT id, person_id, label, value, sort,
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM facts
         WHERE owner_id = ? AND person_id = ?
         ORDER BY sort, id
        "#,
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await
}

/// All facts of the user, grouped by person in their list order.
pub async fn list_all(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<FactResponse>> {
    sqlx::query_as!(
        FactResponse,
        r#"
        SELECT id, person_id, label, value, sort,
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM facts
         WHERE owner_id = ?
         ORDER BY person_id, sort, id
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await
}

/// New facts go to the bottom of the person's list.
pub async fn create_fact(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    fact: FactInput,
) -> sqlx::Result<FactResponse> {
    sqlx::query_as!(
        FactResponse,
        r#"
        INSERT INTO
        facts (owner_id, person_id, label, value, sort)
        VALUES (?1, ?2, ?3, ?4,
                (SELECT COALESCE(MAX(sort), -1) + 1 FROM facts WHERE owner_id = ?1 AND person_id = ?2))
        RETURNING id AS "id!", person_id, label, value, sort,
        created_at AS "created_at: _",
        updated_at AS "updated_at: _"
        "#,
        owner_id,
        person_id,
        fact.label,
        fact.value
    )
    .fetch_one(pool)
    .await
}

pub async fn update_fact(
    pool: &SqlitePool,
    owner_id: i64,
    fact_id: i64,
    fact: FactInput,
) -> sqlx::Result<FactResponse> {
    sqlx::query_as!(
        FactResponse,
        r#"
        UPDATE facts
           SET label = ?, value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", person_id, label, value, sort,
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        fact.label,
        fact.value,
        owner_id,
        fact_id
    )
    .fetch_one(pool)
    .await
}

/// Fails with `RowNotFound` if the fact does not exist or belongs to another user.
pub async fn delete_fact(pool: &SqlitePool, owner_id: i64, fact_id: i64) -> sqlx::Result<()> {
    let result = sqlx::query!(
        "DELETE FROM facts WHERE owner_id = ? AND id = ?",
        owner_id,
        fact_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}

/// Every label in use with its number of facts, spelled as stored.
/// Grouping spellings is up to `domain::count_fact_labels`.
pub async fn label_counts(pool: &SqlitePool, owner_id: i64) -> sqlx::Result<Vec<(String, i64)>> {
    let rows = sqlx::query!(
        r#"
        SELECT label, COUNT(*) AS "count!: i64"
          FROM facts
         WHERE owner_id = ?
         GROUP BY label
        "#,
        owner_id
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|row| (row.label, row.count)).collect())
}

/// Whether `fact_ids` are exactly the person's facts, each once – a stale
/// list (a fact added or deleted meanwhile) must not leave gaps in `sort`.
pub async fn is_complete_order(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    fact_ids: &[i64],
) -> sqlx::Result<bool> {
    let current: HashSet<i64> = sqlx::query_scalar!(
        "SELECT id FROM facts WHERE owner_id = ? AND person_id = ?",
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .collect();
    let given: HashSet<i64> = fact_ids.iter().copied().collect();
    Ok(given.len() == fact_ids.len() && given == current)
}

/// Sets `sort` to each fact's position in `fact_ids`.
pub async fn reorder(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    fact_ids: &[i64],
) -> sqlx::Result<Vec<FactResponse>> {
    let mut tx = pool.begin().await?;
    for (sort, fact_id) in fact_ids.iter().enumerate() {
        let sort = sort as i64;
        sqlx::query!(
            r#"
            UPDATE facts
               SET sort = ?, updated_at = CURRENT_TIMESTAMP
             WHERE owner_id = ? AND person_id = ? AND id = ? AND sort IS NOT ?
            "#,
            sort,
            owner_id,
            person_id,
            fact_id,
            sort
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    list_for_person(pool, owner_id, person_id).await
}
