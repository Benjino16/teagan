use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

fn participant_ids(activity: &Value) -> Vec<i64> {
    activity["participants"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["personId"].as_i64().unwrap())
        .collect()
}

#[sqlx::test]
async fn create_get_update_delete_activity(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;

    let (status, coffee) = app
        .post(
            "/api/activities",
            json!({
                "name": " Coffee ",
                "startDate": "2026-10-12",
                "location": "  ",
                "impact": 3,
                "participants": [{ "personId": lena, "impact": 5, "note": "Talked about her move" }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(coffee["name"], "Coffee");
    assert_eq!(coffee["icon"], "star", "default icon");
    assert_eq!(coffee["location"], json!(null), "blank text becomes null");
    assert_eq!(coffee["participants"][0]["impact"], 5);
    let uri = format!("/api/activities/{}", coffee["id"]);

    let (status, fetched) = app.get(&uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched, coffee);

    // Participants are replaced as a whole
    let (status, updated) = app
        .put(
            &uri,
            json!({ "name": "Coffee", "startDate": "2026-10-12", "impact": 3, "participants": [{ "personId": tom }] }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(participant_ids(&updated), [tom]);

    let (status, _) = app.delete(&uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(app.get(&uri).await.0, StatusCode::NOT_FOUND);
}

fn group_ids(activity: &Value) -> Vec<i64> {
    activity["groups"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["groupId"].as_i64().unwrap())
        .collect()
}

/// Sorted names of the activities in a list.
fn names(list: &Value) -> Vec<String> {
    let mut names: Vec<_> = list
        .as_array()
        .unwrap()
        .iter()
        .map(|a| a["name"].as_str().unwrap().to_string())
        .collect();
    names.sort();
    names
}

async fn create_group_activity(app: &TestApp, name: &str, people: &[i64], groups: &[i64]) -> i64 {
    let participants: Vec<_> = people.iter().map(|id| json!({ "personId": id })).collect();
    let groups: Vec<_> = groups.iter().map(|id| json!({ "groupId": id })).collect();
    let body = json!({
        "name": name, "startDate": "2026-10-12", "impact": 3,
        "participants": participants, "groups": groups
    });
    let (status, activity) = app.post("/api/activities", body).await;
    assert_eq!(status, StatusCode::OK, "{activity}");
    activity["id"].as_i64().unwrap()
}

#[sqlx::test]
async fn activity_needs_a_person_or_group(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (status, body) = app
        .post(
            "/api/activities",
            json!({ "name": "Alone", "startDate": "2026-10-12", "impact": 3, "participants": [] }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "invalid");
}

#[sqlx::test]
async fn foreign_participants_are_rejected(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;

    for person_id in [lena, 9999] {
        let (status, body) = other
            .post(
                "/api/activities",
                json!({ "name": "Coffee", "startDate": "2026-10-12", "impact": 3, "participants": [{ "personId": person_id }] }),
            )
            .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["message"], "participants: unknown person");
    }
}

#[sqlx::test]
async fn activities_per_person(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    app.create_activity("Coffee", &[lena]).await;
    app.create_activity("Hike", &[lena, tom]).await;
    app.create_activity("Chess", &[tom]).await;

    let (_, all) = app.get("/api/activities").await;
    assert_eq!(all.as_array().unwrap().len(), 3);

    let (status, lenas) = app.get(&format!("/api/people/{lena}/activities")).await;
    assert_eq!(status, StatusCode::OK);
    let mut names: Vec<_> = lenas
        .as_array()
        .unwrap()
        .iter()
        .map(|a| a["name"].as_str().unwrap())
        .collect();
    names.sort();
    assert_eq!(names, ["Coffee", "Hike"]);

    assert_eq!(
        app.get("/api/people/9999/activities").await.0,
        StatusCode::NOT_FOUND
    );
}

/// Deleting a person takes the activities only they were part of;
/// shared ones stay, just without them.
#[sqlx::test]
async fn deleting_a_person_keeps_shared_activities(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let solo = app.create_activity("Coffee", &[lena]).await;
    let shared = app.create_activity("Hike", &[lena, tom]).await;

    let (status, _) = app.delete(&format!("/api/people/{lena}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    assert_eq!(
        app.get(&format!("/api/activities/{solo}")).await.0,
        StatusCode::NOT_FOUND
    );
    let (status, shared) = app.get(&format!("/api/activities/{shared}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(participant_ids(&shared), [tom]);
}

/// A group alone is enough; its impact can be overridden and is replaced
/// with the rest on update.
#[sqlx::test]
async fn group_event_without_people(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let family = app.create_group("Family", None).await;
    let friends = app.create_group("Friends", None).await;

    let (status, gathering) = app
        .post(
            "/api/activities",
            json!({
                "name": "Family gathering",
                "startDate": "2026-12-25",
                "impact": 3,
                "participants": [],
                "groups": [{ "groupId": family, "impact": 5, "note": " Grandma's 90th " }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{gathering}");
    assert_eq!(
        gathering["groups"],
        json!([{ "groupId": family, "impact": 5, "mood": null, "note": "Grandma's 90th" }])
    );
    assert_eq!(gathering["participants"], json!([]));
    let uri = format!("/api/activities/{}", gathering["id"]);

    let (status, updated) = app
        .put(
            &uri,
            json!({
                "name": "Family gathering",
                "startDate": "2026-12-25",
                "impact": 3,
                "participants": [],
                "groups": [{ "groupId": friends }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        updated["groups"],
        json!([{ "groupId": friends, "impact": null, "mood": null, "note": null }])
    );
}

/// Mood is optional on the activity; people and groups can have their own,
/// also when the activity has none.
#[sqlx::test]
async fn mood_on_activity_and_links(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let family = app.create_group("Family", None).await;

    let (status, dinner) = app
        .post(
            "/api/activities",
            json!({
                "name": "Dinner",
                "startDate": "2026-10-12",
                "impact": 3,
                "participants": [{ "personId": lena, "mood": 5 }],
                "groups": [{ "groupId": family, "mood": 2 }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{dinner}");
    assert_eq!(dinner["mood"], json!(null), "no mood unless given");
    assert_eq!(dinner["participants"][0]["mood"], 5);
    assert_eq!(dinner["groups"][0]["mood"], 2);
    let uri = format!("/api/activities/{}", dinner["id"]);

    // Set on the activity, cleared on the links
    let (status, updated) = app
        .put(
            &uri,
            json!({
                "name": "Dinner",
                "startDate": "2026-10-12",
                "impact": 3,
                "mood": 4,
                "participants": [{ "personId": lena }],
                "groups": [{ "groupId": family, "mood": null }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["mood"], 4);
    assert_eq!(updated["participants"][0]["mood"], json!(null));
    assert_eq!(updated["groups"][0]["mood"], json!(null));
    assert_eq!(app.get(&uri).await.1, updated);

    for body in [
        json!({ "name": "Dinner", "startDate": "2026-10-12", "impact": 3, "mood": 0,
                "participants": [{ "personId": lena }] }),
        json!({ "name": "Dinner", "startDate": "2026-10-12", "impact": 3,
                "participants": [{ "personId": lena, "mood": 6 }] }),
    ] {
        let (status, _) = app.put(&uri, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
}

#[sqlx::test]
async fn foreign_groups_are_rejected(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let family = app.create_group("Family", None).await;

    for group_id in [family, 9999] {
        let (status, body) = other
            .post(
                "/api/activities",
                json!({
                    "name": "Gathering", "startDate": "2026-12-25", "impact": 3,
                    "participants": [], "groups": [{ "groupId": group_id }]
                }),
            )
            .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["message"], "groups: unknown group");
    }
}

/// A main group's timeline includes its subgroups; a subgroup's only its own.
#[sqlx::test]
async fn activities_per_group(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uni = app.create_group("University", None).await;
    let freshers = app.create_group("Freshers", Some(uni)).await;
    let family = app.create_group("Family", None).await;
    create_group_activity(&app, "Graduation", &[], &[uni]).await;
    create_group_activity(&app, "Pub crawl", &[lena], &[freshers]).await;
    // Linked twice, still listed once
    create_group_activity(&app, "Reunion", &[], &[uni, freshers]).await;
    create_group_activity(&app, "Christmas", &[], &[family]).await;
    app.create_activity("Coffee", &[lena]).await;

    let (status, list) = app.get(&format!("/api/groups/{uni}/activities")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(names(&list), ["Graduation", "Pub crawl", "Reunion"]);
    // All links come along, not only the one it was found by
    let reunion = list
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["name"] == "Reunion")
        .unwrap();
    assert_eq!(group_ids(reunion), [uni, freshers]);

    let (_, list) = app.get(&format!("/api/groups/{freshers}/activities")).await;
    assert_eq!(names(&list), ["Pub crawl", "Reunion"]);

    assert_eq!(
        app.get("/api/groups/9999/activities").await.0,
        StatusCode::NOT_FOUND
    );
}

/// Deleting a group takes the activities that only belonged to it or its
/// subgroups; activities with people or another group stay.
#[sqlx::test]
async fn deleting_a_group_keeps_shared_activities(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uni = app.create_group("University", None).await;
    let freshers = app.create_group("Freshers", Some(uni)).await;
    let family = app.create_group("Family", None).await;
    let only_uni = create_group_activity(&app, "Graduation", &[], &[uni]).await;
    let only_sub = create_group_activity(&app, "Reunion", &[], &[uni, freshers]).await;
    let with_lena = create_group_activity(&app, "Pub crawl", &[lena], &[freshers]).await;
    let with_family = create_group_activity(&app, "Party", &[], &[uni, family]).await;

    let (status, _) = app.delete(&format!("/api/groups/{uni}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    for gone in [only_uni, only_sub] {
        assert_eq!(
            app.get(&format!("/api/activities/{gone}")).await.0,
            StatusCode::NOT_FOUND
        );
    }
    let (_, pub_crawl) = app.get(&format!("/api/activities/{with_lena}")).await;
    assert_eq!(participant_ids(&pub_crawl), [lena]);
    assert_eq!(group_ids(&pub_crawl), Vec::<i64>::new());
    let (_, party) = app.get(&format!("/api/activities/{with_family}")).await;
    assert_eq!(group_ids(&party), [family]);
}

#[sqlx::test]
async fn deleting_a_person_keeps_group_activities(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let family = app.create_group("Family", None).await;
    let gathering = create_group_activity(&app, "Gathering", &[lena], &[family]).await;

    let (status, _) = app.delete(&format!("/api/people/{lena}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, gathering) = app.get(&format!("/api/activities/{gathering}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(participant_ids(&gathering), Vec::<i64>::new());
}
