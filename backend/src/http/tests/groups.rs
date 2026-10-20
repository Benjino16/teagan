use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

/// `(person, group)` pairs, sorted.
async fn memberships(app: &TestApp) -> Vec<(i64, i64)> {
    let (_, list) = app.get("/api/memberships").await;
    let mut pairs: Vec<_> = list
        .as_array()
        .unwrap()
        .iter()
        .map(|m| {
            (
                m["personId"].as_i64().unwrap(),
                m["groupId"].as_i64().unwrap(),
            )
        })
        .collect();
    pairs.sort();
    pairs
}

#[sqlx::test]
async fn create_get_update_group(pool: SqlitePool) {
    let app = TestApp::new(pool).await;

    let (status, work) = app.post("/api/groups", json!({ "name": "  Work " })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(work["name"], "Work");
    assert_eq!(work["parentId"], Value::Null);
    let id = work["id"].as_i64().unwrap();
    let team = app.create_group("Team", Some(id)).await;

    let (status, fetched) = app.get(&format!("/api/groups/{team}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched["parentId"], id);

    let (status, renamed) = app
        .put(&format!("/api/groups/{id}"), json!({ "name": "Job" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(renamed["name"], "Job");

    let (_, all) = app.get("/api/groups").await;
    assert_eq!(all.as_array().unwrap().len(), 2);
}

#[sqlx::test]
async fn only_one_level_of_subgroups(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let work = app.create_group("Work", None).await;
    let team = app.create_group("Team", Some(work)).await;
    let family = app.create_group("Family", None).await;

    let cases = [
        // A subgroup of a subgroup
        (
            "/api/groups".to_string(),
            json!({ "name": "Deeper", "parentId": team }),
            "subgroups cannot have subgroups",
        ),
        (
            "/api/groups".to_string(),
            json!({ "name": "Lost", "parentId": 9999 }),
            "unknown group",
        ),
        (
            format!("/api/groups/{work}"),
            json!({ "name": "Work", "parentId": work }),
            "the group itself",
        ),
        // Work has a subgroup, so it must stay a main group
        (
            format!("/api/groups/{work}"),
            json!({ "name": "Work", "parentId": family }),
            "group has subgroups",
        ),
    ];
    for (uri, body, message) in cases {
        let (status, error) = if uri == "/api/groups" {
            app.post(&uri, body).await
        } else {
            app.put(&uri, body).await
        };
        assert_eq!(status, StatusCode::BAD_REQUEST, "{message}");
        assert!(
            error["message"].as_str().unwrap().contains(message),
            "{error}"
        );
    }
}

#[sqlx::test]
async fn archive_and_restore_group(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let work = app.create_group("Work", None).await;
    let uri = format!("/api/groups/{work}/archived");

    let (status, archived) = app.put(&uri, json!({ "archived": true })).await;
    assert_eq!(status, StatusCode::OK);
    assert!(archived["archivedAt"].is_string());

    let (_, restored) = app.put(&uri, json!({ "archived": false })).await;
    assert_eq!(restored["archivedAt"], Value::Null);
}

#[sqlx::test]
async fn deleting_a_group_takes_subgroups_and_memberships(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let work = app.create_group("Work", None).await;
    let team = app.create_group("Team", Some(work)).await;
    app.put(&format!("/api/people/{lena}/groups/{team}"), json!(null))
        .await;

    let (status, _) = app.delete(&format!("/api/groups/{work}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    assert_eq!(
        app.get(&format!("/api/groups/{team}")).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(memberships(&app).await, []);
    assert_eq!(
        app.get(&format!("/api/people/{lena}")).await.0,
        StatusCode::OK
    );
}

#[sqlx::test]
async fn memberships_follow_the_group_tree(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let work = app.create_group("Work", None).await;
    let team = app.create_group("Team", Some(work)).await;
    let team_uri = format!("/api/people/{lena}/groups/{team}");
    let work_uri = format!("/api/people/{lena}/groups/{work}");

    // Joining a subgroup joins its main group too; twice is fine
    let (status, membership) = app.put(&team_uri, json!(null)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(membership["groupId"], team);
    assert_eq!(app.put(&team_uri, json!(null)).await.0, StatusCode::OK);
    assert_eq!(memberships(&app).await, [(lena, work), (lena, team)]);

    let (_, lenas) = app.get(&format!("/api/people/{lena}/groups")).await;
    assert_eq!(lenas.as_array().unwrap().len(), 2);

    // Leaving the subgroup keeps the main group …
    assert_eq!(app.delete(&team_uri).await.0, StatusCode::NO_CONTENT);
    assert_eq!(memberships(&app).await, [(lena, work)]);

    // … leaving the main group leaves its subgroups too
    app.put(&team_uri, json!(null)).await;
    assert_eq!(app.delete(&work_uri).await.0, StatusCode::NO_CONTENT);
    assert_eq!(memberships(&app).await, []);
}

#[sqlx::test]
async fn self_never_joins_a_group(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, me) = app.get("/api/people/self").await;
    let work = app.create_group("Work", None).await;

    let (status, _) = app
        .put(
            &format!("/api/people/{}/groups/{work}", me["id"]),
            json!(null),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn groups_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let work = app.create_group("Work", None).await;
    let uri = format!("/api/groups/{work}");
    let (_, theirs) = other.get("/api/people/self").await;

    assert_eq!(other.get("/api/groups").await.1, json!([]));
    assert_eq!(other.get(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        other.put(&uri, json!({ "name": "Hacked" })).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(other.delete(&uri).await.0, StatusCode::NOT_FOUND);
    // Not as parent of their own group, not for their own people
    let (status, _) = other
        .post("/api/groups", json!({ "name": "Mine", "parentId": work }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = other
        .put(
            &format!("/api/people/{}/groups/{work}", theirs["id"]),
            json!(null),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    assert_eq!(app.get(&uri).await.1["name"], "Work");
}
