use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Creating or editing a group. `parent_id = None` makes it a
/// main group.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct GroupInput {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub parent_id: Option<i64>,
}

impl GroupInput {
    pub fn normalize(&mut self) {
        self.name = self.name.trim().to_string();
    }
}

/// Archiving a group or bringing it back.
#[derive(Deserialize)]
pub struct GroupArchivedInput {
    pub archived: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupResponse {
    pub id: i64,
    pub name: String,
    /// `None` = main group.
    pub parent_id: Option<i64>,
    /// Only the group's own state – a subgroup of an archived main group
    /// keeps `None` here and is hidden by the client.
    pub archived_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A person in a group – a pure link, so only `created_at`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MembershipResponse {
    pub person_id: i64,
    pub group_id: i64,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_trims_name() {
        let mut group = GroupInput {
            name: "  Freshers 2021 \n".to_string(),
            parent_id: None,
        };
        group.normalize();
        assert_eq!(group.name, "Freshers 2021");
    }

    #[test]
    fn name_length_limits() {
        for name in ["a".to_string(), "a".repeat(100), "ü".repeat(100)] {
            assert!(
                GroupInput {
                    name,
                    parent_id: None
                }
                .validate()
                .is_ok()
            );
        }
        for name in [String::new(), "a".repeat(101)] {
            assert!(
                GroupInput {
                    name,
                    parent_id: None
                }
                .validate()
                .is_err()
            );
        }
    }

    #[test]
    fn input_is_read_from_camel_case() {
        let group: GroupInput =
            serde_json::from_value(json!({ "name": "Freshers 2021", "parentId": 3 })).unwrap();
        assert_eq!(group.parent_id, Some(3));

        let group: GroupInput = serde_json::from_value(json!({ "name": "University" })).unwrap();
        assert_eq!(group.parent_id, None);
    }

    #[test]
    fn archived_input_requires_the_flag() {
        let input: GroupArchivedInput =
            serde_json::from_value(json!({ "archived": true })).unwrap();
        assert!(input.archived);
        assert!(serde_json::from_value::<GroupArchivedInput>(json!({})).is_err());
    }

    #[test]
    fn response_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-15T12:00:00Z")
            .unwrap()
            .to_utc();
        let group = GroupResponse {
            id: 4,
            name: "Freshers 2021".to_string(),
            parent_id: Some(3),
            archived_at: Some(time),
            created_at: time,
            updated_at: time,
        };

        assert_eq!(
            serde_json::to_value(&group).unwrap(),
            json!({
                "id": 4,
                "name": "Freshers 2021",
                "parentId": 3,
                "archivedAt": "2026-10-15T12:00:00Z",
                "createdAt": "2026-10-15T12:00:00Z",
                "updatedAt": "2026-10-15T12:00:00Z"
            })
        );
    }

    #[test]
    fn membership_is_written_in_camel_case() {
        let time = DateTime::parse_from_rfc3339("2026-10-15T12:00:00Z")
            .unwrap()
            .to_utc();
        let membership = MembershipResponse {
            person_id: 2,
            group_id: 4,
            created_at: time,
        };

        assert_eq!(
            serde_json::to_value(&membership).unwrap(),
            json!({ "personId": 2, "groupId": 4, "createdAt": "2026-10-15T12:00:00Z" })
        );
    }
}
