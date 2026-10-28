use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use validator::{Validate, ValidationError};

use crate::error::{AppError, AppResult};

/// Account-wide settings. Stored as JSON holding only what the user changed
/// (`users.settings`): a missing key gets its default here, a key no longer
/// known is ignored – adding or dropping a setting needs no migration.
#[derive(Serialize, Deserialize, Validate, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// ISO 4217 code the money amounts are shown in – a label only, the
    /// amounts stay as they are (see `ledger_entries`).
    #[validate(custom(function = "validate_currency"))]
    pub currency: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            currency: "EUR".to_string(),
        }
    }
}

impl Settings {
    /// From the JSON in the database, defaults filled in.
    pub fn from_stored(json: &str) -> serde_json::Result<Self> {
        serde_json::from_str(json)
    }

    /// From the stored JSON after a patch was merged in: `Invalid` if the
    /// patch gave a setting a value it can't have.
    pub fn from_patched(json: &str) -> AppResult<Self> {
        // Via `Value`, so the message has no line and column of a JSON the client never saw
        let value: Value =
            serde_json::from_str(json).map_err(|err| AppError::Internal(err.into()))?;
        let settings: Self =
            serde_json::from_value(value).map_err(|err| AppError::Invalid(err.to_string()))?;
        settings.validate()?;
        Ok(settings)
    }
}

/// A change as JSON merge patch (RFC 7396): a key with a value sets it,
/// `null` resets it to the default, keys left out stay as they are.
#[derive(Deserialize)]
pub struct SettingsPatch(Map<String, Value>);

impl SettingsPatch {
    /// The patch for `json_patch()`. `Invalid` for keys `Settings` doesn't
    /// know – a typo would otherwise be stored and silently ignored.
    pub fn checked_json(&self) -> AppResult<String> {
        let Ok(Value::Object(known)) = serde_json::to_value(Settings::default()) else {
            unreachable!("settings serialize to an object");
        };
        let mut unknown: Vec<String> = self
            .0
            .keys()
            .filter(|key| !known.contains_key(*key))
            .map(|key| format!("{key}: unknown"))
            .collect();
        if !unknown.is_empty() {
            unknown.sort();
            return Err(AppError::Invalid(unknown.join("; ")));
        }
        Ok(Value::Object(self.0.clone()).to_string())
    }
}

/// Only the shape of an ISO 4217 code, `EUR`: which codes exist is up to the
/// frontend's list – the backend never formats money.
fn validate_currency(value: &str) -> Result<(), ValidationError> {
    if value.len() == 3 && value.bytes().all(|b| b.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(ValidationError::new("format"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn patch(value: Value) -> SettingsPatch {
        serde_json::from_value(value).unwrap()
    }

    fn invalid_message(result: AppResult<impl std::fmt::Debug>) -> String {
        match result {
            Err(AppError::Invalid(message)) => message,
            other => panic!("expected Invalid, got {other:?}"),
        }
    }

    // --- stored JSON ---------------------------------------------------------

    #[test]
    fn missing_keys_get_their_default() {
        assert_eq!(Settings::from_stored("{}").unwrap(), Settings::default());
    }

    #[test]
    fn keys_no_longer_known_are_ignored() {
        let settings = Settings::from_stored(r#"{"currency":"CHF","gone":true}"#).unwrap();
        assert_eq!(settings.currency, "CHF");
    }

    // --- patch ---------------------------------------------------------------

    #[test]
    fn known_keys_pass_as_json() {
        let json = patch(json!({ "currency": "USD" })).checked_json().unwrap();
        assert_eq!(json, r#"{"currency":"USD"}"#);
        let json = patch(json!({ "currency": null })).checked_json().unwrap();
        assert_eq!(json, r#"{"currency":null}"#);
    }

    #[test]
    fn unknown_keys_are_rejected() {
        let result =
            patch(json!({ "zeta": 1, "currency": "USD", "curency": "USD" })).checked_json();
        assert_eq!(invalid_message(result), "curency: unknown; zeta: unknown");
    }

    #[test]
    fn patched_value_must_fit_the_setting() {
        assert_eq!(
            Settings::from_patched(r#"{"currency":"JPY"}"#)
                .unwrap()
                .currency,
            "JPY"
        );
        for json in [
            r#"{"currency":"eur"}"#,
            r#"{"currency":"EURO"}"#,
            r#"{"currency":"€"}"#,
            r#"{"currency":""}"#,
        ] {
            assert_eq!(
                invalid_message(Settings::from_patched(json)),
                "currency: format",
                "{json}"
            );
        }
        let message = invalid_message(Settings::from_patched(r#"{"currency":5}"#));
        assert!(message.starts_with("invalid type"), "{message}");
    }

    // --- JSON contract with the frontend -------------------------------------

    #[test]
    fn settings_are_written_in_camel_case() {
        assert_eq!(
            serde_json::to_value(Settings::default()).unwrap(),
            json!({ "currency": "EUR" })
        );
    }
}
