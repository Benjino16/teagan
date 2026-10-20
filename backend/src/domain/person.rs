use chrono::{DateTime, Days, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

use super::date::has_shape;
use super::photo::PhotoUrls;
use super::trimmed_or_none;

/// Everything the person form can set. `is_self` is deliberately missing:
/// the "me" person is created with the user, never through the API.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
#[validate(schema(function = "validate_person"))]
pub struct PersonInput {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1, max = 100))]
    pub nickname: Option<String>,
    #[validate(custom(function = "validate_birthday"))]
    pub birthday: Option<String>,
    #[validate(length(min = 1, max = 1000))]
    pub birthday_note: Option<String>,
    #[validate(range(min = 1, max = 3650))]
    pub reconnect_days: Option<i64>,
    #[validate(range(min = 1, max = 5))]
    pub impact: i64,
    #[serde(default)]
    pub focus: bool,
    #[serde(default)]
    pub deceased: bool,
    /// Optional even when deceased, but always a full date.
    #[validate(custom(function = "validate_died_on"))]
    pub died_on: Option<String>,
}

impl PersonInput {
    /// Trims text fields and turns empty optional text into `None`.
    /// Without a birthday there is no birthday note, without `deceased` no date of death.
    pub fn normalize(&mut self) {
        self.name = self.name.trim().to_string();
        self.nickname = trimmed_or_none(self.nickname.take());
        self.birthday = trimmed_or_none(self.birthday.take());
        self.birthday_note = trimmed_or_none(self.birthday_note.take());
        self.died_on = trimmed_or_none(self.died_on.take());
        if self.birthday.is_none() {
            self.birthday_note = None;
        }
        if !self.deceased {
            self.died_on = None;
        }
    }
}

