use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

#[sqlx::test]
async fn create_get_update_check_delete_point(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;

    let (status, point) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": " Send photos " }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(point["text"], "Send photos");
    assert_eq!(point["personId"], lena);
    assert_eq!(point["activityId"], Value::Null);
    assert_eq!(point["doneAt"], Value::Null);
    let uri = format!("/api/open-points/{}", point["id"]);

    let (status, fetched) = app.get(&uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched, point);

    let (status, updated) = app
        .put(&uri, json!({ "text": "Send the hike photos" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["text"], "Send the hike photos");

    let (status, done) = app
        .put(&format!("{uri}/done"), json!({ "done": true }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(done["doneAt"].is_string());
    let (_, reopened) = app
        .put(&format!("{uri}/done"), json!({ "done": false }))
        .await;
    assert_eq!(reopened["doneAt"], Value::Null);

    assert_eq!(app.delete(&uri).await.0, StatusCode::NO_CONTENT);
    assert_eq!(app.get(&uri).await.0, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn invalid_point_is_400(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let (status, _) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": "   " }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, _) = app
        .post("/api/people/9999/open-points", json!({ "text": "Call" }))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn point_from_an_activity(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let hike = app.create_activity("Hike", &[lena]).await;

    let (status, point) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": "Send photos", "activityId": hike }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(point["activityId"], hike);

    // Tom wasn't on the hike
    let (status, _) = app
        .post(
            &format!("/api/people/{tom}/open-points"),
            json!({ "text": "Send photos", "activityId": hike }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, points) = app
        .get(&format!("/api/activities/{hike}/open-points"))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(points, json!([point]));
    assert_eq!(
        app.get(&format!("/api/people/{lena}/open-points")).await.1,
        json!([point])
    );
}

/// The point outlives its activity, it just loses the link.
#[sqlx::test]
async fn deleting_the_activity_keeps_the_point(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let hike = app.create_activity("Hike", &[lena, tom]).await;
    let (_, point) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": "Send photos", "activityId": hike }),
        )
        .await;

    assert_eq!(
        app.delete(&format!("/api/activities/{hike}")).await.0,
        StatusCode::NO_CONTENT
    );

    let (status, point) = app.get(&format!("/api/open-points/{}", point["id"])).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(point["activityId"], Value::Null);
}

#[sqlx::test]
async fn deleting_the_person_takes_the_points(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let (_, point) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": "Call" }),
        )
        .await;

    assert_eq!(
        app.delete(&format!("/api/people/{lena}")).await.0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        app.get(&format!("/api/open-points/{}", point["id"]))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn points_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    let hike = app.create_activity("Hike", &[lena]).await;
    let (_, point) = app
        .post(
            &format!("/api/people/{lena}/open-points"),
            json!({ "text": "Call" }),
        )
        .await;
    let uri = format!("/api/open-points/{}", point["id"]);

    assert_eq!(other.get(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        other.put(&uri, json!({ "text": "Hacked" })).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        other
            .put(&format!("{uri}/done"), json!({ "done": true }))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(other.delete(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        other
            .get(&format!("/api/people/{lena}/open-points"))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        other
            .get(&format!("/api/activities/{hike}/open-points"))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    // Nor can they hang a point on someone else's activity
    let (_, theirs) = other.get("/api/people/self").await;
    let (status, _) = other
        .post(
            &format!("/api/people/{}/open-points", theirs["id"]),
            json!({ "text": "Call", "activityId": hike }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    assert_eq!(app.get(&uri).await.1, point);
}
