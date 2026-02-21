export const SCHEMA_SQL = `
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS trails (
  id         TEXT    PRIMARY KEY NOT NULL,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trail_days (
  id         TEXT    PRIMARY KEY NOT NULL,
  trail_id   TEXT    NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  day_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id               TEXT    PRIMARY KEY NOT NULL,
  trail_day_id     TEXT    NOT NULL REFERENCES trail_days(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  source_format    TEXT    NOT NULL,
  distance_km      REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms      INTEGER,
  moving_time_ms   INTEGER,
  start_time       INTEGER,
  end_time         INTEGER,
  sort_order       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trackpoints (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id           TEXT    NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  trail_day_id          TEXT    NOT NULL,
  lat                   REAL    NOT NULL,
  lon                   REAL    NOT NULL,
  elevation             REAL,
  timestamp             INTEGER,
  point_index           INTEGER NOT NULL,
  distance_from_start_m REAL    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tp_activity  ON trackpoints(activity_id);
CREATE INDEX IF NOT EXISTS idx_tp_trail_day ON trackpoints(trail_day_id);
CREATE INDEX IF NOT EXISTS idx_act_trail_day ON activities(trail_day_id);
CREATE INDEX IF NOT EXISTS idx_td_trail      ON trail_days(trail_id);
`.trim()
