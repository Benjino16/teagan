//! The bulk of the demo: loose acquaintances from the circles of
//! `data.toml` (colleagues, uni, climbing …) and the everyday activities that
//! connect them to you. Hand-writing 30+ of them would be tedious; generated,
//! they still look like someone's real address book.
//!
//! Deterministic: a fixed seed, so every load looks the same (relative to
//! today). The group keys below must exist in `data.toml`.

use super::data::{Activity, Birthday, Dataset, Link, OpenPoint, Person};

const SEED: u64 = 0x7EA6_A11D;

/// A circle of acquaintances: where they belong, how many there are, and what
/// you usually know about such a person.
struct Circle {
    key: &'static str,
    groups: &'static [&'static str],
    count: usize,
    impact: (i64, i64),
    /// Typical facts, a few of them are picked per person.
    facts: &'static [(&'static str, &'static [&'static str])],
}

const CIRCLES: &[Circle] = &[
    Circle {
        key: "work",
        groups: &["work-nordlicht"],
        count: 9,
        impact: (1, 3),
        facts: &[
            (
                "Job",
                &[
                    "Frontend developer",
                    "Product manager",
                    "UX researcher",
                    "Art director",
                    "Backend developer",
                ],
            ),
            (
                "Hobbies",
                &[
                    "Running",
                    "Board games",
                    "Photography",
                    "Gardening",
                    "Cooking",
                ],
            ),
            (
                "Kids",
                &["One daughter, 4", "Two boys, 6 and 9", "Baby on the way"],
            ),
            (
                "Lives in",
                &["Altona", "Eimsbüttel", "Ottensen", "Winterhude"],
            ),
        ],
    },
    Circle {
        key: "oldjob",
        groups: &["work-pixelwerk"],
        count: 4,
        impact: (1, 2),
        facts: &[
            (
                "Job",
                &["Still at Pixelwerk", "Freelancer now", "Moved to Spotify"],
            ),
            ("Lives in", &["Berlin", "Munich", "Hamburg"]),
        ],
    },
    Circle {
        key: "uni",
        groups: &["uni-freshers"],
        count: 8,
        impact: (1, 3),
        facts: &[
            (
                "Studied",
                &[
                    "Communication design",
                    "Media informatics",
                    "Interaction design",
                ],
            ),
            (
                "Job",
                &[
                    "Teacher",
                    "Design lead",
                    "Founder of a small studio",
                    "PhD student",
                ],
            ),
            (
                "Lives in",
                &["Berlin", "Leipzig", "Vienna", "Cologne", "Copenhagen"],
            ),
            (
                "Partner",
                &["Married to Tom", "Together with Aylin", "Single"],
            ),
        ],
    },
    Circle {
        key: "school",
        groups: &["school-class"],
        count: 4,
        impact: (1, 2),
        facts: &[
            ("Lives in", &["Still in Lüneburg", "Bremen", "Zurich"]),
            ("Job", &["Nurse", "Carpenter", "Police officer", "Lawyer"]),
            ("Kids", &["Three kids", "One son"]),
        ],
    },
    Circle {
        key: "climbing",
        groups: &["climbing"],
        count: 6,
        impact: (2, 3),
        facts: &[
            (
                "Climbing",
                &[
                    "Projects 7a outdoors",
                    "Mostly bouldering",
                    "Just started",
                    "Belay certified",
                ],
            ),
            (
                "Job",
                &["Physiotherapist", "Student", "Electrician", "Data analyst"],
            ),
        ],
    },
    Circle {
        key: "neighbours",
        groups: &["neighbours"],
        count: 3,
        impact: (1, 2),
        facts: &[
            (
                "Flat",
                &["2nd floor left", "Ground floor, has the cat", "Top floor"],
            ),
            ("Pet", &["Cat named Mo", "Old dachshund"]),
        ],
    },
    Circle {
        key: "family",
        groups: &["family-cousins"],
        count: 3,
        impact: (2, 4),
        facts: &[
            ("Lives in", &["Kiel", "Hanover", "Lüneburg"]),
            (
                "Job",
                &[
                    "Apprentice mechanic",
                    "Studies medicine",
                    "Kindergarten teacher",
                ],
            ),
        ],
    },
];

