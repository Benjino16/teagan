use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;
use validator::Validate;

use super::{ActivityResponse, FactResponse, GroupResponse, OpenPointResponse, PersonResponse};

/// Shorter queries find nothing – one letter matches almost everything.
pub const MIN_QUERY_CHARS: usize = 2;

#[derive(Deserialize, Validate)]
pub struct SearchParams {
    #[serde(default)]
    pub q: String,
    /// Hits per resource; `total` still counts all of them.
    #[serde(default = "default_limit")]
    #[validate(range(min = 1, max = 100))]
    pub limit: usize,
}

fn default_limit() -> usize {
    10
}

/// Matches per resource, best first. Archived people and groups and done
/// points come last, but are kept – a search is often for something old.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub people: Hits<PersonResponse>,
    pub groups: Hits<GroupResponse>,
    pub activities: Hits<ActivityResponse>,
    pub facts: Hits<FactResponse>,
    pub open_points: Hits<OpenPointResponse>,
}

#[derive(Serialize)]
pub struct Hits<T> {
    pub items: Vec<T>,
    pub total: usize,
}

impl<T> Hits<T> {
    pub fn empty() -> Self {
        Self {
            items: Vec::new(),
            total: 0,
        }
    }
}

/// Lowercase without accents: "Café" → "cafe". Umlauts are kept (ä ≠ a).
/// Same rules as `fold` in the frontend's `domain/search.ts`.
fn fold(text: &str) -> String {
    text.to_lowercase()
        .nfd()
        // Remove all accents except the diaeresis (U+0308)
        .filter(|c| !matches!(c, '\u{0300}'..='\u{0307}' | '\u{0309}'..='\u{036f}'))
        .nfc()
        .collect()
}

/// A folded search text, see `SearchQuery::parse`.
pub struct SearchQuery(String);

/// How well an entry matches; lower is better.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Rank {
    /// A main field (a name, a fact) starts with the query.
    Prefix,
    /// A word inside a main field starts with it.
    WordStart,
    /// Somewhere inside a main field.
    Inside,
    /// Only in a side field: a description, location or note.
    Side,
}

impl SearchQuery {
    /// `None` if the query is shorter than `MIN_QUERY_CHARS` after trimming.
    pub fn parse(query: &str) -> Option<Self> {
        let folded = fold(query.trim());
        (folded.chars().count() >= MIN_QUERY_CHARS).then_some(Self(folded))
    }

    /// The best rank over all fields, `None` if no field contains the query.
    pub fn rank<'a>(
        &self,
        main: impl IntoIterator<Item = Option<&'a str>>,
        side: impl IntoIterator<Item = Option<&'a str>>,
    ) -> Option<Rank> {
        let main = main
            .into_iter()
            .flatten()
            .filter_map(|text| self.rank_in(&fold(text)))
            .min();
        main.or_else(|| {
            side.into_iter()
                .flatten()
                .any(|text| fold(text).contains(&self.0))
                .then_some(Rank::Side)
        })
    }

    fn rank_in(&self, text: &str) -> Option<Rank> {
        let mut rank = None;
        for (at, _) in text.match_indices(&self.0) {
            if at == 0 {
                return Some(Rank::Prefix);
            }
            let after_word = text[..at]
                .chars()
                .next_back()
                .is_some_and(|c| !c.is_alphanumeric());
            if after_word {
                rank = Some(Rank::WordStart);
            } else {
                rank = rank.or(Some(Rank::Inside));
            }
        }
        rank
    }
}

