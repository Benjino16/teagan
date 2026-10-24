use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

/// The ids of one resource's hits, in the order the API lists them.
fn ids(result: &Value, resource: &str) -> Vec<i64> {
    result[resource]["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["id"].as_i64().unwrap())
        .collect()
}

fn total(result: &Value, resource: &str) -> i64 {
    result[resource]["total"].as_i64().unwrap()
}

#[sqlx::test]
async fn finds_every_resource(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena Berger").await;
    let tom = app.create_person("Tom").await;
    let hiking = app.create_group("Bergwandern", None).await;
    let trip = app.create_activity("Bergtour", &[lena]).await;
    let (_, fact) = app
        .post(
            &format!("/api/people/{tom}/facts"),
            json!({ "label": "Hobby", "value": "Klettern am Berg" }),
        )
        .await;
    let (_, point) = app
        .post(
            &format!("/api/people/{tom}/open-points"),
            json!({ "text": "Nach dem Berg fragen" }),
        )
        .await;

    let (status, result) = app.get("/api/search?q=berg").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ids(&result, "people"), [lena]);
    assert_eq!(ids(&result, "groups"), [hiking]);
    assert_eq!(ids(&result, "activities"), [trip]);
    assert_eq!(ids(&result, "facts"), [fact["id"].as_i64().unwrap()]);
    assert_eq!(ids(&result, "openPoints"), [point["id"].as_i64().unwrap()]);
    // The usual response types, so the frontend can show them as anywhere else
    assert_eq!(result["facts"]["items"][0]["personId"], tom);
    assert_eq!(
        result["activities"]["items"][0]["participants"][0]["personId"],
        lena
    );
}

#[sqlx::test]
async fn ignores_case_and_accents_but_not_umlauts(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let rene = app.create_person("René").await;
    let juergen = app.create_person("Jürgen").await;

    let result = app.get("/api/search?q=RENE").await.1;
    assert_eq!(ids(&result, "people"), [rene]);
    let result = app.get("/api/search?q=j%C3%BCr").await.1; // "jür"
    assert_eq!(ids(&result, "people"), [juergen]);
    let result = app.get("/api/search?q=jur").await.1;
    assert_eq!(ids(&result, "people"), Vec::<i64>::new());
}

#[sqlx::test]
async fn searches_side_fields_of_activities(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let group = app.create_group("Uni", None).await;
    let body = json!({
        "name": "Coffee",
        "startDate": "2026-10-12",
        "impact": 3,
        "location": "Café Nord",
        "description": "We talked about **Lisbon**",
        "participants": [{ "personId": lena, "note": "Brought her sister" }],
        "groups": [{ "groupId": group, "note": "Whole seminar came" }]
    });
    let (status, activity) = app.post("/api/activities", body).await;
    assert_eq!(status, StatusCode::OK);
    let id = activity["id"].as_i64().unwrap();

    for q in ["nord", "lisbon", "sister", "seminar"] {
        let result = app.get(&format!("/api/search?q={q}")).await.1;
        assert_eq!(ids(&result, "activities"), [id], "{q}");
    }
}

#[sqlx::test]
async fn best_matches_first_archived_last(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let marianne = app.create_person("Marianne").await;
    let anna = app.create_person("Anna").await;
    let old_anke = app.create_person("Anke").await;
    let lisa_ann = app.create_person("Lisa-Ann").await;
    app.put(
        &format!("/api/people/{old_anke}/archived"),
        json!({ "archived": true }),
    )
    .await;

    let result = app.get("/api/search?q=an").await.1;
    assert_eq!(
        ids(&result, "people"),
        [anna, lisa_ann, marianne, old_anke],
        "prefix, word start, inside – archived at the end"
    );
}

#[sqlx::test]
async fn done_points_come_last(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/open-points");
    let done = app.post(&uri, json!({ "text": "Call back" })).await.1["id"]
        .as_i64()
        .unwrap();
    app.put(
        &format!("/api/open-points/{done}/done"),
        json!({ "done": true }),
    )
    .await;
    let open = app
        .post(&uri, json!({ "text": "Callback about the flat" }))
        .await
        .1["id"]
        .as_i64()
        .unwrap();

    let result = app.get("/api/search?q=call").await.1;
    assert_eq!(ids(&result, "openPoints"), [open, done]);
}

#[sqlx::test]
async fn limit_caps_items_but_not_total(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    for name in ["Ana", "Anja", "Anton"] {
        app.create_person(name).await;
    }

    let result = app.get("/api/search?q=an&limit=2").await.1;
    assert_eq!(ids(&result, "people").len(), 2);
    assert_eq!(total(&result, "people"), 3);
}

#[sqlx::test]
async fn short_or_missing_query_finds_nothing(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    app.create_person("Anna").await;

    for uri in ["/api/search?q=a", "/api/search?q=%20%20", "/api/search"] {
        let (status, result) = app.get(uri).await;
        assert_eq!(status, StatusCode::OK, "{uri}");
        assert_eq!(total(&result, "people"), 0, "{uri}");
    }
}

#[sqlx::test]
async fn invalid_limit_is_400(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    for uri in [
        "/api/search?q=an&limit=0",
        "/api/search?q=an&limit=101",
        "/api/search?q=an&limit=many",
    ] {
        let (status, body) = app.get(uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
        assert_eq!(body["code"], "invalid", "{uri}");
    }
}

#[sqlx::test]
async fn other_users_data_is_never_found(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    app.create_group("Lena's friends", None).await;
    app.create_activity("Lena's birthday", &[lena]).await;
    app.post(
        &format!("/api/people/{lena}/facts"),
        json!({ "label": "Lena", "value": "Lena" }),
    )
    .await;
    app.post(
        &format!("/api/people/{lena}/open-points"),
        json!({ "text": "Lena" }),
    )
    .await;

    let (status, result) = other.get("/api/search?q=lena").await;
    assert_eq!(status, StatusCode::OK);
    for resource in ["people", "groups", "activities", "facts", "openPoints"] {
        assert_eq!(total(&result, resource), 0, "{resource}");
    }
}
