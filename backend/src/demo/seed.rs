//! Turns a `Dataset` into API calls, in the order the app needs them:
//! you → groups → people → activities, and archiving last, so nothing is
//! archived before everything that refers to it exists.

use std::{collections::HashMap, fmt};

use anyhow::{Context, bail};
use chrono::NaiveDate;
use serde_json::{Value, json};

use super::{
    api::{Api, id_of},
    data::{self, Dataset, Link, OpenPoint, Person, resolve_birthday, resolve_date},
};

/// What a load created, for the CLI output.
#[derive(Default)]
pub struct Summary {
    people: usize,
    groups: usize,
    activities: usize,
    facts: usize,
    open_points: usize,
}

impl fmt::Display for Summary {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} people, {} groups, {} activities, {} facts, {} open points",
            self.people, self.groups, self.activities, self.facts, self.open_points
        )
    }
}

/// Key → id of what is already created.
struct Ids {
    people: HashMap<String, i64>,
    groups: HashMap<String, i64>,
}

impl Ids {
    fn person(&self, key: &str) -> anyhow::Result<i64> {
        self.people
            .get(key)
            .copied()
            .with_context(|| format!("unknown person \"{key}\""))
    }

    fn group(&self, key: &str) -> anyhow::Result<i64> {
        self.groups
            .get(key)
            .copied()
            .with_context(|| format!("unknown group \"{key}\""))
    }
}

pub async fn run(api: &Api, data: &Dataset, today: NaiveDate) -> anyhow::Result<Summary> {
    let mut summary = Summary::default();
    let mut ids = Ids {
        people: HashMap::new(),
        groups: HashMap::new(),
    };

    let me = id_of(&api.get("/people/self").await?)?;
    seed_me(api, data, me, today, &mut summary)
        .await
        .context("me")?;
    ids.people.insert("me".to_string(), me);

    // Main groups first, their subgroups refer to them
    let (main, sub): (Vec<_>, Vec<_>) = data.groups.iter().partition(|g| g.parent.is_none());
    for group in main.into_iter().chain(sub) {
        let parent_id = group
            .parent
            .as_deref()
            .map(|key| ids.group(key))
            .transpose()?;
        let created = api
            .post(
                "/groups",
                json!({ "name": group.name, "parentId": parent_id }),
            )
            .await?;
        insert_unique(&mut ids.groups, &group.key, id_of(&created)?, "group")?;
        summary.groups += 1;
    }

    for person in &data.people {
        let id = seed_person(api, person, &ids, today, &mut summary)
            .await
            .with_context(|| format!("person \"{}\"", person.key))?;
        insert_unique(&mut ids.people, &person.key, id, "person")?;
    }

    for activity in &data.activities {
        seed_activity(api, activity, &ids, today, &mut summary)
            .await
            .with_context(|| format!("activity \"{}\" ({})", activity.name, activity.start))?;
    }

    for person in data.people.iter().filter(|p| p.archived) {
        let id = ids.person(&person.key)?;
        api.put(
            &format!("/people/{id}/archived"),
            json!({ "archived": true }),
        )
        .await?;
    }
    for group in data.groups.iter().filter(|g| g.archived) {
        let id = ids.group(&group.key)?;
        api.put(
            &format!("/groups/{id}/archived"),
            json!({ "archived": true }),
        )
        .await?;
    }

    Ok(summary)
}

async fn seed_me(
    api: &Api,
    data: &Dataset,
    me: i64,
    today: NaiveDate,
    summary: &mut Summary,
) -> anyhow::Result<()> {
    let birthday = data
        .me
        .birthday
        .as_ref()
        .map(|b| resolve_birthday(b, today))
        .transpose()?;
    api.put(
        &format!("/people/{me}"),
        json!({ "name": data.me.name, "nickname": data.me.nickname, "birthday": birthday, "impact": 5 }),
    )
    .await?;
    if let Some(photo) = &data.me.photo {
        api.put_bytes(&format!("/people/{me}/photo"), data::photo(photo)?)
            .await?;
    }
    seed_facts(api, me, &data.me.facts, summary).await
}

