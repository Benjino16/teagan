use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

async fn create_fact(app: &TestApp, person_id: i64, label: &str, value: &str) -> i64 {
    let (status, fact) = app
        .post(
            &format!("/api/people/{person_id}/facts"),
            json!({ "label": label, "value": value }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    fact["id"].as_i64().unwrap()
}

/// The ids in the order the API lists them.
fn ids(facts: &Value) -> Vec<i64> {
    facts
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["id"].as_i64().unwrap())
        .collect()
}

#[sqlx::test]
async fn create_list_update_delete_fact(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let list_uri = format!("/api/people/{lena}/facts");

    let (status, job) = app
        .post(
            &list_uri,
            json!({ "label": " Job ", "value": " UX student " }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(job["label"], "Job");
    assert_eq!(job["value"], "UX student");
    assert_eq!(job["personId"], lena);
    let job = job["id"].as_i64().unwrap();
    let pet = create_fact(&app, lena, "Pet", "Cat").await;

    let (status, facts) = app.get(&list_uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ids(&facts), [job, pet], "new facts go to the end");

    let (status, updated) = app
        .put(
            &format!("/api/facts/{pet}"),
            json!({ "label": "Pet", "value": "Two cats" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["value"], "Two cats");

    assert_eq!(
        app.delete(&format!("/api/facts/{pet}")).await.0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(ids(&app.get(&list_uri).await.1), [job]);
    assert_eq!(
        app.delete(&format!("/api/facts/{pet}")).await.0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn invalid_fact_is_400(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let (status, _) = app
        .post(
            &format!("/api/people/{lena}/facts"),
            json!({ "label": "  ", "value": "x" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, _) = app
        .post(
            "/api/people/9999/facts",
            json!({ "label": "Job", "value": "x" }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn reorder_facts(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let a = create_fact(&app, lena, "A", "1").await;
    let b = create_fact(&app, lena, "B", "2").await;
    let c = create_fact(&app, lena, "C", "3").await;
    let toms = create_fact(&app, tom, "D", "4").await;
    let uri = format!("/api/people/{lena}/facts/order");

    let (status, facts) = app.put(&uri, json!({ "factIds": [c, a, b] })).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ids(&facts), [c, a, b]);
    assert_eq!(
        ids(&app.get(&format!("/api/people/{lena}/facts")).await.1),
        [c, a, b]
    );

    // Each of her facts exactly once – nothing missing, doubled or foreign
    for order in [vec![c, a], vec![c, a, b, b], vec![c, a, toms]] {
        let (status, _) = app.put(&uri, json!({ "factIds": order })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{order:?}");
    }
}

#[sqlx::test]
async fn labels_are_counted_across_people(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    create_fact(&app, lena, "Job", "UX").await;
    create_fact(&app, tom, "job", "Baker").await;
    create_fact(&app, tom, "Job", "Also a DJ").await;
    create_fact(&app, tom, "Pet", "Dog").await;

    let (status, labels) = app.get("/api/facts/labels").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        labels,
        json!([{ "label": "Job", "count": 3 }, { "label": "Pet", "count": 1 }])
    );
}

#[sqlx::test]
async fn facts_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    let job = create_fact(&app, lena, "Job", "UX").await;

    assert_eq!(
        other.get(&format!("/api/people/{lena}/facts")).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(other.get("/api/facts/labels").await.1, json!([]));
    let (status, _) = other
        .put(
            &format!("/api/facts/{job}"),
            json!({ "label": "Job", "value": "Hacked" }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(
        other.delete(&format!("/api/facts/{job}")).await.0,
        StatusCode::NOT_FOUND
    );

    assert_eq!(
        app.get(&format!("/api/people/{lena}/facts")).await.1[0]["value"],
        "UX"
    );
}