/// The matching items, best rank first, those with `last` behind the rest.
/// Otherwise keeps the given order, so lists can come pre-sorted.
pub fn best_hits<T>(
    items: Vec<T>,
    limit: usize,
    mut rank: impl FnMut(&T) -> Option<Rank>,
    mut last: impl FnMut(&T) -> bool,
) -> Hits<T> {
    let mut hits: Vec<_> = items
        .into_iter()
        .filter_map(|item| Some(((last(&item), rank(&item)?), item)))
        .collect();
    hits.sort_by_key(|(key, _)| *key);
    Hits {
        total: hits.len(),
        items: hits.into_iter().take(limit).map(|(_, item)| item).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(text: &str) -> SearchQuery {
        SearchQuery::parse(text).unwrap()
    }

    fn rank(q: &str, main: &[&str], side: &[&str]) -> Option<Rank> {
        query(q).rank(main.iter().map(|t| Some(*t)), side.iter().map(|t| Some(*t)))
    }

    // --- fold ----------------------------------------------------------------

    #[test]
    fn fold_drops_case_and_accents_but_keeps_umlauts() {
        assert_eq!(fold("Café CRÈME"), "cafe creme");
        assert_eq!(fold("Jürgen Ölmann"), "jürgen ölmann");
        assert_eq!(fold("Straße"), "straße");
        // Decomposed input ends up the same as composed
        assert_eq!(fold("Ju\u{0308}rgen"), "jürgen");
    }

    // --- parse ---------------------------------------------------------------

    #[test]
    fn short_queries_are_rejected() {
        for text in ["", " ", "a", " ä  "] {
            assert!(SearchQuery::parse(text).is_none(), "{text:?}");
        }
        assert!(SearchQuery::parse(" ab ").is_some());
    }

    // --- rank ----------------------------------------------------------------

    #[test]
    fn matches_ignore_case_and_accents() {
        assert_eq!(rank("cafe", &["Café Nord"], &[]), Some(Rank::Prefix));
        assert_eq!(rank("JÜR", &["jürgen"], &[]), Some(Rank::Prefix));
    }

    #[test]
    fn umlauts_are_not_their_base_letter() {
        assert_eq!(rank("jur", &["Jürgen"], &[]), None);
        assert_eq!(rank("jür", &["Jurgen"], &[]), None);
    }

    #[test]
    fn prefix_beats_word_start_beats_inside() {
        assert_eq!(rank("an", &["Anna"], &[]), Some(Rank::Prefix));
        assert_eq!(rank("an", &["Lisa-Ann"], &[]), Some(Rank::WordStart));
        assert_eq!(rank("an", &["Marianne"], &[]), Some(Rank::Inside));
        // The best occurrence counts, not the first
        assert_eq!(rank("an", &["Marianne Anders"], &[]), Some(Rank::WordStart));
    }

    #[test]
    fn best_main_field_counts() {
        assert_eq!(rank("mi", &["Marianne", "Mimi"], &[]), Some(Rank::Prefix));
    }

    #[test]
    fn side_fields_rank_below_any_main_match() {
        assert_eq!(rank("berlin", &["Trip"], &["Berlin"]), Some(Rank::Side));
        assert_eq!(rank("ri", &["Trip"], &["Ride"]), Some(Rank::Inside));
        assert_eq!(rank("xyz", &["Trip"], &["Berlin"]), None);
    }

    #[test]
    fn missing_fields_are_skipped() {
        let q = query("mi");
        assert_eq!(q.rank([None, Some("Mia")], [None]), Some(Rank::Prefix));
        assert_eq!(q.rank([None], [None]), None);
    }

    // --- best_hits -----------------------------------------------------------

    #[test]
    fn hits_sort_by_last_then_rank_then_given_order() {
        let items = vec!["c inside", "a", "b archived", "d", "x nothing"];
        let hits = best_hits(
            items,
            10,
            |item| match item.chars().next() {
                Some('x') => None,
                Some('c') => Some(Rank::Inside),
                _ => Some(Rank::Prefix),
            },
            |item| item.contains("archived"),
        );
        assert_eq!(hits.total, 4);
        assert_eq!(hits.items, ["a", "d", "c inside", "b archived"]);
    }

    #[test]
    fn hits_are_limited_but_all_counted() {
        let hits = best_hits(vec![1, 2, 3], 2, |_| Some(Rank::Prefix), |_| false);
        assert_eq!(hits.items, [1, 2]);
        assert_eq!(hits.total, 3);
    }
}