/// `YYYY-MM-DD`, `--MM-DD` (year unknown) or `YYYY` (year only), see the DB schema.
fn validate_birthday(value: &str) -> Result<(), ValidationError> {
    let valid = if has_shape(value, "9999-99-99") {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
    } else if has_shape(value, "--99-99") {
        // leap year, so that --02-29 is allowed
        NaiveDate::parse_from_str(&format!("2000{}", &value[1..]), "%Y-%m-%d").is_ok()
    } else {
        has_shape(value, "9999")
    };

    if valid {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

/// `YYYY-MM-DD` only – unlike the birthday, an unknown date of death is just `None`.
fn validate_died_on(value: &str) -> Result<(), ValidationError> {
    if has_shape(value, "9999-99-99") && NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok() {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

/// Rules across fields, mirroring the CHECK constraints on `people`, plus the
/// date of death not lying in the future (a CHECK can't know today).
/// Only runs once every single field is valid.
fn validate_person(person: &PersonInput) -> Result<(), ValidationError> {
    let Some(died_on) = &person.died_on else {
        return Ok(());
    };
    // Tomorrow at the latest: the client's day may already be ahead of UTC.
    let latest = Utc::now().date_naive() + Days::new(1);
    if *died_on > latest.format("%Y-%m-%d").to_string() {
        return Err(error("died_in_future", "died_on: in the future"));
    }
    // Compared as text like the DB does: a year-only birthday against the year of death,
    // a birthday without a year not at all.
    if let Some(birthday) = person.birthday.as_deref().filter(|b| !b.starts_with("--"))
        && died_on[..birthday.len()] < *birthday
    {
        return Err(error("died_before_birth", "died_on: before birthday"));
    }
    Ok(())
}

fn error(code: &'static str, message: &'static str) -> ValidationError {
    ValidationError::new(code).with_message(message.into())
}

/// Archiving a person or bringing them back.
#[derive(Deserialize)]
pub struct PersonArchivedInput {
    pub archived: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonResponse {
    pub id: i64,
    pub name: String,
    pub nickname: Option<String>,
    pub birthday: Option<String>,
    pub birthday_note: Option<String>,
    pub reconnect_days: Option<i64>,
    pub impact: i64,
    pub is_self: bool,
    pub focus: bool,
    /// Stays in lists; reconnect and focus pause, birthdays turn into remembrance.
    pub deceased: bool,
    pub died_on: Option<String>,
    /// `None` = active. Archived people keep focus, rhythm and birthday;
    /// the frontend hides them and pauses their reminders.
    pub archived_at: Option<DateTime<Utc>>,
    /// `None` without a photo – the frontend shows the initials.
    pub photo: Option<PhotoUrls>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A valid input; tests override only the fields they care about.
    fn input() -> PersonInput {
        PersonInput {
            name: "Lena".to_string(),
            nickname: None,
            birthday: None,
            birthday_note: None,
            reconnect_days: None,
            impact: 3,
            focus: false,
            deceased: false,
            died_on: None,
        }
    }

    /// The field names that failed validation, sorted.
    fn invalid_fields(person: &PersonInput) -> Vec<String> {
        let errors = person.validate().expect_err("should be invalid");
        let mut fields: Vec<_> = errors
            .field_errors()
            .into_keys()
            .map(|f| f.to_string())
            .collect();
        fields.sort();
        fields
    }

    // --- validate_birthday ---------------------------------------------------

    #[test]
    fn birthday_accepts_full_date() {
        for value in ["2001-03-12", "1950-12-31", "2000-02-29"] {
            assert!(validate_birthday(value).is_ok(), "should accept {value}");
        }
    }

    #[test]
    fn birthday_accepts_month_and_day_without_year() {
        for value in ["--03-12", "--12-31", "--02-29"] {
            assert!(validate_birthday(value).is_ok(), "should accept {value}");
        }
    }

    #[test]
    fn birthday_accepts_year_only() {
        for value in ["1999", "2026"] {
            assert!(validate_birthday(value).is_ok(), "should accept {value}");
        }
    }

    #[test]
    fn birthday_rejects_dates_that_do_not_exist() {
        for value in [
            "2026-12-00",
            "2001-02-30",
            "2001-02-29", // no leap year
            "2026-13-01",
            "--02-30",
            "--13-01",
            "--00-10",
        ] {
            assert!(validate_birthday(value).is_err(), "should reject {value}");
        }
    }

    /// chrono alone would parse some of these, see `has_shape`.
    #[test]
    fn birthday_rejects_wrong_shape() {
        for value in [
            "",
            "99",
            "20261",
            "2026-1-01",
            "2026-01-1",
            "+200-01-01",
            "-03-12",
            "--3-12",
            "33-12-2026",
            "12.03.2001",
            "2026-03-12T10:00",
            " 2026",
        ] {
            assert!(validate_birthday(value).is_err(), "should reject {value:?}");
        }
    }

    // --- normalize -----------------------------------------------------------

    #[test]
    fn normalize_trims_text() {
        let mut person = PersonInput {
            name: "  Lena \n".to_string(),
            nickname: Some(" Leni ".to_string()),
            birthday: Some(" --03-12 ".to_string()),
            birthday_note: Some("\tBuch ".to_string()),
            ..input()
        };
        person.normalize();

        assert_eq!(person.name, "Lena");
        assert_eq!(person.nickname.as_deref(), Some("Leni"));
        assert_eq!(person.birthday.as_deref(), Some("--03-12"));
        assert_eq!(person.birthday_note.as_deref(), Some("Buch"));
    }

    #[test]
    fn normalize_keeps_inner_whitespace() {
        let mut person = PersonInput {
            name: "Lena  Maria".to_string(),
            birthday: Some("2001-03-12".to_string()),
            birthday_note: Some("Buch\noder Pflanze".to_string()),
            ..input()
        };
        person.normalize();

        assert_eq!(person.name, "Lena  Maria");
        assert_eq!(person.birthday_note.as_deref(), Some("Buch\noder Pflanze"));
    }

    #[test]
    fn normalize_turns_blank_text_into_none() {
        let mut person = PersonInput {
            nickname: Some("   ".to_string()),
            birthday: Some("2001-03-12".to_string()),
            birthday_note: Some("".to_string()),
            ..input()
        };
        person.normalize();

        assert_eq!(person.nickname, None);
        assert_eq!(person.birthday_note, None);
    }

    #[test]
    fn normalize_drops_note_without_birthday() {
        let mut person = PersonInput {
            birthday_note: Some("Buch".to_string()),
            ..input()
        };
        person.normalize();

        assert_eq!(person.birthday_note, None);
    }

    #[test]
    fn normalize_drops_note_when_birthday_is_blank() {
        let mut person = PersonInput {
            birthday: Some("  ".to_string()),
            birthday_note: Some("Buch".to_string()),
            ..input()
        };
        person.normalize();

        assert_eq!(person.birthday, None);
        assert_eq!(person.birthday_note, None);
    }

    #[test]
    fn normalize_leaves_non_text_fields_alone() {
        let mut person = PersonInput {
            reconnect_days: Some(14),
            impact: 5,
            focus: true,
            ..input()
        };
        person.normalize();

        assert_eq!(person.reconnect_days, Some(14));
        assert_eq!(person.impact, 5);
        assert!(person.focus);
    }

    // --- validate ------------------------------------------------------------

    #[test]
    fn minimal_input_is_valid() {
        assert!(input().validate().is_ok());
    }

    #[test]
    fn full_input_is_valid() {
        let person = PersonInput {
            nickname: Some("Leni".to_string()),
            birthday: Some("--02-29".to_string()),
            birthday_note: Some("Buch".to_string()),
            reconnect_days: Some(14),
            impact: 5,
            focus: true,
            ..input()
        };
        assert!(person.validate().is_ok());
    }

    #[test]
    fn name_length_limits() {
        let at_limit = PersonInput {
            name: "a".repeat(100),
            ..input()
        };
        assert!(at_limit.validate().is_ok());

        let too_long = PersonInput {
            name: "a".repeat(101),
            ..input()
        };
        assert_eq!(invalid_fields(&too_long), ["name"]);

        let empty = PersonInput {
            name: String::new(),
            ..input()
        };
        assert_eq!(invalid_fields(&empty), ["name"]);
    }

    /// The length counts characters, not bytes – umlauts must not halve the limit.
    #[test]
    fn name_length_counts_characters() {
        let person = PersonInput {
            name: "ü".repeat(100),
            ..input()
        };
        assert!(person.validate().is_ok());
    }

    #[test]
    fn impact_range() {
        for impact in 1..=5 {
            assert!(
                PersonInput { impact, ..input() }.validate().is_ok(),
                "should accept {impact}"
            );
        }
        for impact in [0, 6, -1] {
            let person = PersonInput { impact, ..input() };
            assert_eq!(
                invalid_fields(&person),
                ["impact"],
                "should reject {impact}"
            );
        }
    }

    #[test]
    fn reconnect_days_range() {
        for days in [1, 3650] {
            let person = PersonInput {
                reconnect_days: Some(days),
                ..input()
            };
            assert!(person.validate().is_ok(), "should accept {days}");
        }
        for days in [0, -7, 3651] {
            let person = PersonInput {
                reconnect_days: Some(days),
                ..input()
            };
            assert_eq!(
                invalid_fields(&person),
                ["reconnect_days"],
                "should reject {days}"
            );
        }
    }

    #[test]
    fn invalid_birthday_is_reported_on_its_field() {
        let person = PersonInput {
            birthday: Some("2001-02-30".to_string()),
            ..input()
        };
        assert_eq!(invalid_fields(&person), ["birthday"]);
    }

    #[test]
    fn birthday_note_length_limit() {
        let person = PersonInput {
            birthday: Some("2001-03-12".to_string()),
            birthday_note: Some("a".repeat(1001)),
            ..input()
        };
        assert_eq!(invalid_fields(&person), ["birthday_note"]);
    }

    #[test]
    fn all_invalid_fields_are_reported_at_once() {
        let person = PersonInput {
            name: String::new(),
            birthday: Some("x".to_string()),
            reconnect_days: Some(0),
            impact: 9,
            ..input()
        };
        assert_eq!(
            invalid_fields(&person),
            ["birthday", "impact", "name", "reconnect_days"]
        );
    }

    #[test]
    fn died_on_accepts_only_full_dates() {
        for value in ["2019-03-03", "2000-02-29"] {
            assert!(validate_died_on(value).is_ok(), "should accept {value}");
        }
        for value in [
            "2019",
            "2019-03",
            "--03-03",
            "2019-02-29",
            "2019-03-03T10:00",
            " 2019-03-03",
        ] {
            assert!(validate_died_on(value).is_err(), "should reject {value:?}");
        }
    }

    fn deceased(birthday: Option<&str>, died_on: &str) -> PersonInput {
        PersonInput {
            birthday: birthday.map(str::to_string),
            deceased: true,
            died_on: Some(died_on.to_string()),
            ..input()
        }
    }

    #[test]
    fn died_on_not_before_birthday() {
        for birthday in [
            None,
            Some("1945-05-01"),
            Some("2019-03-03"),
            Some("1945"),
            Some("2019"),
            Some("--12-31"),
        ] {
            assert!(
                deceased(birthday, "2019-03-03").validate().is_ok(),
                "should accept {birthday:?}"
            );
        }
        for birthday in ["2019-03-04", "2020"] {
            assert!(
                deceased(Some(birthday), "2019-03-03").validate().is_err(),
                "should reject {birthday}"
            );
        }
    }

    #[test]
    fn died_on_not_in_the_future() {
        let next_week = (Utc::now().date_naive() + Days::new(7))
            .format("%Y-%m-%d")
            .to_string();
        assert!(deceased(None, &next_week).validate().is_err());
    }

    #[test]
    fn deceased_without_date_is_valid() {
        assert!(
            PersonInput {
                deceased: true,
                ..input()
            }
            .validate()
            .is_ok()
        );
    }

    #[test]
    fn normalize_drops_date_of_death_when_alive() {
        let mut person = PersonInput {
            died_on: Some("2019-03-03".to_string()),
            ..input()
        };
        person.normalize();
        assert_eq!(person.died_on, None);
    }

    /// The handler always calls `normalize` before `validate`.
    #[test]
    fn blank_name_is_invalid_after_normalize() {
        let mut person = PersonInput {
            name: "   ".to_string(),
            ..input()
        };
        person.normalize();
        assert_eq!(invalid_fields(&person), ["name"]);
    }

    // --- JSON contract with the frontend -------------------------------------

    #[test]
    fn archived_input_requires_the_flag() {
        let input: PersonArchivedInput =
            serde_json::from_value(json!({ "archived": true })).unwrap();
        assert!(input.archived);
        assert!(serde_json::from_value::<PersonArchivedInput>(json!({})).is_err());
    }

    #[test]
    fn input_is_read_from_camel_case() {
        let person: PersonInput = serde_json::from_value(json!({
            "name": "Lena",
            "nickname": "Leni",
            "birthday": "--03-12",
            "birthdayNote": "Buch",
            "reconnectDays": 14,
            "impact": 4,
            "focus": true
        }))
        .unwrap();

        assert_eq!(person.birthday_note.as_deref(), Some("Buch"));
        assert_eq!(person.reconnect_days, Some(14));
        assert!(person.focus);
    }

    #[test]
    fn input_optional_fields_can_be_missing_or_null() {
        let person: PersonInput = serde_json::from_value(json!({
            "name": "Lena",
            "nickname": null,
            "impact": 3
        }))
        .unwrap();

        assert_eq!(person.nickname, None);
        assert_eq!(person.birthday, None);
        assert_eq!(person.reconnect_days, None);
        assert!(!person.focus);
        assert!(!person.deceased);
        assert_eq!(person.died_on, None);
    }

    #[test]
    fn input_requires_name_and_impact() {
        assert!(serde_json::from_value::<PersonInput>(json!({ "impact": 3 })).is_err());
        assert!(serde_json::from_value::<PersonInput>(json!({ "name": "Lena" })).is_err());
    }

    /// `isSelf` must not be settable through the API.
    #[test]
    fn input_ignores_is_self() {
        let result = serde_json::from_value::<PersonInput>(json!({
            "name": "Lena",
            "impact": 3,
            "isSelf": true
        }));
        assert!(result.is_ok());
    }

    #[test]
    fn response_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-15T12:00:00Z")
            .unwrap()
            .to_utc();
        let person = PersonResponse {
            id: 2,
            name: "Lena".to_string(),
            nickname: None,
            birthday: Some("--03-12".to_string()),
            birthday_note: Some("Buch".to_string()),
            reconnect_days: Some(14),
            impact: 4,
            is_self: false,
            focus: true,
            deceased: true,
            died_on: Some("2019-03-03".to_string()),
            archived_at: Some(time),
            photo: Some(PhotoUrls::new(2, "abc")),
            created_at: time,
            updated_at: time,
        };

        assert_eq!(
            serde_json::to_value(&person).unwrap(),
            json!({
                "id": 2,
                "name": "Lena",
                "nickname": null,
                "birthday": "--03-12",
                "birthdayNote": "Buch",
                "reconnectDays": 14,
                "impact": 4,
                "isSelf": false,
                "focus": true,
                "deceased": true,
                "diedOn": "2019-03-03",
                "archivedAt": "2026-10-15T12:00:00Z",
                "photo": {
                    "thumb": "/api/people/2/photo/thumb?v=abc",
                    "large": "/api/people/2/photo/large?v=abc"
                },
                "createdAt": "2026-10-15T12:00:00Z",
                "updatedAt": "2026-10-15T12:00:00Z"
            })
        );
    }
}
