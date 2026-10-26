# Contributing

## Setup

You need Rust (stable) and Node.js 24.

```sh
# backend on http://localhost:3000
cd backend && cargo run

# frontend on http://localhost:5173, proxies /api to the backend
cd frontend && npm install && npm run dev
```

The backend builds without a database: the SQL queries are checked against the
query data committed in `backend/.sqlx/`. To run, it needs `DATABASE_URL`, e.g.
in `backend/.env`; at start it creates that database and runs the migrations:

```sh
DATABASE_URL=sqlite://teagan.db
```

`cargo demo` loads a demo account with realistic data. A server built with the
`demo` feature then offers "Try the demo" on the login screen and keeps the demo
account from changing its password or two-factor login – `DEMO_ACCOUNT_CHANGES=true`
allows it, e.g. to show the setup in a presentation.

To build the Docker image locally instead of pulling it:
`COMPOSE_FILE=compose.yaml:compose.build.yaml docker compose up -d --build`.

## Changing SQL queries or migrations

The `sqlx::query!` macros check every query at compile time. After changing a
query or adding a migration, update `backend/.sqlx/` against a database with the
current schema and commit it with your change:

```sh
cargo install sqlx-cli --no-default-features --features sqlite   # once
cd backend
sqlx migrate run   # brings the database of DATABASE_URL up to date
cargo sqlx prepare -- --all-targets --all-features
```

CI fails when `.sqlx/` doesn't match the queries.

While `DATABASE_URL` is set, the macros check against that database instead of
`.sqlx/` – a new migration has to be applied with `sqlx migrate run` before the
code compiles. `SQLX_OFFLINE=true` forces the committed data.

## Before opening a pull request

CI runs these, so run them locally first:

```sh
cd backend
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features

cd frontend
npm run lint
npm test
npm run build
```

Pull requests are squash-merged. Their titles follow
[Conventional Commits](https://www.conventionalcommits.org/), e.g.
`feat: offer more activity icons` or `ci: cache Rust dependencies`.
