-- Dates: truncated ISO 8601 text ('YYYY', 'YYYY-MM', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM'),
-- sorts as text. Timestamps: UTC, CURRENT_TIMESTAMP format.
-- Tenancy: dependent tables reference their parent via (owner_id, id), so no
-- row can link across users.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT    NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE user_totp (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret         TEXT    NOT NULL,                 -- base32
  confirmed_at   TEXT,                             -- NULL = setup not finished, TOTP off
  last_used_step INTEGER,                          -- replay protection
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recovery_codes (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT    NOT NULL,
  used_at   TEXT,
  PRIMARY KEY (user_id, code_hash)
);

-- Password passed, second factor pending
CREATE TABLE login_challenges (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL
);

CREATE TABLE people (
  id             INTEGER PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,
  nickname       TEXT,
  birthday       TEXT
                 CHECK (birthday IS NULL
                        OR birthday GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'
                        OR birthday GLOB '--[01][0-9]-[0-3][0-9]'    -- year unknown
                        OR birthday GLOB '[0-9][0-9][0-9][0-9]'),    -- year only
  birthday_note  TEXT,
  reconnect_days INTEGER CHECK (reconnect_days IS NULL OR reconnect_days > 0),
  impact         INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),   -- closeness, 5 = inner circle
  is_self        INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
  focus          INTEGER NOT NULL DEFAULT 0 CHECK (focus IN (0, 1)),
  deceased       INTEGER NOT NULL DEFAULT 0 CHECK (deceased IN (0, 1)),
  died_on        TEXT
                 CHECK (died_on IS NULL OR died_on GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  archived_at    TEXT,
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (NOT (is_self = 1 AND focus = 1)),
  CHECK (archived_at IS NULL OR is_self = 0),
  CHECK (deceased = 0 OR is_self = 0),
  CHECK (died_on IS NULL OR deceased = 1),
  CHECK (died_on IS NULL OR birthday IS NULL OR birthday GLOB '--*'
         OR substr(died_on, 1, length(birthday)) >= birthday),
  CHECK (birthday_note IS NULL OR (birthday IS NOT NULL AND trim(birthday_note) <> '')),
  UNIQUE (owner_id, id)                            -- target of the composite FKs
);

CREATE UNIQUE INDEX idx_people_self ON people(owner_id) WHERE is_self = 1;

-- Separate table, so BLOBs don't bloat scans of `people`
CREATE TABLE person_photos (
  owner_id   INTEGER NOT NULL,
  person_id  INTEGER NOT NULL PRIMARY KEY,
  hash       TEXT    NOT NULL,
  thumb      BLOB    NOT NULL CHECK (length(thumb) <= 50000),
  large      BLOB    NOT NULL CHECK (length(large) <= 200000),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (owner_id, person_id) REFERENCES people(owner_id, id) ON DELETE CASCADE
);

-- At most one level of subgroups (triggers below)
CREATE TABLE groups (
  id         INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  parent_id  INTEGER,
  archived_at TEXT,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, parent_id) REFERENCES groups(owner_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_groups_parent ON groups(owner_id, parent_id);

CREATE TRIGGER trg_groups_depth_insert
BEFORE INSERT ON groups
WHEN NEW.parent_id IS NOT NULL
 AND (SELECT parent_id FROM groups WHERE id = NEW.parent_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Subgroups cannot have subgroups.');
END;

CREATE TRIGGER trg_groups_depth_update
BEFORE UPDATE OF parent_id ON groups
WHEN NEW.parent_id IS NOT NULL
 AND (NEW.parent_id = NEW.id
      OR (SELECT parent_id FROM groups WHERE id = NEW.parent_id) IS NOT NULL
      OR EXISTS (SELECT 1 FROM groups WHERE parent_id = NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'Subgroups cannot have subgroups.');
END;

-- Membership in a subgroup implies one in its main group (kept by the service)
CREATE TABLE person_groups (
  owner_id   INTEGER NOT NULL,
  person_id  INTEGER NOT NULL,
  group_id   INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (person_id, group_id),
  FOREIGN KEY (owner_id, person_id)  REFERENCES people(owner_id, id)   ON DELETE CASCADE,
  FOREIGN KEY (owner_id, group_id)   REFERENCES groups(owner_id, id)   ON DELETE CASCADE
);

CREATE INDEX idx_pg_group  ON person_groups(owner_id, group_id);
CREATE INDEX idx_pg_person ON person_groups(owner_id, person_id);

-- Every activity has at least one person or group (kept by the service)
CREATE TABLE activities (
  id          INTEGER PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  icon        TEXT    NOT NULL DEFAULT 'star',   -- frontend icon key
  start_date  TEXT    NOT NULL
              CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]'
                  OR start_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'
                  OR start_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'
                  OR start_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]'),
  end_date    TEXT                               -- NULL = point event
              CHECK (end_date IS NULL
                  OR end_date GLOB '[0-9][0-9][0-9][0-9]'
                  OR end_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'
                  OR end_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  description TEXT,                              -- Markdown
  location    TEXT    CHECK (location IS NULL OR trim(location) <> ''),
  impact      INTEGER NOT NULL DEFAULT 2 CHECK (impact BETWEEN 1 AND 5),
  reminder    INTEGER NOT NULL DEFAULT 0 CHECK (reminder IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (owner_id, id),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (end_date IS NULL OR length(start_date) <= 10),
  CHECK (reminder = 0 OR length(start_date) >= 10)
);

CREATE INDEX idx_activities_start    ON activities(owner_id, start_date);
CREATE INDEX idx_activities_reminder ON activities(start_date) WHERE reminder = 1;

CREATE TABLE activity_people (
  owner_id    INTEGER NOT NULL,
  activity_id INTEGER NOT NULL,
  person_id   INTEGER NOT NULL,
  impact      INTEGER CHECK (impact IS NULL OR impact BETWEEN 1 AND 5), -- NULL = activity's impact
  note        TEXT    CHECK (note IS NULL OR trim(note) <> ''),
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (activity_id, person_id),
  FOREIGN KEY (owner_id, activity_id) REFERENCES activities(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, person_id)   REFERENCES people(owner_id, id)     ON DELETE CASCADE
);

CREATE INDEX idx_ap_activity ON activity_people(owner_id, activity_id);
CREATE INDEX idx_ap_person   ON activity_people(owner_id, person_id);

CREATE TABLE activity_groups (
  owner_id    INTEGER NOT NULL,
  activity_id INTEGER NOT NULL,
  group_id    INTEGER NOT NULL,
  impact      INTEGER CHECK (impact IS NULL OR impact BETWEEN 1 AND 5), -- NULL = activity's impact
  note        TEXT    CHECK (note IS NULL OR trim(note) <> ''),
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (activity_id, group_id),
  FOREIGN KEY (owner_id, activity_id) REFERENCES activities(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, group_id)    REFERENCES groups(owner_id, id)     ON DELETE CASCADE
);

CREATE INDEX idx_ag_activity ON activity_groups(owner_id, activity_id);
CREATE INDEX idx_ag_group    ON activity_groups(owner_id, group_id);

CREATE TABLE open_points (
  id          INTEGER PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  person_id   INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  activity_id INTEGER,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  done_at     TEXT,

  FOREIGN KEY (owner_id, person_id)   REFERENCES people(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, activity_id) REFERENCES activities(owner_id, id)
);

CREATE INDEX idx_points_person   ON open_points(owner_id, person_id);
CREATE INDEX idx_points_open     ON open_points(owner_id, person_id) WHERE done_at IS NULL;
CREATE INDEX idx_points_activity ON open_points(owner_id, activity_id);

-- ON DELETE SET NULL would also null owner_id in the composite FK
CREATE TRIGGER trg_activities_unlink_points
BEFORE DELETE ON activities
BEGIN
  UPDATE open_points
     SET activity_id = NULL
   WHERE owner_id = OLD.owner_id AND activity_id = OLD.id;
END;

CREATE TABLE facts (
  id         INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL,
  person_id  INTEGER NOT NULL,
  label      TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (owner_id, person_id) REFERENCES people(owner_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_facts_person ON facts(owner_id, person_id, sort);

-- Instance-wide, not per user (e.g. last reminder run)
CREATE TABLE app_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
