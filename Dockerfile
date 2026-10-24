FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# cargo-chef splits the Rust build in two: the dependencies are compiled in
# their own layer, which stays cached as long as Cargo.toml and Cargo.lock
# don't change. https://github.com/LukeMathWalker/cargo-chef
FROM lukemathwalker/cargo-chef:latest-rust-1-bookworm AS chef
WORKDIR /app/backend

FROM chef AS planner
COPY backend/ ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS backend
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3
# `--build-arg FEATURES=demo` for dev stages: adds `teagan demo load`.
# Never for published release images – the demo account has a public password.
ARG FEATURES=""
COPY --from=planner /app/backend/recipe.json recipe.json
# Same profile and features as the build below, or the cached dependencies
# don't match and get compiled again
RUN cargo chef cook --release --features "$FEATURES" --recipe-path recipe.json
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN cat migrations/*.sql | sqlite3 /tmp/build.db
ENV DATABASE_URL=sqlite:///tmp/build.db
RUN cargo build --release --features "$FEATURES"

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 teagan \
    && mkdir /data && chown teagan:teagan /data
COPY --from=backend /app/backend/target/release/teagan /usr/local/bin/teagan
USER teagan
ENV DATABASE_URL=sqlite:///data/teagan.db
EXPOSE 3000
CMD ["teagan"]
