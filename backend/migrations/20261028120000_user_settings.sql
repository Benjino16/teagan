-- Account-wide settings as one JSON object. Only what the user changed is
-- stored; the backend fills in the defaults (`domain/settings.rs`), so a new
-- setting needs no migration and a changed default reaches everyone who kept it.
ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'
  CHECK (json_valid(settings) AND json_type(settings) = 'object');
