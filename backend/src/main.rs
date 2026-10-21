mod cli;
mod db;
#[cfg(feature = "demo")]
mod demo;
mod domain;
mod error;
mod http;

use anyhow::{Context, bail};
use clap::{Parser, Subcommand};
use sqlx::SqlitePool;
use validator::Validate;

use crate::{
    domain::{NewUserInput, hash_password},
    http::AppState,
};

/// Teagan – personal relationship manager backend.
///
/// Without a command it runs the server. Every option can also be set as an
/// environment variable (or in `.env`); a command-line argument wins over
/// the environment.
#[derive(Parser)]
#[command(version)]
struct Config {
    #[command(subcommand)]
    command: Option<Command>,

    /// SQLite database, e.g. `sqlite://teagan.db`
    #[arg(long, env = "DATABASE_URL")]
    database_url: String,

    /// Port to listen on (all interfaces)
    #[arg(long, env = "PORT", default_value_t = 3000)]
    port: u16,

    /// Send the login cookie only over HTTPS. Turn on when the app is
    /// reached via HTTPS only, e.g. behind a reverse proxy.
    #[arg(long, env = "SECURE_COOKIES")]
    secure_cookies: bool,

    /// Creates the first account at start, instead of the setup in the
    /// browser. Ignored once any account exists.
    #[arg(long, env = "INITIAL_USERNAME")]
    initial_username: Option<String>,

    /// Password for `INITIAL_USERNAME`. Better set as environment variable –
    /// command-line arguments show up in the process list.
    #[arg(long, env = "INITIAL_PASSWORD", hide_env_values = true)]
    initial_password: Option<String>,

    #[cfg(feature = "demo")]
    #[command(flatten)]
    demo: demo::DemoConfig,
}

#[derive(Subcommand)]
enum Command {
    /// Manage user accounts
    #[command(subcommand)]
    User(cli::UserCommand),
    /// Demo account with realistic data (only in builds with the `demo` feature)
    #[cfg(feature = "demo")]
    #[command(subcommand)]
    Demo(demo::DemoCommand),
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // .env is optional; on a server the variables come straight from the environment.
    // Must run before parsing so clap sees the values from .env.
    dotenvy::dotenv().ok();
    let config = Config::parse();

    let pool = db::connect(&config.database_url).await?;
    sqlx::migrate!().run(&pool).await?;

    match config.command {
        Some(Command::User(command)) => cli::run(&pool, command).await,
        #[cfg(feature = "demo")]
        Some(Command::Demo(command)) => demo::run(&pool, command).await,
        None => serve(pool, config).await,
    }
}

async fn serve(pool: SqlitePool, config: Config) -> anyhow::Result<()> {
    println!("connected to db");

    create_initial_user(&pool, config.initial_username, config.initial_password).await?;
    if !db::users::any_exist(&pool).await? {
        println!("no account yet – open the app in the browser to create the first one");
    }

    let state = AppState::new(pool, config.secure_cookies);
    let router = http::router(state.clone());
    #[cfg(feature = "demo")]
    let router = demo::extend(router, state, &config.demo);
    let address = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .with_context(|| format!("cannot listen on {address} – is the port already in use?"))?;
    println!("listening on {address}");
    // The client address is needed for the login limit
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}

/// `INITIAL_USERNAME` + `INITIAL_PASSWORD`. Only while there is no
/// account at all, so it never overwrites a password.
async fn create_initial_user(
    pool: &SqlitePool,
    username: Option<String>,
    password: Option<String>,
) -> anyhow::Result<()> {
    let (username, password) = match (username, password) {
        (Some(username), Some(password)) => (username, password),
        (None, None) => return Ok(()),
        _ => bail!("INITIAL_USERNAME and INITIAL_PASSWORD only work together"),
    };
    if db::users::any_exist(pool).await? {
        return Ok(());
    }

    let mut input = NewUserInput {
        name: username.trim().to_string(),
        username,
        password,
    };
    input.normalize();
    input
        .validate()
        .map_err(cli::invalid)
        .context("INITIAL_USERNAME / INITIAL_PASSWORD")?;

    let hash = hash_password(&input.password)?;
    if db::users::create_first(pool, &input.username, &hash, &input.name)
        .await?
        .is_some()
    {
        println!(
            "created the first account \"{}\" from INITIAL_USERNAME",
            input.username
        );
    }
    Ok(())
}
