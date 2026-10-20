use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct FactInput {
    #[validate(length(min = 1, max = 64))]
    pub label: String,
    #[validate(length(min = 1, max = 1000))]
    pub value: String,
}

impl FactInput {
    /// Trims both fields. The label keeps its spelling – labels only count
    /// as the same case-insensitively (`label_key`).
    pub fn normalize(&mut self) {
        self.label = self.label.trim().to_string();
        self.value = self.value.trim().to_string();
    }
}

/// New order of a person's facts, top first. Must list each of them once.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactOrderInput {
    pub fact_ids: Vec<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactResponse {
    pub id: i64,
    pub person_id: i64,
    pub label: String,
    pub value: String,
    pub sort: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A label used across all people, with its number of uses.
#[derive(Serialize, Debug, PartialEq)]
pub struct FactLabelResponse {
    pub label: String,
    pub count: i64,
}

/// Key under which labels count as the same: case and surrounding spaces are ignored.
fn label_key(label: &str) -> String {
    label.trim().to_lowercase()
}

/// Groups stored labels by `label_key`. Each group shows its most used
/// spelling; most used labels first. Same rules as `countFactLabels` in the
/// frontend.
pub fn count_fact_labels(spellings: Vec<(String, i64)>) -> Vec<FactLabelResponse> {
    let mut groups: HashMap<String, Vec<(String, i64)>> = HashMap::new();
    for (label, count) in spellings {
        let label = label.trim().to_string();
        let group = groups.entry(label_key(&label)).or_default();
        match group.iter_mut().find(|(spelling, _)| *spelling == label) {
            Some((_, n)) => *n += count,
            None => group.push((label, count)),
        }
    }

    let mut labels: Vec<FactLabelResponse> = groups
        .into_values()
        .map(|mut group| {
            group.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
            FactLabelResponse {
                count: group.iter().map(|(_, n)| n).sum(),
                label: group.swap_remove(0).0,
            }
        })
        .collect();
    labels.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then_with(|| label_key(&a.label).cmp(&label_key(&b.label)))
    });
    labels
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spellings(items: &[(&str, i64)]) -> Vec<(String, i64)> {
        items
            .iter()
            .map(|(label, n)| (label.to_string(), *n))
            .collect()
    }

    fn label(label: &str, count: i64) -> FactLabelResponse {
        FactLabelResponse {
            label: label.to_string(),
            count,
        }
    }

    #[test]
    fn normalize_trims_but_keeps_spelling() {
        let mut fact = FactInput {
            label: "  Job ".to_string(),
            value: "\tUX \n".to_string(),
        };
        fact.normalize();
        assert_eq!(fact.label, "Job");
        assert_eq!(fact.value, "UX");
    }

    #[test]
    fn labels_group_case_insensitively_with_the_most_used_spelling() {
        let labels = count_fact_labels(spellings(&[("job", 1), ("Job", 2), ("Pets", 1)]));
        assert_eq!(labels, [label("Job", 3), label("Pets", 1)]);
    }

    #[test]
    fn labels_tie_breaks_are_stable() {
        let labels = count_fact_labels(spellings(&[("b", 1), ("A", 1), ("a", 1)]));
        // "A" and "a" tie at 1 → "A" sorts first; the group (2) beats "b" (1)
        assert_eq!(labels, [label("A", 2), label("b", 1)]);

        let labels = count_fact_labels(spellings(&[("Pets", 1), ("food", 1)]));
        assert_eq!(labels, [label("food", 1), label("Pets", 1)]);
    }

    #[test]
    fn no_labels() {
        assert!(count_fact_labels(Vec::new()).is_empty());
    }
}