async fn seed_person(
    api: &Api,
    person: &Person,
    ids: &Ids,
    today: NaiveDate,
    summary: &mut Summary,
) -> anyhow::Result<i64> {
    let birthday = person
        .birthday
        .as_ref()
        .map(|b| resolve_birthday(b, today))
        .transpose()?;
    let died_on = person
        .died_on
        .as_deref()
        .map(|d| resolve_date(d, today))
        .transpose()?;
    let created = api
        .post(
            "/people",
            json!({
                "name": person.name,
                "nickname": person.nickname,
                "birthday": birthday,
                "birthdayNote": person.birthday_note,
                "reconnectDays": person.reconnect_days,
                "impact": person.impact,
                "focus": person.focus,
                "deceased": person.deceased,
                "diedOn": died_on,
            }),
        )
        .await?;
    let id = id_of(&created)?;
    summary.people += 1;

    if let Some(photo) = &person.photo {
        api.put_bytes(&format!("/people/{id}/photo"), data::photo(photo)?)
            .await?;
    }
    for group in &person.groups {
        api.put(
            &format!("/people/{id}/groups/{}", ids.group(group)?),
            Value::Null,
        )
        .await?;
    }
    seed_facts(api, id, &person.facts, summary).await?;
    for point in &person.open_points {
        seed_open_point(api, id, point, None, summary).await?;
    }
    Ok(id)
}

async fn seed_facts(
    api: &Api,
    person_id: i64,
    facts: &[(String, String)],
    summary: &mut Summary,
) -> anyhow::Result<()> {
    // Created in order, so they also keep the order of the dataset
    for (label, value) in facts {
        api.post(
            &format!("/people/{person_id}/facts"),
            json!({ "label": label, "value": value }),
        )
        .await?;
        summary.facts += 1;
    }
    Ok(())
}

async fn seed_open_point(
    api: &Api,
    person_id: i64,
    point: &OpenPoint,
    activity_id: Option<i64>,
    summary: &mut Summary,
) -> anyhow::Result<()> {
    let created = api
        .post(
            &format!("/people/{person_id}/open-points"),
            json!({ "text": point.text, "activityId": activity_id }),
        )
        .await?;
    if point.done {
        api.put(
            &format!("/open-points/{}/done", id_of(&created)?),
            json!({ "done": true }),
        )
        .await?;
    }
    summary.open_points += 1;
    Ok(())
}

async fn seed_activity(
    api: &Api,
    activity: &data::Activity,
    ids: &Ids,
    today: NaiveDate,
    summary: &mut Summary,
) -> anyhow::Result<()> {
    let participants = links(&activity.people, |key| ids.person(key), "personId")?;
    let groups = links(&activity.groups, |key| ids.group(key), "groupId")?;
    let end_date = activity
        .end
        .as_deref()
        .map(|e| resolve_date(e, today))
        .transpose()?;

    let mut body = json!({
        "name": activity.name,
        "startDate": resolve_date(&activity.start, today)?,
        "endDate": end_date,
        "description": activity.description,
        "location": activity.location,
        "impact": activity.impact,
        "reminder": activity.reminder,
        "participants": participants,
        "groups": groups,
    });
    // Left out, the API's default icon applies
    if let Some(icon) = &activity.icon {
        body["icon"] = json!(icon);
    }
    let activity_id = id_of(&api.post("/activities", body).await?)?;
    summary.activities += 1;

    for point in &activity.open_points {
        if !activity
            .people
            .iter()
            .any(|link| link.key() == point.person)
        {
            bail!("open point for \"{}\", who did not take part", point.person);
        }
        let open_point = OpenPoint {
            text: point.text.clone(),
            done: point.done,
        };
        seed_open_point(
            api,
            ids.person(&point.person)?,
            &open_point,
            Some(activity_id),
            summary,
        )
        .await?;
    }
    Ok(())
}

/// Links as the API expects them: `{ "<id_field>": 7, "impact": …, "note": … }`.
fn links(
    links: &[Link],
    id: impl Fn(&str) -> anyhow::Result<i64>,
    id_field: &str,
) -> anyhow::Result<Vec<Value>> {
    links
        .iter()
        .map(|link| {
            let mut value = json!({ "impact": link.impact(), "note": link.note() });
            value[id_field] = json!(id(link.key())?);
            Ok(value)
        })
        .collect()
}

fn insert_unique(
    ids: &mut HashMap<String, i64>,
    key: &str,
    id: i64,
    kind: &str,
) -> anyhow::Result<()> {
    if ids.insert(key.to_string(), id).is_some() {
        bail!("{kind} key \"{key}\" is used twice");
    }
    Ok(())
}
