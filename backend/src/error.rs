/// Errors that can occur while handling a request.
///
/// Deliberately independent of HTTP: how they are turned into a response
/// (status code, JSON body) lives in `http/error.rs`.
#[derive(Debug)]
pub enum AppError {
    /// The resource does not exist – or belongs to another user.
    NotFound,
    /// No valid session – not logged in, or the session has expired.
    Unauthorized,
    /// The input violates a rule. The message is sent to the client.
    Invalid(String),
    /// Too many failed logins; may try again after this long.
    TooManyAttempts(std::time::Duration),
    /// Anything unexpected. Gets logged, the client receives no details.
    Internal(anyhow::Error),
}

/// Shorthand for functions that can fail with an `AppError`.
pub type AppResult<T> = Result<T, AppError>;

/// Enables `?` on sqlx results.
impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => Self::NotFound,
            other => Self::Internal(other.into()),
        }
    }
}

/// Enables `?` on `validate()`. A failed validation is always the client's
/// fault, so it becomes `Invalid`, e.g. `"label: length; value: length"`.
/// Nested structs and lists get a path (`participants[0].impact: range`);
/// struct-level rules carry their field in the message themselves.
impl From<validator::ValidationErrors> for AppError {
    fn from(errors: validator::ValidationErrors) -> Self {
        let mut messages = Vec::new();
        collect_messages(&errors, "", &mut messages);
        // HashMap order is random – sort for stable messages
        messages.sort();
        Self::Invalid(messages.join("; "))
    }
}

fn collect_messages(
    errors: &validator::ValidationErrors,
    prefix: &str,
    messages: &mut Vec<String>,
) {
    use validator::ValidationErrorsKind;

    for (field, kind) in errors.errors() {
        let path = match field.as_ref() {
            "__all__" => prefix.to_string(),
            field if prefix.is_empty() => field.to_string(),
            field => format!("{prefix}.{field}"),
        };
        match kind {
            ValidationErrorsKind::Field(errs) => {
                for err in errs {
                    let reason = err.message.as_ref().unwrap_or(&err.code);
                    messages.push(if path.is_empty() {
                        reason.to_string()
                    } else {
                        format!("{path}: {reason}")
                    });
                }
            }
            ValidationErrorsKind::Struct(inner) => collect_messages(inner, &path, messages),
            ValidationErrorsKind::List(items) => {
                for (index, inner) in items {
                    collect_messages(inner, &format!("{path}[{index}]"), messages);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::{Validate, ValidationError, ValidationErrors};

    fn message(errors: ValidationErrors) -> String {
        match AppError::from(errors) {
            AppError::Invalid(message) => message,
            other => panic!("expected Invalid, got {other:?}"),
        }
    }

    #[test]
    fn field_errors_are_sorted_and_joined() {
        let mut errors = ValidationErrors::new();
        errors.add("value", ValidationError::new("length"));
        errors.add("label", ValidationError::new("length"));
        assert_eq!(message(errors), "label: length; value: length");
    }

    #[test]
    fn custom_message_wins_over_code() {
        let mut errors = ValidationErrors::new();
        errors.add(
            "name",
            ValidationError::new("length").with_message("too long".into()),
        );
        assert_eq!(message(errors), "name: too long");
    }

    #[test]
    fn struct_level_rule_shows_only_its_message() {
        let mut errors = ValidationErrors::new();
        errors.add(
            "__all__",
            ValidationError::new("x").with_message("end_date: before start_date".into()),
        );
        assert_eq!(message(errors), "end_date: before start_date");
    }

    #[derive(Validate)]
    struct Outer {
        #[validate(nested)]
        items: Vec<Inner>,
        #[validate(nested)]
        single: Inner,
    }

    #[derive(Validate)]
    struct Inner {
        #[validate(range(min = 1))]
        count: i64,
    }

    #[test]
    fn nested_errors_get_a_path() {
        let outer = Outer {
            items: vec![Inner { count: 1 }, Inner { count: 0 }],
            single: Inner { count: 0 },
        };
        let errors = outer.validate().expect_err("should be invalid");
        assert_eq!(
            message(errors),
            "items[1].count: range; single.count: range"
        );
    }
}
