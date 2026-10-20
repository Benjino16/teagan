FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM rust:1-bookworm AS backend
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3
WORKDIR /app/backend
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN cat migrations/*.sql | sqlite3 /tmp/build.db
ENV DATABASE_URL=sqlite:///tmp/build.db
# `--build-arg FEATURES=demo` for dev stages: adds `teagan demo load`.
# Never for published release images – the demo account has a public password.
ARG FEATURES=""
RUN cargo build --release --features "$FEATURES"

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 teagan \
    && mkdir /data && chown teagan:teagan /data
COPY --from=backend /app/backend/target/release/teagan /usr/local/bin/teagan
USER teagan
ENV DATABASE_URL=sqlite:///data/teagan.db
EXPOSE 3000
CMD ["teagan"]
