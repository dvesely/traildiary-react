CREATE TABLE trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trail_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_day_id UUID REFERENCES trail_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_format TEXT NOT NULL,
  distance_km REAL,
  elevation_gain_m REAL,
  elevation_loss_m REAL,
  duration_ms BIGINT,
  moving_time_ms BIGINT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trackpoints (
  id BIGSERIAL PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  elevation REAL,
  timestamp TIMESTAMPTZ,
  heart_rate SMALLINT,
  cadence SMALLINT,
  point_index INTEGER NOT NULL
);

CREATE INDEX idx_trackpoints_activity ON trackpoints(activity_id);
CREATE INDEX idx_activities_trail_day ON activities(trail_day_id);
CREATE INDEX idx_trail_days_trail ON trail_days(trail_id);
