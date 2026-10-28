-- Money between the user and one person. Sign is the user's own perspective:
-- negative = I paid / gave money (for them), positive = they paid / gave money (to me).
-- Balance = SUM(amount_cents): < 0 means they owe me, > 0 means I owe them.
-- Always hundredths of the display currency, so switching it only relabels.
CREATE TABLE ledger_entries (
  id           INTEGER PRIMARY KEY,
  owner_id     INTEGER NOT NULL,
  person_id    INTEGER NOT NULL,                -- never the self person (kept by the service)
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  date         TEXT    NOT NULL
               CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  note         TEXT    CHECK (note IS NULL OR trim(note) <> ''),
  activity_id  INTEGER,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (owner_id, person_id)   REFERENCES people(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, activity_id) REFERENCES activities(owner_id, id)
);

CREATE INDEX idx_ledger_person   ON ledger_entries(owner_id, person_id, date);
CREATE INDEX idx_ledger_activity ON ledger_entries(owner_id, activity_id);

-- Same as open_points: keep the entries, drop the link
CREATE TRIGGER trg_activities_unlink_ledger
BEFORE DELETE ON activities
BEGIN
  UPDATE ledger_entries
     SET activity_id = NULL
   WHERE owner_id = OLD.owner_id AND activity_id = OLD.id;
END;
