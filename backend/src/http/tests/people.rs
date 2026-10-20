use axum::http::StatusCode;
use serde_json::json;
use sqlx::SqlitePool;

use super::TestApp;

#[sqlx::test]
async fn setup_creates_the_self_person(pool: SqlitePool) {
    let app = TestApp::new(pool).await;

    let (status, me) = app.get("/api/people/self").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(me["name"], "Ben");
    assert_eq!(me["isSelf"], true);

    let (_, people) = app.get("/api/people").await;
    assert_eq!(people.as_array().unwrap().len(), 1);
}

#[sqlx::test]
async fn create_get_update_person(pool: SqlitePool) {
    let app = TestApp::new(pool).await;

    let (status, mira) = app
        .post(
            "/api/people",
            json!({ "name": "  Mira ", "birthday": "--02-29", "birthdayNote": "Likes books", "impact": 3 }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(mira["name"], "Mira", "name is trimmed");
    assert_eq!(mira["birthday"], "--02-29");
    assert_eq!(mira["isSelf"], false);
    let id = mira["id"].as_i64().unwrap();

    let (status, fetched) = app.get(&format!("/api/people/{id}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched, mira);

    // Without a birthday the note goes too
    let (status, updated) = app
        .put(
            &format!("/api/people/{id}"),
            json!({ "name": "Mira", "birthdayNote": "ignored", "impact": 4 }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["impact"], 4);
    assert_eq!(updated["birthday"], json!(null));
    assert_eq!(updated["birthdayNote"], json!(null));
}

#[sqlx::test]
async fn invalid_person_is_400(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (status, body) = app
        .post(
            "/api/people",
            json!({ "name": "", "birthday": "2001-02-30", "impact": 7 }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "invalid");
}

#[sqlx::test]
async fn self_cannot_be_focus_deceased_archived_or_deleted(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, me) = app.get("/api/people/self").await;
    let uri = format!("/api/people/{}", me["id"]);

    let (status, _) = app
        .put(&uri, json!({ "name": "Ben", "impact": 5, "focus": true }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = app
        .put(
            &uri,
            json!({ "name": "Ben", "impact": 5, "deceased": true }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = app
        .put(&format!("{uri}/archived"), json!({ "archived": true }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = app.delete(&uri).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn archive_and_restore(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, lena) = app
        .post(
            "/api/people",
            json!({ "name": "Lena", "impact": 4, "focus": true }),
        )
        .await;
    let uri = format!("/api/people/{}/archived", lena["id"]);

    let (status, archived) = app.put(&uri, json!({ "archived": true })).await;
    assert_eq!(status, StatusCode::OK);
    assert!(archived["archivedAt"].is_string());
    assert_eq!(archived["focus"], true, "archiving keeps the values");

    let (_, restored) = app.put(&uri, json!({ "archived": false })).await;
    assert_eq!(restored["archivedAt"], json!(null));
}

#[sqlx::test]
async fn date_of_death_not_before_birthday(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, lena) = app
        .post("/api/people", json!({ "name": "Lena", "impact": 4 }))
        .await;
    let uri = format!("/api/people/{}", lena["id"]);

    let (status, _) = app
        .put(&uri, json!({ "name": "Lena", "birthday": "1945-05-01", "impact": 4, "deceased": true, "diedOn": "1944-12-31" }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, lena) = app
        .put(&uri, json!({ "name": "Lena", "birthday": "1945-05-01", "impact": 4, "deceased": true, "diedOn": "2019-03-03" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(lena["deceased"], true);
    assert_eq!(lena["diedOn"], "2019-03-03");
}

#[sqlx::test]
async fn delete_person(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, lena) = app
        .post("/api/people", json!({ "name": "Lena", "impact": 4 }))
        .await;
    let uri = format!("/api/people/{}", lena["id"]);

    let (status, _) = app.delete(&uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = app.get(&uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = app.delete(&uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn people_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let (_, lena) = app
        .post("/api/people", json!({ "name": "Lena", "impact": 4 }))
        .await;
    let uri = format!("/api/people/{}", lena["id"]);

    let (_, people) = other.get("/api/people").await;
    let names: Vec<_> = people
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["name"].clone())
        .collect();
    assert_eq!(names, [json!("Mira")]);

    // Same answer as for an id that doesn't exist – nothing leaks
    assert_eq!(other.get(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        other
            .put(&uri, json!({ "name": "Hacked", "impact": 1 }))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(other.delete(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(app.get(&uri).await.1["name"], "Lena");
}