const FIRST_NAMES: &[&str] = &[
    "Anna", "Ben", "Clara", "David", "Emma", "Felix", "Greta", "Hannah", "Ida", "Jan", "Karla",
    "Leon", "Marie", "Nils", "Ole", "Paula", "Quentin", "Rosa", "Simon", "Tara", "Till", "Vera",
    "Wiebke", "Yusuf", "Zoe", "Aylin", "Bastian", "Carlotta", "Deniz", "Elif", "Finn", "Hedda",
    "Jakob", "Lotte", "Malte", "Nora", "Piet", "Selin", "Theo", "Ylva",
];

const LAST_NAMES: &[&str] = &[
    "Albers",
    "Brandt",
    "Claasen",
    "Dietrich",
    "Engel",
    "Friedrichs",
    "Graf",
    "Hansen",
    "Iversen",
    "Jensen",
    "Kaya",
    "Lorenz",
    "Möller",
    "Nowak",
    "Ostermann",
    "Petersen",
    "Quast",
    "Richter",
    "Sander",
    "Thiele",
    "Ulrich",
    "Vogt",
    "Winter",
    "Yilmaz",
    "Ziegler",
    "Arslan",
    "Böhm",
    "Carstens",
    "Dahl",
    "Ehlers",
];

pub fn extend(data: &mut Dataset) {
    let mut rng = Rng(SEED);
    let mut names = Names::default();

    for circle in CIRCLES {
        let keys: Vec<String> = (1..=circle.count)
            .map(|n| {
                let key = format!("{}-{n}", circle.key);
                data.people.push(person(&mut rng, &mut names, circle, &key));
                key
            })
            .collect();
        data.activities.extend(activities(&mut rng, circle, &keys));
    }
}

fn person(rng: &mut Rng, names: &mut Names, circle: &Circle, key: &str) -> Person {
    let birthday = match rng.below(100) {
        0..60 => Some(Birthday::Relative {
            in_days: Some(rng.range(-180, 185)),
            age: Some(rng.range(24, 42) as i32),
        }),
        60..75 => Some(Birthday::Relative {
            in_days: Some(rng.range(-180, 185)),
            age: None,
        }),
        75..85 => Some(Birthday::Relative {
            in_days: None,
            age: Some(rng.range(24, 42) as i32),
        }),
        _ => None,
    };
    let fact_count = rng.below(circle.facts.len() as u64 + 1) as usize;
    let facts = rng
        .sample(circle.facts, fact_count)
        .into_iter()
        .map(|(label, values)| (label.to_string(), rng.pick(values).to_string()))
        .collect();
    let open_points = if rng.chance(12) {
        vec![OpenPoint {
            text: rng.pick(POINTS).to_string(),
            done: rng.chance(30),
        }]
    } else {
        Vec::new()
    };

    Person {
        key: key.to_string(),
        name: names.next(rng),
        birthday,
        // A rhythm for some – those are the ones that show up as overdue
        reconnect_days: rng.chance(20).then(|| *rng.pick(&[30, 60, 90, 180])),
        impact: rng.range(circle.impact.0, circle.impact.1),
        // The old job is long ago; some of those contacts are put away
        archived: circle.key == "oldjob" && rng.chance(40),
        groups: circle.groups.iter().map(|g| g.to_string()).collect(),
        facts,
        open_points,
        ..Person::default()
    }
}

const POINTS: &[&str] = &[
    "Send the photos from last time",
    "Return the book",
    "Ask how the move went",
    "Recommend the podcast",
    "Pay back 12 €",
    "Ask for the recipe",
];

