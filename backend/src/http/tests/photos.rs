use std::io::Cursor;

use axum::http::{Method, StatusCode, header};
use image::{ImageFormat, Rgb, RgbImage};
use serde_json::Value;
use sqlx::SqlitePool;

use super::TestApp;

fn png(width: u32, height: u32) -> Vec<u8> {
    let image = RgbImage::from_fn(width, height, |x, y| Rgb([x as u8, y as u8, 128]));
    let mut out = Cursor::new(Vec::new());
    image.write_to(&mut out, ImageFormat::Png).unwrap();
    out.into_inner()
}

#[sqlx::test]
async fn upload_get_delete_photo(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/photo");

    let (status, _, body) = app.send_bytes(Method::PUT, &uri, png(300, 200)).await;
    assert_eq!(status, StatusCode::OK);
    let person: Value = serde_json::from_slice(&body).unwrap();
    let thumb_url = person["photo"]["thumb"].as_str().unwrap();
    assert!(
        thumb_url.starts_with(&format!("{uri}/thumb?v=")),
        "{thumb_url}"
    );

    for (size, px) in [("thumb", 128), ("large", 256)] {
        let (status, headers, jpeg) = app
            .send_bytes(Method::GET, &format!("{uri}/{size}"), vec![])
            .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(headers[header::CONTENT_TYPE], "image/jpeg");
        let image = image::load_from_memory_with_format(&jpeg, ImageFormat::Jpeg).unwrap();
        assert_eq!(
            (image.width(), image.height()),
            (px, px),
            "cropped to a square"
        );
    }

    assert_eq!(app.delete(&uri).await.0, StatusCode::NO_CONTENT);
    assert_eq!(
        app.get(&format!("/api/people/{lena}")).await.1["photo"],
        Value::Null
    );
    assert_eq!(
        app.send_bytes(Method::GET, &format!("{uri}/thumb"), vec![])
            .await
            .0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn new_photo_gets_a_new_url(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/photo");

    let (_, _, first) = app.send_bytes(Method::PUT, &uri, png(64, 64)).await;
    let (_, _, second) = app.send_bytes(Method::PUT, &uri, png(100, 64)).await;
    let first: Value = serde_json::from_slice(&first).unwrap();
    let second: Value = serde_json::from_slice(&second).unwrap();
    assert_ne!(first["photo"]["large"], second["photo"]["large"]);
}

#[sqlx::test]
async fn bad_uploads_are_rejected(pool: SqlitePool) {
    let app = TestApp::new(pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/photo");

    let (status, _, _) = app
        .send_bytes(Method::PUT, &uri, b"not an image".to_vec())
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // Clients scale down to 512 px themselves
    let (status, _, _) = app.send_bytes(Method::PUT, &uri, png(513, 10)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _, _) = app
        .send_bytes(Method::PUT, &uri, vec![0; 1024 * 1024 + 1])
        .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);

    let (status, _, _) = app
        .send_bytes(Method::PUT, "/api/people/9999/photo", png(64, 64))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _, _) = app
        .send_bytes(Method::GET, &format!("{uri}/huge"), vec![])
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn photos_of_other_users_are_invisible(pool: SqlitePool) {
    let app = TestApp::new(pool.clone()).await;
    let other = app.other_user(&pool).await;
    let lena = app.create_person("Lena").await;
    let uri = format!("/api/people/{lena}/photo");
    app.send_bytes(Method::PUT, &uri, png(64, 64)).await;

    assert_eq!(
        other
            .send_bytes(Method::GET, &format!("{uri}/thumb"), vec![])
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        other.send_bytes(Method::PUT, &uri, png(64, 64)).await.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(other.delete(&uri).await.0, StatusCode::NOT_FOUND);

    assert!(app.get(&format!("/api/people/{lena}")).await.1["photo"].is_object());
}
