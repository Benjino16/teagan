use std::sync::LazyLock;

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash},
};
use serde::Deserialize;
use validator::{Validate, ValidationError};

/// A new account: the login plus the name of the user's own person.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct NewUserInput {
    #[validate(custom(function = "validate_username"))]
    pub username: String,
    #[validate(length(min = 8, max = 1024))]
    pub password: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
}

impl NewUserInput {
    /// Usernames are case-insensitive, so they are stored in lower case.
    /// The password stays exactly as typed.
    pub fn normalize(&mut self) {
        self.username = self.username.trim().to_lowercase();
        self.name = self.name.trim().to_string();
    }
}

/// Not validated: a wrong login just doesn't match.
#[derive(Deserialize)]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

impl LoginInput {
    /// Same as when the user was created.
    pub fn normalize(&mut self) {
        self.username = self.username.trim().to_lowercase();
    }
}

/// Changing the password in the app.
#[derive(Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordInput {
    pub current_password: String,
    #[validate(length(min = 8, max = 1024))]
    pub new_password: String,
}

/// A new password for an existing account.
#[derive(Validate)]
pub struct PasswordInput {
    #[validate(length(min = 8, max = 1024))]
    pub password: String,
}

/// Letters, digits and `.`, `_`, `-` – no spaces, so a username can be typed
/// on the command line without quoting.
pub fn validate_username(value: &str) -> Result<(), ValidationError> {
    let allowed = |c: char| c.is_alphanumeric() || matches!(c, '.' | '_' | '-');
    if value.is_empty() || value.chars().count() > 64 {
        Err(ValidationError::new("length").with_message("1 to 64 characters".into()))
    } else if !value.chars().all(allowed) {
        Err(ValidationError::new("format")
            .with_message("only letters, digits, dot, dash and underscore".into()))
    } else {
        Ok(())
    }
}

/// Argon2id with the crate's defaults (19 MiB, 2 passes) as a PHC string,
/// salt included. Takes about 50 ms of CPU – the server must call it via
/// `spawn_blocking`.
pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|err| anyhow::anyhow!("cannot hash password: {err}"))?;
    Ok(hash.to_string())
}

/// Checked against when the username does not exist, so the answer takes
/// as long as for a wrong password and does not reveal which usernames exist.
static DUMMY_HASH: LazyLock<String> =
    LazyLock::new(|| hash_password("no user has this").expect("hashing a constant works"));

/// Whether the password matches the stored hash; `None` = no such user,
/// always `false`, but just as slow. Same CPU cost as `hash_password`.
pub fn verify_password(password: &str, hash: Option<&str>) -> bool {
    let matches = |hash: &str| {
        PasswordHash::new(hash).is_ok_and(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
    };
    match hash {
        Some(hash) => matches(hash),
        None => {
            matches(&DUMMY_HASH);
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn username_allows_letters_digits_and_some_punctuation() {
        assert!(validate_username("ben").is_ok());
        assert!(validate_username("jörg.m_2-x").is_ok());
        assert!(validate_username("").is_err());
        assert!(validate_username("ben b").is_err());
        assert!(validate_username("ben@home").is_err());
        assert!(validate_username(&"a".repeat(65)).is_err());
    }

    #[test]
    fn normalize_lowercases_username_but_keeps_password() {
        let mut input = NewUserInput {
            username: "  Ben ".into(),
            password: " Secret ".into(),
            name: " Ben ".into(),
        };
        input.normalize();
        assert_eq!(input.username, "ben");
        assert_eq!(input.password, " Secret ");
        assert_eq!(input.name, "Ben");
    }

    #[test]
    fn hash_is_argon2id_with_random_salt() {
        let first = hash_password("correct horse").unwrap();
        let second = hash_password("correct horse").unwrap();
        assert!(first.starts_with("$argon2id$"));
        assert_ne!(first, second);
    }

    #[test]
    fn verify_accepts_only_the_right_password() {
        let hash = hash_password("correct horse").unwrap();
        assert!(verify_password("correct horse", Some(&hash)));
        assert!(!verify_password("correct horsE", Some(&hash)));
        assert!(!verify_password("correct horse", Some("not-a-real-hash")));
        assert!(!verify_password("no user has this", None));
    }
}
