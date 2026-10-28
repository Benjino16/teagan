use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

use super::date::has_shape;
use super::trimmed_or_none;

/// Upper bound for one entry, either way: 10 million in the display currency.
const MAX_AMOUNT_CENTS: i64 = 1_000_000_000;

/// Creating or editing a ledger entry. The person comes from the path and
/// cannot be changed afterwards; the activity can.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntryInput {
    /// The user's own perspective: negative = I paid, positive = they paid.
    #[validate(custom(function = "validate_amount"))]
    pub amount_cents: i64,
    #[validate(custom(function = "validate_date"))]
    pub date: String,
    #[validate(length(min = 1, max = 1000))]
    pub note: Option<String>,
    pub activity_id: Option<i64>,
}

impl LedgerEntryInput {
    pub fn normalize(&mut self) {
        self.date = self.date.trim().to_string();
        self.note = trimmed_or_none(self.note.take());
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntryResponse {
    pub id: i64,
    pub person_id: i64,
    pub amount_cents: i64,
    pub date: String,
    pub note: Option<String>,
    /// `None` = not from an event, or the event was deleted.
    pub activity_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn validate_amount(value: i64) -> Result<(), ValidationError> {
    // Not `abs()`: it overflows on `i64::MIN`
    if value != 0 && (-MAX_AMOUNT_CENTS..=MAX_AMOUNT_CENTS).contains(&value) {
        Ok(())
    } else {
        Err(ValidationError::new("range"))
    }
}

/// `YYYY-MM-DD` only – a balance needs a day to sort by.
fn validate_date(value: &str) -> Result<(), ValidationError> {
    if has_shape(value, "9999-99-99") && NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn entry(amount_cents: i64, date: &str) -> LedgerEntryInput {
        LedgerEntryInput {
            amount_cents,
            date: date.to_string(),
            note: None,
            activity_id: None,
        }
    }

    // --- normalize -----------------------------------------------------------

    #[test]
    fn normalize_trims_and_drops_blank_note() {
        let mut input = LedgerEntryInput {
            note: Some("  Pizza \n".to_string()),
            date: " 2026-10-28 ".to_string(),
            ..entry(-1200, "")
        };
        input.normalize();
        assert_eq!(input.note.as_deref(), Some("Pizza"));
        assert_eq!(input.date, "2026-10-28");

        let mut input = LedgerEntryInput {
            note: Some("   ".to_string()),
            ..entry(-1200, "2026-10-28")
        };
        input.normalize();
        assert_eq!(input.note, None);
    }

    // --- validate ------------------------------------------------------------

    #[test]
    fn amount_must_be_non_zero_and_bounded() {
        for amount in [1, -1, MAX_AMOUNT_CENTS, -MAX_AMOUNT_CENTS] {
            assert!(entry(amount, "2026-10-28").validate().is_ok(), "{amount}");
        }
        for amount in [0, MAX_AMOUNT_CENTS + 1, -MAX_AMOUNT_CENTS - 1, i64::MIN] {
            assert!(entry(amount, "2026-10-28").validate().is_err(), "{amount}");
        }
    }

    #[test]
    fn date_must_be_a_full_existing_day() {
        assert!(entry(100, "2024-02-29").validate().is_ok());
        for date in [
            "",
            "2026",
            "2026-10",
            "2026-02-30",
            "2026-10-28T12:00",
            "28.10.2026",
        ] {
            assert!(entry(100, date).validate().is_err(), "should reject {date}");
        }
    }

    #[test]
    fn note_length_limits() {
        let note = |n: usize| LedgerEntryInput {
            note: Some("a".repeat(n)),
            ..entry(100, "2026-10-28")
        };
        assert!(note(1000).validate().is_ok());
        assert!(note(1001).validate().is_err());
    }

    // --- JSON contract with the frontend -------------------------------------

    #[test]
    fn input_is_read_from_camel_case() {
        let input: LedgerEntryInput = serde_json::from_value(json!({
            "amountCents": -2500, "date": "2026-10-28", "note": "Concert", "activityId": 7
        }))
        .unwrap();
        assert_eq!(input.amount_cents, -2500);
        assert_eq!(input.activity_id, Some(7));
    }

    #[test]
    fn note_and_activity_are_optional() {
        let input: LedgerEntryInput =
            serde_json::from_value(json!({ "amountCents": 500, "date": "2026-10-28" })).unwrap();
        assert_eq!(input.note, None);
        assert_eq!(input.activity_id, None);
    }

    #[test]
    fn response_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-28T12:00:00Z")
            .unwrap()
            .to_utc();
        let entry = LedgerEntryResponse {
            id: 1,
            person_id: 2,
            amount_cents: -2500,
            date: "2026-10-28".to_string(),
            note: None,
            activity_id: Some(3),
            created_at: time,
            updated_at: time,
        };

        assert_eq!(
            serde_json::to_value(&entry).unwrap(),
            json!({
                "id": 1,
                "personId": 2,
                "amountCents": -2500,
                "date": "2026-10-28",
                "note": null,
                "activityId": 3,
                "createdAt": "2026-10-28T12:00:00Z",
                "updatedAt": "2026-10-28T12:00:00Z"
            })
        );
    }
}
