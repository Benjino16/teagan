//! The demo dataset: what `demo/data.toml` contains and `generate` adds to.
//!
//! People and groups have a `key` that activities and memberships refer to;
//! `me` is the demo user's own person. Ids only exist after seeding.
//!
//! Dates are written relative to today, so the data never goes stale:
//!
//! | written         | means                         | stored as          |
//! |-----------------|-------------------------------|--------------------|
//! | `today`, `-12d` | that day                      | `YYYY-MM-DD`       |
//! | `+2d 19:30`     | that day at that time         | `YYYY-MM-DDTHH:MM` |
//! | `-3w`           | 3 weeks ago                   | `YYYY-MM-DD`       |
//! | `today-4y`      | this day 4 years ago          | `YYYY-MM-DD`       |
//! | `-14m`          | that month, day unknown       | `YYYY-MM`          |
//! | `-6y`           | that year, month unknown      | `YYYY`             |
//! | `2019-08`       | itself (absolute)             | unchanged          |

use anyhow::{Context, bail};
use chrono::{Datelike, Days, Months, NaiveDate};
use rust_embed::RustEmbed;
use serde::Deserialize;

const DATA: &str = include_str!("../../demo/data.toml");

/// Photos referenced by file name from `photo = "…"`.
#[derive(RustEmbed)]
#[folder = "demo/photos/"]
struct Photos;

pub fn load() -> anyhow::Result<Dataset> {
    toml::from_str(DATA).context("demo/data.toml is invalid")
}