/// The everyday rhythm of a circle over the last few years. You are always
/// there – these are your contacts with them.
fn activities(rng: &mut Rng, circle: &Circle, people: &[String]) -> Vec<Activity> {
    let mut activities = Vec::new();
    let mut add =
        |name: &str, icon: &str, days_ago: i64, attendees: Vec<&String>, group: Option<&str>| {
            let mut links: Vec<Link> = vec!["me".into()];
            links.extend(attendees.into_iter().map(|key| Link::from(key.as_str())));
            activities.push(Activity {
                name: name.to_string(),
                icon: Some(icon.to_string()),
                start: format!("-{days_ago}d"),
                end: None,
                description: None,
                location: None,
                impact: 2,
                reminder: false,
                people: links,
                groups: group.map(Link::from).into_iter().collect(),
                open_points: Vec::new(),
                money: Vec::new(),
            });
        };

    match circle.key {
        "work" => {
            // Lunch roughly every three weeks, the summer party once a year
            let mut day = rng.range(1, 6);
            while day < 420 {
                let count = rng.range(2, 4) as usize;
                let who = rng.sample(people, count);
                add("Team lunch", "utensils", day, who, None);
                day += rng.range(14, 28);
            }
            for year in 0..2 {
                add(
                    "Summer party",
                    "party",
                    365 * year + rng.range(90, 110),
                    Vec::new(),
                    Some("work-nordlicht"),
                );
            }
        }
        "oldjob" => {
            add(
                "Farewell drinks at Pixelwerk",
                "beer",
                800,
                people.iter().collect(),
                Some("work-pixelwerk"),
            );
            let who = rng.sample(people, 1);
            add(
                "Coffee with an old colleague",
                "coffee",
                rng.range(150, 300),
                who,
                None,
            );
        }
        "uni" => {
            for year in 0..3 {
                let count = rng.range(3, 6) as usize;
                let who = rng.sample(people, count);
                add(
                    "Freshers reunion",
                    "people",
                    365 * year + rng.range(30, 60),
                    who,
                    Some("uni-freshers"),
                );
            }
            for _ in 0..4 {
                let who = rng.sample(people, 1);
                add("Video call", "video", rng.range(10, 400), who, None);
            }
        }
        "school" => {
            add(
                "10-year class reunion",
                "party",
                470,
                people.iter().collect(),
                Some("school-class"),
            );
        }
        "climbing" => {
            // Every week or so, with whoever has time
            let mut day = rng.range(2, 5);
            while day < 200 {
                let count = rng.range(1, 3) as usize;
                let who = rng.sample(people, count);
                add("Bouldering", "dumbbell", day, who, Some("climbing"));
                day += rng.range(5, 12);
            }
        }
        "neighbours" => {
            add(
                "Courtyard barbecue",
                "utensils",
                rng.range(60, 120),
                people.iter().collect(),
                Some("neighbours"),
            );
            for _ in 0..3 {
                let who = rng.sample(people, 1);
                add(
                    "Chat in the stairwell",
                    "message",
                    rng.range(3, 200),
                    who,
                    None,
                );
            }
        }
        "family" => {
            for year in 0..3 {
                add(
                    "Christmas at the grandparents'",
                    "gift",
                    365 * year + 300,
                    people.iter().collect(),
                    Some("family"),
                );
            }
        }
        _ => {}
    }
    activities
}

/// Unique full names from the lists above.
#[derive(Default)]
struct Names {
    used: Vec<String>,
}

impl Names {
    fn next(&mut self, rng: &mut Rng) -> String {
        loop {
            let name = format!("{} {}", rng.pick(FIRST_NAMES), rng.pick(LAST_NAMES));
            if !self.used.contains(&name) {
                self.used.push(name.clone());
                return name;
            }
        }
    }
}

/// SplitMix64 – tiny, good enough for demo data, and no dependency.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }

    /// Inclusive on both ends.
    fn range(&mut self, low: i64, high: i64) -> i64 {
        low + self.below((high - low + 1) as u64) as i64
    }

    fn chance(&mut self, percent: u64) -> bool {
        self.below(100) < percent
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len() as u64) as usize]
    }

    /// `count` different items, in random order.
    fn sample<'a, T>(&mut self, items: &'a [T], count: usize) -> Vec<&'a T> {
        let mut indices: Vec<usize> = (0..items.len()).collect();
        for i in 0..count.min(items.len()) {
            let j = i + self.below((items.len() - i) as u64) as usize;
            indices.swap(i, j);
        }
        indices.into_iter().take(count).map(|i| &items[i]).collect()
    }
}
