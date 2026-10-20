use chrono::{NaiveDate, NaiveDateTime};

/// Truncated ISO 8601 date (DB schema): `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
/// The length is the precision.
pub fn is_partial_date(value: &str) -> bool {
    if has_shape(value, "9999-99-99") {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
    } else if has_shape(value, "9999-99") {
        NaiveDate::parse_from_str(&format!("{value}-01"), "%Y-%m-%d").is_ok()
    } else {
        has_shape(value, "9999")
    }
}

/// Like `is_partial_date`, plus a full date with a local time `YYYY-MM-DDTHH:MM`
/// (only the start of point events has one).
pub fn is_partial_date_time(value: &str) -> bool {
    if has_shape(value, "9999-99-99T99:99") {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M").is_ok()
    } else {
        is_partial_date(value)
    }
}

/// `9` in `shape` stands for any ASCII digit, every other byte must match exactly.
///
/// chrono alone is too lenient (it accepts `2026-1-01` or `+200-01-01`), and the
/// CHECK constraints in the DB would then fail with a 500.
pub fn has_shape(value: &str, shape: &str) -> bool {
    value.len() == shape.len()
        && value.bytes().zip(shape.bytes()).all(|(v, s)| match s {
            b'9' => v.is_ascii_digit(),
            _ => v == s,
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- is_partial_date -----------------------------------------------------

    #[test]
    fn partial_date_accepts_all_precisions() {
        for value in ["2026", "2026-03", "2026-03-12", "2000-02-29"] {
            assert!(is_partial_date(value), "should accept {value}");
        }
    }

    #[test]
    fn partial_date_rejects_dates_that_do_not_exist() {
        for value in [
            "2026-00",
            "2026-13",
            "2026-02-30",
            "2001-02-29",
            "2026-03-00",
        ] {
            assert!(!is_partial_date(value), "should reject {value}");
        }
    }

    #[test]
    fn partial_date_rejects_wrong_shape() {
        for value in [
            "",
            "99",
            "2026-3",
            "2026-03-1",
            "+200-01-01",
            "12.03.2026",
            "--03-12",
            "2026-03-12T10:00",
        ] {
            assert!(!is_partial_date(value), "should reject {value:?}");
        }
    }

    // --- is_partial_date_time ------------------------------------------------

    #[test]
    fn partial_date_time_accepts_time_and_all_date_precisions() {
        for value in [
            "2026-10-13T20:00",
            "2026-10-13T00:00",
            "2026-10-13T23:59",
            "2026",
            "2026-10",
            "2026-10-13",
        ] {
            assert!(is_partial_date_time(value), "should accept {value}");
        }
    }

    #[test]
    fn partial_date_time_rejects_invalid_times() {
        for value in [
            "2026-10-13T24:00",
            "2026-10-13T12:60",
            "2026-10-13T8:00",
            "2026-10-13 20:00",
            "2026-10-13T20:00:00",
            "2026-10T20:00",
            "2026-02-30T10:00",
        ] {
            assert!(!is_partial_date_time(value), "should reject {value:?}");
        }
    }

    // --- has_shape -----------------------------------------------------------

    #[test]
    fn has_shape_matches_digits_and_literals() {
        assert!(has_shape("2026-03-12", "9999-99-99"));
        assert!(has_shape("--03-12", "--99-99"));
        assert!(has_shape("", ""));
    }

    #[test]
    fn has_shape_rejects_other_lengths_and_characters() {
        assert!(!has_shape("2026-03-1", "9999-99-99"));
        assert!(!has_shape("2026-03-123", "9999-99-99"));
        assert!(!has_shape("2026/03/12", "9999-99-99"));
        assert!(!has_shape("20a6", "9999"));
        // non-ASCII digits like the Arabic-Indic ٢ do not count
        assert!(!has_shape("٢٠٢٦", "9999"));
    }
}
