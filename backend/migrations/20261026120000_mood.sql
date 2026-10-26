-- How an activity felt, 1 = very bad … 5 = very good. NULL on the activity
-- means no mood; on a link it means the activity's mood applies – a link may
-- have a mood even when the activity has none.
ALTER TABLE activities      ADD COLUMN mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5);
ALTER TABLE activity_people ADD COLUMN mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5); -- NULL = activity's mood
ALTER TABLE activity_groups ADD COLUMN mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5); -- NULL = activity's mood
