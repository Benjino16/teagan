//! A demo account whose data looks like months of real use – for dev stages
//! and presentations, loaded again whenever needed. Only built with the
//! `demo` feature (see Cargo.toml), never part of a release.
//!
//! ```text
//! demo/data.toml ──┐
//!                  ├─► Dataset ─► seed ─► API router (in-process) ─► DB
//! generate ────────┘
//! ```
//!
//! - Everything goes through the HTTP handlers, just like the frontend's
//!   requests. The demo data obeys every rule the app enforces, and a rule
//!   added later applies to it without touching this module.
//! - Dates are relative to today (`data::resolve_date`), so the account never
//!   looks abandoned: someone is always overdue, a birthday always comes up.
//! - `data.toml` holds the hand-written core (the close people and their
//!   stories), `generate` adds the bulk of loose acquaintances. Both produce
//!   the same `Dataset`, so there is only one way into the database.
//! - A running demo build also offers the login and guards the account,
//!   see `server`.

mod api;
mod data;
mod generate;
mod seed;
mod server;

pub use server::{DemoConfig, extend};

use anyhow::{Context, bail};
use chrono::Local;
use clap::Subcommand;
use sqlx::SqlitePool;
use validator::Validate;

use crate::{
    db,
    domain::{NewUserInput, hash_password, hash_token, new_token},
};

pub const USERNAME: &str = "demo";
pub const PASSWORD: &str = "teagan-demo";

#[derive(Subcommand)]
pub enum DemoCommand {
    /// Create the `demo` account with its data
    Load {
        /// Delete an existing `demo` account first, with all its data
        #[arg(long)]
        reset: bool,
    },
}

pub async fn run(pool: &SqlitePool, command: DemoCommand) -> anyhow::Result<()> {
    let DemoCommand::Load { reset } = command;

    if db::users::exists(pool, USERNAME).await? {
        if !reset {
            bail!("user \"{USERNAME}\" already exists – use --reset to load the demo again");
        }
        delete_user(pool).await?;
    }

    let mut dataset = data::load()?;
    generate::extend(&mut dataset);

    let user_id = create_user(pool, &dataset.me.name).await?;
    let token = new_token()?;
    db::sessions::create(pool, user_id, &hash_token(&token)).await?;

    let today = Local::now().date_naive();
    let api = api::Api::new(pool.clone(), &token);
    match seed::run(&api, &dataset, today).await {
        Ok(summary) => {
            // The session was only for the seeding; the demo logs in like anyone else
            db::sessions::delete(pool, &hash_token(&token)).await?;
            println!("loaded demo account \"{USERNAME}\" (password \"{PASSWORD}\"): {summary}");
            Ok(())
        }
        Err(err) => {
            // No half-filled account: the cascade takes everything seeded so far
            delete_user(pool)
                .await
                .context("could not remove the half-loaded demo account")?;
            Err(err.context("loading the demo failed, nothing was kept"))
        }
    }
}

async fn create_user(pool: &SqlitePool, name: &str) -> anyhow::Result<i64> {
    let mut input = NewUserInput {
        username: USERNAME.to_string(),
        password: PASSWORD.to_string(),
        name: name.to_string(),
    };
    input.normalize();
    input.validate().context("demo user is invalid")?;
    let hash = hash_password(&input.password)?;
    Ok(db::users::create(pool, &input.username, &hash, &input.name).await?)
}

/// Everything of the user goes with it via `ON DELETE CASCADE`.
async fn delete_user(pool: &SqlitePool) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM users WHERE username = ?", USERNAME)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn count(pool: &SqlitePool, sql: &'static str) -> i64 {
        sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
    }

    /// The whole dataset through the real API – breaks when a rule changes
    /// that the demo data no longer meets.
    #[sqlx::test]
    async fn loads_and_reloads(pool: SqlitePool) {
        run(&pool, DemoCommand::Load { reset: false })
            .await
            .unwrap();
        let people = count(&pool, "SELECT COUNT(*) FROM people").await;
        assert!(people > 30, "only {people} people");
        assert!(
            count(&pool, "SELECT COUNT(*) FROM ledger_entries").await > 0,
            "no money"
        );
        assert_eq!(
            count(&pool, "SELECT COUNT(*) FROM sessions").await,
            0,
            "the seeding session stays behind"
        );

        let again = run(&pool, DemoCommand::Load { reset: false }).await;
        assert!(again.is_err(), "loads over an existing demo account");

        run(&pool, DemoCommand::Load { reset: true }).await.unwrap();
        assert_eq!(count(&pool, "SELECT COUNT(*) FROM users").await, 1);
        assert_eq!(count(&pool, "SELECT COUNT(*) FROM people").await, people);
    }

    #[sqlx::test]
    async fn reset_leaves_other_accounts_alone(pool: SqlitePool) {
        db::users::create(&pool, "ben", "unused", "Ben")
            .await
            .unwrap();
        run(&pool, DemoCommand::Load { reset: false })
            .await
            .unwrap();
        run(&pool, DemoCommand::Load { reset: true }).await.unwrap();
        assert!(db::users::exists(&pool, "ben").await.unwrap());
        assert_eq!(count(&pool, "SELECT COUNT(*) FROM users").await, 2);
    }
}
