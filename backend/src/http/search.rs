use std::collections::HashSet;

use super::{AppState, CurrentUser};
use crate::{
    db,
    domain::{Hits, SearchParams, SearchQuery, SearchResponse, best_hits},
    error::{AppError, AppResult},
};
use axum::{
    Json,
    extract::{Query, State, rejection::QueryRejection},
};
use validator::Validate;

/// Searches all of the user's resources at once. Loads the user's texts and
/// filters them here: SQL `LIKE` only folds ASCII case and FTS5 only finds
/// word prefixes, and both would differ from the lists' search in the
/// frontend.
pub async fn search(
    State(state): State<AppState>,
    user: CurrentUser,
    params: Result<Query<SearchParams>, QueryRejection>,
) -> AppResult<Json<SearchResponse>> {
    let Query(params) = params.map_err(|err| AppError::Invalid(err.body_text()))?;
    params.validate()?;
    let Some(query) = SearchQuery::parse(&params.q) else {
        return Ok(Json(SearchResponse {
            people: Hits::empty(),
            groups: Hits::empty(),
            activities: Hits::empty(),
            facts: Hits::empty(),
            open_points: Hits::empty(),
        }));
    };

    let pool = &state.pool;
    let (people, groups, activities, facts, open_points) = tokio::try_join!(
        db::people::list(pool, user.id),
        db::groups::list(pool, user.id),
        db::activities::list(pool, user.id),
        db::facts::list_all(pool, user.id),
        db::open_points::list_all(pool, user.id),
    )?;

    let archived_people: HashSet<i64> = people
        .iter()
        .filter(|p| p.archived_at.is_some())
        .map(|p| p.id)
        .collect();
    // A subgroup counts as archived with its main group, like in the client
    let archived_groups: HashSet<i64> = groups
        .iter()
        .filter(|g| g.archived_at.is_some())
        .map(|g| g.id)
        .collect();
    let limit = params.limit;

    Ok(Json(SearchResponse {
        people: best_hits(
            people,
            limit,
            |p| {
                query.rank(
                    [Some(p.name.as_str()), p.nickname.as_deref()],
                    [p.birthday_note.as_deref()],
                )
            },
            |p| p.archived_at.is_some(),
        ),
        groups: best_hits(
            groups,
            limit,
            |g| query.rank([Some(g.name.as_str())], []),
            |g| {
                archived_groups.contains(&g.id)
                    || g.parent_id.is_some_and(|id| archived_groups.contains(&id))
            },
        ),
        activities: best_hits(
            activities,
            limit,
            |a| {
                let notes = a
                    .participants
                    .iter()
                    .map(|p| p.note.as_deref())
                    .chain(a.groups.iter().map(|g| g.note.as_deref()));
                query.rank(
                    [Some(a.name.as_str())],
                    [a.location.as_deref(), a.description.as_deref()]
                        .into_iter()
                        .chain(notes),
                )
            },
            |_| false,
        ),
        facts: best_hits(
            facts,
            limit,
            |f| query.rank([Some(f.label.as_str()), Some(f.value.as_str())], []),
            |f| archived_people.contains(&f.person_id),
        ),
        open_points: best_hits(
            open_points,
            limit,
            |p| query.rank([Some(p.text.as_str())], []),
            |p| p.done_at.is_some() || archived_people.contains(&p.person_id),
        ),
    }))
}
