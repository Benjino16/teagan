use std::collections::HashSet;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

use super::date::{is_partial_date, is_partial_date_time};
use super::trimmed_or_none;

/// Everything the event form can set, participants and groups included –
/// an activity is always saved together with the people and groups linked
/// to it. It needs at least one of them.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
#[validate(schema(function = "validate_activity"))]
pub struct ActivityInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[serde(default = "default_icon")]
    #[validate(custom(function = "validate_icon"))]
    pub icon: String,
    #[validate(custom(function = "validate_start_date"))]
    pub start_date: String,
    #[validate(custom(function = "validate_end_date"))]
    pub end_date: Option<String>,
    #[validate(length(min = 1, max = 10000))]
    pub description: Option<String>,
    /// Free text, e.g. `Café Fritz`.
    #[validate(length(min = 1, max = 200))]
    pub location: Option<String>,
    #[validate(range(min = 1, max = 5))]
    pub impact: i64,
    #[serde(default)]
    pub reminder: bool,
    #[validate(nested)]
    pub participants: Vec<ParticipantInput>,
    #[serde(default)]
    #[validate(nested)]
    pub groups: Vec<ActivityGroupInput>,
}

/// A person linked to an activity, with an optional impact and note for
/// this person only.
/// `Serialize` only because the `length` rule on the list requires it.
#[derive(Deserialize, Serialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantInput {
    pub person_id: i64,
    /// `None` = the activity's impact applies.
    #[validate(range(min = 1, max = 5))]
    pub impact: Option<i64>,
    #[validate(length(min = 1, max = 1000))]
    pub note: Option<String>,
}

/// A group the activity belongs to, with an optional impact and note for
/// this group only.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ActivityGroupInput {
    pub group_id: i64,
    /// `None` = the activity's impact applies.
    #[validate(range(min = 1, max = 5))]
    pub impact: Option<i64>,
    #[validate(length(min = 1, max = 1000))]
    pub note: Option<String>,
}

impl ActivityInput {
    /// Trims text fields and turns empty optional text into `None`.
    pub fn normalize(&mut self) {
        self.name = self.name.trim().to_string();
        self.icon = self.icon.trim().to_string();
        self.start_date = self.start_date.trim().to_string();
        self.end_date = trimmed_or_none(self.end_date.take());
        self.description = trimmed_or_none(self.description.take());
        self.location = trimmed_or_none(self.location.take());
        for participant in &mut self.participants {
            participant.note = trimmed_or_none(participant.note.take());
        }
        for group in &mut self.groups {
            group.note = trimmed_or_none(group.note.take());
        }
    }

    pub fn person_ids(&self) -> Vec<i64> {
        self.participants.iter().map(|p| p.person_id).collect()
    }

    pub fn group_ids(&self) -> Vec<i64> {
        self.groups.iter().map(|c| c.group_id).collect()
    }
}

fn default_icon() -> String {
    "star".to_string()
}

