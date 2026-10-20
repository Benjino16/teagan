use sqlx::SqlitePool;

use crate::domain::{NewOpenPointInput, OpenPointInput, OpenPointResponse};

/// All points of a person, done ones included – hiding done points from the
/// next day on is up to the client. Open first, newest first.
pub async fn list_for_person(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
) -> sqlx::Result<Vec<OpenPointResponse>> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        SELECT id, person_id, activity_id AS "activity_id?", text,
               done_at AS "done_at?: _",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM open_points
         WHERE owner_id = ? AND person_id = ?
         ORDER BY done_at IS NOT NULL, created_at DESC, id DESC
        "#,
        owner_id,
        person_id
    )
    .fetch_all(pool)
    .await
}

/// All points that came up at an activity, for every person – the event page
/// is the record of the event. Open first, newest first.
pub async fn list_for_activity(
    pool: &SqlitePool,
    owner_id: i64,
    activity_id: i64,
) -> sqlx::Result<Vec<OpenPointResponse>> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        SELECT id, person_id, activity_id AS "activity_id?", text,
               done_at AS "done_at?: _",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM open_points
         WHERE owner_id = ? AND activity_id = ?
         ORDER BY done_at IS NOT NULL, created_at DESC, id DESC
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
    point_id: i64,
) -> sqlx::Result<OpenPointResponse> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        SELECT id, person_id, activity_id AS "activity_id?", text,
               done_at AS "done_at?: _",
               created_at AS "created_at: _",
               updated_at AS "updated_at: _"
          FROM open_points
         WHERE owner_id = ? AND id = ?
        "#,
        owner_id,
        point_id
    )
    .fetch_one(pool)
    .await
}

pub async fn create(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    point: NewOpenPointInput,
) -> sqlx::Result<OpenPointResponse> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        INSERT INTO
        open_points (owner_id, person_id, activity_id, text)
        VALUES (?, ?, ?, ?)
        RETURNING id AS "id!", person_id, activity_id AS "activity_id?", text,
                  done_at AS "done_at?: _",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        owner_id,
        person_id,
        point.activity_id,
        point.text
    )
    .fetch_one(pool)
    .await
}

/// Changes only the text; person, source and done state stay.
pub async fn update(
    pool: &SqlitePool,
    owner_id: i64,
    point_id: i64,
    point: OpenPointInput,
) -> sqlx::Result<OpenPointResponse> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        UPDATE open_points
           SET text = ?, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", person_id, activity_id AS "activity_id?", text,
                  done_at AS "done_at?: _",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        point.text,
        owner_id,
        point_id
    )
    .fetch_one(pool)
    .await
}

/// Idempotent: checking off a point that is already done keeps its original
/// `done_at`, so it does not reappear on the person page the next day.
pub async fn set_done(
    pool: &SqlitePool,
    owner_id: i64,
    point_id: i64,
    done: bool,
) -> sqlx::Result<OpenPointResponse> {
    sqlx::query_as!(
        OpenPointResponse,
        r#"
        UPDATE open_points
           SET done_at = CASE WHEN ? THEN COALESCE(done_at, CURRENT_TIMESTAMP) END,
               updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ? AND id = ?
        RETURNING id AS "id!", person_id, activity_id AS "activity_id?", text,
                  done_at AS "done_at?: _",
                  created_at AS "created_at: _",
                  updated_at AS "updated_at: _"
        "#,
        done,
        owner_id,
        point_id
    )
    .fetch_one(pool)
    .await
}

/// Fails with `RowNotFound` if the point does not exist or belongs to another user.
pub async fn delete(pool: &SqlitePool, owner_id: i64, point_id: i64) -> sqlx::Result<()> {
    let result = sqlx::query!(
        "DELETE FROM open_points WHERE owner_id = ? AND id = ?",
        owner_id,
        point_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}
