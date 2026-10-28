use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::SqlitePool;

use super::TestApp;

#[sqlx::test]
async fn create_get_update_delete_entry(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;

    let (status, entry) = app
        .post(
            &format!("/api/people/{lena}/ledger-entries"),
            json!({ "amountCents": -2500, "date": "2026-10-27", "note": " Concert " }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(entry["amountCents"], -2500);
    assert_eq!(entry["date"], "2026-10-27");
    assert_eq!(entry["note"], "Concert");
    assert_eq!(entry["personId"], lena);
    assert_eq!(entry["activityId"], Value::Null);
    let uri = format!("/api/ledger-entries/{}", entry["id"]);

    let (status, fetched) = app.get(&uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched, entry);

    let (status, updated) = app
        .put(
            &uri,
            json!({ "amountCents": 3000, "date": "2026-10-28", "note": "  " }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["amountCents"], 3000);
    assert_eq!(updated["date"], "2026-10-28");
    assert_eq!(updated["note"], Value::Null);
    assert_eq!(updated["personId"], lena);

    assert_eq!(app.delete(&uri).await.0, StatusCode::NO_CONTENT);
    assert_eq!(app.get(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(app.delete(&uri).await.0, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn entries_of_a_person_newest_first(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let uri = format!("/api/people/{lena}/ledger-entries");

    for (amount, date) in [
        (-2500, "2026-10-01"),
        (3000, "2026-10-20"),
        (-1200, "2026-10-05"),
    ] {
        let (status, _) = app
            .post(&uri, json!({ "amountCents": amount, "date": date }))
            .await;
        assert_eq!(status, StatusCode::OK);
    }
    app.post(
        &format!("/api/people/{tom}/ledger-entries"),
        json!({ "amountCents": 999, "date": "2026-10-10" }),
    )
    .await;

    let (status, entries) = app.get(&uri).await;
    assert_eq!(status, StatusCode::OK);
    let amounts: Vec<i64> = entries
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["amountCents"].as_i64().unwrap())
        .collect();
    assert_eq!(amounts, [3000, -1200, -2500]);
}

#[sqlx::test]
async fn balances_of_everyone_with_something_open(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let jo = app.create_person("Jo").await;
    let mia = app.create_person("Mia").await;

    for (person, amount) in [
        (lena, -2500),
        (lena, 1200),
        (tom, 3000),
        (jo, -500),
        (jo, 500),
        (mia, -100),
    ] {
        app.post(
            &format!("/api/people/{person}/ledger-entries"),
            json!({ "amountCents": amount, "date": "2026-10-28" }),
        )
        .await;
    }
    // Archiving doesn't settle anything
    app.put(
        &format!("/api/people/{mia}/archived"),
        json!({ "archived": true }),
    )
    .await;

    let (status, balances) = app.get("/api/balances").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        balances,
        json!([
            { "personId": tom, "balanceCents": 3000 },
            { "personId": lena, "balanceCents": -1300 },
            { "personId": mia, "balanceCents": -100 },
        ])
    );

    assert_eq!(other.get("/api/balances").await.1, json!([]));
}

#[sqlx::test]
async fn invalid_entry_is_400(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/ledger-entries");

    for body in [
        json!({ "amountCents": 0, "date": "2026-10-28" }),
        json!({ "amountCents": 100, "date": "2026-10" }),
        json!({ "amountCents": 100, "date": "2026-02-30" }),
        json!({ "amountCents": 100, "date": "2026-10-28", "activityId": 9999 }),
    ] {
        let (status, _) = app.post(&uri, body.clone()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    }

    let (status, _) = app
        .post(
            "/api/people/9999/ledger-entries",
            json!({ "amountCents": 100, "date": "2026-10-28" }),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test]
async fn no_entries_with_yourself(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let (_, me) = app.get("/api/people/self").await;
    let (status, _) = app
        .post(
            &format!("/api/people/{}/ledger-entries", me["id"]),
            json!({ "amountCents": 100, "date": "2026-10-28" }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/// Unlike open points, the person need not be a participant – and the
/// activity can be changed afterwards.
#[sqlx::test]
async fn entry_from_an_activity(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let tom = app.create_person("Tom").await;
    let bar = app.create_activity("Bar", &[lena]).await;
    let hike = app.create_activity("Hike", &[lena]).await;

    let (_, lenas) = app
        .post(
            &format!("/api/people/{lena}/ledger-entries"),
            json!({ "amountCents": -1500, "date": "2026-10-27", "activityId": bar }),
        )
        .await;
    assert_eq!(lenas["activityId"], bar);
    let (status, toms) = app
        .post(
            &format!("/api/people/{tom}/ledger-entries"),
            json!({ "amountCents": -1500, "date": "2026-10-27", "activityId": bar }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let (status, entries) = app
        .get(&format!("/api/activities/{bar}/ledger-entries"))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(entries.as_array().unwrap().len(), 2);

    let (_, moved) = app
        .put(
            &format!("/api/ledger-entries/{}", toms["id"]),
            json!({ "amountCents": -1500, "date": "2026-10-27", "activityId": hike }),
        )
        .await;
    assert_eq!(moved["activityId"], hike);
    assert_eq!(
        app.get(&format!("/api/activities/{bar}/ledger-entries"))
            .await
            .1,
        json!([lenas])
    );
}

/// The entry outlives its activity, it just loses the link.
#[sqlx::test]
async fn deleting_the_activity_keeps_the_entry(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let bar = app.create_activity("Bar", &[lena]).await;
    let (_, entry) = app
        .post(
            &format!("/api/people/{lena}/ledger-entries"),
            json!({ "amountCents": -1500, "date": "2026-10-27", "activityId": bar }),
        )
        .await;

    assert_eq!(
        app.delete(&format!("/api/activities/{bar}")).await.0,
        StatusCode::NO_CONTENT
    );

    let (status, entry) = app
        .get(&format!("/api/ledger-entries/{}", entry["id"]))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(entry["activityId"], Value::Null);
}

#[sqlx::test]
async fn deleting_the_person_takes_the_entries(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let (_, entry) = app
        .post(
            &format!("/api/people/{lena}/ledger-entries"),
            json!({ "amountCents": 700, "date": "2026-10-28" }),
        )
        .await;

    assert_eq!(
        app.delete(&format!("/api/people/{lena}")).await.0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        app.get(&format!("/api/ledger-entries/{}", entry["id"]))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn entries_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    let bar = app.create_activity("Bar", &[lena]).await;
    let (_, entry) = app
        .post(
            &format!("/api/people/{lena}/ledger-entries"),
            json!({ "amountCents": 700, "date": "2026-10-28" }),
        )
        .await;
    let uri = format!("/api/ledger-entries/{}", entry["id"]);
    let body = json!({ "amountCents": 1, "date": "2026-10-28" });

    assert_eq!(other.get(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(other.put(&uri, body.clone()).await.0, StatusCode::NOT_FOUND);
    assert_eq!(other.delete(&uri).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        other
            .get(&format!("/api/people/{lena}/ledger-entries"))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        other
            .post(&format!("/api/people/{lena}/ledger-entries"), body)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        other
            .get(&format!("/api/activities/{bar}/ledger-entries"))
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    // Nor can they hang an entry on someone else's activity
    let mira_friend = other.create_person("Jo").await;
    let (status, _) = other
        .post(
            &format!("/api/people/{mira_friend}/ledger-entries"),
            json!({ "amountCents": 1, "date": "2026-10-28", "activityId": bar }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    assert_eq!(app.get(&uri).await.1, entry);
}
