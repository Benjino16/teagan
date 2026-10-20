//! Account management from the command line. There are no admin roles in the
//! app, so this is the way to add users, and the way back in when a password
//! or the authenticator is lost.

use anyhow::{Context, bail};
use clap::Subcommand;
use sqlx::SqlitePool;
use validator::Validate;

use crate::{
    db,
    domain::{NewUserInput, PasswordInput, hash_password, validate_username},
    error::AppError,
};

#[derive(Subcommand)]
pub enum UserCommand {
    /// Create a user; asks for the password
    Create {
        username: String,
        /// Name of the user's own person, defaults to the username
        #[arg(long)]
        name: Option<String>,
    },
    /// List all users
    List,
    /// Set a new password; ends all sessions of the user
    ResetPassword { username: String },
    /// Turn off two-factor login, e.g. after losing the phone
    DisableTotp { username: String },
}

pub async fn run(pool: &SqlitePool, command: UserCommand) -> anyhow::Result<()> {
    match command {
        UserCommand::Create { username, name } => {
            // Checked before asking for a password, so a typo fails right away
            let username = username.trim().to_lowercase();
            if validate_username(&username).is_err() {
                bail!("invalid username – letters, digits, `.`, `_` and `-` only, at most 64");
            }
            if db::users::exists(pool, &username).await? {
                bail!("user \"{username}\" already exists");
            }

            let mut input = NewUserInput {
                name: name.unwrap_or_else(|| username.clone()),
                username,
                password: prompt_new_password()?,
            };
            input.normalize();
            input.validate().map_err(invalid)?;

            let hash = hash_password(&input.password)?;
            match db::users::create(pool, &input.username, &hash, &input.name).await {
                Ok(_) => println!("created user \"{}\"", input.username),
                // Someone else was faster since the check above
                Err(err) if is_unique_violation(&err) => {
                    bail!("user \"{}\" already exists", input.username)
                }
                Err(err) => return Err(err.into()),
            }
        }
        UserCommand::List => {
            let users = db::users::list(pool).await?;
            if users.is_empty() {
                println!("no users yet");
            }
            for user in users {
                let totp = if user.totp_enabled {
                    "TOTP on"
                } else {
                    "TOTP off"
                };
                println!(
                    "{:<24} {:<9} created {}",
                    user.username,
                    totp,
                    user.created_at.format("%Y-%m-%d")
                );
            }
        }
        UserCommand::ResetPassword { username } => {
            let username = username.trim().to_lowercase();
            ensure_user_exists(pool, &username).await?;
            let input = PasswordInput {
                password: prompt_new_password()?,
            };
            input.validate().map_err(invalid)?;

            let hash = hash_password(&input.password)?;
            db::users::set_password(pool, &username, &hash).await?;
            println!("new password set for \"{username}\", all sessions ended");
        }
        UserCommand::DisableTotp { username } => {
            let username = username.trim().to_lowercase();
            ensure_user_exists(pool, &username).await?;
            if db::users::disable_totp(pool, &username).await? {
                println!("two-factor login turned off for \"{username}\"");
            } else {
                println!("\"{username}\" had no two-factor login");
            }
        }
    }
    Ok(())
}

/// Checked before asking for a password, so a typo fails right away.
async fn ensure_user_exists(pool: &SqlitePool, username: &str) -> anyhow::Result<()> {
    if !db::users::exists(pool, username).await? {
        bail!("no user \"{username}\" – see `teagan user list`");
    }
    Ok(())
}

fn prompt_new_password() -> anyhow::Result<String> {
    // Fails without a terminal, e.g. `docker exec` without `-it`
    let password = rpassword::prompt_password("Password: ").context("cannot read password")?;
    let repeated =
        rpassword::prompt_password("Repeat password: ").context("cannot read password")?;
    if password != repeated {
        bail!("passwords do not match");
    }
    Ok(password)
}

/// Same wording as the API's validation errors, e.g. `password: length`.
pub fn invalid(errors: validator::ValidationErrors) -> anyhow::Error {
    match AppError::from(errors) {
        AppError::Invalid(message) => anyhow::anyhow!("invalid input: {message}"),
        other => anyhow::anyhow!("{other:?}"),
    }
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    err.as_database_error()
        .is_some_and(|err| err.is_unique_violation())
}
