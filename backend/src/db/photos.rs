use crate::domain::{PhotoSize, ProcessedPhoto};
use sqlx::SqlitePool;

/// Sets or replaces the person's photo. The person must exist – check first,
/// otherwise a foreign person ends up as a foreign key error.
pub async fn upsert(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    photo: &ProcessedPhoto,
) -> sqlx::Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO person_photos (owner_id, person_id, hash, thumb, large)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (person_id) DO UPDATE
           SET hash = excluded.hash, thumb = excluded.thumb, large = excluded.large,
               updated_at = CURRENT_TIMESTAMP
        "#,
        owner_id,
        person_id,
        photo.hash,
        photo.thumb,
        photo.large
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Removing a photo that does not exist is fine.
pub async fn delete(pool: &SqlitePool, owner_id: i64, person_id: i64) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM person_photos WHERE owner_id = ? AND person_id = ?",
        owner_id,
        person_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// The JPEG of one size. Fails with `RowNotFound` without a photo.
pub async fn get(
    pool: &SqlitePool,
    owner_id: i64,
    person_id: i64,
    size: PhotoSize,
) -> sqlx::Result<Vec<u8>> {
    // A column name cannot be a bind parameter, hence two queries
    match size {
        PhotoSize::Thumb => {
            sqlx::query_scalar!(
                "SELECT thumb FROM person_photos WHERE owner_id = ? AND person_id = ?",
                owner_id,
                person_id
            )
            .fetch_one(pool)
            .await
        }
        PhotoSize::Large => {
            sqlx::query_scalar!(
                "SELECT large FROM person_photos WHERE owner_id = ? AND person_id = ?",
                owner_id,
                person_id
            )
            .fetch_one(pool)
            .await
        }
    }
}
