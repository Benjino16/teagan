use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Creating an open point. The source activity can only be set here –
/// it cannot be changed afterwards.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct NewOpenPointInput {
    #[validate(length(min = 1, max = 1000))]
    pub text: String,
    pub activity_id: Option<i64>,
}

/// Editing an open point: only the text.
#[derive(Deserialize, Validate)]
pub struct OpenPointInput {
    #[validate(length(min = 1, max = 1000))]
    pub text: String,
}

/// Checking an open point off or back on.
#[derive(Deserialize)]
pub struct OpenPointDoneInput {
    pub done: bool,
}

impl NewOpenPointInput {
    pub fn normalize(&mut self) {
        self.text = self.text.trim().to_string();
    }
}

impl OpenPointInput {
    pub fn normalize(&mut self) {
        self.text = self.text.trim().to_string();
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPointResponse {
    pub id: i64,
    pub person_id: i64,
    /// `None` = noted without an event, or the event was deleted.
    pub activity_id: Option<i64>,
    pub text: String,
    /// `None` = still open.
    pub done_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // --- normalize -----------------------------------------------------------

    #[test]
    fn normalize_trims_text_but_keeps_inner_lines() {
        let mut point = NewOpenPointInput {
            text: "  Ask about\nthe exam \n".to_string(),
            activity_id: None,
        };
        point.normalize();
        assert_eq!(point.text, "Ask about\nthe exam");

        let mut point = OpenPointInput {
            text: "\tCoffee ".to_string(),
        };
        point.normalize();
        assert_eq!(point.text, "Coffee");
    }

    // --- validate ------------------------------------------------------------

    #[test]
    fn text_length_limits() {
        for text in ["a".to_string(), "a".repeat(1000), "ü".repeat(1000)] {
            assert!(OpenPointInput { text }.validate().is_ok());
        }
        for text in [String::new(), "a".repeat(1001)] {
            let len = text.len();
            assert!(
                OpenPointInput { text }.validate().is_err(),
                "should reject length {len}"
            );
        }
    }

    #[test]
    fn new_point_text_length_limits() {
        let valid = NewOpenPointInput {
            text: "Coffee".to_string(),
            activity_id: Some(1),
        };
        assert!(valid.validate().is_ok());

        let empty = NewOpenPointInput {
            text: String::new(),
            activity_id: None,
        };
        assert!(empty.validate().is_err());
    }

    /// The handler always calls `normalize` before `validate`.
    #[test]
    fn blank_text_is_invalid_after_normalize() {
        let mut point = OpenPointInput {
            text: "  \n ".to_string(),
        };
        point.normalize();
        assert!(point.validate().is_err());
    }

    // --- JSON contract with the frontend -------------------------------------

    #[test]
    fn new_point_is_read_from_camel_case() {
        let point: NewOpenPointInput =
            serde_json::from_value(json!({ "text": "Coffee", "activityId": 7 })).unwrap();
        assert_eq!(point.activity_id, Some(7));
    }

    #[test]
    fn new_point_source_is_optional() {
        let point: NewOpenPointInput = serde_json::from_value(json!({ "text": "Coffee" })).unwrap();
        assert_eq!(point.activity_id, None);
    }

    /// The source cannot be changed afterwards – an `activityId` in an edit
    /// is ignored rather than applied.
    #[test]
    fn edit_ignores_activity_id() {
        let point: OpenPointInput =
            serde_json::from_value(json!({ "text": "Coffee", "activityId": 7 })).unwrap();
        assert_eq!(point.text, "Coffee");
    }

    #[test]
    fn done_is_required() {
        assert!(
            serde_json::from_value::<OpenPointDoneInput>(json!({ "done": true }))
                .unwrap()
                .done
        );
        assert!(serde_json::from_value::<OpenPointDoneInput>(json!({})).is_err());
    }

    #[test]
    fn response_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-15T12:00:00Z")
            .unwrap()
            .to_utc();
        let point = OpenPointResponse {
            id: 1,
            person_id: 2,
            activity_id: None,
            text: "Coffee".to_string(),
            done_at: Some(time),
            created_at: time,
            updated_at: time,
        };

        assert_eq!(
            serde_json::to_value(&point).unwrap(),
            json!({
                "id": 1,
                "personId": 2,
                "activityId": null,
                "text": "Coffee",
                "doneAt": "2026-10-15T12:00:00Z",
                "createdAt": "2026-10-15T12:00:00Z",
                "updatedAt": "2026-10-15T12:00:00Z"
            })
        );
    }
}
