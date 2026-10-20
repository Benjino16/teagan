# Teagan

[![CI](https://github.com/Benjino16/teagan/actions/workflows/ci.yml/badge.svg)](https://github.com/Benjino16/teagan/actions/workflows/ci.yml)

A simple, self-hosted personal relationship manager: people, groups, facts, activities and open points.
Mobile-first, with a clean, modern UI.
Rust backend (axum, SQLite) with an embedded React frontend. One binary, one database file.

> **Status:** early pre-release (0.x). Expect breaking changes between versions.

## Run

```sh
docker compose up -d
```

The app runs on <http://localhost:3000>. On the first visit it asks you to create an account.
Alternatively create accounts on the command line:

```sh
docker compose exec teagan teagan user create <username>
```

Images are published to `ghcr.io/benjino16/teagan`. Pin a version (e.g. `:0.1.0`) instead of `:latest`
to decide yourself when to update.

All data lives in one SQLite file, `/data/teagan.db`, in the `data` volume – back up that volume.

## Configuration

Every option is an environment variable (or a command-line flag, see `teagan --help`).

| Variable           | Default                    | Description                                                              |
| ------------------ | -------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`     | `sqlite:///data/teagan.db` | SQLite database (default in the Docker image)                            |
| `PORT`             | `3000`                     | Port to listen on                                                        |
| `SECURE_COOKIES`   | `false`                    | Send the login cookie only over HTTPS. Turn on behind an HTTPS proxy     |
| `INITIAL_USERNAME` | –                          | Creates the first account at start instead of the setup in the browser   |
| `INITIAL_PASSWORD` | –                          | Password for `INITIAL_USERNAME`. Both are ignored once an account exists |

## Development

```sh
# backend (needs DATABASE_URL, e.g. in .env)
cd backend && cargo run

# frontend, proxies /api to localhost:3000
cd frontend && npm install && npm run dev
```

`cargo demo` loads a demo account with realistic data.

To build the Docker image locally instead of pulling it: `COMPOSE_FILE=compose.yaml:compose.build.yaml docker compose up -d --build`.

## License

Copyright (C) 2026 Benjino16

Teagan is free software, licensed under the GNU Affero General Public License v3.0 or later.
See [LICENSE](LICENSE).