pub fn photo(file: &str) -> anyhow::Result<Vec<u8>> {
    Photos::get(file)
        .map(|photo| photo.data.into_owned())
        .with_context(|| format!("no demo photo \"{file}\" in demo/photos/"))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Dataset {
    pub me: Me,
    #[serde(default)]
    pub groups: Vec<Group>,
    #[serde(default)]
    pub people: Vec<Person>,
    #[serde(default)]
    pub activities: Vec<Activity>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Me {
    pub name: String,
    pub nickname: Option<String>,
    pub birthday: Option<Birthday>,
    pub photo: Option<String>,
    #[serde(default)]
    pub facts: Vec<(String, String)>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Group {
    pub key: String,
    pub name: String,
    /// Key of the main group; `None` = this is a main group.
    pub parent: Option<String>,
    #[serde(default)]
    pub archived: bool,
}

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Person {
    pub key: String,
    pub name: String,
    pub nickname: Option<String>,
    pub birthday: Option<Birthday>,
    pub birthday_note: Option<String>,
    pub reconnect_days: Option<i64>,
    #[serde(default = "default_person_impact")]
    pub impact: i64,
    #[serde(default)]
    pub focus: bool,
    #[serde(default)]
    pub deceased: bool,
    /// A relative or absolute date, see the module docs.
    pub died_on: Option<String>,
    #[serde(default)]
    pub archived: bool,
    pub photo: Option<String>,
    /// Group keys; a subgroup brings its main group along (like in the app).
    #[serde(default)]
    pub groups: Vec<String>,
    /// `[label, value]`, in display order.
    #[serde(default)]
    pub facts: Vec<(String, String)>,
    #[serde(default)]
    pub open_points: Vec<OpenPoint>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OpenPoint {
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

/// `{ in_days = 9, age = 32 }` → full date, turns 32 in 9 days (negative = was).
/// `{ in_days = 40 }` → `--MM-DD`, year unknown. `{ age = 24 }` → year only.
/// A plain string is taken as it is.
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Birthday {
    Exact(String),
    Relative {
        in_days: Option<i64>,
        age: Option<i32>,
    },
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Activity {
    pub name: String,
    pub icon: Option<String>,
    /// A relative or absolute date, see the module docs.
    pub start: String,
    pub end: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    #[serde(default = "default_activity_impact")]
    pub impact: i64,
    #[serde(default)]
    pub reminder: bool,
    /// Person keys, `me` included when you were there – only then it counts
    /// as contact.
    #[serde(default)]
    pub people: Vec<Link>,
    #[serde(default)]
    pub groups: Vec<Link>,
    /// Open points that came up here; `person` must be one of `people`.
    #[serde(default)]
    pub open_points: Vec<ActivityPoint>,
}

/// `"lena"`, or `{ key = "lena", impact = 5, note = "…" }` for an own impact
/// or note on this person or group.
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Link {
    Key(String),
    Detailed {
        key: String,
        impact: Option<i64>,
        note: Option<String>,
    },
}

impl Link {
    pub fn key(&self) -> &str {
        match self {
            Link::Key(key) | Link::Detailed { key, .. } => key,
        }
    }

    pub fn impact(&self) -> Option<i64> {
        match self {
            Link::Key(_) => None,
            Link::Detailed { impact, .. } => *impact,
        }
    }

    pub fn note(&self) -> Option<&str> {
        match self {
            Link::Key(_) => None,
            Link::Detailed { note, .. } => note.as_deref(),
        }
    }
}

impl From<&str> for Link {
    fn from(key: &str) -> Self {
        Link::Key(key.to_string())
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivityPoint {
    pub person: String,
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

// Same defaults as the DB schema
fn default_person_impact() -> i64 {
    3
}

fn default_activity_impact() -> i64 {
    2
}

/// A date as written in the dataset → the stored form, see the module docs.
/// Absolute dates pass through unchanged; the API validates them.
pub fn resolve_date(spec: &str, today: NaiveDate) -> anyhow::Result<String> {
    let spec = spec.trim();
    let (offset, time) = match spec.split_once(' ') {
        Some((offset, time)) => (offset, Some(time)),
        None => (spec, None),
    };
    let full_date = |date: Option<NaiveDate>| -> anyhow::Result<String> {
        let date = date.with_context(|| format!("date \"{spec}\": out of range"))?;
        Ok(match time {
            Some(time) => format!("{}T{time}", date.format("%Y-%m-%d")),
            None => date.format("%Y-%m-%d").to_string(),
        })
    };

    // `today-4y`, `today+2m`: this very day, whole years or months away – e.g. for an anniversary
    if let Some(shift) = offset
        .strip_prefix("today")
        .filter(|shift| !shift.is_empty())
    {
        let (sign, amount, unit) = parse_offset(spec, shift)?;
        let months = match unit {
            'm' => Months::new(amount),
            'y' => Months::new(amount * 12),
            _ => bail!("date \"{spec}\": `today` moves by whole months or years, use m or y"),
        };
        // 29 February falls on the 28th in other years
        return full_date(if sign > 0 {
            today.checked_add_months(months)
        } else {
            today.checked_sub_months(months)
        });
    }

    let (sign, amount, unit) = match offset {
        "today" => (1, 0, 'd'),
        _ if offset.starts_with(['+', '-']) => parse_offset(spec, offset)?,
        _ => return Ok(spec.to_string()),
    };
    if time.is_some() && !matches!(unit, 'd' | 'w') {
        bail!("date \"{spec}\": a time needs a day (d or w)");
    }
    let day = |days: u64| {
        let days = Days::new(days);
        full_date(if sign > 0 {
            today.checked_add_days(days)
        } else {
            today.checked_sub_days(days)
        })
    };

    match unit {
        'd' => day(amount.into()),
        'w' => day(u64::from(amount) * 7),
        'm' => {
            let months = Months::new(amount);
            let date = if sign > 0 {
                today.checked_add_months(months)
            } else {
                today.checked_sub_months(months)
            };
            let date = date.with_context(|| format!("date \"{spec}\": out of range"))?;
            Ok(date.format("%Y-%m").to_string())
        }
        'y' => Ok((today.year() + sign * amount as i32).to_string()),
        _ => bail!("date \"{spec}\": unknown unit `{unit}`, use d, w, m or y"),
    }
}

/// `-12d`, `+3w` → sign, amount and unit.
fn parse_offset(spec: &str, offset: &str) -> anyhow::Result<(i32, u32, char)> {
    let (sign, rest) = match offset.as_bytes().first() {
        Some(b'+') => (1, &offset[1..]),
        Some(b'-') => (-1, &offset[1..]),
        _ => bail!("date \"{spec}\": the offset needs + or -"),
    };
    let Some(unit) = rest.chars().last() else {
        bail!("date \"{spec}\": missing amount")
    };
    let amount = rest[..rest.len() - unit.len_utf8()]
        .parse()
        .with_context(|| format!("date \"{spec}\": amount is not a number"))?;
    Ok((sign, amount, unit))
}

pub fn resolve_birthday(birthday: &Birthday, today: NaiveDate) -> anyhow::Result<String> {
    match birthday {
        Birthday::Exact(value) => Ok(value.clone()),
        Birthday::Relative {
            in_days: Some(in_days),
            age,
        } => {
            let next = today
                .checked_add_signed(chrono::Duration::days(*in_days))
                .context("birthday: out of range")?;
            let Some(age) = age else {
                return Ok(format!("--{:02}-{:02}", next.month(), next.day()));
            };
            let year = next.year() - age;
            // 29 February only exists in leap years
            let date = NaiveDate::from_ymd_opt(year, next.month(), next.day())
                .or_else(|| NaiveDate::from_ymd_opt(year, next.month(), next.day() - 1))
                .context("birthday: no such date")?;
            Ok(date.format("%Y-%m-%d").to_string())
        }
        Birthday::Relative {
            in_days: None,
            age: Some(age),
        } => Ok((today.year() - age).to_string()),
        Birthday::Relative {
            in_days: None,
            age: None,
        } => bail!("birthday: needs in_days, age or both"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, 19).unwrap()
    }

    #[test]
    fn data_file_parses() {
        load().unwrap();
    }

    #[test]
    fn relative_days_and_weeks_give_full_dates() {
        assert_eq!(resolve_date("today", today()).unwrap(), "2026-10-19");
        assert_eq!(resolve_date("-12d", today()).unwrap(), "2026-10-07");
        assert_eq!(
            resolve_date("+2d 19:30", today()).unwrap(),
            "2026-10-21T19:30"
        );
        assert_eq!(resolve_date("-3w", today()).unwrap(), "2026-09-28");
    }

    #[test]
    fn months_and_years_keep_their_precision() {
        assert_eq!(resolve_date("-14m", today()).unwrap(), "2025-08");
        assert_eq!(resolve_date("-6y", today()).unwrap(), "2020");
    }

    #[test]
    fn today_moved_by_months_or_years_keeps_the_day() {
        assert_eq!(resolve_date("today-1y", today()).unwrap(), "2025-10-19");
        assert_eq!(
            resolve_date("today-4y 18:00", today()).unwrap(),
            "2022-10-19T18:00"
        );
        assert_eq!(resolve_date("today+2m", today()).unwrap(), "2026-12-19");
        let leap_day = NaiveDate::from_ymd_opt(2028, 2, 29).unwrap();
        assert_eq!(resolve_date("today-1y", leap_day).unwrap(), "2027-02-28");
    }

    #[test]
    fn absolute_dates_pass_through() {
        assert_eq!(resolve_date("2019-08", today()).unwrap(), "2019-08");
    }

    #[test]
    fn broken_relative_dates_are_rejected() {
        for spec in ["-d", "-xd", "-3q", "-3m 10:00", "today-3d", "today4y"] {
            assert!(
                resolve_date(spec, today()).is_err(),
                "should reject {spec:?}"
            );
        }
    }

    #[test]
    fn birthdays_in_all_precisions() {
        let full = Birthday::Relative {
            in_days: Some(9),
            age: Some(32),
        };
        assert_eq!(resolve_birthday(&full, today()).unwrap(), "1994-10-28");
        let past = Birthday::Relative {
            in_days: Some(-20),
            age: Some(30),
        };
        assert_eq!(resolve_birthday(&past, today()).unwrap(), "1996-09-29");
        let no_year = Birthday::Relative {
            in_days: Some(40),
            age: None,
        };
        assert_eq!(resolve_birthday(&no_year, today()).unwrap(), "--11-28");
        let year_only = Birthday::Relative {
            in_days: None,
            age: Some(24),
        };
        assert_eq!(resolve_birthday(&year_only, today()).unwrap(), "2002");
    }

    #[test]
    fn leap_day_birthday_falls_back_in_other_years() {
        let leap_day = NaiveDate::from_ymd_opt(2028, 2, 29).unwrap();
        let birthday = Birthday::Relative {
            in_days: Some(0),
            age: Some(31),
        };
        assert_eq!(resolve_birthday(&birthday, leap_day).unwrap(), "1997-02-28");
    }
}