/// A key into the frontend's icon catalog, e.g. `map-pin`. Unknown keys are
/// fine (the frontend falls back to `star`), so only the shape is checked.
fn validate_icon(value: &str) -> Result<(), ValidationError> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if valid {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

fn validate_start_date(value: &str) -> Result<(), ValidationError> {
    if is_partial_date_time(value) {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

fn validate_end_date(value: &str) -> Result<(), ValidationError> {
    if is_partial_date(value) {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

/// Rules across fields, mirroring the CHECK constraints on `activities`.
/// Only runs once every single field is valid.
fn validate_activity(activity: &ActivityInput) -> Result<(), ValidationError> {
    if let Some(end_date) = &activity.end_date {
        if activity.start_date.len() > 10 {
            return Err(error(
                "time_on_range",
                "start_date: a range cannot have a time",
            ));
        }
        // Compared as text like the DB does: `2026-05` < `2026-05-10`
        if *end_date < activity.start_date {
            return Err(error("end_before_start", "end_date: before start_date"));
        }
    }
    if activity.reminder && activity.start_date.len() < 10 {
        return Err(error(
            "reminder_needs_day",
            "reminder: needs a full start_date",
        ));
    }
    if activity.participants.is_empty() && activity.groups.is_empty() {
        return Err(error(
            "no_link",
            "participants: needs at least one person or group",
        ));
    }
    let mut seen = HashSet::new();
    if !activity
        .participants
        .iter()
        .all(|p| seen.insert(p.person_id))
    {
        return Err(error(
            "duplicate_participant",
            "participants: person listed twice",
        ));
    }
    let mut seen = HashSet::new();
    if !activity.groups.iter().all(|c| seen.insert(c.group_id)) {
        return Err(error("duplicate_group", "groups: group listed twice"));
    }
    Ok(())
}

fn error(code: &'static str, message: &'static str) -> ValidationError {
    ValidationError::new(code).with_message(message.into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityResponse {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub impact: i64,
    pub reminder: bool,
    pub participants: Vec<ParticipantResponse>,
    pub groups: Vec<ActivityGroupResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantResponse {
    pub person_id: i64,
    pub impact: Option<i64>,
    pub note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityGroupResponse {
    pub group_id: i64,
    pub impact: Option<i64>,
    pub note: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use validator::ValidationErrorsKind;

    /// A valid point event with one participant; tests override only the
    /// fields they care about.
    fn input() -> ActivityInput {
        ActivityInput {
            name: "Coffee".to_string(),
            icon: "star".to_string(),
            start_date: "2026-10-13".to_string(),
            end_date: None,
            description: None,
            location: None,
            impact: 2,
            reminder: false,
            participants: vec![participant(2)],
            groups: vec![],
        }
    }

    fn participant(person_id: i64) -> ParticipantInput {
        ParticipantInput {
            person_id,
            impact: None,
            note: None,
        }
    }

    fn group(group_id: i64) -> ActivityGroupInput {
        ActivityGroupInput {
            group_id,
            impact: None,
            note: None,
        }
    }

    /// The field names that failed validation (top level only), sorted.
    fn invalid_fields(activity: &ActivityInput) -> Vec<String> {
        let errors = activity.validate().expect_err("should be invalid");
        let mut fields: Vec<_> = errors.errors().keys().map(|f| f.to_string()).collect();
        fields.sort();
        fields
    }

    /// The code of the struct-level rule that failed.
    fn failed_rule(activity: &ActivityInput) -> String {
        let errors = activity.validate().expect_err("should be invalid");
        let rule_errors = errors
            .field_errors()
            .remove("__all__")
            .expect("no struct-level error");
        rule_errors[0].code.to_string()
    }

    // --- validate_icon -------------------------------------------------------

    #[test]
    fn icon_accepts_catalog_keys() {
        for value in ["star", "map-pin", "heart", "dice-6"] {
            assert!(validate_icon(value).is_ok(), "should accept {value}");
        }
    }

    #[test]
    fn icon_rejects_other_shapes() {
        for value in ["", "Map", "map pin", "map_pin", "🙂", "ü", &"a".repeat(65)] {
            assert!(validate_icon(value).is_err(), "should reject {value:?}");
        }
    }

    // --- normalize -----------------------------------------------------------

    #[test]
    fn normalize_trims_text() {
        let mut activity = ActivityInput {
            name: " Coffee \n".to_string(),
            icon: " map-pin ".to_string(),
            start_date: " 2026-10-13 ".to_string(),
            end_date: Some(" 2026-10-14 ".to_string()),
            description: Some("  **Nice**  ".to_string()),
            location: Some(" Café Fritz ".to_string()),
            participants: vec![ParticipantInput {
                note: Some(" Job ".to_string()),
                ..participant(2)
            }],
            groups: vec![ActivityGroupInput {
                note: Some(" Hosted it ".to_string()),
                ..group(4)
            }],
            ..input()
        };
        activity.normalize();

        assert_eq!(activity.name, "Coffee");
        assert_eq!(activity.icon, "map-pin");
        assert_eq!(activity.start_date, "2026-10-13");
        assert_eq!(activity.end_date.as_deref(), Some("2026-10-14"));
        assert_eq!(activity.description.as_deref(), Some("**Nice**"));
        assert_eq!(activity.location.as_deref(), Some("Café Fritz"));
        assert_eq!(activity.participants[0].note.as_deref(), Some("Job"));
        assert_eq!(activity.groups[0].note.as_deref(), Some("Hosted it"));
    }

    #[test]
    fn normalize_turns_blank_text_into_none() {
        let mut activity = ActivityInput {
            end_date: Some(" ".to_string()),
            description: Some("\n".to_string()),
            location: Some("\t".to_string()),
            participants: vec![ParticipantInput {
                note: Some("  ".to_string()),
                ..participant(2)
            }],
            groups: vec![ActivityGroupInput {
                note: Some("\n".to_string()),
                ..group(4)
            }],
            ..input()
        };
        activity.normalize();

        assert_eq!(activity.end_date, None);
        assert_eq!(activity.description, None);
        assert_eq!(activity.location, None);
        assert_eq!(activity.participants[0].note, None);
        assert_eq!(activity.groups[0].note, None);
    }

    #[test]
    fn person_ids_keeps_order() {
        let activity = ActivityInput {
            participants: vec![participant(3), participant(1), participant(2)],
            ..input()
        };
        assert_eq!(activity.person_ids(), [3, 1, 2]);
    }

    // --- validate: single fields ---------------------------------------------

    #[test]
    fn minimal_input_is_valid() {
        assert!(input().validate().is_ok());
    }

    #[test]
    fn full_input_is_valid() {
        let activity = ActivityInput {
            icon: "train-front".to_string(),
            start_date: "2026-07-01".to_string(),
            end_date: Some("2026-08".to_string()),
            description: Some("Interrail".to_string()),
            location: Some("Europe".to_string()),
            impact: 5,
            reminder: true,
            participants: vec![
                participant(1),
                ParticipantInput {
                    impact: Some(4),
                    note: Some("Plan".to_string()),
                    ..participant(2)
                },
            ],
            ..input()
        };
        assert!(activity.validate().is_ok());
    }

    #[test]
    fn start_date_accepts_all_precisions_and_time() {
        for start_date in ["2026", "2026-10", "2026-10-13", "2026-10-13T20:00"] {
            let activity = ActivityInput {
                start_date: start_date.to_string(),
                ..input()
            };
            assert!(activity.validate().is_ok(), "should accept {start_date}");
        }
    }

    #[test]
    fn invalid_dates_are_reported_on_their_field() {
        let activity = ActivityInput {
            start_date: "2026-13".to_string(),
            end_date: Some("2026-12-01T10:00".to_string()), // end never has a time
            ..input()
        };
        assert_eq!(invalid_fields(&activity), ["end_date", "start_date"]);
    }

    #[test]
    fn name_length_limits() {
        assert!(
            ActivityInput {
                name: "a".repeat(200),
                ..input()
            }
            .validate()
            .is_ok()
        );
        assert_eq!(
            invalid_fields(&ActivityInput {
                name: "a".repeat(201),
                ..input()
            }),
            ["name"]
        );
        assert_eq!(
            invalid_fields(&ActivityInput {
                name: String::new(),
                ..input()
            }),
            ["name"]
        );
    }

    #[test]
    fn location_length_limits() {
        assert!(
            ActivityInput {
                location: Some("a".repeat(200)),
                ..input()
            }
            .validate()
            .is_ok()
        );
        assert_eq!(
            invalid_fields(&ActivityInput {
                location: Some("a".repeat(201)),
                ..input()
            }),
            ["location"]
        );
    }

    #[test]
    fn impact_range() {
        for impact in 1..=5 {
            assert!(
                ActivityInput { impact, ..input() }.validate().is_ok(),
                "should accept {impact}"
            );
        }
        for impact in [0, 6] {
            assert_eq!(
                invalid_fields(&ActivityInput { impact, ..input() }),
                ["impact"],
                "should reject {impact}"
            );
        }
    }

    #[test]
    fn needs_at_least_one_person_or_group() {
        let activity = ActivityInput {
            participants: vec![],
            ..input()
        };
        assert_eq!(failed_rule(&activity), "no_link");
    }

    #[test]
    fn a_group_is_enough() {
        let activity = ActivityInput {
            participants: vec![],
            groups: vec![group(4)],
            ..input()
        };
        assert!(activity.validate().is_ok());
    }

    #[test]
    fn invalid_group_link_is_reported() {
        let activity = ActivityInput {
            groups: vec![ActivityGroupInput {
                impact: Some(6),
                note: Some("a".repeat(1001)),
                ..group(4)
            }],
            ..input()
        };
        assert_eq!(invalid_fields(&activity), ["groups"]);
    }

    #[test]
    fn invalid_participant_is_reported_with_its_index() {
        let activity = ActivityInput {
            participants: vec![
                participant(1),
                ParticipantInput {
                    impact: Some(0),
                    note: Some("a".repeat(1001)),
                    ..participant(2)
                },
            ],
            ..input()
        };
        let errors = activity.validate().expect_err("should be invalid");
        let ValidationErrorsKind::List(items) = &errors.errors()["participants"] else {
            panic!("expected a list error");
        };
        let mut fields: Vec<_> = items[&1].field_errors().into_keys().collect();
        fields.sort();
        assert_eq!(items.keys().collect::<Vec<_>>(), [&1]);
        assert_eq!(fields, ["impact", "note"]);
    }

    // --- validate: rules across fields ---------------------------------------

    #[test]
    fn range_can_end_on_its_start_day() {
        let activity = ActivityInput {
            end_date: Some("2026-10-13".to_string()),
            ..input()
        };
        assert!(activity.validate().is_ok());
    }

    #[test]
    fn range_cannot_end_before_it_starts() {
        let activity = ActivityInput {
            end_date: Some("2026-10-12".to_string()),
            ..input()
        };
        assert_eq!(failed_rule(&activity), "end_before_start");
    }

    /// Text comparison like the DB CHECK: an end of lower precision inside the
    /// start's period counts as before it.
    #[test]
    fn range_end_is_compared_as_text() {
        let activity = ActivityInput {
            end_date: Some("2026-10".to_string()),
            ..input()
        };
        assert_eq!(failed_rule(&activity), "end_before_start");
    }

    #[test]
    fn range_cannot_have_a_time() {
        let activity = ActivityInput {
            start_date: "2026-10-13T10:00".to_string(),
            end_date: Some("2026-10-14".to_string()),
            ..input()
        };
        assert_eq!(failed_rule(&activity), "time_on_range");
    }

    #[test]
    fn reminder_needs_a_full_start_date() {
        for start_date in ["2026", "2026-10"] {
            let activity = ActivityInput {
                start_date: start_date.to_string(),
                reminder: true,
                ..input()
            };
            assert_eq!(
                failed_rule(&activity),
                "reminder_needs_day",
                "should reject {start_date}"
            );
        }
        for start_date in ["2026-10-13", "2026-10-13T08:00"] {
            let activity = ActivityInput {
                start_date: start_date.to_string(),
                reminder: true,
                ..input()
            };
            assert!(activity.validate().is_ok(), "should accept {start_date}");
        }
    }

    #[test]
    fn participant_cannot_be_listed_twice() {
        let activity = ActivityInput {
            participants: vec![participant(2), participant(3), participant(2)],
            ..input()
        };
        assert_eq!(failed_rule(&activity), "duplicate_participant");
    }

    #[test]
    fn group_cannot_be_listed_twice() {
        let activity = ActivityInput {
            groups: vec![group(4), group(4)],
            ..input()
        };
        assert_eq!(failed_rule(&activity), "duplicate_group");
    }

    /// Rules across fields only run once every field is valid, so they never
    /// compare garbage.
    #[test]
    fn rules_across_fields_wait_for_valid_fields() {
        let activity = ActivityInput {
            name: String::new(),
            end_date: Some("2026-10-01".to_string()),
            ..input()
        };
        assert_eq!(invalid_fields(&activity), ["name"]);
    }

    // --- JSON contract with the frontend -------------------------------------

    #[test]
    fn input_is_read_from_camel_case() {
        let activity: ActivityInput = serde_json::from_value(json!({
            "name": "Interrail",
            "icon": "train-front",
            "startDate": "2026-07-01",
            "endDate": "2026-08-15",
            "description": "Lisbon to Rome",
            "location": "Europe",
            "impact": 4,
            "reminder": true,
            "participants": [{ "personId": 2, "impact": 5, "note": "her idea" }],
            "groups": [{ "groupId": 4, "impact": 3, "note": "first one" }]
        }))
        .unwrap();

        assert_eq!(activity.start_date, "2026-07-01");
        assert_eq!(activity.end_date.as_deref(), Some("2026-08-15"));
        assert_eq!(activity.location.as_deref(), Some("Europe"));
        assert!(activity.reminder);
        assert_eq!(activity.participants[0].person_id, 2);
        assert_eq!(activity.participants[0].impact, Some(5));
        assert_eq!(activity.groups[0].group_id, 4);
        assert_eq!(activity.groups[0].impact, Some(3));
        assert_eq!(activity.groups[0].note.as_deref(), Some("first one"));
    }

    #[test]
    fn input_defaults() {
        let activity: ActivityInput = serde_json::from_value(json!({
            "name": "Coffee",
            "startDate": "2026-10-13",
            "impact": 2,
            "participants": [{ "personId": 2 }]
        }))
        .unwrap();

        assert_eq!(activity.icon, "star");
        assert!(!activity.reminder);
        assert_eq!(activity.end_date, None);
        assert_eq!(activity.location, None);
        assert_eq!(activity.participants[0].impact, None);
        assert_eq!(activity.participants[0].note, None);
        assert!(activity.groups.is_empty());
    }

    #[test]
    fn input_requires_participants() {
        let result = serde_json::from_value::<ActivityInput>(json!({
            "name": "Coffee",
            "startDate": "2026-10-13",
            "impact": 2
        }));
        assert!(result.is_err());
    }

    #[test]
    fn response_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-15T12:00:00Z")
            .unwrap()
            .to_utc();
        let activity = ActivityResponse {
            id: 1,
            name: "Coffee".to_string(),
            icon: "star".to_string(),
            start_date: "2026-10-13T09:00".to_string(),
            end_date: None,
            description: None,
            location: Some("Café Fritz".to_string()),
            impact: 2,
            reminder: true,
            participants: vec![ParticipantResponse {
                person_id: 2,
                impact: Some(4),
                note: None,
            }],
            groups: vec![ActivityGroupResponse {
                group_id: 4,
                impact: None,
                note: Some("first one".to_string()),
            }],
            created_at: time,
            updated_at: time,
        };

        assert_eq!(
            serde_json::to_value(&activity).unwrap(),
            json!({
                "id": 1,
                "name": "Coffee",
                "icon": "star",
                "startDate": "2026-10-13T09:00",
                "endDate": null,
                "description": null,
                "location": "Café Fritz",
                "impact": 2,
                "reminder": true,
                "participants": [{ "personId": 2, "impact": 4, "note": null }],
                "groups": [{ "groupId": 4, "impact": null, "note": "first one" }],
                "createdAt": "2026-10-15T12:00:00Z",
                "updatedAt": "2026-10-15T12:00:00Z"
            })
        );
    }
}
