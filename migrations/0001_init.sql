CREATE TABLE IF NOT EXISTS monitoring_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  geometry_json TEXT NOT NULL,
  area_ha REAL NOT NULL CHECK(area_ha > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_zones_active_created
  ON monitoring_zones(active, created_at);

CREATE TABLE IF NOT EXISTS scene_observations (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES monitoring_zones(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  cloud_cover REAL,
  collection TEXT NOT NULL,
  assets_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK(status IN ('candidate', 'analyzed', 'ignored', 'failed')),
  created_at TEXT NOT NULL,
  UNIQUE(zone_id, scene_id)
);

CREATE INDEX IF NOT EXISTS idx_scene_observations_zone_date
  ON scene_observations(zone_id, acquired_at DESC);

CREATE TABLE IF NOT EXISTS monitoring_runs (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES monitoring_zones(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('completed', 'failed')),
  scenes_added INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_monitoring_runs_zone_date
  ON monitoring_runs(zone_id, started_at DESC);
